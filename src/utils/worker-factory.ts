declare const __WORKER_BASE_URL__: string | undefined
declare const __WORKER_FALLBACK_BASE_URL__: string | undefined

const TRANSMUXING_WORKER_PATH = './transmuxing-worker.js'
const PLAYER_ENGINE_WORKER_PATH = './player-engine-worker.js'
const WORKER_BASE_URL = __WORKER_BASE_URL__
const WORKER_FALLBACK_BASE_URL = __WORKER_FALLBACK_BASE_URL__

function resolveWorkerBaseUrl(): string {
  return WORKER_BASE_URL || WORKER_FALLBACK_BASE_URL
}

function createWorker(workerPath: string): Worker {
  return new Worker(new URL(workerPath, resolveWorkerBaseUrl()))
}

export function createTransmuxingWorker(): Worker {
  return createWorker(TRANSMUXING_WORKER_PATH)
}

export function createPlayerEngineWorker(): Worker {
  return createWorker(PLAYER_ENGINE_WORKER_PATH)
}
