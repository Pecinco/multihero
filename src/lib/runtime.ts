export function isAndroidWebViewRuntime(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const hasAndroid = /Android/i.test(ua);
  const hasWvToken = /\bwv\b/i.test(ua) || /Version\/[\d.]+/i.test(ua);
  const isCapacitorAndroid = (window as any).Capacitor?.getPlatform?.() === 'android';

  return isCapacitorAndroid || (hasAndroid && hasWvToken);
}
