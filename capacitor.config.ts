import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.caimanint.multihero',
  appName: 'Multihero',
  webDir: 'dist',
  // Origen del WebView (OAuth / Firebase Auth). En consola: Auth → Configuración → Dominios autorizados → añadir "localhost".
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
  },
  plugins: {
    FirebaseAuthentication: {
      // En nativo usamos el plugin (Google Play Services, Sign In with Apple).
      // skipNativeAuth: false → el plugin también actualiza la sesión de Firebase Web SDK automáticamente.
      skipNativeAuth: false,
      providers: ['google.com', 'apple.com'],
    },
  },
};

export default config;
