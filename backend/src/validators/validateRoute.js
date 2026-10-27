/**
 * Input validator for route optimization request payloads.
 * Validates graph structure, node IDs, non-negative edge weights,
 * warehouse existence, and required delivery stop IDs.
 */

function validateOptimizeInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { isValid: false, error: 'Request body must be a valid JSON object' };
  }

  // 1. Validate Nodes array
  if (!Array.isArray(body.nodes) || body.nodes.length === 0) {
    return { isValid: false, error: "'nodes' must be a non-empty array of node objects" };
  }

  const nodeSet = new Set();
  const normalizedNodes = [];

  for (let i = 0; i < body.nodes.length; i++) {
    const node = body.nodes[i];
    if (!node || typeof node !== 'object') {
      return { isValid: false, error: `Node at index ${i} must be an object` };
    }

    if (typeof node.id !== 'string' || node.id.trim() === '') {
      return { isValid: false, error: `Node at index ${i} must contain a non-empty string 'id'` };
    }

    const id = node.id.trim();
    if (nodeSet.has(id)) {
      return { isValid: false, error: `Duplicate node ID detected: '${id}'` };
    }
    nodeSet.add(id);

    normalizedNodes.push({
      id,
      name: typeof node.name === 'string' ? node.name : id,
      lat: typeof node.lat === 'number' ? node.lat : 0.0,
      lng: typeof node.lng === 'number' ? node.lng : 0.0
    });
  }

  // 2. Extract and Validate Warehouse ID
  let warehouseId = null;
  if (typeof body.warehouse === 'string' && body.warehouse.trim() !== '') {
    warehouseId = body.warehouse.trim();
  } else if (typeof body.warehouseId === 'string' && body.warehouseId.trim() !== '') {
    warehouseId = body.warehouseId.trim();
  } else if (body.depot) {
    if (typeof body.depot === 'string' && body.depot.trim() !== '') {
      warehouseId = body.depot.trim();
    } else if (typeof body.depot === 'object' && typeof body.depot.id === 'string' && body.depot.id.trim() !== '') {
      warehouseId = body.depot.id.trim();
    }
  }

  if (!warehouseId) {
    return { isValid: false, error: "A valid 'warehouse' (or 'warehouseId' or 'depot.id') string is required" };
  }

  if (!nodeSet.has(warehouseId)) {
    return { isValid: false, error: `Specified warehouse '${warehouseId}' does not exist in 'nodes'` };
  }

  // 3. Validate Roads / Edges array
  const rawRoads = body.roads || body.edges;
  if (!Array.isArray(rawRoads)) {
    return { isValid: false, error: "'roads' must be an array of road edge objects" };
  }

  const normalizedRoads = [];
  for (let i = 0; i < rawRoads.length; i++) {
    const road = rawRoads[i];
    if (!road || typeof road !== 'object') {
      return { isValid: false, error: `Road at index ${i} must be an object` };
    }

    const source = typeof road.source === 'string' ? road.source.trim() : '';
    const target = typeof road.target === 'string' ? road.target.trim() : '';

    if (!source || !target) {
      return { isValid: false, error: `Road at index ${i} must have non-empty 'source' and 'target' node IDs` };
    }

    if (!nodeSet.has(source)) {
      return { isValid: false, error: `Road at index ${i} references non-existent source node: '${source}'` };
    }

    if (!nodeSet.has(target)) {
      return { isValid: false, error: `Road at index ${i} references non-existent target node: '${target}'` };
    }

    // Determine distance/weight
    let dist = road.distance_km;
    if (dist === undefined) dist = road.distanceKm;
    if (dist === undefined) dist = road.distance;
    if (dist === undefined) dist = road.weight;

    if (typeof dist !== 'number' || isNaN(dist) || dist < 0) {
      return { isValid: false, error: `Road at index ${i} (${source} -> ${target}) must have a non-negative numeric distance` };
    }

    normalizedRoads.push({
      source,
      target,
      distance_km: dist,
      street_name: typeof road.street_name === 'string' ? road.street_name : ''
    });
  }

  // 4. Extract and Validate Required Delivery Stops
  let rawStops = body.stops;
  if (rawStops === undefined) rawStops = body.deliveryStops;
  if (rawStops === undefined) rawStops = body.sampleDeliveryStops;

  if (rawStops !== undefined && !Array.isArray(rawStops)) {
    return { isValid: false, error: "'stops' must be an array of stop node IDs" };
  }

  const normalizedStops = [];
  if (Array.isArray(rawStops)) {
    for (let i = 0; i < rawStops.length; i++) {
      const item = rawStops[i];
      let stopId = '';
      if (typeof item === 'string') {
        stopId = item.trim();
      } else if (item && typeof item === 'object') {
        if (typeof item.id === 'string') stopId = item.id.trim();
        else if (typeof item.nodeId === 'string') stopId = item.nodeId.trim();
      }

      if (!stopId) {
        return { isValid: false, error: `Stop at index ${i} must specify a valid node ID` };
      }

      if (!nodeSet.has(stopId)) {
        return { isValid: false, error: `Delivery stop '${stopId}' does not exist in 'nodes'` };
      }

      normalizedStops.push(stopId);
    }
  }

  if (normalizedStops.length === 0) {
    return { isValid: false, error: "At least one required delivery stop must be provided in 'stops'" };
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
