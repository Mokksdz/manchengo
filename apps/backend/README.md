# Manchengo Smart ERP - Backend

Central backend for Manchengo Smart ERP. Handles sync with mobile devices, authentication, and admin APIs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MANCHENGO BACKEND                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Sync API   │  │  Auth API   │  │  Admin API  │              │
│  │ POST/GET    │  │ JWT+RBAC    │  │ Read-Only   │              │
│  │ /sync/events│  │ /auth/*     │  │ /admin/*    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│                    ┌─────┴─────┐                                 │
│                    │  Prisma   │                                 │
│                    │    ORM    │                                 │
│                    └─────┬─────┘                                 │
│                          │                                       │
│                    ┌─────┴─────┐                                 │
│                    │PostgreSQL │                                 │
│                    │ (Central) │                                 │
│                    └───────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Framework**: NestJS 10+
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: JWT + Refresh tokens
- **Docs**: Swagger

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed initial data
npx prisma db seed

# Start development server
npm run start:dev
```

## API Endpoints

### Sync API (Mobile ↔ Server)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/events` | Push events from mobile |
| GET | `/api/sync/events?since=&device_id=` | Pull events for mobile |

### Auth API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (web/mobile) |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/users` | Create user (admin) |

### Admin API (Read-Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stock/mp` | MP stock overview |
| GET | `/api/admin/stock/pf` | PF stock overview |
| GET | `/api/admin/invoices` | Invoices list |
| GET | `/api/admin/production` | Production orders |
| GET | `/api/admin/clients` | Clients list |
| GET | `/api/admin/suppliers` | Suppliers list |
| GET | `/api/admin/users` | Users list |
| GET | `/api/admin/devices` | Devices list |

### Dashboard API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/kpis` | Main KPIs |
| GET | `/api/dashboard/charts/sales` | Sales chart data |
| GET | `/api/dashboard/charts/production` | Production chart data |
| GET | `/api/dashboard/sync/status` | Sync status by device |

## Sync Protocol

### Push (Mobile → Server)

```json
POST /api/sync/events
{
  "device_id": "uuid",
  "events": [
    {
      "id": "uuid",
      "entity_type": "LOT_MP",
      "entity_id": "123",
      "action": "MP_RECEIVED",
      "payload": {...},
      "occurred_at": "ISO8601",
      "user_id": 1
    }
  ]
}

Response:
{
  "acked_event_ids": ["uuid1", "uuid2"],
  "failed_event_ids": ["uuid3"]
}
```

### Pull (Server → Mobile)

```json
GET /api/sync/events?since=2024-01-01T00:00:00Z&device_id=uuid

Response:
{
  "events": [...],
  "server_time": "ISO8601"
}
```

## Conflict Resolution

| Entity Type | Strategy |
|-------------|----------|
| Stock/Lots | **Server Wins** |
| Invoices | **LWW** (Last-Write-Wins) |
| Clients | **LWW** |

## Roles

| Role | Permissions |
|------|-------------|
| ADMIN | Full access |
| APPRO | Stock MP, Suppliers |
| PRODUCTION | Production, Stock PF |
| COMMERCIAL | Invoices, Clients |

## Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
CORS_ORIGIN=http://localhost:3001
```
