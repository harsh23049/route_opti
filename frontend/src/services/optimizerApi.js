/**
 * Client service for the Express optimization API.
 * The backend is the only source of truth for routes.
 */

const API_BASE = '/api';
const OPTIMIZE_TIMEOUT_MS = 15000;

const FRIENDLY = {
  ENGINE_BUSY: 'Engine busy, retry in a moment.',
  PROCESS_TIMEOUT: 'The route engine took too long to answer. Try fewer stops or retry.',
  JSON_SYNTAX_ERROR: 'The request could not be read by the server.',
  OFFLINE: 'Backend offline. Start it with "cd backend && npm start" (port 5001).',
  CLIENT_TIMEOUT: 'No answer from the backend after 15 seconds. Please retry.'
};

export class OptimizerError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'OptimizerError';
    this.code = code;
    this.status = status;
  }
}

/** @returns {Promise<{ online: boolean, executableExists: boolean, error?: string }>} */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { online: true, executableExists: Boolean(data?.executable?.exists) };
  } catch (err) {
    return { online: false, executableExists: false, error: err.message };
  }
}

/**
 * @param {{ warehouse: string, stops: string[], nodes: object[], roads: object[] }} payload
 */
export async function optimizeRoute(payload) {
  let response;
  try {
    response = await fetch(`${API_BASE}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(OPTIMIZE_TIMEOUT_MS)
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new OptimizerError(FRIENDLY.CLIENT_TIMEOUT, 'CLIENT_TIMEOUT');
    }
    throw new OptimizerError(FRIENDLY.OFFLINE, 'NETWORK_ERROR');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    if (response.status === 502 || response.status === 504 || response.status === 503) {
      throw new OptimizerError(FRIENDLY.OFFLINE, 'NETWORK_ERROR', response.status);
    }
    throw new OptimizerError(`Unexpected response from backend (HTTP ${response.status}).`, 'BAD_RESPONSE', response.status);
  }

  if (!response.ok || !data?.success) {
    const code = data?.code || 'UNKNOWN';
    const serverText = data?.error;
    let message;
    if (code === 'VALIDATION_ERROR' || code === 'ALGORITHM_ERROR') {
      message = serverText || 'The request was rejected by the route engine.';
    } else if (FRIENDLY[code]) {
      message = FRIENDLY[code];
    } else {
      message = serverText || `Optimization failed (HTTP ${response.status}).`;
    }
    throw new OptimizerError(message, code, response.status);
  }
  return data;
}
