"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Crosshair, LoaderCircle, Map, Satellite, X } from "lucide-react";
import maplibregl, { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

type Coordinates = { longitude: number; latitude: number };

type MapLocationPickerProps = {
  apiUrl: string;
  open: boolean;
  title: string;
  hint: string;
  confirmLabel: string;
  locatingLabel: string;
  initialCoordinates: Coordinates | null;
  onClose: () => void;
  onConfirm: (location: Coordinates & { address: string }) => void;
};

const fallbackCenter: [number, number] = [102.6331, 17.9757];

const vectorMapStyle = "https://tiles.openfreemap.org/styles/liberty";
const satelliteMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Tiles &copy; Esri"
    }
  },
  layers: [{ id: "satellite", type: "raster", source: "satellite" }]
};

function keepMapLabelsUpright(map: MapLibreMap) {
  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== "symbol") continue;
    if (map.getLayoutProperty(layer.id, "text-field") !== undefined) {
      map.setLayoutProperty(layer.id, "text-keep-upright", true);
    }
    if (map.getLayoutProperty(layer.id, "icon-image") !== undefined) {
      map.setLayoutProperty(layer.id, "icon-keep-upright", true);
    }
  }
}

export function MapLocationPicker({
  apiUrl,
  open,
  title,
  hint,
  confirmLabel,
  locatingLabel,
  initialCoordinates,
  onClose,
  onConfirm
}: MapLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(initialCoordinates);
  const [address, setAddress] = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [mapMode, setMapMode] = useState<"satellite" | "street">("satellite");

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const center: [number, number] = initialCoordinates
      ? [initialCoordinates.longitude, initialCoordinates.latitude]
      : fallbackCenter;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: satelliteMapStyle,
      center,
      zoom: initialCoordinates ? 17 : 13,
      bearing: 0,
      pitch: 0,
      attributionControl: false
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    const updateCenter = () => {
      const next = map.getCenter();
      setCoordinates({ longitude: next.lng, latitude: next.lat });
    };
    map.on("load", updateCenter);
    map.on("moveend", updateCenter);
    map.on("click", (event) => map.easeTo({ center: event.lngLat, duration: 350 }));

    const resizeTimer = window.setTimeout(() => map.resize(), 80);
    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [initialCoordinates, open]);

  useEffect(() => {
    const map = mapRef.current;
    if (!open || !map) return;
    map.setStyle(mapMode === "satellite" ? satelliteMapStyle : vectorMapStyle);
    if (mapMode === "street") map.once("styledata", () => keepMapLabelsUpright(map));
  }, [mapMode, open]);

  useEffect(() => {
    if (!open || !coordinates) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingAddress(true);
      try {
        const response = await fetch(
          `${apiUrl}/maps/reverse?longitude=${coordinates.longitude}&latitude=${coordinates.latitude}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Reverse geocoding failed");
        setAddress(data.address || data.name || "");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setAddress("");
      } finally {
        setLoadingAddress(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiUrl, coordinates, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.classList.add("map-picker-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("map-picker-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="map-picker-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="map-picker-shell">
        <header className="map-picker-header">
          <div>
            <strong>{title}</strong>
            <small>{hint}</small>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="map-picker-map">
          <div className="map-picker-canvas" ref={containerRef} />
          <div className="map-mode-switch" role="group" aria-label="Map display">
            <button className={mapMode === "satellite" ? "active" : ""} type="button" onClick={() => setMapMode("satellite")}>
              <Satellite size={16} /> ດາວທຽມ
            </button>
            <button className={mapMode === "street" ? "active" : ""} type="button" onClick={() => setMapMode("street")}>
              <Map size={16} /> ແຜນທີ່
            </button>
          </div>
          <div className="map-picker-pin" aria-hidden="true">
            <span><Crosshair size={18} /></span>
          </div>
        </div>

        <footer className="map-picker-footer">
          <div className="map-picker-address">
            {loadingAddress ? <LoaderCircle className="spin" size={17} /> : <Crosshair size={17} />}
            <span>
              <strong>{loadingAddress ? locatingLabel : address || locatingLabel}</strong>
              {coordinates ? (
                <small>{coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</small>
              ) : null}
            </span>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!coordinates || loadingAddress}
            onClick={() => coordinates && onConfirm({ ...coordinates, address })}
          >
            <Check size={18} />
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
