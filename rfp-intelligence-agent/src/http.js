const config = require('./config');

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    signal: options.signal || timeoutSignal(options.timeoutMs || 15000),
    headers: {
      'User-Agent': options.userAgent || config.userAgent,
      Accept: 'text/html,application/xhtml+xml',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function withRetry(fn, options = {}) {
  const retries = Number(options.retries ?? 2);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const delay = Number(options.baseDelayMs || 350) * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

module.exports = { timeoutSignal, fetchText, withRetry };
