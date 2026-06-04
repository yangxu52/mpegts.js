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

import { NotImplementedException } from '../utils/exception.js'

type LoaderStatusMap = {
  kIdle: 0
  kConnecting: 1
  kBuffering: 2
  kError: 3
  kComplete: 4
}

type LoaderErrorMap = {
  OK: 'OK'
  EXCEPTION: 'Exception'
  HTTP_STATUS_CODE_INVALID: 'HttpStatusCodeInvalid'
  CONNECTING_TIMEOUT: 'ConnectingTimeout'
  EARLY_EOF: 'EarlyEof'
  UNRECOVERABLE_EARLY_EOF: 'UnrecoverableEarlyEof'
}

export type LoaderErrorType = LoaderErrorMap[keyof LoaderErrorMap]
export type LoaderStatusType = LoaderStatusMap[keyof LoaderStatusMap]
export type LoaderErrorInfo = {
  code: number
  msg: string
}
export type SeekRange = {
  from: number
  to: number
}
export type DataSource = Record<string, any>
export type SeekConfig = {
  url: string
  headers: Record<string, string>
}

export interface SeekHandler {
  getConfig(sourceURL: string, range: SeekRange): SeekConfig
  removeURLParameters(url: string): string
}

type OnContentLengthKnownCallback = ((contentLength: number) => void) | null
type OnURLRedirectCallback = ((url: string) => void) | null
type OnDataArrivalCallback = ((chunk: ArrayBuffer, byteStart: number, receivedLength?: number) => void) | null
type OnErrorCallback = ((errorType: LoaderErrorType, errorInfo: LoaderErrorInfo) => void) | null
type OnCompleteCallback = ((rangeFrom: number, rangeTo: number) => void) | null

export const LoaderStatus: LoaderStatusMap = {
  kIdle: 0,
  kConnecting: 1,
  kBuffering: 2,
  kError: 3,
  kComplete: 4,
}

export const LoaderErrors: LoaderErrorMap = {
  OK: 'OK',
  EXCEPTION: 'Exception',
  HTTP_STATUS_CODE_INVALID: 'HttpStatusCodeInvalid',
  CONNECTING_TIMEOUT: 'ConnectingTimeout',
  EARLY_EOF: 'EarlyEof',
  UNRECOVERABLE_EARLY_EOF: 'UnrecoverableEarlyEof',
}

/* Loader has callbacks which have following prototypes:
 *     function onContentLengthKnown(contentLength: number): void
 *     function onURLRedirect(url: string): void
 *     function onDataArrival(chunk: ArrayBuffer, byteStart: number, receivedLength: number): void
 *     function onError(errorType: number, errorInfo: {code: number, msg: string}): void
 *     function onComplete(rangeFrom: number, rangeTo: number): void
 */
export class BaseLoader {
  protected _type: string
  protected _status: LoaderStatusType
  protected _needStash: boolean
  protected _onContentLengthKnown: OnContentLengthKnownCallback
  protected _onURLRedirect: OnURLRedirectCallback
  protected _onDataArrival: OnDataArrivalCallback
  protected _onError: OnErrorCallback
  protected _onComplete: OnCompleteCallback

  constructor(typeName?: string) {
    this._type = typeName || 'undefined'
    this._status = LoaderStatus.kIdle
    this._needStash = false
    // callbacks
    this._onContentLengthKnown = null
    this._onURLRedirect = null
    this._onDataArrival = null
    this._onError = null
    this._onComplete = null
  }

  destroy(): void {
    this._status = LoaderStatus.kIdle
    this._onContentLengthKnown = null
    this._onURLRedirect = null
    this._onDataArrival = null
    this._onError = null
    this._onComplete = null
  }

  isWorking(): boolean {
    return this._status === LoaderStatus.kConnecting || this._status === LoaderStatus.kBuffering
  }

  get type(): string {
    return this._type
  }

  get status(): LoaderStatusType {
    return this._status
  }

  get needStashBuffer(): boolean {
    return this._needStash
  }

  get onContentLengthKnown(): OnContentLengthKnownCallback {
    return this._onContentLengthKnown
  }

  set onContentLengthKnown(callback: OnContentLengthKnownCallback) {
    this._onContentLengthKnown = callback
  }

  get onURLRedirect(): OnURLRedirectCallback {
    return this._onURLRedirect
  }

  set onURLRedirect(callback: OnURLRedirectCallback) {
    this._onURLRedirect = callback
  }

  get onDataArrival(): OnDataArrivalCallback {
    return this._onDataArrival
  }

  set onDataArrival(callback: OnDataArrivalCallback) {
    this._onDataArrival = callback
  }

  get onError(): OnErrorCallback {
    return this._onError
  }

  set onError(callback: OnErrorCallback) {
    this._onError = callback
  }

  get onComplete(): OnCompleteCallback {
    return this._onComplete
  }

  set onComplete(callback: OnCompleteCallback) {
    this._onComplete = callback
  }

  // pure virtual
  open(dataSource: DataSource, range: SeekRange): void {
    throw new NotImplementedException('Unimplemented abstract function!')
  }

  abort(): void {
    throw new NotImplementedException('Unimplemented abstract function!')
  }
}
