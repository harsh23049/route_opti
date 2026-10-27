const config = require('../config');

/**
 * Validator for POST /api/optimize — the API trust boundary.
 *
 * Schema (strict, no aliases):
 *   {
 *     warehouse: string,
 *     stops: string[],
 *     nodes: [{ id: string, name?: string, lat?: number, lng?: number }],
 *     roads: [{ source: string, target: string, distance_km: number, street_name?: string }]
 *   }
 *
 * Returns { isValid: true, normalizedPayload } or { isValid: false, error }.
 */

const fail = (error) => ({ isValid: false, error });
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const isFiniteInRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

function validateOptimizeInput(body, limits = config.limits) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a valid JSON object');
  }
  const { warehouse, stops, nodes, roads } = body;

  // 1. Nodes
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return fail("'nodes' must be a non-empty array of node objects");
  }
  if (nodes.length > limits.maxNodes) {
    return fail(`'nodes' has ${nodes.length} entries; the limit is ${limits.maxNodes}`);
  }

  const nodeIds = new Set();
  const normalizedNodes = [];
  for (const [i, node] of nodes.entries()) {
    if (!node || typeof node !== 'object') {
      return fail(`Node at index ${i} must be an object`);
    }
    if (!isNonEmptyString(node.id)) {
      return fail(`Node at index ${i} must contain a non-empty string 'id'`);
    }
    const id = node.id.trim();
    if (nodeIds.has(id)) {
      return fail(`Duplicate node ID detected: '${id}'`);
    }

    const lat = node.lat ?? 0;
    const lng = node.lng ?? 0;
    if (!isFiniteInRange(lat, -90, 90) || !isFiniteInRange(lng, -180, 180)) {
      return fail(`Node '${id}' must have numeric 'lat' in [-90, 90] and 'lng' in [-180, 180]`);
    }

    nodeIds.add(id);
    normalizedNodes.push({ id, name: typeof node.name === 'string' ? node.name : id, lat, lng });
  }

  // 2. Warehouse
  if (!isNonEmptyString(warehouse)) {
    return fail("A valid 'warehouse' node ID string is required");
  }
  const warehouseId = warehouse.trim();
  if (!nodeIds.has(warehouseId)) {
    return fail(`Specified warehouse '${warehouseId}' does not exist in 'nodes'`);
  }

  // 3. Roads
  if (!Array.isArray(roads)) {
    return fail("'roads' must be an array of road edge objects");
  }
  if (roads.length > limits.maxRoads) {
    return fail(`'roads' has ${roads.length} entries; the limit is ${limits.maxRoads}`);
  }

  const normalizedRoads = [];
  for (const [i, road] of roads.entries()) {
    if (!road || typeof road !== 'object') {
      return fail(`Road at index ${i} must be an object`);
    }
    const source = isNonEmptyString(road.source) ? road.source.trim() : '';
    const target = isNonEmptyString(road.target) ? road.target.trim() : '';
    if (!source || !target) {
      return fail(`Road at index ${i} must have non-empty 'source' and 'target' node IDs`);
    }
    if (!nodeIds.has(source)) {
      return fail(`Road at index ${i} references non-existent source node: '${source}'`);
    }
    if (!nodeIds.has(target)) {
      return fail(`Road at index ${i} references non-existent target node: '${target}'`);
    }

    // Number.isFinite also rejects 1e400, which JSON.parse turns into Infinity.
    const distance = road.distance_km;
    if (!Number.isFinite(distance) || distance < 0) {
      return fail(`Road at index ${i} (${source} -> ${target}) must have a finite, non-negative numeric 'distance_km'`);
    }

    normalizedRoads.push({
      source,
      target,
      distance_km: distance,
      street_name: typeof road.street_name === 'string' ? road.street_name : ''
    });
  }

  // 4. Stops
  if (!Array.isArray(stops) || stops.length === 0) {
    return fail("'stops' must be a non-empty array of node ID strings");
  }
  if (stops.length > limits.maxStops) {
    return fail(`'stops' has ${stops.length} entries; the limit is ${limits.maxStops}`);
  }

  const normalizedStops = [];
  for (const [i, stop] of stops.entries()) {
    if (!isNonEmptyString(stop)) {
      return fail(`Stop at index ${i} must be a non-empty node ID string`);
    }
    const stopId = stop.trim();
    if (!nodeIds.has(stopId)) {
      return fail(`Delivery stop '${stopId}' does not exist in 'nodes'`);
    }
    normalizedStops.push(stopId);
  }

  return {
    isValid: true,
    normalizedPayload: {
      warehouse: warehouseId,
      stops: normalizedStops,
      nodes: normalizedNodes,
      roads: normalizedRoads
    }
  };
}

module.exports = {
  validateOptimizeInput
};
