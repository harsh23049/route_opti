/**
 * Benchmarks the engine on seeded random road networks and prints a Markdown table:
 * Nearest Neighbor vs NN + 2-Opt + Or-opt vs Held-Karp optimum, plus engine latency.
 *
 * Usage: node scripts/benchmark.js [trialsPerSize=10]
 * Requires the engine to be built first: npm run build:cpp
 */
const { spawnSync } = require('child_process');
const { cppExecutablePath } = require('../backend/src/config');

const STOP_COUNTS = [5, 10, 15, 25, 50, 100];
const GRID = 20; // 20 x 20 = 400 intersections
const SPACING_KM = 0.4;
const trials = Number.parseInt(process.argv[2], 10) || 10;

// mulberry32: tiny seeded PRNG so every run benchmarks the same graphs
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Jittered grid city: 4-neighbour streets plus some diagonal avenues, roads 0-30% longer
// than the straight line. The grid edges keep every intersection reachable.
function randomCity(seed, stopCount) {
  const rand = rng(seed);
  const id = (r, c) => `N${r}_${c}`;
  const pos = new Map();
  const nodes = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const x = (c + (rand() - 0.5) * 0.6) * SPACING_KM;
      const y = (r + (rand() - 0.5) * 0.6) * SPACING_KM;
      pos.set(id(r, c), [x, y]);
      nodes.push({ id: id(r, c), lat: 37.75 + y / 111, lng: -122.45 + x / 88 });
    }
  }

  const roads = [];
  const connect = (a, b) => {
    const [ax, ay] = pos.get(a);
    const [bx, by] = pos.get(b);
    const km = Math.hypot(ax - bx, ay - by) * (1 + rand() * 0.3);
    roads.push({ source: a, target: b, distance_km: Number(km.toFixed(3)) });
  };
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (c + 1 < GRID) connect(id(r, c), id(r, c + 1));
      if (r + 1 < GRID) connect(id(r, c), id(r + 1, c));
      if (r + 1 < GRID && c + 1 < GRID && rand() < 0.2) connect(id(r, c), id(r + 1, c + 1));
    }
  }

  // Partial Fisher-Yates: first stopCount + 1 shuffled nodes become warehouse + stops.
  const ids = nodes.map((n) => n.id);
  for (let i = 0; i <= stopCount; i++) {
    const j = i + Math.floor(rand() * (ids.length - i));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { warehouse: ids[0], stops: ids.slice(1, stopCount + 1), nodes, roads };
}

function runEngine(payload) {
  const proc = spawnSync(cppExecutablePath, [], { input: JSON.stringify(payload), encoding: 'utf8' });
  if (proc.error) throw proc.error;
  const result = JSON.parse(proc.stdout);
  if (!result.success) throw new Error(result.error);
  return result;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmt = (x, digits = 2) => (x === null ? '—' : x.toFixed(digits));

const rows = [];
for (const stopCount of STOP_COUNTS) {
  const runs = [];
  for (let t = 0; t < trials; t++) {
    runs.push(runEngine(randomCity(stopCount * 1000 + t, stopCount)));
  }
  const exact = runs.every((r) => r.optimalDistance !== null);
  rows.push([
    stopCount,
    fmt(mean(runs.map((r) => r.initialDistance))),
    fmt(mean(runs.map((r) => r.stages[1].distanceKm))),
    fmt(mean(runs.map((r) => r.optimizedDistance))),
    fmt(mean(runs.map((r) => r.improvementPercent)), 1),
    exact ? fmt(mean(runs.map((r) => r.optimalDistance))) : '—',
    exact ? fmt(mean(runs.map((r) => r.optimalityGapPercent)), 2) : '—',
    exact ? `${runs.filter((r) => r.optimalityGapPercent === 0).length}/${trials}` : '—',
    fmt(median(runs.map((r) => r.executionTimeMs)), 2)
  ]);
}

console.log(`Random ${GRID}x${GRID} grid cities (${GRID * GRID} intersections), ${trials} seeded trials per row, mean values.\n`);
console.log('| Stops | NN (km) | + 2-Opt (km) | + Or-opt (km) | Improvement % | Optimal (km) | Gap to optimal % | Optimal found | Engine ms (median) |');
console.log('|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const row of rows) console.log(`| ${row.join(' | ')} |`);
