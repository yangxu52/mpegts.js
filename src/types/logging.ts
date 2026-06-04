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

export interface LoggingControl extends LoggingControlConfig {
  getConfig(): LoggingControlConfig
  applyConfig(config: Partial<LoggingControlConfig>): void
  addLogListener(listener: (...args: any[]) => void): void
  removeLogListener(listener: (...args: any[]) => void): void
}
