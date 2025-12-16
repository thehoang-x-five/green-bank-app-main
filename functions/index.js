/**
 * Firebase Functions (v2) entrypoint
 * - HTTP: sendOtpEmail (demo, Gmail SMTP)
 * - Callable: nearbyPois (Overpass OSM + Firestore cache)
 */
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { defineString } = require("firebase-functions/params");
const { onRequest, HttpsError } = require("firebase-functions/v2/https");
const fs = require("fs");
const path = require("path");

if (!admin.apps.length) {
  admin.initializeApp();
}

// SMTP config via params (set with: firebase functions:secrets:set SMTP_EMAIL / SMTP_PASS)
const smtpEmail = defineString("SMTP_EMAIL");
const smtpPass = defineString("SMTP_PASS");

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpEmail.value(),
      pass: smtpPass.value(),
    },
  });
}

exports.sendOtpEmail = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const { email, otp, txnId } = req.body || {};
    if (!email || !otp) {
      res.status(400).send("Missing email or OTP");
      return;
    }

    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"VietBank Digital" <${smtpEmail.value()}>`,
        to: email,
        subject: "Mã OTP xác thực giao dịch VietBank",
        text: `Mã OTP của bạn: ${otp} cho giao dịch ${txnId || ""}.`,
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("sendOtpEmail error:", err);
      res.status(500).send("Failed to send email");
    }
  }
);

/* =========================================================
 * Callable: nearbyPois
 * ========================================================= */
const firestore = admin.firestore();

const DEFAULT_TTL_SEC = 120;
const RADIUS_MIN = 50;
const RADIUS_MAX = 20000;
const LIMIT_MIN = 1;
const LIMIT_MAX = 200;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ensureNumber(name, v) {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new HttpsError("invalid-argument", `${name} invalid`);
  }
}

function ensureStringOpt(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") {
    throw new HttpsError("invalid-argument", "amenity invalid");
  }
  const s = v.trim();
  return s.length ? s : undefined;
}

function geoCell(lat, lon, cellSize = 0.02) {
  const latKey = Math.floor(lat / cellSize);
  const lonKey = Math.floor(lon / cellSize);
  return `${cellSize}:${latKey}:${lonKey}`;
}

function makeCacheKey(lat, lon, radiusM, amenity) {
  const cell = geoCell(lat, lon, 0.02);
  const r = Math.max(RADIUS_MIN, Math.round(radiusM / 50) * 50);
  return `nearby:${cell}:r${r}:${amenity}`;
}

async function getCache(key) {
  try {
    const snap = await firestore.collection("poi_cache").doc(key).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data || !data.expiresAt) return null;
    const expires = data.expiresAt.toMillis
      ? data.expiresAt.toMillis()
      : data.expiresAt;
    if (Date.now() >= expires) return null;
    return data.payload || null;
  } catch (err) {
    console.warn("getCache error (ignored):", err);
    return null; // ignore cache failures (e.g., emulator without Firestore)
  }
}

async function setCache(key, payload, ttlSeconds) {
  try {
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + ttlSeconds * 1000
    );
    await firestore.collection("poi_cache").doc(key).set({
      key,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      payload,
    });
  } catch (err) {
    console.warn("setCache error (ignored):", err);
  }
}

function buildOverpassQuery(lat, lon, radiusM, amenity) {
  return `
[out:json][timeout:25];
(
  node(around:${radiusM},${lat},${lon})["amenity"="${amenity}"];
  way(around:${radiusM},${lat},${lon})["amenity"="${amenity}"];
  relation(around:${radiusM},${lat},${lon})["amenity"="${amenity}"];
);
out center;
`.trim();
}

async function fetchOverpassNearby({ lat, lon, radiusM, amenity, limit }) {
  const query = buildOverpassQuery(lat, lon, radiusM, amenity);
  const body = new URLSearchParams({ data: query }).toString();

  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Overpass failed ${resp.status}: ${txt.slice(0, 400)}`);
  }

  const data = await resp.json();
  const elements = Array.isArray(data.elements) ? data.elements : [];
  const pois = [];

  for (const el of elements) {
    const latVal = el.lat ?? el.center?.lat;
    const lonVal = el.lon ?? el.center?.lon;
    if (typeof latVal !== "number" || typeof lonVal !== "number") continue;

    const name =
      (el.tags && (el.tags.name || el.tags["name:en"])) || "Unnamed";

    pois.push({
      id: String(el.id),
      name: String(name),
      lat: latVal,
      lon: lonVal,
      tags: el.tags || undefined,
    });

    if (pois.length >= limit) break;
  }

  return pois;
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function fetchLocalBankPois(lat, lon, radiusM) {
  try {
    const snap = await firestore.collection("bank_pois").get();
    if (snap.empty) return [];

    const list = [];
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const latVal = typeof data.lat === "number" ? data.lat : Number(data.lat);
      const lonVal = typeof data.lon === "number" ? data.lon : Number(data.lon);
      if (!Number.isFinite(latVal) || !Number.isFinite(lonVal)) return;

      const dist = haversineM(lat, lon, latVal, lonVal);
      if (dist > radiusM) return;

      list.push({
        id: `local:${doc.id}`,
        name: data.name || "Viet Bank TQT",
        lat: latVal,
        lon: lonVal,
        tags: {
          amenity: data.type === "ATM" ? "atm" : "bank",
          address: data.address || "",
          region: data.region || "south",
          source: "local",
        },
        distanceM: dist,
      });
    });

    return list;
  } catch (err) {
    console.warn("fetchLocalBankPois error (ignored):", err);
    return [];
  }
}

exports.nearbyPois = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    // CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    try {
      // Verify Firebase ID token
      const authHeader = req.headers.authorization || "";
      const match = authHeader.match(/^Bearer (.+)$/);
      if (!match) {
        throw new HttpsError("unauthenticated", "Missing bearer token");
      }
      const idToken = match[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (!decoded?.uid) {
        throw new HttpsError("unauthenticated", "Invalid token");
      }

      const data = req.body || {};
      ensureNumber("lat", data.lat);
      ensureNumber("lon", data.lon);
      ensureNumber("radiusM", data.radiusM);

      const amenity = ensureStringOpt(data.amenity) || "atm";
      const radiusM = clamp(data.radiusM, RADIUS_MIN, RADIUS_MAX);
      const limit =
        clamp(
          typeof data.limit === "number" ? data.limit : 80,
          LIMIT_MIN,
          LIMIT_MAX
        ) || 80;

      const cacheKey = makeCacheKey(data.lat, data.lon, radiusM, amenity);

      const cached = await getCache(cacheKey);
      if (cached) {
        res.status(200).json({
          pois: cached.pois || [],
          cached: true,
          source: "overpass",
        });
        return;
      }

      // Combine local bank_pois + Overpass
      const localPois = await fetchLocalBankPois(
        data.lat,
        data.lon,
        radiusM
      );

      const overpassPois = await fetchOverpassNearby({
        lat: data.lat,
        lon: data.lon,
        radiusM,
        amenity,
        limit,
      });

      const pois = [...localPois, ...overpassPois];

      await setCache(cacheKey, { pois, source: "overpass" }, DEFAULT_TTL_SEC);

      res.status(200).json({ pois, cached: false, source: "overpass" });
    } catch (err) {
      console.error("nearbyPois error:", err);
      if (err instanceof HttpsError) {
        res.status(401).json({ error: err.message });
      } else {
        res.status(500).json({ error: "Failed to fetch POI" });
      }
    }
  }
);

/* =========================================================
 * Shared helpers: CORS, auth, caching
 * ========================================================= */
const FUNCTIONS_REGION = "asia-southeast1";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "https://localhost:5173",
  "https://localhost:5174",
  "https://localhost:5175",
  "capacitor://localhost",
  "ionic://localhost",
]);
const ONE_DAY_SEC = 24 * 60 * 60;
const SIX_HOURS_SEC = 6 * 60 * 60;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https?:\/\/localhost:\d+$/i.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1:\d+$/i.test(origin)) return true;
  return false;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Seed-Secret");
  res.set("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

async function verifyIdTokenOptional(req) {
  const authHeader = req.get("Authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : undefined;
  const token = bearer || req.get("x-id-token");
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    console.warn("verifyIdTokenOptional failed:", err?.message || err);
    return null;
  }
}

async function getApiCache(key) {
  try {
    const snap = await firestore.collection("api_cache").doc(key).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data?.expiresAt) return null;
    const expires = data.expiresAt.toMillis
      ? data.expiresAt.toMillis()
      : data.expiresAt;
    if (Date.now() >= expires) return null;
    return data.payload || null;
  } catch (err) {
    console.warn("getApiCache error (ignored):", err);
    return null;
  }
}

async function setApiCache(key, payload, ttlSeconds) {
  try {
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + ttlSeconds * 1000
    );
    await firestore.collection("api_cache").doc(key).set({
      key,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      payload,
    });
  } catch (err) {
    console.warn("setApiCache error (ignored):", err);
  }
}

function roundCoord(value) {
  return Number(value.toFixed(3));
}

/* =========================================================
 * HTTP: getCountriesNow (proxy + cache)
 * ========================================================= */
const COUNTRIES_ENDPOINT =
  "https://countriesnow.space/api/v0.1/countries/positions";
const STATES_ENDPOINT = "https://countriesnow.space/api/v0.1/countries/states";
const CITIES_ENDPOINT =
  "https://countriesnow.space/api/v0.1/countries/state/cities";

async function fetchCountriesNow(action, country, state) {
  if (action === "countries") {
    const resp = await fetch(COUNTRIES_ENDPOINT);
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Countries endpoint failed ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    const arr = Array.isArray(json?.data) ? json.data : [];
    return arr.map((c) => c.name).filter(Boolean);
  }

  if (action === "states") {
    if (!country || typeof country !== "string") {
      throw new Error("country required for states action");
    }
    const resp = await fetch(STATES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`States endpoint failed ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    const states = Array.isArray(json?.data?.states)
      ? json.data.states
      : [];
    return states.map((s) => s.name).filter(Boolean);
  }

  if (action === "cities") {
    if (!country || !state) {
      throw new Error("country/state required for cities action");
    }
    const resp = await fetch(CITIES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, state }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Cities endpoint failed ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    const cities = Array.isArray(json?.data?.cities) ? json.data.cities : [];
    return cities.filter(Boolean);
  }

  throw new Error("Unsupported action");
}

exports.getCountriesNow = onRequest(
  { region: FUNCTIONS_REGION },
  async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    await verifyIdTokenOptional(req);

    const { action, country, state } = req.body || {};
    if (!action) {
      res.status(400).json({ error: "action is required" });
      return;
    }

    const cacheKey = `countriesnow:${action}:${String(country || "all").toLowerCase()}:${String(state || "all").toLowerCase()}`;
    const cached = await getApiCache(cacheKey);
    if (cached) {
      res.status(200).json({ data: cached, cached: true });
      return;
    }

    try {
      const data = await fetchCountriesNow(action, country, state);
      await setApiCache(cacheKey, data, ONE_DAY_SEC);
      res.status(200).json({ data, cached: false });
    } catch (err) {
      console.error("getCountriesNow error:", err);
      res.status(500).json({ error: "Failed to fetch CountriesNow" });
    }
  }
);

/* =========================================================
 * HTTP: reverseGeocode (proxy + cache)
 * ========================================================= */
exports.reverseGeocode = onRequest(
  { region: FUNCTIONS_REGION },
  async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    await verifyIdTokenOptional(req);

    const { lat, lon } = req.body || {};
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      res.status(400).json({ error: "lat and lon are required numbers" });
      return;
    }

    const key = `revgeo:${roundCoord(latNum)}:${roundCoord(lonNum)}`;
    const cached = await getApiCache(key);
    if (cached) {
      res.status(200).json({ ...cached, cached: true });
      return;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latNum}&lon=${lonNum}&addressdetails=1`;
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "green-bank-app/1.0 (https://github.com/)",
        },
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Nominatim failed ${resp.status}: ${txt}`);
      }
      const json = await resp.json();
      const address = json?.address || {};
      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.state_district ||
        address.county;
      const payload = {
        city: city || undefined,
        state: address.state || address.region || undefined,
        country: address.country || undefined,
        displayName: json?.display_name || undefined,
      };
      await setApiCache(key, payload, SIX_HOURS_SEC);
      res.status(200).json(payload);
    } catch (err) {
      console.error("reverseGeocode error:", err);
      res.status(500).json({ error: "Failed to reverse geocode" });
    }
  }
);

/* =========================================================
 * HTTP: getVnLocations (static list or Firestore seed)
 * ========================================================= */
let cachedVnLocations = null;
exports.getVnLocations = onRequest({ region: FUNCTIONS_REGION }, async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (cachedVnLocations) {
    res.status(200).json({ data: cachedVnLocations, cached: true });
    return;
  }

  // Try Firestore locations_vn
  try {
    const snap = await admin.firestore().collection("locations_vn").limit(200).get();
    if (!snap.empty) {
      cachedVnLocations = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      res.status(200).json({ data: cachedVnLocations, source: "firestore" });
      return;
    }
  } catch (err) {
    console.warn("getVnLocations Firestore error, fallback to JSON:", err);
  }

  // Fallback JSON file
  try {
    const filePath = path.join(__dirname, "getVnLocations.json");
    const raw = fs.readFileSync(filePath, "utf8");
    cachedVnLocations = JSON.parse(raw);
    res.status(200).json({ data: cachedVnLocations, source: "file" });
  } catch (err) {
    console.error("getVnLocations file error:", err);
    res.status(500).json({ error: "Failed to load VN locations" });
  }
});

/* =========================================================
 * HTTP: Provinces Open API proxy
 * ========================================================= */
const PROVINCES_API = "https://provinces.open-api.vn/api";

async function callProvincesApi(pathStr) {
  const resp = await fetch(`${PROVINCES_API}${pathStr}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Provinces API failed ${resp.status}: ${txt.slice(0, 300)}`);
  }
  return await resp.json();
}

exports.getVnProvinces = onRequest({ region: FUNCTIONS_REGION }, async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const cacheKey = "vn_provinces_depth1";
  const cached = await getApiCache(cacheKey);
  if (cached) {
    res.status(200).json({ data: cached, cached: true });
    return;
  }
  try {
    const data = await callProvincesApi("/?depth=1");
    await setApiCache(cacheKey, data, ONE_DAY_SEC);
    res.status(200).json({ data, cached: false });
  } catch (err) {
    console.error("getVnProvinces error:", err);
    res.status(500).json({ error: "Failed to fetch provinces" });
  }
});

exports.getVnDistricts = onRequest({ region: FUNCTIONS_REGION }, async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { provinceCode } = req.query;
  if (!provinceCode) {
    res.status(400).json({ error: "provinceCode is required" });
    return;
  }
  const cacheKey = `vn_districts_${provinceCode}`;
  const cached = await getApiCache(cacheKey);
  if (cached) {
    res.status(200).json({ data: cached, cached: true });
    return;
  }
  try {
    const data = await callProvincesApi(`/p/${provinceCode}?depth=2`);
    const districts = Array.isArray(data?.districts) ? data.districts : [];
    await setApiCache(cacheKey, districts, ONE_DAY_SEC);
    res.status(200).json({ data: districts, cached: false });
  } catch (err) {
    console.error("getVnDistricts error:", err);
    res.status(500).json({ error: "Failed to fetch districts" });
  }
});

exports.getVnWards = onRequest({ region: FUNCTIONS_REGION }, async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { districtCode } = req.query;
  if (!districtCode) {
    res.status(400).json({ error: "districtCode is required" });
    return;
  }
  const cacheKey = `vn_wards_${districtCode}`;
  const cached = await getApiCache(cacheKey);
  if (cached) {
    res.status(200).json({ data: cached, cached: true });
    return;
  }
  try {
    const data = await callProvincesApi(`/d/${districtCode}?depth=2`);
    const wards = Array.isArray(data?.wards) ? data.wards : [];
    await setApiCache(cacheKey, wards, ONE_DAY_SEC);
    res.status(200).json({ data: wards, cached: false });
  } catch (err) {
    console.error("getVnWards error:", err);
    res.status(500).json({ error: "Failed to fetch wards" });
  }
});

/* =========================================================
 * Dev helper: seedHotelsDemo (Firestore demo data)
 * ========================================================= */
const HOTELS_DEMO = [
  {
    cityKey: "VN_HN",
    name: "GreenBank Hotel Hanoi",
    lat: 21.0285,
    lon: 105.8542,
    stars: 4,
    rating: 4.3,
    priceFrom: 850000,
    distanceToCenterKm: 1.2,
    amenities: ["wifi", "breakfast", "pool"],
    images: [],
  },
  {
    cityKey: "VN_HN",
    name: "Lakeview Boutique Hanoi",
    lat: 21.0332,
    lon: 105.8508,
    stars: 4,
    rating: 4.6,
    priceFrom: 980000,
    distanceToCenterKm: 0.8,
    amenities: ["wifi", "breakfast"],
    images: [],
  },
  {
    cityKey: "VN_HN",
    name: "Old Quarter Premier",
    lat: 21.0364,
    lon: 105.8459,
    stars: 5,
    rating: 4.8,
    priceFrom: 1450000,
    distanceToCenterKm: 0.5,
    amenities: ["wifi", "breakfast", "gym"],
    images: [],
  },
  {
    cityKey: "VN_HN",
    name: "Westlake Executive",
    lat: 21.0581,
    lon: 105.8197,
    stars: 4,
    rating: 4.2,
    priceFrom: 760000,
    distanceToCenterKm: 3.1,
    amenities: ["wifi", "pool"],
    images: [],
  },
  {
    cityKey: "VN_HCM",
    name: "GreenBank Saigon Riverside",
    lat: 10.7758,
    lon: 106.7009,
    stars: 5,
    rating: 4.7,
    priceFrom: 1650000,
    distanceToCenterKm: 0.9,
    amenities: ["wifi", "breakfast", "pool", "gym"],
    images: [],
  },
  {
    cityKey: "VN_HCM",
    name: "Ben Thanh Suites",
    lat: 10.7721,
    lon: 106.6983,
    stars: 4,
    rating: 4.4,
    priceFrom: 920000,
    distanceToCenterKm: 0.4,
    amenities: ["wifi", "breakfast"],
    images: [],
  },
  {
    cityKey: "VN_HCM",
    name: "District 1 Skyline",
    lat: 10.7769,
    lon: 106.7033,
    stars: 4,
    rating: 4.5,
    priceFrom: 1180000,
    distanceToCenterKm: 0.7,
    amenities: ["wifi", "gym"],
    images: [],
  },
  {
    cityKey: "VN_HCM",
    name: "Pho Co Heritage Saigon",
    lat: 10.7698,
    lon: 106.6899,
    stars: 3,
    rating: 4.1,
    priceFrom: 620000,
    distanceToCenterKm: 1.4,
    amenities: ["wifi"],
    images: [],
  },
  {
    cityKey: "VN_DN",
    name: "Han River View",
    lat: 16.0704,
    lon: 108.2245,
    stars: 4,
    rating: 4.4,
    priceFrom: 780000,
    distanceToCenterKm: 1.0,
    amenities: ["wifi", "breakfast"],
    images: [],
  },
  {
    cityKey: "VN_DN",
    name: "My Khe Beachfront",
    lat: 16.0621,
    lon: 108.2457,
    stars: 4,
    rating: 4.5,
    priceFrom: 1050000,
    distanceToCenterKm: 2.6,
    amenities: ["wifi", "pool", "breakfast"],
    images: [],
  },
  {
    cityKey: "VN_DN",
    name: "Dragon Bridge Hotel",
    lat: 16.0614,
    lon: 108.2291,
    stars: 3,
    rating: 4.0,
    priceFrom: 540000,
    distanceToCenterKm: 1.3,
    amenities: ["wifi"],
    images: [],
  },
  {
    cityKey: "VN_DN",
    name: "Son Tra Retreat",
    lat: 16.083,
    lon: 108.2476,
    stars: 5,
    rating: 4.7,
    priceFrom: 1580000,
    distanceToCenterKm: 4.2,
    amenities: ["wifi", "pool", "gym", "spa"],
    images: [],
  },
  {
    cityKey: "VN_NT",
    name: "Nha Trang Central",
    lat: 12.2388,
    lon: 109.1967,
    stars: 4,
    rating: 4.3,
    priceFrom: 820000,
    distanceToCenterKm: 0.8,
    amenities: ["wifi", "breakfast"],
    images: [],
  },
  {
    cityKey: "VN_NT",
    name: "Tram Huong Bay Resort",
    lat: 12.2216,
    lon: 109.2057,
    stars: 5,
    rating: 4.8,
    priceFrom: 1720000,
    distanceToCenterKm: 2.0,
    amenities: ["wifi", "pool", "gym", "spa"],
    images: [],
  },
  {
    cityKey: "VN_NT",
    name: "Blue Coral Hotel",
    lat: 12.252,
    lon: 109.1895,
    stars: 3,
    rating: 4.1,
    priceFrom: 590000,
    distanceToCenterKm: 1.6,
    amenities: ["wifi"],
    images: [],
  },
  {
    cityKey: "VN_NT",
    name: "Seaside Boulevard",
    lat: 12.2334,
    lon: 109.2082,
    stars: 4,
    rating: 4.5,
    priceFrom: 940000,
    distanceToCenterKm: 1.1,
    amenities: ["wifi", "pool"],
    images: [],
  },
  {
    cityKey: "VN_HN",
    name: "Hoan Kiem Luxe",
    lat: 21.0313,
    lon: 105.8521,
    stars: 5,
    rating: 4.9,
    priceFrom: 1950000,
    distanceToCenterKm: 0.3,
    amenities: ["wifi", "breakfast", "pool", "spa"],
    images: [],
  },
  {
    cityKey: "VN_HCM",
    name: "Thu Thiem River Park",
    lat: 10.7801,
    lon: 106.721,
    stars: 4,
    rating: 4.2,
    priceFrom: 870000,
    distanceToCenterKm: 2.2,
    amenities: ["wifi", "pool"],
    images: [],
  },
  {
    cityKey: "VN_DN",
    name: "Marble Mountain Retreat",
    lat: 16.0,
    lon: 108.263,
    stars: 4,
    rating: 4.4,
    priceFrom: 880000,
    distanceToCenterKm: 6.5,
    amenities: ["wifi", "breakfast", "pool"],
    images: [],
  },
  {
    cityKey: "VN_NT",
    name: "Hon Chong Vista",
    lat: 12.2695,
    lon: 109.196,
    stars: 4,
    rating: 4.3,
    priceFrom: 990000,
    distanceToCenterKm: 3.4,
    amenities: ["wifi", "breakfast"],
    images: [],
  },
];

const MIN_VN_LOCATIONS = [
  { id: "VN_HN", name: "Hà Nội", type: "province" },
  { id: "VN_HCM", name: "TP.HCM", type: "province" },
  { id: "VN_DN", name: "Đà Nẵng", type: "province" },
  { id: "VN_NT", name: "Khánh Hòa", type: "province" },
];

async function seedHotelsDemoData() {
  const hotelsRef = firestore.collection("hotels");
  const existing = await hotelsRef.limit(1).get();
  if (!existing.empty) {
    return { skipped: true, reason: "Collection not empty" };
  }

  const batch = firestore.batch();
  HOTELS_DEMO.forEach((hotel, idx) => {
    const ref = hotelsRef.doc(`demo-${idx + 1}`);
    batch.set(ref, {
      ...hotel,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  return { skipped: false, inserted: HOTELS_DEMO.length };
}

async function seedMinimalLocations() {
  const coll = firestore.collection("locations_vn");
  const snap = await coll.limit(1).get();
  if (!snap.empty) return { skipped: true, reason: "locations_vn not empty" };

  const batch = firestore.batch();
  MIN_VN_LOCATIONS.forEach((loc) => {
    batch.set(coll.doc(loc.id), {
      ...loc,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  return { skipped: false, inserted: MIN_VN_LOCATIONS.length };
}

exports.seedHotelsDemo = onRequest(
  { region: FUNCTIONS_REGION },
  async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    const seedSecret = process.env.SEED_SECRET || "dev-secret";
    const providedSecret = req.get("x-seed-secret");
    if (!isEmulator && providedSecret !== seedSecret) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    try {
      const hotels = await seedHotelsDemoData();
      const locations = await seedMinimalLocations();
      res.status(200).json({ hotels, locations });
    } catch (err) {
      console.error("seedHotelsDemo error:", err);
      res.status(500).json({ error: "Failed to seed hotels demo" });
    }
  }
);
