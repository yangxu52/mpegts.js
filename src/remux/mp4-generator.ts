/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * This file is derived from dailymotion's hls.js library (hls.js/src/remux/mp4-generator.js)
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

//  MP4 boxes generator for ISO BMFF (ISO Base Media File Format, defined in ISO/IEC 14496-12)
class MP4 {
  static types: Record<string, number[]>
  static constants: Record<string, Uint8Array>

  static init() {
    MP4.types = {
      avc1: [],
      avcC: [],
      btrt: [],
      dinf: [],
      dref: [],
      esds: [],
      ftyp: [],
      hdlr: [],
      hvc1: [],
      hvcC: [],
      av01: [],
      av1C: [],
      mdat: [],
      mdhd: [],
      mdia: [],
      mfhd: [],
      minf: [],
      moof: [],
      moov: [],
      mp4a: [],
      mvex: [],
      mvhd: [],
      sdtp: [],
      stbl: [],
      stco: [],
      stsc: [],
      stsd: [],
      stsz: [],
      stts: [],
      tfdt: [],
      tfhd: [],
      traf: [],
      trak: [],
      trun: [],
      trex: [],
      tkhd: [],
      vmhd: [],
      smhd: [],
      chnl: [],
      '.mp3': [],
      Opus: [],
      dOps: [],
      fLaC: [],
      dfLa: [],
      ipcm: [],
      pcmC: [],
      'ac-3': [],
      dac3: [],
      'ec-3': [],
      dec3: [],
    }

    for (let name in MP4.types) {
      if (MP4.types.hasOwnProperty(name)) {
        MP4.types[name] = [name.charCodeAt(0), name.charCodeAt(1), name.charCodeAt(2), name.charCodeAt(3)]
      }
    }

    let constants: Record<string, Uint8Array> = (MP4.constants = {})

    constants.FTYP = new Uint8Array([0x69, 0x73, 0x6f, 0x6d, 0x0, 0x0, 0x0, 0x1, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31])

    constants.STSD_PREFIX = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01])

    constants.STTS = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    constants.STSC = constants.STCO = constants.STTS

    constants.STSZ = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    constants.HDLR_VIDEO = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x76, 0x69, 0x64, 0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x56,
      0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00,
    ])

    constants.HDLR_AUDIO = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x73, 0x6f, 0x75, 0x6e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x53,
      0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00,
    ])

    constants.DREF = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x0c, 0x75, 0x72, 0x6c, 0x20, 0x00, 0x00, 0x00, 0x01])

    constants.SMHD = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    constants.VMHD = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
  }

  static box(type: number[], ...datas: Uint8Array[]) {
    let size = 8
    let result = null
    let arrayCount = datas.length

    for (let i = 0; i < arrayCount; i++) {
      size += datas[i].byteLength
    }

    result = new Uint8Array(size)
    result[0] = (size >>> 24) & 0xff
    result[1] = (size >>> 16) & 0xff
    result[2] = (size >>> 8) & 0xff
    result[3] = size & 0xff

    result.set(type, 4)

    let offset = 8
    for (let i = 0; i < arrayCount; i++) {
      result.set(datas[i], offset)
      offset += datas[i].byteLength
    }

    return result
  }

  static generateInitSegment(meta) {
    let ftyp = MP4.box(MP4.types.ftyp, MP4.constants.FTYP)
    let moov = MP4.moov(meta)

    let result = new Uint8Array(ftyp.byteLength + moov.byteLength)
    result.set(ftyp, 0)
    result.set(moov, ftyp.byteLength)
    return result
  }

  static moov(meta) {
    let mvhd = MP4.mvhd(meta.timescale, meta.duration)
    let trak = MP4.trak(meta)
    let mvex = MP4.mvex(meta)
    return MP4.box(MP4.types.moov, mvhd, trak, mvex)
  }

  static mvhd(timescale, duration) {
    return MP4.box(
      MP4.types.mvhd,
      new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        (timescale >>> 24) & 0xff,
        (timescale >>> 16) & 0xff,
        (timescale >>> 8) & 0xff,
        timescale & 0xff,
        (duration >>> 24) & 0xff,
        (duration >>> 16) & 0xff,
        (duration >>> 8) & 0xff,
        duration & 0xff,
        0x00,
        0x01,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x40,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0xff,
        0xff,
        0xff,
        0xff,
      ])
    )
  }

  static trak(meta) {
    return MP4.box(MP4.types.trak, MP4.tkhd(meta), MP4.mdia(meta))
  }

  static tkhd(meta) {
    let trackId = meta.id,
      duration = meta.duration
    let width = meta.presentWidth,
      height = meta.presentHeight

    return MP4.box(
      MP4.types.tkhd,
      new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x07,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        (trackId >>> 24) & 0xff,
        (trackId >>> 16) & 0xff,
        (trackId >>> 8) & 0xff,
        trackId & 0xff,
        0x00,
        0x00,
        0x00,
        0x00,
        (duration >>> 24) & 0xff,
        (duration >>> 16) & 0xff,
        (duration >>> 8) & 0xff,
        duration & 0xff,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x40,
        0x00,
        0x00,
        0x00,
        (width >>> 8) & 0xff,
        width & 0xff,
        0x00,
        0x00,
        (height >>> 8) & 0xff,
        height & 0xff,
        0x00,
        0x00,
      ])
    )
  }

  static mdia(meta) {
    return MP4.box(MP4.types.mdia, MP4.mdhd(meta), MP4.hdlr(meta), MP4.minf(meta))
  }

  static mdhd(meta) {
    let timescale = meta.timescale
    let duration = meta.duration
    return MP4.box(
      MP4.types.mdhd,
      new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        (timescale >>> 24) & 0xff,
        (timescale >>> 16) & 0xff,
        (timescale >>> 8) & 0xff,
        timescale & 0xff,
        (duration >>> 24) & 0xff,
        (duration >>> 16) & 0xff,
        (duration >>> 8) & 0xff,
        duration & 0xff,
        0x55,
        0xc4,
        0x00,
        0x00,
      ])
    )
  }

  static hdlr(meta) {
    let data = null
    if (meta.type === 'audio') {
      data = MP4.constants.HDLR_AUDIO
    } else {
      data = MP4.constants.HDLR_VIDEO
    }
    return MP4.box(MP4.types.hdlr, data)
  }

  static minf(meta) {
    let xmhd = null
    if (meta.type === 'audio') {
      xmhd = MP4.box(MP4.types.smhd, MP4.constants.SMHD)
    } else {
      xmhd = MP4.box(MP4.types.vmhd, MP4.constants.VMHD)
    }
    return MP4.box(MP4.types.minf, xmhd, MP4.dinf(), MP4.stbl(meta))
  }

  static dinf() {
    let result = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, MP4.constants.DREF))
    return result
  }

  static stbl(meta) {
    let result = MP4.box(
      MP4.types.stbl,
      MP4.stsd(meta),
      MP4.box(MP4.types.stts, MP4.constants.STTS),
      MP4.box(MP4.types.stsc, MP4.constants.STSC),
      MP4.box(MP4.types.stsz, MP4.constants.STSZ),
      MP4.box(MP4.types.stco, MP4.constants.STCO)
    )
    return result
  }

  static stsd(meta) {
    if (meta.type === 'audio') {
      if (meta.codec === 'mp3') {
        return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.mp3(meta))
      } else if (meta.codec === 'ac-3') {
        return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.ac3(meta))
      } else if (meta.codec === 'ec-3') {
        return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.ec3(meta))
      } else if (meta.codec === 'opus') {
        return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.Opus(meta))
      } else if (meta.codec == 'flac') {
        return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.fLaC(meta))
      } else if (meta.codec == 'ipcm') {
        return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.ipcm(meta))
      }
      return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.mp4a(meta))
    } else if (meta.type === 'video' && meta.codec.startsWith('hvc1')) {
      return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.hvc1(meta))
    } else if (meta.type === 'video' && meta.codec.startsWith('av01')) {
      return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.av01(meta))
    } else {
      return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.avc1(meta))
    }
  }

  static mp3(meta) {
    let channelCount = meta.channelCount
    let sampleRate = meta.audioSampleRate

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      channelCount,
      0x00,
      0x10,
      0x00,
      0x00,
      0x00,
      0x00,
      (sampleRate >>> 8) & 0xff,
      sampleRate & 0xff,
      0x00,
      0x00,
    ])

    return MP4.box(MP4.types['.mp3'], data)
  }

  static mp4a(meta) {
    let channelCount = meta.channelCount
    let sampleRate = meta.audioSampleRate

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      channelCount,
      0x00,
      0x10,
      0x00,
      0x00,
      0x00,
      0x00,
      (sampleRate >>> 8) & 0xff,
      sampleRate & 0xff,
      0x00,
      0x00,
    ])

    return MP4.box(MP4.types.mp4a, data, MP4.esds(meta))
  }

  static ac3(meta) {
    let channelCount = meta.channelCount
    let sampleRate = meta.audioSampleRate

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      channelCount,
      0x00,
      0x10,
      0x00,
      0x00,
      0x00,
      0x00,
      (sampleRate >>> 8) & 0xff,
      sampleRate & 0xff,
      0x00,
      0x00,
    ])

    return MP4.box(MP4.types['ac-3'], data, MP4.box(MP4.types.dac3, new Uint8Array(meta.config)))
  }

  static ec3(meta) {
    let channelCount = meta.channelCount
    let sampleRate = meta.audioSampleRate

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      channelCount,
      0x00,
      0x10,
      0x00,
      0x00,
      0x00,
      0x00,
      (sampleRate >>> 8) & 0xff,
      sampleRate & 0xff,
      0x00,
      0x00,
    ])

    return MP4.box(MP4.types['ec-3'], data, MP4.box(MP4.types.dec3, new Uint8Array(meta.config)))
  }

  static esds(meta) {
    let config = meta.config || []
    let configSize = config.length
    let data = new Uint8Array(
      [
        0x00,
        0x00,
        0x00,
        0x00,
        0x03,
        0x17 + configSize,
        0x00,
        0x01,
        0x00,
        0x04,
        0x0f + configSize,
        0x40,
        0x15,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x05,
      ]
        .concat([configSize])
        .concat(config)
        .concat([0x06, 0x01, 0x02])
    )
    return MP4.box(MP4.types.esds, data)
  }

  static Opus(meta) {
    let channelCount = meta.channelCount
    let sampleRate = meta.audioSampleRate

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      channelCount,
      0x00,
      0x10,
      0x00,
      0x00,
      0x00,
      0x00,
      (sampleRate >>> 8) & 0xff,
      sampleRate & 0xff,
      0x00,
      0x00,
    ])

    return MP4.box(MP4.types.Opus, data, MP4.dOps(meta))
  }

  static dOps(meta) {
    let channelCount = meta.channelCount
    let channelConfigCode = meta.channelConfigCode
    let sampleRate = meta.audioSampleRate

    if (meta.config) {
      return MP4.box(MP4.types.dOps, meta.config)
    }

    let mapping = []
    switch (channelConfigCode) {
      case 0x01:
      case 0x02:
        mapping = [0x0]
        break
      case 0x00:
        mapping = [0xff, 1, 1, 0, 1]
        break
      case 0x80:
        mapping = [0xff, 2, 0, 0, 1]
        break
      case 0x03:
        mapping = [0x01, 2, 1, 0, 2, 1]
        break
      case 0x04:
        mapping = [0x01, 2, 2, 0, 1, 2, 3]
        break
      case 0x05:
        mapping = [0x01, 3, 2, 0, 4, 1, 2, 3]
        break
      case 0x06:
        mapping = [0x01, 4, 2, 0, 4, 1, 2, 3, 5]
        break
      case 0x07:
        mapping = [0x01, 4, 2, 0, 4, 1, 2, 3, 5, 6]
        break
      case 0x08:
        mapping = [0x01, 5, 3, 0, 6, 1, 2, 3, 4, 5, 7]
        break
      case 0x82:
        mapping = [0x01, 1, 2, 0, 1]
        break
      case 0x83:
        mapping = [0x01, 1, 3, 0, 1, 2]
        break
      case 0x84:
        mapping = [0x01, 1, 4, 0, 1, 2, 3]
        break
      case 0x85:
        mapping = [0x01, 1, 5, 0, 1, 2, 3, 4]
        break
      case 0x86:
        mapping = [0x01, 1, 6, 0, 1, 2, 3, 4, 5]
        break
      case 0x87:
        mapping = [0x01, 1, 7, 0, 1, 2, 3, 4, 5, 6]
        break
      case 0x88:
        mapping = [0x01, 1, 8, 0, 1, 2, 3, 4, 5, 6, 7]
        break
    }

    let data = new Uint8Array([
      0x00,
      channelCount,
      0x00,
      0x00,
      (sampleRate >>> 24) & 0xff,
      (sampleRate >>> 17) & 0xff,
      (sampleRate >>> 8) & 0xff,
      (sampleRate >>> 0) & 0xff,
      0x00,
      0x00,
      ...mapping,
    ])
    return MP4.box(MP4.types.dOps, data)
  }

  static fLaC(meta) {
    let channelCount = meta.channelCount
    let sampleRate = Math.min(meta.audioSampleRate, 65535)
    let sampleSize = meta.sampleSize

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      channelCount,
      0x00,
      sampleSize,
      0x00,
      0x00,
      0x00,
      0x00,
      (sampleRate >>> 8) & 0xff,
      sampleRate & 0xff,
      0x00,
      0x00,
    ])

    return MP4.box(MP4.types.fLaC, data, MP4.dfLa(meta))
  }

  static dfLa(meta) {
    let data = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...meta.config])
    return MP4.box(MP4.types.dfLa, data)
  }

  static ipcm(meta) {
    let channelCount = meta.channelCount
    let sampleRate = Math.min(meta.audioSampleRate, 65535)
    let sampleSize = meta.sampleSize

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      channelCount,
      0x00,
      sampleSize,
      0x00,
      0x00,
      0x00,
      0x00,
      (sampleRate >>> 8) & 0xff,
      sampleRate & 0xff,
      0x00,
      0x00,
    ])

    if (meta.channelCount === 1) {
      return MP4.box(MP4.types.ipcm, data, MP4.pcmC(meta))
    } else {
      return MP4.box(MP4.types.ipcm, data, MP4.chnl(meta), MP4.pcmC(meta))
    }
  }

  static chnl(meta) {
    let data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, meta.channelCount, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    return MP4.box(MP4.types.chnl, data)
  }

  static pcmC(meta) {
    let littleEndian = meta.littleEndian ? 0x01 : 0x00
    let sampleSize = meta.sampleSize
    let data = new Uint8Array([0x00, 0x00, 0x00, 0x00, littleEndian, sampleSize])
    return MP4.box(MP4.types.pcmC, data)
  }

  static avc1(meta) {
    let avcc = meta.avcc
    let width = meta.codecWidth,
      height = meta.codecHeight

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      (width >>> 8) & 0xff,
      width & 0xff,
      (height >>> 8) & 0xff,
      height & 0xff,
      0x00,
      0x48,
      0x00,
      0x00,
      0x00,
      0x48,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x0a,
      0x78,
      0x71,
      0x71,
      0x2f,
      0x66,
      0x6c,
      0x76,
      0x2e,
      0x6a,
      0x73,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x18,
      0xff,
      0xff,
    ])
    return MP4.box(MP4.types.avc1, data, MP4.box(MP4.types.avcC, avcc))
  }

  static hvc1(meta) {
    let hvcc = meta.hvcc
    let width = meta.codecWidth,
      height = meta.codecHeight

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      (width >>> 8) & 0xff,
      width & 0xff,
      (height >>> 8) & 0xff,
      height & 0xff,
      0x00,
      0x48,
      0x00,
      0x00,
      0x00,
      0x48,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x0a,
      0x78,
      0x71,
      0x71,
      0x2f,
      0x66,
      0x6c,
      0x76,
      0x2e,
      0x6a,
      0x73,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x18,
      0xff,
      0xff,
    ])
    return MP4.box(MP4.types.hvc1, data, MP4.box(MP4.types.hvcC, hvcc))
  }

  static av01(meta) {
    let av1c = meta.av1c
    let width = meta.codecWidth || 192,
      height = meta.codecHeight || 108

    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      (width >>> 8) & 0xff,
      width & 0xff,
      (height >>> 8) & 0xff,
      height & 0xff,
      0x00,
      0x48,
      0x00,
      0x00,
      0x00,
      0x48,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x0a,
      0x78,
      0x71,
      0x71,
      0x2f,
      0x66,
      0x6c,
      0x76,
      0x2e,
      0x6a,
      0x73,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x18,
      0xff,
      0xff,
    ])
    return MP4.box(MP4.types.av01, data, MP4.box(MP4.types.av1C, av1c))
  }

  static mvex(meta) {
    return MP4.box(MP4.types.mvex, MP4.trex(meta))
  }

  static trex(meta) {
    let trackId = meta.id
    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      (trackId >>> 24) & 0xff,
      (trackId >>> 16) & 0xff,
      (trackId >>> 8) & 0xff,
      trackId & 0xff,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x01,
    ])
    return MP4.box(MP4.types.trex, data)
  }

  static moof(track, baseMediaDecodeTime) {
    return MP4.box(MP4.types.moof, MP4.mfhd(track.sequenceNumber), MP4.traf(track, baseMediaDecodeTime))
  }

  static mfhd(sequenceNumber) {
    let data = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x00,
      (sequenceNumber >>> 24) & 0xff,
      (sequenceNumber >>> 16) & 0xff,
      (sequenceNumber >>> 8) & 0xff,
      sequenceNumber & 0xff,
    ])
    return MP4.box(MP4.types.mfhd, data)
  }

  static traf(track, baseMediaDecodeTime) {
    let trackId = track.id

    let tfhd = MP4.box(
      MP4.types.tfhd,
      new Uint8Array([0x00, 0x00, 0x00, 0x00, (trackId >>> 24) & 0xff, (trackId >>> 16) & 0xff, (trackId >>> 8) & 0xff, trackId & 0xff])
    )
    let tfdt = MP4.box(
      MP4.types.tfdt,
      new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x00,
        (baseMediaDecodeTime >>> 24) & 0xff,
        (baseMediaDecodeTime >>> 16) & 0xff,
        (baseMediaDecodeTime >>> 8) & 0xff,
        baseMediaDecodeTime & 0xff,
      ])
    )
    let sdtp = MP4.sdtp(track)
    let trun = MP4.trun(track, sdtp.byteLength + 16 + 16 + 8 + 16 + 8 + 8)

    return MP4.box(MP4.types.traf, tfhd, tfdt, trun, sdtp)
  }

  static sdtp(track) {
    let samples = track.samples || []
    let sampleCount = samples.length
    let data = new Uint8Array(4 + sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      let flags = samples[i].flags
      data[i + 4] = (flags.isLeading << 6) | (flags.dependsOn << 4) | (flags.isDependedOn << 2) | flags.hasRedundancy
    }
    return MP4.box(MP4.types.sdtp, data)
  }

  static trun(track, offset) {
    let samples = track.samples || []
    let sampleCount = samples.length
    let dataSize = 12 + 16 * sampleCount
    let data = new Uint8Array(dataSize)
    offset += 8 + dataSize

    data.set(
      [
        0x00,
        0x00,
        0x0f,
        0x01,
        (sampleCount >>> 24) & 0xff,
        (sampleCount >>> 16) & 0xff,
        (sampleCount >>> 8) & 0xff,
        sampleCount & 0xff,
        (offset >>> 24) & 0xff,
        (offset >>> 16) & 0xff,
        (offset >>> 8) & 0xff,
        offset & 0xff,
      ],
      0
    )

    for (let i = 0; i < sampleCount; i++) {
      let duration = samples[i].duration
      let size = samples[i].size
      let flags = samples[i].flags
      let cts = samples[i].cts
      data.set(
        [
          (duration >>> 24) & 0xff,
          (duration >>> 16) & 0xff,
          (duration >>> 8) & 0xff,
          duration & 0xff,
          (size >>> 24) & 0xff,
          (size >>> 16) & 0xff,
          (size >>> 8) & 0xff,
          size & 0xff,
          (flags.isLeading << 2) | flags.dependsOn,
          (flags.isDependedOn << 6) | (flags.hasRedundancy << 4) | flags.isNonSync,
          0x00,
          0x00,
          (cts >>> 24) & 0xff,
          (cts >>> 16) & 0xff,
          (cts >>> 8) & 0xff,
          cts & 0xff,
        ],
        12 + 16 * i
      )
    }
    return MP4.box(MP4.types.trun, data)
  }

  static mdat(data) {
    return MP4.box(MP4.types.mdat, data)
  }
}

MP4.init()

export default MP4
