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
import type { MediaDataSource } from './media-data-source'

export interface PlayerConstructor<T extends Player> {
  new (mediaDataSource: MediaDataSource, config?: Config): T
}

export interface NativePlayerStatisticsInfo {
  playerType: 'NativePlayer'
  url?: string
  decodedFrames?: number
  droppedFrames?: number
}

export interface MSEPlayerReportStatisticsInfo {
  url: string
  hasRedirect: boolean
  redirectedURL?: string
  speed: number
  loaderType: string
  currentSegmentIndex: number
  totalSegmentCount: number
}

export interface MSEPlayerStatisticsInfo extends Partial<MSEPlayerReportStatisticsInfo> {
  playerType: 'MSEPlayer'
  decodedFrames?: number
  droppedFrames?: number
}

export interface NativePlayerMediaInfo {
  mimeType: string
  duration?: number
  width?: number
  height?: number
}

export interface MSEPlayerMediaInfo extends NativePlayerMediaInfo {
  audioCodec?: string
  videoCodec?: string
  audioDataRate?: number
  videoDataRate?: number
  hasAudio?: boolean
  hasVideo?: boolean
  chromaFormat?: string
  fps?: number
  [key: string]: any
}

export interface Player {
  destroy(): void
  on(event: string, listener: (...args: any[]) => void): void
  off(event: string, listener: (...args: any[]) => void): void
  attachMediaElement(mediaElement: HTMLMediaElement): void
  detachMediaElement(): void
  load(): void
  unload(): void
  play(): Promise<void> | void
  pause(): void
  type: string
  buffered: TimeRanges
  duration: number
  volume: number
  muted: boolean
  currentTime: number
  mediaInfo: NativePlayerMediaInfo | MSEPlayerMediaInfo
  statisticsInfo: NativePlayerStatisticsInfo | MSEPlayerStatisticsInfo
}

export interface MSEPlayer extends Player {
  mediaInfo: MSEPlayerMediaInfo
  statisticsInfo: MSEPlayerStatisticsInfo
}

export interface NativePlayer extends Player {
  mediaInfo: NativePlayerMediaInfo
  statisticsInfo: NativePlayerStatisticsInfo
}
