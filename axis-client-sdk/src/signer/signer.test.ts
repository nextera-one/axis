import * as ed from "@noble/ed25519";
import { createPublicKey, createVerify, generateKeyPairSync } from "crypto";
import { describe, expect, it } from "vitest";

import { ed25519PublicKeyToSpki, Ed25519Signer, exportSignerPublicKeySpki, exportSignerPublicKeySpkiBase64Url, generateP256KeyPair, P256Signer } from "./index";

describe("P256Signer", () => {
  const { privateKeyPkcs8Der, publicKeySpkiDer } = generateP256KeyPair();

  it("signs and verifies a message with DER key input", async () => {
    const signer = new P256Signer(privateKeyPkcs8Der);
    const message = new TextEncoder().encode("hello axis");
    const sig = await signer.sign(message);

    const pubKey = createPublicKey({
      key: Buffer.from(publicKeySpkiDer),
      format: "der",
      type: "spki",
    });
    const verifier = createVerify("SHA256");
    verifier.update(Buffer.from(message));
    verifier.end();
    expect(verifier.verify(pubKey, Buffer.from(sig))).toBe(true);
  });

  it("signs and verifies with ieee-p1363 encoding", async () => {
    const signer = new P256Signer(privateKeyPkcs8Der, {
      dsaEncoding: "ieee-p1363",
    });
    const message = new TextEncoder().encode("p1363 test");
    const sig = await signer.sign(message);

    // ieee-p1363 signature for P-256 is always 64 bytes (r || s)
    expect(sig.length).toBe(64);
  });

  it("returns alg p256", () => {
    const signer = new P256Signer(privateKeyPkcs8Der);
    expect(signer.getAlg()).toBe("p256");
  });

  it("exports SPKI public key", async () => {
    const signer = new P256Signer(privateKeyPkcs8Der);
    const spki = await signer.exportPublicKeySpki();
    expect(spki).toBeInstanceOf(Uint8Array);
    expect(spki).toEqual(publicKeySpkiDer);
  });

  it("getPublicKey returns SPKI", async () => {
    const signer = new P256Signer(privateKeyPkcs8Der);
    const pub = await signer.getPublicKey();
    expect(pub).toEqual(publicKeySpkiDer);
  });

  it("accepts a PEM string key", () => {
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const signer = new P256Signer(pem);
    expect(signer.getAlg()).toBe("p256");
  });

  it("accepts a KeyObject", () => {
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const signer = new P256Signer(privateKey);
    expect(signer.getAlg()).toBe("p256");
  });

  it("accepts a JWK", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const jwk = privateKey.export({ format: "jwk" });
    const signer = new P256Signer(jwk);
    const message = new TextEncoder().encode("jwk test");
    const sig = await signer.sign(message);
    expect(sig.length).toBeGreaterThan(0);

    // Verify
    const verifier = createVerify("SHA256");
    verifier.update(Buffer.from(message));
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(sig))).toBe(true);
  });
});

describe("generateP256KeyPair", () => {
  it("returns DER-encoded private and public keys", () => {
    const pair = generateP256KeyPair();
    expect(pair.privateKeyPkcs8Der).toBeInstanceOf(Uint8Array);
    expect(pair.publicKeySpkiDer).toBeInstanceOf(Uint8Array);
    expect(pair.privateKeyPkcs8Der.length).toBeGreaterThan(0);
    expect(pair.publicKeySpkiDer.length).toBeGreaterThan(0);
  });

  it("generates unique key pairs", () => {
    const a = generateP256KeyPair();
    const b = generateP256KeyPair();
    expect(
      Buffer.from(a.privateKeyPkcs8Der).equals(
        Buffer.from(b.privateKeyPkcs8Der),
      ),
    ).toBe(false);
  });

  it("round-trips through P256Signer", async () => {
    const pair = generateP256KeyPair();
    const signer = new P256Signer(pair.privateKeyPkcs8Der);
    const spki = await signer.exportPublicKeySpki();
    expect(spki).toEqual(pair.publicKeySpkiDer);
  });
});

describe("ed25519PublicKeyToSpki", () => {
  it("wraps a 32-byte key in the SPKI prefix", () => {
    const raw = new Uint8Array(32).fill(0xab);
    const spki = ed25519PublicKeyToSpki(raw);
    // Prefix is 12 bytes
    expect(spki.length).toBe(44);
    // First bytes are the Ed25519 OID header
    expect(spki[0]).toBe(0x30);
    expect(spki[1]).toBe(0x2a);
    // Tail is the raw key
    expect(spki.slice(12)).toEqual(raw);
  });
});

describe("exportSignerPublicKeySpki", () => {
  it("uses exportPublicKeySpki when available (P256)", async () => {
    const pair = generateP256KeyPair();
    const signer = new P256Signer(pair.privateKeyPkcs8Der);
    const spki = await exportSignerPublicKeySpki(signer);
    expect(spki).toEqual(pair.publicKeySpkiDer);
  });

  it("wraps Ed25519 raw key in SPKI automatically", async () => {
    const privKey = new Uint8Array(32);
    // deterministic seed for testing
    privKey.fill(0x42);
    const signer = new Ed25519Signer(privKey);
    const spki = await exportSignerPublicKeySpki(signer);
    const rawPub = await ed.getPublicKeyAsync(privKey);
    const expected = ed25519PublicKeyToSpki(rawPub);
    expect(spki).toEqual(expected);
  });
});

describe("exportSignerPublicKeySpkiBase64Url", () => {
  it("returns a base64url string without padding", async () => {
    const pair = generateP256KeyPair();
    const signer = new P256Signer(pair.privateKeyPkcs8Der);
    const b64 = await exportSignerPublicKeySpkiBase64Url(signer);
    expect(typeof b64).toBe("string");
    expect(b64).not.toContain("+");
    expect(b64).not.toContain("/");
    expect(b64).not.toContain("=");
  });
});
