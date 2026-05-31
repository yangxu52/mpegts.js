/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import EventEmitter from 'events'
import type { Config } from '../config'
import { createTransmuxingWorker } from '../utils/worker-factory.js'
import Log from '../utils/logger.js'
import LoggingControl from '../utils/logging-control.js'
import type { LoggingControlConfig } from '../utils/logging-control.js'
import TransmuxingController from './transmuxing-controller.js'
import TransmuxingEvents from './transmuxing-events'
import MediaInfo from './media-info.js'
import type { TransmuxingWorkerCommand, TransmuxingWorkerMessage } from './transmuxing-worker-types'

type LoggingListenerMap = {
  onLoggingConfigChanged: (config: LoggingControlConfig) => void
}

class Transmuxer {
  private readonly TAG: string = 'Transmuxer'
  private _emitter: EventEmitter
  private _worker: Worker | null
  private _workerDestroying: boolean
  private _controller: TransmuxingController | null
  private e: LoggingListenerMap | null

  constructor(mediaDataSource: any, config: Config) {
    this._emitter = new EventEmitter()
    this._worker = null
    this._workerDestroying = false
    this._controller = null
    this.e = null

    if (config.enableWorker && typeof Worker !== 'undefined') {
      try {
        this._worker = createTransmuxingWorker()
        this._workerDestroying = false
        this._worker.addEventListener('message', this._onWorkerMessage.bind(this))
        this._worker.postMessage({ cmd: 'init', param: [mediaDataSource, config] } as TransmuxingWorkerCommand)
        this.e = {
          onLoggingConfigChanged: this._onLoggingConfigChanged.bind(this),
        }
        LoggingControl.registerListener(this.e.onLoggingConfigChanged)
        this._worker.postMessage({ cmd: 'logging_config', param: LoggingControl.getConfig() } as TransmuxingWorkerCommand)
      } catch (_error) {
        Log.e(this.TAG, 'Error while initialize transmuxing worker, fallback to inline transmuxing')
        this._worker = null
        this._controller = new TransmuxingController(mediaDataSource, config)
      }
    } else {
      this._controller = new TransmuxingController(mediaDataSource, config)
    }

    if (this._controller) {
      let ctl = this._controller
      ctl.on(TransmuxingEvents.IO_ERROR, this._onIOError.bind(this))
      ctl.on(TransmuxingEvents.DEMUX_ERROR, this._onDemuxError.bind(this))
      ctl.on(TransmuxingEvents.INIT_SEGMENT, this._onInitSegment.bind(this))
      ctl.on(TransmuxingEvents.MEDIA_SEGMENT, this._onMediaSegment.bind(this))
      ctl.on(TransmuxingEvents.LOADING_COMPLETE, this._onLoadingComplete.bind(this))
      ctl.on(TransmuxingEvents.RECOVERED_EARLY_EOF, this._onRecoveredEarlyEof.bind(this))
      ctl.on(TransmuxingEvents.MEDIA_INFO, this._onMediaInfo.bind(this))
      ctl.on(TransmuxingEvents.METADATA_ARRIVED, this._onMetaDataArrived.bind(this))
      ctl.on(TransmuxingEvents.SCRIPTDATA_ARRIVED, this._onScriptDataArrived.bind(this))
      ctl.on(TransmuxingEvents.TIMED_ID3_METADATA_ARRIVED, this._onTimedID3MetadataArrived.bind(this))
      ctl.on(TransmuxingEvents.SYNCHRONOUS_KLV_METADATA_ARRIVED, this._onSynchronousKLVMetadataArrived.bind(this))
      ctl.on(TransmuxingEvents.ASYNCHRONOUS_KLV_METADATA_ARRIVED, this._onAsynchronousKLVMetadataArrived.bind(this))
      ctl.on(TransmuxingEvents.SMPTE2038_METADATA_ARRIVED, this._onSMPTE2038MetadataArrived.bind(this))
      ctl.on(TransmuxingEvents.SEI_ARRIVED, this._onSEIArrived.bind(this))
      ctl.on(TransmuxingEvents.SCTE35_METADATA_ARRIVED, this._onSCTE35MetadataArrived.bind(this))
      ctl.on(TransmuxingEvents.PES_PRIVATE_DATA_DESCRIPTOR, this._onPESPrivateDataDescriptor.bind(this))
      ctl.on(TransmuxingEvents.PES_PRIVATE_DATA_ARRIVED, this._onPESPrivateDataArrived.bind(this))
      ctl.on(TransmuxingEvents.STATISTICS_INFO, this._onStatisticsInfo.bind(this))
      ctl.on(TransmuxingEvents.RECOMMEND_SEEKPOINT, this._onRecommendSeekpoint.bind(this))
    }
  }

  destroy(): void {
    if (this._worker) {
      if (!this._workerDestroying) {
        this._workerDestroying = true
        this._worker.postMessage({ cmd: 'destroy' } as TransmuxingWorkerCommand)
        if (this.e) {
          LoggingControl.removeListener(this.e.onLoggingConfigChanged)
          this.e = null
        }
      }
    } else {
      this._controller?.destroy()
      this._controller = null
    }
    this._emitter.removeAllListeners()
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this._emitter.addListener(event, listener)
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this._emitter.removeListener(event, listener)
  }

  hasWorker(): boolean {
    return this._worker != null
  }

  open(): void {
    if (this._worker) {
      this._worker.postMessage({ cmd: 'start' } as TransmuxingWorkerCommand)
    } else {
      this._controller?.start()
    }
  }

  close(): void {
    if (this._worker) {
      this._worker.postMessage({ cmd: 'stop' } as TransmuxingWorkerCommand)
    } else {
      this._controller?.stop()
    }
  }

  seek(milliseconds: number): void {
    if (this._worker) {
      this._worker.postMessage({ cmd: 'seek', param: milliseconds } as TransmuxingWorkerCommand)
    } else {
      this._controller?.seek(milliseconds)
    }
  }

  pause(): void {
    if (this._worker) {
      this._worker.postMessage({ cmd: 'pause' } as TransmuxingWorkerCommand)
    } else {
      this._controller?.pause()
    }
  }

  resume(): void {
    if (this._worker) {
      this._worker.postMessage({ cmd: 'resume' } as TransmuxingWorkerCommand)
    } else {
      this._controller?.resume()
    }
  }

  _onInitSegment(type: string, initSegment: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.INIT_SEGMENT, type, initSegment)
    })
  }

  _onMediaSegment(type: string, mediaSegment: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.MEDIA_SEGMENT, type, mediaSegment)
    })
  }

  _onLoadingComplete(): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.LOADING_COMPLETE)
    })
  }

  _onRecoveredEarlyEof(): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.RECOVERED_EARLY_EOF)
    })
  }

  _onMediaInfo(mediaInfo: MediaInfo): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.MEDIA_INFO, mediaInfo)
    })
  }

  _onMetaDataArrived(metadata: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.METADATA_ARRIVED, metadata)
    })
  }

  _onScriptDataArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.SCRIPTDATA_ARRIVED, data)
    })
  }

  _onTimedID3MetadataArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.TIMED_ID3_METADATA_ARRIVED, data)
    })
  }

  _onPGSSubtitleArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.PGS_SUBTITLE_ARRIVED, data)
    })
  }

  _onSynchronousKLVMetadataArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.SYNCHRONOUS_KLV_METADATA_ARRIVED, data)
    })
  }

  _onAsynchronousKLVMetadataArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.ASYNCHRONOUS_KLV_METADATA_ARRIVED, data)
    })
  }

  _onSMPTE2038MetadataArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.SMPTE2038_METADATA_ARRIVED, data)
    })
  }

  _onSEIArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.SEI_ARRIVED, data)
    })
  }

  _onSCTE35MetadataArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.SCTE35_METADATA_ARRIVED, data)
    })
  }

  _onPESPrivateDataDescriptor(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.PES_PRIVATE_DATA_DESCRIPTOR, data)
    })
  }

  _onPESPrivateDataArrived(data: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.PES_PRIVATE_DATA_ARRIVED, data)
    })
  }

  _onStatisticsInfo(statisticsInfo: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.STATISTICS_INFO, statisticsInfo)
    })
  }

  _onIOError(type: any, info: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.IO_ERROR, type, info)
    })
  }

  _onDemuxError(type: any, info: any): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.DEMUX_ERROR, type, info)
    })
  }

  _onRecommendSeekpoint(milliseconds: number): void {
    Promise.resolve().then(() => {
      this._emitter.emit(TransmuxingEvents.RECOMMEND_SEEKPOINT, milliseconds)
    })
  }

  _onLoggingConfigChanged(config: LoggingControlConfig): void {
    if (this._worker) {
      this._worker.postMessage({ cmd: 'logging_config', param: config } as TransmuxingWorkerCommand)
    }
  }

  _onWorkerMessage(e: MessageEvent<TransmuxingWorkerMessage>): void {
    let message = e.data

    if (message.msg === 'destroyed' || this._workerDestroying) {
      this._workerDestroying = false
      this._worker?.terminate()
      this._worker = null
      return
    }

    switch (message.msg) {
      case TransmuxingEvents.INIT_SEGMENT:
      case TransmuxingEvents.MEDIA_SEGMENT:
        this._emitter.emit(message.msg, message.data.type, message.data.data)
        break
      case TransmuxingEvents.LOADING_COMPLETE:
      case TransmuxingEvents.RECOVERED_EARLY_EOF:
        this._emitter.emit(message.msg)
        break
      case TransmuxingEvents.MEDIA_INFO: {
        const data = message.data
        Object.setPrototypeOf(data, MediaInfo.prototype)
        this._emitter.emit(message.msg, data)
        break
      }
      case TransmuxingEvents.METADATA_ARRIVED:
      case TransmuxingEvents.SCRIPTDATA_ARRIVED:
      case TransmuxingEvents.TIMED_ID3_METADATA_ARRIVED:
      case TransmuxingEvents.PGS_SUBTITLE_ARRIVED:
      case TransmuxingEvents.SYNCHRONOUS_KLV_METADATA_ARRIVED:
      case TransmuxingEvents.ASYNCHRONOUS_KLV_METADATA_ARRIVED:
      case TransmuxingEvents.SMPTE2038_METADATA_ARRIVED:
      case TransmuxingEvents.SCTE35_METADATA_ARRIVED:
      case TransmuxingEvents.SEI_ARRIVED:
      case TransmuxingEvents.PES_PRIVATE_DATA_DESCRIPTOR:
      case TransmuxingEvents.PES_PRIVATE_DATA_ARRIVED:
      case TransmuxingEvents.STATISTICS_INFO:
        this._emitter.emit(message.msg, message.data)
        break
      case TransmuxingEvents.IO_ERROR:
      case TransmuxingEvents.DEMUX_ERROR:
        this._emitter.emit(message.msg, message.data.type, message.data.info)
        break
      case TransmuxingEvents.RECOMMEND_SEEKPOINT:
        this._emitter.emit(message.msg, message.data)
        break
      case 'logcat_callback':
        Log.emitter.emit('log', message.data.type, message.data.logcat)
        break
      default:
        break
    }
  }
}

export default Transmuxer
