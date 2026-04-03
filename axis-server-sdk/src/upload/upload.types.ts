export type UploadSessionStatus =
  | 'ACTIVE'
  | 'FINALIZING'
  | 'COMPLETE'
  | 'ABORTED';

export interface UploadSessionRecord {
  id?: string;
  fileId: string;
  filename?: string;
  status: UploadSessionStatus | string;
  totalSize?: number;
  chunkSize?: number;
  totalChunks?: number;
  receivedBitmap?: Uint8Array | Buffer | null;
  hashState?: Uint8Array | Buffer | null;
  mimeType?: string | null;
  version?: number;
}

export interface UploadSessionStore {
  findByFileId(fileId: string): Promise<UploadSessionRecord | null>;
  updateStatus(
    fileId: string,
    status: UploadSessionStatus,
    hashState?: Uint8Array | Buffer | null,
  ): Promise<void>;
}

export interface UploadReceiptSigner {
  signActive(message: Uint8Array): { kid: string; sig: Uint8Array };
}

export interface UploadFileStat {
  path: string;
  size: number;
}

export interface UploadFileStore {
  getFinalPath(fileId: string, filename?: string): string;
  getTempPath(fileId: string): string;
  statFinal(fileId: string, filename?: string): Promise<UploadFileStat>;
  readFinalRange(
    fileId: string,
    filename: string | undefined,
    start: number,
    length: number,
  ): Promise<Buffer>;
  hasTemp(fileId: string): Promise<boolean>;
  moveTempToFinal(fileId: string, filename?: string): Promise<string>;
  createTempReadStream(fileId: string): NodeJS.ReadableStream;
}
