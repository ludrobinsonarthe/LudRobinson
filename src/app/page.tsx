import { redirect } from 'next/navigation';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// This is a temporary, server-side only check to see if a user might be logged in.
// Note: This is a simplified check. In a real app, you'd use a more robust
// session management solution like Next-Auth.js or server-side cookies.
// For this environment, we'll redirect to the dashboard optimistically,
// and the dashboard's own client-side auth check will handle the rest.

// Initialize Firebase Admin SDK on the server if not already initialized.
// This is a simplified example; in a real app, you'd use environment variables.
const firebaseConfig = {
  "projectId": "studio-5723170349-4a6fe",
  "appId": "1:830599496194:web:447e25cfefcc7ac68a5d1b",
  "storageBucket": "studio-5723170349-4a6fe.appspot.com",
  "apiKey": "AIzaSyAimyg0l1mQwxvIWSnoMGMcs3O9_CICMT0",
  "authDomain": "studio-5723170349-4a6fe.firebaseapp.com",
  "messagingSenderId": "830599496194"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export default function RootPage() {
  // On the server, we can't know for sure if a user is logged in without a token.
  // We will redirect to /dashboard and let the dashboard layout handle auth checks.
  // If not logged in, the user will be redirected from there to /login.
  // This is a common pattern for the app router.
  redirect('/dashboard');

  // This component will never actually render anything.
  return null;
}
