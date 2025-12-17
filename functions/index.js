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

      // Overpass may timeout/504; fallback to local-only instead of 500
      let overpassPois = [];
      let source = "local+overpass";
      try {
        overpassPois = await fetchOverpassNearby({
          lat: data.lat,
          lon: data.lon,
          radiusM,
          amenity,
          limit,
        });
      } catch (overpassErr) {
        console.warn("Overpass failed, fallback to local POIs only:", overpassErr?.message || overpassErr);
        source = "local-only";
      }

      const pois = [...localPois, ...overpassPois];

      await setCache(cacheKey, { pois, source }, DEFAULT_TTL_SEC);

      res.status(200).json({ pois, cached: false, source });
    } catch (err) {
      console.error("nearbyPois error:", err?.message || err, err?.stack);
      if (err instanceof HttpsError) {
        res.status(401).json({ error: err.message });
      } else {
        res.status(500).json({ error: "Failed to fetch POI", detail: err?.message });
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
  "http://localhost:5176",
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
      const displayName = json?.display_name || "";
      
      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality;
      
      let district =
        address.state_district ||
        address.county;
      
      // For Vietnam, special handling
      if (address.country_code === "vn") {
        const parts = displayName.split(",").map(p => p.trim());
        
        // Check if display_name contains a major province
        const majorProvinces = [
          "Thành phố Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Hải Phòng",
          "Cần Thơ", "Biên Hòa", "Nha Trang", "Huế", "Vũng Tàu"
        ];
        
        const hasProvince = parts.some(p => 
          majorProvinces.some(mp => 
            p.toLowerCase().includes(mp.toLowerCase()) ||
            mp.toLowerCase().includes(p.toLowerCase())
          )
        );
        
        // If display_name has province AND city is different, then city is the district
        if (hasProvince && city) {
          const cityIsProvince = majorProvinces.some(mp => 
            city.toLowerCase().includes(mp.toLowerCase()) ||
            mp.toLowerCase().includes(city.toLowerCase())
          );
          
          if (!cityIsProvince) {
            // city is actually the district (e.g., "Thủ Đức", "Quận 7")
            district = city;
          }
        }
        
        // Try to find explicit district markers in display_name
        if (!district) {
          const districtPart = parts.find(p => 
            /^(Quận|Huyện|Thành phố|Thị xã)\s+/i.test(p)
          );
          if (districtPart) {
            district = districtPart;
          }
        }
        
        // Fallback to suburb/neighbourhood if still no district
        if (!district) {
          district = address.suburb || address.neighbourhood;
        }
      } else {
        // Non-Vietnam: use suburb/neighbourhood
        district = district || address.suburb || address.neighbourhood;
      }
      
      const payload = {
        city: city || undefined,
        district: district || undefined,
        state: address.state || address.region || undefined,
        country: address.country || undefined,
        displayName: displayName || undefined,
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
const DVHCVN_CDN = "https://cdn.jsdelivr.net/gh/daohoangson/dvhcvn@master/data/dvhcvn.json";

// Cache for DVHCVN data
let dvhcvnCache = null;

async function fetchDvhcvnData() {
  if (dvhcvnCache) return dvhcvnCache;
  const resp = await fetch(DVHCVN_CDN);
  if (!resp.ok) throw new Error(`DVHCVN CDN failed ${resp.status}`);
  const json = await resp.json();
  dvhcvnCache = json.data || [];
  return dvhcvnCache;
}

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
    console.warn("Provinces API failed, trying DVHCVN CDN:", err?.message);
    // Fallback to DVHCVN CDN
    try {
      const dvhcvn = await fetchDvhcvnData();
      const data = dvhcvn.map((p) => ({
        code: p.level1_id,
        name: p.name,
        codename: p.name.toLowerCase().replace(/\s+/g, "_"),
      }));
      await setApiCache(cacheKey, data, ONE_DAY_SEC);
      res.status(200).json({ data, cached: false, source: "dvhcvn" });
    } catch (fallbackErr) {
      console.error("DVHCVN CDN also failed:", fallbackErr?.message);
      res.status(500).json({ error: "Failed to fetch provinces" });
    }
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
    console.warn("Provinces API failed for districts, trying DVHCVN CDN:", err?.message);
    // Fallback to DVHCVN CDN
    try {
      const dvhcvn = await fetchDvhcvnData();
      const province = dvhcvn.find((p) => p.level1_id === provinceCode);
      const districts = (province?.level2s || []).map((d) => ({
        code: d.level2_id,
        name: d.name,
        codename: d.name.toLowerCase().replace(/\s+/g, "_"),
      }));
      await setApiCache(cacheKey, districts, ONE_DAY_SEC);
      res.status(200).json({ data: districts, cached: false, source: "dvhcvn" });
    } catch (fallbackErr) {
      console.error("DVHCVN CDN also failed:", fallbackErr?.message);
      res.status(500).json({ error: "Failed to fetch districts" });
    }
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
const { ALL_HOTELS, ALL_ROOMS, VN_LOCATIONS } = require("./hotelSeedData");

const HOTELS_DEMO = ALL_HOTELS;
const MIN_VN_LOCATIONS = VN_LOCATIONS;

async function seedHotelsDemoData(forceReseed = false) {
  const hotelsRef = firestore.collection("hotels");
  
  // Delete existing if force reseed
  if (forceReseed) {
    const existing = await hotelsRef.get();
    const deleteBatch = firestore.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    if (!existing.empty) await deleteBatch.commit();
  } else {
    const existing = await hotelsRef.limit(1).get();
    if (!existing.empty) {
      return { skipped: true, reason: "Collection not empty" };
    }
  }

  // Firestore batch limit is 500, so we need multiple batches
  const FieldValue = admin.firestore.FieldValue;
  const batchSize = 450;
  let inserted = 0;
  
  for (let i = 0; i < HOTELS_DEMO.length; i += batchSize) {
    const batch = firestore.batch();
    const chunk = HOTELS_DEMO.slice(i, i + batchSize);
    chunk.forEach((hotel, idx) => {
      const ref = hotelsRef.doc(`demo-${i + idx + 1}`);
      batch.set(ref, {
        ...hotel,
        createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
      });
    });
    await batch.commit();
    inserted += chunk.length;
  }
  
  return { skipped: false, inserted };
}

async function seedMinimalLocations(forceReseed = false) {
  const coll = firestore.collection("locations_vn");
  
  if (forceReseed) {
    const existing = await coll.get();
    const deleteBatch = firestore.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    if (!existing.empty) await deleteBatch.commit();
  } else {
    const snap = await coll.limit(1).get();
    if (!snap.empty) return { skipped: true, reason: "locations_vn not empty" };
  }

  const batch = firestore.batch();
  const FieldValue = admin.firestore.FieldValue;
  MIN_VN_LOCATIONS.forEach((loc) => {
    batch.set(coll.doc(loc.id), {
      ...loc,
      createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
    });
  });
  await batch.commit();
  return { skipped: false, inserted: MIN_VN_LOCATIONS.length };
}

async function seedHotelRoomsData(forceReseed = false) {
  const roomsRef = firestore.collection("hotel_rooms");
  
  // Delete existing if force reseed
  if (forceReseed) {
    const existing = await roomsRef.get();
    const deleteBatch = firestore.batch();
    let deleteCount = 0;
    for (const doc of existing.docs) {
      deleteBatch.delete(doc.ref);
      deleteCount++;
      // Commit every 450 deletes
      if (deleteCount % 450 === 0) {
        await deleteBatch.commit();
      }
    }
    if (deleteCount % 450 !== 0 && deleteCount > 0) {
      await deleteBatch.commit();
    }
  } else {
    const existing = await roomsRef.limit(1).get();
    if (!existing.empty) {
      return { skipped: true, reason: "hotel_rooms collection not empty" };
    }
  }

  // Firestore batch limit is 500, so we need multiple batches
  const FieldValue = admin.firestore.FieldValue;
  const batchSize = 450;
  let inserted = 0;
  
  for (let i = 0; i < ALL_ROOMS.length; i += batchSize) {
    const batch = firestore.batch();
    const chunk = ALL_ROOMS.slice(i, i + batchSize);
    chunk.forEach((room, idx) => {
      const ref = roomsRef.doc(`room-${i + idx + 1}`);
      batch.set(ref, {
        ...room,
        createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
      });
    });
    await batch.commit();
    inserted += chunk.length;
  }
  
  return { skipped: false, inserted };
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
      const forceReseed = req.body?.force === true || req.query?.force === "true";
      const hotels = await seedHotelsDemoData(forceReseed);
      const locations = await seedMinimalLocations(forceReseed);
      const rooms = await seedHotelRoomsData(forceReseed);
      res.status(200).json({ hotels, locations, rooms, forceReseed });
    } catch (err) {
      console.error("seedHotelsDemo error:", err);
      res.status(500).json({ error: "Failed to seed hotels demo" });
    }
  }
);

/* =========================================================
 * Dev helper: seedMoviesDemo (Firestore cinema/movie data)
 * ========================================================= */
const { CINEMA_DATA, MOVIE_DATA, generateShowtimes } = require("./cinemaSeedData");

async function seedCinemasData(forceReseed = false) {
  const cinemasRef = firestore.collection("cinemas");
  
  if (forceReseed) {
    const existing = await cinemasRef.get();
    const deleteBatch = firestore.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    if (!existing.empty) await deleteBatch.commit();
  } else {
    const existing = await cinemasRef.limit(1).get();
    if (!existing.empty) {
      return { skipped: true, reason: "Collection not empty" };
    }
  }

  const batch = firestore.batch();
  const FieldValue = admin.firestore.FieldValue;
  CINEMA_DATA.forEach((cinema, idx) => {
    const ref = cinemasRef.doc(`cinema-${idx + 1}`);
    batch.set(ref, {
      ...cinema,
      createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
    });
  });
  await batch.commit();
  
  return { skipped: false, inserted: CINEMA_DATA.length };
}

async function seedMoviesData(forceReseed = false) {
  const moviesRef = firestore.collection("movies");
  
  if (forceReseed) {
    const existing = await moviesRef.get();
    const deleteBatch = firestore.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    if (!existing.empty) await deleteBatch.commit();
  } else {
    const existing = await moviesRef.limit(1).get();
    if (!existing.empty) {
      return { skipped: true, reason: "Collection not empty" };
    }
  }

  const batch = firestore.batch();
  const FieldValue = admin.firestore.FieldValue;
  MOVIE_DATA.forEach((movie, idx) => {
    const ref = moviesRef.doc(`movie-${idx + 1}`);
    batch.set(ref, {
      ...movie,
      createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
    });
  });
  await batch.commit();
  
  return { skipped: false, inserted: MOVIE_DATA.length };
}

async function seedShowtimesData(forceReseed = false) {
  const showtimesRef = firestore.collection("showtimes");
  
  if (forceReseed) {
    const existing = await showtimesRef.get();
    const batchSize = 450;
    let deleteCount = 0;
    let deleteBatch = firestore.batch();
    
    for (const doc of existing.docs) {
      deleteBatch.delete(doc.ref);
      deleteCount++;
      if (deleteCount % batchSize === 0) {
        await deleteBatch.commit();
        deleteBatch = firestore.batch();
      }
    }
    if (deleteCount % batchSize !== 0 && deleteCount > 0) {
      await deleteBatch.commit();
    }
  } else {
    const existing = await showtimesRef.limit(1).get();
    if (!existing.empty) {
      return { skipped: true, reason: "Collection not empty" };
    }
  }

  // Get cinema and movie IDs
  const cinemasSnap = await firestore.collection("cinemas").get();
  const moviesSnap = await firestore.collection("movies").get();
  
  if (cinemasSnap.empty || moviesSnap.empty) {
    return { skipped: true, reason: "Cinemas or movies not seeded yet" };
  }

  const cinemas = cinemasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const movies = moviesSnap.docs.map(d => ({ id: d.id }));
  
  const FieldValue = admin.firestore.FieldValue;
  const batchSize = 450;
  let inserted = 0;
  let batch = firestore.batch();
  let batchCount = 0;

  // Generate showtimes for each cinema-movie combination
  for (const cinema of cinemas) {
    for (const movie of movies) {
      const showtimes = generateShowtimes(cinema.id, movie.id, cinema.rooms, cinema.name);
      
      for (const showtime of showtimes) {
        const ref = showtimesRef.doc();
        batch.set(ref, {
          ...showtime,
          createdAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
        });
        batchCount++;
        inserted++;
        
        if (batchCount >= batchSize) {
          await batch.commit();
          batch = firestore.batch();
          batchCount = 0;
        }
      }
    }
  }
  
  if (batchCount > 0) {
    await batch.commit();
  }
  
  return { skipped: false, inserted };
}

exports.seedMoviesDemo = onRequest(
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
      const forceReseed = req.body?.force === true || req.query?.force === "true";
      const cinemas = await seedCinemasData(forceReseed);
      const movies = await seedMoviesData(forceReseed);
      const showtimes = await seedShowtimesData(forceReseed);
      res.status(200).json({ cinemas, movies, showtimes, forceReseed });
    } catch (err) {
      console.error("seedMoviesDemo error:", err);
      res.status(500).json({ error: "Failed to seed movies demo", detail: err?.message });
    }
  }
);
