import "dotenv/config";
import { randomUUID } from "crypto";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { z } from "zod";
import { calculateUrbanPrice, drivers, tourPackages, type BookingStatus } from "@taxilao/shared";
import { authenticate, requireRole, signAccessToken, signRefreshToken, type AuthUser } from "./security";
import { validate } from "./validation";
import { createPaymentIntentDraft } from "./payment.service";

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

app.use(helmet());
app.use(cors({ origin: webOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(passport.initialize());

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const bookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback"
      },
      (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value ?? `${profile.id}@google.local`;
        const user: AuthUser = { id: profile.id, email, role: "USER" };
        return done(null, user);
      }
    )
  );
}

const bookings: Array<{
  id: string;
  userId: string;
  driverId?: string;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  passengers: number;
  pickupAt: string;
  status: BookingStatus;
  estimatedPriceLak: number;
}> = [];

app.get("/health", (_req, res) => res.json({ ok: true, service: "taxilao-api" }));

app.get("/auth/google", loginLimiter, (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ message: "ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Google OAuth. ກະລຸນາຕັ້ງ GOOGLE_CLIENT_ID ແລະ GOOGLE_CLIENT_SECRET." });
  }

  return passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

app.get(
  "/auth/google/callback",
  loginLimiter,
  passport.authenticate("google", { session: false, failureRedirect: `${webOrigin}/login` }),
  (req, res) => {
    const user = req.user as AuthUser;
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    return res.redirect(`${webOrigin}/dashboard?accessToken=${accessToken}&refreshToken=${refreshToken}`);
  }
);

app.get("/drivers", (req, res) => {
  const { city, language, vehicleType, premium } = req.query;
  const filtered = drivers
    .filter((driver) => !city || driver.city === city)
    .filter((driver) => !language || driver.languages.includes(String(language)))
    .filter((driver) => !vehicleType || driver.vehicleType.toLowerCase().includes(String(vehicleType).toLowerCase()))
    .filter((driver) => premium === undefined || driver.premium === (premium === "true"))
    .sort((a, b) => Number(b.premium) - Number(a.premium) || b.rating - a.rating);

  return res.json(filtered);
});

app.get(
  "/drivers/:id",
  validate(z.object({ params: z.object({ id: z.string().min(1) }) })),
  (req, res) => {
    const driver = drivers.find((item) => item.id === req.params.id);
    return driver ? res.json(driver) : res.status(404).json({ message: "ບໍ່ພົບຄົນຂັບ" });
  }
);

app.post(
  "/drivers/apply",
  bookingLimiter,
  validate(
    z.object({
      body: z.object({
        name: z.string().min(2),
        city: z.string().min(2),
        languages: z.array(z.string()).min(1),
        vehicleType: z.string().min(2)
      })
    })
  ),
  (req, res) => {
    return res.status(201).json({
      id: randomUUID(),
      ...req.body,
      verified: false,
      premium: false,
      status: "PENDING_REVIEW"
    });
  }
);

app.patch(
  "/drivers/:id",
  authenticate,
  requireRole("DRIVER", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      params: z.object({ id: z.string().min(1) }),
      body: z.object({
        bio: z.string().max(500).optional(),
        startingPriceLak: z.number().int().positive().optional(),
        routes: z.array(z.string()).optional()
      })
    })
  ),
  (req, res) => res.json({ id: req.params.id, ...req.body })
);

app.get("/tours", (_req, res) => res.json(tourPackages));

app.post(
  "/bookings",
  bookingLimiter,
  validate(
    z.object({
      body: z.object({
        userId: z.string().default("guest"),
        driverId: z.string().optional(),
        pickup: z.string().min(2),
        dropoff: z.string().min(2),
        distanceKm: z.number().positive(),
        passengers: z.number().int().min(1).max(12),
        pickupAt: z.string().datetime()
      })
    })
  ),
  (req, res) => {
    const booking = {
      id: randomUUID(),
      ...req.body,
      status: "PENDING" as BookingStatus,
      estimatedPriceLak: calculateUrbanPrice(req.body.distanceKm)
    };
    bookings.push(booking);
    return res.status(201).json(booking);
  }
);

app.get("/bookings/me", authenticate, (req, res) => {
  return res.json(bookings.filter((booking) => booking.userId === req.user?.id));
});

app.patch(
  "/bookings/:id/status",
  authenticate,
  requireRole("DRIVER", "ADMIN", "SUPER_ADMIN"),
  validate(
    z.object({
      params: z.object({ id: z.string().min(1) }),
      body: z.object({ status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]) })
    })
  ),
  (req, res) => {
    const booking = bookings.find((item) => item.id === req.params.id);
    if (!booking) return res.status(404).json({ message: "ບໍ່ພົບການຈອງ" });
    booking.status = req.body.status;
    return res.json(booking);
  }
);

app.post(
  "/reviews",
  authenticate,
  validate(
    z.object({
      body: z.object({
        driverId: z.string(),
        rating: z.number().min(1).max(5),
        comment: z.string().min(3).max(800)
      })
    })
  ),
  (req, res) => res.status(201).json({ id: randomUUID(), userId: req.user?.id, hidden: false, ...req.body })
);

app.get("/admin/dashboard", authenticate, requireRole("ADMIN", "SUPER_ADMIN"), (_req, res) => {
  return res.json({
    drivers: drivers.length,
    users: 128,
    bookings: bookings.length,
    revenueLak: bookings.reduce((sum, booking) => sum + booking.estimatedPriceLak, 0),
    premiumDrivers: drivers.filter((driver) => driver.premium).length,
    latestReviews: 3
  });
});

app.get("/admin/drivers", authenticate, requireRole("ADMIN", "SUPER_ADMIN"), (_req, res) => res.json(drivers));

app.patch("/admin/drivers/:id/verify", authenticate, requireRole("ADMIN", "SUPER_ADMIN"), (req, res) => {
  return res.json({ id: req.params.id, verified: true, adminLog: "DRIVER_VERIFIED" });
});

app.patch("/admin/drivers/:id/premium", authenticate, requireRole("ADMIN", "SUPER_ADMIN"), (req, res) => {
  return res.json({ id: req.params.id, premium: true, adminLog: "DRIVER_PREMIUM_ENABLED" });
});

app.get("/admin/bookings", authenticate, requireRole("ADMIN", "SUPER_ADMIN"), (_req, res) => res.json(bookings));

app.get("/admin/payments", authenticate, requireRole("ADMIN", "SUPER_ADMIN"), (_req, res) => {
  return res.json([
    createPaymentIntentDraft({ bookingId: "demo-booking", amountLak: 50000, method: "CASH" }),
    createPaymentIntentDraft({ bookingId: "future-usdt", amountLak: 250000, method: "USDT_TRC20" })
  ]);
});

app.listen(port, () => {
  console.log(`TAXILAO API listening on http://localhost:${port}`);
});
