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
import { createDefaultConfig } from '../config.js'
import type { DataSource } from '../io/loader'
import { InvalidArgumentException, IllegalStateException } from '../utils/exception.js'
import PlayerEvents from './player-events'

type NativePlayerPendingEvents = {
  onvLoadedMetadata: (event: Event) => void
}

type NativePlayerMediaInfo = {
  mimeType: string
  duration?: number
  width?: number
  height?: number
}

type NativePlayerStatisticsInfo = {
  playerType: 'NativePlayer'
  url?: string
  decodedFrames?: number
  droppedFrames?: number
}

type NativeHTMLVideoElement = HTMLVideoElement & {
  webkitDecodedFrameCount?: number
  webkitDroppedFrameCount?: number
}

// Player wrapper for browser's native player (HTMLVideoElement) without MediaSource src.
class NativePlayer {
  private readonly TAG: string = 'NativePlayer'
  private _type = 'NativePlayer' as const
  private _emitter: EventEmitter
  private _config: Config
  private e: NativePlayerPendingEvents | null
  private _pendingSeekTime: number | null
  private _statisticsReporter: number | null
  private _mediaDataSource: DataSource | null
  private _mediaElement: HTMLMediaElement | null

  constructor(mediaDataSource: DataSource, config?: Partial<Config>) {
    this._emitter = new EventEmitter()

    this._config = createDefaultConfig()
    if (typeof config === 'object' && config != null) {
      Object.assign(this._config, config)
    }

    const typeLowerCase = String(mediaDataSource.type).toLowerCase()

    if (typeLowerCase === 'mse' || typeLowerCase === 'mpegts' || typeLowerCase === 'm2ts' || typeLowerCase === 'flv') {
      throw new InvalidArgumentException("NativePlayer does't support mse/mpegts/m2ts/flv MediaDataSource input!")
    }
    if (Object.prototype.hasOwnProperty.call(mediaDataSource, 'segments')) {
      throw new InvalidArgumentException(`NativePlayer(${mediaDataSource.type}) doesn't support multipart playback!`)
    }

    this.e = {
      onvLoadedMetadata: this._onvLoadedMetadata.bind(this),
    }

    this._pendingSeekTime = null
    this._statisticsReporter = null

    this._mediaDataSource = mediaDataSource
    this._mediaElement = null
  }

  destroy(): void {
    this._emitter.emit(PlayerEvents.DESTROYING)
    if (this._mediaElement) {
      this.unload()
      this.detachMediaElement()
    }
    this.e = null
    this._mediaDataSource = null
    this._emitter.removeAllListeners()
  }

  on(event: string, listener: (...args: any[]) => void): void {
    if (event === PlayerEvents.MEDIA_INFO) {
      if (this._mediaElement != null && this._mediaElement.readyState !== 0) {
        Promise.resolve().then(() => {
          this._emitter.emit(PlayerEvents.MEDIA_INFO, this.mediaInfo)
        })
      }
    } else if (event === PlayerEvents.STATISTICS_INFO) {
      if (this._mediaElement != null && this._mediaElement.readyState !== 0) {
        Promise.resolve().then(() => {
          this._emitter.emit(PlayerEvents.STATISTICS_INFO, this.statisticsInfo)
        })
      }
    }
    this._emitter.addListener(event, listener)
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this._emitter.removeListener(event, listener)
  }

  attachMediaElement(mediaElement: HTMLMediaElement): void {
    this._mediaElement = mediaElement
    mediaElement.addEventListener('loadedmetadata', this.e!.onvLoadedMetadata)

    if (this._pendingSeekTime != null) {
      try {
        mediaElement.currentTime = this._pendingSeekTime
        this._pendingSeekTime = null
      } catch (_error) {
        // Defer currentTime update until metadata is available.
      }
    }
  }

  detachMediaElement(): void {
    if (this._mediaElement) {
      this._mediaElement.src = ''
      this._mediaElement.removeAttribute('src')
      this._mediaElement.removeEventListener('loadedmetadata', this.e!.onvLoadedMetadata)
      this._mediaElement = null
    }
    if (this._statisticsReporter != null) {
      window.clearInterval(this._statisticsReporter)
      this._statisticsReporter = null
    }
  }

  load(): void {
    if (!this._mediaElement) {
      throw new IllegalStateException('HTMLMediaElement must be attached before load()!')
    }
    this._mediaElement.src = String(this._mediaDataSource?.url ?? '')

    if (this._mediaElement.readyState > 0) {
      this._mediaElement.currentTime = 0
    }

    this._mediaElement.preload = 'auto'
    this._mediaElement.load()
    this._statisticsReporter = window.setInterval(this._reportStatisticsInfo.bind(this), this._config.statisticsInfoReportInterval)
  }

  unload(): void {
    if (this._mediaElement) {
      this._mediaElement.src = ''
      this._mediaElement.removeAttribute('src')
    }
    if (this._statisticsReporter != null) {
      window.clearInterval(this._statisticsReporter)
      this._statisticsReporter = null
    }
  }

  play(): Promise<void> {
    return this._mediaElement!.play()
  }

  pause(): void {
    this._mediaElement!.pause()
  }

  get type(): string {
    return this._type
  }

  get buffered(): TimeRanges {
    return this._mediaElement!.buffered
  }

  get duration(): number {
    return this._mediaElement!.duration
  }

  get volume(): number {
    return this._mediaElement!.volume
  }

  set volume(value: number) {
    this._mediaElement!.volume = value
  }

  get muted(): boolean {
    return this._mediaElement!.muted
  }

  set muted(muted: boolean) {
    this._mediaElement!.muted = muted
  }

  get currentTime(): number {
    if (this._mediaElement) {
      return this._mediaElement.currentTime
    }
    return 0
  }

  set currentTime(seconds: number) {
    if (this._mediaElement) {
      this._mediaElement.currentTime = seconds
    } else {
      this._pendingSeekTime = seconds
    }
  }

  get mediaInfo(): NativePlayerMediaInfo {
    const mediaPrefix = this._mediaElement instanceof HTMLAudioElement ? 'audio/' : 'video/'
    const info: NativePlayerMediaInfo = {
      mimeType: mediaPrefix + String(this._mediaDataSource?.type ?? ''),
    }

    if (this._mediaElement) {
      info.duration = Math.floor(this._mediaElement.duration * 1000)
      if (this._mediaElement instanceof HTMLVideoElement) {
        info.width = this._mediaElement.videoWidth
        info.height = this._mediaElement.videoHeight
      }
    }
    return info
  }

  get statisticsInfo(): NativePlayerStatisticsInfo {
    const info: NativePlayerStatisticsInfo = {
      playerType: this._type,
      url: typeof this._mediaDataSource?.url === 'string' ? this._mediaDataSource.url : undefined,
    }

    if (!(this._mediaElement instanceof HTMLVideoElement)) {
      return info
    }

    const mediaElement = this._mediaElement as NativeHTMLVideoElement
    let hasQualityInfo = true
    let decoded = 0
    let dropped = 0

    if (mediaElement.getVideoPlaybackQuality) {
      const quality = mediaElement.getVideoPlaybackQuality()
      decoded = quality.totalVideoFrames
      dropped = quality.droppedVideoFrames
    } else if (mediaElement.webkitDecodedFrameCount !== undefined) {
      decoded = mediaElement.webkitDecodedFrameCount
      dropped = mediaElement.webkitDroppedFrameCount ?? 0
    } else {
      hasQualityInfo = false
    }

    if (hasQualityInfo) {
      info.decodedFrames = decoded
      info.droppedFrames = dropped
    }

    return info
  }

  private _onvLoadedMetadata(_event: Event): void {
    if (this._pendingSeekTime != null) {
      this._mediaElement!.currentTime = this._pendingSeekTime
      this._pendingSeekTime = null
    }
    this._emitter.emit(PlayerEvents.MEDIA_INFO, this.mediaInfo)
  }

  private _reportStatisticsInfo(): void {
    this._emitter.emit(PlayerEvents.STATISTICS_INFO, this.statisticsInfo)
  }
}

export default NativePlayer
