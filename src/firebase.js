import { initializeApp } from "firebase/app";
import { getDatabase, ref } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBIxSANS4dE7fWi0_1V5tnbmIoLjWEJZjc",
  authDomain: "amoc-hidro.firebaseapp.com",
  databaseURL: "https://amoc-hidro-default-rtdb.firebaseio.com",
  projectId: "amoc-hidro",
  storageBucket: "amoc-hidro.firebasestorage.app",
  messagingSenderId: "85182774380",
  appId: "1:85182774380:web:217c2d18bb096d99eb6c49",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const dadosRef = ref(db, "amoc/dados");
