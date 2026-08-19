/**
 * Firebase Auth's cordovaPopupRedirectResolver expects legacy Cordova globals
 * (BuildInfo, universalLinks, cordova.plugins.browsertab, InAppBrowser).
 * Capacitor does not provide these; map them to @capacitor/app + @capacitor/browser.
 * Must run before initializeAuth(..., { popupRedirectResolver: cordovaPopupRedirectResolver }).
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const APP_ID = 'com.caimanint.multihero';
const DISPLAY_NAME = 'Multihero';

type UniversalCallback = (data: { url: string }) => void;

const universalCallbacks = new Set<UniversalCallback>();

let appUrlListenerRegistered = false;

function ensureAppUrlListener() {
  if (appUrlListenerRegistered) return;
  appUrlListenerRegistered = true;
  void App.addListener('appUrlOpen', ({ url }) => {
    for (const cb of universalCallbacks) {
      try {
        cb({ url });
      } catch (e) {
        console.error('[firebase-shim] appUrlOpen handler', e);
      }
    }
  });
}

type CordovaShimWindow = Window & {
  __multiheroFirebaseCordovaShimInstalled?: boolean;
  BuildInfo?: { packageName: string; displayName: string };
  universalLinks?: { subscribe: (_eventName: unknown, callback: UniversalCallback) => void };
  cordova?: Record<string, unknown>;
};

export function installCapacitorFirebaseCordovaShim(): void {
  if (!Capacitor.isNativePlatform()) return;

  const w = window as CordovaShimWindow;

  if (w.__multiheroFirebaseCordovaShimInstalled) return;
  w.__multiheroFirebaseCordovaShimInstalled = true;

  w.BuildInfo = {
    packageName: APP_ID,
    displayName: DISPLAY_NAME,
  };

  ensureAppUrlListener();
  w.universalLinks = {
    subscribe: (_eventName, callback) => {
      universalCallbacks.add(callback);
    },
  };

  const browsertab = {
    isAvailable: (cb: (available: boolean) => void) => {
      void Promise.resolve().then(() => cb(true));
    },
    openUrl: (url: string) => {
      void Browser.open({ url });
    },
    close: () => {
      void Browser.close();
    },
  };

  const existingCordova =
    typeof w.cordova === 'object' && w.cordova !== null ? w.cordova : {};
  const existingPlugins =
    'plugins' in existingCordova &&
    typeof (existingCordova as { plugins?: unknown }).plugins === 'object' &&
    (existingCordova as { plugins?: object }).plugins !== null
      ? (existingCordova as { plugins: Record<string, unknown> }).plugins
      : {};

  w.cordova = {
    ...existingCordova,
    plugins: {
      ...existingPlugins,
      browsertab,
    },
    InAppBrowser: {
      open: (url: string, _target?: string, _features?: string) => {
        void Browser.open({ url });
        return {
          close: () => {
            void Browser.close();
          },
        };
      },
    },
  };
}
