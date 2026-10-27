const { spawn } = require('child_process');
const fs = require('fs');
const config = require('../config');

function httpError(message, code, statusCode) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

// Bounded job pool: at most maxConcurrentJobs engine processes, up to maxQueuedJobs waiting.
let activeJobs = 0;
const waiting = [];

async function acquireSlot() {
  if (activeJobs < config.maxConcurrentJobs) {
    activeJobs++;
    return;
  }
  if (waiting.length >= config.maxQueuedJobs) {
    throw httpError('Optimization engine is busy, please retry shortly', 'ENGINE_BUSY', 503);
  }
  // release() hands its slot straight to the next waiter, so activeJobs is unchanged here.
  await new Promise((resolve) => waiting.push(resolve));
}

function releaseSlot() {
  const next = waiting.shift();
  if (next) next();
  else activeJobs--;
}

/**
 * Runs one engine process: writes the payload to stdin and parses the JSON on stdout.
 * Never invokes a shell or puts user input on the command line.
 */
function spawnEngine(payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.cppExecutablePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdoutData = '';
    let stderrData = '';
    let isTimedOut = false;

    // The engine holds no external resources, so a hard kill is safe.
    const timer = setTimeout(() => {
      isTimedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    proc.stdin.on('error', (err) => {
      // EPIPE means the process exited before reading all input; 'close' reports the outcome.
      if (err.code !== 'EPIPE') {
        console.error('[cppRunner] Stdin error:', err);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      console.error('[cppRunner] Failed to start engine:', err);
      reject(httpError('Failed to start optimization engine', 'ENGINE_START_FAILED', 500));
    });

    proc.on('close', (code) => {
      clearTimeout(timer);

      if (isTimedOut) {
        return reject(httpError(`Optimization process timed out after ${timeoutMs}ms`, 'PROCESS_TIMEOUT', 504));
      }

      if (stderrData.trim()) {
        console.warn(`[cppRunner stderr] ${stderrData.trim()}`);
      }

      // The engine prints one JSON document even when it exits non-zero.
      let parsed;
      try {
        parsed = JSON.parse(stdoutData.trim());
      } catch {
        console.error(`[cppRunner] Engine exited with code ${code} and non-JSON output. Stderr: ${stderrData.trim() || 'none'}`);
        return reject(httpError('Optimization engine returned malformed output', 'MALFORMED_ENGINE_OUTPUT', 500));
      }

      // Application-level algorithm error (e.g. unreachable stops)
      if (parsed.success === false) {
        const algoErr = httpError(parsed.error || 'Optimization failed in C++ engine', 'ALGORITHM_ERROR', 400);
        algoErr.details = parsed;
        return reject(algoErr);
      }

      resolve(parsed);
    });

    proc.stdin.end(JSON.stringify(payload));
  });
}

/**
 * Executes the compiled C++ optimization engine for a validated payload.
 *
 * @param {Object} payload Normalized JSON payload
 * @param {number} [timeoutMs] Timeout in milliseconds
 * @returns {Promise<Object>} Parsed JSON response from C++ engine
 */
async function runOptimizer(payload, timeoutMs = config.executionTimeoutMs) {
  if (!fs.existsSync(config.cppExecutablePath)) {
    console.error(`[cppRunner] Engine binary not found at ${config.cppExecutablePath}`);
    throw httpError(
      'C++ optimizer executable not found. Build it with: npm run build:cpp',
      'EXECUTABLE_NOT_FOUND',
      500
    );
  }

  await acquireSlot();
  try {
    return await spawnEngine(payload, timeoutMs);
  } finally {
    releaseSlot();
  }
}

module.exports = {
  runOptimizer
};
