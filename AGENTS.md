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
- Manage member accounts, customer ratings, trip totals, and account status.
- Admin Finance center manages driver wallets, ledger history, manual credits/debits, commission settings, and low-balance monitoring.
- Manage vehicle categories, visibility, capacity, per-km rate, minimum fare, and default vehicle choice.

## System Boundaries

TAXILAO has three separate product systems. Keep their UI, auth, APIs, and data
contracts separate unless the task explicitly requires integration.

1. Customer/member Web (`apps/web`)
   - Public TAXILAO website for members and guests to browse drivers/tours, sign in
     with Google, create taxi requests, track ride status, chat after driver acceptance,
     review trips, and view member history/profile.
   - Member role is `USER`. Do not add admin or driver controls to customer pages.

2. Driver APK (`apps/driver_app`)
   - Flutter Android app for drivers only: username/password login, online/auto/GPS
     state, offered jobs, active jobs, route preview, chat/call after accepted job,
     history, profile, wallet balance, and background location/notifications.
   - Driver role is `DRIVER`. Do not allow Google member login or admin tokens here.

3. Admin dashboard (`apps/admin`)
   - Lao-first back office for staff only: manage members, drivers, wallets, bookings,
     order history, payments, tours, places, vehicle categories, pricing, and audits.
   - Admin routes require `requireAdmin`. Admin-only destructive actions such as
     deleting users or bookings must require an explicit UI confirmation and be logged.

Guardrail: when changing one system, inspect the shared API contract and update only
the affected consumers. Never mix member, driver, and admin authentication or expose
secrets/admin functions in Web or Driver UI.

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

## Production Deploy

Preferred VPS deploy command after code is pushed to GitHub:

```bash
cd /var/www/taxilao
bash scripts/deploy-production.sh
```

Production deployment has been verified working on the VPS with `bash scripts/deploy-production.sh`. Treat this as the preferred one-command deploy path after local changes are committed and pushed to GitHub.

The script pulls `origin/main`, runs `npm install`, verifies `apps/api/app.js`,
builds API/Web/Admin, restarts `taxilao-api`, `taxilao-web`, and `taxilao-admin`
with PM2, saves PM2, then smoke-tests `https://api.taxilao.com/health`,
`https://taxilao.com`, `https://admin.taxilao.com`, and vehicle categories.

If production behaves like an old version while localhost works, suspect one of:

- GitHub does not contain the latest local commit.
- VPS `git pull` did not fast-forward because the server working tree is dirty.
- PM2 is running an old process, wrong cwd, or was not restarted with `--update-env`.
- Next.js `.next` was not rebuilt after changing frontend code or environment.
- Cloudflare/browser cache is still serving old static chunks.
- Nginx points the domain to a different port/process than expected.

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
- `LCT_SMS_URL` (Lao Telecom SMS gateway endpoint for phone OTP)
- `LTC_SMS_HEADER` (SMS sender/header name, e.g. `TAXILAO`)
- `LCT_SMS_KEY` (Lao Telecom SMS API key; secret. When unset, phone OTP runs in DEV mode)

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
- `vehicleCategories`
- `adminLogs`

The API seeds empty collections and performs small non-destructive field migrations
in `seedIfEmpty()`.

Seeded demo data can include `Guest Traveler` / `guest@taxilao.local` / id `guest`. This is sample/demo data, not a real Google customer account. Do not treat it as a live user; it may be hidden or removed from Admin displays later if requested.

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
- Phone OTP signup/sign-in: `POST /auth/phone/request-otp` then
  `POST /auth/phone/verify`. OTP is 6 digits, HMAC-hashed, in-memory store with
  5-min TTL, 60s resend, max 5 attempts, rate-limited. On verify: an **existing**
  member (matched by `phone`) is signed in; a **new** number gets a short-lived
  `registrationToken` (10m, purpose `register`) — no account is created until the
  profile step. New members complete via `POST /auth/phone/register`
  (`firstName`, `lastName`, `email`, `password`), which creates the `USER`
  (provider `phone`) with a **scrypt password hash** (`passwordSalt`/`passwordHash`,
  same helpers as drivers) and issues tokens. Returning members can also sign in
  with `POST /auth/phone/login-password`. SMS is sent via the Lao Telecom (LTC)
  gateway (`apicenter.laotel.com/.../submit_sms`) configured by `LCT_SMS_URL`,
  `LTC_SMS_HEADER`, `LCT_SMS_KEY`. Phone numbers are stored/used in **local**
  Lao form (e.g. `2098888841`); the API normalizes `+856…`, `020…`, `856020…`
  down to that form and only prepends `856` when calling the SMS gateway. When
  the LTC env vars are unset, the API runs in **DEV mode**: OTP is logged to the
  console and returned as `devOtp` so it can be tested without sending real SMS.
  `/login` offers phone OTP first, phone+password second, and Google third. The
  `/login` UI intentionally shows **no SMS provider branding** on the public
  signup form (do not re-add "LAOTELECOM"/provider names there); the Google
  button is the standard white pill with the official multicolor Google "G"
  logo (`login/page.tsx`), styled to override the dark `.btn` glass.

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
- 2026 dark-neutral base with restrained gold accents and glass surfaces.
- Design tokens live in `apps/web/app/styles.css` `:root` (2026 layer appended
  after the legacy rules). Radii: `--radius-xs` 8px, `--radius` 14px,
  `--radius-lg` 20px (cards), `--radius-xl` 28px. The old "8px only" rule no
  longer applies; buttons ~14px, cards ~20px glass, badges pill.
- Customer Web is a mobile-app-style shell: every page is wrapped by the root
  `layout.tsx` in `.app-shell > .app-content` with a global floating bottom tab
  bar (`BottomNav`) + profile avatar in the top header.
- Mobile-first and usable on narrow phones. Respect `prefers-reduced-motion`.
- Use Lucide icons where available.
- Do not mix the customer frontend with the admin interface.

Current homepage:

- Compact premium driver list backed by MongoDB.
- Drivers sort with premium and rating priority.
- Tour banner carousel supports automatic and manual navigation.
- Banner content comes from Admin-managed tour data.

Customer Web navigation (global mobile-app shell):

- The root `layout.tsx` renders `.app-shell > .app-content` plus a global
  `BottomNav` on every customer page; do not add a second top-level nav per page
  (pages keep the slim top `Nav` bar with brand + language + profile + book CTA).
- Bottom tab bar has 4 icon tabs with short labels: Home `/`, Drivers `/drivers`,
  Tours `/tours`, and Book `/booking` (gold filled CTA pill). Active tab shows a
  gold underline pill. `BottomNav` preserves `?lang=` and derives active state
  from `usePathname()`.
- Profile/account lives in the top header (`MemberProfileMenu` avatar with a gold
  ring), not in the bottom bar.

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
- `apps/web/app/components.tsx`: language selector, top `Nav`, driver/tour cards,
  and the global `BottomNav` mobile-app tab bar.

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
- Admin dashboard UI is organized as separate compact sections: dashboard, members, drivers, vehicle categories, places, tours, bookings, and payments.

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
- `POST /auth/phone/request-otp`
- `POST /auth/phone/verify`
- `POST /auth/phone/register`
- `POST /auth/phone/login-password`
- `GET /drivers`
- `GET /drivers/:id`
- `POST /drivers/apply`
- `GET /tours`
- `GET /vehicle-categories`
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
- `GET /admin/users`
- `PATCH /admin/users/:id/status`
- `DELETE /admin/users/:id`
- `GET|POST /admin/drivers`
- `PATCH|DELETE /admin/drivers/:id`
- `DELETE /admin/drivers/:id/hard-delete`
- `GET|POST /admin/drivers/:id/wallet`
- `GET|PATCH /admin/pricing`
- `GET|POST /admin/vehicle-categories`
- `PATCH|DELETE /admin/vehicle-categories/:id`
- `GET /admin/bookings`
- `PATCH /admin/bookings/:id`
- `PATCH /admin/bookings/:id/status`
- `DELETE /admin/bookings`
- `DELETE /admin/bookings/:id`
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
- When a driver marks an order `COMPLETED`, the driver app prompts once to rate the customer using `POST /driver/bookings/:id/review`. This updates `users.customerRating` and `users.customerReviewCount` through the API review aggregation.
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
- Finance center wallet adjustments accept comma-formatted amounts such as `50,000`, auto-load the selected driver ledger, and support admin credit/debit even for inactive drivers while still preventing negative balances.
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
- MongoDB update operators must not target the same field in one update document. For example, do not put `updatedAt` in both `$setOnInsert` and `$set`; this caused API startup failure during `vehicleCategories` seeding.
- Do not change ports unless explicitly requested.
- Do not silently start background processes.
- Do not commit generated `.next`, logs, uploads, `.env`, or secrets.
- Use UTF-8 for Lao and other supported languages.
- When changing API response fields, update Web/Admin types and consumers together.
- When adding Admin-configurable frontend content, implement the field end to end:
  Admin form, API validation/persistence, MongoDB default/migration, and frontend use.

## Known Operational Issues

- `EADDRINUSE` means another process already listens on the requested port.
- If Admin shows `Cannot DELETE /admin/users/:id`, the running API process is old or missing the delete route. Pull/build/restart `taxilao-api`; the correct API returns JSON such as `Member not found`, `Member has active bookings`, or `{ ok: true }`, not Express plain text `Cannot DELETE ...`.
- A server may remain orphaned after its terminal closes. Find it with
  `Get-NetTCPConnection` and stop only the owning process.
- MongoDB Atlas requires the current public IP in Network Access.
- Google OAuth local redirect must exactly match:
  `http://localhost:4000/auth/google/callback`
- Sharing only port `3000` through ngrok is enough for visual review, but live booking
  and Google OAuth require a publicly reachable API and updated origins/callback URLs.
- Ride locations are stored as MongoDB GeoJSON points. Route distance, ETA, and fare
  are recalculated by the API before a booking is stored.
- Vehicle categories are stored in MongoDB collection `vehicleCategories`. Admin can create, edit, disable, hide/show on Web, set default, capacity, `ratePerKmLak`, and `minimumFareLak`. Public Web only reads active and visible categories from `GET /vehicle-categories`.
- Regular taxi requests (`RIDE`) without a selected driver store `vehicleCategoryId`, `vehicleCategoryName`, and `vehicleCategorySnapshot`. Route estimates and booking prices must be calculated server-side from the active vehicle category; never trust a client-sent price. If no category is sent, the API falls back to the default active category (currently SUV) for backward compatibility.
- Route estimates must pass `vehicleCategoryId` through `/maps/route` into `calculateRoute(pickupCoordinates, dropoffCoordinates, driverId, vehicleCategoryId)` so map picker movement recalculates the correct category price. Do not reference `vehicleCategoryId` inside route calculation unless it is an explicit parameter.
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
- Admin driver delete has two meanings: `DELETE /admin/drivers/:id` is a soft disable/block action that keeps history; `DELETE /admin/drivers/:id/hard-delete` permanently removes the driver record and is blocked if that driver has `PENDING`, `OFFERED`, `CONFIRMED`, `ON_THE_WAY`, or `IN_PROGRESS` orders. Keep historical bookings/ledger intact unless the user explicitly requests a deeper data purge.
- Admin booking management separates active bookings from order history. Active
  bookings are `PENDING`, `OFFERED`, `CONFIRMED`, `ON_THE_WAY`, and `IN_PROGRESS`.
  Order history is `COMPLETED` and `CANCELLED`. Admin can cancel/update orders and
  can hard-delete booking records when explicitly confirmed; deleting a booking cascades
  related `payments`, `chatMessages`, and `reviews` for that booking and emits a
  booking update.
- Admin can delete `USER` member accounts. Deletion is blocked while the member has
  active bookings unless a future force-delete workflow is intentionally used.
- When a live ride reaches `COMPLETED`, the customer tracker prompts once to rate the assigned driver using `POST /bookings/:id/review`. This updates `drivers.rating` and `drivers.reviewCount` through the API review aggregation. A completed booking that still needs `driverReview` must remain eligible for the live tracker and must not be dismissed/cleared automatically before the customer rates or closes it.
- After a taxi request is created, the live tracker is the primary customer surface.
  It hides the close action until the booking is completed or cancelled, warns on
  browser unload while active, blocks browser back while active, and allows customer
  cancellation only while the booking is `PENDING` or `OFFERED`. Active ride tracking
  must not be dismissible with an X/back action; it remains visible until customer
  cancellation, driver cancellation, completion, or another terminal status.
- Customer cancellation is blocked after a driver accepts the booking. Accepted trips
  use in-trip chat between the authenticated customer and the assigned driver.
- Booking chat endpoints intentionally do not use `requireActiveMember`, because both authenticated `USER` members and authenticated `DRIVER` accounts must access the same `/bookings/:id/chat` routes. Keep `authenticate` on those routes and let `getAuthorizedChatBooking()` enforce owner/assigned-driver access and active-trip write rules.
- Booking chat is stored in `chatMessages`. Chat endpoints allow only the booking
  owner or assigned driver, rate-limit reads/writes, and accept text plus guarded
  image/audio data URL attachments for later media UI.
- Customer in-trip chat is a **floating, draggable widget** (`FloatingChat`,
  `apps/web/app/floating-chat.tsx`) rendered via its own portal over the live
  tracker (collapsed bubble ↔ expanded panel; drag by the bubble/header). Driver
  APK keeps its chat FAB; both show a **red unread badge** computed client-side
  (no backend read-state): Web uses `localStorage` key
  `taxilao_chat_read_{bookingId}`, APK uses `SharedPreferences`
  `chat_read_{bookingId}`. Unread = messages from the other role whose
  `createdAt` is newer than the stored last-read timestamp; opening/clearing the
  chat marks it read. Do not add server-side read-state without updating both
  consumers and this file.
- The live tracker is rendered from inside booking surfaces but displayed via a portal.
  Chat forms inside the portal must call `event.stopPropagation()` after
  `event.preventDefault()` so chat submission never bubbles into the parent booking
  form and creates a duplicate ride request.
- Active customer bookings are remembered with `taxilao_last_booking_id`; dismissed
  active trackers are tracked with `taxilao_dismissed_booking_ids` as a list, not a
  single id, so older active orders do not reappear after a new booking. Completed or
  cancelled bookings must not remain cached as the last active booking.
- Customer live status uses SSE from `/bookings/:id/events` plus a polling fallback to
  `/bookings/:id`; do not remove the fallback because proxies, local dev servers, or
  browsers may delay or cancel event streams.
- MapLibre live maps must not mount React roots inside marker DOM. Use plain DOM
  elements for markers, and sanitize route geometry so null/non-number coordinates are
  not passed into MapLibre.
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

