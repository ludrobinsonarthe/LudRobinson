
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAimyg0l1mQwxvIWSnoMGMcs3O9_CICMT0",
  authDomain: "studio-5723170349-4a6fe.firebaseapp.com",
  projectId: "studio-5723170349-4a6fe",
  storageBucket: "studio-5723170349-4a6fe.appspot.com",
  messagingSenderId: "830599496194",
  appId: "1:830599496194:web:447e25cfefcc7ac68a5d1b"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
