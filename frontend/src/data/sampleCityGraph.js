/**
 * Real OpenStreetMap road networks, built by scripts/build-city-presets.mjs into
 * public/cities/ and fetched when selected (each is a few hundred KB).
 */
export const CITY_PRESETS = [
  { id: 'delhi_cp', name: 'New Delhi · Connaught Place (real map)' },
  { id: 'bengaluru_koramangala', name: 'Bengaluru · Koramangala (real map)' }
];

export const cityPresetUrl = (id) => `${import.meta.env.BASE_URL}cities/${id}.json`;

/**
 * Sample City Road Network Presets.
 * Labeled as sample data for preview and submission to the C++ algorithm engine.
 * The SVG roads on the map are rendered directly from these road edges.
 */

export const SAMPLE_PRESETS = [
  {
    id: 'downtown_grid',
    name: 'Downtown Metro Grid (5 Stops)',
    description: 'Dense commercial street network with 9 intersections and multiple alternative avenues.',
    warehouse: 'W',
    availableCustomerStops: ['S1', 'S2', 'S3', 'S4', 'S5'],
    defaultStopCount: 4,
    nodes: [
      { id: 'W',  name: 'Central Logistics Hub',     lat: 37.7830, lng: -122.4080, type: 'warehouse' },
      { id: 'S1', name: 'North Market Drop',         lat: 37.7915, lng: -122.3990, type: 'customer' },
      { id: 'S2', name: 'Financial Center Tower',    lat: 37.7940, lng: -122.4020, type: 'customer' },
      { id: 'S3', name: 'Tech Innovation Campus',    lat: 37.7875, lng: -122.3910, type: 'customer' },
      { id: 'S4', name: 'South Park Residential',    lat: 37.7820, lng: -122.3940, type: 'customer' },
      { id: 'S5', name: 'Civic Plaza Terminal',      lat: 37.7795, lng: -122.4185, type: 'customer' },
      { id: 'J1', name: 'Market & 3rd Junction',     lat: 37.7880, lng: -122.4030, type: 'junction' },
      { id: 'J2', name: 'Mission & 4th Junction',    lat: 37.7845, lng: -122.4040, type: 'junction' },
      { id: 'J3', name: 'Folsom Overpass',           lat: 37.7818, lng: -122.4010, type: 'junction' }
    ],
    roads: [
      { source: 'W',  target: 'J1', distance_km: 0.85, street_name: 'Hub Boulevard' },
      { source: 'W',  target: 'J2', distance_km: 0.50, street_name: 'Depot Way' },
      { source: 'W',  target: 'S5', distance_km: 1.20, street_name: 'Civic Arterial' },
      { source: 'J1', target: 'S1', distance_km: 0.65, street_name: 'Market Street' },
      { source: 'S1', target: 'S2', distance_km: 0.40, street_name: 'Plaza Way' },
      { source: 'S2', target: 'J1', distance_km: 0.70, street_name: 'Financial Highway' },
      { source: 'J1', target: 'J2', distance_km: 0.45, street_name: 'Midtown Connector' },
      { source: 'J2', target: 'J3', distance_km: 0.40, street_name: 'Mission Spine' },
      { source: 'J3', target: 'S4', distance_km: 0.60, street_name: 'South Park Lane' },
      { source: 'S4', target: 'S3', distance_km: 0.75, street_name: 'Tech Corridor' },
      { source: 'S3', target: 'S1', distance_km: 0.90, street_name: 'East Bay Link' },
      { source: 'S5', target: 'J2', distance_km: 1.10, street_name: 'Westgate Avenue' }
    ]
  },
  {
    id: 'express_corridor',
    name: 'Express Corridor (3 Stops)',
    description: 'Fast perimeter highway loop connecting 3 primary industrial delivery points.',
    warehouse: 'W',
    availableCustomerStops: ['S1', 'S2', 'S3'],
    defaultStopCount: 3,
    nodes: [
      { id: 'W',  name: 'Logistics Depot',           lat: 37.7800, lng: -122.4100, type: 'warehouse' },
      { id: 'S1', name: 'Harbor Gate Terminal',      lat: 37.7950, lng: -122.3950, type: 'customer' },
      { id: 'S2', name: 'Eastside Retail Hub',       lat: 37.7850, lng: -122.3900, type: 'customer' },
      { id: 'S3', name: 'Airport Cargo District',    lat: 37.7720, lng: -122.4050, type: 'customer' },
      { id: 'J1', name: 'North Interchange',         lat: 37.7900, lng: -122.4050, type: 'junction' },
      { id: 'J2', name: 'South Crossroads',          lat: 37.7760, lng: -122.4000, type: 'junction' }
    ],
    roads: [
      { source: 'W',  target: 'J1', distance_km: 1.20, street_name: 'North Expressway' },
      { source: 'W',  target: 'J2', distance_km: 0.90, street_name: 'South Avenue' },
      { source: 'J1', target: 'S1', distance_km: 0.80, street_name: 'Harbor Way' },
      { source: 'S1', target: 'S2', distance_km: 1.10, street_name: 'Coastal Road' },
      { source: 'S2', target: 'J2', distance_km: 0.70, street_name: 'East Connector' },
      { source: 'J2', target: 'S3', distance_km: 0.60, street_name: 'Cargo Drive' },
      { source: 'S3', target: 'W',  distance_km: 1.00, street_name: 'Depot Return Link' }
    ]
  },
  {
    id: 'full_city_loop',
    name: 'Full City Loop (7 Stops)',
    description: 'Comprehensive city-wide distribution scenario visiting 7 customer locations across all sectors.',
    warehouse: 'W',
    availableCustomerStops: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'],
    defaultStopCount: 7,
    nodes: [
      { id: 'W',  name: 'Central Warehouse',         lat: 37.7820, lng: -122.4050, type: 'warehouse' },
      { id: 'S1', name: 'Northwest Medical Drop',    lat: 37.7930, lng: -122.4160, type: 'customer' },
      { id: 'S2', name: 'North Market Plaza',        lat: 37.7960, lng: -122.4040, type: 'customer' },
      { id: 'S3', name: 'Northeast Harbor Pier',     lat: 37.7920, lng: -122.3920, type: 'customer' },
      { id: 'S4', name: 'Tech Park Block B',         lat: 37.7860, lng: -122.3900, type: 'customer' },
      { id: 'S5', name: 'South Garden Cafe',         lat: 37.7780, lng: -122.3940, type: 'customer' },
      { id: 'S6', name: 'Westfield Shopping Mall',   lat: 37.7740, lng: -122.4080, type: 'customer' },
      { id: 'S7', name: 'Civic Center Library',      lat: 37.7780, lng: -122.4200, type: 'customer' },
      { id: 'J1', name: 'Midtown North Hub',         lat: 37.7890, lng: -122.4060, type: 'junction' },
      { id: 'J2', name: 'Midtown South Hub',         lat: 37.7800, lng: -122.4020, type: 'junction' },
      { id: 'J3', name: 'West Valley Intersection',  lat: 37.7760, lng: -122.4140, type: 'junction' },
      { id: 'J4', name: 'East Ring Junction',        lat: 37.7840, lng: -122.3950, type: 'junction' }
    ],
    roads: [
      { source: 'W',  target: 'J1', distance_km: 0.80, street_name: 'Central Spine' },
      { source: 'W',  target: 'J2', distance_km: 0.40, street_name: 'Depot South Alley' },
      { source: 'W',  target: 'J3', distance_km: 0.90, street_name: 'Highland Approach' },
      { source: 'J1', target: 'S1', distance_km: 0.95, street_name: 'Northwest Boulevard' },
      { source: 'S1', target: 'S2', distance_km: 0.70, street_name: 'Upper Market' },
      { source: 'S2', target: 'S3', distance_km: 0.85, street_name: 'Pier Highway' },
      { source: 'S3', target: 'J4', distance_km: 0.60, street_name: 'Bayside Way' },
      { source: 'J4', target: 'S4', distance_km: 0.40, street_name: 'Tech Lane' },
      { source: 'S4', target: 'S5', distance_km: 0.70, street_name: 'South Park Drive' },
      { source: 'S5', target: 'J2', distance_km: 0.50, street_name: 'Garden Connector' },
      { source: 'J2', target: 'S6', distance_km: 0.65, street_name: 'Mall Overpass' },
      { source: 'S6', target: 'J3', distance_km: 0.50, street_name: 'Valley Boulevard' },
      { source: 'J3', target: 'S7', distance_km: 0.60, street_name: 'Civic Way' },
      { source: 'S7', target: 'S1', distance_km: 1.30, street_name: 'Westside Outer Ring' },
      { source: 'J1', target: 'J4', distance_km: 0.90, street_name: 'Cross-Town Link' }
    ]
  }
];
