/**
 * k6 Load Testing — Manchengo Smart ERP
 *
 * Usage:
 *   k6 run tests/load/k6-scenarios.js --env BASE_URL=https://manchengo-backend-production.up.railway.app
 *   k6 run tests/load/k6-scenarios.js --env BASE_URL=http://localhost:3000
 *
 * Scenarios:
 *   1. smoke   — 10 VUs for 1 minute (basic sanity)
 *   2. load    — ramp to 500 VUs over 5 minutes (capacity test)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'admin@manchengo.dz';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'admin123';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startTime: '1m30s', // Start after smoke completes + 30s gap
      stages: [
        { duration: '1m', target: 100 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'load' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
  },
};

// Shared headers
const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

/**
 * Helper: Login and extract tokens
 */
function login() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: jsonHeaders, tags: { name: 'POST /api/auth/login' } }
  );

  loginDuration.add(res.timings.duration);

  const success = check(res, {
    'login status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login has accessToken': (r) => {
      try {
        return !!JSON.parse(r.body).accessToken;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  try {
    return JSON.parse(res.body).accessToken;
  } catch {
    return null;
  }
}

/**
 * Helper: Authenticated GET request
 */
function authGet(path, token, name) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
    tags: { name: name || `GET ${path}` },
  });

  const ok = check(res, {
    [`${name || path} status OK`]: (r) => r.status >= 200 && r.status < 400,
  });

  errorRate.add(ok ? 0 : 1);
  return res;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export default function () {
  // 1. Health check (unauthenticated)
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`, {
      tags: { name: 'GET /api/health' },
    });
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health has status ok': (r) => {
        try {
          return JSON.parse(r.body).status === 'ok';
        } catch {
          return false;
        }
      },
    });
  });

  sleep(0.5);

  // 2. Login flow
  let token;
  group('Login Flow', () => {
    token = login();
  });

  if (!token) {
    sleep(1);
    return; // Skip remaining if login failed
  }

  sleep(0.3);

  // 3. Dashboard KPIs
  group('Dashboard', () => {
    const start = Date.now();
    authGet('/api/dashboard/kpis', token, 'GET /api/dashboard/kpis');
    authGet('/api/dashboard/sales-chart', token, 'GET /api/dashboard/sales-chart');
    authGet('/api/dashboard/production-chart', token, 'GET /api/dashboard/production-chart');
    dashboardDuration.add(Date.now() - start);
  });

  sleep(0.5);

  // 4. Stock endpoints
  group('Stock', () => {
    authGet('/api/products/mp', token, 'GET /api/products/mp');
    authGet('/api/products/pf', token, 'GET /api/products/pf');
    authGet('/api/stock/mp', token, 'GET /api/stock/mp');
  });

  sleep(0.5);

  // 5. Production endpoints
  group('Production', () => {
    authGet('/api/production/orders', token, 'GET /api/production/orders');
    authGet('/api/production/dashboard', token, 'GET /api/production/dashboard');
  });

  sleep(0.5);

  // 6. Approvisionnement endpoints
  group('Appro', () => {
    authGet('/api/appro/dashboard', token, 'GET /api/appro/dashboard');
    authGet('/api/appro/purchase-orders', token, 'GET /api/appro/purchase-orders');
  });

  sleep(1);
}

/**
 * Teardown: Print summary
 */
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 'N/A';
  const errRate = data.metrics.http_req_failed?.values?.rate || 0;
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;

  console.log('═══════════════════════════════════════════════════');
  console.log('  Manchengo Smart ERP — Load Test Results');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Total requests:  ${totalReqs}`);
  console.log(`  p95 latency:     ${typeof p95 === 'number' ? p95.toFixed(0) : p95}ms`);
  console.log(`  Error rate:      ${(errRate * 100).toFixed(2)}%`);
  console.log(`  Target:          p95 < 500ms, errors < 1%`);
  console.log(`  Result:          ${p95 < 500 && errRate < 0.01 ? '✅ PASS' : '⚠️ CHECK THRESHOLDS'}`);
  console.log('═══════════════════════════════════════════════════');

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
