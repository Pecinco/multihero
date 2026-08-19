# Multihero — publicar en App Store (Mac + Xcode)

Guía para clonar el repo en el Mac, generar el proyecto iOS y subir a App Store Connect.

**Bundle ID:** `com.caimanint.multihero`  
**Nombre app:** Multihero

---

## 0. Prompt para Cursor en el Mac

Copia y pega esto en un chat nuevo de Cursor tras abrir la carpeta del proyecto:

```
Estoy en Mac con Xcode instalado. Acabo de clonar el repo Multihero (Capacitor 8 + React/Vite).
El objetivo es publicar en App Store.

Sigue docs/MAC-IOS-APP-STORE.md paso a paso:
1. Verifica Node, CocoaPods y Xcode.
2. npm install
3. Copia .env desde el backup (no está en git).
4. npx cap add ios (si no existe carpeta ios/)
5. Firebase: GoogleService-Info.plist en ios/App/App/
6. Configura Sign in with Apple + signing en Xcode.
7. npm run ios:sync && npx cap open ios
8. Prueba en simulador/dispositivo.
9. Archive → App Store Connect.

Si rewardedAds falla en iOS, revisa VITE_ADMOB_REWARDED_UNIT_ID_IOS en .env y Info.plist (GADApplicationIdentifier).
Ayúdame en cada paso y dime qué falta en Firebase / Apple Developer / AdMob.
```

---

## 1. Requisitos previos (Mac)

- [ ] **Apple Developer Program** activo (99 USD/año)
- [ ] **Xcode** instalado (App Store) — ábrelo una vez y acepta licencia
- [ ] **Node.js 20+** (`brew install node` o [nodejs.org](https://nodejs.org))
- [ ] **CocoaPods:** `sudo gem install cocoapods`
- [ ] Acceso a **Firebase Console** (proyecto multihero-server)
- [ ] Acceso a **AdMob** (app iOS creada o por crear)
- [ ] Archivo **`.env`** copiado desde el PC Windows (no está en git)

Verificar:

```bash
node -v
npm -v
pod --version
xcodebuild -version
```

---

## 2. Clonar el repo

En Windows ya debe existir el commit inicial. Sube el repo a GitHub/GitLab (privado) y en Mac:

```bash
git clone <URL-DEL-REPO>
cd mates   # o el nombre de la carpeta del repo
```

Copia `.env` al mismo directorio (USB, AirDrop, gestor de contraseñas, etc.).

---

## 3. Instalar dependencias

```bash
npm install
```

Si falta la plataforma iOS:

```bash
npm install @capacitor/ios
npx cap add ios
```

---

## 4. Firebase (app iOS)

1. [Firebase Console](https://console.firebase.google.com) → proyecto **multihero-server**
2. Ajustes → Tus apps → **Añadir app** → **iOS**
3. Bundle ID: `com.caimanint.multihero`
4. Descarga **`GoogleService-Info.plist`**
5. Colócalo en: `ios/App/App/GoogleService-Info.plist`
6. En Xcode, arrastra el plist al target **App** si no aparece

**Importante:** Las variables `VITE_FIREBASE_*` del `.env` deben seguir siendo de la app **Web** (appId con `:web:`), no la de iOS.

### Sign in with Apple (Firebase)

- Firebase → Authentication → Sign-in method → Apple → Activar
- Apple Developer → Identifiers → tu App ID → **Sign In with Apple** activado
- En Apple Developer → Keys → crear clave **Sign in with Apple** y configurar en Firebase si lo pide

### Google Sign-In (iOS)

- Firebase iOS app registrada
- Descargar de nuevo `GoogleService-Info.plist` tras añadir la app iOS
- En Xcode puede hacer falta URL scheme: `REVERSED_CLIENT_ID` del plist (Cursor te ayudará al abrir el proyecto)

---

## 5. AdMob (iOS)

1. [AdMob](https://admob.google.com) → Apps → Añadir app **iOS**
2. Anota:
   - **App ID** iOS (`ca-app-pub-XXXX~YYYY`)
   - **Rewarded ad unit** iOS (`ca-app-pub-XXXX/ZZZZ`)
3. En `.env` del Mac:

```env
VITE_ADMOB_REWARDED_UNIT_ID=<unit-id-android-o-compartido-si-aplica>
VITE_ADMOB_REWARDED_UNIT_ID_IOS=<unit-id-ios>
```

4. En `ios/App/App/Info.plist`, añadir (Cursor puede hacerlo):

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXX~YYYY</string>
```

5. App infantil/familiar: configurar etiquetas COPPA en AdMob como en Android.

---

## 6. Sincronizar y abrir Xcode

```bash
npm run ios:sync
npx cap open ios
```

En Xcode → target **App**:

1. **Signing & Capabilities** → Team = tu cuenta Apple Developer
2. Bundle Identifier = `com.caimanint.multihero`
3. **+ Capability** → **Sign in with Apple**
4. Version / Build (alineados con Android si quieres: p. ej. 1.0.2 / 3)

Ejecutar en simulador iPhone (▶ Run).

---

## 7. App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → Nueva app
2. Plataforma iOS, nombre **Multihero**, idioma, bundle ID `com.caimanint.multihero`
3. Rellenar ficha: descripción, capturas (usa `docs/capturas/`), política de privacidad (`legal-web/privacidad.html` publicada en web)
4. Clasificación por edades, export compliance, etc.

---

## 8. Archive y subida

En Xcode:

1. Destino: **Any iOS Device (arm64)**
2. **Product → Archive**
3. **Distribute App** → **App Store Connect** → Upload
4. En App Store Connect → TestFlight (prueba interna) → luego enviar a revisión

---

## 9. Comandos útiles

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Web en local (navegador) |
| `npm run build` | Compila `dist/` |
| `npm run ios:sync` | build + cap sync ios |
| `npx cap open ios` | Abre Xcode |
| `npx cap run ios` | Build + run en simulador (CLI) |

---

## 10. Checklist antes de enviar a revisión

- [ ] Login Google funciona en dispositivo iOS real
- [ ] Login Apple funciona
- [ ] Anuncios recompensados en iOS (IDs reales, no test)
- [ ] Política de privacidad accesible desde la ficha
- [ ] Sin crashes en iPhone reciente (TestFlight)
- [ ] Icono y splash correctos
- [ ] `version` / `build` incrementados respecto a la última subida

---

## Flujo PC + Mac (recomendado)

```
Windows (PC)                    Mac
─────────────                   ───
Editar src/          git push → git pull
npm run android:*               npm run ios:sync
Play Store                      App Store
```

Un solo repo; cada máquina compila su plataforma nativa.
