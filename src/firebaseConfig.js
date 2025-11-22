// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBdNq6fZdWXMINJZojiKdMdtSNG-EZCk6M",
  authDomain: "crew-crowdfunding-simulado.firebaseapp.com",
  projectId: "crew-crowdfunding-simulado",
  storageBucket: "crew-crowdfunding-simulado.appspot.com",
  messagingSenderId: "752583559935",
  appId: "1:752583559935:web:08ce00c0853c83368c1aca"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
// Forzar el bucket correcto de Storage
export const storage = getStorage(app, "gs://crew-crowdfunding-simulado.appspot.com");

export default app;
