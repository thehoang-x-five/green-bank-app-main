// src/lib/firebase.ts
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
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
  storageBucket: "vietbank-final.appspot.com",
  messagingSenderId: "670011798086",
  appId: "1:670011798086:web:b44d04ca1b0a597399d047",
  measurementId: "G-HHXRVGY11V",
};

export const fbApp: FirebaseApp = initializeApp(firebaseConfig);
export const fbAuth: Auth = getAuth(fbApp);
export const fbDb: Firestore = getFirestore(fbApp);
export const fbRtdb: Database = getDatabase(fbApp);
export const functionsRegion = "asia-southeast1";
export const fbFns: Functions = getFunctions(fbApp, functionsRegion);

// Backward-compatible aliases
export const firebaseAuth = fbAuth;
export const firebaseDb = fbDb;
export const firebaseRtdb = fbRtdb;

if (
  import.meta.env?.DEV &&
  import.meta.env?.VITE_USE_FUNCTIONS_EMULATOR === "true"
) {
  // eslint-disable-next-line no-console
  console.info("[firebase] Using local Functions emulator");
  connectFunctionsEmulator(fbFns, "localhost", 5001);
}

export const functionsBaseUrl =
  import.meta.env?.VITE_FUNCTIONS_BASE_URL ||
  `https://${functionsRegion}-${firebaseConfig.projectId}.cloudfunctions.net`;
