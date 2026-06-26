"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { CarFront, Check, CircleDot, Clock3, MapPin, Navigation, Route, ShieldCheck, X } from "lucide-react";
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
    rating: number;
    premium: boolean;
    verified: boolean;
    portraitUrl?: string;
    vehicleUrl?: string;
  } | null;
};

const statusOrder = ["PENDING", "OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETED"];

export function RideLiveTracker({
  apiUrl,
  token,
  initialBooking,
  onClose
}: {
  apiUrl: string;
  token: string;
  initialBooking: LiveBooking;
  onClose: () => void;
}) {
  const { locale, copy } = useUiCopy();
  const [booking, setBooking] = useState(initialBooking);
  const [connected, setConnected] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
              const nextBooking = JSON.parse(dataLine.slice(6));
              setBooking(nextBooking);
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

  const statusContent = useMemo(() => {
    if (booking.status === "OFFERED") return { title: copy.waitingForDriver, detail: booking.driver?.name || copy.findingDriverHelp };
    if (booking.status === "CONFIRMED") return { title: copy.driverAccepted, detail: copy.waitingForDriver };
    if (booking.status === "ON_THE_WAY") return { title: copy.driverComing, detail: booking.driver?.vehicleType || "" };
    if (booking.status === "IN_PROGRESS") return { title: copy.tripStarted, detail: `${booking.pickup} → ${booking.dropoff}` };
    if (booking.status === "COMPLETED") return { title: copy.tripCompleted, detail: formatLak(booking.estimatedPriceLak) };
    if (booking.status === "CANCELLED") return { title: copy.requestCancelled, detail: "" };
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
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
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
              <small>{booking.driver.vehicleType} · {booking.driver.city} · ★ {booking.driver.rating.toFixed(1)}</small>
            </div>
            {booking.driver.verified ? <ShieldCheck size={21} aria-label={copy.verified} /> : null}
          </article>
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
              routeGeometry={booking.routeGeometry}
            />
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
          <Link className="btn btn-primary" href={`/dashboard?lang=${locale}`}>{copy.viewTripDetails}</Link>
        </footer>
      </section>
    </div>,
    document.body
  );
}
