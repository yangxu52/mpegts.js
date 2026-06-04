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
import type { Config } from '../config'
import type { KLVData } from '../demux/klv'
import type { PESPrivateData, PESPrivateDataDescriptor } from '../demux/pes-private-data'
import type { PGSData } from '../demux/pgs-data'
import type { SCTE35Data } from '../demux/scte35'
import type { SEIData } from '../demux/sei'
import type { SMPTE2038Data } from '../demux/smpte2038'
import FLVDemuxer from '../demux/flv-demuxer.js'
import DemuxErrors from '../demux/demux-errors.js'
import TSDemuxer from '../demux/ts-demuxer'
import type { DataSource, LoaderErrorInfo, LoaderErrorType } from '../io/loader'
import IOController from '../io/io-controller'
import MP4Remuxer from '../remux/mp4-remuxer'
import type { InitSegment, MediaSegment, SegmentType } from '../remux/mp4-remuxer'
import Browser from '../utils/browser.js'
import Log from '../utils/logger.js'
import MediaInfo from './media-info.js'
import TransmuxingEvents from './transmuxing-events'

type Listener = (...args: any[]) => void

type MediaDataSourceSegment = DataSource & {
  duration?: number
  filesize?: number
  url?: string
  cors?: boolean
  withCredentials?: boolean
  redirectedURL?: string
  timestampBase?: number
  referrerPolicy?: ReferrerPolicy
}

type MediaDataSource = DataSource & {
  cors?: boolean
  withCredentials?: boolean
  hasAudio?: boolean
  hasVideo?: boolean
  duration?: number
  filesize?: number
  url?: string
  segments?: MediaDataSourceSegment[]
}

type StatisticsInfo = {
  url?: string
  hasRedirect: boolean
  redirectedURL?: string
  speed: number
  loaderType: string
  currentSegmentIndex: number
  totalSegmentCount: number
}

type TimestampedMetadata = {
  pts?: number
  dts?: number
  nearest_pts?: number
}

// Transmuxing (IO, Demuxing, Remuxing) controller, with multipart support
class TransmuxingController {
  private readonly TAG: string = 'TransmuxingController'
  private _emitter: EventEmitter | null
  private _config: Config
  private _mediaDataSource: MediaDataSource | null
  private _currentSegmentIndex: number
  private _mediaInfo: any
  private _demuxer: any
  private _remuxer: MP4Remuxer | null
  private _ioctl: IOController | null
  private _pendingSeekTime: number | null
  private _pendingResolveSeekPoint: number | null
  private _statisticsReporter: number | null

  constructor(mediaDataSource: MediaDataSource, config: Config) {
    this._emitter = new EventEmitter()

    this._config = config

    // treat single part media as multipart media, which has only one segment
    if (!mediaDataSource.segments) {
      mediaDataSource.segments = [
        {
          duration: mediaDataSource.duration,
          filesize: mediaDataSource.filesize,
          url: mediaDataSource.url,
        },
      ]
    }

    // fill in default IO params if not exists
    if (typeof mediaDataSource.cors !== 'boolean') {
      mediaDataSource.cors = true
    }
    if (typeof mediaDataSource.withCredentials !== 'boolean') {
      mediaDataSource.withCredentials = false
    }

    this._mediaDataSource = mediaDataSource
    this._currentSegmentIndex = 0
    let totalDuration = 0

    this._mediaDataSource.segments!.forEach((segment) => {
      // timestampBase for each segment, and calculate total duration
      segment.timestampBase = totalDuration
      totalDuration += segment.duration as number
      // params needed by IOController
      segment.cors = mediaDataSource.cors
      segment.withCredentials = mediaDataSource.withCredentials
      // referrer policy control, if exist
      if (config.referrerPolicy) {
        segment.referrerPolicy = config.referrerPolicy
      }
    })

    if (!isNaN(totalDuration) && this._mediaDataSource.duration !== totalDuration) {
      this._mediaDataSource.duration = totalDuration
    }

    this._mediaInfo = null
    this._demuxer = null
    this._remuxer = null
    this._ioctl = null

    this._pendingSeekTime = null
    this._pendingResolveSeekPoint = null

    this._statisticsReporter = null
  }

  destroy(): void {
    this._mediaInfo = null
    this._mediaDataSource = null

    if (this._statisticsReporter != null) {
      this._disableStatisticsReporter()
    }
    if (this._ioctl) {
      this._ioctl.destroy()
      this._ioctl = null
    }
    if (this._demuxer) {
      this._demuxer.destroy()
      this._demuxer = null
    }
    if (this._remuxer) {
      this._remuxer.destroy()
      this._remuxer = null
    }

    this._emitter!.removeAllListeners()
    this._emitter = null
  }

  on(event: string, listener: Listener): void {
    this._emitter!.addListener(event, listener)
  }

  off(event: string, listener: Listener): void {
    this._emitter!.removeListener(event, listener)
  }

  start(): void {
    this._loadSegment(0)
    this._enableStatisticsReporter()
  }

  _loadSegment(segmentIndex: number, optionalFrom?: number): void {
    this._currentSegmentIndex = segmentIndex
    let dataSource = this._mediaDataSource!.segments![segmentIndex]!

    let ioctl = (this._ioctl = new IOController(dataSource, this._config, segmentIndex))
    ioctl.onError = this._onIOException.bind(this)
    ioctl.onSeeked = this._onIOSeeked.bind(this)
    ioctl.onComplete = this._onIOComplete.bind(this)
    ioctl.onRedirect = this._onIORedirect.bind(this)
    ioctl.onRecoveredEarlyEof = this._onIORecoveredEarlyEof.bind(this)

    if (optionalFrom) {
      this._demuxer.bindDataSource(this._ioctl)
    } else {
      ioctl.onDataArrival = this._onInitChunkArrival.bind(this)
    }

    ioctl.open(optionalFrom)
  }

  stop(): void {
    this._internalAbort()
    this._disableStatisticsReporter()
  }

  _internalAbort(): void {
    if (this._ioctl) {
      this._ioctl.destroy()
      this._ioctl = null
    }
  }

  pause(): void {
    // take a rest
    if (this._ioctl && this._ioctl.isWorking()) {
      this._ioctl.pause()
      this._disableStatisticsReporter()
    }
  }

  resume(): void {
    if (this._ioctl && this._ioctl.isPaused()) {
      this._ioctl.resume()
      this._enableStatisticsReporter()
    }
  }

  seek(milliseconds: number): void {
    if (this._mediaInfo == null || !this._mediaInfo.isSeekable()) {
      return
    }

    let targetSegmentIndex = this._searchSegmentIndexContains(milliseconds)

    if (targetSegmentIndex === this._currentSegmentIndex) {
      // intra-segment seeking
      let segmentInfo = this._mediaInfo.segments[targetSegmentIndex] as MediaInfo | undefined

      if (segmentInfo == undefined) {
        // current segment loading started, but mediainfo hasn't received yet
        // wait for the metadata loaded, then seek to expected position
        this._pendingSeekTime = milliseconds
      } else {
        let keyframe = segmentInfo.getNearestKeyframe(milliseconds)!
        this._remuxer!.seek(keyframe.milliseconds)
        this._ioctl!.seek(keyframe.fileposition)
        // Will be resolved in _onRemuxerMediaSegmentArrival()
        this._pendingResolveSeekPoint = keyframe.milliseconds
      }
    } else {
      // cross-segment seeking
      let targetSegmentInfo = this._mediaInfo.segments[targetSegmentIndex] as MediaInfo | undefined

      if (targetSegmentInfo == undefined) {
        // target segment hasn't been loaded. We need metadata then seek to expected time
        this._pendingSeekTime = milliseconds
        this._internalAbort()
        this._remuxer!.seek()
        this._remuxer!.insertDiscontinuity()
        this._loadSegment(targetSegmentIndex)
        // Here we wait for the metadata loaded, then seek to expected position
      } else {
        // We have target segment's metadata, direct seek to target position
        let keyframe = targetSegmentInfo.getNearestKeyframe(milliseconds)!
        this._internalAbort()
        this._remuxer!.seek(milliseconds)
        this._remuxer!.insertDiscontinuity()
        this._demuxer.resetMediaInfo()
        this._demuxer.timestampBase = this._mediaDataSource!.segments![targetSegmentIndex].timestampBase
        this._loadSegment(targetSegmentIndex, keyframe.fileposition)
        this._pendingResolveSeekPoint = keyframe.milliseconds
        this._reportSegmentMediaInfo(targetSegmentIndex)
      }
    }

    this._enableStatisticsReporter()
  }

  _searchSegmentIndexContains(milliseconds: number): number {
    let segments = this._mediaDataSource!.segments!
    let idx = segments.length - 1

    for (let i = 0; i < segments.length; i++) {
      if (milliseconds < (segments[i].timestampBase as number)) {
        idx = i - 1
        break
      }
    }
    return idx
  }

  _onInitChunkArrival(data: ArrayBuffer, byteStart: number): number {
    let consumed = 0

    if (byteStart > 0) {
      // IOController seeked immediately after opened, byteStart > 0 callback may received
      this._demuxer.bindDataSource(this._ioctl)
      this._demuxer.timestampBase = this._mediaDataSource!.segments![this._currentSegmentIndex].timestampBase

      consumed = this._demuxer.parseChunks(data, byteStart)
    } else {
      // byteStart == 0, Initial data, probe it first
      let probeData: any = null

      // Try probing input data as FLV first
      probeData = FLVDemuxer.probe(data)
      if (probeData.match) {
        // Hit as FLV
        this._setupFLVDemuxerRemuxer(probeData)
        consumed = this._demuxer.parseChunks(data, byteStart)
      }

      if (!probeData.match && !probeData.needMoreData) {
        // Non-FLV, try MPEG-TS probe
        probeData = TSDemuxer.probe(data)
        if (probeData.match) {
          // Hit as MPEG-TS
          this._setupTSDemuxerRemuxer(probeData)
          consumed = this._demuxer.parseChunks(data, byteStart)
        }
      }

      if (!probeData.match && !probeData.needMoreData) {
        // Both probing as FLV / MPEG-TS failed, report error
        probeData = null
        Log.e(this.TAG, 'Non MPEG-TS/FLV, Unsupported media type!')
        Promise.resolve().then(() => {
          this._internalAbort()
        })
        this._emitter!.emit(TransmuxingEvents.DEMUX_ERROR, DemuxErrors.FORMAT_UNSUPPORTED, 'Non MPEG-TS/FLV, Unsupported media type!')
        // Leave consumed as 0
      }
    }

    return consumed
  }

  _setupFLVDemuxerRemuxer(probeData: any): void {
    this._demuxer = new FLVDemuxer(probeData, this._config)

    if (!this._remuxer) {
      this._remuxer = new MP4Remuxer(this._config)
    }

    let mds = this._mediaDataSource!
    if (mds.duration != undefined && !isNaN(mds.duration)) {
      this._demuxer.overridedDuration = mds.duration
    }
    if (typeof mds.hasAudio === 'boolean') {
      this._demuxer.overridedHasAudio = mds.hasAudio
    }
    if (typeof mds.hasVideo === 'boolean') {
      this._demuxer.overridedHasVideo = mds.hasVideo
    }

    this._demuxer.timestampBase = mds.segments![this._currentSegmentIndex].timestampBase

    this._demuxer.onError = this._onDemuxException.bind(this)
    this._demuxer.onMediaInfo = this._onMediaInfo.bind(this)
    this._demuxer.onMetaDataArrived = this._onMetaDataArrived.bind(this)
    this._demuxer.onScriptDataArrived = this._onScriptDataArrived.bind(this)
    this._demuxer.onSeiArrived = this._onSEI.bind(this)

    this._remuxer.bindDataSource(this._demuxer.bindDataSource(this._ioctl))

    this._remuxer.onInitSegment = this._onRemuxerInitSegmentArrival.bind(this)
    this._remuxer.onMediaSegment = this._onRemuxerMediaSegmentArrival.bind(this)
  }

  _setupTSDemuxerRemuxer(probeData: any): void {
    let demuxer = (this._demuxer = new TSDemuxer(probeData, this._config))

    if (!this._remuxer) {
      this._remuxer = new MP4Remuxer(this._config)
    }

    demuxer.onError = this._onDemuxException.bind(this)
    demuxer.onMediaInfo = this._onMediaInfo.bind(this)
    demuxer.onMetaDataArrived = this._onMetaDataArrived.bind(this)
    demuxer.onTimedID3Metadata = this._onTimedID3Metadata.bind(this)
    demuxer.onPGSSubtitleData = this._onPGSSubtitle.bind(this)
    demuxer.onSynchronousKLVMetadata = this._onSynchronousKLVMetadata.bind(this)
    demuxer.onAsynchronousKLVMetadata = this._onAsynchronousKLVMetadata.bind(this)
    demuxer.onSMPTE2038Metadata = this._onSMPTE2038Metadata.bind(this)
    demuxer.onSEI = this._onSEI.bind(this)
    demuxer.onSCTE35Metadata = this._onSCTE35Metadata.bind(this)
    demuxer.onPESPrivateDataDescriptor = this._onPESPrivateDataDescriptor.bind(this)
    demuxer.onPESPrivateData = this._onPESPrivateData.bind(this)

    this._remuxer.bindDataSource(this._demuxer)
    this._demuxer.bindDataSource(this._ioctl)

    this._remuxer.onInitSegment = this._onRemuxerInitSegmentArrival.bind(this)
    this._remuxer.onMediaSegment = this._onRemuxerMediaSegmentArrival.bind(this)
  }

  _onMediaInfo(mediaInfo: MediaInfo): void {
    if (this._mediaInfo == null) {
      // Store first segment's mediainfo as global mediaInfo
      this._mediaInfo = Object.assign({}, mediaInfo)
      this._mediaInfo.keyframesIndex = null
      this._mediaInfo.segments = []
      this._mediaInfo.segmentCount = this._mediaDataSource!.segments!.length
      Object.setPrototypeOf(this._mediaInfo, MediaInfo.prototype)
    }

    let segmentInfo = Object.assign({}, mediaInfo) as MediaInfo
    Object.setPrototypeOf(segmentInfo, MediaInfo.prototype)
    this._mediaInfo.segments[this._currentSegmentIndex] = segmentInfo

    // notify mediaInfo update
    this._reportSegmentMediaInfo(this._currentSegmentIndex)

    if (this._pendingSeekTime != null) {
      Promise.resolve().then(() => {
        let target = this._pendingSeekTime
        this._pendingSeekTime = null
        if (target != null) {
          this.seek(target)
        }
      })
    }
  }

  _onMetaDataArrived(metadata: Record<string, any>): void {
    this._emitter!.emit(TransmuxingEvents.METADATA_ARRIVED, metadata)
  }

  _onScriptDataArrived(data: Record<string, any>): void {
    this._emitter!.emit(TransmuxingEvents.SCRIPTDATA_ARRIVED, data)
  }

  _onTimedID3Metadata(timed_id3_metadata: PESPrivateData): void {
    let timestamp_base = this._remuxer!.getTimestampBase()
    if (timestamp_base == undefined) {
      return
    }

    if (timed_id3_metadata.pts != undefined) {
      timed_id3_metadata.pts -= timestamp_base
    }

    if (timed_id3_metadata.dts != undefined) {
      timed_id3_metadata.dts -= timestamp_base
    }

    this._emitter!.emit(TransmuxingEvents.TIMED_ID3_METADATA_ARRIVED, timed_id3_metadata)
  }

  _onPGSSubtitle(pgs_data: PGSData): void {
    let timestamp_base = this._remuxer!.getTimestampBase()
    if (timestamp_base == undefined) {
      return
    }

    if (pgs_data.pts != undefined) {
      pgs_data.pts -= timestamp_base
    }

    if (pgs_data.dts != undefined) {
      pgs_data.dts -= timestamp_base
    }

    this._emitter!.emit(TransmuxingEvents.PGS_SUBTITLE_ARRIVED, pgs_data)
  }

  _onSynchronousKLVMetadata(synchronous_klv_metadata: KLVData): void {
    let timestamp_base = this._remuxer!.getTimestampBase()
    if (timestamp_base == undefined) {
      return
    }

    if ((synchronous_klv_metadata as TimestampedMetadata).pts != undefined) {
      ;(synchronous_klv_metadata as TimestampedMetadata).pts! -= timestamp_base
    }

    if ((synchronous_klv_metadata as TimestampedMetadata).dts != undefined) {
      ;(synchronous_klv_metadata as TimestampedMetadata).dts! -= timestamp_base
    }

    this._emitter!.emit(TransmuxingEvents.SYNCHRONOUS_KLV_METADATA_ARRIVED, synchronous_klv_metadata)
  }

  _onAsynchronousKLVMetadata(asynchronous_klv_metadata: PESPrivateData): void {
    this._emitter!.emit(TransmuxingEvents.ASYNCHRONOUS_KLV_METADATA_ARRIVED, asynchronous_klv_metadata)
  }

  _onSMPTE2038Metadata(smpte2038_metadata: SMPTE2038Data): void {
    let timestamp_base = this._remuxer!.getTimestampBase()
    if (timestamp_base == undefined) {
      return
    }

    if ((smpte2038_metadata as TimestampedMetadata).pts != undefined) {
      ;(smpte2038_metadata as TimestampedMetadata).pts! -= timestamp_base
    }

    if ((smpte2038_metadata as TimestampedMetadata).dts != undefined) {
      ;(smpte2038_metadata as TimestampedMetadata).dts! -= timestamp_base
    }

    if ((smpte2038_metadata as TimestampedMetadata).nearest_pts != undefined) {
      ;(smpte2038_metadata as TimestampedMetadata).nearest_pts! -= timestamp_base
    }

    this._emitter!.emit(TransmuxingEvents.SMPTE2038_METADATA_ARRIVED, smpte2038_metadata)
  }

  _onSEI(sei_data: SEIData): void {
    let timestamp_base = this._remuxer!.getTimestampBase()
    if (timestamp_base == undefined) {
      return
    }

    if (sei_data.pts != undefined) {
      sei_data.pts -= timestamp_base
    }

    this._emitter!.emit(TransmuxingEvents.SEI_ARRIVED, sei_data)
  }

  _onSCTE35Metadata(scte35: SCTE35Data): void {
    let timestamp_base = this._remuxer!.getTimestampBase()
    if (timestamp_base == undefined) {
      return
    }

    if (scte35.pts != undefined) {
      scte35.pts -= timestamp_base
    }

    if (scte35.nearest_pts != undefined) {
      scte35.nearest_pts -= timestamp_base
    }

    this._emitter!.emit(TransmuxingEvents.SCTE35_METADATA_ARRIVED, scte35)
  }

  _onPESPrivateDataDescriptor(descriptor: PESPrivateDataDescriptor): void {
    this._emitter!.emit(TransmuxingEvents.PES_PRIVATE_DATA_DESCRIPTOR, descriptor)
  }

  _onPESPrivateData(private_data: PESPrivateData): void {
    let timestamp_base = this._remuxer!.getTimestampBase()
    if (timestamp_base == undefined) {
      return
    }

    if (private_data.pts != undefined) {
      private_data.pts -= timestamp_base
    }

    if (private_data.nearest_pts != undefined) {
      private_data.nearest_pts -= timestamp_base
    }

    if (private_data.dts != undefined) {
      private_data.dts -= timestamp_base
    }

    this._emitter!.emit(TransmuxingEvents.PES_PRIVATE_DATA_ARRIVED, private_data)
  }

  _onIOSeeked(): void {
    this._remuxer!.insertDiscontinuity()
  }

  _onIOComplete(extraData: unknown): void {
    let segmentIndex = extraData as number
    let nextSegmentIndex = segmentIndex + 1

    if (nextSegmentIndex < this._mediaDataSource!.segments!.length) {
      this._internalAbort()
      if (this._remuxer) {
        this._remuxer.flushStashedSamples()
      }
      this._loadSegment(nextSegmentIndex)
    } else {
      if (this._remuxer) {
        this._remuxer.flushStashedSamples()
      }
      this._emitter!.emit(TransmuxingEvents.LOADING_COMPLETE)
      this._disableStatisticsReporter()
    }
  }

  _onIORedirect(redirectedURL: string): void {
    let segmentIndex = this._ioctl!.extraData as number
    this._mediaDataSource!.segments![segmentIndex].redirectedURL = redirectedURL
  }

  _onIORecoveredEarlyEof(): void {
    this._emitter!.emit(TransmuxingEvents.RECOVERED_EARLY_EOF)
  }

  _onIOException(type: LoaderErrorType, info: LoaderErrorInfo): void {
    Log.e(this.TAG, `IOException: type = ${type}, code = ${info.code}, msg = ${info.msg}`)
    this._emitter!.emit(TransmuxingEvents.IO_ERROR, type, info)
    this._disableStatisticsReporter()
  }

  _onDemuxException(type: string, info: string): void {
    Log.e(this.TAG, `DemuxException: type = ${type}, info = ${info}`)
    this._emitter!.emit(TransmuxingEvents.DEMUX_ERROR, type, info)
  }

  _onRemuxerInitSegmentArrival(type: SegmentType, initSegment: InitSegment): void {
    this._emitter!.emit(TransmuxingEvents.INIT_SEGMENT, type, initSegment)
  }

  _onRemuxerMediaSegmentArrival(type: SegmentType, mediaSegment: MediaSegment): void {
    if (this._pendingSeekTime != null) {
      // Media segments after new-segment cross-seeking should be dropped.
      return
    }
    this._emitter!.emit(TransmuxingEvents.MEDIA_SEGMENT, type, mediaSegment)

    // Resolve pending seekPoint
    if (this._pendingResolveSeekPoint != null && type === 'video') {
      let syncPoints = mediaSegment.info.syncPoints
      let seekpoint = this._pendingResolveSeekPoint
      this._pendingResolveSeekPoint = null

      // Safari: Pass PTS for recommend_seekpoint
      if (Browser.safari && syncPoints.length > 0 && syncPoints[0].originalDts === seekpoint) {
        seekpoint = syncPoints[0].pts
      }
      // else: use original DTS (keyframe.milliseconds)

      this._emitter!.emit(TransmuxingEvents.RECOMMEND_SEEKPOINT, seekpoint)
    }
  }

  _enableStatisticsReporter(): void {
    if (this._statisticsReporter == null) {
      this._statisticsReporter = self.setInterval(this._reportStatisticsInfo.bind(this), this._config.statisticsInfoReportInterval)
    }
  }

  _disableStatisticsReporter(): void {
    if (this._statisticsReporter != null) {
      self.clearInterval(this._statisticsReporter)
      this._statisticsReporter = null
    }
  }

  _reportSegmentMediaInfo(segmentIndex: number): void {
    let segmentInfo = this._mediaInfo.segments[segmentIndex]
    let exportInfo = Object.assign({}, segmentInfo) as MediaInfo & { segmentCount?: number }

    exportInfo.duration = this._mediaInfo.duration
    exportInfo.segmentCount = this._mediaInfo.segmentCount
    delete (exportInfo as any).segments
    delete (exportInfo as any).keyframesIndex

    this._emitter!.emit(TransmuxingEvents.MEDIA_INFO, exportInfo)
  }

  _reportStatisticsInfo(): void {
    let info: StatisticsInfo = {
      url: this._ioctl!.currentURL,
      hasRedirect: this._ioctl!.hasRedirect,
      speed: this._ioctl!.currentSpeed,
      loaderType: this._ioctl!.loaderType,
      currentSegmentIndex: this._currentSegmentIndex,
      totalSegmentCount: this._mediaDataSource!.segments!.length,
    }

    if (info.hasRedirect) {
      info.redirectedURL = this._ioctl!.currentRedirectedURL
    }

    this._emitter!.emit(TransmuxingEvents.STATISTICS_INFO, info)
  }
}

export default TransmuxingController
