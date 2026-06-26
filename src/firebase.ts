import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Safely import client configuration
import config from '../firebase-applet-config.json';

let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(config);
  } else {
    app = getApp();
  }
} catch (error) {
  console.error('Failed to initialize Firebase SDK. Please verify config file.', error);
}

export const firebaseApp = app;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
