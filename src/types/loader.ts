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
import type { MediaDataSource, MediaSegment } from './media-data-source'

export interface Range {
  from: number
  to: number
}

export type SeekRange = Range

export interface SeekConfig {
  url: string
  headers: Headers | Record<string, string>
}

export interface SeekHandler {
  getConfig(sourceURL: string, range: Range): SeekConfig
  removeURLParameters(url: string): string
}

export interface BaseLoader {
  destroy(): void
  isWorking(): boolean
  readonly type: string
  readonly status: number
  readonly needStashBuffer: boolean
  onContentLengthKnown: ((contentLength: number) => void) | null
  onURLRedirect: ((redirectedURL: string) => void) | null
  onDataArrival: ((chunk: ArrayBuffer, byteStart: number, receivedLength?: number) => void) | null
  onError: ((errorType: LoaderErrorType, errorInfo: LoaderErrorMessage) => void) | null
  onComplete: ((rangeFrom: number, rangeTo: number) => void) | null
  open(dataSource: MediaDataSource | MediaSegment, range: Range): void
  abort(): void
}

export type LoaderStatus = typeof import('../io/loader').LoaderStatus
export type LoaderErrors = typeof import('../io/loader').LoaderErrors
export type LoaderStatusType = LoaderStatus[keyof LoaderStatus]
export type LoaderErrorType = LoaderErrors[keyof LoaderErrors]

export interface LoaderErrorMessage {
  code: number
  msg: string
}

export type LoaderErrorInfo = LoaderErrorMessage

export interface BaseLoaderConstructor {
  new (typeName: string): BaseLoader
}

export interface CustomSeekHandlerConstructor {
  new (): SeekHandler
}

export interface CustomLoaderConstructor {
  new (seekHandler: SeekHandler, config: Config): BaseLoader
}
