import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCustomStops } from './customStops.js';

const preset = {
  warehouse: 'W',
  nodes: [
    { id: 'W', name: 'Depot', lat: 0, lng: 0 },
    { id: 'A', name: 'A', lat: 0, lng: 0.01 }
  ],
  roads: [{ source: 'W', target: 'A', distance_km: 2, street_name: 'Main' }]
};

test('no custom stops returns the preset unchanged', () => {
  assert.equal(withCustomStops(preset, []), preset);
});

test('stop beside the middle of a road splits it and adds a spur', () => {
  const g = withCustomStops(preset, [{ id: 'C1', name: 'New stop 1', lat: 0.001, lng: 0.005 }]);
  assert.deepEqual(g.nodes.map((n) => n.id), ['W', 'A', 'C1', 'C1-access']);
  const [h1, h2, spur] = g.roads;
  assert.deepEqual([h1.source, h1.target, h2.source, h2.target], ['W', 'C1-access', 'C1-access', 'A']);
  assert.equal(h1.distance_km + h2.distance_km, 2);
  assert.equal(h1.street_name, 'Main');
  assert.deepEqual([spur.source, spur.target, spur.custom], ['C1-access', 'C1', true]);
  // 0.001 deg lat is ~0.11 km, scaled by road km / geometric km (2 / ~1.11).
  assert.ok(spur.distance_km > 0.18 && spur.distance_km < 0.22, `spur ${spur.distance_km}`);
  assert.equal(preset.roads.length, 1, 'preset is not mutated');
});

test('stop near a road end attaches to that node without splitting', () => {
  const g = withCustomStops(preset, [{ id: 'C1', name: 'X', lat: 0.002, lng: 0 }]);
  assert.equal(g.nodes.length, 3);
  assert.deepEqual(g.roads.map((r) => [r.source, r.target]), [['W', 'A'], ['W', 'C1']]);
});

test('second stop can snap onto a road split by the first', () => {
  const g = withCustomStops(preset, [
    { id: 'C1', name: 'X', lat: 0.001, lng: 0.003 },
    { id: 'C2', name: 'Y', lat: -0.001, lng: 0.007 }
  ]);
  const ids = new Set(g.nodes.map((n) => n.id));
  assert.equal(ids.size, g.nodes.length, 'unique ids');
  for (const r of g.roads) assert.ok(ids.has(r.source) && ids.has(r.target));
  const mainKm = g.roads.filter((r) => r.street_name === 'Main').reduce((s, r) => s + r.distance_km, 0);
  assert.ok(Math.abs(mainKm - 2) < 1e-9, `Main road length kept: ${mainKm}`);
});
