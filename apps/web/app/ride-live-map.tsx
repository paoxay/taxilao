"use client";

import { useEffect, useRef } from "react";
import { CarFront } from "lucide-react";
import { createRoot, Root } from "react-dom/client";
import maplibregl, { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";

type PointLocation = {
  type: "Point";
  coordinates: [number, number];
};

type DriverLocation = PointLocation & {
  accuracy?: number;
  heading?: number;
  speed?: number;
  updatedAt?: string;
};

const mapStyle = "https://tiles.openfreemap.org/styles/liberty";
const fallbackCenter: [number, number] = [102.6331, 17.9757];

function validCoordinates(location?: PointLocation | null): location is PointLocation {
  return Boolean(
    location &&
    Array.isArray(location.coordinates) &&
    Number.isFinite(location.coordinates[0]) &&
    Number.isFinite(location.coordinates[1])
  );
}

function createPointMarker(className: string, label: string) {
  const element = document.createElement("div");
  element.className = `live-map-point ${className}`;
  element.textContent = label;
  return element;
}

export function RideLiveMap({
  pickupLocation,
  dropoffLocation,
  driverLocation,
  routeGeometry
}: {
  pickupLocation?: PointLocation | null;
  dropoffLocation?: PointLocation | null;
  driverLocation?: DriverLocation | null;
  routeGeometry?: { type: "LineString"; coordinates: [number, number][] } | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const driverMarkerRef = useRef<Marker | null>(null);
  const driverRootRef = useRef<Root | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const center = validCoordinates(driverLocation)
      ? driverLocation.coordinates
      : validCoordinates(pickupLocation)
        ? pickupLocation.coordinates
        : fallbackCenter;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center,
      zoom: 14,
      attributionControl: false
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    const markers: Marker[] = [];
    if (validCoordinates(pickupLocation)) {
      markers.push(new maplibregl.Marker({ element: createPointMarker("pickup", "A") }).setLngLat(pickupLocation.coordinates).addTo(map));
    }
    if (validCoordinates(dropoffLocation)) {
      markers.push(new maplibregl.Marker({ element: createPointMarker("dropoff", "B") }).setLngLat(dropoffLocation.coordinates).addTo(map));
    }

    map.on("load", () => {
      if (routeGeometry?.coordinates?.length) {
        map.addSource("ride-route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: routeGeometry }
        });
        map.addLayer({
          id: "ride-route-outline",
          type: "line",
          source: "ride-route",
          paint: { "line-color": "#07130d", "line-width": 7, "line-opacity": 0.55 }
        });
        map.addLayer({
          id: "ride-route",
          type: "line",
          source: "ride-route",
          paint: { "line-color": "#38d67d", "line-width": 4 }
        });
      }

      const bounds = new maplibregl.LngLatBounds();
      if (validCoordinates(pickupLocation)) bounds.extend(pickupLocation.coordinates);
      if (validCoordinates(dropoffLocation)) bounds.extend(dropoffLocation.coordinates);
      if (validCoordinates(driverLocation)) bounds.extend(driverLocation.coordinates);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 58, maxZoom: 16, duration: 0 });
    });

    const resizeTimer = window.setTimeout(() => map.resize(), 100);
    return () => {
      window.clearTimeout(resizeTimer);
      markers.forEach((marker) => marker.remove());
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      driverRootRef.current?.unmount();
      driverRootRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !validCoordinates(driverLocation)) return;

    if (!driverMarkerRef.current) {
      const element = document.createElement("div");
      element.className = "live-driver-marker";
      const root = createRoot(element);
      root.render(<CarFront size={22} />);
      driverRootRef.current = root;
      driverMarkerRef.current = new maplibregl.Marker({
        element,
        rotationAlignment: "map",
        pitchAlignment: "map"
      }).setLngLat(driverLocation.coordinates).addTo(map);
    } else {
      driverMarkerRef.current.setLngLat(driverLocation.coordinates);
    }

    driverMarkerRef.current.setRotation(Number(driverLocation.heading || 0));
    map.easeTo({ center: driverLocation.coordinates, duration: 900, essential: true });
  }, [driverLocation?.coordinates?.[0], driverLocation?.coordinates?.[1], driverLocation?.heading]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !routeGeometry) return;
    const source = map.getSource("ride-route") as GeoJSONSource | undefined;
    source?.setData({ type: "Feature", properties: {}, geometry: routeGeometry });
  }, [routeGeometry]);

  return <div className="ride-live-map" ref={containerRef} />;
}
