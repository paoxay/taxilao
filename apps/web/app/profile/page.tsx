"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, BookOpen, CalendarDays, CheckCircle2, Copy, Gauge, IdCard, LogOut, Mail, MapPin, Phone, Route, ShieldCheck, UserRound } from "lucide-react";
import { formatLak } from "@taxilao/shared";
import { Nav } from "../components";
import { getApiUrl } from "../config";
import { useUiCopy } from "../use-ui-copy";

type Member = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
  status?: string;
  provider?: string;
  createdAt?: string | null;
  lastLoginAt?: string | null;
};

type Booking = {
  id: string;
  pickup: string;
  dropoff: string;
  pickupAt?: string;
  status: string;
  estimatedPriceLak: number;
  createdAt?: string;
};

export default function ProfilePage() {
  const apiUrl = getApiUrl();
  const { locale, copy } = useUiCopy();
  const statusLabels: Record<string, string> = {
    PENDING: copy.pending, OFFERED: copy.waitingForDriver, CONFIRMED: copy.confirmed, ON_THE_WAY: copy.onTheWay, IN_PROGRESS: copy.tripStarted,
    COMPLETED: copy.completed, CANCELLED: copy.cancelled
  };
  const [member, setMember] = useState<Member | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeView, setActiveView] = useState<"profile" | "trips" | "status">("profile");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "trips" || requestedView === "status") setActiveView(requestedView);

    const token = localStorage.getItem("taxilao_member_access_token");
    if (!token) {
      window.location.replace("/login");
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers, cache: "no-store" }),
      fetch(`${apiUrl}/bookings/me`, { headers, cache: "no-store" })
    ])
      .then(async ([memberResponse, bookingResponse]) => {
        if (!memberResponse.ok) throw new Error("Session expired");
        setMember(await memberResponse.json());
        setBookings(bookingResponse.ok ? await bookingResponse.json() : []);
      })
      .catch(() => {
        localStorage.removeItem("taxilao_member_access_token");
        localStorage.removeItem("taxilao_member_refresh_token");
        window.location.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const completedTrips = useMemo(() => bookings.filter((booking) => booking.status === "COMPLETED").length, [bookings]);
  const activeTrips = useMemo(() => bookings.filter((booking) => ["PENDING", "OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"].includes(booking.status)).length, [bookings]);
  const totalSpend = useMemo(() => bookings.filter((booking) => booking.status !== "CANCELLED").reduce((sum, booking) => sum + Number(booking.estimatedPriceLak || 0), 0), [bookings]);

  function logout() {
    localStorage.removeItem("taxilao_member_access_token");
    localStorage.removeItem("taxilao_member_refresh_token");
    window.location.replace("/");
  }

  async function copyAccountId() {
    if (!member) return;
    await navigator.clipboard.writeText(member.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (loading || !member) {
    return <main className="profile-loading"><span /><p>{copy.customerProfile}...</p></main>;
  }

  return (
    <main className="profile-shell">
      <Nav locale={locale} />
      <section className="profile-header-band">
        <div className="profile-avatar">
          {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <UserRound size={38} />}
          <span><BadgeCheck size={17} /></span>
        </div>
        <div className="profile-heading">
          <p className="eyebrow">TAXILAO MEMBER</p>
          <h1>{member.name}</h1>
          <div>
            {member.phone ? <span><Phone size={15} /> +856 {member.phone}</span> : null}
            {member.email ? <span><Mail size={15} /> {member.email}</span> : null}
            <span><ShieldCheck size={15} /> {copy.accountVerified}</span>
          </div>
        </div>
        <button className="btn profile-logout" onClick={logout} type="button"><LogOut size={17} /> {copy.logout}</button>
      </section>

      <section className="profile-workspace">
        <aside className="profile-sidebar">
          <button className={activeView === "profile" ? "active" : ""} onClick={() => setActiveView("profile")} type="button"><UserRound size={18} /><span>{copy.customerProfile}<small>{copy.accountInfo}</small></span></button>
          <button className={activeView === "trips" ? "active" : ""} onClick={() => setActiveView("trips")} type="button"><BookOpen size={18} /><span>{copy.tripHistory}<small>{bookings.length} {copy.items}</small></span></button>
          <button className={activeView === "status" ? "active" : ""} onClick={() => setActiveView("status")} type="button"><Gauge size={18} /><span>{copy.status}<small>{activeTrips} {copy.active}</small></span></button>
          <button className="danger" onClick={logout} type="button"><LogOut size={18} /><span>{copy.logout}<small>Session</small></span></button>
        </aside>

        <div className="profile-content">
          <div className="profile-stat-grid">
            <article><Route size={20} /><span>{copy.trips}</span><strong>{bookings.length}</strong></article>
            <article><CheckCircle2 size={20} /><span>{copy.completed}</span><strong>{completedTrips}</strong></article>
            <article><Gauge size={20} /><span>{copy.active}</span><strong>{activeTrips}</strong></article>
            <article><IdCard size={20} /><span>{copy.total}</span><strong>{formatLak(totalSpend)}</strong></article>
          </div>

          {activeView === "profile" ? (
            <div className="profile-section-grid">
              <article className="profile-panel">
                <div className="profile-panel-head"><div><p className="eyebrow">ACCOUNT</p><h2>{copy.accountInfo}</h2></div><span className="account-status"><CheckCircle2 size={15} /> {copy.active}</span></div>
                <dl className="profile-details">
                  <div><dt>{copy.customerName}</dt><dd>{member.name}</dd></div>
                  <div><dt>ເບີໂທ</dt><dd>{member.phone ? `+856 ${member.phone}` : "—"}</dd></div>
                  <div><dt>Email</dt><dd>{member.email || "—"}</dd></div>
                  <div><dt>{copy.loginMethod}</dt><dd>{member.provider === "phone" ? "Phone + OTP" : "Google"}</dd></div>
                  <div><dt>{copy.joined}</dt><dd>{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "TAXILAO"}</dd></div>
                </dl>
              </article>
              <article className="profile-panel account-id-panel">
                <IdCard size={25} />
                <p className="eyebrow">ACCOUNT ID</p>
                <h2>{copy.accountId}</h2>
                <p>{copy.accountIdHelp}</p>
                <code>{member.id}</code>
                <button className="btn" onClick={copyAccountId} type="button"><Copy size={16} /> {copied ? copy.copied : copy.copyId}</button>
              </article>
            </div>
          ) : null}

          {activeView === "trips" ? (
            <article className="profile-panel">
              <div className="profile-panel-head"><div><p className="eyebrow">TRIP HISTORY</p><h2>{copy.tripHistory}</h2></div><span>{bookings.length} {copy.items}</span></div>
              <div className="trip-history-list">
                {bookings.length ? bookings.map((booking) => <TripRow booking={booking} statusLabels={statusLabels} noDate={copy.noDate} key={booking.id} />) : <EmptyTrips label={copy.noTrips} lead={copy.tripsAppear} />}
              </div>
            </article>
          ) : null}

          {activeView === "status" ? (
            <article className="profile-panel">
              <div className="profile-panel-head"><div><p className="eyebrow">LIVE STATUS</p><h2>{copy.bookingStatus}</h2></div><span className="account-status"><CheckCircle2 size={15} /> {copy.active}</span></div>
              <div className="trip-history-list">
                {bookings.filter((booking) => booking.status !== "COMPLETED" && booking.status !== "CANCELLED").length
                  ? bookings.filter((booking) => booking.status !== "COMPLETED" && booking.status !== "CANCELLED").map((booking) => <TripRow booking={booking} statusLabels={statusLabels} noDate={copy.noDate} key={booking.id} />)
                  : <EmptyTrips label={copy.noActiveTrips} lead={copy.tripsAppear} />}
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function TripRow({ booking, statusLabels, noDate }: { booking: Booking; statusLabels: Record<string, string>; noDate: string }) {
  return (
    <article className="trip-history-row">
      <div className="trip-route-icon"><MapPin size={18} /></div>
      <div className="trip-route"><strong>{booking.pickup}</strong><span>{booking.dropoff}</span><small><CalendarDays size={13} /> {booking.pickupAt ? new Date(booking.pickupAt).toLocaleString() : noDate}</small></div>
      <div className="trip-result"><strong>{formatLak(booking.estimatedPriceLak)}</strong><span className={`trip-status ${booking.status.toLowerCase()}`}>{statusLabels[booking.status] ?? booking.status}</span><small>#{booking.id.slice(0, 8)}</small></div>
    </article>
  );
}

function EmptyTrips({ label, lead }: { label: string; lead: string }) {
  return <div className="empty-trips"><Route size={28} /><strong>{label}</strong><p>{lead}</p></div>;
}
