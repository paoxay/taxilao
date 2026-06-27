"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { Banknote, Car, Clock3, Gauge, LoaderCircle, LocateFixed, MapPin, MapPinned, Navigation, Route, UserRound, X } from "lucide-react";
import { formatLak } from "@taxilao/shared";
import { getApiUrl } from "./config";
import { formatUi } from "./ui-copy";
import { useUiCopy } from "./use-ui-copy";
import { MemberAuthGate } from "./member-auth-gate";
import { LiveBooking, RideLiveTracker } from "./ride-live-tracker";

const MapLocationPicker = dynamic(
  () => import("./map-location-picker").then((module) => module.MapLocationPicker),
  { ssr: false }
);

type Coordinates = { longitude: number; latitude: number };
type PlaceSuggestion = Coordinates & { id: string; name: string; address: string; kind?: string; provider: string };
type RouteEstimate = {
  provider: string;
  distanceKm: number;
  durationMinutes: number;
  estimatedPriceLak: number;
  meterEstimatedPriceLak: number;
  pricing: {
    meterBaseFareLak: number;
    meterIncludedKm: number;
    meterRatePerKmLak: number;
    meterRatePerMinuteLak: number;
  };
};

type BookingDriver = {
  id: string;
  name: string;
  city: string;
  vehicleType: string;
  premium: boolean;
  ratePerKmLak?: number | null;
  minimumFareLak?: number | null;
};

type BookingTour = {
  id: string;
  title: string;
  city: string;
  duration: string;
  priceLak: number;
  description: string;
  driverId?: string;
};

type LocationFieldProps = {
  apiUrl: string;
  id: string;
  label: string;
  placeholder: string;
  value: string;
  coordinates: Coordinates | null;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  onUseCurrentLocation?: () => void;
  onOpenMap: () => void;
  locating?: boolean;
  searchLabel: string;
  noPlacesLabel: string;
  currentLocationLabel: string;
  mapLabel: string;
  required?: boolean;
};

function LocationField({
  apiUrl,
  id,
  label,
  placeholder,
  value,
  coordinates,
  onChange,
  onSelect,
  onUseCurrentLocation,
  onOpenMap,
  locating,
  searchLabel,
  noPlacesLabel,
  currentLocationLabel,
  mapLabel,
  required = true
}: LocationFieldProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || coordinates || value.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    setHasSearched(false);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${apiUrl}/maps/search?q=${encodeURIComponent(value.trim())}&limit=8`, {
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Search failed");
        setSuggestions(Array.isArray(data) ? data : []);
        setHasSearched(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
          setHasSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiUrl, coordinates, open, value]);

  return (
    <div className="field icon-field location-field">
      <label htmlFor={id}>
        <MapPin size={15} aria-hidden="true" />
        {label}
      </label>
      <div className="location-input-wrap">
        <input
          id={id}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          required={required}
        />
        <div className="location-actions">
          {onUseCurrentLocation ? (
            <button
              type="button"
              title={currentLocationLabel}
              aria-label={currentLocationLabel}
              onClick={onUseCurrentLocation}
              disabled={locating}
            >
              {locating ? <LoaderCircle className="spin" size={18} /> : <LocateFixed size={18} />}
            </button>
          ) : null}
          <button type="button" title={mapLabel} aria-label={mapLabel} onClick={onOpenMap}>
            <MapPinned size={18} />
          </button>
        </div>
      </div>
      {open && !coordinates && value.trim().length >= 2 ? (
        <div className="location-suggestions">
          {searching ? (
            <p><LoaderCircle className="spin" size={16} /> {searchLabel}</p>
          ) : suggestions.length ? (
            suggestions.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  onSelect(place);
                  setOpen(false);
                  fetch(`${apiUrl}/maps/search/select`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: value, placeId: place.id, provider: place.provider })
                  }).catch(() => {});
                }}
              >
                <Navigation size={16} aria-hidden="true" />
                <span><strong>{place.name}</strong><small>{place.address}</small></span>
              </button>
            ))
          ) : hasSearched ? (
            <p>{noPlacesLabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BookingEstimator({
  initialDriverId = "",
  initialTourId = "",
  bookingMode = "taxi"
}: {
  initialDriverId?: string;
  initialTourId?: string;
  bookingMode?: "taxi" | "driver";
}) {
  return (
    <MemberAuthGate>
      <BookingEstimatorForm initialDriverId={initialDriverId} initialTourId={initialTourId} bookingMode={bookingMode} />
    </MemberAuthGate>
  );
}

function BookingEstimatorForm({
  initialDriverId = "",
  initialTourId = "",
  bookingMode = "taxi"
}: {
  initialDriverId?: string;
  initialTourId?: string;
  bookingMode?: "taxi" | "driver";
}) {
  const apiUrl = getApiUrl();
  const { copy } = useUiCopy();
  const [drivers, setDrivers] = useState<BookingDriver[]>([]);
  const [tours, setTours] = useState<BookingTour[]>([]);
  const [driverId, setDriverId] = useState(initialDriverId);
  const [tourId, setTourId] = useState(initialTourId);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [note, setNote] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoordinates, setPickupCoordinates] = useState<Coordinates | null>(null);
  const [dropoffCoordinates, setDropoffCoordinates] = useState<Coordinates | null>(null);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "error">("idle");
  const [routeMessage, setRouteMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [mapPicker, setMapPicker] = useState<"pickup" | "dropoff" | null>(null);
  const [fareMode, setFareMode] = useState<"FIXED" | "METER">("FIXED");
  const [meterTermsAccepted, setMeterTermsAccepted] = useState(false);
  const [showMeterNotice, setShowMeterNotice] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [liveBooking, setLiveBooking] = useState<LiveBooking | null>(null);
  const [liveToken, setLiveToken] = useState("");
  const selectedTour = useMemo(() => tours.find((tour) => tour.id === tourId), [tourId, tours]);
  const selectedDriver = useMemo(() => drivers.find((driver) => driver.id === driverId), [driverId, drivers]);
  const isDriverBooking = bookingMode === "driver";
  const ratePerKmLak = selectedDriver?.ratePerKmLak ?? 15000;
  const minimumFareLak = selectedDriver?.minimumFareLak ?? 50000;

  useEffect(() => {
    fetch(`${apiUrl}/drivers`).then((response) => response.json()).then((data) => setDrivers(Array.isArray(data) ? data : [])).catch(() => setDrivers([]));
    fetch(`${apiUrl}/tours`).then((response) => response.json()).then((data) => setTours(Array.isArray(data) ? data : [])).catch(() => setTours([]));
  }, [apiUrl]);

  useEffect(() => {
    if (!selectedTour) return;
    setPickup(selectedTour.city);
    setDropoff(selectedTour.title);
    setPickupCoordinates(null);
    setDropoffCoordinates(null);
    setRouteEstimate(null);
    setFareMode("FIXED");
    setMeterTermsAccepted(false);
    if (selectedTour.driverId) setDriverId(selectedTour.driverId);
  }, [selectedTour]);

  useEffect(() => {
    if (!isDriverBooking || selectedTour || !driverId) {
      setFareMode("FIXED");
      setMeterTermsAccepted(false);
      setShowMeterNotice(false);
      return;
    }
    setFareMode("METER");
    setMeterTermsAccepted(false);
  }, [driverId, isDriverBooking, selectedTour]);

  useEffect(() => {
    if (isDriverBooking && !selectedTour && driverId && routeEstimate && !meterTermsAccepted) {
      setShowMeterNotice(true);
    }
  }, [driverId, isDriverBooking, meterTermsAccepted, routeEstimate, selectedTour]);

  useEffect(() => {
    if (!showMeterNotice) return;
    document.body.classList.add("meter-notice-open");
    return () => document.body.classList.remove("meter-notice-open");
  }, [showMeterNotice]);

  useEffect(() => {
    if (selectedTour || !pickupCoordinates || !dropoffCoordinates) {
      setRouteEstimate(null);
      return;
    }

    const controller = new AbortController();
    setRouteStatus("loading");
    setRouteMessage("");
    fetch(`${apiUrl}/maps/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickupCoordinates, dropoffCoordinates, driverId: driverId || undefined }),
      signal: controller.signal
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || copy.routeFailed);
        setRouteEstimate(data);
        setRouteStatus("idle");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRouteStatus("error");
        setRouteMessage(error instanceof Error ? error.message : copy.routeFailed);
      });

    return () => controller.abort();
  }, [apiUrl, copy.routeFailed, driverId, dropoffCoordinates, pickupCoordinates, selectedTour]);

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setRouteMessage(copy.locationDenied);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const coordinates = { longitude: coords.longitude, latitude: coords.latitude };
        const response = await fetch(`${apiUrl}/maps/reverse?longitude=${coordinates.longitude}&latitude=${coordinates.latitude}`);
        const place = await response.json();
        if (!response.ok) throw new Error(place.message || copy.locationDenied);
        setPickup(place.address || place.name || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        setPickupCoordinates(coordinates);
        setRouteMessage("");
      } catch (error) {
        setRouteMessage(error instanceof Error ? error.message : copy.locationDenied);
      } finally {
        setLocating(false);
      }
    }, () => {
      setLocating(false);
      setRouteMessage(copy.locationDenied);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDriverBooking && !driverId) {
      setStatus("error");
      setMessage(copy.selectDriver);
      return;
    }
    if (!selectedTour && !pickupCoordinates) {
      setStatus("error");
      setMessage(copy.chooseLocations);
      return;
    }
    if (!selectedTour && !isDriverBooking && (!dropoffCoordinates || !routeEstimate)) {
      setStatus("error");
      setMessage(copy.chooseLocations);
      return;
    }
    if (isDriverBooking && driverId && !meterTermsAccepted) {
      setStatus("error");
      setMessage(copy.meterAccept);
      setShowMeterNotice(true);
      return;
    }
    setStatus("loading");
    setMessage(copy.bookingSending);

    try {
      const memberToken = localStorage.getItem("taxilao_member_access_token");
      const response = await fetch(`${apiUrl}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(memberToken ? { Authorization: `Bearer ${memberToken}` } : {})
        },
        body: JSON.stringify({
          driverId: driverId || undefined,
          tourId: tourId || undefined,
          customerName: customerName.trim() || customerPhone.trim(),
          customerPhone,
          customerWhatsapp,
          customerEmail: customerEmail || (customerPhone.includes("@") ? customerPhone : ""),
          note,
          pickup,
          dropoff,
          pickupCoordinates,
          dropoffCoordinates,
          distanceKm: selectedTour ? undefined : routeEstimate?.distanceKm,
          bookingIntent: isDriverBooking ? "DRIVER_RESERVATION" : "TAXI",
          fareMode,
          meterTermsAccepted: fareMode === "METER" ? meterTermsAccepted : false,
          passengers: 1,
          pickupAt: new Date().toISOString()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || copy.bookingFailed);
      setStatus("success");
      setMessage(`${copy.bookingSuccess}: ${data.id}`);
      setLiveBooking(data);
      setLiveToken(memberToken || "");
      localStorage.setItem("taxilao_last_booking_id", data.id);
      localStorage.setItem("taxilao_last_booking_phone", customerPhone);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : copy.bookingFailed);
    }
  }

  return (
    <form className="booking-panel ride-request-panel" onSubmit={submitBooking}>
      <div className="ride-request-head">
        <p className="eyebrow">{isDriverBooking ? copy.driverReservation : copy.quickBooking}</p>
        <h2>{isDriverBooking ? copy.bookSelectedDriver : copy.callTaxi}</h2>
        <p>{isDriverBooking ? copy.driverReservationLead : copy.noLoginNeeded}</p>
      </div>

      {isDriverBooking ? (
        <div className="selected-driver-summary">
          <span className="selected-driver-icon"><UserRound size={21} /></span>
          {selectedDriver ? (
            <div>
              <small>{copy.driver}</small>
              <strong>{selectedDriver.name}</strong>
              <p><MapPin size={14} /> {selectedDriver.city} <span /> <Car size={14} /> {selectedDriver.vehicleType}</p>
            </div>
          ) : (
            <div>
              <small>{copy.driver}</small>
              <strong>{copy.noDriver}</strong>
            </div>
          )}
        </div>
      ) : null}

      <div className="ride-route-card">
        <LocationField
          apiUrl={apiUrl}
          id="pickup"
          label={copy.pickup}
          placeholder={`${copy.example}: Wattay Airport`}
          value={pickup}
          coordinates={pickupCoordinates}
          onChange={(value) => { setPickup(value); setPickupCoordinates(null); }}
          onSelect={(place) => { setPickup(place.address || place.name); setPickupCoordinates(place); }}
          onUseCurrentLocation={useCurrentLocation}
          onOpenMap={() => setMapPicker("pickup")}
          locating={locating}
          searchLabel={copy.searchPlace}
          noPlacesLabel={copy.noPlaces}
          currentLocationLabel={locating ? copy.locating : copy.useCurrentLocation}
          mapLabel={copy.selectOnMap}
        />
        <LocationField
          apiUrl={apiUrl}
          id="dropoff"
          label={isDriverBooking ? copy.optionalDestination : copy.dropoff}
          placeholder={`${copy.example}: Vientiane Center`}
          value={dropoff}
          coordinates={dropoffCoordinates}
          onChange={(value) => { setDropoff(value); setDropoffCoordinates(null); }}
          onSelect={(place) => { setDropoff(place.address || place.name); setDropoffCoordinates(place); }}
          onOpenMap={() => setMapPicker("dropoff")}
          searchLabel={copy.searchPlace}
          noPlacesLabel={copy.noPlaces}
          currentLocationLabel={copy.useCurrentLocation}
          mapLabel={copy.selectOnMap}
          required={!isDriverBooking}
        />
      </div>

      {!selectedTour && routeStatus === "loading" ? <p className="route-estimate-loading"><LoaderCircle className="spin" size={17} /> {copy.calculatingRoute}</p> : null}
      {!selectedTour && routeEstimate ? (
        <div className="route-estimate">
          <span><Route size={17} /><small>{copy.routeDistance}</small><strong>{routeEstimate.distanceKm} km</strong></span>
          <span><Clock3 size={17} /><small>{copy.routeEta}</small><strong>{routeEstimate.durationMinutes} min</strong></span>
          <span><Banknote size={17} /><small>{fareMode === "METER" ? copy.meterEstimated : copy.routePrice}</small><strong>{formatLak(fareMode === "METER" ? routeEstimate.meterEstimatedPriceLak : routeEstimate.estimatedPriceLak)}</strong></span>
        </div>
      ) : null}
      {isDriverBooking ? (
        <div className="driver-meter-summary">
          <strong><Gauge size={18} /> {copy.driverMeterPricing}</strong>
          <p>{formatUi(copy.meterNoticeText, {
            base: formatLak(routeEstimate?.pricing.meterBaseFareLak ?? 50000),
            included: String(routeEstimate?.pricing.meterIncludedKm ?? 2),
            rate: formatLak(routeEstimate?.pricing.meterRatePerKmLak ?? 15000),
            minute: formatLak(routeEstimate?.pricing.meterRatePerMinuteLak ?? 1000)
          })}</p>
          {routeEstimate ? (
            <button className="meter-summary-action" type="button" onClick={() => setShowMeterNotice(true)}>
              {copy.meterEstimated}: {formatLak(routeEstimate.meterEstimatedPriceLak)}
            </button>
          ) : (
            <label className="meter-accept inline">
              <input type="checkbox" checked={meterTermsAccepted} onChange={(event) => setMeterTermsAccepted(event.target.checked)} />
              {copy.meterAccept}
            </label>
          )}
        </div>
      ) : null}
      {routeMessage ? <p className="route-estimate-error">{routeMessage}</p> : null}

      <div className="ride-quick-grid single">
        <div className="field icon-field">
          <label htmlFor="customerPhone">{copy.contactField}</label>
          <input id="customerPhone" inputMode="text" placeholder="+856 20... / email@example.com" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required />
        </div>
      </div>

      {fareMode === "METER" && routeEstimate ? (
        <div className="meter-detail active-meter-detail">
          <strong><Gauge size={17} /> {copy.meterPrice} · {copy.estimatedLabel} {formatLak(routeEstimate.meterEstimatedPriceLak)}</strong>
          <p>{formatUi(copy.meterNoticeText, {
            base: formatLak(routeEstimate.pricing.meterBaseFareLak),
            included: String(routeEstimate.pricing.meterIncludedKm),
            rate: formatLak(routeEstimate.pricing.meterRatePerKmLak),
            minute: formatLak(routeEstimate.pricing.meterRatePerMinuteLak)
          })}</p>
        </div>
      ) : (
        <div className="meter-detail">
          <strong>{copy.fixedPrice}</strong>
          <p>{formatUi(copy.meterText, { rate: formatLak(ratePerKmLak), minimum: formatLak(minimumFareLak) })}</p>
          <span>{copy.example}: 10 km x {formatLak(ratePerKmLak)} = {formatLak(Math.max(10 * ratePerKmLak, minimumFareLak))}</span>
        </div>
      )}

      <div className="field ride-comment-field">
        <label htmlFor="note">{copy.comment}</label>
        <textarea id="note" placeholder={copy.commentPlaceholder} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>

      <details className="ride-more">
        <summary>{copy.moreSettings}</summary>
        <div className="ride-more-grid">
          <div className="field"><label htmlFor="customerName">{copy.customerName}</label><input id="customerName" placeholder={copy.optional} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div>
          <div className="field"><label htmlFor="customerWhatsapp">WhatsApp</label><input id="customerWhatsapp" inputMode="tel" placeholder="+856 20..." value={customerWhatsapp} onChange={(event) => setCustomerWhatsapp(event.target.value)} /></div>
          <div className="field"><label htmlFor="customerEmail">Email</label><input id="customerEmail" type="email" placeholder="you@example.com" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></div>
          <div className="field">
            <label htmlFor="driverId">{copy.selectDriver}</label>
            <select id="driverId" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
              <option value="">{copy.availableDriver}</option>
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} - {driver.city} - {driver.vehicleType}{driver.premium ? " - Premium" : ""}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tourId">{copy.tourPackage}</label>
            <select id="tourId" value={tourId} onChange={(event) => setTourId(event.target.value)}>
              <option value="">{copy.regularRide}</option>
              {tours.map((tour) => <option key={tour.id} value={tour.id}>{tour.title} - {tour.city} - {formatLak(tour.priceLak)}</option>)}
            </select>
          </div>
        </div>
      </details>

      <button className="btn btn-primary ride-submit" disabled={status === "loading" || routeStatus === "loading"} type="submit">
        {status === "loading" ? copy.sending : (isDriverBooking ? copy.bookSelectedDriver : copy.confirmBooking)}
      </button>
      {message ? <p className={status === "error" ? "form-message error" : "form-message"}>{message}</p> : null}
      {liveBooking && liveToken ? (
        <RideLiveTracker
          apiUrl={apiUrl}
          token={liveToken}
          initialBooking={liveBooking}
          onClose={() => setLiveBooking(null)}
        />
      ) : null}
      <MapLocationPicker
        apiUrl={apiUrl}
        open={mapPicker !== null}
        title={mapPicker === "dropoff" ? copy.dropoff : copy.pickup}
        hint={copy.moveMapHint}
        confirmLabel={copy.confirmLocation}
        locatingLabel={copy.locating}
        initialCoordinates={mapPicker === "dropoff" ? dropoffCoordinates : pickupCoordinates}
        onClose={() => setMapPicker(null)}
        onConfirm={(location) => {
          const value = location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
          if (mapPicker === "dropoff") {
            setDropoff(value);
            setDropoffCoordinates(location);
          } else {
            setPickup(value);
            setPickupCoordinates(location);
          }
          setMapPicker(null);
        }}
      />
      {showMeterNotice && routeEstimate && typeof document !== "undefined" ? createPortal(
        <div className="meter-notice-backdrop" role="dialog" aria-modal="true" aria-label={copy.meterNoticeTitle}>
          <div className="meter-notice">
            <header>
              <span><Gauge size={22} /></span>
              <div><strong>{copy.meterNoticeTitle}</strong><small>{copy.meterEstimated}: {formatLak(routeEstimate.meterEstimatedPriceLak)}</small></div>
              <button type="button" aria-label="Close" onClick={() => setShowMeterNotice(false)}><X size={19} /></button>
            </header>
            <p>{formatUi(copy.meterNoticeText, {
              base: formatLak(routeEstimate.pricing.meterBaseFareLak),
              included: String(routeEstimate.pricing.meterIncludedKm),
              rate: formatLak(routeEstimate.pricing.meterRatePerKmLak),
              minute: formatLak(routeEstimate.pricing.meterRatePerMinuteLak)
            })}</p>
            <div className="meter-rate-grid">
              <span><small>{copy.meterDetails}</small><strong>{formatLak(routeEstimate.pricing.meterBaseFareLak)}</strong></span>
              <span><small>{copy.routeDistance}</small><strong>{formatLak(routeEstimate.pricing.meterRatePerKmLak)} / km</strong></span>
              <span><small>{copy.routeEta}</small><strong>{formatLak(routeEstimate.pricing.meterRatePerMinuteLak)} / min</strong></span>
            </div>
            <label className="meter-accept">
              <input type="checkbox" checked={meterTermsAccepted} onChange={(event) => setMeterTermsAccepted(event.target.checked)} />
              {copy.meterAccept}
            </label>
            <footer>
              <button className="btn" type="button" onClick={() => setShowMeterNotice(false)}>{copy.meterCancel}</button>
              <button className="btn btn-primary" type="button" disabled={!meterTermsAccepted} onClick={() => { setFareMode("METER"); setShowMeterNotice(false); }}>{copy.meterConfirm}</button>
            </footer>
          </div>
        </div>,
        document.body
      ) : null}
    </form>
  );
}
