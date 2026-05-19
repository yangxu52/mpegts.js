import MediaInfo from '../core/media-info'
import { PESPrivateData, PESPrivateDataDescriptor } from './pes-private-data'
import { SMPTE2038Data } from './smpte2038'
import { SCTE35Data } from './scte35'
import { KLVData } from './klv'
import { PGSData } from './pgs-data'
import { SEIData } from './sei'

type OnErrorCallback = ((type: string, info: string) => void) | null
type OnMediaInfoCallback = ((mediaInfo: MediaInfo) => void) | null
type OnMetaDataArrivedCallback = ((metadata: any) => void) | null
type OnTrackMetadataCallback = ((type: string, metadata: any) => void) | null
type OnDataAvailableCallback = ((audioTrack: any, videoTrack: any) => void) | null
type OnTimedID3MetadataCallback = ((timed_id3_data: PESPrivateData) => void) | null
type OnPGSSubtitleDataCallback = ((pgs_data: PGSData) => void) | null
type OnSynchronousKLVMetadataCallback = ((synchronous_klv_data: KLVData) => void) | null
type OnAsynchronousKLVMetadataCallback = ((asynchronous_klv_data: PESPrivateData) => void) | null
type OnSMPTE2038MetadataCallback = ((smpte2038_data: SMPTE2038Data) => void) | null
type OnSEICallback = ((sei_data: SEIData) => void) | null
type OnSCTE35MetadataCallback = ((scte35_data: SCTE35Data) => void) | null
type OnPESPrivateDataCallback = ((private_data: PESPrivateData) => void) | null
type OnPESPrivateDataDescriptorCallback = ((private_data_descriptor: PESPrivateDataDescriptor) => void) | null

export default abstract class BaseDemuxer {
  public onError: OnErrorCallback = null
  public onMediaInfo: OnMediaInfoCallback = null
  public onMetaDataArrived: OnMetaDataArrivedCallback = null
  public onTrackMetadata: OnTrackMetadataCallback = null
  public onDataAvailable: OnDataAvailableCallback = null
  public onTimedID3Metadata: OnTimedID3MetadataCallback = null
  public onPGSSubtitleData: OnPGSSubtitleDataCallback = null
  public onSynchronousKLVMetadata: OnSynchronousKLVMetadataCallback = null
  public onAsynchronousKLVMetadata: OnAsynchronousKLVMetadataCallback = null
  public onSMPTE2038Metadata: OnSMPTE2038MetadataCallback = null
  public onSEI: OnSEICallback = null
  public onSCTE35Metadata: OnSCTE35MetadataCallback = null
  public onPESPrivateData: OnPESPrivateDataCallback = null
  public onPESPrivateDataDescriptor: OnPESPrivateDataDescriptorCallback = null

  public constructor() {}

  public destroy(): void {
    this.onError = null
    this.onMediaInfo = null
    this.onMetaDataArrived = null
    this.onTrackMetadata = null
    this.onDataAvailable = null
    this.onTimedID3Metadata = null
    this.onPGSSubtitleData = null
    this.onSynchronousKLVMetadata = null
    this.onAsynchronousKLVMetadata = null
    this.onSMPTE2038Metadata = null
    this.onSEI = null
    this.onSCTE35Metadata = null
    this.onPESPrivateData = null
    this.onPESPrivateDataDescriptor = null
  }

  abstract parseChunks(chunk: ArrayBuffer, byteStart: number): number
}
