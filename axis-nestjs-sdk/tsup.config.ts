import esbuildPluginTsc from "esbuild-plugin-tsc";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    "@nestjs/common",
    "@nestjs/config",
    "@nestjs/core",
    "@nestjs/websockets",
    "@nextera.one/axis-server-sdk",
    "crypto",
    "express",
    "nestjs-cls",
    "reflect-metadata",
    "rxjs",
    "ws",
  ],
  esbuildPlugins: [esbuildPluginTsc({ force: true })],
});
