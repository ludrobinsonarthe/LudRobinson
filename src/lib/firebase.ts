// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  "projectId": "studio-5723170349-4a6fe",
  "appId": "1:830599496194:web:447e25cfefcc7ac68a5d1b",
  "storageBucket": "studio-5723170349-4a6fe.appspot.com",
  "apiKey": "AIzaSyAimyg0l1mQwxvIWSnoMGMcs3O9_CICMT0",
  "authDomain": "studio-5723170349-4a6fe.firebaseapp.com",
  "messagingSenderId": "830599496194"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
