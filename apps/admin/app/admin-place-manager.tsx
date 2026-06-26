"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Edit, LoaderCircle, Map, MapPin, Plus, Satellite, Save, Search, Star, Trash2, X } from "lucide-react";
import maplibregl, { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";

type Place = {
  id: string;
  name: string;
  nameLo: string;
  nameEn: string;
  aliases: string[];
  address: string;
  category: string;
  province: string;
  district: string;
  village: string;
  longitude: number;
  latitude: number;
  verified: boolean;
  featured: boolean;
  popularity: number;
  active: boolean;
};

type SearchPlace = {
  id: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  provider: string;
};

type Insight = {
  query: string;
  searches: number;
  resultCount: number;
};

type PlaceForm = {
  nameLo: string;
  nameEn: string;
  aliases: string;
  category: string;
  address: string;
  province: string;
  district: string;
  village: string;
  longitude: string;
  latitude: string;
  popularity: string;
  verified: boolean;
  featured: boolean;
  active: boolean;
};

const emptyForm: PlaceForm = {
  nameLo: "",
  nameEn: "",
  aliases: "",
  category: "landmark",
  address: "",
  province: "ນະຄອນຫຼວງວຽງຈັນ",
  district: "",
  village: "",
  longitude: "102.6331",
  latitude: "17.9757",
  popularity: "0",
  verified: true,
  featured: false,
  active: true
};

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

export function AdminPlaceManager({ apiUrl, token }: { apiUrl: string; token: string }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [form, setForm] = useState<PlaceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [placeFilter, setPlaceFilter] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const [mapResults, setMapResults] = useState<SearchPlace[]>([]);
  const [searchingMap, setSearchingMap] = useState(false);
  const [mapMode, setMapMode] = useState<"satellite" | "street">("satellite");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  async function readResponse<T>(response: Response): Promise<T> {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  }

  async function loadPlaces(query = "") {
    setLoading(true);
    try {
      const [placeData, insightData] = await Promise.all([
        fetch(`${apiUrl}/admin/places${query ? `?q=${encodeURIComponent(query)}` : ""}`, { headers, cache: "no-store" }).then(readResponse<Place[]>),
        fetch(`${apiUrl}/admin/places/search-insights`, { headers, cache: "no-store" }).then(readResponse<Insight[]>)
      ]);
      setPlaces(placeData);
      setInsights(insightData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ໂຫຼດສະຖານທີ່ບໍ່ສຳເລັດ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlaces();
  }, []);

  useEffect(() => {
    if (!showForm || !mapContainerRef.current || mapRef.current) return;
    const longitude = Number(form.longitude) || 102.6331;
    const latitude = Number(form.latitude) || 17.9757;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: satelliteMapStyle,
      center: [longitude, latitude],
      zoom: 14,
      attributionControl: false
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.touchZoomRotate.enableRotation();
    markerRef.current = new maplibregl.Marker({ color: "#d7a84a", draggable: true })
      .setLngLat([longitude, latitude])
      .addTo(map);
    markerRef.current.on("dragend", () => {
      const point = markerRef.current?.getLngLat();
      if (point) setCoordinates(point.lng, point.lat);
    });
    map.on("click", (event) => setCoordinates(event.lngLat.lng, event.lngLat.lat));
    window.setTimeout(() => map.resize(), 80);
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [showForm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!showForm || !map) return;
    map.setStyle(mapMode === "satellite" ? satelliteMapStyle : vectorMapStyle);
    if (mapMode === "street") map.once("styledata", () => keepMapLabelsUpright(map));
  }, [mapMode, showForm]);

  function setCoordinates(longitude: number, latitude: number) {
    setForm((current) => ({
      ...current,
      longitude: longitude.toFixed(7),
      latitude: latitude.toFixed(7)
    }));
    markerRef.current?.setLngLat([longitude, latitude]);
    mapRef.current?.easeTo({ center: [longitude, latitude], zoom: Math.max(mapRef.current.getZoom(), 16), duration: 450 });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMapQuery("");
    setMapResults([]);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function editPlace(place: Place) {
    setEditingId(place.id);
    setForm({
      nameLo: place.nameLo,
      nameEn: place.nameEn,
      aliases: place.aliases.join(", "),
      category: place.category,
      address: place.address,
      province: place.province,
      district: place.district,
      village: place.village,
      longitude: String(place.longitude),
      latitude: String(place.latitude),
      popularity: String(place.popularity),
      verified: place.verified,
      featured: place.featured,
      active: place.active
    });
    setShowForm(true);
  }

  async function searchMap(event?: React.SyntheticEvent) {
    event?.preventDefault();
    if (mapQuery.trim().length < 2) return;
    setSearchingMap(true);
    try {
      const results = await fetch(`${apiUrl}/maps/search?q=${encodeURIComponent(mapQuery.trim())}&limit=8`).then(readResponse<SearchPlace[]>);
      setMapResults(results);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ຄົ້ນຫາບໍ່ສຳເລັດ");
    } finally {
      setSearchingMap(false);
    }
  }

  function useSearchResult(place: SearchPlace) {
    setCoordinates(place.longitude, place.latitude);
    setForm((current) => ({
      ...current,
      nameLo: current.nameLo || place.name,
      address: place.address
    }));
    setMapResults([]);
  }

  async function savePlace(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(editingId ? `${apiUrl}/admin/places/${editingId}` : `${apiUrl}/admin/places`, {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({
          ...form,
          aliases: form.aliases.split(",").map((value) => value.trim()).filter(Boolean),
          longitude: Number(form.longitude),
          latitude: Number(form.latitude),
          popularity: Number(form.popularity || 0)
        })
      });
      await readResponse(response);
      setMessage(editingId ? "ແກ້ໄຂສະຖານທີ່ສຳເລັດ" : "ເພີ່ມສະຖານທີ່ສຳເລັດ");
      setShowForm(false);
      resetForm();
      await loadPlaces(placeFilter);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ບັນທຶກບໍ່ສຳເລັດ");
    } finally {
      setLoading(false);
    }
  }

  async function disablePlace(place: Place) {
    if (!window.confirm(`ປິດການໃຊ້ງານ “${place.nameLo || place.nameEn}” ຫຼືບໍ່?`)) return;
    try {
      await fetch(`${apiUrl}/admin/places/${place.id}`, { method: "DELETE", headers }).then(readResponse);
      setMessage("ປິດສະຖານທີ່ແລ້ວ");
      await loadPlaces(placeFilter);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ປິດສະຖານທີ່ບໍ່ສຳເລັດ");
    }
  }

  return (
    <section className="place-manager">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">TAXILAO PLACES</p>
          <h2>ຈັດການສະຖານທີ່</h2>
          <p className="section-lead">ປັກໝຸດບ້ານ, ຮ່ອມ, ຮ້ານ, ໂຮງແຮມ ແລະຈຸດຮັບທີ່ລູກຄ້າຄົ້ນຫາເລື້ອຍ.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={startCreate}><Plus size={17} /> ເພີ່ມສະຖານທີ່</button>
      </div>

      {message ? <p className="admin-message">{message}</p> : null}

      <div className="place-toolbar">
        <form onSubmit={(event) => { event.preventDefault(); loadPlaces(placeFilter); }}>
          <Search size={17} />
          <input value={placeFilter} onChange={(event) => setPlaceFilter(event.target.value)} placeholder="ຄົ້ນຫາຊື່ສະຖານທີ່..." />
          <button className="btn" type="submit">ຄົ້ນຫາ</button>
        </form>
        <span>{places.length} ລາຍການ</span>
      </div>

      {showForm ? (
        <form className="place-editor" onSubmit={savePlace}>
          <div className="place-editor-head">
            <div>
              <strong>{editingId ? "ແກ້ໄຂສະຖານທີ່" : "ເພີ່ມສະຖານທີ່ໃໝ່"}</strong>
              <small>ຄົ້ນຫາຈຸດຕົ້ນສະບັບ ແລ້ວປັບ pin ໃຫ້ກົງກັບຈຸດຮັບຈິງ.</small>
            </div>
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} aria-label="ປິດ"><X size={20} /></button>
          </div>

          <div className="place-editor-layout">
            <div className="place-form-fields">
              <label>ຊື່ພາສາລາວ<input value={form.nameLo} onChange={(event) => setForm({ ...form, nameLo: event.target.value })} required /></label>
              <label>ຊື່ພາສາອັງກິດ<input value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} /></label>
              <label className="full-field">ຊື່ຮຽກອື່ນ ແຍກດ້ວຍ comma<input value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} placeholder="ຕະຫລາດເຊົ້າ, Talat Sao, Morning Market" /></label>
              <label>ປະເພດ
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                  <option value="landmark">ສະຖານທີ່ສຳຄັນ</option>
                  <option value="village">ບ້ານ</option>
                  <option value="alley">ຮ່ອມ</option>
                  <option value="market">ຕະຫຼາດ</option>
                  <option value="hotel">ໂຮງແຮມ</option>
                  <option value="airport">ສະໜາມບິນ</option>
                  <option value="station">ສະຖານີ</option>
                  <option value="hospital">ໂຮງໝໍ</option>
                  <option value="school">ໂຮງຮຽນ</option>
                  <option value="shop">ຮ້ານ/ທຸລະກິດ</option>
                  <option value="pickup">ຈຸດຮັບລົດ</option>
                </select>
              </label>
              <label>ແຂວງ<input value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })} /></label>
              <label>ເມືອງ<input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} /></label>
              <label>ບ້ານ<input value={form.village} onChange={(event) => setForm({ ...form, village: event.target.value })} /></label>
              <label className="full-field">ທີ່ຢູ່<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
              <label>Longitude<input type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} required /></label>
              <label>Latitude<input type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} required /></label>
              <label>ຄະແນນຄວາມນິຍົມ<input type="number" min="0" value={form.popularity} onChange={(event) => setForm({ ...form, popularity: event.target.value })} /></label>
              <div className="place-checks full-field">
                <label><input type="checkbox" checked={form.verified} onChange={(event) => setForm({ ...form, verified: event.target.checked })} /> ຢືນຢັນແລ້ວ</label>
                <label><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> ສະຖານທີ່ແນະນຳ</label>
                <label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> ເປີດໃຊ້ງານ</label>
              </div>
            </div>

            <div className="place-map-panel">
              <div className="place-map-search">
                <Search size={17} />
                <input
                  value={mapQuery}
                  onChange={(event) => setMapQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      searchMap(event);
                    }
                  }}
                  placeholder="ຄົ້ນຫາຈຸດຈາກ OpenStreetMap..."
                />
                <button type="button" onClick={searchMap} disabled={searchingMap}>{searchingMap ? <LoaderCircle className="spin" size={17} /> : "ຊອກ"}</button>
              </div>
              {mapResults.length ? (
                <div className="place-map-results">
                  {mapResults.map((place) => (
                    <button key={`${place.provider}-${place.id}`} type="button" onClick={() => useSearchResult(place)}>
                      <MapPin size={16} /><span><strong>{place.name}</strong><small>{place.address}</small></span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="place-admin-map-wrap">
                <div className="place-admin-map" ref={mapContainerRef} />
                <div className="map-mode-switch admin-map-mode" role="group" aria-label="Map display">
                  <button className={mapMode === "satellite" ? "active" : ""} type="button" onClick={() => setMapMode("satellite")}>
                    <Satellite size={16} /> ດາວທຽມ
                  </button>
                  <button className={mapMode === "street" ? "active" : ""} type="button" onClick={() => setMapMode("street")}>
                    <Map size={16} /> ແຜນທີ່
                  </button>
                </div>
              </div>
              <p className="map-help">ຄລິກໃນແຜນທີ່ ຫຼືລາກ pin ເພື່ອກຳນົດຈຸດຮັບທີ່ແມ່ນຍຳ.</p>
            </div>
          </div>

          <div className="place-editor-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}><Save size={17} /> ບັນທຶກສະຖານທີ່</button>
            <button className="btn" type="button" onClick={resetForm}><Plus size={17} /> ຟອມໃໝ່</button>
          </div>
        </form>
      ) : null}

      <div className="place-content-grid">
        <div className="table-wrap">
          <table className="table compact-table place-table">
            <thead><tr><th>ສະຖານທີ່</th><th>ພື້ນທີ່</th><th>ປະເພດ</th><th>ຄວາມນິຍົມ</th><th>ສະຖານະ</th><th>ຈັດການ</th></tr></thead>
            <tbody>
              {places.map((place) => (
                <tr key={place.id}>
                  <td><strong>{place.nameLo || place.nameEn}</strong><span className="muted-block">{place.nameEn || place.aliases.slice(0, 2).join(", ")}</span></td>
                  <td>{place.village || place.district || place.province || "-"}<span className="muted-block">{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</span></td>
                  <td>{place.category}</td>
                  <td>{place.popularity}</td>
                  <td><div className="status-pills">{place.verified ? <span className="pill ok-pill"><CheckCircle2 size={13} /> ຢືນຢັນ</span> : null}{place.featured ? <span className="pill gold-pill"><Star size={13} /> ແນະນຳ</span> : null}<span className={place.active ? "pill ok-pill" : "pill danger-pill"}>{place.active ? "ເປີດ" : "ປິດ"}</span></div></td>
                  <td className="table-actions"><button className="btn" type="button" onClick={() => editPlace(place)}><Edit size={15} /> ແກ້ໄຂ</button><button className="btn danger" type="button" onClick={() => disablePlace(place)}><Trash2 size={15} /> ປິດ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="search-insights">
          <strong>ຄຳທີ່ລູກຄ້າຄົ້ນຫາ</strong>
          <p>ໃຊ້ລາຍການນີ້ເພື່ອເພີ່ມສະຖານທີ່ທີ່ຂາດ.</p>
          {insights.slice(0, 12).map((insight) => (
            <button key={insight.query} type="button" onClick={() => { startCreate(); setMapQuery(insight.query); }}>
              <span>{insight.query}</span>
              <small>{insight.searches} ຄັ້ງ · {insight.resultCount} ຜົນ</small>
            </button>
          ))}
        </aside>
      </div>
    </section>
  );
}
