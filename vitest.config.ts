import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Spiegelt den `@/*`-Alias aus tsconfig.json fuer Vitest. Ohne die
 * Zuordnung scheitert jeder Test, sobald ein getestetes lib-Modul
 * (transitiv) per `@/lib/...` importiert — zuerst passiert mit
 * lib/lists/config.ts → lib/app-download beim App-Store-Launch
 * (2026-09-13), als der Generator-CTA die Store-URL zentral beziehen
 * sollte. Die Alternative (lib-Module auf relative Imports zwingen) waere
 * eine unsichtbare Regel, die beim naechsten Import wieder bricht.
 */
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
});
