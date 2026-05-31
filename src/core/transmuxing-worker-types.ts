/*
 * Copyright (C) 2023 zheng qian. All Rights Reserved.
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

import type { Config } from '../config'
import type { DataSource } from '../io/loader'
import type { LoggingControlConfig } from '../utils/logging-control.js'

export type TransmuxingWorkerCommand =
  | { cmd: 'init'; param: [DataSource, Config] }
  | { cmd: 'logging_config'; param: LoggingControlConfig }
  | { cmd: 'destroy' | 'start' | 'stop' | 'pause' | 'resume' }
  | { cmd: 'seek'; param: number }

export type TransmuxingWorkerMediaMessage = {
  msg: 'init_segment' | 'media_segment'
  data: {
    type: string
    data: any
  }
}

export type TransmuxingWorkerErrorMessage = {
  msg: 'io_error' | 'demux_error'
  data: {
    type: any
    info: any
  }
}

export type TransmuxingWorkerDataMessage = {
  msg:
    | 'media_info'
    | 'metadata_arrived'
    | 'scriptdata_arrived'
    | 'timed_id3_metadata_arrived'
    | 'pgs_subtitle_arrived'
    | 'synchronous_klv_metadata_arrived'
    | 'asynchronous_klv_metadata_arrived'
    | 'smpte2038_metadata_arrived'
    | 'sei_arrived'
    | 'scte35_metadata_arrived'
    | 'pes_private_data_descriptor'
    | 'pes_private_data_arrived'
    | 'statistics_info'
  data: any
}

export type TransmuxingWorkerRecommendSeekpointMessage = {
  msg: 'recommend_seekpoint'
  data: number
}

export type TransmuxingWorkerSimpleMessage = {
  msg: 'loading_complete' | 'recovered_early_eof' | 'destroyed'
}

export type TransmuxingWorkerLogcatMessage = {
  msg: 'logcat_callback'
  data: {
    type: string
    logcat: string
  }
}

export type TransmuxingWorkerMessage =
  | TransmuxingWorkerMediaMessage
  | TransmuxingWorkerErrorMessage
  | TransmuxingWorkerDataMessage
  | TransmuxingWorkerRecommendSeekpointMessage
  | TransmuxingWorkerSimpleMessage
  | TransmuxingWorkerLogcatMessage
