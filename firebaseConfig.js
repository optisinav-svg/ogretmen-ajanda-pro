import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDrAEcc1a2lMF6vBNjYz5WDTzlIJ0PtZsQ",
  authDomain: "ogretmen-takip.firebaseapp.com",
  projectId: "ogretmen-takip",
  storageBucket: "ogretmen-takip.firebasestorage.app",
  messagingSenderId: "763953803372",
  appId: "1:763953803372:web:477c712ef26e76158e2849"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);

// Spark-compatible account linking uses Firestore transactions and the strict rules in firestore.rules.
// The APK build script deploys those rules before building the student-enabled app.
export const ACCOUNT_LINKING_ENABLED = true;
