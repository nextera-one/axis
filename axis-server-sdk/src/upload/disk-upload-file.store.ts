import * as fs from 'fs';
import * as path from 'path';

import { UploadFileStat, UploadFileStore } from './upload.types';

export interface DiskUploadFileStoreOptions {
  uploadDir: string;
  chunkDir: string;
}

export class DiskUploadFileStore implements UploadFileStore {
  private readonly uploadDir: string;
  private readonly chunkDir: string;

  constructor(options: DiskUploadFileStoreOptions) {
    this.uploadDir = options.uploadDir;
    this.chunkDir = options.chunkDir;
  }

  getFinalPath(fileId: string, filename?: string): string {
    const safeFilename = filename ? path.basename(filename) : fileId;
    return path.join(this.uploadDir, safeFilename);
  }

  getTempPath(fileId: string): string {
    const safeId = path.basename(fileId);
    return path.join(this.chunkDir, safeId);
  }

  async statFinal(
    fileId: string,
    filename?: string,
  ): Promise<UploadFileStat> {
    const finalPath = this.getFinalPath(fileId, filename);
    if (!fs.existsSync(finalPath)) {
      throw new Error('FILE_MISSING_ON_DISK');
    }
    const stat = fs.statSync(finalPath);
    return { path: finalPath, size: stat.size };
  }

  async readFinalRange(
    fileId: string,
    filename: string | undefined,
    start: number,
    length: number,
  ): Promise<Buffer> {
    const finalPath = this.getFinalPath(fileId, filename);
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(finalPath, 'r');
    try {
      fs.readSync(fd, buffer, 0, length, start);
    } finally {
      fs.closeSync(fd);
    }
    return buffer;
  }

  async hasTemp(fileId: string): Promise<boolean> {
    const tempPath = this.getTempPath(fileId);
    return fs.existsSync(tempPath);
  }

  async moveTempToFinal(
    fileId: string,
    filename?: string,
  ): Promise<string> {
    const tempPath = this.getTempPath(fileId);
    const finalPath = this.getFinalPath(fileId, filename);

    try {
      await fs.promises.rename(tempPath, finalPath);
    } catch {
      await fs.promises.copyFile(tempPath, finalPath);
      await fs.promises.unlink(tempPath);
    }

    return finalPath;
  }

  createTempReadStream(fileId: string): NodeJS.ReadableStream {
    const tempPath = this.getTempPath(fileId);
    return fs.createReadStream(tempPath);
  }
}
