#!/usr/bin/env node

/**
 * Controlled MIPC HTTP load harness.
 *
 * Safe defaults:
 *   MIPC_LOAD_BASE_URL=http://localhost:3000
 *   MIPC_LOAD_PATH=/student
 *   MIPC_LOAD_STAGES=100,250,500,750,1000
 *   MIPC_LOAD_REQUESTS_PER_USER=1
 *
 * For authenticated testing, provide MIPC_LOAD_COOKIES_FILE pointing to a JSON
 * array of cookie-header strings. Distinct sessions are preferred because they
 * exercise Auth/RLS realistically instead of replaying one account 1,000 times.
 *
 * Any non-local target requires MIPC_LOAD_CONFIRM=YES.
 */

import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const baseUrl = (process.env.MIPC_LOAD_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const requestPath = process.env.MIPC_LOAD_PATH || '/student';
const requestsPerUser = clampInt(process.env.MIPC_LOAD_REQUESTS_PER_USER, 1, 1, 20);
const timeoutMs = clampInt(process.env.MIPC_LOAD_TIMEOUT_MS, 15_000, 1_000, 120_000);
const stages = parseStages(process.env.MIPC_LOAD_STAGES || '100,250,500,750,1000');
const pauseMs = clampInt(process.env.MIPC_LOAD_STAGE_PAUSE_MS, 5_000, 0, 120_000);
const remoteConfirmed = process.env.MIPC_LOAD_CONFIRM === 'YES';
const parsedBase = new URL(baseUrl);
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsedBase.hostname);

if (!isLocal && !remoteConfirmed) {
  console.error('Refusing to load-test a non-local target. Set MIPC_LOAD_CONFIRM=YES only after confirming the target is approved for load testing.');
  process.exit(2);
}

const cookies = await readCookies(process.env.MIPC_LOAD_COOKIES_FILE);
if (cookies.length > 0 && cookies.length < Math.max(...stages)) {
  console.warn(`Only ${cookies.length} authenticated sessions were supplied. Sessions will be reused for stages above that number.`);
}

console.log(`MIPC load target: ${baseUrl}${requestPath}`);
console.log(`Stages: ${stages.join(' → ')} concurrent users; ${requestsPerUser} request(s) per user`);
console.log(cookies.length ? `Authenticated sessions: ${cookies.length}` : 'Authenticated sessions: none (public/redirect behavior only)');

let failedStage = false;
for (let index = 0; index < stages.length; index += 1) {
  const concurrency = stages[index];
  const result = await runStage(concurrency);
  printStage(result);

  // Default readiness gates can be overridden for exploratory tests.
  const maxErrorRate = Number(process.env.MIPC_LOAD_MAX_ERROR_RATE ?? '0.01');
  const maxP95Ms = Number(process.env.MIPC_LOAD_MAX_P95_MS ?? '2000');
  if (result.errorRate > maxErrorRate || result.p95 > maxP95Ms) failedStage = true;

  if (index < stages.length - 1 && pauseMs > 0) await sleep(pauseMs);
}

if (failedStage) {
  console.error('Load-readiness gate failed. Review the stage metrics above.');
  process.exitCode = 1;
} else {
  console.log('All configured load-readiness gates passed.');
}

async function runStage(concurrency) {
  const started = performance.now();
  const results = [];
  let cursor = 0;

  async function virtualUser(userIndex) {
    const cookie = cookies.length ? cookies[userIndex % cookies.length] : '';
    for (let requestIndex = 0; requestIndex < requestsPerUser; requestIndex += 1) {
      const sequence = cursor++;
      results[sequence] = await makeRequest(cookie);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => virtualUser(index)));
  const elapsedMs = performance.now() - started;
  const durations = results.map((item) => item.durationMs).sort((a, b) => a - b);
  const errors = results.filter((item) => !item.ok);
  const statuses = new Map();
  for (const result of results) statuses.set(result.status, (statuses.get(result.status) || 0) + 1);

  return {
    concurrency,
    requests: results.length,
    elapsedMs,
    requestsPerSecond: results.length / (elapsedMs / 1000),
    errorRate: results.length ? errors.length / results.length : 0,
    p50: percentile(durations, 0.50),
    p95: percentile(durations, 0.95),
    p99: percentile(durations, 0.99),
    statuses
  };
}

async function makeRequest(cookie) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        ...(cookie ? { cookie } : {})
      }
    });
    // 2xx and expected auth redirects are transport-successful. For a real
    // authenticated run, use sessions and expect 2xx portal responses.
    const ok = response.status >= 200 && response.status < 400;
    await response.body?.cancel().catch(() => {});
    return { ok, status: response.status, durationMs: performance.now() - started };
  } catch (error) {
    return {
      ok: false,
      status: error?.name === 'AbortError' ? 'timeout' : 'network-error',
      durationMs: performance.now() - started
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printStage(result) {
  const statusText = Array.from(result.statuses.entries()).map(([status, count]) => `${status}:${count}`).join(' ');
  console.log(`\n[${result.concurrency} concurrent] ${result.requests} requests in ${result.elapsedMs.toFixed(0)} ms`);
  console.log(`  throughput ${result.requestsPerSecond.toFixed(1)} req/s | errors ${(result.errorRate * 100).toFixed(2)}%`);
  console.log(`  latency p50 ${result.p50.toFixed(0)} ms | p95 ${result.p95.toFixed(0)} ms | p99 ${result.p99.toFixed(0)} ms`);
  console.log(`  statuses ${statusText || 'none'}`);
}

async function readCookies(path) {
  if (!path) return [];
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error('MIPC_LOAD_COOKIES_FILE must contain a JSON array of cookie-header strings.');
  }
  return parsed.filter(Boolean);
}

function parseStages(value) {
  const parsed = value.split(',').map((item) => Number.parseInt(item.trim(), 10)).filter((item) => Number.isInteger(item) && item > 0 && item <= 5_000);
  if (!parsed.length) throw new Error('MIPC_LOAD_STAGES must contain at least one positive concurrency value.');
  return [...new Set(parsed)];
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function percentile(sortedValues, ratio) {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[index];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
