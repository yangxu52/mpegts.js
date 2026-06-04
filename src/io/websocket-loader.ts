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

import { RuntimeException } from '../utils/exception.js'
import { BaseLoader, LoaderErrors, LoaderStatus } from './loader'
import type { DataSource, SeekRange } from './loader'

type WebSocketLoaderDataSource = DataSource & {
  url: string
}

// For MPEG-TS/FLV over WebSocket live stream
class WebSocketLoader extends BaseLoader {
  private readonly TAG: string = 'WebSocketLoader'
  private _ws: WebSocket | null
  private _requestAbort: boolean
  private _receivedLength: number

  static isSupported() {
    try {
      return typeof self.WebSocket !== 'undefined'
    } catch (e) {
      return false
    }
  }

  constructor() {
    super('websocket-loader')

    this._needStash = true

    this._ws = null
    this._requestAbort = false
    this._receivedLength = 0
  }

  destroy() {
    if (this._ws) {
      this.abort()
    }
    super.destroy()
  }

  open(dataSource: DataSource, _range: SeekRange): void {
    const source = dataSource as WebSocketLoaderDataSource

    try {
      let ws = (this._ws = new self.WebSocket(source.url))
      ws.binaryType = 'arraybuffer'
      ws.onopen = this._onWebSocketOpen.bind(this)
      ws.onclose = this._onWebSocketClose.bind(this)
      ws.onmessage = this._onWebSocketMessage.bind(this)
      ws.onerror = this._onWebSocketError.bind(this)

      this._status = LoaderStatus.kConnecting
    } catch (e) {
      const error = e as { code?: number; message?: string }
      this._status = LoaderStatus.kError

      let info = { code: error.code ?? -1, msg: error.message ?? 'WebSocket open failed' }

      if (this._onError) {
        this._onError(LoaderErrors.EXCEPTION, info)
      } else {
        throw new RuntimeException(info.msg)
      }
    }
  }

  abort(): void {
    let ws = this._ws
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) {
      // CONNECTING || OPEN
      this._requestAbort = true
      ws.close()
    }

    this._ws = null
    this._status = LoaderStatus.kComplete
  }

  _onWebSocketOpen(_e: Event): void {
    this._status = LoaderStatus.kBuffering
  }

  _onWebSocketClose(_e: CloseEvent): void {
    if (this._requestAbort === true) {
      this._requestAbort = false
      return
    }

    this._status = LoaderStatus.kComplete

    if (this._onComplete) {
      this._onComplete(0, this._receivedLength - 1)
    }
  }

  _onWebSocketMessage(e: MessageEvent): void {
    if (e.data instanceof ArrayBuffer) {
      this._dispatchArrayBuffer(e.data)
    } else if (e.data instanceof Blob) {
      let reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          this._dispatchArrayBuffer(reader.result)
          return
        }

        this._status = LoaderStatus.kError
        let info = { code: -1, msg: 'Unsupported WebSocket message type: Blob decode failed' }

        if (this._onError) {
          this._onError(LoaderErrors.EXCEPTION, info)
        } else {
          throw new RuntimeException(info.msg)
        }
      }
      reader.readAsArrayBuffer(e.data)
    } else {
      this._status = LoaderStatus.kError
      let info = { code: -1, msg: 'Unsupported WebSocket message type: ' + e.data.constructor?.name }

      if (this._onError) {
        this._onError(LoaderErrors.EXCEPTION, info)
      } else {
        throw new RuntimeException(info.msg)
      }
    }
  }

  _dispatchArrayBuffer(arraybuffer: ArrayBuffer): void {
    let chunk = arraybuffer
    let byteStart = this._receivedLength
    this._receivedLength += chunk.byteLength

    if (this._onDataArrival) {
      this._onDataArrival(chunk, byteStart, this._receivedLength)
    }
  }

  _onWebSocketError(e: Event): void {
    this._status = LoaderStatus.kError

    const event = e as Event & { code?: number; message?: string }
    let info = {
      code: event.code ?? -1,
      msg: event.message ?? event.type,
    }

    if (this._onError) {
      this._onError(LoaderErrors.EXCEPTION, info)
    } else {
      throw new RuntimeException(info.msg)
    }
  }
}

export default WebSocketLoader
