# TAXILAO.COM

Premium taxi marketplace and driver directory MVP for Laos. The project is a monorepo with a Next.js frontend, separate admin dashboard, Express API, local MongoDB data storage, seed data, Google OAuth configuration hooks, JWT-ready auth helpers, booking price logic, and payment schema preparation for cash, QR bank, card, and USDT.

## Apps

- `apps/web`: Next.js customer site.
- `apps/admin`: Separate Lao admin dashboard.
- `apps/api`: Express REST API backed by local MongoDB.
- `packages/database`: Prisma schema and seed data.
- `packages/shared`: Shared sample data, pricing, and TypeScript types.

## Quick Start

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev:web
```

In another terminal:

```bash
npm run dev:api
```

Frontend: `http://localhost:3000`

Admin dashboard: `http://localhost:3001`

API: `http://localhost:4000`

Ports:

- Frontend: `3000`
- Admin dashboard: `3001`
- Backend API: `4000`

## Run Apps Separately

Frontend:

```bash
cd apps/web
yarn start
```

Admin dashboard:

```bash
cd apps/admin
yarn start
```

Backend API:

```bash
cd apps/api
node app.js
```

## MVP Workflow

1. Run API with `node app.js`.
2. Run frontend from `apps/web` with `yarn start`.
3. Run admin from `apps/admin` with `yarn start`.
4. Submit a booking on the frontend booking form.
5. Submit a driver application on `/drivers/apply`.
6. Open the admin app at `http://localhost:3001`, click refresh, then approve drivers or set premium status.

## Admin Login

The admin dashboard requires a password before loading data. Set it in `.env`:

```env
ADMIN_PASSWORD="change-this-admin-password"
```

Then open:

```text
http://localhost:3001
```

Do not commit or share the real `.env` password.

For the MVP, `apps/api/app.js` stores live booking, payment, driver, tour, review, and admin-log data in local MongoDB. The API seeds sample drivers and tours automatically the first time it connects to an empty database.

## Database Setup

Local MongoDB with Docker:

```bash
docker compose up -d
```

If Docker Desktop is not running, `docker compose up -d` will fail. Open Docker Desktop first, then run the command again.

Local MongoDB without Docker:

Install MongoDB Community Server and make sure it is running at:

```text
mongodb://127.0.0.1:27017
```

The API uses:

```text
MONGODB_URI=mongodb://127.0.0.1:27017/taxilao
MONGODB_DB=taxilao
```

Reset local data:

```bash
mongosh taxilao --eval "db.dropDatabase()"
```

## Google OAuth

Create a Google OAuth 2.0 client and set:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback`

The API exposes:

- `GET /auth/google`
- `GET /auth/google/callback`

For production, set a secure callback URL, enforce HTTPS at the proxy/load balancer, and rotate JWT secrets.

## Core API

- `GET /drivers`
- `GET /drivers/:id`
- `POST /drivers/apply`
- `PATCH /drivers/:id`
- `GET /tours`
- `POST /bookings`
- `GET /bookings/me`
- `PATCH /bookings/:id/status`
- `POST /reviews`
- `GET /admin/dashboard`
- `GET /admin/drivers`
- `PATCH /admin/drivers/:id/verify`
- `PATCH /admin/drivers/:id/premium`
- `GET /admin/bookings`
- `GET /admin/payments`

## Booking Pricing

Urban booking estimate:

```ts
price = Math.max(distanceKm * 15000, 50000)
```

Prices are displayed in LAK. The model includes currency fields so USD conversion can be added later.

## Security Notes

The API is scaffolded with Helmet, CORS config, login/booking rate limits, JWT helpers, MongoDB persistence, and admin logging collections. Add production secrets in `.env`, use HTTPS, and connect the auth middleware to real user records before launch.
