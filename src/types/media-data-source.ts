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

export interface MediaSegment {
  duration: number
  filesize?: number
  url: string
  cors?: boolean
  withCredentials?: boolean
  redirectedURL?: string
  timestampBase?: number
  referrerPolicy?: ReferrerPolicy
}

export type MediaDataSourceSegment = MediaSegment

export interface MediaDataSource {
  type: string
  isLive?: boolean
  cors?: boolean
  withCredentials?: boolean
  hasAudio?: boolean
  hasVideo?: boolean
  duration?: number
  filesize?: number
  url?: string
  segments?: MediaSegment[]
}
