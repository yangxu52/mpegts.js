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

import type { Config } from '../config'
import Browser from '../utils/browser.js'
import { RuntimeException } from '../utils/exception.js'
import { BaseLoader, LoaderErrors, LoaderStatus } from './loader'
import type { DataSource, LoaderErrorInfo, LoaderErrorType, SeekHandler, SeekRange } from './loader'

type FetchStreamLoaderDataSource = DataSource & {
  url: string
  redirectedURL?: string
  cors?: boolean
  withCredentials?: boolean
  referrerPolicy?: ReferrerPolicy
}

/* fetch + stream IO loader. Currently working on chrome 43+.
 * fetch provides a better alternative http API to XMLHttpRequest
 *
 * fetch spec   https://fetch.spec.whatwg.org/
 * stream spec  https://streams.spec.whatwg.org/
 */
class FetchStreamLoader extends BaseLoader {
  private readonly TAG: string = 'FetchStreamLoader'
  private _seekHandler: SeekHandler
  private _config: Config
  private _dataSource: FetchStreamLoaderDataSource | null
  private _range: SeekRange
  private _requestAbort: boolean
  private _abortController: AbortController | null
  private _contentLength: number | null
  private _receivedLength: number

  static isSupported() {
    try {
      return !!(self.fetch && self.ReadableStream)
    } catch (e) {
      return false
    }
  }

  constructor(seekHandler, config) {
    super('fetch-stream-loader')

    this._seekHandler = seekHandler
    this._config = config
    this._dataSource = null
    this._range = { from: 0, to: -1 }
    this._needStash = true

    this._requestAbort = false
    this._abortController = null
    this._contentLength = null
    this._receivedLength = 0
  }

  destroy() {
    if (this.isWorking()) {
      this.abort()
    }
    super.destroy()
  }

  open(dataSource: DataSource, range: SeekRange): void {
    const source = dataSource as FetchStreamLoaderDataSource
    this._dataSource = source
    this._range = range

    let sourceURL = source.url
    if (this._config.reuseRedirectedURL && source.redirectedURL != undefined) {
      sourceURL = source.redirectedURL
    }

    let seekConfig = this._seekHandler.getConfig(sourceURL, range)

    let headers = new self.Headers()

    if (typeof seekConfig.headers === 'object') {
      let configHeaders = seekConfig.headers
      for (let key in configHeaders) {
        if (configHeaders.hasOwnProperty(key)) {
          headers.append(key, configHeaders[key])
        }
      }
    }

    let params: RequestInit = {
      method: 'GET',
      headers: headers,
      mode: 'cors',
      cache: 'default',
      // The default policy of Fetch API in the whatwg standard
      // Safari incorrectly indicates 'no-referrer' as default policy, fuck it
      referrerPolicy: 'no-referrer-when-downgrade',
    }

    // add additional headers
    if (typeof this._config.headers === 'object') {
      for (let key in this._config.headers) {
        headers.append(key, this._config.headers[key])
      }
    }

    // cors is enabled by default
    if (source.cors === false) {
      // no-cors means 'disregard cors policy', which can only be used in ServiceWorker
      params.mode = 'same-origin'
    }

    // withCredentials is disabled by default
    if (source.withCredentials) {
      params.credentials = 'include'
    }

    // referrerPolicy from config
    if (source.referrerPolicy) {
      params.referrerPolicy = source.referrerPolicy
    }

    if (self.AbortController) {
      this._abortController = new self.AbortController()
      params.signal = this._abortController.signal
    }

    this._status = LoaderStatus.kConnecting
    self
      .fetch(seekConfig.url, params)
      .then((res) => {
        if (this._requestAbort) {
          this._status = LoaderStatus.kIdle
          res.body?.cancel()
          return
        }
        if (res.ok && res.status >= 200 && res.status <= 299) {
          if (res.url !== seekConfig.url) {
            if (this._onURLRedirect) {
              let redirectedURL = this._seekHandler.removeURLParameters(res.url)
              this._onURLRedirect(redirectedURL)
            }
          }

          let lengthHeader = res.headers.get('Content-Length')
          if (lengthHeader != null) {
            this._contentLength = parseInt(lengthHeader)
            if (this._contentLength !== 0) {
              if (this._onContentLengthKnown) {
                this._onContentLengthKnown(this._contentLength)
              }
            }
          }

          if (res.body == null) {
            throw new RuntimeException('FetchStreamLoader: response body is null')
          }

          return this._pump(res.body.getReader())
        } else {
          this._status = LoaderStatus.kError
          if (this._onError) {
            this._onError(LoaderErrors.HTTP_STATUS_CODE_INVALID, { code: res.status, msg: res.statusText })
          } else {
            throw new RuntimeException('FetchStreamLoader: Http code invalid, ' + res.status + ' ' + res.statusText)
          }
        }
      })
      .catch((e) => {
        const error = e as { code?: number; message?: string }
        if (this._abortController && this._abortController.signal.aborted) {
          return
        }

        this._status = LoaderStatus.kError
        if (this._onError) {
          this._onError(LoaderErrors.EXCEPTION, { code: error.code ?? -1, msg: error.message ?? 'Fetch request exception' })
        } else {
          throw e
        }
      })
  }

  abort(): void {
    this._requestAbort = true

    if (this._status !== LoaderStatus.kBuffering || !Browser.chrome) {
      // Chrome may throw Exception-like things here, avoid using if is buffering
      if (this._abortController) {
        try {
          this._abortController.abort()
        } catch (e) {
          // Ignore abort exceptions while tearing down an in-flight request.
        }
      }
    }
  }

  _pump(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void | undefined> {
    // ReadableStreamReader
    return reader
      .read()
      .then((result) => {
        if (result.done) {
          // First check received length
          if (this._contentLength !== null && this._receivedLength < this._contentLength) {
            // Report Early-EOF
            this._status = LoaderStatus.kError
            let type = LoaderErrors.EARLY_EOF
            let info = { code: -1, msg: 'Fetch stream meet Early-EOF' }
            if (this._onError) {
              this._onError(type, info)
            } else {
              throw new RuntimeException(info.msg)
            }
          } else {
            // OK. Download complete
            this._status = LoaderStatus.kComplete
            if (this._onComplete) {
              this._onComplete(this._range.from, this._range.from + this._receivedLength - 1)
            }
          }
        } else {
          if (this._abortController && this._abortController.signal.aborted) {
            this._status = LoaderStatus.kComplete
            return
          } else if (this._requestAbort === true) {
            this._status = LoaderStatus.kComplete
            return reader.cancel()
          }

          this._status = LoaderStatus.kBuffering

          let chunk = result.value.buffer as ArrayBuffer
          let byteStart = this._range.from + this._receivedLength
          this._receivedLength += chunk.byteLength

          if (this._onDataArrival) {
            this._onDataArrival(chunk, byteStart, this._receivedLength)
          }

          return this._pump(reader)
        }
      })
      .catch((e) => {
        const error = e as { code?: number; message?: string }
        if (this._abortController && this._abortController.signal.aborted) {
          this._status = LoaderStatus.kComplete
          return
        }

        this._status = LoaderStatus.kError
        let type: LoaderErrorType = LoaderErrors.EXCEPTION
        let info: LoaderErrorInfo

        if (
          (error.code === 19 || error.message === 'network error') && // NETWORK_ERR
          (this._contentLength === null || (this._contentLength !== null && this._receivedLength < this._contentLength))
        ) {
          type = LoaderErrors.EARLY_EOF
          info = { code: error.code ?? -1, msg: 'Fetch stream meet Early-EOF' }
        } else {
          type = LoaderErrors.EXCEPTION
          info = { code: error.code ?? -1, msg: error.message ?? 'Fetch stream exception' }
        }

        if (this._onError) {
          this._onError(type, info)
        } else {
          throw new RuntimeException(info.msg)
        }
      })
  }
}

export default FetchStreamLoader
