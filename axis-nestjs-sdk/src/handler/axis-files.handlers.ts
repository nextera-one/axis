import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import {
  AxisFrame,
  encodeFrame,
  getSignTarget,
  decodeVarint,
  encodeVarint,
  Intent,
  AxisHandler,
  AXIS_UPLOAD_FILE_STORE,
  AXIS_UPLOAD_RECEIPT_SIGNER,
  AXIS_UPLOAD_SESSION_STORE,
} from "@nextera.one/axis-server-sdk";
import type {
  UploadFileStore,
  UploadReceiptSigner,
  UploadSessionStore,
} from "@nextera.one/axis-server-sdk";
import { Handler } from "./handler.decorator";

@Handler("axis.files.download")
@Injectable()
export class AxisFilesDownloadHandler implements AxisHandler {
  private readonly logger = new Logger(AxisFilesDownloadHandler.name);

  readonly name = "axis.files.download";
  readonly open = true;
  readonly description = "File download handler";

  constructor(
    @Inject(AXIS_UPLOAD_SESSION_STORE)
    private readonly sessions: UploadSessionStore,
    @Inject(AXIS_UPLOAD_FILE_STORE)
    private readonly files: UploadFileStore,
  ) {}

  @Intent("file.download", { absolute: true, kind: "read" })
  async execute(
    body: Uint8Array,
    headers?: Map<number, Uint8Array>,
  ): Promise<any> {
    const h = headers;
    if (!h) throw new Error("MISSING_HEADERS");

    const uploadIdBytes = h.get(20);
    if (!uploadIdBytes) throw new Error("MISSING_UPLOAD_ID");
    const uploadId = new TextDecoder().decode(uploadIdBytes);

    let rangeStart = 0;
    let rangeLen = -1;

    const startBytes = h.get(21);
    if (startBytes) {
      const { value } = decodeVarint(startBytes);
      rangeStart = value;
    }

    const lenBytes = h.get(22);
    if (lenBytes) {
      const { value } = decodeVarint(lenBytes);
      rangeLen = value;
    }

    const session = await this.sessions.findByFileId(uploadId);
    if (!session) {
      throw new Error(`SESSION_NOT_FOUND: ${uploadId}`);
    }

    if (session.status !== "COMPLETE") {
      throw new Error(`FILE_NOT_READY: Status is ${session.status}`);
    }

    const stat = await this.files.statFinal(uploadId, session.filename);
    const fileSize = stat.size;

    if (rangeStart < 0) rangeStart = 0;
    if (rangeStart >= fileSize) throw new Error("RANGE_OUT_OF_BOUNDS");

    let end = fileSize;
    if (rangeLen >= 0) {
      end = Math.min(rangeStart + rangeLen, fileSize);
    }

    const actualLen = end - rangeStart;
    const buffer = await this.files.readFinalRange(
      uploadId,
      session.filename,
      rangeStart,
      actualLen,
    );

    const responseHeaders = new Map<number, Uint8Array>();
    responseHeaders.set(30, encodeVarint(fileSize));
    responseHeaders.set(31, encodeVarint(rangeStart));
    responseHeaders.set(32, encodeVarint(actualLen));

    return {
      ok: true,
      effect: "FILE_PART",
      body: buffer,
      headers: responseHeaders,
    };
  }
}

@Handler("axis.files.finalize")
@Injectable()
export class AxisFilesFinalizeHandler implements AxisHandler {
  private readonly logger = new Logger(AxisFilesFinalizeHandler.name);

  readonly name = "axis.files.finalize";
  readonly open = false;
  readonly description = "File upload finalization handler";

  constructor(
    @Inject(AXIS_UPLOAD_SESSION_STORE)
    private readonly sessions: UploadSessionStore,
    @Inject(AXIS_UPLOAD_FILE_STORE)
    private readonly files: UploadFileStore,
    @Optional()
    @Inject(AXIS_UPLOAD_RECEIPT_SIGNER)
    private readonly keyring?: UploadReceiptSigner,
  ) {}

  @Intent("file.finalize", { absolute: true, kind: "action" })
  async execute(
    body: Uint8Array,
    headers?: Map<number, Uint8Array>,
  ): Promise<any> {
    const bodyStr = new TextDecoder().decode(body);
    const req = JSON.parse(bodyStr);

    const { fileId, expectedHash } = req;
    if (!fileId) throw new Error("MISSING_FILE_ID");

    const session = await this.sessions.findByFileId(fileId);
    if (!session) throw new Error("SESSION_NOT_FOUND");

    if (!(await this.files.hasTemp(fileId))) {
      throw new Error("CHUNKS_NOT_FOUND");
    }

    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256");
    const rs = this.files.createTempReadStream(fileId);
    for await (const chunk of rs) {
      hash.update(chunk as Buffer);
    }
    const finalHash = hash.digest("hex");

    if (expectedHash && finalHash !== expectedHash) {
      throw new Error("HASH_MISMATCH");
    }

    const finalPath = await this.files.moveTempToFinal(
      fileId,
      session.filename,
    );

    await this.sessions.updateStatus(fileId, "COMPLETE", null);

    if (!this.keyring) {
      this.logger.warn(
        "Receipt signer not configured; returning unsigned receipt",
      );
      return {
        ok: true,
        effect: "FILE_FINALIZED",
        body: new TextEncoder().encode(
          JSON.stringify({
            uploadId: fileId,
            sha256_final: finalHash,
            totalSize: session.totalSize,
            tsMs: Date.now(),
            path: finalPath,
          }),
        ),
      };
    }

    const receiptData = {
      uploadId: fileId,
      sha256_final: finalHash,
      totalSize: session.totalSize,
      tsMs: Date.now(),
    };

    const receiptBody = new TextEncoder().encode(JSON.stringify(receiptData));

    const SIG_PRESENT = 0x01;
    const responseFrame: AxisFrame = {
      flags: SIG_PRESENT,
      headers: new Map(),
      body: receiptBody,
      sig: new Uint8Array(0),
    };

    const signTarget = getSignTarget(responseFrame);
    const { sig, kid } = this.keyring.signActive(signTarget);
    responseFrame.sig = sig;

    return {
      ok: true,
      effect: "FILE_FINALIZED",
      data: encodeFrame(responseFrame),
      headers: new Map([[1, new TextEncoder().encode(kid)]]),
    };
  }
}
