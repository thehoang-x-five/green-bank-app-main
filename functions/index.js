/**
 * Firebase Functions (v2) entrypoint
 * - HTTP: sendOtpEmail (demo, Gmail SMTP)
 * - Callable: nearbyPois (Overpass OSM + Firestore cache)
 */
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { defineString } = require("firebase-functions/params");
const { onRequest, HttpsError } = require("firebase-functions/v2/https");

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
