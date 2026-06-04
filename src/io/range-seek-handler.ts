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

import type { SeekConfig, SeekHandler, SeekRange } from './loader'

class RangeSeekHandler implements SeekHandler {
  private _zeroStart: boolean

  constructor(zeroStart?: boolean) {
    this._zeroStart = zeroStart || false
  }

  getConfig(url: string, range: SeekRange): SeekConfig {
    let headers: Record<string, string> = {}

    if (range.from !== 0 || range.to !== -1) {
      let param: string
      if (range.to !== -1) {
        param = `bytes=${range.from.toString()}-${range.to.toString()}`
      } else {
        param = `bytes=${range.from.toString()}-`
      }
      headers['Range'] = param
    } else if (this._zeroStart) {
      headers['Range'] = 'bytes=0-'
    }

    return {
      url: url,
      headers: headers,
    }
  }

  removeURLParameters(seekedURL: string): string {
    return seekedURL
  }
}

export default RangeSeekHandler
