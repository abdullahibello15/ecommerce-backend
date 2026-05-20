# Payment Platform — Backend API

Node.js + TypeScript + Express + Prisma + PostgreSQL

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Then edit .env with your actual values
```

### 3. Set up PostgreSQL database
Make sure PostgreSQL is running, then create your database:
```bash
createdb payment_db
# Or via psql: CREATE DATABASE payment_db;
```

Update `DATABASE_URL` in your `.env`:
```
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/payment_db"
```

### 4. Run migrations and seed
```bash
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations (creates all tables)
npm run db:seed       # Seed with test data
```

### 5. Start development server
```bash
npm run dev
```

Server runs at: **http://localhost:5000**

---

## External Deployment

Use these commands on hosts like Render, Railway, Fly, or Heroku:

```bash
# Build command
npm install && npm run build

# Start command, if the database is already migrated
npm start

# Start command, if the host should run migrations before booting
npm run start:migrate
```

Required production environment variables:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
NODE_ENV=production
FRONTEND_URL=https://your-frontend.example.com
```

`FRONTEND_URL` may contain multiple comma-separated origins.

---

## API Endpoints

All authenticated routes require:
```
Authorization: Bearer <accessToken>
```

### Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login |
| POST | `/api/auth/refresh` | ❌ | Refresh access token |
| POST | `/api/auth/logout` | ❌ | Logout |
| GET | `/api/auth/me` | ✅ | Get current user |

### Analytics
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/analytics/revenue?startDate=&endDate=` | Daily revenue chart data |
| GET | `/api/analytics/gateways?startDate=&endDate=` | Gateway breakdown percentages |
| GET | `/api/analytics/kpis?startDate=&endDate=` | KPI cards with % change vs previous period |

### Transactions
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/transactions` | List with filters: `?status=&gateway=&startDate=&endDate=&search=&page=&limit=` |
| GET | `/api/transactions/export` | Download CSV: `?format=csv` (default) or `?format=json` |
| GET | `/api/transactions/:reference` | Single transaction detail |

### Gateways
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/gateways` | List all gateways |
| GET | `/api/gateways/:id` | Get gateway details |
| PUT | `/api/gateways/:id` | Update gateway (toggle, set keys) |
| GET | `/api/gateways/:id/logs` | View gateway event logs |

### Webhooks
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/webhooks/endpoints` | List all webhook endpoints |
| POST | `/api/webhooks/endpoints` | Create endpoint `{ url, events[], description }` |
| PUT | `/api/webhooks/endpoints/:id` | Update endpoint |
| DELETE | `/api/webhooks/endpoints/:id` | Delete endpoint |
| GET | `/api/webhooks/endpoints/:id/deliveries` | View delivery history |

### Payments
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/payments/initialize` | Init payment `{ amount, email, currency?, gateway? }` |
| GET | `/api/payments/verify/:reference` | Verify payment status |

### Notifications
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/notifications` | Get all notifications + unread count |
| PUT | `/api/notifications/read-all` | Mark all as read |
| PUT | `/api/notifications/:id/read` | Mark one as read |

### Search
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/search?q=` | Global search across transactions, gateways |

### Team
| Method | Route | Role Required | Description |
|--------|-------|--------------|-------------|
| GET | `/api/team` | Any | List team members |
| POST | `/api/team/invite` | OWNER/ADMIN | Invite by email `{ email, role }` |
| PUT | `/api/team/:id/role` | OWNER/ADMIN | Change member role |
| DELETE | `/api/team/:id` | OWNER/ADMIN | Remove member |

### Billing
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/billing/plans` | List all plans |
| GET | `/api/billing/plan` | Get current active subscription |
| POST | `/api/billing/upgrade` | Upgrade `{ planId }` |

### User
| Method | Route | Description |
|--------|-------|-------------|
| PUT | `/api/user/profile` | Update name/phone |
| PUT | `/api/user/password` | Change password `{ currentPassword, newPassword }` |
| PUT | `/api/user/avatar` | Update avatar `{ avatarUrl }` |

### Contact
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/contact` | ❌ | Submit contact form `{ name, email, subject, message }` |

---

## Default Seed Credentials
```
Email:    admin@payplatform.com
Password: Password123!
```

---

## Project Structure
```
src/
├── index.ts          # Entry point
├── app.ts            # Express app + middleware
├── config/
│   └── prisma.ts     # Prisma client singleton
├── controllers/      # Route handler logic
├── middleware/
│   ├── auth.ts       # JWT authentication
│   ├── errorHandler.ts
│   └── notFound.ts
├── routes/           # Express routers
├── types/            # TypeScript types
└── utils/
    ├── email.ts      # Nodemailer helpers
    ├── jwt.ts        # Token generation/verification
    └── response.ts   # Standard API response helpers

prisma/
├── schema.prisma     # Full data model
└── seed.ts           # Test data seeder
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Access token signing key |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token signing key |
| `PORT` | ❌ | Server port (default: 5000) |
| `FRONTEND_URL` | ❌ | CORS allowed origin |
| `SMTP_HOST/USER/PASS` | ❌ | Email — needed for invites and contact |
| `PAYSTACK_SECRET_KEY` | ❌ | Enables real Paystack payment init |

---

## Currency Note
All amounts are stored and returned in `NGN` by default with a `currency` field.
The frontend should use `currency` from the response for formatting — never hardcode `₦` or `$`.
