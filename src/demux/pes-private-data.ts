// ISO/IEC 13818-1 PES packets containing private data (stream_type=0x06)
export class PESPrivateData {
  pid: number = 0
  stream_id: number = 0
  pts?: number
  dts?: number
  nearest_pts?: number
  data: Uint8Array = new Uint8Array(0)
  len: number = 0
}

export class PESPrivateDataDescriptor {
  pid: number = 0
  stream_type: number = 0
  descriptor: Uint8Array = new Uint8Array(0)
}
