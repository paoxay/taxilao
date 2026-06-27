"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { CarFront, Check, CircleDot, Clock3, MapPin, Navigation, Route, Send, ShieldCheck, X } from "lucide-react";
import { formatLak } from "@taxilao/shared";
import { useUiCopy } from "./use-ui-copy";

const RideLiveMap = dynamic(() => import("./ride-live-map").then((module) => module.RideLiveMap), { ssr: false });

export type LiveBooking = {
  id: string;
  bookingType: string;
  pickup: string;
  dropoff: string;
  distanceKm?: number;
  durationMinutes?: number;
  status: "PENDING" | "OFFERED" | "CONFIRMED" | "ON_THE_WAY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  estimatedPriceLak: number;
  updatedAt?: string;
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
  cancelledAt?: string;
  cancelledBy?: "DRIVER" | "USER" | string;
  cancellationReason?: string;
  driver?: {
    id: string;
    name: string;
    city: string;
    vehicleType: string;
    rating: number;
    premium: boolean;
    verified: boolean;
    portraitUrl?: string;
    vehicleUrl?: string;
  } | null;
};

type ChatMessage = {
  id: string;
  bookingId: string;
  senderRole: "USER" | "DRIVER" | string;
  senderName: string;
  text: string;
  attachmentUrl?: string;
  attachmentType?: string;
  createdAt?: string;
};

const statusOrder = ["PENDING", "OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETED"];

type RouteEstimate = {
  geometry?: { type: "LineString"; coordinates: [number, number][] } | null;
  distanceKm?: number;
  durationMinutes?: number;
};

export function RideLiveTracker({
  apiUrl,
  token,
  initialBooking,
  onClose
}: {
  apiUrl: string;
  token: string;
  initialBooking: LiveBooking;
  onClose: (booking?: LiveBooking) => void;
}) {
  const { locale, copy } = useUiCopy();
  const [booking, setBooking] = useState(initialBooking);
  const [connected, setConnected] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatStatus, setChatStatus] = useState<"idle" | "loading" | "sending" | "error">("idle");
  const [chatError, setChatError] = useState("");
  const [cancelStatus, setCancelStatus] = useState<"idle" | "loading" | "error">("idle");
  const [cancelError, setCancelError] = useState("");
  const [approachRoute, setApproachRoute] = useState<RouteEstimate | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setBooking((current) => {
      if (current.id !== initialBooking.id) return initialBooking;
      const currentTime = current.updatedAt ? Date.parse(current.updatedAt) : 0;
      const nextTime = initialBooking.updatedAt ? Date.parse(initialBooking.updatedAt) : 0;
      return nextTime > currentTime ? { ...current, ...initialBooking } : current;
    });
  }, [initialBooking]);
  useEffect(() => {
    if (["PENDING", "OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"].includes(booking.status)) {
      localStorage.setItem("taxilao_last_booking_id", booking.id);
    } else if (localStorage.getItem("taxilao_last_booking_id") === booking.id) {
      localStorage.removeItem("taxilao_last_booking_id");
    }
  }, [booking.id, booking.status]);
  const terminalStatus = booking.status === "COMPLETED" || booking.status === "CANCELLED";
  const canCancel = booking.status === "PENDING" || booking.status === "OFFERED";
  const chatEnabled = ["CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"].includes(booking.status) && Boolean(booking.driver?.id);
  const showApproachRoute = ["CONFIRMED", "ON_THE_WAY"].includes(booking.status);
  const driverRating = Number.isFinite(Number(booking.driver?.rating)) ? Number(booking.driver?.rating) : 5;

  useEffect(() => {
    if (terminalStatus) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const blockBack = () => {
      window.history.pushState({ taxilaoLiveBookingId: booking.id }, "", window.location.href);
    };
    window.history.pushState({ taxilaoLiveBookingId: booking.id }, "", window.location.href);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", blockBack);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", blockBack);
    };
  }, [booking.id, terminalStatus]);

  useEffect(() => {
    const controller = new AbortController();

    async function connect() {
      while (!controller.signal.aborted) {
        try {
          setConnected(false);
          const response = await fetch(`${apiUrl}/bookings/${initialBooking.id}/events`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            cache: "no-store",
            signal: controller.signal
          });
          if (!response.ok || !response.body) throw new Error("Live status connection failed");
          setConnected(true);

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
              try {
                const nextBooking = JSON.parse(dataLine.slice(6));
                if (nextBooking?.id) setBooking(nextBooking);
              } catch (error) {
                // Ignore malformed frames and keep the live stream alive.
              }
            }
          }
        } catch (error) {
          if (controller.signal.aborted) return;
        }
        setConnected(false);
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
    }

    connect();
    return () => controller.abort();
  }, [apiUrl, initialBooking.id, token]);

  useEffect(() => {
    if (terminalStatus) return;
    const controller = new AbortController();

    async function refreshBooking() {
      try {
        const response = await fetch(`${apiUrl}/bookings/${booking.id}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) return;
        setBooking((current) => {
          const currentTime = current.updatedAt ? Date.parse(current.updatedAt) : 0;
          const nextTime = data.updatedAt ? Date.parse(data.updatedAt) : Date.now();
          return nextTime >= currentTime ? data : current;
        });
      } catch (error) {
        // SSE remains the primary live channel; this is only a silent backup.
      }
    }

    const interval = window.setInterval(refreshBooking, 4000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [apiUrl, booking.id, terminalStatus, token]);

  async function loadChat(silent = false) {
    if (!chatEnabled) return;
    if (!silent) setChatStatus("loading");
    try {
      const response = await fetch(`${apiUrl}/bookings/${booking.id}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Chat failed");
      setChatMessages(Array.isArray(data) ? data.filter((message) => message?.id) : []);
      setChatStatus("idle");
      setChatError("");
    } catch (error) {
      setChatStatus("error");
      setChatError(error instanceof Error ? error.message : "Chat failed");
    }
  }

  useEffect(() => {
    if (!chatEnabled) {
      setChatMessages([]);
      return;
    }
    loadChat();
    const interval = window.setInterval(() => loadChat(true), 5000);
    return () => window.clearInterval(interval);
  }, [chatEnabled, booking.id, apiUrl, token]);

  useEffect(() => {
    const driverCoordinates = booking.driverLocation?.coordinates;
    const pickupCoordinates = booking.pickupLocation?.coordinates;
    if (!showApproachRoute || !driverCoordinates || !pickupCoordinates) {
      setApproachRoute(null);
      return;
    }

    const controller = new AbortController();
    const routeTimer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${apiUrl}/maps/route`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupCoordinates: { longitude: driverCoordinates[0], latitude: driverCoordinates[1] },
            dropoffCoordinates: { longitude: pickupCoordinates[0], latitude: pickupCoordinates[1] }
          }),
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Route failed");
        setApproachRoute({
          geometry: data.geometry || null,
          distanceKm: Number(data.distanceKm || 0),
          durationMinutes: Number(data.durationMinutes || 0)
        });
      } catch (error) {
        if (!controller.signal.aborted) setApproachRoute(null);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(routeTimer);
    };
  }, [
    apiUrl,
    showApproachRoute,
    booking.driverLocation?.coordinates?.[0],
    booking.driverLocation?.coordinates?.[1],
    booking.pickupLocation?.coordinates?.[0],
    booking.pickupLocation?.coordinates?.[1]
  ]);

  async function sendChatMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const text = chatText.trim();
    if (!text || chatStatus === "sending") return;
    setChatStatus("sending");
    try {
      const response = await fetch(`${apiUrl}/bookings/${booking.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Send failed");
      if (data?.id) setChatMessages((items) => [...items.filter((item) => item.id !== data.id), data]);
      setChatText("");
      setChatStatus("idle");
      setChatError("");
    } catch (error) {
      setChatStatus("error");
      setChatError(error instanceof Error ? error.message : "Send failed");
    }
  }

  async function cancelRide() {
    if (!canCancel || cancelStatus === "loading") return;
    const confirmed = window.confirm(copy.cancelRideConfirm);
    if (!confirmed) return;
    setCancelStatus("loading");
    try {
      const response = await fetch(`${apiUrl}/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "CANCELLED" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Cancel failed");
      setBooking((current) => ({ ...current, ...data, status: "CANCELLED" }));
      setCancelStatus("idle");
      setCancelError("");
    } catch (error) {
      setCancelStatus("error");
      setCancelError(error instanceof Error ? error.message : "Cancel failed");
    }
  }

  const statusContent = useMemo(() => {
    if (booking.status === "OFFERED") return { title: copy.waitingForDriver, detail: booking.driver?.name || copy.findingDriverHelp };
    if (booking.status === "CONFIRMED") return { title: copy.driverAccepted, detail: copy.waitingForDriver };
    if (booking.status === "ON_THE_WAY") return { title: copy.driverComing, detail: booking.driver?.vehicleType || "" };
    if (booking.status === "IN_PROGRESS") return { title: copy.tripStarted, detail: `${booking.pickup} → ${booking.dropoff}` };
    if (booking.status === "COMPLETED") return { title: copy.tripCompleted, detail: formatLak(booking.estimatedPriceLak) };
    if (booking.status === "CANCELLED") {
      return {
        title: copy.requestCancelled,
        detail: booking.cancelledBy === "DRIVER"
          ? (booking.cancellationReason || "ຄົນຂັບຍົກເລີກອໍເດີ້ນີ້")
          : (booking.cancellationReason || "")
      };
    }
    return { title: copy.findingDriver, detail: copy.findingDriverHelp };
  }, [booking, copy]);

  const activeIndex = statusOrder.indexOf(booking.status);
  if (!mounted) return null;

  return createPortal(
    <div className="ride-live-backdrop" role="dialog" aria-modal="true" aria-label={copy.liveStatus}>
      <section className="ride-live-sheet">
        <header className="ride-live-header">
          <div>
            <span className={`ride-live-signal ${connected ? "online" : ""}`} />
            <small>{connected ? copy.realtimeConnected : copy.realtimeReconnecting}</small>
          </div>
          {terminalStatus ? (
            <button
              type="button"
              onClick={() => onClose(booking)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          ) : null}
        </header>

        <div className={`ride-search-visual status-${booking.status.toLowerCase()}`}>
          <span className="ride-search-ring ring-one" />
          <span className="ride-search-ring ring-two" />
          <span className="ride-search-ring ring-three" />
          <span className="ride-search-car">
            {booking.status === "COMPLETED" ? <Check size={30} /> : <CarFront size={30} />}
          </span>
        </div>

        <div className="ride-live-title">
          <p className="eyebrow">{copy.liveStatus}</p>
          <h2>{statusContent.title}</h2>
          <p>{statusContent.detail}</p>
        </div>

        {booking.driver ? (
          <article className="ride-driver-card">
            <div className="ride-driver-photo">
              {booking.driver.portraitUrl ? <img src={booking.driver.portraitUrl} alt={booking.driver.name} /> : <CarFront size={24} />}
            </div>
            <div>
              <span>{copy.driver}</span>
              <strong>{booking.driver.name}</strong>
              <small>{booking.driver.vehicleType} · {booking.driver.city} · ★ {driverRating.toFixed(1)}</small>
            </div>
            {booking.driver.verified ? <ShieldCheck size={21} aria-label={copy.verified} /> : null}
          </article>
        ) : null}

        {chatEnabled ? (
          <section className="ride-chat-card">
            <div className="ride-chat-head">
              <strong>{copy.liveChat}</strong>
              {booking.driver?.name ? <small>{booking.driver.name}</small> : null}
            </div>
            <div className="ride-chat-messages">
              {chatMessages.length ? chatMessages.map((message) => (
                <div className={`ride-chat-bubble ${message.senderRole === "USER" ? "mine" : ""}`} key={message.id}>
                  <small>{message.senderName}</small>
                  <span>{message.text}</span>
                </div>
              )) : <p>{copy.noChatMessages}</p>}
            </div>
            <form className="ride-chat-form" onSubmit={sendChatMessage}>
              <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder={copy.typeMessage} />
              <button disabled={chatStatus === "sending" || !chatText.trim()} type="submit"><Send size={17} /></button>
            </form>
            {chatError ? <small className="ride-chat-error">{chatError}</small> : null}
          </section>
        ) : booking.driver ? (
          <div className="ride-chat-locked">{copy.chatAfterAccepted}</div>
        ) : null}

        {booking.driver ? (
          <div className="ride-live-map-card">
            <div className="ride-live-map-head">
              <div>
                <strong>{copy.driverLiveLocation}</strong>
                <small>
                  {booking.driverLocation?.updatedAt
                    ? `${copy.gpsUpdated} ${new Date(booking.driverLocation.updatedAt).toLocaleTimeString()}`
                    : copy.gpsWaiting}
                </small>
              </div>
              {booking.driverLocation?.accuracy ? <span>±{Math.round(booking.driverLocation.accuracy)} m</span> : null}
            </div>
            <RideLiveMap
              pickupLocation={booking.pickupLocation}
              dropoffLocation={booking.dropoffLocation}
              driverLocation={booking.driverLocation}
              routeGeometry={approachRoute?.geometry || booking.routeGeometry}
            />
            {approachRoute?.distanceKm ? (
              <div className="ride-live-approach">
                <span><Route size={15} />{approachRoute.distanceKm} km</span>
                <span><Clock3 size={15} />{approachRoute.durationMinutes || 0} min</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ride-live-route">
          <span><MapPin size={17} /><small>{copy.pickup}</small><strong>{booking.pickup}</strong></span>
          <span><Navigation size={17} /><small>{copy.dropoff}</small><strong>{booking.dropoff}</strong></span>
        </div>

        <div className="ride-live-meta">
          <span><Route size={16} /><small>{copy.routeDistance}</small><strong>{booking.distanceKm || 0} km</strong></span>
          <span><Clock3 size={16} /><small>{copy.routeEta}</small><strong>{booking.durationMinutes || 0} min</strong></span>
          <span><CircleDot size={16} /><small>{copy.price}</small><strong>{formatLak(booking.estimatedPriceLak)}</strong></span>
        </div>

        <ol className="ride-status-timeline">
          {statusOrder.map((status, index) => {
            const done = booking.status !== "CANCELLED" && index <= activeIndex;
            const labels = [copy.findingDriver, copy.driverAccepted, copy.driverComing, copy.tripStarted, copy.tripCompleted];
            return <li className={done ? "done" : ""} key={status}><span>{done ? <Check size={13} /> : null}</span>{labels[index]}</li>;
          })}
        </ol>

        <footer className="ride-live-footer">
          <span><small>{copy.rideRequestId}</small><strong>#{booking.id.slice(0, 8).toUpperCase()}</strong></span>
          {canCancel ? <button className="btn ride-cancel-btn" disabled={cancelStatus === "loading"} onClick={cancelRide} type="button">{cancelStatus === "loading" ? copy.sending : copy.cancelRide}</button> : null}
          {terminalStatus ? <Link className="btn btn-primary" href={`/dashboard?lang=${locale}`}>{copy.viewTripDetails}</Link> : <span className="ride-live-lock">{copy.stayOnTracker}</span>}
        </footer>
        {cancelError ? <p className="ride-chat-error">{cancelError}</p> : null}
      </section>
    </div>,
    document.body
  );
}
