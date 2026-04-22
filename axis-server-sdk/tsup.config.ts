import esbuildPluginTsc from "esbuild-plugin-tsc";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core/index.ts",
    "src/bin/generate-keys.ts",
    "src/codec/axis1.encode.ts",
    "src/codec/axis1.signing.ts",
    "src/types/frame.ts",
    "src/sensors/index.ts",
    "src/timeline/index.ts",
    "src/idel/index.ts",
    "src/needle/index.ts",
    "src/cce/index.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["reflect-metadata"],
  esbuildPlugins: [esbuildPluginTsc({ force: true })],
});
