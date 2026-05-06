import work from './webworkify-webpack'

const transmuxingWorkerModuleId = require.resolve('../core/transmuxing-worker')
const playerEngineWorkerModuleId = require.resolve('../player/player-engine-worker')

export function createTransmuxingWorker() {
  return work(transmuxingWorkerModuleId)
}

export function createPlayerEngineWorker() {
  return work(playerEngineWorkerModuleId, { all: true })
}
