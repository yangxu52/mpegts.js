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

import LoggingControl from '../utils/logging-control.js'
import TransmuxingController from './transmuxing-controller.js'
import TransmuxingEvents from './transmuxing-events'
import type {
  TransmuxingWorkerCommand,
  TransmuxingWorkerDataMessage,
  TransmuxingWorkerErrorMessage,
  TransmuxingWorkerLogcatMessage,
  TransmuxingWorkerMediaMessage,
  TransmuxingWorkerMessage,
  TransmuxingWorkerRecommendSeekpointMessage,
  TransmuxingWorkerSimpleMessage,
} from './transmuxing-worker-types'

/* post message to worker:
   data: {
       cmd: string
       param: any
   }

   receive message from worker:
   data: {
       msg: string,
       data: any
   }
 */

const TransmuxingWorker = (self: DedicatedWorkerGlobalScope) => {
  let controller: TransmuxingController | null = null
  const logcatListener = onLogcatCallback

  self.addEventListener('message', (event: MessageEvent<TransmuxingWorkerCommand>) => {
    const command = event.data

    switch (command.cmd) {
      case 'init':
        controller = new TransmuxingController(command.param[0], command.param[1])
        controller.on(TransmuxingEvents.IO_ERROR, onIOError)
        controller.on(TransmuxingEvents.DEMUX_ERROR, onDemuxError)
        controller.on(TransmuxingEvents.INIT_SEGMENT, onInitSegment)
        controller.on(TransmuxingEvents.MEDIA_SEGMENT, onMediaSegment)
        controller.on(TransmuxingEvents.LOADING_COMPLETE, onLoadingComplete)
        controller.on(TransmuxingEvents.RECOVERED_EARLY_EOF, onRecoveredEarlyEof)
        controller.on(TransmuxingEvents.MEDIA_INFO, onMediaInfo)
        controller.on(TransmuxingEvents.METADATA_ARRIVED, onMetaDataArrived)
        controller.on(TransmuxingEvents.SCRIPTDATA_ARRIVED, onScriptDataArrived)
        controller.on(TransmuxingEvents.TIMED_ID3_METADATA_ARRIVED, onTimedID3MetadataArrived)
        controller.on(TransmuxingEvents.PGS_SUBTITLE_ARRIVED, onPGSSubtitleDataArrived)
        controller.on(TransmuxingEvents.SYNCHRONOUS_KLV_METADATA_ARRIVED, onSynchronousKLVMetadataArrived)
        controller.on(TransmuxingEvents.ASYNCHRONOUS_KLV_METADATA_ARRIVED, onAsynchronousKLVMetadataArrived)
        controller.on(TransmuxingEvents.SMPTE2038_METADATA_ARRIVED, onSMPTE2038MetadataArrived)
        controller.on(TransmuxingEvents.SEI_ARRIVED, onSEIArrived)
        controller.on(TransmuxingEvents.SCTE35_METADATA_ARRIVED, onSCTE35MetadataArrived)
        controller.on(TransmuxingEvents.PES_PRIVATE_DATA_DESCRIPTOR, onPESPrivateDataDescriptor)
        controller.on(TransmuxingEvents.PES_PRIVATE_DATA_ARRIVED, onPESPrivateDataArrived)
        controller.on(TransmuxingEvents.STATISTICS_INFO, onStatisticsInfo)
        controller.on(TransmuxingEvents.RECOMMEND_SEEKPOINT, onRecommendSeekpoint)
        break
      case 'destroy':
        if (controller) {
          controller.destroy()
          controller = null
        }
        postMessage({ msg: 'destroyed' })
        break
      case 'start':
        controller!.start()
        break
      case 'stop':
        controller!.stop()
        break
      case 'seek':
        controller!.seek(command.param)
        break
      case 'pause':
        controller!.pause()
        break
      case 'resume':
        controller!.resume()
        break
      case 'logging_config': {
        const config = command.param
        LoggingControl.applyConfig(config)

        if (config.enableCallback === true) {
          LoggingControl.addLogListener(logcatListener)
        } else {
          LoggingControl.removeLogListener(logcatListener)
        }
        break
      }
    }
  })

  function postMessage(message: TransmuxingWorkerMessage, transfer?: Transferable[]): void {
    if (transfer) {
      self.postMessage(message, transfer)
    } else {
      self.postMessage(message)
    }
  }

  function onInitSegment(type: string, initSegment: any): void {
    const message: TransmuxingWorkerMediaMessage = {
      msg: TransmuxingEvents.INIT_SEGMENT,
      data: {
        type: type,
        data: initSegment,
      },
    }

    postMessage(message, [initSegment.data as ArrayBuffer])
  }

  function onMediaSegment(type: string, mediaSegment: any): void {
    const message: TransmuxingWorkerMediaMessage = {
      msg: TransmuxingEvents.MEDIA_SEGMENT,
      data: {
        type: type,
        data: mediaSegment,
      },
    }

    postMessage(message, [mediaSegment.data as ArrayBuffer])
  }

  function onLoadingComplete(): void {
    const message: TransmuxingWorkerSimpleMessage = {
      msg: TransmuxingEvents.LOADING_COMPLETE,
    }

    postMessage(message)
  }

  function onRecoveredEarlyEof(): void {
    const message: TransmuxingWorkerSimpleMessage = {
      msg: TransmuxingEvents.RECOVERED_EARLY_EOF,
    }

    postMessage(message)
  }

  function onMediaInfo(mediaInfo: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.MEDIA_INFO,
      data: mediaInfo,
    }

    postMessage(message)
  }

  function onMetaDataArrived(metadata: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.METADATA_ARRIVED,
      data: metadata,
    }

    postMessage(message)
  }

  function onScriptDataArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.SCRIPTDATA_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onTimedID3MetadataArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.TIMED_ID3_METADATA_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onPGSSubtitleDataArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.PGS_SUBTITLE_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onSynchronousKLVMetadataArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.SYNCHRONOUS_KLV_METADATA_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onAsynchronousKLVMetadataArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.ASYNCHRONOUS_KLV_METADATA_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onSMPTE2038MetadataArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.SMPTE2038_METADATA_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onSEIArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.SEI_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onSCTE35MetadataArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.SCTE35_METADATA_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onPESPrivateDataDescriptor(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.PES_PRIVATE_DATA_DESCRIPTOR,
      data: data,
    }

    postMessage(message)
  }

  function onPESPrivateDataArrived(data: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.PES_PRIVATE_DATA_ARRIVED,
      data: data,
    }

    postMessage(message)
  }

  function onStatisticsInfo(statisticsInfo: any): void {
    const message: TransmuxingWorkerDataMessage = {
      msg: TransmuxingEvents.STATISTICS_INFO,
      data: statisticsInfo,
    }

    postMessage(message)
  }

  function onIOError(type: any, info: any): void {
    const message: TransmuxingWorkerErrorMessage = {
      msg: TransmuxingEvents.IO_ERROR,
      data: {
        type: type,
        info: info,
      },
    }

    postMessage(message)
  }

  function onDemuxError(type: any, info: any): void {
    const message: TransmuxingWorkerErrorMessage = {
      msg: TransmuxingEvents.DEMUX_ERROR,
      data: {
        type: type,
        info: info,
      },
    }

    postMessage(message)
  }

  function onRecommendSeekpoint(milliseconds: number): void {
    const message: TransmuxingWorkerRecommendSeekpointMessage = {
      msg: TransmuxingEvents.RECOMMEND_SEEKPOINT,
      data: milliseconds,
    }

    postMessage(message)
  }

  function onLogcatCallback(type: string, str: string): void {
    const message: TransmuxingWorkerLogcatMessage = {
      msg: 'logcat_callback',
      data: {
        type: type,
        logcat: str,
      },
    }

    postMessage(message)
  }
}

export default TransmuxingWorker
