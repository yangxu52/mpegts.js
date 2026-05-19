// ISO/IEC 13818-1 PES packets containing private data (stream_type=0x06)
export class PGSData {
  pid: number = 0
  stream_id: number = 0
  pts?: number
  dts?: number
  lang: string = ''
  data: Uint8Array = new Uint8Array(0)
  len: number = 0
}
