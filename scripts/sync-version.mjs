import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;

if (!version) {
  throw new Error("package.json is missing a version field.");
}

const tauriConfPath = join(root, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`);

const appPreferencesPath = join(root, "src", "utils", "appPreferences.ts");
const appPreferences = readFileSync(appPreferencesPath, "utf8");
const versionPattern = /export const APP_VERSION = "[^"]+";/;

if (!versionPattern.test(appPreferences)) {
  throw new Error("Could not find APP_VERSION in src/utils/appPreferences.ts");
}

const updatedPreferences = appPreferences.replace(
  versionPattern,
  `export const APP_VERSION = "${version}";`,
);

writeFileSync(appPreferencesPath, updatedPreferences);

console.log(`Synced version ${version} to tauri.conf.json and appPreferences.ts`);
