const path = require("path");
const fs = require("fs");
const dns = require("dns");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

const { randomUUID, scryptSync, timingSafeEqual } = require("crypto");
const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const { MongoClient } = require("mongodb");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");

const app = express();
const port = Number(process.env.API_PORT || 4000);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
const adminOrigin = process.env.ADMIN_ORIGIN || "http://localhost:3001";
const accessSecret = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const adminPassword = process.env.ADMIN_PASSWORD || "taxilao-admin";
const driverPassword = process.env.DRIVER_PASSWORD || "taxilao-driver";
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || `http://localhost:${port}/auth/google/callback`;
const mapboxAccessToken = process.env.MAPBOX_ACCESS_TOKEN || "";
const mapboxConfigured =
  Boolean(mapboxAccessToken) &&
  !/your[-_ ]mapbox|example|changeme|<[^>]+>/i.test(mapboxAccessToken);
const googleOAuthConfigured =
  Boolean(googleClientId && googleClientSecret) &&
  !/your[-_ ]google|example|changeme|<[^>]+>/i.test(`${googleClientId} ${googleClientSecret}`);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taxilao";
const mongoDbName = process.env.MONGODB_DB || "taxilao";
const uploadDir = path.resolve(__dirname, "uploads");
const passwordKeyLength = 64;
const dispatchOfferTimeoutMs = Number(process.env.DISPATCH_OFFER_TIMEOUT_MS || 30000);
const defaultDriverCommissionPercent = 10;
const defaultDriverMinimumBalanceLak = 20000;
const defaultDriverLowBalanceWarningLak = 50000;
const defaultVehicleCategories = [
  {
    id: "vehicle-suv",
    code: "suv",
    name: "SUV",
    nameLo: "ລົດ SUV",
    description: "ລົດສ່ວນຕົວກວ້າງ ເໝາະສຳລັບເດີນທາງໃນເມືອງ ແລະຂ້າມແຂວງ",
    capacity: 4,
    ratePerKmLak: 15000,
    minimumFareLak: 50000,
    sortOrder: 1,
    active: true,
    visibleOnWeb: true,
    default: true
  },
  {
    id: "vehicle-motorbike",
    code: "motorbike",
    name: "Motorbike Taxi",
    nameLo: "ລົດຈັກແທັກຊີ",
    description: "ໄວ ປະຢັດ ເໝາະສຳລັບໄປຄົນດຽວໃນເມືອງ",
    capacity: 1,
    ratePerKmLak: 8000,
    minimumFareLak: 20000,
    sortOrder: 2,
    active: true,
    visibleOnWeb: true,
    default: false
  },
  {
    id: "vehicle-delivery",
    code: "delivery",
    name: "Delivery Rider",
    nameLo: "ລົດຂົນສົ່ງໄລເດີ",
    description: "ສຳລັບຮັບສົ່ງຂອງ ຫຼືພັດສະດຸຂະໜາດນ້ອຍ",
    capacity: 1,
    ratePerKmLak: 10000,
    minimumFareLak: 25000,
    sortOrder: 3,
    active: true,
    visibleOnWeb: true,
    default: false
  }
];
const additionalCorsOrigins = String(process.env.ADDITIONAL_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([webOrigin, adminOrigin, ...additionalCorsOrigins]);
const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

for (const origin of [webOrigin, adminOrigin]) {
  try {
    const parsed = new URL(origin);
    if (!parsed.hostname.startsWith("www.")) {
      parsed.hostname = `www.${parsed.hostname}`;
      allowedOrigins.add(parsed.toString().replace(/\/$/, ""));
    }
  } catch (_error) {
    // Ignore invalid configured origins; CORS will still reject unknown origins.
  }
}

if (mongoUri.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const mongo = new MongoClient(mongoUri, {
  serverSelectionTimeoutMS: 12000,
  connectTimeoutMS: 12000
});
let db;

app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));

const initialDrivers = [
  {
    id: "somchai-vte",
    name: "Somchai Vongdala",
    city: "Vientiane",
    languages: ["Lao", "English", "Thai"],
    vehicleType: "Toyota Alphard",
    rating: 4.96,
    reviewCount: 184,
    startingPriceLak: 180000,
    verified: true,
    premium: true,
    active: true,
    status: "APPROVED",
    routes: ["Wattay Airport", "Vientiane City", "Vang Vieng", "Thai-Lao Friendship Bridge"],
    createdAt: new Date()
  },
  {
    id: "khamla-lpb",
    name: "Khamla Phommachanh",
    city: "Luang Prabang",
    languages: ["Lao", "English", "French"],
    vehicleType: "Hyundai Staria",
    rating: 4.92,
    reviewCount: 126,
    startingPriceLak: 220000,
    verified: true,
    premium: true,
    active: true,
    status: "APPROVED",
    routes: ["Luang Prabang Airport", "Kuang Si Falls", "Pak Ou Caves", "Mekong Sunset"],
    createdAt: new Date()
  },
  {
    id: "anousone-vv",
    name: "Anousone Keomany",
    city: "Vang Vieng",
    languages: ["Lao", "English", "Thai", "Chinese"],
    vehicleType: "Ford Everest",
    rating: 4.88,
    reviewCount: 98,
    startingPriceLak: 250000,
    verified: true,
    premium: false,
    active: true,
    status: "APPROVED",
    routes: ["Blue Lagoon", "Nam Xay Viewpoint", "Vang Vieng Station", "Vientiane Transfer"],
    createdAt: new Date()
  },
  {
    id: "maliny-pakse",
    name: "Maliny Souvannavong",
    city: "Pakse",
    languages: ["Lao", "English", "Thai"],
    vehicleType: "Toyota Fortuner",
    rating: 4.9,
    reviewCount: 74,
    startingPriceLak: 260000,
    verified: true,
    premium: true,
    active: true,
    status: "APPROVED",
    routes: ["Pakse Airport", "Bolaven Plateau", "Wat Phou", "4000 Islands"],
    createdAt: new Date()
  }
];

const initialTours = [
  {
    id: "vientiane-city",
    title: "Vientiane City Signature",
    city: "Vientiane",
    duration: "6 hours",
    priceLak: 850000,
    description: "Patuxai, That Luang, riverside sunset, and premium dinner transfer.",
    driverId: "somchai-vte",
    featuredOnHome: true,
    sortOrder: 1,
    active: true,
    createdAt: new Date()
  },
  {
    id: "vang-vieng-day",
    title: "Vang Vieng Day Trip",
    city: "Vang Vieng",
    duration: "1 day",
    priceLak: 1450000,
    description: "Private SUV transfer, lagoon stops, viewpoint timing, and return to Vientiane.",
    driverId: "anousone-vv",
    featuredOnHome: true,
    sortOrder: 2,
    active: true,
    createdAt: new Date()
  },
  {
    id: "luang-prabang-three",
    title: "Luang Prabang 3 Days",
    city: "Luang Prabang",
    duration: "3 days",
    priceLak: 3900000,
    description: "Airport meet, heritage core, Kuang Si Falls, Pak Ou Caves, and sunset routes.",
    driverId: "khamla-lpb",
    featuredOnHome: true,
    sortOrder: 3,
    active: true,
    createdAt: new Date()
  }
];

const initialManagedPlaces = [
  {
    nameLo: "ປະຕູໄຊ",
    nameEn: "Patuxai",
    aliases: ["ອານຸສາວະລີ", "Patuxay", "Victory Monument"],
    category: "landmark",
    address: "ປະຕູໄຊ, ໂພນໄຊ, ວຽງຈັນ, ນະຄອນຫຼວງວຽງຈັນ",
    province: "ນະຄອນຫຼວງວຽງຈັນ",
    district: "ໄຊເສດຖາ",
    village: "ໂພນໄຊ",
    longitude: 102.6186144,
    latitude: 17.9706337,
    featured: true,
    popularity: 1000
  },
  {
    nameLo: "ສະໜາມບິນສາກົນວັດໄຕ",
    nameEn: "Wattay International Airport",
    aliases: ["ສະໜາມບິນວັດໄຕ", "Wattay Airport", "VTE"],
    category: "airport",
    address: "ສະໜາມບິນສາກົນວັດໄຕ, ວຽງຈັນ",
    province: "ນະຄອນຫຼວງວຽງຈັນ",
    district: "ສີໂຄດຕະບອງ",
    village: "ດົງນາທອງ",
    longitude: 102.5637597,
    latitude: 17.9867796,
    featured: true,
    popularity: 1200
  },
  {
    nameLo: "ບ້ານດົງໂດກ",
    nameEn: "Dongdok Village",
    aliases: ["ດົງໂດກ", "Dong Dok", "Dongdok"],
    category: "village",
    address: "ດົງໂດກ, ເມືອງໄຊທານີ, ນະຄອນຫຼວງວຽງຈັນ",
    province: "ນະຄອນຫຼວງວຽງຈັນ",
    district: "ໄຊທານີ",
    village: "ດົງໂດກ",
    longitude: 102.6351918,
    latitude: 18.0431961,
    featured: false,
    popularity: 700
  }
];

function calculateUrbanPrice(distanceKm, ratePerKm = 15000, minimumFare = 50000) {
  return Math.max(Math.round(Number(distanceKm) * ratePerKm), minimumFare);
}

function calculateMeterPrice(distanceKm, durationMinutes, pricing) {
  const excessDistanceKm = Math.max(0, Number(distanceKm) - Number(pricing.meterIncludedKm));
  return Math.round(
    Number(pricing.meterBaseFareLak) +
    excessDistanceKm * Number(pricing.meterRatePerKmLak) +
    Math.max(0, Number(durationMinutes)) * Number(pricing.meterRatePerMinuteLak)
  );
}

function calculateDriverCommissionLak(amountLak, pricing) {
  const amount = Math.max(0, Number(amountLak || 0));
  const percent = Math.min(100, Math.max(0, Number(pricing.driverCommissionPercent || 0)));
  return Math.round((amount * percent) / 100);
}

function parseCoordinates(value) {
  const longitude = Number(value?.longitude ?? value?.lng);
  const latitude = Number(value?.latitude ?? value?.lat);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return { longitude, latitude };
}

function normalizeDriverUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

function normalizeLoginText(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function hashPassword(password) {
  const salt = randomUUID();
  return {
    passwordSalt: salt,
    passwordHash: scryptSync(String(password), salt, passwordKeyLength).toString("hex")
  };
}

function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  try {
    const candidate = scryptSync(String(password), salt, passwordKeyLength);
    const stored = Buffer.from(String(hash), "hex");
    if (candidate.length !== stored.length) return false;
    return timingSafeEqual(candidate, stored);
  } catch (_error) {
    return false;
  }
}

function distanceKmBetween(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const leftLat = Number(left.latitude);
  const leftLng = Number(left.longitude);
  const rightLat = Number(right.latitude);
  const rightLng = Number(right.longitude);
  if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) return Number.POSITIVE_INFINITY;

  const radiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latDistance = toRadians(rightLat - leftLat);
  const lngDistance = toRadians(rightLng - leftLng);
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(toRadians(leftLat)) *
      Math.cos(toRadians(rightLat)) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function coordinatesFromPoint(point) {
  if (!point?.coordinates || point.coordinates.length < 2) return null;
  return {
    longitude: Number(point.coordinates[0]),
    latitude: Number(point.coordinates[1])
  };
}

function safeReturnPath(value, fallback = "/dashboard") {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n]/.test(path)) return fallback;
  return path.slice(0, 1200);
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `Map service returned ${response.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

const placeSearchCache = new Map();
const placeSearchCacheTtlMs = 10 * 60 * 1000;

function normalizePlaceText(value) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function publicManagedPlace(place) {
  return {
    id: place.id,
    name: place.nameLo || place.nameEn || "",
    nameLo: place.nameLo || "",
    nameEn: place.nameEn || "",
    aliases: Array.isArray(place.aliases) ? place.aliases : [],
    address: place.address || "",
    category: place.category || "place",
    province: place.province || "",
    district: place.district || "",
    village: place.village || "",
    longitude: Number(place.location?.coordinates?.[0]),
    latitude: Number(place.location?.coordinates?.[1]),
    kind: place.category || "place",
    provider: "taxilao",
    verified: place.verified !== false,
    featured: Boolean(place.featured),
    popularity: Number(place.popularity || 0),
    active: place.active !== false,
    createdAt: place.createdAt,
    updatedAt: place.updatedAt
  };
}

async function searchManagedPlaces(query, limit) {
  const normalizedQuery = normalizePlaceText(query);
  if (!normalizedQuery) return [];
  const queryRegex = new RegExp(escapeRegex(normalizedQuery), "i");
  const places = await db.collection("places")
    .find({
      active: { $ne: false },
      $or: [
        { searchNames: queryRegex },
        { searchText: queryRegex }
      ]
    })
    .sort({ verified: -1, featured: -1, popularity: -1, nameLo: 1 })
    .limit(Math.min(30, Math.max(limit * 2, 12)))
    .toArray();

  return places
    .map((place) => {
      const result = publicManagedPlace(place);
      const names = [result.nameLo, result.nameEn, ...result.aliases].map(normalizePlaceText);
      let score = 300 + result.popularity;
      if (names.includes(normalizedQuery)) score += 600;
      else if (names.some((name) => name.startsWith(normalizedQuery))) score += 420;
      else if (names.some((name) => name.includes(normalizedQuery))) score += 260;
      if (result.verified) score += 120;
      if (result.featured) score += 90;
      return { ...result, searchScore: score };
    })
    .sort((left, right) => right.searchScore - left.searchScore);
}

function getLaoPlaceName(place, fallback) {
  return (
    place.namedetails?.["name:lo"] ||
    place.namedetails?.name ||
    place.name ||
    place.address?.village ||
    place.address?.hamlet ||
    place.address?.neighbourhood ||
    fallback
  );
}

function rankNominatimPlace(place, query) {
  const normalizedQuery = normalizePlaceText(query);
  const name = normalizePlaceText(getLaoPlaceName(place, ""));
  const displayName = normalizePlaceText(place.display_name);
  const categoryWeight = {
    place: 90,
    tourism: 82,
    amenity: 80,
    shop: 76,
    leisure: 74,
    office: 70,
    building: 66,
    highway: 42
  };
  let score = Number(categoryWeight[place.category] || 55);
  if (name === normalizedQuery) score += 180;
  else if (name.startsWith(normalizedQuery)) score += 120;
  else if (name.includes(normalizedQuery)) score += 80;
  else if (displayName.includes(normalizedQuery)) score += 35;
  if (["village", "hamlet", "neighbourhood", "suburb", "city", "town"].includes(place.addresstype)) score += 75;
  score += Math.round(Number(place.importance || 0) * 25);
  return score;
}

function buildLaoSearchQueries(query) {
  const clean = String(query || "").normalize("NFC").replace(/\s+/g, " ").trim();
  const queries = [clean];
  const withoutVillagePrefix = clean
    .replace(/^(ບ້ານ|ບ\.|ບ\s+)\s*/u, "")
    .trim();
  if (withoutVillagePrefix && withoutVillagePrefix !== clean) queries.push(withoutVillagePrefix);
  if (/ສະໜາມບິນ/u.test(clean) && !clean.startsWith("ດ່ານຊາຍແດນສາກົນ")) {
    queries.push(`ດ່ານຊາຍແດນສາກົນ${clean}`);
  }
  return [...new Set(queries)];
}

async function searchNominatim(query) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    namedetails: "1",
    extratags: "1",
    "accept-language": "lo,en",
    countrycodes: "la",
    viewbox: "100.08,22.5,107.7,13.8",
    limit: "40"
  });
  const data = await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "TAXILAO.COM/0.1 (local-development)",
      "Accept-Language": "lo,en"
    }
  });
  return Array.isArray(data) ? data : [];
}

function dedupePlaces(places, limit) {
  const seen = new Set();
  const result = [];
  for (const place of places) {
    const longitude = Number(place.longitude);
    const latitude = Number(place.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    const normalizedName = normalizePlaceText(place.name);
    const key = place.kind === "road"
      ? `${normalizedName}:road:${normalizePlaceText(place.area)}`
      : `${normalizedName}:${place.kind || "place"}:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
    if (result.length >= limit) break;
  }
  return result;
}

async function searchPlaces(query, limit = 5) {
  const cacheKey = `${normalizePlaceText(query)}:${limit}:${mapboxConfigured ? "mapbox" : "osm"}`;
  const cached = placeSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < placeSearchCacheTtlMs) return cached.results;
  if (placeSearchCache.size > 500) placeSearchCache.delete(placeSearchCache.keys().next().value);

  const managedPlaces = await searchManagedPlaces(query, limit);
  let providerPlaces = [];

  if (mapboxConfigured) {
    const params = new URLSearchParams({
      access_token: mapboxAccessToken,
      autocomplete: "true",
      country: "la",
      limit: String(Math.min(10, Math.max(limit, 8))),
      language: "lo,en"
    });
    const data = await fetchJson(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&${params}`);
    providerPlaces = (data.features || []).map((feature) => ({
      id: feature.id,
      name: feature.properties?.name || feature.text || query,
      address: feature.properties?.full_address || feature.place_name || feature.properties?.place_formatted || "",
      longitude: Number(feature.geometry?.coordinates?.[0]),
      latitude: Number(feature.geometry?.coordinates?.[1]),
      kind: feature.properties?.feature_type || feature.type || "place",
      provider: "mapbox"
    }));
  } else {
    let data = [];
    for (const searchQuery of buildLaoSearchQueries(query)) {
      data = await searchNominatim(searchQuery);
      if (data.length) break;
    }
    providerPlaces = data
      .sort((left, right) => rankNominatimPlace(right, query) - rankNominatimPlace(left, query))
      .map((place) => ({
        id: `${place.osm_type || "P"}${place.osm_id || place.place_id}`,
        name: getLaoPlaceName(place, query),
        address: place.display_name || "",
        longitude: Number(place.lon),
        latitude: Number(place.lat),
        kind: place.addresstype || place.type || place.category || "place",
        area: place.address?.village || place.address?.suburb || place.address?.city || place.address?.county || "",
        provider: "openstreetmap"
      }));
  }

  const results = dedupePlaces([...managedPlaces, ...providerPlaces], limit);
  placeSearchCache.set(cacheKey, { createdAt: Date.now(), results });
  return results;
}

async function reversePlace(coordinates) {
  if (mapboxConfigured) {
    const params = new URLSearchParams({
      longitude: String(coordinates.longitude),
      latitude: String(coordinates.latitude),
      access_token: mapboxAccessToken,
      language: "lo,en"
    });
    const data = await fetchJson(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`);
    const feature = data.features?.[0];
    return {
      name: feature?.properties?.name || feature?.text || "Current location",
      address: feature?.properties?.full_address || feature?.place_name || feature?.properties?.place_formatted || "",
      ...coordinates,
      provider: "mapbox"
    };
  }

  const params = new URLSearchParams({
    lat: String(coordinates.latitude),
    lon: String(coordinates.longitude),
    format: "jsonv2",
    zoom: "18",
    addressdetails: "1"
  });
  const data = await fetchJson(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { "User-Agent": "TAXILAO.COM/0.1 (local-development)" }
  });
  return {
    name: data.name || String(data.display_name || "").split(",")[0] || "Current location",
    address: data.display_name || "",
    ...coordinates,
    provider: "openstreetmap"
  };
}

async function calculateRoute(pickupCoordinates, dropoffCoordinates, driverId) {
  let route;

  if (mapboxConfigured) {
    const coordinates = `${pickupCoordinates.longitude},${pickupCoordinates.latitude};${dropoffCoordinates.longitude},${dropoffCoordinates.latitude}`;
    const params = new URLSearchParams({
      access_token: mapboxAccessToken,
      geometries: "geojson",
      overview: "full",
      steps: "false"
    });
    const data = await fetchJson(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`);
    const result = data.routes?.[0];
    if (!result) throw new Error("No driving route was found");
    route = {
      provider: "mapbox",
      distanceKm: Number((result.distance / 1000).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(result.duration / 60)),
      geometry: result.geometry
    };
  } else {
    const coordinates = `${pickupCoordinates.longitude},${pickupCoordinates.latitude};${dropoffCoordinates.longitude},${dropoffCoordinates.latitude}`;
    const data = await fetchJson(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`);
    const result = data.routes?.[0];
    if (!result) throw new Error("No driving route was found");
    route = {
      provider: "osrm",
      distanceKm: Number((result.distance / 1000).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(result.duration / 60)),
      geometry: result.geometry
    };
  }

  const vehicleCategory = driverId ? null : await getVehicleCategoryForBooking(vehicleCategoryId);
  return {
    ...route,
    estimatedPriceLak: await calculateBookingPrice(route.distanceKm, driverId, "FIXED", route.durationMinutes, vehicleCategory),
    meterEstimatedPriceLak: await calculateBookingPrice(route.distanceKm, driverId, "METER", route.durationMinutes),
    vehicleCategory: vehicleCategory ? publicVehicleCategory(vehicleCategory) : null,
    pricing: await getPricingSettings()
  };
}

async function getPricingSettings() {
  const pricing = await db.collection("settings").findOne({ id: "pricing" });
  return {
    id: "pricing",
    ratePerKmLak: Number(pricing?.ratePerKmLak || 15000),
    minimumFareLak: Number(pricing?.minimumFareLak || 50000),
    meterBaseFareLak: Number(pricing?.meterBaseFareLak || 50000),
    meterIncludedKm: Number(pricing?.meterIncludedKm || 2),
    meterRatePerKmLak: Number(pricing?.meterRatePerKmLak || 15000),
    meterRatePerMinuteLak: Number(pricing?.meterRatePerMinuteLak || 1000),
    driverCommissionPercent: Number(pricing?.driverCommissionPercent ?? defaultDriverCommissionPercent),
    driverMinimumBalanceLak: Number(pricing?.driverMinimumBalanceLak ?? defaultDriverMinimumBalanceLak),
    driverLowBalanceWarningLak: Number(pricing?.driverLowBalanceWarningLak ?? defaultDriverLowBalanceWarningLak),
    updatedAt: pricing?.updatedAt || null
  };
}

function publicVehicleCategory(category) {
  return {
    id: category.id,
    code: category.code || category.id,
    name: category.name || category.nameLo || "Vehicle",
    nameLo: category.nameLo || category.name || "ລົດ",
    description: category.description || "",
    capacity: Number(category.capacity || 1),
    ratePerKmLak: Number(category.ratePerKmLak || 15000),
    minimumFareLak: Number(category.minimumFareLak || 50000),
    sortOrder: Number(category.sortOrder || 0),
    active: category.active !== false,
    visibleOnWeb: category.visibleOnWeb !== false,
    default: Boolean(category.default),
    createdAt: category.createdAt || null,
    updatedAt: category.updatedAt || null
  };
}

function sanitizeVehicleCategoryPayload(body, existing = null) {
  const code = String(body.code ?? existing?.code ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const name = String(body.name ?? existing?.name ?? "").trim().slice(0, 80);
  const nameLo = String(body.nameLo ?? existing?.nameLo ?? name).trim().slice(0, 80);
  const description = String(body.description ?? existing?.description ?? "").trim().slice(0, 300);
  const capacity = Number(body.capacity ?? existing?.capacity ?? 1);
  const ratePerKmLak = Number(body.ratePerKmLak ?? existing?.ratePerKmLak ?? 15000);
  const minimumFareLak = Number(body.minimumFareLak ?? existing?.minimumFareLak ?? 50000);
  const sortOrder = Number(body.sortOrder ?? existing?.sortOrder ?? 0);

  if (!code || !name || !nameLo) {
    const error = new Error("Vehicle code, name, and Lao name are required");
    error.statusCode = 400;
    throw error;
  }
  if (
    !Number.isFinite(capacity) || capacity < 1 || capacity > 50 ||
    !Number.isFinite(ratePerKmLak) || ratePerKmLak < 1 ||
    !Number.isFinite(minimumFareLak) || minimumFareLak < 1 ||
    !Number.isFinite(sortOrder)
  ) {
    const error = new Error("Vehicle pricing and capacity must be valid numbers");
    error.statusCode = 400;
    throw error;
  }

  return {
    code,
    name,
    nameLo,
    description,
    capacity: Math.round(capacity),
    ratePerKmLak: Math.round(ratePerKmLak),
    minimumFareLak: Math.round(minimumFareLak),
    sortOrder: Math.round(sortOrder),
    active: body.active !== undefined ? body.active !== false : existing?.active !== false,
    visibleOnWeb: body.visibleOnWeb !== undefined ? body.visibleOnWeb !== false : existing?.visibleOnWeb !== false,
    default: Boolean(body.default ?? existing?.default)
  };
}

async function getDefaultVehicleCategory() {
  const category = await db.collection("vehicleCategories").findOne(
    { active: { $ne: false }, visibleOnWeb: { $ne: false } },
    { sort: { default: -1, sortOrder: 1, createdAt: 1 } }
  );
  return category || defaultVehicleCategories[0];
}

async function getVehicleCategoryForBooking(vehicleCategoryId, { fallbackToDefault = true } = {}) {
  const id = String(vehicleCategoryId || "").trim();
  if (id) {
    const category = await db.collection("vehicleCategories").findOne({ id, active: { $ne: false }, visibleOnWeb: { $ne: false } });
    if (category) return category;
    const error = new Error("Vehicle category not found or inactive");
    error.statusCode = 404;
    throw error;
  }
  return fallbackToDefault ? getDefaultVehicleCategory() : null;
}

async function calculateBookingPrice(distanceKm, driverId, fareMode = "FIXED", durationMinutes = 0, vehicleCategory = null) {
  const pricing = await getPricingSettings();
  if (fareMode === "METER") return calculateMeterPrice(distanceKm, durationMinutes, pricing);
  let ratePerKm = pricing.ratePerKmLak;
  let minimumFare = pricing.minimumFareLak;

  if (driverId) {
    const driver = await db.collection("drivers").findOne({ id: String(driverId), active: { $ne: false } });
    if (driver) {
      ratePerKm = Number(driver.ratePerKmLak || ratePerKm);
      minimumFare = Number(driver.minimumFareLak || minimumFare);
    }
  } else if (vehicleCategory) {
    ratePerKm = Number(vehicleCategory.ratePerKmLak || ratePerKm);
    minimumFare = Number(vehicleCategory.minimumFareLak || minimumFare);
  }

  return calculateUrbanPrice(distanceKm, ratePerKm, minimumFare);
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    req.user = jwt.verify(token, accessSecret);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    avatarUrl: user.avatarUrl || "",
    role: user.role,
    status: user.status || "ACTIVE",
    provider: user.provider || "google",
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null
  };
}


function isSuspendedMember(user) {
  return user?.role === "USER" && String(user.status || "ACTIVE").toUpperCase() === "SUSPENDED";
}

async function requireActiveMember(req, res, next) {
  try {
    if (req.user?.role !== "USER") return res.status(403).json({ message: "Member account required" });
    const user = await db.collection("users").findOne({ id: req.user.id, role: "USER" });
    if (!user) return res.status(404).json({ message: "Member account not found" });
    if (isSuspendedMember(user)) return res.status(403).json({ message: "Member account is suspended" });
    req.member = user;
    return next();
  } catch (error) {
    return next(error);
  }
}function publicAdminUser(user) {
  return {
    id: user.id,
    email: user.email || "",
    name: user.name || "",
    avatarUrl: user.avatarUrl || "",
    role: user.role || "USER",
    status: user.status || "ACTIVE",
    provider: user.provider || "google",
    customerRating: Number(user.customerRating || 5),
    customerReviewCount: Number(user.customerReviewCount || 0),
    completedTrips: Number(user.completedTrips || user.completedBookings || 0),
    bookingCount: Number(user.bookingCount || 0),
    activeBookings: Number(user.activeBookings || 0),
    totalSpentLak: Number(user.totalSpentLak || 0),
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null,
    updatedAt: user.updatedAt || null
  };
}
function signMemberTokens(user) {
  const payload = publicUser(user);
  return {
    accessToken: jwt.sign(payload, accessSecret, { expiresIn: "15m" }),
    refreshToken: jwt.sign({ id: user.id, role: user.role }, refreshSecret, { expiresIn: "30d" })
  };
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Admin permission required" });
    }

    return next();
  });
}

function requireDriver(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== "DRIVER") {
      return res.status(403).json({ message: "Driver permission required" });
    }

    return next();
  });
}

function safeMongoLabel(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.username || parsed.password) {
      parsed.username = parsed.username ? "***" : "";
      parsed.password = parsed.password ? "***" : "";
    }
    return parsed.toString();
  } catch (_error) {
    return "configured";
  }
}

function saveImageDataUrl(value, req, folder) {
  if (!value || typeof value !== "string") return "";
  if (!value.startsWith("data:image/")) return value;

  const match = value.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!match) {
    throw new Error("Only PNG, JPG, and WEBP image uploads are supported");
  }

  const extension = match[1].replace("jpeg", "jpg");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("Image upload is too large. Maximum size is 5MB");
  }

  const folderPath = path.join(uploadDir, folder);
  fs.mkdirSync(folderPath, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  fs.writeFileSync(path.join(folderPath, filename), buffer);

  return `${req.protocol}://${req.get("host")}/uploads/${folder}/${filename}`;
}

function saveImageFields(req, fields, folder) {
  const saved = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      saved[field] = saveImageDataUrl(req.body[field], req, folder);
    }
  }
  return saved;
}

function saveChatAttachmentDataUrl(value, req) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:png|jpe?g|webp)|audio\/(?:mpeg|mp3|mp4|wav|webm|ogg));base64,(.+)$/);
  if (!match) {
    const error = new Error("Only PNG, JPG, WEBP, MP3, MP4, WAV, WEBM, and OGG chat uploads are supported");
    error.statusCode = 400;
    throw error;
  }

  const mimeType = match[1].replace("audio/mp3", "audio/mpeg");
  const buffer = Buffer.from(match[2], "base64");
  const isImage = mimeType.startsWith("image/");
  const maxSize = isImage ? 5 * 1024 * 1024 : 8 * 1024 * 1024;
  if (buffer.length > maxSize) {
    const error = new Error(isImage ? "Chat image is too large. Maximum size is 5MB" : "Chat audio is too large. Maximum size is 8MB");
    error.statusCode = 400;
    throw error;
  }

  const extensionByMime = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg"
  };
  const extension = extensionByMime[mimeType] || "bin";
  const folderPath = path.join(uploadDir, "chat");
  fs.mkdirSync(folderPath, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  fs.writeFileSync(path.join(folderPath, filename), buffer);

  return {
    url: `${req.protocol}://${req.get("host")}/uploads/chat/${filename}`,
    mimeType,
    size: buffer.length,
    type: isImage ? "IMAGE" : "AUDIO"
  };
}

async function getAuthorizedChatBooking(req, bookingId, { requireActive = false } = {}) {
  const booking = await db.collection("bookings").findOne({ id: bookingId });
  if (!booking) return null;
  const isOwner = req.user?.role === "USER" && booking.userId === req.user.id;
  const isDriver = req.user?.role === "DRIVER" && booking.driverId === req.user.driverId;
  if (!isOwner && !isDriver) {
    const error = new Error("You do not have access to this booking chat");
    error.statusCode = 403;
    throw error;
  }
  if (requireActive && !["CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"].includes(booking.status)) {
    const error = new Error("Chat opens after the driver accepts the booking");
    error.statusCode = 409;
    throw error;
  }
  return booking;
}

function publicChatMessage(message) {
  return {
    id: message.id,
    bookingId: message.bookingId,
    senderRole: message.senderRole,
    senderName: message.senderName,
    text: message.text || "",
    attachmentUrl: message.attachmentUrl || "",
    attachmentType: message.attachmentType || "",
    attachmentMimeType: message.attachmentMimeType || "",
    createdAt: message.createdAt
  };
}

function normalizeReviewInput(rating, comment) {
  const numericRating = Number(rating);
  const cleanComment = String(comment || "").trim().slice(0, 700);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    const error = new Error("Rating must be between 1 and 5");
    error.statusCode = 400;
    throw error;
  }
  if (!cleanComment) {
    const error = new Error("Review comment is required");
    error.statusCode = 400;
    throw error;
  }
  return { rating: Math.round(numericRating), comment: cleanComment };
}

async function refreshDriverRating(driverId) {
  const stats = await db.collection("reviews").aggregate([
    { $match: { driverId, targetType: "DRIVER", hidden: { $ne: true } } },
    { $group: { _id: "$driverId", average: { $avg: "$rating" }, count: { $sum: 1 } } }
  ]).next();
  await db.collection("drivers").updateOne(
    { id: driverId },
    {
      $set: {
        rating: Number((stats?.average || 0).toFixed(2)),
        reviewCount: Number(stats?.count || 0),
        updatedAt: new Date()
      }
    }
  );
}

async function refreshCustomerRating(userId) {
  const stats = await db.collection("reviews").aggregate([
    { $match: { userId, targetType: "CUSTOMER", hidden: { $ne: true } } },
    { $group: { _id: "$userId", average: { $avg: "$rating" }, count: { $sum: 1 } } }
  ]).next();
  await db.collection("users").updateOne(
    { id: userId },
    {
      $set: {
        customerRating: Number((stats?.average || 5).toFixed(2)),
        customerReviewCount: Number(stats?.count || 0),
        updatedAt: new Date()
      }
    }
  );
}

function publicDriverBooking(booking, driverId) {
  const contactVisible = booking.driverId === driverId && ["CONFIRMED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETED"].includes(booking.status);
  return {
    ...booking,
    customerPhone: contactVisible ? booking.customerPhone || "" : "",
    customerWhatsapp: contactVisible ? booking.customerWhatsapp || "" : "",
    customerEmail: contactVisible ? booking.customerEmail || "" : "",
    note: contactVisible ? booking.note || "" : "",
    customerContactVisible: contactVisible,
    customerDisplay: {
      name: booking.customerName || booking.user?.name || "TAXILAO customer",
      avatarUrl: booking.user?.avatarUrl || "",
      rating: Number(booking.user?.customerRating || 5),
      trips: Number(booking.user?.completedTrips || 0)
    },
    user: undefined,
    payment: undefined
  };
}

async function seedIfEmpty() {
  await db.collection("drivers").createIndex({ id: 1 }, { unique: true });
  await db.collection("drivers").createIndex({ username: 1 }, { unique: true, sparse: true });
  await db.collection("tours").createIndex({ id: 1 }, { unique: true });
  await db.collection("bookings").createIndex({ id: 1 }, { unique: true });
  await db.collection("payments").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("settings").createIndex({ id: 1 }, { unique: true });
  await db.collection("vehicleCategories").createIndex({ id: 1 }, { unique: true });
  await db.collection("vehicleCategories").createIndex({ code: 1 }, { unique: true });
  await db.collection("chatMessages").createIndex({ id: 1 }, { unique: true });
  await db.collection("chatMessages").createIndex({ bookingId: 1, createdAt: 1 });
  await db.collection("driverLedger").createIndex({ id: 1 }, { unique: true });
  await db.collection("driverLedger").createIndex({ driverId: 1, createdAt: -1 });
  await db.collection("driverLedger").createIndex(
    { driverId: 1, bookingId: 1, type: 1 },
    { unique: true, partialFilterExpression: { bookingId: { $type: "string" } } }
  );
  await db.collection("drivers").createIndex({ location: "2dsphere" }, { sparse: true });
  await db.collection("drivers").createIndex({ currentLocation: "2dsphere" }, { sparse: true });
  await db.collection("drivers").createIndex({ "availability.online": 1, "availability.autoAccept": 1, lastLocationAt: -1 });
  await db.collection("bookings").createIndex({ pickupLocation: "2dsphere" }, { sparse: true });
  await db.collection("places").createIndex({ id: 1 }, { unique: true });
  await db.collection("places").createIndex({ location: "2dsphere" });
  await db.collection("places").createIndex({ active: 1, verified: -1, featured: -1, popularity: -1 });
  await db.collection("placeSearchLogs").createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

  await db.collection("settings").updateOne(
    { id: "pricing" },
    {
      $setOnInsert: {
        id: "pricing",
        ratePerKmLak: 15000,
        minimumFareLak: 50000,
        meterBaseFareLak: 50000,
        meterIncludedKm: 2,
        meterRatePerKmLak: 15000,
        meterRatePerMinuteLak: 1000,
        driverCommissionPercent: defaultDriverCommissionPercent,
        driverMinimumBalanceLak: defaultDriverMinimumBalanceLak,
        driverLowBalanceWarningLak: defaultDriverLowBalanceWarningLak,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  const meterPricingDefaults = {
    meterBaseFareLak: 50000,
    meterIncludedKm: 2,
    meterRatePerKmLak: 15000,
    meterRatePerMinuteLak: 1000,
    driverCommissionPercent: defaultDriverCommissionPercent,
    driverMinimumBalanceLak: defaultDriverMinimumBalanceLak,
    driverLowBalanceWarningLak: defaultDriverLowBalanceWarningLak
  };
  for (const [field, value] of Object.entries(meterPricingDefaults)) {
    await db.collection("settings").updateOne(
      { id: "pricing", [field]: { $exists: false } },
      { $set: { [field]: value, updatedAt: new Date() } }
    );
  }

  if ((await db.collection("vehicleCategories").countDocuments()) === 0) {
    await db.collection("vehicleCategories").insertMany(
      defaultVehicleCategories.map((category) => ({ ...category, createdAt: new Date(), updatedAt: new Date() }))
    );
  }

  for (const category of defaultVehicleCategories) {
    await db.collection("vehicleCategories").updateOne(
      { id: category.id },
      {
        $setOnInsert: { ...category, createdAt: new Date() },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
  }

  if ((await db.collection("drivers").countDocuments()) === 0) {
    await db.collection("drivers").insertMany(initialDrivers);
  }

  await db.collection("drivers").updateMany(
    { availability: { $exists: false } },
    {
      $set: {
        availability: {
          online: false,
          autoAccept: false,
          updatedAt: new Date(),
          lastSeenAt: null
        }
      }
    }
  );
  await db.collection("drivers").updateMany(
    { walletBalanceLak: { $exists: false } },
    { $set: { walletBalanceLak: 0, walletUpdatedAt: new Date() } }
  );
  const driversWithoutUsername = await db.collection("drivers")
    .find({ username: { $exists: false } })
    .project({ id: 1 })
    .toArray();
  for (const driver of driversWithoutUsername) {
    await db.collection("drivers").updateOne(
      { id: driver.id, username: { $exists: false } },
      { $set: { username: normalizeDriverUsername(driver.id), updatedAt: new Date() } }
    );
  }

  if ((await db.collection("tours").countDocuments()) === 0) {
    await db.collection("tours").insertMany(initialTours);
  }

  if ((await db.collection("places").countDocuments()) === 0) {
    const now = new Date();
    await db.collection("places").insertMany(initialManagedPlaces.map((place) => {
      const { longitude, latitude, ...details } = place;
      const searchNames = [place.nameLo, place.nameEn, ...place.aliases].map(normalizePlaceText);
      return {
        id: randomUUID(),
        ...details,
        location: { type: "Point", coordinates: [longitude, latitude] },
        searchNames,
        searchText: normalizePlaceText([
          ...searchNames,
          place.address,
          place.province,
          place.district,
          place.village
        ].join(" ")),
        verified: true,
        active: true,
        createdAt: now,
        updatedAt: now
      };
    }));
  }

  await db.collection("tours").updateMany(
    { featuredOnHome: { $exists: false } },
    { $set: { featuredOnHome: true } }
  );
  await db.collection("tours").updateMany(
    { sortOrder: { $exists: false } },
    { $set: { sortOrder: 0 } }
  );

  await db.collection("users").updateOne(
    { email: "guest@taxilao.local" },
    { $setOnInsert: { id: "guest", email: "guest@taxilao.local", name: "Guest Traveler", role: "USER", createdAt: new Date() } },
    { upsert: true }
  );

  await db.collection("users").updateOne(
    { email: "admin@taxilao.com" },
    { $setOnInsert: { id: "admin", email: "admin@taxilao.com", name: "TAXILAO Admin", role: "SUPER_ADMIN", createdAt: new Date() } },
    { upsert: true }
  );
}

function publicDriver(driver) {
  const walletBalanceLak = Number(driver.walletBalanceLak || 0);
  const lowBalanceWarningLak = Number(driver.walletLowBalanceWarningLak ?? defaultDriverLowBalanceWarningLak);
  return {
    id: driver.id,
    name: driver.name,
    city: driver.city,
    languages: driver.languages || [],
    vehicleType: driver.vehicleType || "Premium Vehicle",
    rating: Number(driver.rating || 0),
    reviewCount: Number(driver.reviewCount || 0),
    startingPriceLak: Number(driver.startingPriceLak || 50000),
    ratePerKmLak: driver.ratePerKmLak !== undefined ? Number(driver.ratePerKmLak) : null,
    minimumFareLak: driver.minimumFareLak !== undefined ? Number(driver.minimumFareLak) : null,
    verified: Boolean(driver.verified),
    premium: Boolean(driver.premium),
    active: driver.active !== false,
    routes: driver.routes || [],
    bio: driver.bio || "",
    coverUrl: driver.coverUrl || "",
    portraitUrl: driver.portraitUrl || "",
    vehicleUrl: driver.vehicleUrl || "",
    status: driver.status || (driver.verified ? "APPROVED" : "PENDING_REVIEW"),
    username: driver.username || driver.id,
    hasPassword: Boolean(driver.passwordHash && driver.passwordSalt),
    walletBalanceLak,
    walletLowBalanceWarningLak: lowBalanceWarningLak,
    walletLowBalance: walletBalanceLak <= lowBalanceWarningLak,
    availability: {
      online: Boolean(driver.availability?.online),
      autoAccept: Boolean(driver.availability?.autoAccept),
      lastSeenAt: driver.availability?.lastSeenAt || null
    },
    currentLocation: driver.currentLocation || null,
    createdAt: driver.createdAt
  };
}

const bookingSubscribers = new Map();

async function getDriverCommissionForBooking(booking) {
  const pricing = await getPricingSettings();
  const fare = Number(booking.finalPriceLak || booking.estimatedPriceLak || 0);
  return calculateDriverCommissionLak(fare, pricing);
}

async function assertDriverCanAcceptBooking(driverId, booking) {
  const [driver, pricing] = await Promise.all([
    db.collection("drivers").findOne({ id: driverId, active: { $ne: false } }),
    getPricingSettings()
  ]);
  if (!driver) {
    const error = new Error("Driver not found");
    error.statusCode = 404;
    throw error;
  }

  const requiredCommissionLak = calculateDriverCommissionLak(booking.estimatedPriceLak, pricing);
  const minimumBalanceLak = Math.max(Number(pricing.driverMinimumBalanceLak || 0), requiredCommissionLak);
  const walletBalanceLak = Number(driver.walletBalanceLak || 0);
  if (walletBalanceLak < minimumBalanceLak) {
    const error = new Error("ຍອດເງິນບໍ່ພໍຮັບອໍເດີ້ນີ້");
    error.statusCode = 402;
    error.details = { walletBalanceLak, minimumBalanceLak, requiredCommissionLak };
    throw error;
  }

  return { driver, pricing, walletBalanceLak, minimumBalanceLak, requiredCommissionLak };
}

async function adjustDriverWallet({ driverId, amountLak, type, note, actorId, bookingId = null, metadata = {} }) {
  const amount = Math.round(Number(String(amountLak || 0).replace(/[,\s]/g, "")));
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Wallet amount must be greater than zero");
    error.statusCode = 400;
    throw error;
  }

  const signedAmount = ["ADMIN_DEBIT", "COMMISSION_DEBIT"].includes(type) ? -amount : amount;
  const now = new Date();
  const driverFilter = ["ADMIN_CREDIT", "ADMIN_DEBIT"].includes(type) ? { id: driverId } : { id: driverId, active: { $ne: false } };
  if (signedAmount < 0) driverFilter.walletBalanceLak = { $gte: amount };

  const walletUpdateResult = await db.collection("drivers").findOneAndUpdate(
    driverFilter,
    {
      $inc: { walletBalanceLak: signedAmount },
      $set: { walletUpdatedAt: now, updatedAt: now }
    },
    { returnDocument: "after" }
  );
  const driver = walletUpdateResult?.value || walletUpdateResult;
  if (!driver) {
    const existingDriver = await db.collection("drivers").findOne({ id: driverId });
    const error = new Error(existingDriver ? "Driver wallet balance is not enough" : "Driver not found");
    error.statusCode = existingDriver ? 402 : 404;
    throw error;
  }

  const ledger = {
    id: randomUUID(),
    driverId,
    bookingId,
    type,
    amountLak: amount,
    signedAmountLak: signedAmount,
    balanceAfterLak: Number(driver.walletBalanceLak || 0),
    note: note || "Manual wallet adjustment",
    actorId,
    metadata,
    createdAt: now
  };
  await db.collection("driverLedger").insertOne(ledger);
  await db.collection("adminLogs").insertOne({
    id: randomUUID(),
    action: `DRIVER_WALLET_${type}`,
    targetId: driverId,
    actorId,
    metadata: { amountLak: amount, signedAmountLak: signedAmount, bookingId, note: ledger.note },
    createdAt: now
  });

  return { driver, ledger };
}

async function debitDriverCommissionOnce(booking, actorId) {
  if (!booking?.driverId) return null;
  const existing = await db.collection("driverLedger").findOne({
    driverId: booking.driverId,
    bookingId: booking.id,
    type: "COMMISSION_DEBIT"
  });
  if (existing) return existing;

  const commissionLak = await getDriverCommissionForBooking(booking);
  if (commissionLak <= 0) return null;
  const { ledger } = await adjustDriverWallet({
    driverId: booking.driverId,
    amountLak: commissionLak,
    type: "COMMISSION_DEBIT",
    note: "Order commission",
    actorId,
    bookingId: booking.id,
    metadata: {
      bookingType: booking.bookingType,
      fareMode: booking.fareMode,
      estimatedPriceLak: booking.estimatedPriceLak,
      finalPriceLak: booking.finalPriceLak || null
    }
  });
  return ledger;
}

async function expireDispatchOffers() {
  const now = new Date();
  const expired = await db.collection("bookings")
    .find({
      status: "OFFERED",
      dispatchExpiresAt: { $lte: now }
    })
    .project({ id: 1, driverId: 1 })
    .toArray();

  for (const booking of expired) {
    await db.collection("bookings").updateOne(
      { id: booking.id, status: "OFFERED", dispatchExpiresAt: { $lte: now } },
      {
        $set: {
          status: "PENDING",
          driverId: null,
          dispatchExpiredAt: now,
          updatedAt: now
        },
        $addToSet: { dispatchAttemptedDriverIds: booking.driverId }
      }
    );
    await emitBookingUpdate(booking.id);
    await autoDispatchBooking(booking.id);
  }
}

async function autoDispatchBooking(bookingId) {
  await expireDispatchOffers();
  const booking = await db.collection("bookings").findOne({
    id: bookingId,
    bookingType: "RIDE",
    driverId: null,
    status: "PENDING"
  });
  if (!booking?.pickupLocation) return null;

  const pickupCoordinates = coordinatesFromPoint(booking.pickupLocation);
  if (!pickupCoordinates) return null;

  const activeDriverIds = await db.collection("bookings")
    .distinct("driverId", {
      driverId: { $ne: null },
      status: { $in: ["OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"] }
    });
  const attemptedDriverIds = Array.isArray(booking.dispatchAttemptedDriverIds) ? booking.dispatchAttemptedDriverIds : [];
  const pricing = await getPricingSettings();
  const requiredCommissionLak = calculateDriverCommissionLak(booking.estimatedPriceLak, pricing);
  const minimumBalanceLak = Math.max(Number(pricing.driverMinimumBalanceLak || 0), requiredCommissionLak);

  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const candidates = await db.collection("drivers")
    .find({
      active: { $ne: false },
      verified: true,
      $or: [
        { status: "APPROVED" },
        { status: { $exists: false } },
        { status: null }
      ],
      "availability.online": true,
      "availability.autoAccept": true,
      lastLocationAt: { $gte: cutoff },
      currentLocation: { $ne: null },
      walletBalanceLak: { $gte: minimumBalanceLak },
      id: { $nin: [...activeDriverIds, ...attemptedDriverIds].filter(Boolean) }
    })
    .toArray();

  const ranked = candidates
    .map((driver) => {
      const driverCoordinates = coordinatesFromPoint(driver.currentLocation);
      return {
        driver,
        distanceKm: distanceKmBetween(pickupCoordinates, driverCoordinates)
      };
    })
    .filter((item) => Number.isFinite(item.distanceKm))
    .sort((left, right) => left.distanceKm - right.distanceKm);

  const selected = ranked[0];
  if (!selected) return null;

  const now = new Date();
  const dispatchExpiresAt = new Date(now.getTime() + dispatchOfferTimeoutMs);
  const result = await db.collection("bookings").updateOne(
    { id: booking.id, bookingType: "RIDE", driverId: null, status: "PENDING" },
    {
      $set: {
        driverId: selected.driver.id,
        status: "OFFERED",
        dispatchMode: "AUTO",
        dispatchDistanceKm: Number(selected.distanceKm.toFixed(2)),
        offeredAt: now,
        dispatchExpiresAt,
        updatedAt: now
      }
    }
  );

  if (result.modifiedCount === 0) return null;
  await db.collection("adminLogs").insertOne({
    id: randomUUID(),
    action: "BOOKING_AUTO_DISPATCHED",
    targetId: booking.id,
    actorId: selected.driver.id,
    metadata: {
      driverId: selected.driver.id,
      dispatchDistanceKm: Number(selected.distanceKm.toFixed(2))
    },
    createdAt: now
  });
  await emitBookingUpdate(booking.id);
  return db.collection("bookings").findOne({ id: booking.id });
}

async function getBookingLiveView(bookingId, userId = null) {
  const match = { id: bookingId };
  if (userId) match.userId = userId;

  return db.collection("bookings").aggregate([
    { $match: match },
    {
      $lookup: {
        from: "drivers",
        localField: "driverId",
        foreignField: "id",
        as: "driver"
      }
    },
    { $addFields: { driver: { $first: "$driver" } } },
    {
      $lookup: {
        from: "payments",
        localField: "id",
        foreignField: "bookingId",
        as: "payment"
      }
    },
    { $addFields: { payment: { $first: "$payment" } } },
    {
      $project: {
        _id: 0,
        id: 1,
        userId: 1,
        bookingType: 1,
        pickup: 1,
        dropoff: 1,
        pickupLocation: 1,
        dropoffLocation: 1,
        routeGeometry: 1,
        pickupAt: 1,
        distanceKm: 1,
        durationMinutes: 1,
        status: 1,
        estimatedPriceLak: 1,
        vehicleCategoryId: 1,
        vehicleCategoryName: 1,
        vehicleCategorySnapshot: 1,
        createdAt: 1,
        updatedAt: 1,
        acceptedAt: 1,
        onTheWayAt: 1,
        startedAt: 1,
        completedAt: 1,
        cancelledAt: 1,
        cancelledBy: 1,
        cancellationReason: 1,
        driverLocation: 1,
        "driver.id": 1,
        "driver.name": 1,
        "driver.city": 1,
        "driver.vehicleType": 1,
        "driver.rating": 1,
        "driver.premium": 1,
        "driver.verified": 1,
        "driver.portraitUrl": 1,
        "driver.vehicleUrl": 1,
        "payment.amountLak": 1,
        "payment.currency": 1,
        "payment.method": 1,
        "payment.status": 1
      }
    }
  ]).next();
}

function writeBookingEvent(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function emitBookingUpdate(bookingId) {
  const subscribers = bookingSubscribers.get(bookingId);
  if (!subscribers?.size) return;
  const booking = await getBookingLiveView(bookingId);
  if (!booking) return;
  for (const response of subscribers) {
    writeBookingEvent(response, "booking", booking);
  }
}

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || localhostOriginPattern.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true
}));
app.use("/uploads", express.static(uploadDir));
app.use(express.json({ limit: "20mb" }));
app.use(passport.initialize());

if (googleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = String(profile.emails?.[0]?.value || "").trim().toLowerCase();
          if (!email) return done(new Error("Google account did not provide an email address"));

          const existing = await db.collection("users").findOne({
            $or: [{ googleId: profile.id }, { email }]
          });

          if (existing && existing.role !== "USER") {
            return done(new Error("This email belongs to a staff account and cannot use member login"));
          }

          const user = {
            id: existing?.id || randomUUID(),
            googleId: profile.id,
            email,
            name: profile.displayName || existing?.name || email.split("@")[0],
            avatarUrl: profile.photos?.[0]?.value || existing?.avatarUrl || "",
            role: "USER",
            provider: "google",
            emailVerified: true,
            lastLoginAt: new Date(),
            updatedAt: new Date()
          };

          await db.collection("users").updateOne(
            { id: user.id },
            { $set: user, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
          );

          return done(null, publicUser(user));
        } catch (error) {
          return done(error);
        }
      }
    )
  );
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const bookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });
const lookupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40 });
const mapsLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60 });
const driverReadLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120 });
const driverWriteLimiter = rateLimit({ windowMs: 60 * 1000, limit: 90 });
const driverLocationLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60 });
const chatReadLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120 });
const chatWriteLimiter = rateLimit({ windowMs: 60 * 1000, limit: 40 });
const bookingStatuses = ["PENDING", "OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const paymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const paymentMethods = ["CASH", "BANK_QR", "CARD", "USDT_TRC20", "USDT_BEP20"];

app.get("/health", async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({
      ok: true,
      database: "mongodb",
      dbName: mongoDbName,
      service: "taxilao-api",
      runtime: "node app.js",
      mapsProvider: mapboxConfigured ? "mapbox" : "openstreetmap-osrm"
    });
  } catch (error) {
    res.status(503).json({ ok: false, database: "unavailable", message: error.message });
  }
});

app.get("/maps/search", mapsLimiter, async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    if (query.length < 2) return res.json([]);
    const results = await searchPlaces(query, Math.min(8, Math.max(1, Number(req.query.limit) || 5)));
    db.collection("placeSearchLogs").insertOne({
      id: randomUUID(),
      query,
      normalizedQuery: normalizePlaceText(query),
      resultCount: results.length,
      createdAt: new Date()
    }).catch(() => {});
    res.json(results);
  } catch (error) {
    next(error);
  }
});

app.post("/maps/search/select", mapsLimiter, async (req, res, next) => {
  try {
    const placeId = String(req.body.placeId || "");
    const provider = String(req.body.provider || "");
    if (!placeId) return res.status(400).json({ message: "Place ID is required" });
    if (provider === "taxilao") {
      await db.collection("places").updateOne(
        { id: placeId },
        { $inc: { popularity: 1 }, $set: { lastSelectedAt: new Date(), updatedAt: new Date() } }
      );
    }
    await db.collection("placeSearchLogs").insertOne({
      id: randomUUID(),
      query: String(req.body.query || ""),
      normalizedQuery: normalizePlaceText(req.body.query),
      selectedPlaceId: placeId,
      provider,
      selected: true,
      createdAt: new Date()
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/maps/reverse", mapsLimiter, async (req, res, next) => {
  try {
    const coordinates = parseCoordinates(req.query);
    if (!coordinates) return res.status(400).json({ message: "Valid longitude and latitude are required" });
    res.json(await reversePlace(coordinates));
  } catch (error) {
    next(error);
  }
});

app.get("/vehicle-categories", async (_req, res, next) => {
  try {
    const categories = await db.collection("vehicleCategories")
      .find({ active: { $ne: false }, visibleOnWeb: { $ne: false } })
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray();
    res.json(categories.map(publicVehicleCategory));
  } catch (error) {
    next(error);
  }
});
app.post("/maps/route", mapsLimiter, async (req, res, next) => {
  try {
    const pickupCoordinates = parseCoordinates(req.body.pickupCoordinates);
    const dropoffCoordinates = parseCoordinates(req.body.dropoffCoordinates);
    if (!pickupCoordinates || !dropoffCoordinates) {
      return res.status(400).json({ message: "Valid pickup and destination coordinates are required" });
    }

    res.json(await calculateRoute(pickupCoordinates, dropoffCoordinates, req.body.driverId || null, req.body.vehicleCategoryId || null));
  } catch (error) {
    next(error);
  }
});

app.get("/auth/google", loginLimiter, (req, res, next) => {
  if (!googleOAuthConfigured) {
    return res.redirect(`${webOrigin}/login?error=google_not_configured`);
  }

  const state = jwt.sign({
    purpose: "google-member-login",
    returnTo: safeReturnPath(req.query.returnTo)
  }, accessSecret, { expiresIn: "10m" });
  return passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state,
    prompt: "select_account"
  })(req, res, next);
});

app.get(
  "/auth/google/callback",
  loginLimiter,
  (req, res, next) => {
    try {
      const state = jwt.verify(String(req.query.state || ""), accessSecret);
      if (state.purpose !== "google-member-login") throw new Error("Invalid OAuth state");
      req.oauthState = state;
      return next();
    } catch {
      return res.redirect(`${webOrigin}/login?error=invalid_state`);
    }
  },
  (req, res, next) => {
    passport.authenticate("google", { session: false }, (error, user) => {
      if (error || !user) {
        console.error("Google login failed:", error?.message || "No user returned");
        return res.redirect(`${webOrigin}/login?error=google_login_failed`);
      }

      if (isSuspendedMember(user)) return res.redirect(`${webOrigin}/login?error=account_suspended`);
      const { accessToken, refreshToken } = signMemberTokens(user);
      const fragment = new URLSearchParams({
        accessToken,
        refreshToken,
        returnTo: safeReturnPath(req.oauthState?.returnTo)
      }).toString();
      return res.redirect(`${webOrigin}/auth/callback#${fragment}`);
    })(req, res, next);
  }
);

app.get("/auth/me", authenticate, requireActiveMember, async (req, res, next) => {
  try {
    return res.json(publicUser(req.member));
  } catch (error) {
    return next(error);
  }
});

app.post("/auth/refresh", loginLimiter, async (req, res, next) => {
  try {
    const refreshToken = String(req.body.refreshToken || "");
    if (!refreshToken) return res.status(400).json({ message: "Refresh token is required" });

    const payload = jwt.verify(refreshToken, refreshSecret);
    const user = await db.collection("users").findOne({ id: payload.id, role: "USER" });
    if (!user) return res.status(401).json({ message: "Member account not found" });
    if (isSuspendedMember(user)) return res.status(403).json({ message: "Member account is suspended" });

    return res.json(signMemberTokens(user));
  } catch (error) {
    if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Refresh token is invalid or expired" });
    }
    return next(error);
  }
});

app.post("/admin/login", loginLimiter, async (req, res, next) => {
  try {
    const password = req.body.password;

    if (!password || password !== adminPassword) {
      return res.status(401).json({ message: "Invalid admin password" });
    }

    const admin = {
      id: "admin",
      email: "admin@taxilao.com",
      name: "TAXILAO Admin",
      role: "SUPER_ADMIN"
    };

    await db.collection("users").updateOne(
      { id: admin.id },
      { $set: { ...admin, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    const token = jwt.sign(admin, accessSecret, { expiresIn: "12h" });
    res.json({ token, user: admin });
  } catch (error) {
    next(error);
  }
});

app.post("/driver/login", loginLimiter, async (req, res, next) => {
  try {
    const rawLogin = String(req.body.username ?? req.body.driverId ?? "").trim();
    const username = normalizeDriverUsername(rawLogin);
    const password = String(req.body.password || "");

    if (!rawLogin || !password) {
      return res.status(401).json({ message: "ກະລຸນາໃສ່ຊື່ຜູ້ຂັບ ແລະ ລະຫັດຜ່ານ" });
    }

    let driver = username
      ? await db.collection("drivers").findOne({
          active: { $ne: false },
          $or: [
            { username },
            { id: username }
          ]
        })
      : null;

    if (!driver) {
      const loginName = normalizeLoginText(rawLogin);
      const possibleDrivers = await db.collection("drivers")
        .find({ active: { $ne: false } })
        .project({ _id: 0 })
        .toArray();
      driver = possibleDrivers.find((item) => normalizeLoginText(item.name) === loginName) || null;
    }

    if (!driver) return res.status(404).json({ message: "ບໍ່ພົບຜູ້ຂັບນີ້ ຫຼື ບັນຊີຖືກປິດ" });
    const passwordOk = verifyPassword(password, driver.passwordSalt, driver.passwordHash) ||
      (!driver.passwordHash && password === driverPassword);
    if (!passwordOk) return res.status(401).json({ message: "ລະຫັດຜ່ານຜູ້ຂັບບໍ່ຖືກຕ້ອງ" });

    const user = {
      id: driver.id,
      driverId: driver.id,
      email: `${driver.id}@drivers.taxilao.local`,
      name: driver.name,
      role: "DRIVER"
    };

    await db.collection("users").updateOne(
      { id: user.id },
      { $set: { ...user, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    const token = jwt.sign(user, accessSecret, { expiresIn: "12h" });
    res.json({ token, driver: publicDriver(driver) });
  } catch (error) {
    next(error);
  }
});

app.get("/driver/me", requireDriver, async (req, res, next) => {
  try {
    const driver = await db.collection("drivers").findOne({ id: req.user.driverId, active: { $ne: false } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json(publicDriver(driver));
  } catch (error) {
    next(error);
  }
});

app.get("/drivers", async (req, res, next) => {
  try {
    const query = { active: { $ne: false } };
    if (req.query.city) query.city = String(req.query.city);
    if (req.query.language) query.languages = String(req.query.language);
    if (req.query.premium !== undefined) query.premium = req.query.premium === "true";

    const drivers = await db.collection("drivers").find(query).sort({ premium: -1, rating: -1 }).toArray();
    res.json(drivers.map(publicDriver));
  } catch (error) {
    next(error);
  }
});

app.get("/drivers/:id", async (req, res, next) => {
  try {
    const driver = await db.collection("drivers").findOne({ id: req.params.id });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json(publicDriver(driver));
  } catch (error) {
    next(error);
  }
});

app.post("/drivers/apply", bookingLimiter, async (req, res, next) => {
  try {
    const { name, city, languages, vehicleType } = req.body;

    if (!name || !city || !Array.isArray(languages) || !vehicleType) {
      return res.status(400).json({ message: "Driver application data is incomplete" });
    }

    const driver = {
      id: randomUUID(),
      name,
      city,
      languages,
      vehicleType,
      rating: 0,
      reviewCount: 0,
      startingPriceLak: 50000,
      verified: false,
      premium: false,
      active: true,
      status: "PENDING_REVIEW",
      routes: [],
      createdAt: new Date()
    };

    await db.collection("drivers").insertOne(driver);
    res.status(201).json(publicDriver(driver));
  } catch (error) {
    next(error);
  }
});

app.get("/tours", async (_req, res, next) => {
  try {
    const tours = await db.collection("tours").find({ active: { $ne: false } }).sort({ featuredOnHome: -1, sortOrder: 1, createdAt: -1 }).toArray();
    res.json(tours);
  } catch (error) {
    next(error);
  }
});

app.post("/bookings", bookingLimiter, authenticate, requireActiveMember, async (req, res, next) => {
  try {
    const {
      driverId,
      tourId,
      pickup,
      dropoff,
      distanceKm,
      passengers,
      pickupAt,
      customerName,
      customerPhone,
      customerWhatsapp,
      customerEmail,
      vehicleCategoryId,
      pickupCoordinates: requestedPickupCoordinates,
      dropoffCoordinates: requestedDropoffCoordinates,
      bookingIntent,
      meterTermsAccepted,
      note
    } = req.body;
    if (req.user?.role !== "USER") return res.status(403).json({ message: "Member account required" });
    const userId = req.user.id;

    const tour = tourId ? await db.collection("tours").findOne({ id: String(tourId), active: { $ne: false } }) : null;
    if (tourId && !tour) return res.status(404).json({ message: "Tour package not found" });

    const isDriverReservation = bookingIntent === "DRIVER_RESERVATION" && Boolean(driverId);
    if (
      !pickup ||
      (!isDriverReservation && !dropoff) ||
      (!tour && !isDriverReservation && !distanceKm) ||
      !passengers || !pickupAt || !customerName || !customerPhone
    ) {
      return res.status(400).json({ message: "Booking data is incomplete" });
    }

    const bookingDriverId = driverId || tour?.driverId || null;
    const bookingVehicleCategory = !tour && !bookingDriverId ? await getVehicleCategoryForBooking(vehicleCategoryId) : null;
    const fareMode = tour ? "FIXED" : (bookingDriverId ? "METER" : "FIXED");
    if (fareMode === "METER" && meterTermsAccepted !== true) {
      return res.status(400).json({ message: "Meter pricing terms must be accepted" });
    }
    const pickupCoordinates = parseCoordinates(requestedPickupCoordinates);
    const dropoffCoordinates = parseCoordinates(requestedDropoffCoordinates);
    const calculatedRoute = !tour && pickupCoordinates && dropoffCoordinates
      ? await calculateRoute(pickupCoordinates, dropoffCoordinates, bookingDriverId, bookingVehicleCategory?.id || null)
      : null;
    const finalDistanceKm = tour ? Number(distanceKm || 0) : Number(calculatedRoute?.distanceKm || distanceKm || 0);
    const finalDurationMinutes = Number(calculatedRoute?.durationMinutes || 0);
    const pricingSnapshot = await getPricingSettings();
    const estimatedPriceLak = tour
      ? Number(tour.priceLak || 0)
      : Number(await calculateBookingPrice(finalDistanceKm, bookingDriverId, fareMode, finalDurationMinutes, bookingVehicleCategory));
    const booking = {
      id: randomUUID(),
      userId,
      bookingType: tour ? "TOUR" : (isDriverReservation ? "DRIVER_RESERVATION" : "RIDE"),
      tourId: tour?.id || null,
      tourTitle: tour?.title || "",
      driverId: bookingDriverId,
      vehicleCategoryId: bookingVehicleCategory?.id || null,
      vehicleCategoryName: bookingVehicleCategory?.nameLo || bookingVehicleCategory?.name || "",
      vehicleCategorySnapshot: bookingVehicleCategory ? publicVehicleCategory(bookingVehicleCategory) : null,
      pickup,
      dropoff: dropoff || "",
      pickupLocation: pickupCoordinates ? { type: "Point", coordinates: [pickupCoordinates.longitude, pickupCoordinates.latitude] } : null,
      dropoffLocation: dropoffCoordinates ? { type: "Point", coordinates: [dropoffCoordinates.longitude, dropoffCoordinates.latitude] } : null,
      routeGeometry: calculatedRoute?.geometry || null,
      routeProvider: calculatedRoute?.provider || "",
      distanceKm: finalDistanceKm,
      durationMinutes: finalDurationMinutes || null,
      fareMode,
      meterTermsAcceptedAt: fareMode === "METER" ? new Date() : null,
      pricingSnapshot,
      passengers: Number(passengers),
      pickupAt: new Date(pickupAt),
      customerName,
      customerPhone,
      customerWhatsapp: customerWhatsapp || "",
      customerEmail: customerEmail || "",
      note: note || "",
      status: "PENDING",
      estimatedPriceLak,
      finalPriceLak: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const payment = {
      id: randomUUID(),
      bookingId: booking.id,
      amountLak: estimatedPriceLak,
      currency: "LAK",
      method: "CASH",
      status: "PENDING",
      metadata: { source: "web-booking" },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection("bookings").insertOne(booking);
    await db.collection("payments").insertOne(payment);
    if (booking.bookingType === "RIDE" && !booking.driverId) {
      await autoDispatchBooking(booking.id);
    }
    res.status(201).json(await getBookingLiveView(booking.id, userId));
  } catch (error) {
    next(error);
  }
});

app.post("/bookings/lookup", lookupLimiter, async (req, res, next) => {
  try {
    const bookingId = String(req.body.bookingId || "").trim();
    const phone = String(req.body.phone || "").trim();

    if (!bookingId || !phone) {
      return res.status(400).json({ message: "Booking ID and phone are required" });
    }

    const booking = await db.collection("bookings").aggregate([
      {
        $match: {
          id: bookingId,
          $or: [
            { customerPhone: phone },
            { customerWhatsapp: phone }
          ]
        }
      },
      {
        $lookup: {
          from: "drivers",
          localField: "driverId",
          foreignField: "id",
          as: "driver"
        }
      },
      { $addFields: { driver: { $first: "$driver" } } },
      {
        $lookup: {
          from: "payments",
          localField: "id",
          foreignField: "bookingId",
          as: "payment"
        }
      },
      { $addFields: { payment: { $first: "$payment" } } },
      {
        $project: {
          _id: 0,
          id: 1,
          bookingType: 1,
          tourTitle: 1,
          pickup: 1,
          dropoff: 1,
          pickupLocation: 1,
          dropoffLocation: 1,
          routeGeometry: 1,
          driverLocation: 1,
          pickupAt: 1,
          distanceKm: 1,
          passengers: 1,
          status: 1,
          estimatedPriceLak: 1,
          customerName: 1,
          customerPhone: 1,
          customerWhatsapp: 1,
          note: 1,
          driverReview: 1,
          customerReview: 1,
          cancelledAt: 1,
          cancelledBy: 1,
          cancellationReason: 1,
          createdAt: 1,
          "driver.id": 1,
          "driver.name": 1,
          "driver.city": 1,
          "driver.vehicleType": 1,
          "driver.rating": 1,
          "driver.premium": 1,
          "driver.verified": 1,
          "driver.portraitUrl": 1,
          "driver.vehicleUrl": 1,
          "payment.amountLak": 1,
          "payment.currency": 1,
          "payment.method": 1,
          "payment.status": 1
        }
      }
    ]).next();

    if (!booking) return res.status(404).json({ message: "Booking not found. Check Booking ID and phone number." });
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

app.get("/bookings/me", authenticate, requireActiveMember, async (req, res, next) => {
  try {
    const bookings = await db.collection("bookings").aggregate([
      { $match: { userId: req.user.id } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "drivers",
          localField: "driverId",
          foreignField: "id",
          as: "driver"
        }
      },
      { $addFields: { driver: { $first: "$driver" } } },
      {
        $lookup: {
          from: "payments",
          localField: "id",
          foreignField: "bookingId",
          as: "payment"
        }
      },
      { $addFields: { payment: { $first: "$payment" } } },
      {
        $project: {
          _id: 0,
          id: 1,
          bookingType: 1,
          pickup: 1,
          dropoff: 1,
          pickupLocation: 1,
          dropoffLocation: 1,
          routeGeometry: 1,
          driverLocation: 1,
          pickupAt: 1,
          distanceKm: 1,
          durationMinutes: 1,
          passengers: 1,
          status: 1,
          estimatedPriceLak: 1,
          customerName: 1,
          customerPhone: 1,
          customerWhatsapp: 1,
          note: 1,
          driverReview: 1,
          customerReview: 1,
          cancelledAt: 1,
          cancelledBy: 1,
          cancellationReason: 1,
          createdAt: 1,
          "driver.id": 1,
          "driver.name": 1,
          "driver.city": 1,
          "driver.vehicleType": 1,
          "driver.rating": 1,
          "driver.premium": 1,
          "driver.verified": 1,
          "driver.portraitUrl": 1,
          "driver.vehicleUrl": 1,
          "payment.amountLak": 1,
          "payment.currency": 1,
          "payment.method": 1,
          "payment.status": 1
        }
      }
    ]).toArray();
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

app.get("/bookings/:id", authenticate, requireActiveMember, async (req, res, next) => {
  try {
    if (req.user?.role !== "USER") return res.status(403).json({ message: "Member account required" });
    const booking = await getBookingLiveView(req.params.id, req.user.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

app.get("/bookings/:id/events", authenticate, requireActiveMember, async (req, res, next) => {
  try {
    if (req.user?.role !== "USER") return res.status(403).json({ message: "Member account required" });
    const booking = await getBookingLiveView(req.params.id, req.user.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    const subscribers = bookingSubscribers.get(booking.id) || new Set();
    subscribers.add(res);
    bookingSubscribers.set(booking.id, subscribers);
    writeBookingEvent(res, "booking", booking);

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 20000);

    req.on("close", () => {
      clearInterval(heartbeat);
      const activeSubscribers = bookingSubscribers.get(booking.id);
      activeSubscribers?.delete(res);
      if (!activeSubscribers?.size) bookingSubscribers.delete(booking.id);
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/driver/availability", driverWriteLimiter, requireDriver, async (req, res, next) => {
  try {
    await expireDispatchOffers();
    const online = req.body.online === true;
    const autoAccept = req.body.autoAccept === true;
    const coordinates = parseCoordinates(req.body.location);
    const now = new Date();
    const updates = {
      "availability.online": online,
      "availability.autoAccept": autoAccept,
      "availability.updatedAt": now,
      "availability.lastSeenAt": now,
      updatedAt: now
    };

    if (coordinates) {
      const currentLocation = {
        type: "Point",
        coordinates: [coordinates.longitude, coordinates.latitude],
        accuracy: Number(req.body.location?.accuracy || 0),
        heading: Number(req.body.location?.heading || 0),
        speed: Number(req.body.location?.speed || 0),
        updatedAt: now
      };
      updates.currentLocation = currentLocation;
      updates.lastLocationAt = now;
    }

    await db.collection("drivers").updateOne(
      { id: req.user.driverId },
      { $set: updates }
    );

    const driver = await db.collection("drivers").findOne({ id: req.user.driverId });
    if (online && autoAccept) {
      const pending = await db.collection("bookings")
        .find({ bookingType: "RIDE", driverId: null, status: "PENDING", pickupLocation: { $ne: null } })
        .sort({ pickupAt: 1, createdAt: 1 })
        .limit(5)
        .toArray();
      for (const booking of pending) {
        const dispatched = await autoDispatchBooking(booking.id);
        if (dispatched?.driverId === req.user.driverId) break;
      }
    }

    res.json({ ok: true, driver: publicDriver(driver) });
  } catch (error) {
    next(error);
  }
});

app.patch("/driver/location", driverLocationLimiter, requireDriver, async (req, res, next) => {
  try {
    const coordinates = parseCoordinates(req.body);
    if (!coordinates) {
      return res.status(400).json({ message: "Valid driver coordinates are required" });
    }

    const now = new Date();
    const currentLocation = {
      type: "Point",
      coordinates: [coordinates.longitude, coordinates.latitude],
      accuracy: Number(req.body.accuracy || 0),
      heading: Number(req.body.heading || 0),
      speed: Number(req.body.speed || 0),
      updatedAt: now
    };
    await db.collection("drivers").updateOne(
      { id: req.user.driverId },
      {
        $set: {
          currentLocation,
          lastLocationAt: now,
          "availability.lastSeenAt": now,
          updatedAt: now
        }
      }
    );
    res.json({ ok: true, currentLocation });
  } catch (error) {
    next(error);
  }
});

app.get("/driver/bookings", driverReadLimiter, requireDriver, async (req, res, next) => {
  try {
    await expireDispatchOffers();
    const bookings = await db.collection("bookings").aggregate([
      {
        $match: {
          $or: [
            { driverId: req.user.driverId },
            {
              bookingType: "RIDE",
              driverId: null,
              status: "PENDING"
            }
          ]
        }
      },
      { $sort: { pickupAt: 1, createdAt: -1 } },
      {
        $lookup: {
          from: "payments",
          localField: "id",
          foreignField: "bookingId",
          as: "payment"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "id",
          as: "user"
        }
      },
      { $addFields: { payment: { $first: "$payment" }, user: { $first: "$user" } } }
    ]).toArray();
    res.json(bookings.map((booking) => publicDriverBooking(booking, req.user.driverId)));
  } catch (error) {
    next(error);
  }
});

app.patch("/driver/bookings/:id/status", driverWriteLimiter, requireDriver, async (req, res, next) => {
  try {
    await expireDispatchOffers();
    const status = req.body.status;
    if (!["CONFIRMED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ message: "Invalid driver booking status" });
    }

    const now = new Date();
    let filter = { id: req.params.id, driverId: req.user.driverId };
    const updates = { status, updatedAt: now };
    let previousBookingStatus = null;

    if (status === "CONFIRMED") {
      const booking = await db.collection("bookings").findOne({
        id: req.params.id,
        $or: [
          { status: "PENDING", driverId: null },
          { status: "PENDING", driverId: req.user.driverId },
          { status: "OFFERED", driverId: req.user.driverId, dispatchExpiresAt: { $gt: now } }
        ]
      });
      if (!booking) {
        return res.status(409).json({ message: "This job was already accepted or its status has changed" });
      }
      try {
        await assertDriverCanAcceptBooking(req.user.driverId, booking);
      } catch (error) {
        return res.status(error.statusCode || 400).json({ message: error.message, details: error.details || null });
      }
      filter = {
        id: req.params.id,
        $or: [
          { status: "PENDING", driverId: null },
          { status: "PENDING", driverId: req.user.driverId },
          { status: "OFFERED", driverId: req.user.driverId, dispatchExpiresAt: { $gt: now } }
        ]
      };
      updates.driverId = req.user.driverId;
      updates.acceptedAt = now;
      updates.dispatchAcceptedAt = now;
    } else if (status === "ON_THE_WAY") {
      filter.status = "CONFIRMED";
      updates.onTheWayAt = now;
    } else if (status === "IN_PROGRESS") {
      filter.status = "ON_THE_WAY";
      updates.startedAt = now;
    } else if (status === "COMPLETED") {
      filter.status = { $in: ["ON_THE_WAY", "IN_PROGRESS"] };
      updates.completedAt = now;
      const previousBooking = await db.collection("bookings").findOne(filter);
      previousBookingStatus = previousBooking?.status || "IN_PROGRESS";
    } else if (status === "CANCELLED") {
      filter.status = { $nin: ["COMPLETED", "CANCELLED"] };
      updates.cancelledAt = now;
      updates.cancelledBy = "DRIVER";
      updates.cancellationReason = String(req.body.reason || "Driver cancelled the ride").trim().slice(0, 300);
    }

    const result = await db.collection("bookings").updateOne(filter, { $set: updates });
    if (result.modifiedCount === 0) {
      return res.status(409).json({ message: "This job was already accepted or its status has changed" });
    }

    const booking = await db.collection("bookings").findOne({ id: req.params.id });
    if (status === "COMPLETED") {
      try {
        await debitDriverCommissionOnce(booking, req.user.id);
      } catch (error) {
        await db.collection("bookings").updateOne(
          { id: booking.id },
          { $set: { status: previousBookingStatus, commissionDebitFailedAt: new Date(), updatedAt: new Date() } }
        );
        return res.status(error.statusCode || 400).json({ message: error.message || "Driver commission debit failed" });
      }
    }
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "DRIVER_BOOKING_STATUS_UPDATED",
      targetId: booking.id,
      actorId: req.user.id,
      metadata: { status },
      createdAt: new Date()
    });

    await emitBookingUpdate(booking.id);
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

app.patch("/driver/bookings/:id/location", driverLocationLimiter, requireDriver, async (req, res, next) => {
  try {
    const longitude = Number(req.body.longitude);
    const latitude = Number(req.body.latitude);
    const accuracy = Number(req.body.accuracy || 0);
    const heading = Number(req.body.heading || 0);
    const speed = Number(req.body.speed || 0);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      return res.status(400).json({ message: "Valid driver coordinates are required" });
    }

    const now = new Date();
    const driverLocation = {
      type: "Point",
      coordinates: [longitude, latitude],
      accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0,
      heading: Number.isFinite(heading) ? heading : 0,
      speed: Number.isFinite(speed) ? Math.max(0, speed) : 0,
      updatedAt: now
    };

    const result = await db.collection("bookings").updateOne(
      {
        id: req.params.id,
        driverId: req.user.driverId,
        status: { $in: ["CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"] }
      },
      { $set: { driverLocation, updatedAt: now } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Active booking not found for this driver" });
    }

    await db.collection("drivers").updateOne(
      { id: req.user.driverId },
      { $set: { currentLocation: driverLocation, lastLocationAt: now, updatedAt: now } }
    );
    await emitBookingUpdate(req.params.id);
    res.json({ ok: true, driverLocation });
  } catch (error) {
    next(error);
  }
});

app.patch("/bookings/:id/status", authenticate, requireActiveMember, async (req, res, next) => {
  try {
    const status = req.body.status;
    if (req.user?.role !== "USER" || status !== "CANCELLED") {
      return res.status(403).json({ message: "Customers can only cancel their own booking" });
    }

    const result = await db.collection("bookings").updateOne(
      { id: req.params.id, userId: req.user.id, status: { $in: ["PENDING", "OFFERED"] } },
      {
        $set: {
          status,
          cancelledAt: new Date(),
          cancelledBy: "USER",
          cancellationReason: "Customer cancelled before driver accepted",
          updatedAt: new Date()
        }
      }
    );
    const booking = await db.collection("bookings").findOne({ id: req.params.id, userId: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (result.modifiedCount === 0) {
      return res.status(409).json({ message: "This booking already has a driver and cannot be cancelled by customer" });
    }
    await emitBookingUpdate(booking.id);
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

app.get("/bookings/:id/chat", chatReadLimiter, authenticate, requireActiveMember, async (req, res, next) => {
  try {
    await getAuthorizedChatBooking(req, req.params.id);
    const messages = await db.collection("chatMessages")
      .find({ bookingId: req.params.id })
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();
    res.json(messages.map(publicChatMessage));
  } catch (error) {
    next(error);
  }
});

app.post("/bookings/:id/chat", chatWriteLimiter, authenticate, requireActiveMember, async (req, res, next) => {
  try {
    const booking = await getAuthorizedChatBooking(req, req.params.id, { requireActive: true });
    const text = String(req.body.text || "").trim().slice(0, 1200);
    const attachment = saveChatAttachmentDataUrl(req.body.attachmentDataUrl, req);
    if (!text && !attachment) return res.status(400).json({ message: "Message text or attachment is required" });

    const senderName = req.user.role === "DRIVER"
      ? (await db.collection("drivers").findOne({ id: req.user.driverId }))?.name || "Driver"
      : (await db.collection("users").findOne({ id: req.user.id }))?.name || "Customer";

    const message = {
      id: randomUUID(),
      bookingId: booking.id,
      senderRole: req.user.role,
      senderId: req.user.role === "DRIVER" ? req.user.driverId : req.user.id,
      senderName,
      text,
      attachmentUrl: attachment?.url || "",
      attachmentType: attachment?.type || "",
      attachmentMimeType: attachment?.mimeType || "",
      attachmentSize: attachment?.size || 0,
      createdAt: new Date()
    };
    await db.collection("chatMessages").insertOne(message);
    await emitBookingUpdate(booking.id);
    res.status(201).json(publicChatMessage(message));
  } catch (error) {
    next(error);
  }
});

app.post("/reviews", authenticate, requireActiveMember, async (req, res, next) => {
  try {
    const { driverId, rating, comment } = req.body;
    if (!driverId || !rating || !comment) {
      return res.status(400).json({ message: "Review data is incomplete" });
    }

    const review = {
      id: randomUUID(),
      userId: req.user.id,
      driverId,
      targetType: "DRIVER",
      fromRole: "USER",
      rating: Number(rating),
      comment,
      hidden: false,
      createdAt: new Date()
    };

    await db.collection("reviews").insertOne(review);
    await refreshDriverRating(driverId);
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
});

app.post("/bookings/:id/review", authenticate, requireActiveMember, async (req, res, next) => {
  try {
    if (req.user?.role !== "USER") {
      return res.status(403).json({ message: "Member account required" });
    }
    const { rating, comment } = normalizeReviewInput(req.body.rating, req.body.comment);
    const booking = await db.collection("bookings").findOne({ id: req.params.id, userId: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "COMPLETED") {
      return res.status(409).json({ message: "Review is available after trip completion" });
    }
    if (!booking.driverId) return res.status(409).json({ message: "This booking has no driver to review" });
    if (booking.driverReview?.rating) {
      return res.status(409).json({ message: "You already reviewed this driver" });
    }

    const review = {
      id: randomUUID(),
      bookingId: booking.id,
      userId: req.user.id,
      driverId: booking.driverId,
      targetType: "DRIVER",
      fromRole: "USER",
      rating,
      comment,
      hidden: false,
      createdAt: new Date()
    };
    const lockResult = await db.collection("bookings").updateOne(
      { id: booking.id, "driverReview.rating": { $exists: false } },
      { $set: { driverReview: { rating, comment, reviewId: review.id, createdAt: review.createdAt }, updatedAt: new Date() } }
    );
    if (lockResult.modifiedCount === 0) {
      return res.status(409).json({ message: "You already reviewed this driver" });
    }
    await db.collection("reviews").insertOne(review);
    await refreshDriverRating(booking.driverId);
    await emitBookingUpdate(booking.id);
    res.status(201).json({ rating, comment, reviewId: review.id, createdAt: review.createdAt });
  } catch (error) {
    next(error);
  }
});

app.post("/driver/bookings/:id/review", driverWriteLimiter, requireDriver, async (req, res, next) => {
  try {
    const { rating, comment } = normalizeReviewInput(req.body.rating, req.body.comment);
    const booking = await db.collection("bookings").findOne({ id: req.params.id, driverId: req.user.driverId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "COMPLETED") {
      return res.status(409).json({ message: "Customer review is available after trip completion" });
    }
    if (!booking.userId) return res.status(409).json({ message: "This booking has no member customer to review" });
    if (booking.customerReview?.rating) {
      return res.status(409).json({ message: "You already reviewed this customer" });
    }

    const driver = await db.collection("drivers").findOne({ id: req.user.driverId });
    const review = {
      id: randomUUID(),
      bookingId: booking.id,
      userId: booking.userId,
      driverId: req.user.driverId,
      targetType: "CUSTOMER",
      fromRole: "DRIVER",
      fromName: driver?.name || "Driver",
      rating,
      comment,
      hidden: false,
      createdAt: new Date()
    };
    const lockResult = await db.collection("bookings").updateOne(
      { id: booking.id, "customerReview.rating": { $exists: false } },
      { $set: { customerReview: { rating, comment, reviewId: review.id, createdAt: review.createdAt }, updatedAt: new Date() } }
    );
    if (lockResult.modifiedCount === 0) {
      return res.status(409).json({ message: "You already reviewed this customer" });
    }
    await db.collection("reviews").insertOne(review);
    await refreshCustomerRating(booking.userId);
    await emitBookingUpdate(booking.id);
    res.status(201).json({ rating, comment, reviewId: review.id, createdAt: review.createdAt });
  } catch (error) {
    next(error);
  }
});

app.get("/admin/dashboard", requireAdmin, async (_req, res, next) => {
  try {
    const [drivers, users, bookings, pendingBookings, completedBookings, premiumDrivers, latestReviews, payments, paidPayments] = await Promise.all([
      db.collection("drivers").countDocuments(),
      db.collection("users").countDocuments(),
      db.collection("bookings").countDocuments(),
      db.collection("bookings").countDocuments({ status: "PENDING" }),
      db.collection("bookings").countDocuments({ status: "COMPLETED" }),
      db.collection("drivers").countDocuments({ premium: true }),
      db.collection("reviews").countDocuments(),
      db.collection("payments").find({}).project({ amountLak: 1 }).toArray(),
      db.collection("payments").find({ status: "PAID" }).project({ amountLak: 1 }).toArray()
    ]);

    res.json({
      drivers,
      users,
      bookings,
      revenueLak: payments.reduce((sum, payment) => sum + Number(payment.amountLak || 0), 0),
      paidRevenueLak: paidPayments.reduce((sum, payment) => sum + Number(payment.amountLak || 0), 0),
      pendingBookings,
      completedBookings,
      premiumDrivers,
      latestReviews
    });
  } catch (error) {
    next(error);
  }
});

app.get("/admin/users", requireAdmin, async (_req, res, next) => {
  try {
    const users = await db.collection("users").aggregate([
      { $match: { role: "USER" } },
      {
        $lookup: {
          from: "bookings",
          localField: "id",
          foreignField: "userId",
          as: "bookings"
        }
      },
      {
        $addFields: {
          bookingCount: { $size: "$bookings" },
          completedBookings: {
            $size: {
              $filter: { input: "$bookings", as: "booking", cond: { $eq: ["$$booking.status", "COMPLETED"] } }
            }
          },
          activeBookings: {
            $size: {
              $filter: {
                input: "$bookings",
                as: "booking",
                cond: { $in: ["$$booking.status", ["PENDING", "OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS"]] }
              }
            }
          },
          totalSpentLak: {
            $sum: {
              $map: {
                input: {
                  $filter: { input: "$bookings", as: "booking", cond: { $eq: ["$$booking.status", "COMPLETED"] } }
                },
                as: "booking",
                in: { $ifNull: ["$$booking.finalPriceLak", "$$booking.estimatedPriceLak"] }
              }
            }
          }
        }
      },
      { $project: { bookings: 0, passwordHash: 0, passwordSalt: 0 } },
      { $sort: { activeBookings: -1, lastLoginAt: -1, createdAt: -1 } },
      { $limit: 500 }
    ]).toArray();
    res.json(users.map(publicAdminUser));
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/users/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const status = String(req.body.status || "").toUpperCase();
    if (!["ACTIVE", "SUSPENDED"].includes(status)) {
      return res.status(400).json({ message: "User status must be ACTIVE or SUSPENDED" });
    }
    const result = await db.collection("users").updateOne(
      { id: req.params.id, role: "USER" },
      { $set: { status, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ message: "Member not found" });
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "USER_STATUS_UPDATED",
      targetId: req.params.id,
      actorId: req.user.id,
      metadata: { status },
      createdAt: new Date()
    });
    const user = await db.collection("users").findOne({ id: req.params.id });
    res.json(publicAdminUser(user));
  } catch (error) {
    next(error);
  }
});
app.get("/admin/drivers", requireAdmin, async (_req, res, next) => {
  try {
    const drivers = await db.collection("drivers").find({}).sort({ verified: 1, premium: -1, createdAt: -1 }).toArray();
    res.json(drivers.map(publicDriver));
  } catch (error) {
    next(error);
  }
});

app.get("/admin/drivers/:id/wallet", requireAdmin, async (req, res, next) => {
  try {
    const driver = await db.collection("drivers").findOne({ id: req.params.id });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    const ledger = await db.collection("driverLedger")
      .find({ driverId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ driver: publicDriver(driver), ledger });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/drivers/:id/wallet", requireAdmin, async (req, res, next) => {
  try {
    const direction = String(req.body.direction || "CREDIT").toUpperCase();
    const amountLak = Number(String(req.body.amountLak || 0).replace(/[,\s]/g, ""));
    const note = String(req.body.note || "Manual wallet adjustment from admin finance").trim();
    if (!["CREDIT", "DEBIT"].includes(direction)) {
      return res.status(400).json({ message: "Wallet direction must be CREDIT or DEBIT" });
    }
    if (!Number.isFinite(amountLak) || amountLak <= 0) {
      return res.status(400).json({ message: "Wallet amount must be greater than zero" });
    }

    const { driver, ledger } = await adjustDriverWallet({
      driverId: req.params.id,
      amountLak,
      type: direction === "CREDIT" ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
      note,
      actorId: req.user.id,
      metadata: { source: "admin" }
    });

    res.json({ driver: publicDriver(driver), ledger });
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message || "Wallet update failed" });
  }
});

app.get("/admin/vehicle-categories", requireAdmin, async (_req, res, next) => {
  try {
    const categories = await db.collection("vehicleCategories")
      .find({})
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray();
    res.json(categories.map(publicVehicleCategory));
  } catch (error) {
    next(error);
  }
});

app.post("/admin/vehicle-categories", requireAdmin, async (req, res, next) => {
  try {
    const payload = sanitizeVehicleCategoryPayload(req.body);
    const category = {
      id: randomUUID(),
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const existing = await db.collection("vehicleCategories").findOne({ code: category.code });
    if (existing) return res.status(409).json({ message: "Vehicle category code already exists" });
    if (category.default) {
      await db.collection("vehicleCategories").updateMany({ default: true }, { $set: { default: false, updatedAt: new Date() } });
    }
    await db.collection("vehicleCategories").insertOne(category);
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "VEHICLE_CATEGORY_CREATED",
      targetId: category.id,
      actorId: req.user.id,
      metadata: { code: category.code, name: category.name },
      createdAt: new Date()
    });
    res.status(201).json(publicVehicleCategory(category));
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message || "Vehicle category save failed" });
  }
});

app.patch("/admin/vehicle-categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const existing = await db.collection("vehicleCategories").findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ message: "Vehicle category not found" });
    const payload = sanitizeVehicleCategoryPayload(req.body, existing);
    const duplicate = await db.collection("vehicleCategories").findOne({ code: payload.code, id: { $ne: req.params.id } });
    if (duplicate) return res.status(409).json({ message: "Vehicle category code already exists" });
    if (payload.default) {
      await db.collection("vehicleCategories").updateMany({ id: { $ne: req.params.id }, default: true }, { $set: { default: false, updatedAt: new Date() } });
    }
    await db.collection("vehicleCategories").updateOne(
      { id: req.params.id },
      { $set: { ...payload, updatedAt: new Date() } }
    );
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "VEHICLE_CATEGORY_UPDATED",
      targetId: req.params.id,
      actorId: req.user.id,
      metadata: { code: payload.code, name: payload.name },
      createdAt: new Date()
    });
    const category = await db.collection("vehicleCategories").findOne({ id: req.params.id });
    res.json(publicVehicleCategory(category));
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message || "Vehicle category update failed" });
  }
});

app.delete("/admin/vehicle-categories/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await db.collection("vehicleCategories").updateOne(
      { id: req.params.id },
      { $set: { active: false, visibleOnWeb: false, default: false, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ message: "Vehicle category not found" });
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "VEHICLE_CATEGORY_DISABLED",
      targetId: req.params.id,
      actorId: req.user.id,
      metadata: {},
      createdAt: new Date()
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
app.get("/admin/pricing", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await getPricingSettings());
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/pricing", requireAdmin, async (req, res, next) => {
  try {
    const ratePerKmLak = Number(req.body.ratePerKmLak);
    const minimumFareLak = Number(req.body.minimumFareLak);
    const meterBaseFareLak = Number(req.body.meterBaseFareLak);
    const meterIncludedKm = Number(req.body.meterIncludedKm);
    const meterRatePerKmLak = Number(req.body.meterRatePerKmLak);
    const meterRatePerMinuteLak = Number(req.body.meterRatePerMinuteLak);
    const driverCommissionPercent = Number(req.body.driverCommissionPercent ?? defaultDriverCommissionPercent);
    const driverMinimumBalanceLak = Number(req.body.driverMinimumBalanceLak ?? defaultDriverMinimumBalanceLak);
    const driverLowBalanceWarningLak = Number(req.body.driverLowBalanceWarningLak ?? defaultDriverLowBalanceWarningLak);

    if (
      !Number.isFinite(ratePerKmLak) || ratePerKmLak < 1 ||
      !Number.isFinite(minimumFareLak) || minimumFareLak < 1 ||
      !Number.isFinite(meterBaseFareLak) || meterBaseFareLak < 1 ||
      !Number.isFinite(meterIncludedKm) || meterIncludedKm < 0 ||
      !Number.isFinite(meterRatePerKmLak) || meterRatePerKmLak < 0 ||
      !Number.isFinite(meterRatePerMinuteLak) || meterRatePerMinuteLak < 0 ||
      !Number.isFinite(driverCommissionPercent) || driverCommissionPercent < 0 || driverCommissionPercent > 100 ||
      !Number.isFinite(driverMinimumBalanceLak) || driverMinimumBalanceLak < 0 ||
      !Number.isFinite(driverLowBalanceWarningLak) || driverLowBalanceWarningLak < 0
    ) {
      return res.status(400).json({ message: "All pricing fields must be valid numbers" });
    }

    const pricing = {
      id: "pricing",
      ratePerKmLak,
      minimumFareLak,
      meterBaseFareLak,
      meterIncludedKm,
      meterRatePerKmLak,
      meterRatePerMinuteLak,
      driverCommissionPercent,
      driverMinimumBalanceLak,
      driverLowBalanceWarningLak,
      updatedAt: new Date()
    };

    await db.collection("settings").updateOne(
      { id: "pricing" },
      { $set: pricing, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "PRICING_UPDATED",
      targetId: "pricing",
      actorId: req.user.id,
      metadata: { ratePerKmLak, minimumFareLak, meterBaseFareLak, meterIncludedKm, meterRatePerKmLak, meterRatePerMinuteLak, driverCommissionPercent, driverMinimumBalanceLak, driverLowBalanceWarningLak },
      createdAt: new Date()
    });

    res.json(await getPricingSettings());
  } catch (error) {
    next(error);
  }
});

app.post("/admin/drivers", requireAdmin, async (req, res, next) => {
  try {
    const {
      name,
      city,
      languages,
      vehicleType,
      startingPriceLak,
      ratePerKmLak,
      minimumFareLak,
      routes,
      verified,
      premium,
      active,
      username: requestedUsername,
      password,
      bio,
      coverUrl,
      portraitUrl,
      vehicleUrl
    } = req.body;
    const imageFields = saveImageFields(req, ["coverUrl", "portraitUrl", "vehicleUrl"], "drivers");

    const username = normalizeDriverUsername(requestedUsername);
    if (!name || !city || !vehicleType || !username || !password) {
      return res.status(400).json({ message: "Driver name, city, vehicle, username, and password are required" });
    }
    if (String(password).length < 6) return res.status(400).json({ message: "Driver password must be at least 6 characters" });
    const existingDriver = await db.collection("drivers").findOne({ username });
    if (existingDriver) return res.status(409).json({ message: "Driver username already exists" });
    const passwordFields = hashPassword(password);

    const driver = {
      id: randomUUID(),
      username,
      ...passwordFields,
      name,
      city,
      languages: Array.isArray(languages) ? languages : [],
      vehicleType,
      rating: 0,
      reviewCount: 0,
      startingPriceLak: Number(startingPriceLak || 50000),
      ratePerKmLak: ratePerKmLak ? Number(ratePerKmLak) : null,
      minimumFareLak: minimumFareLak ? Number(minimumFareLak) : null,
      verified: Boolean(verified),
      premium: Boolean(premium),
      active: active !== false,
      status: verified ? "APPROVED" : "PENDING_REVIEW",
      routes: Array.isArray(routes) ? routes : [],
      bio: bio || "",
      coverUrl: imageFields.coverUrl || coverUrl || "",
      portraitUrl: imageFields.portraitUrl || portraitUrl || "",
      vehicleUrl: imageFields.vehicleUrl || vehicleUrl || "",
      walletBalanceLak: 0,
      walletUpdatedAt: new Date(),
      createdAt: new Date(),
      passwordUpdatedAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection("drivers").insertOne(driver);
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "DRIVER_CREATED",
      targetId: driver.id,
      actorId: req.user.id,
      metadata: { driverName: driver.name },
      createdAt: new Date()
    });

    res.status(201).json(publicDriver(driver));
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/drivers/:id", requireAdmin, async (req, res, next) => {
  try {
    const allowed = {};
    const fields = ["name", "city", "vehicleType", "status", "bio", "coverUrl", "portraitUrl", "vehicleUrl"];

    for (const field of fields) {
      if (req.body[field] !== undefined) allowed[field] = req.body[field];
    }

    Object.assign(allowed, saveImageFields(req, ["coverUrl", "portraitUrl", "vehicleUrl"], "drivers"));

    if (req.body.languages !== undefined) {
      allowed.languages = Array.isArray(req.body.languages) ? req.body.languages : [];
    }

    if (req.body.routes !== undefined) {
      allowed.routes = Array.isArray(req.body.routes) ? req.body.routes : [];
    }

    if (req.body.startingPriceLak !== undefined) allowed.startingPriceLak = Number(req.body.startingPriceLak);
    if (req.body.ratePerKmLak !== undefined) allowed.ratePerKmLak = req.body.ratePerKmLak ? Number(req.body.ratePerKmLak) : null;
    if (req.body.minimumFareLak !== undefined) allowed.minimumFareLak = req.body.minimumFareLak ? Number(req.body.minimumFareLak) : null;
    if (req.body.username !== undefined) {
      const username = normalizeDriverUsername(req.body.username);
      if (!username) return res.status(400).json({ message: "Driver username is required" });
      const existingDriver = await db.collection("drivers").findOne({ username, id: { $ne: req.params.id } });
      if (existingDriver) return res.status(409).json({ message: "Driver username already exists" });
      allowed.username = username;
    }
    if (req.body.password !== undefined && String(req.body.password || "").trim()) {
      if (String(req.body.password).length < 6) return res.status(400).json({ message: "Driver password must be at least 6 characters" });
      Object.assign(allowed, hashPassword(req.body.password));
      allowed.passwordUpdatedAt = new Date();
    }

    if (req.body.verified !== undefined) {
      allowed.verified = Boolean(req.body.verified);
      allowed.status = allowed.verified ? "APPROVED" : "PENDING_REVIEW";
    }

    if (req.body.premium !== undefined) allowed.premium = Boolean(req.body.premium);
    if (req.body.active !== undefined) allowed.active = Boolean(req.body.active);
    allowed.updatedAt = new Date();

    await db.collection("drivers").updateOne({ id: req.params.id }, { $set: allowed });
    const driver = await db.collection("drivers").findOne({ id: req.params.id });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "DRIVER_UPDATED",
      targetId: driver.id,
      actorId: req.user.id,
      metadata: { driverName: driver.name },
      createdAt: new Date()
    });

    res.json(publicDriver(driver));
  } catch (error) {
    next(error);
  }
});

app.delete("/admin/drivers/:id", requireAdmin, async (req, res, next) => {
  try {
    await db.collection("drivers").updateOne(
      { id: req.params.id },
      { $set: { active: false, status: "DISABLED", updatedAt: new Date() } }
    );
    const driver = await db.collection("drivers").findOne({ id: req.params.id });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "DRIVER_DISABLED",
      targetId: driver.id,
      actorId: req.user.id,
      metadata: { driverName: driver.name },
      createdAt: new Date()
    });

    res.json(publicDriver(driver));
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/drivers/:id/verify", requireAdmin, async (req, res, next) => {
  try {
    await db.collection("drivers").updateOne(
      { id: req.params.id },
      { $set: { verified: true, status: "APPROVED", active: true, updatedAt: new Date() } }
    );
    const driver = await db.collection("drivers").findOne({ id: req.params.id });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "DRIVER_VERIFIED",
      targetId: driver.id,
      actorId: req.user.id,
      metadata: { driverName: driver.name },
      createdAt: new Date()
    });

    res.json({ ...publicDriver(driver), adminLog: "DRIVER_VERIFIED" });
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/drivers/:id/premium", requireAdmin, async (req, res, next) => {
  try {
    await db.collection("drivers").updateOne(
      { id: req.params.id },
      { $set: { premium: true, updatedAt: new Date() } }
    );
    const driver = await db.collection("drivers").findOne({ id: req.params.id });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "DRIVER_PREMIUM_ENABLED",
      targetId: driver.id,
      actorId: req.user.id,
      metadata: { driverName: driver.name },
      createdAt: new Date()
    });

    res.json({ ...publicDriver(driver), adminLog: "DRIVER_PREMIUM_ENABLED" });
  } catch (error) {
    next(error);
  }
});

app.get("/admin/bookings", requireAdmin, async (_req, res, next) => {
  try {
    const bookings = await db.collection("bookings").aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "drivers",
          localField: "driverId",
          foreignField: "id",
          as: "driver"
        }
      },
      { $addFields: { driverName: { $first: "$driver.name" } } },
      {
        $lookup: {
          from: "payments",
          localField: "id",
          foreignField: "bookingId",
          as: "payment"
        }
      },
      { $addFields: { payment: { $first: "$payment" } } },
      { $project: { driver: 0 } }
    ]).toArray();
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/bookings/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!bookingStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid booking status" });
    }

    await db.collection("bookings").updateOne(
      { id: req.params.id },
      { $set: { status, updatedAt: new Date() } }
    );
    const booking = await db.collection("bookings").findOne({ id: req.params.id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "BOOKING_STATUS_UPDATED",
      targetId: booking.id,
      actorId: req.user.id,
      metadata: { status },
      createdAt: new Date()
    });

    await emitBookingUpdate(booking.id);
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/bookings/:id", requireAdmin, async (req, res, next) => {
  try {
    const updates = {};
    const fields = [
      "pickup",
      "dropoff",
      "customerName",
      "customerPhone",
      "customerWhatsapp",
      "customerEmail",
      "note"
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) updates[field] = String(req.body[field]);
    }

    if (req.body.driverId !== undefined) {
      if (req.body.driverId) {
        const driver = await db.collection("drivers").findOne({ id: String(req.body.driverId), active: { $ne: false } });
        if (!driver) return res.status(400).json({ message: "Selected driver was not found or is inactive" });
        updates.driverId = driver.id;
      } else {
        updates.driverId = null;
      }
    }

    if (req.body.pickupAt !== undefined) {
      const pickupAt = new Date(req.body.pickupAt);
      if (Number.isNaN(pickupAt.getTime())) return res.status(400).json({ message: "Invalid pickup date" });
      updates.pickupAt = pickupAt;
    }

    if (req.body.passengers !== undefined) {
      const passengers = Number(req.body.passengers);
      if (!Number.isFinite(passengers) || passengers < 1) return res.status(400).json({ message: "Invalid passenger count" });
      updates.passengers = passengers;
    }

    if (req.body.distanceKm !== undefined) {
      const distanceKm = Number(req.body.distanceKm);
      if (!Number.isFinite(distanceKm) || distanceKm < 1) return res.status(400).json({ message: "Invalid distance" });
      updates.distanceKm = distanceKm;
      const currentBooking = await db.collection("bookings").findOne({ id: req.params.id });
      const driverId = updates.driverId !== undefined ? updates.driverId : currentBooking?.driverId;
      const vehicleCategory = !driverId && currentBooking?.vehicleCategoryId
        ? await getVehicleCategoryForBooking(currentBooking.vehicleCategoryId, { fallbackToDefault: false })
        : null;
      updates.estimatedPriceLak = await calculateBookingPrice(
        distanceKm,
        driverId,
        currentBooking?.fareMode || "FIXED",
        currentBooking?.durationMinutes || 0,
        vehicleCategory
      );
    }

    if (req.body.driverId !== undefined && updates.estimatedPriceLak === undefined) {
      const currentBooking = await db.collection("bookings").findOne({ id: req.params.id });
      if (currentBooking?.bookingType !== "TOUR" && currentBooking?.distanceKm) {
        const vehicleCategory = !updates.driverId && currentBooking.vehicleCategoryId
          ? await getVehicleCategoryForBooking(currentBooking.vehicleCategoryId, { fallbackToDefault: false })
          : null;
        updates.estimatedPriceLak = await calculateBookingPrice(
          currentBooking.distanceKm,
          updates.driverId,
          currentBooking.fareMode || "FIXED",
          currentBooking.durationMinutes || 0,
          vehicleCategory
        );
      }
    }

    if (req.body.status !== undefined) {
      if (!bookingStatuses.includes(req.body.status)) return res.status(400).json({ message: "Invalid booking status" });
      updates.status = req.body.status;
    }

    updates.updatedAt = new Date();

    const result = await db.collection("bookings").updateOne({ id: req.params.id }, { $set: updates });
    if (result.matchedCount === 0) return res.status(404).json({ message: "Booking not found" });

    const booking = await db.collection("bookings").findOne({ id: req.params.id });
    if (updates.estimatedPriceLak !== undefined) {
      await db.collection("payments").updateOne(
        { bookingId: booking.id },
        { $set: { amountLak: booking.estimatedPriceLak, updatedAt: new Date() } }
      );
    }

    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "BOOKING_UPDATED",
      targetId: booking.id,
      actorId: req.user.id,
      metadata: { fields: Object.keys(updates) },
      createdAt: new Date()
    });

    await emitBookingUpdate(booking.id);
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

app.get("/admin/payments", requireAdmin, async (_req, res, next) => {
  try {
    const payments = await db.collection("payments").find({}).sort({ createdAt: -1 }).toArray();
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

function buildManagedPlacePayload(body, existing = {}) {
  const nameLo = String(body.nameLo ?? existing.nameLo ?? "").trim();
  const nameEn = String(body.nameEn ?? existing.nameEn ?? "").trim();
  const aliases = Array.isArray(body.aliases)
    ? body.aliases.map((value) => String(value).trim()).filter(Boolean).slice(0, 30)
    : (existing.aliases || []);
  const longitude = Number(body.longitude ?? existing.location?.coordinates?.[0]);
  const latitude = Number(body.latitude ?? existing.location?.coordinates?.[1]);

  if (!nameLo && !nameEn) throw new Error("Place name is required");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Valid place coordinates are required");
  }

  const address = String(body.address ?? existing.address ?? "").trim();
  const province = String(body.province ?? existing.province ?? "").trim();
  const district = String(body.district ?? existing.district ?? "").trim();
  const village = String(body.village ?? existing.village ?? "").trim();
  const searchNames = [...new Set([nameLo, nameEn, ...aliases].map(normalizePlaceText).filter(Boolean))];

  return {
    nameLo,
    nameEn,
    aliases,
    category: String(body.category ?? existing.category ?? "place").trim() || "place",
    address,
    province,
    district,
    village,
    location: { type: "Point", coordinates: [longitude, latitude] },
    searchNames,
    searchText: normalizePlaceText([nameLo, nameEn, aliases.join(" "), address, province, district, village].join(" ")),
    verified: body.verified !== undefined ? Boolean(body.verified) : existing.verified !== false,
    featured: body.featured !== undefined ? Boolean(body.featured) : Boolean(existing.featured),
    active: body.active !== undefined ? Boolean(body.active) : existing.active !== false,
    popularity: Number.isFinite(Number(body.popularity)) ? Math.max(0, Number(body.popularity)) : Number(existing.popularity || 0),
    updatedAt: new Date()
  };
}

app.get("/admin/places", requireAdmin, async (req, res, next) => {
  try {
    const query = normalizePlaceText(req.query.q);
    const filter = query
      ? { $or: [{ searchNames: new RegExp(escapeRegex(query), "i") }, { searchText: new RegExp(escapeRegex(query), "i") }] }
      : {};
    const places = await db.collection("places")
      .find(filter)
      .sort({ active: -1, verified: -1, featured: -1, popularity: -1, updatedAt: -1 })
      .limit(300)
      .toArray();
    res.json(places.map(publicManagedPlace));
  } catch (error) {
    next(error);
  }
});

app.get("/admin/places/search-insights", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db.collection("placeSearchLogs").aggregate([
      { $match: { selected: { $ne: true }, normalizedQuery: { $ne: "" } } },
      { $group: { _id: "$normalizedQuery", searches: { $sum: 1 }, lastSearchedAt: { $max: "$createdAt" }, maxResults: { $max: "$resultCount" } } },
      { $sort: { searches: -1, lastSearchedAt: -1 } },
      { $limit: 30 }
    ]).toArray();
    res.json(rows.map((row) => ({
      query: row._id,
      searches: row.searches,
      resultCount: row.maxResults || 0,
      lastSearchedAt: row.lastSearchedAt
    })));
  } catch (error) {
    next(error);
  }
});

app.post("/admin/places", requireAdmin, async (req, res, next) => {
  try {
    const payload = buildManagedPlacePayload(req.body);
    const place = { id: randomUUID(), ...payload, createdAt: new Date() };
    await db.collection("places").insertOne(place);
    placeSearchCache.clear();
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "PLACE_CREATED",
      targetId: place.id,
      actorId: req.user.id,
      metadata: { nameLo: place.nameLo, category: place.category },
      createdAt: new Date()
    });
    res.status(201).json(publicManagedPlace(place));
  } catch (error) {
    res.status(400).json({ message: error.message || "Invalid place data" });
  }
});

app.patch("/admin/places/:id", requireAdmin, async (req, res, next) => {
  try {
    const existing = await db.collection("places").findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ message: "Place not found" });
    const payload = buildManagedPlacePayload(req.body, existing);
    await db.collection("places").updateOne({ id: existing.id }, { $set: payload });
    placeSearchCache.clear();
    const place = await db.collection("places").findOne({ id: existing.id });
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "PLACE_UPDATED",
      targetId: place.id,
      actorId: req.user.id,
      metadata: { nameLo: place.nameLo, fields: Object.keys(req.body) },
      createdAt: new Date()
    });
    res.json(publicManagedPlace(place));
  } catch (error) {
    res.status(400).json({ message: error.message || "Invalid place data" });
  }
});

app.delete("/admin/places/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await db.collection("places").findOneAndUpdate(
      { id: req.params.id },
      { $set: { active: false, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!result) return res.status(404).json({ message: "Place not found" });
    placeSearchCache.clear();
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "PLACE_DISABLED",
      targetId: result.id,
      actorId: req.user.id,
      metadata: { nameLo: result.nameLo },
      createdAt: new Date()
    });
    res.json(publicManagedPlace(result));
  } catch (error) {
    next(error);
  }
});

app.get("/admin/tours", requireAdmin, async (_req, res, next) => {
  try {
    const tours = await db.collection("tours").find({}).sort({ active: -1, createdAt: -1 }).toArray();
    res.json(tours);
  } catch (error) {
    next(error);
  }
});

app.post("/admin/tours", requireAdmin, async (req, res, next) => {
  try {
    const { title, city, duration, priceLak, description, imageUrl, driverId, active, featuredOnHome, sortOrder } = req.body;
    const imageFields = saveImageFields(req, ["imageUrl"], "tours");
    if (!title || !city || !duration || !priceLak || !description) {
      return res.status(400).json({ message: "Tour title, city, duration, price, and description are required" });
    }

    if (driverId) {
      const driver = await db.collection("drivers").findOne({ id: String(driverId), active: { $ne: false } });
      if (!driver) return res.status(400).json({ message: "Selected driver was not found or is inactive" });
    }

    const tour = {
      id: randomUUID(),
      title,
      city,
      duration,
      priceLak: Number(priceLak),
      description,
      imageUrl: imageFields.imageUrl || imageUrl || "",
      driverId: driverId || "",
      featuredOnHome: featuredOnHome !== false,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      active: active !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection("tours").insertOne(tour);
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "TOUR_CREATED",
      targetId: tour.id,
      actorId: req.user.id,
      metadata: { title: tour.title },
      createdAt: new Date()
    });

    res.status(201).json(tour);
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/tours/:id", requireAdmin, async (req, res, next) => {
  try {
    const updates = {};
    const fields = ["title", "city", "duration", "description", "imageUrl", "driverId"];

    for (const field of fields) {
      if (req.body[field] !== undefined) updates[field] = String(req.body[field]);
    }

    Object.assign(updates, saveImageFields(req, ["imageUrl"], "tours"));

    if (req.body.priceLak !== undefined) updates.priceLak = Number(req.body.priceLak);
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
    if (req.body.featuredOnHome !== undefined) updates.featuredOnHome = Boolean(req.body.featuredOnHome);
    if (req.body.sortOrder !== undefined) updates.sortOrder = Number(req.body.sortOrder) || 0;

    if (updates.driverId) {
      const driver = await db.collection("drivers").findOne({ id: updates.driverId, active: { $ne: false } });
      if (!driver) return res.status(400).json({ message: "Selected driver was not found or is inactive" });
    }

    updates.updatedAt = new Date();
    const result = await db.collection("tours").updateOne({ id: req.params.id }, { $set: updates });
    if (result.matchedCount === 0) return res.status(404).json({ message: "Tour package not found" });

    const tour = await db.collection("tours").findOne({ id: req.params.id });
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "TOUR_UPDATED",
      targetId: tour.id,
      actorId: req.user.id,
      metadata: { title: tour.title },
      createdAt: new Date()
    });

    res.json(tour);
  } catch (error) {
    next(error);
  }
});

app.delete("/admin/tours/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await db.collection("tours").updateOne(
      { id: req.params.id },
      { $set: { active: false, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ message: "Tour package not found" });

    const tour = await db.collection("tours").findOne({ id: req.params.id });
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "TOUR_DISABLED",
      targetId: tour.id,
      actorId: req.user.id,
      metadata: { title: tour.title },
      createdAt: new Date()
    });

    res.json(tour);
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/payments/:id", requireAdmin, async (req, res, next) => {
  try {
    const updates = {};

    if (req.body.status !== undefined) {
      if (!paymentStatuses.includes(req.body.status)) return res.status(400).json({ message: "Invalid payment status" });
      updates.status = req.body.status;
    }

    if (req.body.method !== undefined) {
      if (!paymentMethods.includes(req.body.method)) return res.status(400).json({ message: "Invalid payment method" });
      updates.method = req.body.method;
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No payment fields to update" });
    updates.updatedAt = new Date();

    const result = await db.collection("payments").updateOne({ id: req.params.id }, { $set: updates });
    if (result.matchedCount === 0) return res.status(404).json({ message: "Payment not found" });

    const payment = await db.collection("payments").findOne({ id: req.params.id });
    await db.collection("adminLogs").insertOne({
      id: randomUUID(),
      action: "PAYMENT_UPDATED",
      targetId: payment.id,
      actorId: req.user.id,
      metadata: updates,
      createdAt: new Date()
    });

    res.json(payment);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Server error", detail: error.message });
});

async function start() {
  await mongo.connect();
  db = mongo.db(mongoDbName);
  await seedIfEmpty();

  app.listen(port, () => {
    console.log(`TAXILAO API running at http://localhost:${port}`);
    console.log(`MongoDB connected: ${safeMongoLabel(mongoUri)}`);
  });
}

process.on("SIGINT", async () => {
  await mongo.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await mongo.close();
  process.exit(0);
});

start().catch((error) => {
  console.error("Failed to start TAXILAO API:", error.message);
  if (mongoUri.startsWith("mongodb+srv://")) {
    console.error("Check MongoDB Atlas: Network Access must allow this computer's IP, and the cluster must be running.");
  } else {
    console.error("Make sure MongoDB is running locally at mongodb://127.0.0.1:27017");
  }
  process.exit(1);
});
