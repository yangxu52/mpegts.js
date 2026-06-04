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

import Log from '../utils/logger.js'
import type { Config } from '../config'
import SpeedSampler from './speed-sampler'
import { RuntimeException } from '../utils/exception.js'
import { BaseLoader, LoaderErrors, LoaderStatus } from './loader'
import type { DataSource, LoaderErrorInfo, LoaderErrorType, SeekHandler, SeekRange } from './loader'

type RangeLoaderDataSource = DataSource & {
  url: string
  redirectedURL?: string
  withCredentials?: boolean
  filesize?: number
}

// Universal IO Loader, implemented by adding Range header in xhr's request header
class RangeLoader extends BaseLoader {
  private readonly TAG: string = 'RangeLoader'
  private _seekHandler: SeekHandler
  private _config: Config
  private _dataSource: RangeLoaderDataSource | null
  private _range: SeekRange
  private _chunkSizeKBList: number[]
  private _currentChunkSizeKB: number
  private _currentSpeedNormalized: number
  private _zeroSpeedChunkCount: number
  private _xhr: XMLHttpRequest | null
  private _speedSampler: SpeedSampler
  private _requestAbort: boolean
  private _waitForTotalLength: boolean
  private _totalLengthReceived: boolean
  private _currentRequestURL: string | null
  private _currentRedirectedURL: string | null
  private _currentRequestRange: SeekRange | null
  private _totalLength: number | null
  private _contentLength: number | null
  private _receivedLength: number
  private _lastTimeLoaded: number

  static isSupported() {
    try {
      let xhr = new XMLHttpRequest()
      xhr.open('GET', 'https://example.com', true)
      xhr.responseType = 'arraybuffer'
      return xhr.responseType === 'arraybuffer'
    } catch (e) {
      Log.w('RangeLoader', e.message)
      return false
    }
  }

  constructor(seekHandler, config) {
    super('xhr-range-loader')

    this._seekHandler = seekHandler
    this._config = config
    this._dataSource = null
    this._range = { from: 0, to: -1 }
    this._needStash = false

    this._chunkSizeKBList = [128, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096, 5120, 6144, 7168, 8192]
    this._currentChunkSizeKB = 384
    this._currentSpeedNormalized = 0
    this._zeroSpeedChunkCount = 0

    this._xhr = null
    this._speedSampler = new SpeedSampler()

    this._requestAbort = false
    this._waitForTotalLength = false
    this._totalLengthReceived = false

    this._currentRequestURL = null
    this._currentRedirectedURL = null
    this._currentRequestRange = null
    this._totalLength = null // size of the entire file
    this._contentLength = null // Content-Length of entire request range
    this._receivedLength = 0 // total received bytes
    this._lastTimeLoaded = 0 // received bytes of current request sub-range
  }

  destroy() {
    if (this.isWorking()) {
      this.abort()
    }
    if (this._xhr) {
      this._xhr.onreadystatechange = null
      this._xhr.onprogress = null
      this._xhr.onload = null
      this._xhr.onerror = null
      this._xhr = null
    }
    super.destroy()
  }

  get currentSpeed() {
    return this._speedSampler.lastSecondKBps
  }

  open(dataSource: DataSource, range: SeekRange): void {
    const source = dataSource as RangeLoaderDataSource
    this._dataSource = source
    this._range = range
    this._status = LoaderStatus.kConnecting

    let useRefTotalLength = false
    if (source.filesize != undefined && source.filesize !== 0) {
      useRefTotalLength = true
      this._totalLength = source.filesize
    }

    if (!this._totalLengthReceived && !useRefTotalLength) {
      // We need total filesize
      this._waitForTotalLength = true
      this._internalOpen(source, { from: 0, to: -1 })
    } else {
      // We have filesize, start loading
      this._openSubRange()
    }
  }

  _openSubRange(): void {
    if (this._dataSource == null) {
      return
    }

    let chunkSize = this._currentChunkSizeKB * 1024

    let from = this._range.from + this._receivedLength
    let to = from + chunkSize

    if (this._contentLength != null) {
      if (to - this._range.from >= this._contentLength) {
        to = this._range.from + this._contentLength - 1
      }
    }

    this._currentRequestRange = { from, to }
    this._internalOpen(this._dataSource, this._currentRequestRange)
  }

  _internalOpen(dataSource: RangeLoaderDataSource, range: SeekRange): void {
    this._lastTimeLoaded = 0

    let sourceURL = dataSource.url
    if (this._config.reuseRedirectedURL) {
      if (this._currentRedirectedURL != undefined) {
        sourceURL = this._currentRedirectedURL
      } else if (dataSource.redirectedURL != undefined) {
        sourceURL = dataSource.redirectedURL
      }
    }

    let seekConfig = this._seekHandler.getConfig(sourceURL, range)
    this._currentRequestURL = seekConfig.url

    let xhr = (this._xhr = new XMLHttpRequest())
    xhr.open('GET', seekConfig.url, true)
    xhr.responseType = 'arraybuffer'
    xhr.onreadystatechange = this._onReadyStateChange.bind(this)
    xhr.onprogress = this._onProgress.bind(this)
    xhr.onload = this._onLoad.bind(this)
    xhr.onerror = this._onXhrError.bind(this)

    if (dataSource.withCredentials) {
      xhr.withCredentials = true
    }

    if (typeof seekConfig.headers === 'object') {
      let headers = seekConfig.headers

      for (let key in headers) {
        if (headers.hasOwnProperty(key)) {
          xhr.setRequestHeader(key, headers[key])
        }
      }
    }

    // add additional headers
    if (typeof this._config.headers === 'object') {
      let headers = this._config.headers

      for (let key in headers) {
        if (headers.hasOwnProperty(key)) {
          xhr.setRequestHeader(key, headers[key])
        }
      }
    }

    xhr.send()
  }

  abort(): void {
    this._requestAbort = true
    this._internalAbort()
    this._status = LoaderStatus.kComplete
  }

  _internalAbort(): void {
    if (this._xhr) {
      this._xhr.onreadystatechange = null
      this._xhr.onprogress = null
      this._xhr.onload = null
      this._xhr.onerror = null
      this._xhr.abort()
      this._xhr = null
    }
  }

  _onReadyStateChange(e: Event): void {
    let xhr = e.target as XMLHttpRequest | null
    if (xhr == null) {
      return
    }

    if (xhr.readyState === 2) {
      // HEADERS_RECEIVED
      if (xhr.responseURL != undefined) {
        // if the browser support this property
        let redirectedURL = this._seekHandler.removeURLParameters(xhr.responseURL)
        if (xhr.responseURL !== this._currentRequestURL && redirectedURL !== this._currentRedirectedURL) {
          this._currentRedirectedURL = redirectedURL
          if (this._onURLRedirect) {
            this._onURLRedirect(redirectedURL)
          }
        }
      }

      if (xhr.status >= 200 && xhr.status <= 299) {
        if (this._waitForTotalLength) {
          return
        }
        this._status = LoaderStatus.kBuffering
      } else {
        this._status = LoaderStatus.kError
        if (this._onError) {
          this._onError(LoaderErrors.HTTP_STATUS_CODE_INVALID, { code: xhr.status, msg: xhr.statusText })
        } else {
          throw new RuntimeException('RangeLoader: Http code invalid, ' + xhr.status + ' ' + xhr.statusText)
        }
      }
    }
  }

  _onProgress(e: ProgressEvent<XMLHttpRequest>): void {
    if (this._status === LoaderStatus.kError) {
      // Ignore error response
      return
    }

    if (this._contentLength === null) {
      let openNextRange = false

      if (this._waitForTotalLength) {
        this._waitForTotalLength = false
        this._totalLengthReceived = true
        openNextRange = true

        let total = e.total
        this._internalAbort()
        if (total !== 0) {
          this._totalLength = total
        }
      }

      // calculate currrent request range's contentLength
      if (this._range.to === -1) {
        this._contentLength = (this._totalLength as number) - this._range.from
      } else {
        // to !== -1
        this._contentLength = this._range.to - this._range.from + 1
      }

      if (openNextRange) {
        this._openSubRange()
        return
      }
      if (this._onContentLengthKnown) {
        this._onContentLengthKnown(this._contentLength)
      }
    }

    let delta = e.loaded - this._lastTimeLoaded
    this._lastTimeLoaded = e.loaded
    this._speedSampler.addBytes(delta)
  }

  _normalizeSpeed(input: number): number {
    let list = this._chunkSizeKBList
    let last = list.length - 1
    let mid = 0
    let lbound = 0
    let ubound = last

    if (input < list[0]) {
      return list[0]
    }

    while (lbound <= ubound) {
      mid = lbound + Math.floor((ubound - lbound) / 2)
      if (mid === last || (input >= list[mid] && input < list[mid + 1])) {
        return list[mid]
      } else if (list[mid] < input) {
        lbound = mid + 1
      } else {
        ubound = mid - 1
      }
    }

    return list[0]
  }

  _onLoad(e: ProgressEvent<XMLHttpRequest>): void {
    let xhr = e.target as XMLHttpRequest | null
    if (xhr == null) {
      return
    }

    if (this._status === LoaderStatus.kError) {
      // Ignore error response
      return
    }

    if (this._waitForTotalLength) {
      this._waitForTotalLength = false
      return
    }

    this._lastTimeLoaded = 0
    let KBps = this._speedSampler.lastSecondKBps
    if (KBps === 0) {
      this._zeroSpeedChunkCount++
      if (this._zeroSpeedChunkCount >= 3) {
        // Try get currentKBps after 3 chunks
        KBps = this._speedSampler.currentKBps
      }
    }

    if (KBps !== 0) {
      let normalized = this._normalizeSpeed(KBps)
      if (this._currentSpeedNormalized !== normalized) {
        this._currentSpeedNormalized = normalized
        this._currentChunkSizeKB = normalized
      }
    }

    let chunk = xhr.response as ArrayBuffer
    let byteStart = this._range.from + this._receivedLength
    this._receivedLength += chunk.byteLength

    let reportComplete = false

    if (this._contentLength != null && this._receivedLength < this._contentLength) {
      // continue load next chunk
      this._openSubRange()
    } else {
      reportComplete = true
    }

    // dispatch received chunk
    if (this._onDataArrival) {
      this._onDataArrival(chunk, byteStart, this._receivedLength)
    }

    if (reportComplete) {
      this._status = LoaderStatus.kComplete
      if (this._onComplete) {
        this._onComplete(this._range.from, this._range.from + this._receivedLength - 1)
      }
    }
  }

  _onXhrError(e: ProgressEvent<EventTarget>): void {
    this._status = LoaderStatus.kError
    let type: LoaderErrorType = LoaderErrors.EXCEPTION
    let info: LoaderErrorInfo

    if (this._contentLength && this._receivedLength > 0 && this._receivedLength < this._contentLength) {
      type = LoaderErrors.EARLY_EOF
      info = { code: -1, msg: 'RangeLoader meet Early-Eof' }
    } else {
      type = LoaderErrors.EXCEPTION
      info = { code: -1, msg: e.constructor.name + ' ' + e.type }
    }

    if (this._onError) {
      this._onError(type, info)
    } else {
      throw new RuntimeException(info.msg)
    }
  }
}

export default RangeLoader
