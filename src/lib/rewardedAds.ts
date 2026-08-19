import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';

export type RewardedAdResult = 'completed' | 'dismissed' | 'unavailable';

/** Unit ids de prueba recompensado (Google). */
export const TEST_REWARDED_AD_UNIT_ID_ANDROID =
  'ca-app-pub-3940256099942544/5224354917';
export const TEST_REWARDED_AD_UNIT_ID_IOS =
  'ca-app-pub-3940256099942544/1712485313';

const PRODUCTION_REWARDED_AD_UNIT_ID_ANDROID =
  (import.meta.env.VITE_ADMOB_REWARDED_UNIT_ID as string | undefined)?.trim() ?? '';
const PRODUCTION_REWARDED_AD_UNIT_ID_IOS =
  (import.meta.env.VITE_ADMOB_REWARDED_UNIT_ID_IOS as string | undefined)?.trim() ?? '';

function productionUnitIdForPlatform(): string {
  return Capacitor.getPlatform() === 'ios'
    ? PRODUCTION_REWARDED_AD_UNIT_ID_IOS
    : PRODUCTION_REWARDED_AD_UNIT_ID_ANDROID;
}

export function rewardedAdUnitIdForCurrentPlatform(): string {
  const platform = Capacitor.getPlatform();
  const production = productionUnitIdForPlatform();
  if (import.meta.env.PROD && production) return production;
  return platform === 'ios'
    ? TEST_REWARDED_AD_UNIT_ID_IOS
    : TEST_REWARDED_AD_UNIT_ID_ANDROID;
}

/** @deprecated Usar rewardedAdUnitIdForCurrentPlatform() */
export const REWARDED_AD_UNIT_ID_ANDROID =
  import.meta.env.PROD && PRODUCTION_REWARDED_AD_UNIT_ID_ANDROID
    ? PRODUCTION_REWARDED_AD_UNIT_ID_ANDROID
    : TEST_REWARDED_AD_UNIT_ID_ANDROID;

const useAdTesting = !(import.meta.env.PROD && productionUnitIdForPlatform());

let initStarted = false;

function isNativeAdsPlatform(): boolean {
  const p = Capacitor.getPlatform();
  return Capacitor.isNativePlatform() && (p === 'android' || p === 'ios');
}

/**
 * Inicializa el SDK (Android/iOS). Llamar una vez al arrancar la app nativa.
 * Android App ID: strings.xml → admob_app_id
 * iOS App ID: Info.plist → GADApplicationIdentifier
 */
export async function initRewardedAdsSdk(): Promise<void> {
  if (!isNativeAdsPlatform()) return;
  if (initStarted) return;
  initStarted = true;
  try {
    await AdMob.initialize({
      initializeForTesting: useAdTesting,
    });
  } catch {
    initStarted = false;
  }
}

export async function prepareRewarded(): Promise<void> {
  await initRewardedAdsSdk();
}

/**
 * Muestra un vídeo recompensado. `completed` = usuario vio el anuncio y recibió recompensa.
 * Web / sin plugin: `unavailable` (en dev opcional confirm para probar UI).
 */
export async function showRewarded(
  adUnitId: string = rewardedAdUnitIdForCurrentPlatform(),
): Promise<RewardedAdResult> {
  if (!isNativeAdsPlatform()) {
    if (import.meta.env.DEV && typeof window !== 'undefined' && window.confirm?.('Simulate rewarded ad completed? (dev)')) {
      return 'completed';
    }
    return 'unavailable';
  }
  await initRewardedAdsSdk();
  return new Promise<RewardedAdResult>((resolve) => {
    let rewarded = false;
    let finished = false;
    const done = (r: RewardedAdResult) => {
      if (finished) return;
      finished = true;
      const admob = AdMob as { removeAllListeners?: () => Promise<void> };
      void admob.removeAllListeners?.().finally(() => resolve(r));
    };

    const t = window.setTimeout(() => done('dismissed'), 180_000);

    void AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
    });
    void AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      window.clearTimeout(t);
      done(rewarded ? 'completed' : 'dismissed');
    });
    void AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
      window.clearTimeout(t);
      done('unavailable');
    });
    void AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
      window.clearTimeout(t);
      done('unavailable');
    });

    void AdMob.prepareRewardVideoAd({
      adId: adUnitId,
      isTesting: useAdTesting,
    })
      .then(() => AdMob.showRewardVideoAd())
      .catch(() => {
        window.clearTimeout(t);
        done('unavailable');
      });
  });
}
