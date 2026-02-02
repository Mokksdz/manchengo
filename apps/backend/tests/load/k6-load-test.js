import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * K6 LOAD TESTS — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R20: Tests de charge K6
 *
 * Run: k6 run apps/backend/tests/load/k6-load-test.js
 *
 * Scenarios:
 * 1. Smoke test: 1 user, 30s — verify basic functionality
 * 2. Load test: 20 users, 5min — normal load
 * 3. Stress test: 50 users, 5min — peak load
 * 4. Spike test: 100 users, 1min — sudden spike
 *
 * Target thresholds:
 * - p(95) response time < 500ms for dashboards
 * - Error rate < 1%
 * - Health checks < 100ms
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

// Custom metrics
const dashboardLatency = new Trend('dashboard_latency');
const loginLatency = new Trend('login_latency');
const errorRate = new Rate('error_rate');

// ── Configuration ──
export const options = {
  scenarios: {
    // Smoke test
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    // Load test
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // Ramp up
        { duration: '3m', target: 20 },   // Hold
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '35s',
      tags: { scenario: 'load' },
    },
    // Stress test
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up
        { duration: '3m', target: 50 },   // Hold
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '6m',
      tags: { scenario: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],      // 95th percentile < 500ms
    http_req_failed: ['rate<0.01'],        // Error rate < 1%
    dashboard_latency: ['p(95)<800'],      // Dashboard p95 < 800ms
    login_latency: ['p(95)<300'],          // Login p95 < 300ms
    error_rate: ['rate<0.02'],             // Custom error rate < 2%
  },
};

// ── Test helpers ──
function login(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
  loginLatency.add(res.timings.duration);

  if (res.status !== 200) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);

  // Extract cookies for auth
  return res.cookies;
}

function authenticatedGet(url, cookies) {
  const jar = http.cookieJar();
  if (cookies) {
    for (const [name, values] of Object.entries(cookies)) {
      if (values && values.length > 0) {
        jar.set(BASE_URL, name, values[0].value);
      }
    }
  }
  return http.get(url, { jar });
}

// ── Main test scenarios ──
export default function () {
  // 1. Health check (no auth required)
  {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check returns 200': (r) => r.status === 200,
      'health check < 100ms': (r) => r.timings.duration < 100,
    });
  }

  sleep(0.5);

  // 2. Login as admin
  const cookies = login('admin@manchengo.dz', 'Admin123!');
  if (!cookies) {
    console.error('Login failed, skipping authenticated tests');
    return;
  }

  sleep(0.5);

  // 3. Dashboard KPIs
  {
    const res = authenticatedGet(`${BASE_URL}/dashboard/kpis`, cookies);
    dashboardLatency.add(res.timings.duration);
    const ok = check(res, {
      'dashboard KPIs returns 200': (r) => r.status === 200,
      'dashboard KPIs < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!ok ? 1 : 0);
  }

  sleep(0.5);

  // 4. Stock Dashboard
  {
    const res = authenticatedGet(`${BASE_URL}/stock/dashboard`, cookies);
    dashboardLatency.add(res.timings.duration);
    const ok = check(res, {
      'stock dashboard returns 200': (r) => r.status === 200,
      'stock dashboard < 800ms': (r) => r.timings.duration < 800,
    });
    errorRate.add(!ok ? 1 : 0);
  }

  sleep(0.5);

  // 5. Stock Critical Count (badge)
  {
    const res = authenticatedGet(`${BASE_URL}/stock/dashboard/count`, cookies);
    const ok = check(res, {
      'critical count returns 200': (r) => r.status === 200,
      'critical count < 200ms': (r) => r.timings.duration < 200,
    });
    errorRate.add(!ok ? 1 : 0);
  }

  sleep(0.5);

  // 6. Sales Chart
  {
    const res = authenticatedGet(`${BASE_URL}/dashboard/charts/sales?days=7`, cookies);
    dashboardLatency.add(res.timings.duration);
    const ok = check(res, {
      'sales chart returns 200': (r) => r.status === 200,
    });
    errorRate.add(!ok ? 1 : 0);
  }

  sleep(0.5);

  // 7. Production Dashboard
  {
    const res = authenticatedGet(`${BASE_URL}/dashboard/production`, cookies);
    dashboardLatency.add(res.timings.duration);
    const ok = check(res, {
      'production dashboard returns 200': (r) => r.status === 200,
    });
    errorRate.add(!ok ? 1 : 0);
  }

  sleep(1);
}

// ── Summary handler ──
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

// Simple text summary (k6 built-in)
function textSummary(data, opts) {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  MANCHENGO SMART ERP — Load Test Results',
    '═══════════════════════════════════════════════════════════════',
    '',
  ];

  if (data.metrics) {
    for (const [name, metric] of Object.entries(data.metrics)) {
      if (metric.values && typeof metric.values === 'object') {
        const vals = Object.entries(metric.values)
          .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`)
          .join(', ');
        lines.push(`  ${name}: ${vals}`);
      }
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  return lines.join('\n');
}
