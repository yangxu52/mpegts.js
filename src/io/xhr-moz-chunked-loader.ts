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
import { RuntimeException } from '../utils/exception.js'
import { BaseLoader, LoaderErrors, LoaderStatus } from './loader'
import type { DataSource, LoaderErrorInfo, LoaderErrorType, SeekHandler, SeekRange } from './loader'

type MozChunkedXMLHttpRequest = Omit<XMLHttpRequest, 'responseType' | 'response'> & {
  responseType: string
  response: ArrayBuffer
}

type MozChunkedLoaderDataSource = DataSource & {
  url: string
  redirectedURL?: string
  withCredentials?: boolean
}

// For FireFox browser which supports `xhr.responseType = 'moz-chunked-arraybuffer'`
class MozChunkedLoader extends BaseLoader {
  private readonly TAG: string = 'MozChunkedLoader'
  private _seekHandler: SeekHandler
  private _config: Config
  private _dataSource: MozChunkedLoaderDataSource | null
  private _range: SeekRange
  private _requestURL: string | null
  private _xhr: MozChunkedXMLHttpRequest | null
  private _requestAbort: boolean
  private _contentLength: number | null
  private _receivedLength: number

  static isSupported() {
    try {
      let xhr = new XMLHttpRequest() as MozChunkedXMLHttpRequest
      // Firefox 37- requires .open() to be called before setting responseType
      xhr.open('GET', 'https://example.com', true)
      xhr.responseType = 'moz-chunked-arraybuffer'
      return xhr.responseType === 'moz-chunked-arraybuffer'
    } catch (e) {
      Log.w('MozChunkedLoader', e.message)
      return false
    }
  }

  constructor(seekHandler, config) {
    super('xhr-moz-chunked-loader')

    this._seekHandler = seekHandler
    this._config = config
    this._dataSource = null
    this._range = { from: 0, to: -1 }
    this._requestURL = null
    this._needStash = true

    this._xhr = null
    this._requestAbort = false
    this._contentLength = null
    this._receivedLength = 0
  }

  destroy() {
    if (this.isWorking()) {
      this.abort()
    }
    if (this._xhr) {
      this._xhr.onreadystatechange = null
      this._xhr.onprogress = null
      this._xhr.onloadend = null
      this._xhr.onerror = null
      this._xhr = null
    }
    super.destroy()
  }

  open(dataSource: DataSource, range: SeekRange): void {
    const source = dataSource as MozChunkedLoaderDataSource
    this._dataSource = source
    this._range = range

    let sourceURL = source.url
    if (this._config.reuseRedirectedURL && source.redirectedURL != undefined) {
      sourceURL = source.redirectedURL
    }

    let seekConfig = this._seekHandler.getConfig(sourceURL, range)
    this._requestURL = seekConfig.url

    let xhr = (this._xhr = new XMLHttpRequest() as MozChunkedXMLHttpRequest)
    xhr.open('GET', seekConfig.url, true)
    xhr.responseType = 'moz-chunked-arraybuffer'
    xhr.onreadystatechange = this._onReadyStateChange.bind(this)
    xhr.onprogress = this._onProgress.bind(this)
    xhr.onloadend = this._onLoadEnd.bind(this)
    xhr.onerror = this._onXhrError.bind(this)

    // cors is auto detected and enabled by xhr

    // withCredentials is disabled by default
    if (source.withCredentials) {
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

    this._status = LoaderStatus.kConnecting
    xhr.send()
  }

  abort(): void {
    this._requestAbort = true
    if (this._xhr) {
      this._xhr.abort()
    }
    this._status = LoaderStatus.kComplete
  }

  _onReadyStateChange(e: Event): void {
    let xhr = e.target as MozChunkedXMLHttpRequest | null
    if (xhr == null) {
      return
    }

    if (xhr.readyState === 2) {
      // HEADERS_RECEIVED
      if (xhr.responseURL != undefined && xhr.responseURL !== this._requestURL) {
        if (this._onURLRedirect) {
          let redirectedURL = this._seekHandler.removeURLParameters(xhr.responseURL)
          this._onURLRedirect(redirectedURL)
        }
      }

      if (xhr.status !== 0 && (xhr.status < 200 || xhr.status > 299)) {
        this._status = LoaderStatus.kError
        if (this._onError) {
          this._onError(LoaderErrors.HTTP_STATUS_CODE_INVALID, { code: xhr.status, msg: xhr.statusText })
        } else {
          throw new RuntimeException('MozChunkedLoader: Http code invalid, ' + xhr.status + ' ' + xhr.statusText)
        }
      } else {
        this._status = LoaderStatus.kBuffering
      }
    }
  }

  _onProgress(e: ProgressEvent<MozChunkedXMLHttpRequest>): void {
    let xhr = e.target as MozChunkedXMLHttpRequest | null
    if (xhr == null) {
      return
    }

    if (this._status === LoaderStatus.kError) {
      // Ignore error response
      return
    }

    if (this._contentLength === null) {
      if (e.total !== null && e.total !== 0) {
        this._contentLength = e.total
        if (this._onContentLengthKnown) {
          this._onContentLengthKnown(this._contentLength)
        }
      }
    }

    let chunk = xhr.response
    let byteStart = this._range.from + this._receivedLength
    this._receivedLength += chunk.byteLength

    if (this._onDataArrival) {
      this._onDataArrival(chunk, byteStart, this._receivedLength)
    }
  }

  _onLoadEnd(_e: ProgressEvent<MozChunkedXMLHttpRequest>): void {
    if (this._requestAbort === true) {
      this._requestAbort = false
      return
    } else if (this._status === LoaderStatus.kError) {
      return
    }

    this._status = LoaderStatus.kComplete
    if (this._onComplete) {
      this._onComplete(this._range.from, this._range.from + this._receivedLength - 1)
    }
  }

  _onXhrError(e: ProgressEvent<EventTarget>): void {
    this._status = LoaderStatus.kError
    let type: LoaderErrorType = LoaderErrors.EXCEPTION
    let info: LoaderErrorInfo

    if (this._contentLength && e.loaded < this._contentLength) {
      type = LoaderErrors.EARLY_EOF
      info = { code: -1, msg: 'Moz-Chunked stream meet Early-Eof' }
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

export default MozChunkedLoader
