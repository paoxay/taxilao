# TAXILAO.COM AI Project Memory

This file is the operating memory for AI coding agents working in this repository.
Read it before changing code. Keep it updated when architecture, security, commands,
ports, or major product behavior changes.

## Product

TAXILAO.COM is a taxi marketplace and driver directory for Laos.

Main customer workflows:

- Browse verified and premium drivers.
- Filter drivers and open driver profiles.
- Book a taxi or tour as a guest or signed-in member.
- Sign in with Google and view profile, booking status, and trip history.
- Apply to become a driver.

Admin workflows:

- Manage drivers, images, verification, premium status, availability, and pricing.
- Manage tours, uploaded images, price, assigned driver, active status, home banner
  visibility, and banner order.
- Manage bookings, payments, and global pricing.

## Repository Architecture

This is an npm workspace monorepo.

| Path | Runtime | Port | Purpose |
| --- | --- | --- | --- |
| `apps/web` | Next.js 14 | `3000` | Customer frontend |
| `apps/admin` | Next.js 14 | `3001` | Separate Lao admin dashboard |
| `apps/api/app.js` | Express/Node.js | `4000` | Live REST API |
| `apps/driver_app` | Flutter | N/A | Android APK source for TAXILAO drivers |
| `packages/shared` | TypeScript package | N/A | Shared types, sample data, pricing, i18n |
| `packages/database` | Prisma package | N/A | Legacy/prepared relational schema |

Important:

- `apps/api/app.js` is the live API used by `node app.js`.
- `apps/api/src/index.ts` is an older TypeScript scaffold and is not the active runtime.
- Do not implement a production feature only in `apps/api/src/index.ts`.
- MongoDB Atlas is the active database. PostgreSQL/Prisma is not the current source of truth.

## Run Commands

Run each service in a separate visible terminal:

```powershell
cd D:\api\TAXILAO\apps\api
node app.js
```

```powershell
cd D:\api\TAXILAO\apps\web
yarn start
```

```powershell
cd D:\api\TAXILAO\apps\admin
yarn start
```

Driver Flutter app:

```powershell
cd D:\api\TAXILAO\apps\driver_app
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

Build driver APK:

```powershell
cd D:\api\TAXILAO\apps\driver_app
flutter build apk --release --dart-define=API_BASE_URL=http://YOUR_API_HOST:4000
```

Stop a foreground service with `Ctrl + C`.

Stop listeners by port:

```powershell
3000,3001,4000 | ForEach-Object {
  Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}
```

AI agents must not leave Web, Admin, API, ngrok, or helper servers running in the
background unless the user explicitly asks for it. Background servers previously
caused repeated `EADDRINUSE` failures.

## Build And Verification

After changes, run the builds for every affected app:

```powershell
npm.cmd run build --workspace @taxilao/web
npm.cmd run build --workspace @taxilao/admin
npm.cmd run build --workspace @taxilao/api
node --check apps/api/app.js
```

API health check:

```text
GET http://localhost:4000/health
```

If a Next.js build fails with stale generated files such as `/_document` missing,
stop the relevant dev server, delete only that app's `.next` directory, then rebuild.
Never delete source directories.

## Environment

The root `.env` is loaded by `apps/api/app.js`.

Expected variable names:

- `MONGODB_URI`
- `MONGODB_DB`
- `API_PORT`
- `WEB_ORIGIN`
- `ADMIN_ORIGIN`
- `NEXT_PUBLIC_API_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ADMIN_PASSWORD`
- `DRIVER_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `MAPBOX_ACCESS_TOKEN` (optional locally; required for managed production maps)

Security rules:

- Never print, quote, commit, expose, or copy real secret values into documentation.
- Never put `GOOGLE_CLIENT_SECRET`, JWT secrets, MongoDB credentials, or admin
  passwords in frontend code.
- `.env` must remain ignored by Git. Update `.env.example` using placeholders only.
- Redact MongoDB credentials from logs and responses.
- Use long random secrets in deployed environments.

## Database

Active persistence is MongoDB Atlas, database name normally `taxilao`.

Important collections:

- `users`
- `drivers`
- `tours`
- `bookings`
- `payments`
- `reviews`
- `driverLedger`
- `chatMessages`
- `settings`
- `adminLogs`

The API seeds empty collections and performs small non-destructive field migrations
in `seedIfEmpty()`.

Do not drop collections or databases without explicit user approval.
Do not overwrite existing user data during migrations. Prefer `$exists: false`
updates and safe defaults.

## Authentication And Authorization

Member authentication:

- Google OAuth starts at `GET /auth/google`.
- Google callback is `GET /auth/google/callback`.
- Members are stored in MongoDB with role `USER`.
- Frontend callback stores access and refresh tokens in local storage.
- `GET /auth/me` loads the member.
- `POST /auth/refresh` renews member tokens.

Admin authentication:

- `POST /admin/login`
- Admin token local-storage key: `taxilao_admin_token`
- Protected endpoints use `requireAdmin`.
- On HTTP `401`, Admin must clear the expired token and return to the login screen.

Driver authentication:

- `POST /driver/login`
- Protected driver endpoints use `requireDriver`.
- Flutter driver app stores the driver token locally and uses it for job list,
  status updates, and GPS upload.
- Driver app login accepts driver `username`, legacy driver `id`, or exact driver
  display `name`, plus the hashed password configured by Admin. `DRIVER_PASSWORD`
  is only a local fallback for old driver records that do not yet have a password
  hash.

Never allow Google member login to upgrade a user to `ADMIN`, `SUPER_ADMIN`, or
`DRIVER`. Staff roles require separate authorization.

## API Security Baseline

Preserve these controls:

- Helmet security headers.
- Explicit CORS origins from `WEB_ORIGIN` and `ADMIN_ORIGIN`.
- Rate limiting for login, booking, and lookup routes.
- JWT verification on protected endpoints.
- Role checks for admin and driver routes.
- Server-side validation of driver, tour, booking, payment, and pricing values.
- Safe image data URL parsing and upload size limits.
- Admin audit records in `adminLogs`.

Do not trust client-provided `userId`, roles, prices, payment status, or admin flags.
For signed-in bookings, derive the member ID from the verified token.

## Frontend And Design

Visual direction:

- Premium, clean, space-efficient, modern TAXILAO interface.
- Dark neutral base with restrained gold accents.
- Cards use an `8px` radius or less.
- Mobile-first and usable on narrow phones.
- Use Lucide icons where available.
- Do not mix the customer frontend with the admin interface.

Current homepage:

- Compact premium driver list backed by MongoDB.
- Drivers sort with premium and rating priority.
- Tour banner carousel supports automatic and manual navigation.
- Banner content comes from Admin-managed tour data.

Tour Admin fields:

- `title`
- `city`
- `duration`
- `priceLak`
- `description`
- `imageUrl`
- `driverId`
- `featuredOnHome`
- `sortOrder`
- `active`

Uploaded images are data URLs in the Admin form and are saved by the API into
`apps/api/uploads`. Do not replace uploads with URL-only fields.

Driver Admin fields include `username` and a password reset field. Passwords must
be hashed server-side and never returned to Admin/Web/Flutter clients.

## Internationalization

Supported frontend locales:

- `lo` Lao
- `en` English
- `th` Thai
- `zh` Chinese
- `vi` Vietnamese
- `ja` Japanese
- `ko` Korean

Key files:

- `packages/shared/src/index.ts`: locale list and homepage copy.
- `apps/web/app/ui-copy.ts`: shared UI labels.
- `apps/web/app/use-ui-copy.ts`: client locale reader.
- `apps/web/app/components.tsx`: language selector and navigation.

Locale persistence:

- Query parameter: `?lang=<locale>`
- Local storage key: `taxilao_locale`
- Cookie key: `taxilao_locale`

Rules:

- Preserve `lang` when linking between customer pages.
- Selecting a language must stay on the current page and close the menu.
- Do not add new customer-facing hard-coded text without adding translations.
- Database content such as tour titles and driver bios remains in the language entered
  by Admin unless a translated content schema is intentionally added later.
- Admin remains Lao-first and is not mixed into the public language selector.

## Major Customer Routes

- `/`
- `/drivers`
- `/drivers/[id]`
- `/drivers/apply`
- `/tours`
- `/booking`
- `/login`
- `/auth/callback`
- `/dashboard`
- `/profile`
- `/driver`

Driver APK source:

- `apps/driver_app`

## Major API Routes

Public/member:

- `GET /health`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/refresh`
- `GET /drivers`
- `GET /drivers/:id`
- `POST /drivers/apply`
- `GET /tours`
- `POST /bookings`
- `POST /bookings/lookup`
- `GET /bookings/me`
- `GET /bookings/:id/chat`
- `POST /bookings/:id/chat`
- `POST /reviews`
- `GET /maps/search`
- `GET /maps/reverse`
- `POST /maps/route`
- `POST /maps/search/select`

Admin:

- `POST /admin/login`
- `GET /admin/dashboard`
- `GET|POST /admin/drivers`
- `PATCH|DELETE /admin/drivers/:id`
- `GET|POST /admin/drivers/:id/wallet`
- `GET|PATCH /admin/pricing`
- `GET /admin/bookings`
- `PATCH /admin/bookings/:id`
- `GET /admin/payments`
- `PATCH /admin/payments/:id`
- `GET|POST /admin/tours`
- `PATCH|DELETE /admin/tours/:id`
- `GET|POST /admin/places`
- `PATCH|DELETE /admin/places/:id`
- `GET /admin/places/search-insights`

Driver:

- `POST /driver/login`
- `GET /driver/me`
- `PATCH /driver/availability`
- `PATCH /driver/location`
- `GET /driver/bookings`
- `PATCH /driver/bookings/:id/status`
- `PATCH /driver/bookings/:id/location`

Driver APK behavior:

- Login with driver `username` and per-driver password configured in Admin.
- Main navigation is a bottom tab bar with `Jobs`, `History`, and `Profile`.
- `Jobs` shows online/auto/GPS controls, scanner state, and compact current/offered
  order rows with only pickup, dropoff, fare, distance, status, and primary actions.
- Order details open in a bottom sheet with a route preview, pickup/dropoff details,
  and a Google Maps directions launcher.
- `History` shows compact completed/cancelled orders and opens the same detail sheet.
- `Profile` shows driver photo, name, id, live wallet balance from `/driver/me`,
  vehicle info, online/auto/GPS state, and logout.
- Online/offline switch controls whether GPS and auto-accept run.
- When online, the Flutter app sends idle GPS to `/driver/location` so backend
  dispatch can find the nearest driver before a job is accepted.
- Auto-accept/auto mode means the driver is eligible for automatic dispatch; the
  app must still show an offer and let the driver tap accept.
- New customer `RIDE` bookings try server-side auto-dispatch to a verified,
  online, auto-mode driver with a fresh `currentLocation` and enough wallet balance.
  The booking becomes `OFFERED` for that driver for 30 seconds, then expires and is
  offered to the next nearest eligible driver.
- Active job GPS is sent to `/driver/bookings/:id/location`.
- Driver status flow is `CONFIRMED` -> `ON_THE_WAY` -> `IN_PROGRESS` -> `COMPLETED`.
- Driver APK plays a distinct in-app sound for new pending/offered jobs and another
  sound when a job is accepted.
- Driver APK has three distinct sounds: new order, manually accepted order, and
  auto-accepted order.
- Driver APK also raises local Android notifications for new and accepted jobs.
- Driver APK must keep online/auto-accept disabled unless location permission is
  granted as "Allow all the time"; this is required for background GPS and dispatch.
- Driver job details show a live map preview with driver, pickup, and dropoff pins,
  plus the driver's distance to pickup when current GPS is available. The
  driver-to-pickup line must use the real `/maps/route` road geometry rather than
  a straight-line polyline.
- When a driver has an active job, the APK only shows that active job and suppresses
  other pending/offered jobs until the active job is completed or cancelled.
- Driver history is newest-first, and the profile shows local gross completed-order
  totals for today, this week, and this month.
- Driver API routes use rate limits for reads, status/availability writes, and GPS
  updates to reduce abuse while leaving normal realtime polling/GPS usable.
- Drivers can cancel an accepted active job from the app before it is completed.
- Driver wallet is stored on `drivers.walletBalanceLak`; every manual admin adjustment
  and order commission debit is recorded in `driverLedger`. Admin can credit/debit a
  driver wallet with a required audit note. `settings/pricing` stores
  `driverCommissionPercent`, `driverMinimumBalanceLak`, and
  `driverLowBalanceWarningLak`.
- Drivers cannot accept an order if wallet balance is below the greater of the minimum
  balance setting or that order's estimated commission. On `COMPLETED`, the API debits
  the commission once and prevents negative wallet balances with an atomic MongoDB
  update.

## Editing Rules For AI

- Inspect existing code before editing.
- Keep changes scoped to the requested feature.
- Preserve user data and unrelated edits.
- Prefer existing project patterns and shared helpers.
- Use structured MongoDB operations, not string-built queries.
- Do not change ports unless explicitly requested.
- Do not silently start background processes.
- Do not commit generated `.next`, logs, uploads, `.env`, or secrets.
- Use UTF-8 for Lao and other supported languages.
- When changing API response fields, update Web/Admin types and consumers together.
- When adding Admin-configurable frontend content, implement the field end to end:
  Admin form, API validation/persistence, MongoDB default/migration, and frontend use.

## Known Operational Issues

- `EADDRINUSE` means another process already listens on the requested port.
- A server may remain orphaned after its terminal closes. Find it with
  `Get-NetTCPConnection` and stop only the owning process.
- MongoDB Atlas requires the current public IP in Network Access.
- Google OAuth local redirect must exactly match:
  `http://localhost:4000/auth/google/callback`
- Sharing only port `3000` through ngrok is enough for visual review, but live booking
  and Google OAuth require a publicly reachable API and updated origins/callback URLs.
- Ride locations are stored as MongoDB GeoJSON points. Route distance, ETA, and fare
  are recalculated by the API before a booking is stored.
- Fare mode is determined by booking type, not freely chosen: a regular taxi request
  without a selected driver is `FIXED`; booking a specific driver is `METER`; tour
  packages remain fixed-price. Meter bookings require explicit customer consent and
  store a pricing snapshot. Default meter formula is LAK 50,000 including 2 km, then
  LAK 15,000 per excess km plus LAK 1,000 per actual minute.
- Taxi requests use `/booking`; specific-driver reservations use `/booking/driver`.
  Driver reservations require pickup but allow an empty destination, because the
  customer may agree on route B with the driver after booking.
- Creating any booking requires an authenticated `USER` member. Web booking forms are
  wrapped in `MemberAuthGate`; Google OAuth signs and preserves a safe relative
  `returnTo` path so users return to the exact taxi/driver/tour booking URL.
- After a taxi request is created, the live tracker is the primary customer surface.
  It hides the close action until the booking is completed or cancelled, warns on
  browser unload while active, and allows customer cancellation only while the booking
  is `PENDING` or `OFFERED`.
- Customer cancellation is blocked after a driver accepts the booking. Accepted trips
  use in-trip chat between the authenticated customer and the assigned driver.
- Booking chat is stored in `chatMessages`. Chat endpoints allow only the booking
  owner or assigned driver, rate-limit reads/writes, and accept text plus guarded
  image/audio data URL attachments for later media UI.
- A meter price shown before booking is an estimate. `finalPriceLak` remains unset until
  a later trip-completion/meter-settlement workflow records the actual fare.
- Customer pickup and destination points can be selected precisely in a lazy-loaded
  MapLibre GL picker with touch pan, zoom, rotation, and reverse geocoding.
- MapLibre uses the OpenFreeMap Liberty vector style in Web and Admin so labels/icons
  remain upright while the map bearing rotates. Esri World Imagery is the default
  satellite view; users can switch back to the vector street view.
- Place autocomplete is hybrid: verified MongoDB `places` results rank before the
  external geocoder, while search/select events feed 90-day `placeSearchLogs`.
- Admin has a separate Lao-first place manager for aliases, categories, popularity,
  and precise map pins. Curated place documents use GeoJSON `location`.
- `MAPBOX_ACCESS_TOKEN` enables Mapbox Geocoding and Directions. Without it, local
  development falls back to public Nominatim and OSRM services; use Mapbox or another
  managed provider before production traffic. Public OpenStreetMap raster tiles are
  also for low-volume development; configure a managed/self-hosted tile source for production.

## Definition Of Done

A feature is complete only when:

1. The requested UI and behavior are implemented.
2. MongoDB/API/Admin/Web contracts agree.
3. Mobile layout is usable.
4. All affected builds pass.
5. Secrets are not exposed.
6. No unnecessary background server is left running.
7. This file is updated if architecture or operating rules changed.
