const TRANSMUXING_WORKER_PATH = './transmuxing-worker.js'
const PLAYER_ENGINE_WORKER_PATH = './player-engine-worker.js'
const WORKER_BASE_URL = __WORKER_BASE_URL__
const WORKER_FALLBACK_BASE_URL = __WORKER_FALLBACK_BASE_URL__

function resolveWorkerBaseUrl() {
  return WORKER_BASE_URL || WORKER_FALLBACK_BASE_URL
}

function createWorker(workerPath) {
  return new Worker(new URL(workerPath, resolveWorkerBaseUrl()))
}

export function createTransmuxingWorker() {
  return createWorker(TRANSMUXING_WORKER_PATH)
}

export function createPlayerEngineWorker() {
  return createWorker(PLAYER_ENGINE_WORKER_PATH)
}
