import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAEC6LYB0_AXIOlhOUTg9zAXr_2hrodxts",
  authDomain: "ntub-messenger-2026.firebaseapp.com",
  projectId: "ntub-messenger-2026",
  storageBucket: "ntub-messenger-2026.firebasestorage.app",
  messagingSenderId: "38453474722",
  appId: "1:38453474722:web:276478c4ab157513bf6efb"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);