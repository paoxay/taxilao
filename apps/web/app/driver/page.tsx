"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Car, CheckCircle2, CircleDot, LocateFixed, LogOut, MapPin, Navigation, RefreshCcw, ShieldCheck, UserRound } from "lucide-react";
import { formatLak } from "@taxilao/shared";
import { Nav } from "../components";

type DriverProfile = {
  id: string;
  name: string;
  city: string;
  vehicleType: string;
  verified: boolean;
  premium: boolean;
};

type DriverBooking = {
  id: string;
  driverId?: string | null;
  bookingType: string;
  pickup: string;
  dropoff: string;
  pickupAt?: string;
  customerName?: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  note?: string;
  passengers: number;
  status: string;
  estimatedPriceLak: number;
  distanceKm?: number;
  durationMinutes?: number;
  payment?: { method: string; status: string };
};

const statusLabels: Record<string, string> = {
  PENDING: "ວຽກໃໝ່",
  CONFIRMED: "ຮັບວຽກແລ້ວ",
  ON_THE_WAY: "ກຳລັງໄປຮັບ",
  IN_PROGRESS: "ກຳລັງເດີນທາງ",
  COMPLETED: "ສຳເລັດ",
  CANCELLED: "ຍົກເລີກ"
};

const nextActions: Record<string, { status: string; label: string }> = {
  PENDING: { status: "CONFIRMED", label: "ຮັບວຽກ" },
  CONFIRMED: { status: "ON_THE_WAY", label: "ອອກໄປຮັບລູກຄ້າ" },
  ON_THE_WAY: { status: "IN_PROGRESS", label: "ເລີ່ມການເດີນທາງ" },
  IN_PROGRESS: { status: "COMPLETED", label: "ສຳເລັດການເດີນທາງ" }
};

export default function DriverDashboardPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const [driverId, setDriverId] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [bookings, setBookings] = useState<DriverBooking[]>([]);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "sharing" | "error">("idle");
  const [locationAccuracy, setLocationAccuracy] = useState(0);

  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }

  async function readJson<T>(response: Response, fallback: T) {
    const data = await response.json().catch(() => fallback);
    if (!response.ok) {
      const serverMessage = typeof data === "object" && data && "message" in data ? String(data.message) : response.statusText;
      throw new Error(serverMessage);
    }
    return data;
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("ກຳລັງເຂົ້າລະບົບ...");
    try {
      const response = await fetch(`${apiUrl}/driver/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId, password })
      });
      const data = await readJson<{ token: string; driver: DriverProfile }>(response, { token: "", driver: null as unknown as DriverProfile });
      localStorage.setItem("taxilao_driver_token", data.token);
      localStorage.setItem("taxilao_driver_profile", JSON.stringify(data.driver));
      setToken(data.token);
      setDriver(data.driver);
      setPassword("");
      setMessage("ເຂົ້າລະບົບສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ເຂົ້າລະບົບບໍ່ສຳເລັດ: ${error.message}` : "ເຂົ້າລະບົບບໍ່ສຳເລັດ");
    }
  }

  async function loadBookings(showMessage = false) {
    if (!token) return;
    try {
      const response = await fetch(`${apiUrl}/driver/bookings`, { cache: "no-store", headers: authHeaders() });
      const data = await readJson<unknown>(response, []);
      setBookings(Array.isArray(data) ? data : []);
      if (showMessage) setMessage("ອັບເດດລາຍການວຽກແລ້ວ");
    } catch (error) {
      setBookings([]);
      setMessage(error instanceof Error ? `ໂຫຼດວຽກບໍ່ສຳເລັດ: ${error.message}` : "ໂຫຼດວຽກບໍ່ສຳເລັດ");
    }
  }

  async function updateStatus(booking: DriverBooking, status: string) {
    setUpdatingId(booking.id);
    try {
      const response = await fetch(`${apiUrl}/driver/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
      await readJson(response, null);
      setMessage(status === "CONFIRMED" ? "ຮັບວຽກສຳເລັດ" : "ອັບເດດສະຖານະແລ້ວ");
      await loadBookings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ອັບເດດສະຖານະບໍ່ສຳເລັດ");
      await loadBookings();
    } finally {
      setUpdatingId("");
    }
  }

  function logout() {
    localStorage.removeItem("taxilao_driver_token");
    localStorage.removeItem("taxilao_driver_profile");
    setToken("");
    setDriver(null);
    setBookings([]);
    setMessage("");
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("taxilao_driver_token");
    const savedProfile = localStorage.getItem("taxilao_driver_profile");
    if (savedToken) setToken(savedToken);
    if (savedProfile) {
      try {
        setDriver(JSON.parse(savedProfile));
      } catch {
        localStorage.removeItem("taxilao_driver_profile");
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    loadBookings();
    const interval = window.setInterval(() => loadBookings(), 4000);
    return () => window.clearInterval(interval);
  }, [token]);

  const activeBookings = bookings.filter((booking) => ["CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"].includes(booking.status));
  const newBookings = bookings.filter((booking) => booking.status === "PENDING");

  useEffect(() => {
    const activeBooking = activeBookings[0];
    if (!token || !activeBooking || !navigator.geolocation) {
      setLocationStatus(activeBooking && !navigator.geolocation ? "error" : "idle");
      return;
    }

    let lastSentAt = 0;
    let lastCoordinates = "";
    const watchId = navigator.geolocation.watchPosition(
      async ({ coords }) => {
        const now = Date.now();
        const coordinateKey = `${coords.longitude.toFixed(5)},${coords.latitude.toFixed(5)}`;
        if (now - lastSentAt < 5000 && coordinateKey === lastCoordinates) return;
        lastSentAt = now;
        lastCoordinates = coordinateKey;
        try {
          const response = await fetch(`${apiUrl}/driver/bookings/${activeBooking.id}/location`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({
              longitude: coords.longitude,
              latitude: coords.latitude,
              accuracy: coords.accuracy,
              heading: coords.heading,
              speed: coords.speed
            })
          });
          await readJson(response, null);
          setLocationAccuracy(Math.round(coords.accuracy));
          setLocationStatus("sharing");
        } catch {
          setLocationStatus("error");
        }
      },
      () => setLocationStatus("error"),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [apiUrl, token, activeBookings[0]?.id]);

  return (
    <main className="shell">
      <Nav />
      {!token ? (
        <section className="driver-login-screen">
          <div>
            <p className="eyebrow">TAXILAO DRIVER</p>
            <h1>ສູນຮັບວຽກຄົນຂັບ</h1>
            <p className="lead">ຮັບວຽກເອີ້ນລົດ ແລະອັບເດດການເດີນທາງໃຫ້ລູກຄ້າເຫັນແບບລຽວທາມ.</p>
          </div>
          <form className="booking-panel" onSubmit={login}>
            <ShieldCheck color="#f2d891" />
            <h2>ເຂົ້າລະບົບຄົນຂັບ</h2>
            <div className="field"><label htmlFor="driverId">Driver ID</label><input id="driverId" value={driverId} onChange={(event) => setDriverId(event.target.value)} required /></div>
            <div className="field"><label htmlFor="driverPassword">ລະຫັດຜ່ານ</label><input id="driverPassword" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <button className="btn btn-primary" type="submit">ເຂົ້າລະບົບ</button>
            {message ? <p className="form-message">{message}</p> : null}
          </form>
        </section>
      ) : (
        <section className="driver-workspace">
          <header className="driver-workspace-head">
            <div>
              <p className="eyebrow">DRIVER DISPATCH</p>
              <h1>ວຽກຂອງຂ້ອຍ</h1>
              <p>{driver ? `${driver.name} · ${driver.vehicleType} · ${driver.city}` : ""}</p>
            </div>
            <div>
              <button className="btn" onClick={() => loadBookings(true)} type="button"><RefreshCcw size={16} /> ໂຫຼດໃໝ່</button>
              <button className="btn" onClick={logout} type="button"><LogOut size={16} /> ອອກ</button>
            </div>
          </header>

          {message ? <p className="form-message driver-message">{message}</p> : null}
          <div className={`driver-location-status ${locationStatus}`}>
            <LocateFixed size={17} />
            <span>
              <strong>{locationStatus === "sharing" ? "ກຳລັງແຊຣ໌ GPS ໃຫ້ລູກຄ້າ" : locationStatus === "error" ? "ກະລຸນາເປີດສິດຕຳແໜ່ງ GPS" : "GPS ຈະເລີ່ມເມື່ອຮັບວຽກ"}</strong>
              {locationStatus === "sharing" ? <small>ຄວາມແມ່ນຍຳປະມານ {locationAccuracy} ແມັດ</small> : null}
            </span>
          </div>

          <div className="driver-stat-row">
            <span><Car size={18} /><small>ວຽກໃໝ່</small><strong>{newBookings.length}</strong></span>
            <span><CalendarClock size={18} /><small>ກຳລັງດຳເນີນ</small><strong>{activeBookings.length}</strong></span>
            <span><CheckCircle2 size={18} /><small>ສຳເລັດ</small><strong>{bookings.filter((booking) => booking.status === "COMPLETED").length}</strong></span>
          </div>

          <div className="driver-job-list">
            {bookings.length ? bookings.map((booking) => {
              const action = nextActions[booking.status];
              return (
                <article className={`driver-job status-${booking.status.toLowerCase()}`} key={booking.id}>
                  <header>
                    <div><span className="driver-job-live"><CircleDot size={13} /> {statusLabels[booking.status] || booking.status}</span><strong>#{booking.id.slice(0, 8).toUpperCase()}</strong></div>
                    <b>{formatLak(booking.estimatedPriceLak)}</b>
                  </header>
                  <div className="driver-job-route">
                    <span><MapPin size={17} /><small>ຈຸດຮັບ</small><strong>{booking.pickup}</strong></span>
                    <span><Navigation size={17} /><small>ຈຸດສົ່ງ</small><strong>{booking.dropoff || "ຕົກລົງກັບລູກຄ້າ"}</strong></span>
                  </div>
                  <div className="driver-job-meta">
                    <span><UserRound size={15} /> {booking.customerName || "ລູກຄ້າ"}</span>
                    <span>{booking.customerWhatsapp || booking.customerPhone || "-"}</span>
                    <span>{booking.distanceKm || 0} km · {booking.durationMinutes || 0} min</span>
                  </div>
                  {booking.note ? <p className="driver-job-note">{booking.note}</p> : null}
                  <footer>
                    {action ? <button className="btn btn-primary" disabled={updatingId === booking.id} onClick={() => updateStatus(booking, action.status)} type="button">{updatingId === booking.id ? "ກຳລັງອັບເດດ..." : action.label}</button> : null}
                    {!["PENDING", "COMPLETED", "CANCELLED"].includes(booking.status) ? <button className="btn driver-cancel" disabled={updatingId === booking.id} onClick={() => updateStatus(booking, "CANCELLED")} type="button">ຍົກເລີກ</button> : null}
                  </footer>
                </article>
              );
            }) : (
              <div className="driver-empty"><Car size={30} /><h2>ຍັງບໍ່ມີວຽກໃໝ່</h2><p>ລະບົບຈະອັບເດດລາຍການໃຫ້ອັດຕະໂນມັດ.</p></div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
