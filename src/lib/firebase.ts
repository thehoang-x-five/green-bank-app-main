// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

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

const app = initializeApp(firebaseConfig);

// Auth / DB export dùng chung
export const firebaseAuth: Auth = getAuth(app);
export const firebaseDb = getFirestore(app);
export const firebaseRtdb = getDatabase(app);
