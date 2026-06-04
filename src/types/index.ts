/*
 * Copyright (C) 2026 zheng qian. All Rights Reserved.
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

import type { Config } from './config'
import type { Events } from './events'
import type { ErrorDetails, ErrorTypes } from './errors'
import type { FeatureList } from './features'
import type { BaseLoaderConstructor, LoaderErrors, LoaderStatus } from './loader'
import type { LoggingControl } from './logging'
import type { MediaDataSource } from './media-data-source'
import type { MSEPlayer, NativePlayer, Player, PlayerConstructor } from './player'

export type { Config } from './config'
export type { Events } from './events'
export type { ErrorDetails, ErrorTypes } from './errors'
export type { FeatureList } from './features'
export type {
  BaseLoader,
  BaseLoaderConstructor,
  CustomLoaderConstructor,
  CustomSeekHandlerConstructor,
  LoaderErrorInfo,
  LoaderErrorMessage,
  LoaderErrorType,
  LoaderErrors,
  LoaderStatus,
  LoaderStatusType,
  Range,
  SeekConfig,
  SeekHandler,
  SeekRange,
} from './loader'
export type { LoggingControl, LoggingControlConfig } from './logging'
export type { MediaDataSource, MediaDataSourceSegment, MediaSegment } from './media-data-source'
export type {
  MSEPlayer,
  MSEPlayerMediaInfo,
  MSEPlayerReportStatisticsInfo,
  MSEPlayerStatisticsInfo,
  NativePlayer,
  NativePlayerMediaInfo,
  NativePlayerStatisticsInfo,
  Player,
  PlayerConstructor,
} from './player'

export interface MpegtsExports {
  createPlayer: (mediaDataSource: MediaDataSource, optionalConfig?: Config) => Player
  isSupported: () => boolean
  getFeatureList: () => FeatureList
  BaseLoader: BaseLoaderConstructor
  LoaderStatus: LoaderStatus
  LoaderErrors: LoaderErrors
  Events: Events
  ErrorTypes: ErrorTypes
  ErrorDetails: ErrorDetails
  MSEPlayer: PlayerConstructor<MSEPlayer>
  NativePlayer: PlayerConstructor<NativePlayer>
  LoggingControl: LoggingControl
  readonly version: string
}
