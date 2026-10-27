/**
 * Client service for interacting with the Express optimization API.
 * Calls backend endpoints without duplicating algorithmic logic in JavaScript.
 */

const API_BASE = '/api';

/**
 * Checks system health and C++ binary availability.
 * @returns {Promise<{ online: boolean, executableExists: boolean, error?: string }>}
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      online: true,
      executableExists: Boolean(data?.executable?.exists),
      data
    };
  } catch (err) {
    return {
      online: false,
      executableExists: false,
      error: err.message
    };
  }
}

/**
 * Submits road graph, warehouse, and stops to C++ optimizer via Express backend.
 * @param {Object} payload - { nodes, roads, warehouse, stops }
 * @returns {Promise<Object>} Optimization results from compiled C++ engine
 */
export async function optimizeRoute(payload) {
  let response;
  try {
    response = await fetch(`${API_BASE}/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (networkErr) {
    throw new Error(
      `Cannot connect to backend server on port 5001. Please verify the Express backend is running. (${networkErr.message})`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new Error(`Invalid JSON response received from backend (${response.status})`);
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Optimization failed with status code ${response.status}`);
  }

  return data;
}
