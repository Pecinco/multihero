import { initializeApp } from 'firebase/app';
import type { Auth, PopupRedirectResolver } from 'firebase/auth';
import { getAuth as getWebAuth } from 'firebase/auth';
import {
  getAuth as getCordovaAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  cordovaPopupRedirectResolver,
} from 'firebase/auth/cordova';
import { getDatabase } from 'firebase/database';
import { Capacitor } from '@capacitor/core';
import { installCapacitorFirebaseCordovaShim } from './capacitorFirebaseCordovaShim';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredKeys = [
  'apiKey',
  'authDomain',
  'databaseURL',
  'projectId',
  'appId',
] as const;

for (const key of requiredKeys) {
  if (!firebaseConfig[key]) {
    console.warn(`[firebase] Missing config key: ${key}`);
  }
}

const rawAppId = String(firebaseConfig.appId ?? '');
if (rawAppId.includes(':android:') || rawAppId.includes(':ios:')) {
  console.error(
    '[firebase] VITE_FIREBASE_APP_ID no puede ser el de la app Android/iOS. En Firebase Console → Ajustes → Tus apps, añade o elige la app Web (</>) y copia su firebaseConfig (el appId debe contener ":web:").'
  );
}

const app = initializeApp(firebaseConfig);

let authInstance: Auth;
let resolverForRedirect: PopupRedirectResolver | undefined;

if (Capacitor.isNativePlatform()) {
  try {
    installCapacitorFirebaseCordovaShim();
  } catch (e) {
    console.warn('[firebase] No se pudo instalar el shim de Cordova en Capacitor', e);
  }
  try {
    authInstance = initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
      popupRedirectResolver: cordovaPopupRedirectResolver,
    });
    resolverForRedirect = cordovaPopupRedirectResolver;
    console.info('[firebase] Auth inicializado con cordovaPopupRedirectResolver');
  } catch (e) {
    console.warn('[firebase] initializeAuth falló, usando getCordovaAuth', e);
    try {
      authInstance = getCordovaAuth(app);
      resolverForRedirect = cordovaPopupRedirectResolver;
    } catch (e2) {
      console.warn('[firebase] getCordovaAuth falló, usando getAuth web como fallback', e2);
      authInstance = getWebAuth(app);
      resolverForRedirect = undefined;
    }
  }
} else {
  authInstance = getWebAuth(app);
  resolverForRedirect = undefined;
}

export const auth = authInstance;
export const db = getDatabase(app);
export const nativeRedirectResolver = resolverForRedirect;
