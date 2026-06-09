import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { initializeFirestore, type Firestore } from 'firebase/firestore'

const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const missing = requiredVars.filter((name) => !import.meta.env[name])

if (missing.length > 0) {
  throw new Error(
    `Firebase is not configured. Missing environment variable${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. ` +
      `Set the VITE_FIREBASE_* variables in your hosting platform (e.g. Vercel project settings) and redeploy.`,
  )
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig)
export const auth: Auth = getAuth(firebaseApp)
// Auto-detect long-polling so live sync works smoothly behind strict
// proxies/firewalls (e.g. corporate/government networks), where the default
// WebChannel/QUIC streaming transport otherwise floods the console with
// transport-errored warnings and reconnect churn.
export const db: Firestore = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
})
