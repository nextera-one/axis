import * as ed from "@noble/ed25519";
import { createPrivateKey, createPublicKey, createSign, generateKeyPairSync, KeyObject } from "crypto";

export interface Signer {
  sign(message: Uint8Array): Promise<Uint8Array>;
  getPublicKey(): Promise<Uint8Array>;
  getAlg(): string;
  exportPublicKeySpki?(): Promise<Uint8Array>;
}

export type P256PrivateKeyInput = KeyObject | JsonWebKey | Uint8Array | string;

export interface P256SignerOptions {
  format?: "pem" | "der" | "jwk";
  type?: "pkcs8" | "sec1";
  dsaEncoding?: "der" | "ieee-p1363";
}

export interface P256KeyPair {
  privateKeyPkcs8Der: Uint8Array;
  publicKeySpkiDer: Uint8Array;
}

export class Ed25519Signer implements Signer {
  constructor(private readonly privateKey: Uint8Array) {
    if (privateKey.length !== 32)
      throw new Error("Private key must be 32 bytes");
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    return ed.signAsync(message, this.privateKey);
  }

  async getPublicKey(): Promise<Uint8Array> {
    return ed.getPublicKeyAsync(this.privateKey);
  }

  getAlg(): string {
    return "ed25519";
  }

  async exportPublicKeySpki(): Promise<Uint8Array> {
    return ed25519PublicKeyToSpki(await this.getPublicKey());
  }
}

export class P256Signer implements Signer {
  private readonly privateKey: KeyObject;
  private readonly dsaEncoding: "der" | "ieee-p1363";

  constructor(
    privateKey: P256PrivateKeyInput,
    options: P256SignerOptions = {},
  ) {
    this.privateKey = toP256PrivateKey(privateKey, options);
    this.dsaEncoding = options.dsaEncoding ?? "der";
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const signer = createSign("SHA256");
    signer.update(Buffer.from(message));
    signer.end();
    return new Uint8Array(
      signer.sign({
        key: this.privateKey,
        dsaEncoding: this.dsaEncoding,
      }),
    );
  }

  async getPublicKey(): Promise<Uint8Array> {
    return this.exportPublicKeySpki();
  }

  getAlg(): string {
    return "p256";
  }

  async exportPublicKeySpki(): Promise<Uint8Array> {
    const publicKey = createPublicKey(this.privateKey);
    return new Uint8Array(publicKey.export({ format: "der", type: "spki" }));
  }
}

export function generateP256KeyPair(): P256KeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  return {
    privateKeyPkcs8Der: new Uint8Array(
      privateKey.export({ format: "der", type: "pkcs8" }),
    ),
    publicKeySpkiDer: new Uint8Array(
      publicKey.export({ format: "der", type: "spki" }),
    ),
  };
}

export async function exportSignerPublicKeySpki(
  signer: Signer,
): Promise<Uint8Array> {
  if (signer.exportPublicKeySpki) {
    return signer.exportPublicKeySpki();
  }

  if (signer.getAlg() === "ed25519") {
    return ed25519PublicKeyToSpki(await signer.getPublicKey());
  }

  return signer.getPublicKey();
}

export async function exportSignerPublicKeySpkiBase64Url(
  signer: Signer,
): Promise<string> {
  const publicKey = await exportSignerPublicKeySpki(signer);
  return toBase64Url(publicKey);
}

export function ed25519PublicKeyToSpki(publicKey: Uint8Array): Uint8Array {
  const prefix = new Uint8Array([
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
  ]);

  const spki = new Uint8Array(prefix.length + publicKey.length);
  spki.set(prefix, 0);
  spki.set(publicKey, prefix.length);
  return spki;
}

function toP256PrivateKey(
  privateKey: P256PrivateKeyInput,
  options: P256SignerOptions,
): KeyObject {
  if (privateKey instanceof KeyObject) {
    return privateKey;
  }

  if (privateKey instanceof Uint8Array) {
    return createPrivateKey({
      key: Buffer.from(privateKey),
      format: options.format ?? "der",
      type: options.type ?? "pkcs8",
    });
  }

  if (typeof privateKey === "string") {
    if (privateKey.includes("BEGIN")) {
      return createPrivateKey({
        key: privateKey,
        format: "pem",
      });
    }

    if ((options.format ?? "pem") === "pem") {
      return createPrivateKey({
        key: privateKey,
        format: "pem",
      });
    }

    return createPrivateKey({
      key: Buffer.from(privateKey, "base64"),
      format: options.format,
      type: options.type ?? "pkcs8",
    });
  }

  return createPrivateKey({
    key: privateKey,
    format: "jwk",
  });
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
