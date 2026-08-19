/**
 * Compila la web, sync Capacitor, firma release y copia multihero.apk a la raíz.
 * Requiere android/keystore.properties o play.* en local.properties o env PLAY_UPLOAD_*.
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const adi = join(root, "android", "app", "src", "main", "assets", "adi-registration.properties");
const outApk = join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const dest = join(root, "multihero.apk");

if (!existsSync(adi) || !readFileSync(adi, "utf8").trim()) {
  console.error("Falta android/app/src/main/assets/adi-registration.properties (token de Play, una linea).");
  process.exit(1);
}

console.log("> npm run android:sync");
execSync("npm run android:sync", { stdio: "inherit", cwd: root, env: process.env, shell: true });

const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const android = join(root, "android");
console.log(`> ${gradle} assembleRelease`);
execSync(`${gradle} assembleRelease`, { stdio: "inherit", cwd: android, env: process.env, shell: true });

if (!existsSync(outApk)) {
  console.error("No se generó app-release.apk en la ruta esperada.");
  process.exit(1);
}
copyFileSync(outApk, dest);
const s = statSync(dest);
console.log(`\nOK: ${dest}`);
console.log(`   Tamaño: ${Math.round(s.size / 1024 / 1024)} MB`);
console.log("   Comprueba la firma: keytool -list -v -keystore (tu .jks)");
console.log("   SHA256 ha de coincidir con la huella de Play Console.\n");
