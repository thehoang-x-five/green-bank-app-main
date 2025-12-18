// src/lib/firebase.ts
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBaBxbCTIyyQ66zaYxlyrlDWMUSR0XVyuk",
  authDomain: "vietbank-final.firebaseapp.com",
  databaseURL:
    "https://vietbank-final-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vietbank-final",
  // *** PHẢI LÀ appspot.com, KHÔNG PHẢI firebasestorage.app ***
  storageBucket: "vietbank-final.appspot.com",
  // ******************************************************
  messagingSenderId: "670011798086",
  appId: "1:670011798086:web:b44d04ca1b0a597399d047",
  measurementId: "G-HHXRVGY11V",
};

export const fbApp: FirebaseApp = initializeApp(firebaseConfig);
export const fbAuth: Auth = getAuth(fbApp);

// Check if we should use emulator
const useEmulator = import.meta.env?.DEV && import.meta.env?.VITE_USE_FUNCTIONS_EMULATOR === "true";

// Initialize Firestore - MUST connect to emulator BEFORE any queries
let fbDb: Firestore;

if (useEmulator) {
  console.info("[firebase] 🔧 Initializing with emulator mode...");
  
  // Initialize Firestore WITHOUT settings first
  fbDb = initializeFirestore(fbApp, {
    ignoreUndefinedProperties: true,
    // Force long polling to avoid WebChannel 400 errors on some networks/emulator
    experimentalForceLongPolling: true,
  });
  
  // Connect to emulator IMMEDIATELY
  try {
    console.info("[firebase] Connecting Firestore to emulator: 127.0.0.1:8080");
    connectFirestoreEmulator(fbDb, "127.0.0.1", 8080);
    console.info("[firebase] ✅ Firestore connected to emulator");
  } catch (error) {
    console.error("[firebase] ❌ Failed to connect Firestore to emulator:", error);
  }
} else {
  // Production mode
  fbDb = initializeFirestore(fbApp, {
    ignoreUndefinedProperties: true,
    experimentalForceLongPolling: true,
  });
}

export { fbDb };

export const fbRtdb: Database = getDatabase(fbApp);
export const functionsRegion = "asia-southeast1";
export const fbFns: Functions = getFunctions(fbApp, functionsRegion);

// Connect Functions emulator if needed
if (useEmulator) {
  try {
    console.info("[firebase] Connecting Functions to emulator: 127.0.0.1:5001");
    connectFunctionsEmulator(fbFns, "127.0.0.1", 5001);
    console.info("[firebase] ✅ Functions connected to emulator");
  } catch (error) {
    console.error("[firebase] ❌ Failed to connect Functions to emulator:", error);
  }
  
  // Only connect Auth emulator if explicitly enabled
  if (import.meta.env?.VITE_USE_AUTH_EMULATOR === "true") {
    console.info("[firebase] Auth emulator enabled");
    connectAuthEmulator(fbAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
}

// Backward-compatible aliases
export const firebaseAuth = fbAuth;
export const firebaseDb = fbDb;
export const firebaseRtdb = fbRtdb;

export const functionsBaseUrl =
  import.meta.env?.VITE_FUNCTIONS_BASE_URL ||
  `https://${functionsRegion}-${firebaseConfig.projectId}.cloudfunctions.net`;
