# Manchengo Smart ERP - Admin Web

Central administration dashboard for Manchengo Smart ERP.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs on `http://localhost:3001` and proxies API requests to the backend at `http://localhost:3000`.

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Authentication page |
| `/dashboard` | Main KPIs overview |
| `/dashboard/stock` | Stock MP & PF management |
| `/dashboard/invoices` | Invoices list |
| `/dashboard/production` | Production orders |
| `/dashboard/clients` | Clients management |
| `/dashboard/devices` | Device management |
| `/dashboard/sync` | Sync status & events |

## Architecture

```
src/
├── app/
│   ├── globals.css          # Tailwind + custom styles
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Redirect to login
│   ├── login/
│   │   ├── layout.tsx       # Auth provider
│   │   └── page.tsx         # Login form
│   └── (dashboard)/
│       ├── layout.tsx       # Protected layout with sidebar
│       └── dashboard/
│           ├── page.tsx     # Main dashboard
│           ├── stock/       # Stock page
│           ├── invoices/    # Invoices page
│           └── sync/        # Sync status page
└── lib/
    ├── api.ts               # API client
    ├── auth-context.tsx     # Auth context provider
    └── utils.ts             # Utility functions
```

## Authentication Flow

1. User submits login form
2. API returns access token + refresh token
3. Tokens stored in localStorage
4. Protected routes check auth via context
5. API client attaches Bearer token to requests
6. On 401, redirect to login

## Development

```bash
# Start backend first
cd ../backend && npm run start:dev

# Then start frontend
cd ../web && npm run dev
```
