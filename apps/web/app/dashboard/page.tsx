"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Banknote, CalendarCheck, Car, LogIn, LogOut, MapPin, Phone, RefreshCcw, Search, Star, UserRound } from "lucide-react";
import { formatLak } from "@taxilao/shared";
import { Nav } from "../components";
import { getApiUrl } from "../config";
import { useUiCopy } from "../use-ui-copy";

const RideLiveMap = dynamic(() => import("../ride-live-map").then((module) => module.RideLiveMap), { ssr: false });
const RideLiveTracker = dynamic(() => import("../ride-live-tracker").then((module) => module.RideLiveTracker), { ssr: false });

type PublicBooking = {
  id: string;
  bookingType?: string;
  tourTitle?: string;
  pickup: string;
  dropoff: string;
  pickupAt?: string;
  distanceKm?: number;
  passengers: number;
  status: string;
  estimatedPriceLak: number;
  customerName?: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  note?: string;
  pickupLocation?: { type: "Point"; coordinates: [number, number] } | null;
  dropoffLocation?: { type: "Point"; coordinates: [number, number] } | null;
  routeGeometry?: { type: "LineString"; coordinates: [number, number][] } | null;
  driverLocation?: {
    type: "Point";
    coordinates: [number, number];
    accuracy?: number;
    heading?: number;
    speed?: number;
    updatedAt?: string;
  } | null;
  driver?: {
    id: string;
    name: string;
    city: string;
    vehicleType: string;
    rating?: number;
    premium?: boolean;
  };
  payment?: {
    amountLak: number;
    currency: string;
    method: string;
    status: string;
  };
  driverReview?: {
    rating: number;
    comment: string;
    createdAt?: string;
  };
  customerReview?: {
    rating: number;
    comment: string;
    createdAt?: string;
  };
};

type Member = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

type MemberTokens = {
  accessToken: string;
  refreshToken: string;
};

const activeStatuses = ["PENDING", "OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"];
const liveTrackerStatuses = [...activeStatuses, "CANCELLED"];
const dismissedBookingKey = "taxilao_dismissed_booking_id";
const dismissedBookingsKey = "taxilao_dismissed_booking_ids";

function getDismissedBookingIds() {
  const ids = new Set<string>();
  const legacyId = localStorage.getItem(dismissedBookingKey);
  if (legacyId) ids.add(legacyId);
  try {
    const stored = JSON.parse(localStorage.getItem(dismissedBookingsKey) || "[]");
    if (Array.isArray(stored)) {
      stored.filter((id) => typeof id === "string" && id).forEach((id) => ids.add(id));
    }
  } catch {
    // Ignore old malformed local data.
  }
  return ids;
}

function dismissBookingId(id: string) {
  const ids = Array.from(getDismissedBookingIds().add(id)).slice(-30);
  localStorage.setItem(dismissedBookingsKey, JSON.stringify(ids));
  localStorage.setItem(dismissedBookingKey, id);
}

function undismissBookingId(id: string) {
  const ids = Array.from(getDismissedBookingIds()).filter((item) => item !== id);
  localStorage.setItem(dismissedBookingsKey, JSON.stringify(ids));
  if (localStorage.getItem(dismissedBookingKey) === id) localStorage.removeItem(dismissedBookingKey);
}

export default function UserDashboardPage() {
  const apiUrl = getApiUrl();
  const { locale, copy } = useUiCopy();
  const statusLabels: Record<string, string> = {
    PENDING: copy.pending, OFFERED: copy.waitingForDriver, CONFIRMED: copy.confirmed, ON_THE_WAY: copy.onTheWay, IN_PROGRESS: copy.tripStarted,
    COMPLETED: copy.completed, CANCELLED: copy.cancelled
  };
  const [bookingId, setBookingId] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [memberBookings, setMemberBookings] = useState<PublicBooking[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [memberToken, setMemberToken] = useState("");

  function logout() {
    localStorage.removeItem("taxilao_member_access_token");
    localStorage.removeItem("taxilao_member_refresh_token");
    setMember(null);
    setMemberBookings([]);
    setMemberToken("");
  }

  async function loadMember(accessToken: string) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [memberResponse, bookingsResponse] = await Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers, cache: "no-store" }),
      fetch(`${apiUrl}/bookings/me`, { headers, cache: "no-store" })
    ]);

    if (!memberResponse.ok) throw new Error("Session expired");
    const nextBookings = bookingsResponse.ok ? await bookingsResponse.json() as PublicBooking[] : [];
    setMember(await memberResponse.json());
    setMemberBookings(nextBookings);
    setMemberToken(accessToken);
    setBooking((current) => {
      if (current) return nextBookings.find((item) => item.id === current.id) ?? current;
      const savedId = localStorage.getItem("taxilao_last_booking_id");
      const dismissedIds = getDismissedBookingIds();
      return nextBookings.find((item) => item.id === savedId && !dismissedIds.has(item.id) && liveTrackerStatuses.includes(item.status))
        ?? nextBookings.find((item) => activeStatuses.includes(item.status) && !dismissedIds.has(item.id))
        ?? null;
    });
  }

  async function restoreMemberSession() {
    const accessToken = localStorage.getItem("taxilao_member_access_token");
    const refreshToken = localStorage.getItem("taxilao_member_refresh_token");
    if (!accessToken) return;

    try {
      await loadMember(accessToken);
    } catch {
      if (!refreshToken) return logout();

      try {
        const response = await fetch(`${apiUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });
        if (!response.ok) throw new Error("Refresh failed");

        const tokens = (await response.json()) as MemberTokens;
        localStorage.setItem("taxilao_member_access_token", tokens.accessToken);
        localStorage.setItem("taxilao_member_refresh_token", tokens.refreshToken);
        await loadMember(tokens.accessToken);
      } catch {
        logout();
      }
    }
  }

  async function lookupBooking(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setStatus("loading");
    setMessage(copy.searching);

    try {
      const response = await fetch(`${apiUrl}/bookings/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, phone })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Booking lookup failed");

      setBooking(data);
      setStatus("success");
      setMessage(copy.searchBooking);
      undismissBookingId(bookingId);
      localStorage.setItem("taxilao_last_booking_id", bookingId);
      localStorage.setItem("taxilao_last_booking_phone", phone);
    } catch (error) {
      setBooking(null);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : copy.bookingFailed);
    }
  }

  useEffect(() => {
    setBookingId(localStorage.getItem("taxilao_last_booking_id") ?? "");
    setPhone(localStorage.getItem("taxilao_last_booking_phone") ?? "");
    void restoreMemberSession();
  }, []);

  useEffect(() => {
    if (!booking) return;
    localStorage.setItem("taxilao_last_booking_id", booking.id);
    if (booking.customerPhone || booking.customerWhatsapp) {
      localStorage.setItem("taxilao_last_booking_phone", booking.customerPhone || booking.customerWhatsapp || "");
    }
  }, [booking]);

  useEffect(() => {
    if (!booking || !memberToken || ["COMPLETED", "CANCELLED"].includes(booking.status)) return;
    const controller = new AbortController();
    const activeBookingId = booking.id;

    async function connect() {
      while (!controller.signal.aborted) {
        try {
          const response = await fetch(`${apiUrl}/bookings/${activeBookingId}/events`, {
            headers: { Authorization: `Bearer ${memberToken}`, Accept: "text/event-stream" },
            cache: "no-store",
            signal: controller.signal
          });
          if (!response.ok || !response.body) throw new Error("Live status unavailable");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";
            for (const event of events) {
              const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
              if (!dataLine) continue;
              const nextBooking = JSON.parse(dataLine.slice(6)) as PublicBooking;
              setBooking(nextBooking);
              setMemberBookings((items) => items.map((item) => item.id === nextBooking.id ? nextBooking : item));
            }
          }
        } catch {
          if (controller.signal.aborted) return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
    }

    void connect();
    return () => controller.abort();
  }, [apiUrl, booking?.id, booking?.status, memberToken]);

  return (
    <main className="shell">
      <Nav locale={locale} />
      <section className="member-bar">
        {member ? (
          <>
            <div className="member-identity">
              {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <UserRound size={24} />}
              <div><strong>{member.name}</strong><span>{member.email}</span></div>
            </div>
            <div className="member-bar-actions">
              <span>{memberBookings.length} {copy.items}</span>
              <button className="btn" onClick={logout} type="button"><LogOut size={16} /> {copy.logout}</button>
            </div>
          </>
        ) : (
          <>
            <div className="member-identity"><UserRound size={24} /><div><strong>{copy.signIn}</strong><span>{copy.loginLead}</span></div></div>
            <a className="btn btn-primary" href={`/login?lang=${locale}`}><LogIn size={16} /> {copy.signIn}</a>
          </>
        )}
      </section>

      <section className="member-dashboard">
        <div>
          <p className="eyebrow">BOOKING TRACKER</p>
          <h1>{copy.dashboardTitle}</h1>
          <p className="lead">{copy.dashboardLead}</p>

          {member && memberBookings.length ? (
            <div className="member-booking-list">
              <p className="eyebrow">{copy.myBookings}</p>
              {memberBookings.slice(0, 5).map((item) => (
                <button className="member-booking-row" key={item.id} onClick={() => setBooking(item)} type="button">
                  <span><strong>{item.pickup}</strong><small>{item.dropoff}</small></span>
                  <span><strong>{formatLak(item.estimatedPriceLak)}</strong><small>{statusLabels[item.status] ?? item.status}</small></span>
                </button>
              ))}
            </div>
          ) : null}

          {booking ? <BookingSummary booking={booking} copy={copy} statusLabels={statusLabels} apiUrl={apiUrl} memberToken={memberToken} onReviewed={(review) => {
            const next = { ...booking, driverReview: review };
            setBooking(next);
            setMemberBookings((items) => items.map((item) => item.id === booking.id ? next : item));
          }} /> : null}
        </div>

        <form className="booking-panel member-lookup" onSubmit={lookupBooking}>
          <Search color="#f2d891" />
          <h2>{copy.searchBooking}</h2>
          <p>{copy.guestBooking}</p>
          <div className="grid">
            <div className="field">
              <label htmlFor="bookingId">Booking ID</label>
              <input id="bookingId" value={bookingId} onChange={(event) => setBookingId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx..." required />
            </div>
            <div className="field">
              <label htmlFor="phone">{copy.phone}</label>
              <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+856 20..." required />
            </div>
          </div>
          <button className="btn btn-primary" disabled={status === "loading"} type="submit">
            {status === "loading" ? copy.searching : copy.search}
          </button>
          {bookingId && phone ? <button className="btn" onClick={() => lookupBooking()} type="button"><RefreshCcw size={16} /> {copy.refresh}</button> : null}
          {message ? <p className={status === "error" ? "form-message error" : "form-message"}>{message}</p> : null}
        </form>
      </section>
      {booking && memberToken && liveTrackerStatuses.includes(booking.status) ? (
        <RideLiveTracker
          apiUrl={apiUrl}
          token={memberToken}
          initialBooking={booking as any}
          onClose={(closedBooking) => {
            const nextBooking = (closedBooking as PublicBooking | undefined) || booking;
            if (activeStatuses.includes(nextBooking.status)) {
              setBooking(nextBooking);
              localStorage.setItem("taxilao_last_booking_id", nextBooking.id);
              return;
            }
            undismissBookingId(nextBooking.id);
            if (nextBooking.id === localStorage.getItem("taxilao_last_booking_id")) {
              localStorage.removeItem("taxilao_last_booking_id");
            }
            setBooking(null);
          }}
        />
      ) : null}
    </main>
  );
}

function BookingSummary({ booking, copy, statusLabels, apiUrl, memberToken, onReviewed }: { booking: PublicBooking; copy: ReturnType<typeof useUiCopy>["copy"]; statusLabels: Record<string, string>; apiUrl: string; memberToken: string; onReviewed: (review: NonNullable<PublicBooking["driverReview"]>) => void }) {
  return (
    <div className="booking-result">
      <article className="booking-panel">
        <div className="section-head">
          <div><p className="eyebrow">#{booking.id.slice(0, 8)}</p><h2>{statusLabels[booking.status] ?? booking.status}</h2></div>
          <span className="badge gold">{booking.status}</span>
        </div>
        <div className="cards driver-grid">
          <InfoTile icon={<MapPin />} label={copy.route} value={`${booking.pickup} → ${booking.dropoff}`} />
          <InfoTile icon={<CalendarCheck />} label={copy.dateTime} value={booking.pickupAt ? new Date(booking.pickupAt).toLocaleString() : "-"} />
          <InfoTile icon={<Phone />} label={copy.contact} value={booking.customerWhatsapp || booking.customerPhone || "-"} />
          <InfoTile icon={<Banknote />} label={copy.price} value={formatLak(booking.estimatedPriceLak)} />
        </div>
        {booking.driver ? (
          <>
            <div className="driver-assigned"><Car color="#f2d891" /><div><p className="eyebrow">{copy.driver}</p><h3>{booking.driver.name}</h3><p>{booking.driver.city} - {booking.driver.vehicleType}</p></div></div>
            <div className="dashboard-live-map">
              <div className="ride-live-map-head">
                <div><strong>{copy.driverLiveLocation}</strong><small>{booking.driverLocation?.updatedAt ? `${copy.gpsUpdated} ${new Date(booking.driverLocation.updatedAt).toLocaleTimeString()}` : copy.gpsWaiting}</small></div>
                {booking.driverLocation?.accuracy ? <span>±{Math.round(booking.driverLocation.accuracy)} m</span> : null}
              </div>
              <RideLiveMap pickupLocation={booking.pickupLocation} dropoffLocation={booking.dropoffLocation} driverLocation={booking.driverLocation} routeGeometry={booking.routeGeometry} />
            </div>
          </>
        ) : <p>{copy.noDriver}</p>}
        {booking.status === "COMPLETED" && booking.driver ? (
          <DriverReviewForm booking={booking} apiUrl={apiUrl} memberToken={memberToken} onReviewed={onReviewed} />
        ) : null}
      </article>
    </div>
  );
}

function DriverReviewForm({ booking, apiUrl, memberToken, onReviewed }: { booking: PublicBooking; apiUrl: string; memberToken: string; onReviewed: (review: NonNullable<PublicBooking["driverReview"]>) => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(booking.driverReview ? "success" : "idle");
  const [message, setMessage] = useState(booking.driverReview ? "ທ່ານໃຫ້ດາວຄົນຂັບແລ້ວ" : "");

  async function submitReview() {
    if (booking.driverReview || status === "loading") return;
    if (!memberToken) {
      setStatus("error");
      setMessage("ກະລຸນາເຂົ້າລະບົບກ່ອນໃຫ້ດາວ");
      return;
    }
    if (!comment.trim()) {
      setStatus("error");
      setMessage("ກະລຸນາໃສ່ຄຳເຫັນສັ້ນໆ");
      return;
    }
    setStatus("loading");
    setMessage("ກຳລັງບັນທຶກ...");
    try {
      const response = await fetch(`${apiUrl}/bookings/${booking.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${memberToken}` },
        body: JSON.stringify({ rating, comment })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Review failed");
      const review = { rating, comment, createdAt: data.createdAt };
      onReviewed(review);
      setStatus("success");
      setMessage("ຂອບໃຈ ບັນທຶກຄະແນນແລ້ວ");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Review failed");
    }
  }

  const disabled = Boolean(booking.driverReview) || status === "loading";
  return (
    <div className="driver-review-box">
      <div>
        <p className="eyebrow">RATING</p>
        <h3>ໃຫ້ດາວຄົນຂັບ</h3>
      </div>
      <div className="review-stars" aria-label="rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button disabled={disabled} key={value} onClick={() => setRating(value)} type="button">
            <Star size={22} fill={value <= rating ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <textarea disabled={disabled} value={booking.driverReview?.comment ?? comment} onChange={(event) => setComment(event.target.value)} placeholder="ຂຽນຄຳເຫັນກ່ຽວກັບຄົນຂັບ..." />
      <button className="btn btn-primary" disabled={disabled} onClick={submitReview} type="button">
        {booking.driverReview ? "ໃຫ້ດາວແລ້ວ" : status === "loading" ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກຄະແນນ"}
      </button>
      {message ? <p className={status === "error" ? "form-message error" : "form-message"}>{message}</p> : null}
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <article className="panel info-tile"><div style={{ color: "#f2d891" }}>{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}
