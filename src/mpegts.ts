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

import Features from './core/features'
import { BaseLoader, LoaderStatus, LoaderErrors } from './io/loader'
import MSEPlayer from './player/mse-player'
import NativePlayer from './player/native-player'
import PlayerEvents from './player/player-events'
import { ErrorTypes, ErrorDetails } from './player/player-errors.js'
import LoggingControl from './utils/logging-control.js'
import type { Config, FeatureList, MediaDataSource, MpegtsExports } from './types'
import { InvalidArgumentException } from './utils/exception.js'

declare const __VERSION__: string

type PlayerInstance = MSEPlayer | NativePlayer

// here are all the interfaces

// factory method
function createPlayer(mediaDataSource: MediaDataSource, optionalConfig?: Config): PlayerInstance {
  let mds = mediaDataSource
  if (mds == null || typeof mds !== 'object') {
    throw new InvalidArgumentException('MediaDataSource must be an javascript object!')
  }

  if (!mds.hasOwnProperty('type')) {
    throw new InvalidArgumentException('MediaDataSource must has type field to indicate video file type!')
  }

  switch (mds.type as string) {
    case 'mse':
    case 'mpegts':
    case 'm2ts':
    case 'flv':
      return new MSEPlayer(mds, optionalConfig)
    default:
      return new NativePlayer(mds, optionalConfig)
  }
}

// feature detection
function isSupported(): boolean {
  return Features.supportMSEH264Playback()
}

function getFeatureList(): FeatureList {
  return Features.getFeatureList()
}

// interfaces
let mpegts: Omit<MpegtsExports, 'version'> = {
  createPlayer,
  isSupported,
  getFeatureList,
  BaseLoader,
  LoaderStatus,
  LoaderErrors,
  Events: PlayerEvents,
  ErrorTypes,
  ErrorDetails,
  MSEPlayer,
  NativePlayer,
  LoggingControl,
}

Object.defineProperty(mpegts, 'version', {
  enumerable: true,
  get: function (): string {
    // replaced by webpack.DefinePlugin
    return __VERSION__
  },
})

export default mpegts as MpegtsExports
