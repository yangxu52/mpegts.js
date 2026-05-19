export interface ProgramToPMTPIDMap {
  [program: number]: number
}

export class PAT {
  version_number: number = 0
  network_pid: number = 0
  // program_number -> pmt_pid
  program_pmt_pid: ProgramToPMTPIDMap = {}
}

export enum StreamType {
  kMPEG1Audio = 0x03,
  kMPEG2Audio = 0x04,
  kPESPrivateData = 0x06,
  kADTSAAC = 0x0f,
  kLOASAAC = 0x11,
  kAC3 = 0x81,
  kEAC3 = 0x87,
  kMetadata = 0x15,
  kSCTE35 = 0x86,
  kPGS = 0x90,
  kH264 = 0x1b,
  kH265 = 0x24,
}

export interface PIDToStreamTypeMap {
  [pid: number]: StreamType
}

export interface CommonPIDs {
  h264: number | undefined
  h265: number | undefined
  av1: number | undefined
  adts_aac: number | undefined
  loas_aac: number | undefined
  opus: number | undefined
  ac3: number | undefined
  eac3: number | undefined
  mp3: number | undefined
}

export interface PIDPresenceMap {
  [pid: number]: boolean
}

export interface PIDLanguageMap {
  [pid: number]: string
}

export class PMT {
  program_number: number = 0
  version_number: number = 0
  pcr_pid: number = 0
  // pid -> stream_type
  pid_stream_type: PIDToStreamTypeMap = {}

  common_pids: CommonPIDs = {
    h264: undefined,
    h265: undefined,
    av1: undefined,
    adts_aac: undefined,
    loas_aac: undefined,
    opus: undefined,
    ac3: undefined,
    eac3: undefined,
    mp3: undefined,
  }

  pes_private_data_pids: PIDPresenceMap = {}

  timed_id3_pids: PIDPresenceMap = {}

  pgs_pids: PIDPresenceMap = {}
  pgs_langs: PIDLanguageMap = {}

  synchronous_klv_pids: PIDPresenceMap = {}

  asynchronous_klv_pids: PIDPresenceMap = {}

  scte_35_pids: PIDPresenceMap = {}

  smpte2038_pids: PIDPresenceMap = {}
}

export interface ProgramToPMTMap {
  [program: number]: PMT
}

export class PESData {
  pid: number = 0
  data: Uint8Array = new Uint8Array(0)
  stream_type: StreamType = StreamType.kMPEG1Audio
  file_position: number = 0
  random_access_indicator: number = 0
}

export class SectionData {
  pid: number = 0
  data: Uint8Array = new Uint8Array(0)
  file_position: number = 0
  random_access_indicator: number = 0
}

export class SliceQueue {
  slices: Uint8Array[] = []
  total_length: number = 0
  expected_length: number = 0
  file_position: number = 0
  random_access_indicator: number = 0
}

export interface PIDToSliceQueues {
  [pid: number]: SliceQueue
}
