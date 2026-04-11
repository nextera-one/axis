import esbuildPluginTsc from 'esbuild-plugin-tsc';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core/index.ts',
    'src/bin/generate-keys.ts',
    'src/codec/axis1.encode.ts',
    'src/codec/axis1.signing.ts',
    'src/types/frame.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata'],
  esbuildPlugins: [esbuildPluginTsc({ force: true })],
});
