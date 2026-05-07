import packageJson from './package.json' with { type: 'json' }
import { defineConfig } from 'tsdown'

const browserGlobalBase = [
  'typeof document !== "undefined" && document.currentScript',
  '? document.currentScript.src',
  ': typeof self !== "undefined" && self.location',
  '? self.location.href',
  ': undefined',
].join(' ')

const sharedBuildOptions = {
  clean: true,
  dts: false,
  outDir: 'dist',
  platform: 'browser' as const,
  sourcemap: true,
  target: 'ES2015',
  deps: {
    alwaysBundle: ['events'],
  },
}

export default defineConfig([
  {
    ...sharedBuildOptions,
    clean: true,
    entry: {
      mpegts: './src/mpegts.js',
    },
    format: {
      esm: {},
      cjs: {},
      iife: {
        globalName: 'mpegts',
        minify: true,
        inputOptions: {
          transform: {
            define: {
              __VERSION__: JSON.stringify(packageJson.version),
              __WORKER_BASE_URL__: browserGlobalBase,
              __WORKER_FALLBACK_BASE_URL__: 'undefined',
            },
          },
        },
        outputOptions: {
          entryFileNames: 'mpegts.global.js',
        },
      },
    },
    inputOptions: {
      transform: {
        define: {
          __VERSION__: JSON.stringify(packageJson.version),
          __WORKER_BASE_URL__: 'undefined',
          __WORKER_FALLBACK_BASE_URL__: 'import.meta.url',
        },
      },
    },
  },
  {
    ...sharedBuildOptions,
    clean: false,
    entry: {
      'player-engine-worker': './src/player/player-engine-worker-entry.ts',
    },
    format: ['iife'],
    globalName: 'mpegtsPlayerEngineWorker',
    inputOptions: {
      transform: {
        define: {
          __VERSION__: JSON.stringify(packageJson.version),
          __WORKER_BASE_URL__: 'self.location.href',
          __WORKER_FALLBACK_BASE_URL__: 'undefined',
        },
      },
    },
    outputOptions: {
      entryFileNames: 'player-engine-worker.js',
    },
  },
  {
    ...sharedBuildOptions,
    clean: false,
    entry: {
      'transmuxing-worker': './src/core/transmuxing-worker-entry.js',
    },
    format: ['iife'],
    globalName: 'mpegtsTransmuxingWorker',
    inputOptions: {
      transform: {
        define: {
          __VERSION__: JSON.stringify(packageJson.version),
          __WORKER_BASE_URL__: 'self.location.href',
          __WORKER_FALLBACK_BASE_URL__: 'undefined',
        },
      },
    },
    outputOptions: {
      entryFileNames: 'transmuxing-worker.js',
    },
  },
])
