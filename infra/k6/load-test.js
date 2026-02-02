/**
 * Manchengo Smart ERP - k6 Load Test Suite
 *
 * Run: k6 run infra/k6/load-test.js
 * With env: k6 run -e BASE_URL=https://api.manchengo.dz infra/k6/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');
const stockDuration = new Trend('stock_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 25 },    // Stay at 25 users
    { duration: '2m', target: 50 },    // Peak at 50 concurrent users
    { duration: '30s', target: 25 },   // Ramp down
    { duration: '30s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95th percentile < 500ms
    http_req_failed: ['rate<0.05'],                    // Error rate < 5%
    errors: ['rate<0.1'],
    login_duration: ['p(95)<1000'],
    dashboard_duration: ['p(95)<500'],
    stock_duration: ['p(95)<500'],
  },
};

// Test data
const TEST_USERS = [
  { email: 'admin@manchengo.dz', password: 'Admin123!@#pass' },
  { email: 'stock@manchengo.dz', password: 'Stock123!@#pass' },
  { email: 'production@manchengo.dz', password: 'Prod123!@#pass' },
  { email: 'commercial@manchengo.dz', password: 'Comm123!@#pass' },
];

function getRandomUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

export default function () {
  let accessToken = '';

  // ─── Authentication ──────────────────────────────────────────────────
  group('Auth - Login', () => {
    const user = getRandomUser();
    const startTime = new Date();

    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    loginDuration.add(new Date() - startTime);

    const success = check(loginRes, {
      'login status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'login returns accessToken': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.accessToken;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);

    if (loginRes.status === 200 || loginRes.status === 201) {
      try {
        accessToken = JSON.parse(loginRes.body).accessToken;
      } catch {
        // ignore parse error
      }
    }
  });

  if (!accessToken) {
    sleep(1);
    return;
  }

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  sleep(0.5);

  // ─── Dashboard KPIs ──────────────────────────────────────────────────
  group('Dashboard - KPIs', () => {
    const startTime = new Date();
    const res = http.get(`${BASE_URL}/dashboard/kpis`, authHeaders);
    dashboardDuration.add(new Date() - startTime);

    const success = check(res, {
      'dashboard KPIs status 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.3);

  // ─── Stock Movements ─────────────────────────────────────────────────
  group('Stock - List Movements', () => {
    const startTime = new Date();
    const res = http.get(`${BASE_URL}/stock/movements?limit=20&offset=0`, authHeaders);
    stockDuration.add(new Date() - startTime);

    const success = check(res, {
      'stock movements status 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(0.3);

  // ─── Products ────────────────────────────────────────────────────────
  group('Products - List MP', () => {
    const res = http.get(`${BASE_URL}/products/mp`, authHeaders);
    check(res, {
      'products MP status 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  // ─── Health Check ────────────────────────────────────────────────────
  group('Health - Readiness', () => {
    const res = http.get(`${BASE_URL}/health/ready`);
    check(res, {
      'health ready status 200': (r) => r.status === 200,
      'database is up': (r) => {
        try {
          return JSON.parse(r.body).checks?.database?.status === 'up';
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'infra/k6/results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  return `
═══════════════════════════════════════════════════════════════
  MANCHENGO ERP - Load Test Results
═══════════════════════════════════════════════════════════════
  Total Requests:    ${metrics.http_reqs?.values?.count || 0}
  Failed Requests:   ${metrics.http_req_failed?.values?.rate || 0}%
  Avg Duration:      ${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms
  P95 Duration:      ${Math.round(metrics.http_req_duration?.values?.['p(95)'] || 0)}ms
  P99 Duration:      ${Math.round(metrics.http_req_duration?.values?.['p(99)'] || 0)}ms

  Login P95:         ${Math.round(data.metrics.login_duration?.values?.['p(95)'] || 0)}ms
  Dashboard P95:     ${Math.round(data.metrics.dashboard_duration?.values?.['p(95)'] || 0)}ms
  Stock P95:         ${Math.round(data.metrics.stock_duration?.values?.['p(95)'] || 0)}ms
═══════════════════════════════════════════════════════════════
`;
}
