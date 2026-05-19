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

class Log {
  static GLOBAL_TAG = 'mpegts.js'
  static FORCE_GLOBAL_TAG = false
  static ENABLE_ERROR = true
  static ENABLE_INFO = true
  static ENABLE_WARN = true
  static ENABLE_DEBUG = true
  static ENABLE_VERBOSE = true
  static ENABLE_CALLBACK = false
  static emitter = new EventEmitter()

  static e(tag: string, msg: string): void {
    if (!tag || Log.FORCE_GLOBAL_TAG) {
      tag = Log.GLOBAL_TAG
    }

    const str = `[${tag}] > ${msg}`

    if (Log.ENABLE_CALLBACK) {
      Log.emitter.emit('log', 'error', str)
    }

    if (!Log.ENABLE_ERROR) {
      return
    }

    if (console.error) {
      console.error(str)
    } else if (console.warn) {
      console.warn(str)
    } else {
      console.log(str)
    }
  }

  static i(tag: string, msg: string): void {
    if (!tag || Log.FORCE_GLOBAL_TAG) {
      tag = Log.GLOBAL_TAG
    }

    const str = `[${tag}] > ${msg}`

    if (Log.ENABLE_CALLBACK) {
      Log.emitter.emit('log', 'info', str)
    }

    if (!Log.ENABLE_INFO) {
      return
    }

    if (console.info) {
      console.info(str)
    } else {
      console.log(str)
    }
  }

  static w(tag: string, msg: string): void {
    if (!tag || Log.FORCE_GLOBAL_TAG) {
      tag = Log.GLOBAL_TAG
    }

    const str = `[${tag}] > ${msg}`

    if (Log.ENABLE_CALLBACK) {
      Log.emitter.emit('log', 'warn', str)
    }

    if (!Log.ENABLE_WARN) {
      return
    }

    if (console.warn) {
      console.warn(str)
    } else {
      console.log(str)
    }
  }

  static d(tag: string, msg: string): void {
    if (!tag || Log.FORCE_GLOBAL_TAG) {
      tag = Log.GLOBAL_TAG
    }

    const str = `[${tag}] > ${msg}`

    if (Log.ENABLE_CALLBACK) {
      Log.emitter.emit('log', 'debug', str)
    }

    if (!Log.ENABLE_DEBUG) {
      return
    }

    if (console.debug) {
      console.debug(str)
    } else {
      console.log(str)
    }
  }

  static v(tag: string, msg: string): void {
    if (!tag || Log.FORCE_GLOBAL_TAG) {
      tag = Log.GLOBAL_TAG
    }

    const str = `[${tag}] > ${msg}`

    if (Log.ENABLE_CALLBACK) {
      Log.emitter.emit('log', 'verbose', str)
    }

    if (!Log.ENABLE_VERBOSE) {
      return
    }

    console.log(str)
  }
}

export default Log
