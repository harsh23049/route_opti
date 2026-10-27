const { spawn } = require('child_process');
const fs = require('fs');
const config = require('../config');

/**
 * Executes the compiled C++ optimization engine via child_process.spawn.
 * Uses structured pipes for stdin and stdout.
 * Never invokes a shell or concatenates user input into command lines.
 *
 * @param {Object} payload Normalized JSON payload
 * @param {number} [timeoutMs] Timeout in milliseconds
 * @returns {Promise<Object>} Parsed JSON response from C++ engine
 */
function runOptimizer(payload, timeoutMs = config.executionTimeoutMs) {
  return new Promise((resolve, reject) => {
    // 1. Verify executable exists
    if (!fs.existsSync(config.cppExecutablePath)) {
      const err = new Error(
        `C++ optimizer executable not found at: '${config.cppExecutablePath}'. ` +
        `Please build it using: cmake -B algorithms/build -S algorithms && cmake --build algorithms/build`
      );
      err.code = 'EXECUTABLE_NOT_FOUND';
      err.statusCode = 500;
      return reject(err);
    }

    // 2. Spawn C++ process with direct binary invocation (no shell)
    const proc = spawn(config.cppExecutablePath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';
    let isTimedOut = false;

    // 3. Set execution timeout guard
    const timer = setTimeout(() => {
      isTimedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch (_) {}
      }, 500);
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    proc.stdin.on('error', (err) => {
      // Catch EPIPE if process terminated early
      if (err.code !== 'EPIPE') {
        console.error('[cppRunner] Stdin error:', err);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      err.statusCode = 500;
      reject(err);
    });

    proc.on('close', (code, signal) => {
      clearTimeout(timer);

      if (isTimedOut) {
        const timeoutErr = new Error(`Optimization process timed out after ${timeoutMs}ms`);
        timeoutErr.code = 'PROCESS_TIMEOUT';
        timeoutErr.statusCode = 504;
        return reject(timeoutErr);
      }

      if (stderrData.trim()) {
        console.warn(`[cppRunner stderr] ${stderrData.trim()}`);
      }

      // Check if stdout contains valid JSON even on error exit
      let parsed;
      try {
        parsed = JSON.parse(stdoutData.trim());
      } catch (parseErr) {
        const err = new Error(
          `C++ optimizer exited with code ${code} and non-JSON output. ` +
          `Stderr: ${stderrData.trim() || 'none'}`
        );
        err.code = 'MALFORMED_ENGINE_OUTPUT';
        err.statusCode = 500;
        return reject(err);
      }

      // If C++ returned an application-level algorithm error (e.g. unreachable stops)
      if (parsed.success === false) {
        const algoErr = new Error(parsed.error || 'Optimization failed in C++ engine');
        algoErr.code = 'ALGORITHM_ERROR';
        algoErr.statusCode = 400;
        algoErr.details = parsed;
        return reject(algoErr);
      }

      resolve(parsed);
    });

    // 4. Send payload via stdin and close stream
    try {
      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    } catch (writeErr) {
      clearTimeout(timer);
      writeErr.statusCode = 500;
      reject(writeErr);
    }
  });
}

module.exports = {
  runOptimizer
};
