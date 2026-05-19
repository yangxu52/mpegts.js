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
import Log from './logger.js'

export interface LoggingControlConfig {
  forceGlobalTag: boolean
  globalTag: string
  enableAll: boolean
  enableDebug: boolean
  enableVerbose: boolean
  enableInfo: boolean
  enableWarn: boolean
  enableError: boolean
  enableCallback: boolean
}

class LoggingControl {
  static emitter = new EventEmitter()

  static get forceGlobalTag(): boolean {
    return Log.FORCE_GLOBAL_TAG
  }

  static set forceGlobalTag(enable: boolean) {
    Log.FORCE_GLOBAL_TAG = enable
    LoggingControl._notifyChange()
  }

  static get globalTag(): string {
    return Log.GLOBAL_TAG
  }

  static set globalTag(tag: string) {
    Log.GLOBAL_TAG = tag
    LoggingControl._notifyChange()
  }

  static get enableAll(): boolean {
    return Log.ENABLE_VERBOSE && Log.ENABLE_DEBUG && Log.ENABLE_INFO && Log.ENABLE_WARN && Log.ENABLE_ERROR
  }

  static set enableAll(enable: boolean) {
    Log.ENABLE_VERBOSE = enable
    Log.ENABLE_DEBUG = enable
    Log.ENABLE_INFO = enable
    Log.ENABLE_WARN = enable
    Log.ENABLE_ERROR = enable
    LoggingControl._notifyChange()
  }

  static get enableDebug(): boolean {
    return Log.ENABLE_DEBUG
  }

  static set enableDebug(enable: boolean) {
    Log.ENABLE_DEBUG = enable
    LoggingControl._notifyChange()
  }

  static get enableVerbose(): boolean {
    return Log.ENABLE_VERBOSE
  }

  static set enableVerbose(enable: boolean) {
    Log.ENABLE_VERBOSE = enable
    LoggingControl._notifyChange()
  }

  static get enableInfo(): boolean {
    return Log.ENABLE_INFO
  }

  static set enableInfo(enable: boolean) {
    Log.ENABLE_INFO = enable
    LoggingControl._notifyChange()
  }

  static get enableWarn(): boolean {
    return Log.ENABLE_WARN
  }

  static set enableWarn(enable: boolean) {
    Log.ENABLE_WARN = enable
    LoggingControl._notifyChange()
  }

  static get enableError(): boolean {
    return Log.ENABLE_ERROR
  }

  static set enableError(enable: boolean) {
    Log.ENABLE_ERROR = enable
    LoggingControl._notifyChange()
  }

  static getConfig(): LoggingControlConfig {
    return {
      globalTag: Log.GLOBAL_TAG,
      forceGlobalTag: Log.FORCE_GLOBAL_TAG,
      enableVerbose: Log.ENABLE_VERBOSE,
      enableDebug: Log.ENABLE_DEBUG,
      enableInfo: Log.ENABLE_INFO,
      enableWarn: Log.ENABLE_WARN,
      enableError: Log.ENABLE_ERROR,
      enableAll: LoggingControl.enableAll,
      enableCallback: Log.ENABLE_CALLBACK,
    }
  }

  static applyConfig(config: LoggingControlConfig): void {
    Log.GLOBAL_TAG = config.globalTag
    Log.FORCE_GLOBAL_TAG = config.forceGlobalTag
    Log.ENABLE_VERBOSE = config.enableVerbose
    Log.ENABLE_DEBUG = config.enableDebug
    Log.ENABLE_INFO = config.enableInfo
    Log.ENABLE_WARN = config.enableWarn
    Log.ENABLE_ERROR = config.enableError
    Log.ENABLE_CALLBACK = config.enableCallback
  }

  static _notifyChange(): void {
    const emitter = LoggingControl.emitter

    if (emitter.listenerCount('change') > 0) {
      const config = LoggingControl.getConfig()
      emitter.emit('change', config)
    }
  }

  static registerListener(listener: (...args: any[]) => void): void {
    LoggingControl.emitter.addListener('change', listener)
  }

  static removeListener(listener: (...args: any[]) => void): void {
    LoggingControl.emitter.removeListener('change', listener)
  }

  static addLogListener(listener: (...args: any[]) => void): void {
    Log.emitter.addListener('log', listener)
    if (Log.emitter.listenerCount('log') > 0) {
      Log.ENABLE_CALLBACK = true
      LoggingControl._notifyChange()
    }
  }

  static removeLogListener(listener: (...args: any[]) => void): void {
    Log.emitter.removeListener('log', listener)
    if (Log.emitter.listenerCount('log') === 0) {
      Log.ENABLE_CALLBACK = false
      LoggingControl._notifyChange()
    }
  }
}

export default LoggingControl
