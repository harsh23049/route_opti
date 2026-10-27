/**
 * Formatting helpers for distances, percentages, and execution timings
 */

export function formatDistance(km) {
  if (km === undefined || km === null || isNaN(km)) return '0.00 km';
  if (km < 1.0) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${Number(km).toFixed(2)} km`;
}

export function formatPercentage(pct) {
  if (pct === undefined || pct === null || isNaN(pct)) return '0.0%';
  return `${Number(pct).toFixed(1)}%`;
}

export function formatExecutionTime(ms) {
  if (ms === undefined || ms === null || isNaN(ms)) return '0.00 ms';
  if (ms < 1.0) {
    return `${Number(ms).toFixed(3)} ms`;
  }
  return `${Number(ms).toFixed(2)} ms`;
}
