import { describe, expect, it, vi } from "vitest";

import type { AxisClient } from "../client/axis-client";
import type { IntentResult } from "../client/axis-client";
import {
  approveAxisQrLogin,
  type AxisQrApprovalPayload,
  AxisQrAuthIntents,
  type AxisQrChallengeResponse,
  type AxisQrVerifyResponse,
  buildBrowserProofMessage,
  canonicalizeQrApprovalPayload,
  createAxisQrAttachKeyInput,
  ed25519PublicKeyToSpkiBase64Url,
  initiateAxisQrLogin,
  parseAxisQrBackendPayload,
  rejectAxisQrLogin,
  signBrowserProofMessage,
  signQrApprovalPayload,
  verifyAxisQrLogin,
  waitForAxisQrVerification,
} from "./qr-auth-client";
import {
  ed25519PublicKeyToSpki,
  Ed25519Signer,
  exportSignerPublicKeySpkiBase64Url,
  generateP256KeyPair,
  P256Signer,
} from "../signer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockClient(
  sendImpl: (intent: string, body?: any) => Promise<IntentResult>,
) {
  return { send: sendImpl } as unknown as AxisClient;
}

function makeSigner() {
  const pair = generateP256KeyPair();
  return new P256Signer(pair.privateKeyPkcs8Der);
}

const VALID_BACKEND_PAYLOAD = JSON.stringify({
  v: 1,
  challengeUid: "ch-123",
  tickAuthChallengeUid: "ta-456",
  nonce: "abc",
  origin: "https://example.com",
  tickWindowStart: 1000,
  tickWindowEnd: 2000,
  expiresAt: 9999,
});

// ---------------------------------------------------------------------------
// Intent constants
// ---------------------------------------------------------------------------

describe("AxisQrAuthIntents", () => {
  it("contains the five expected intents", () => {
    expect(AxisQrAuthIntents.CHALLENGE).toBe("axis.auth.qr.challenge");
    expect(AxisQrAuthIntents.ATTACH_KEY).toBe("axis.auth.qr.attach-key");
    expect(AxisQrAuthIntents.APPROVE).toBe("axis.auth.qr.approve");
    expect(AxisQrAuthIntents.REJECT).toBe("axis.auth.qr.reject");
    expect(AxisQrAuthIntents.VERIFY).toBe("axis.auth.qr.verify");
  });
});

// ---------------------------------------------------------------------------
// parseAxisQrBackendPayload
// ---------------------------------------------------------------------------

describe("parseAxisQrBackendPayload", () => {
  it("parses a valid payload", () => {
    const p = parseAxisQrBackendPayload(VALID_BACKEND_PAYLOAD);
    expect(p.challengeUid).toBe("ch-123");
    expect(p.tickAuthChallengeUid).toBe("ta-456");
    expect(p.nonce).toBe("abc");
    expect(p.origin).toBe("https://example.com");
    expect(p.v).toBe(1);
    expect(p.expiresAt).toBe(9999);
  });

  it("defaults optional fields", () => {
    const raw = JSON.stringify({
      challengeUid: "c",
      tickAuthChallengeUid: "t",
      nonce: "n",
      expiresAt: 1,
    });
    const p = parseAxisQrBackendPayload(raw);
    expect(p.v).toBe(1);
    expect(p.origin).toBeNull();
    expect(p.tickWindowStart).toBe(0);
    expect(p.tickWindowEnd).toBe(0);
  });

  it("throws on malformed payload", () => {
    expect(() => parseAxisQrBackendPayload("not json")).toThrow();
    expect(() =>
      parseAxisQrBackendPayload(JSON.stringify({ challengeUid: 123 })),
    ).toThrow("Invalid backend QR payload");
  });
});

// ---------------------------------------------------------------------------
// canonicalizeQrApprovalPayload
// ---------------------------------------------------------------------------

describe("canonicalizeQrApprovalPayload", () => {
  it("produces deterministic sorted JSON", () => {
    const payload: AxisQrApprovalPayload = {
      challengeUid: "ch",
      browserPublicKey: "bpk",
      nonce: "n",
      tickauthChallengeUid: "ta",
      expiresAt: 100,
      actorId: "actor",
      approvedAt: 200,
    };
    const json = canonicalizeQrApprovalPayload(payload);
    const parsed = JSON.parse(json);
    const keys = Object.keys(parsed);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it("handles nested scope array", () => {
    const payload: AxisQrApprovalPayload = {
      challengeUid: "ch",
      browserPublicKey: "bpk",
      nonce: "n",
      tickauthChallengeUid: "ta",
      expiresAt: 100,
      actorId: "actor",
      approvedAt: 200,
      scope: ["read", "write"],
    };
    const json = canonicalizeQrApprovalPayload(payload);
    expect(json).toContain('"scope":["read","write"]');
  });
});

// ---------------------------------------------------------------------------
// buildBrowserProofMessage / signBrowserProofMessage
// ---------------------------------------------------------------------------

describe("buildBrowserProofMessage", () => {
  it("returns the expected proof format", () => {
    const msg = buildBrowserProofMessage("uid-1", "nonce-2");
    const text = new TextDecoder().decode(msg);
    expect(text).toBe("axis-qr-proof:uid-1:nonce-2");
  });
});

describe("signBrowserProofMessage", () => {
  it("returns a base64url-encoded signature", async () => {
    const signer = makeSigner();
    const sig = await signBrowserProofMessage("uid-1", "nonce-2", signer);
    expect(typeof sig).toBe("string");
    expect(sig).not.toContain("+");
    expect(sig).not.toContain("/");
    expect(sig).not.toContain("=");
    expect(sig.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// signQrApprovalPayload
// ---------------------------------------------------------------------------

describe("signQrApprovalPayload", () => {
  it("returns signedPayload and base64url signature", async () => {
    const signer = makeSigner();
    const payload: AxisQrApprovalPayload = {
      challengeUid: "ch",
      browserPublicKey: "bpk",
      nonce: "n",
      tickauthChallengeUid: "ta",
      expiresAt: 100,
      actorId: "actor",
      approvedAt: 200,
    };
    const result = await signQrApprovalPayload(payload, signer);
    expect(typeof result.signedPayload).toBe("string");
    expect(typeof result.signature).toBe("string");

    // signedPayload should be valid JSON with sorted keys
    const parsed = JSON.parse(result.signedPayload);
    expect(Object.keys(parsed)).toEqual(Object.keys(parsed).sort());
  });
});

// ---------------------------------------------------------------------------
// createAxisQrAttachKeyInput
// ---------------------------------------------------------------------------

describe("createAxisQrAttachKeyInput", () => {
  it("builds attach-key input with signer metadata", async () => {
    const signer = makeSigner();
    const input = await createAxisQrAttachKeyInput(
      "ch-abc",
      "nonce-xyz",
      signer,
      true,
    );
    expect(input.challengeUid).toBe("ch-abc");
    expect(input.browserKeyAlgorithm).toBe("p256");
    expect(typeof input.browserPublicKey).toBe("string");
    expect(typeof input.browserProofSignature).toBe("string");
    expect(input.trustDeviceRequested).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ed25519PublicKeyToSpkiBase64Url
// ---------------------------------------------------------------------------

describe("ed25519PublicKeyToSpkiBase64Url", () => {
  it("returns a base64url-encoded SPKI", () => {
    const raw = new Uint8Array(32).fill(0xaa);
    const b64 = ed25519PublicKeyToSpkiBase64Url(raw);
    expect(typeof b64).toBe("string");
    expect(b64).not.toContain("+");
    expect(b64).not.toContain("/");
    expect(b64).not.toContain("=");
  });
});

// ---------------------------------------------------------------------------
// High-level orchestration — initiateAxisQrLogin
// ---------------------------------------------------------------------------

describe("initiateAxisQrLogin", () => {
  it("calls challenge then attach-key and returns parsed QR payload", async () => {
    const signer = makeSigner();
    const challengeResponse: AxisQrChallengeResponse = {
      ok: true,
      challengeUid: "ch-999",
      nonce: "nonce-111",
      expiresAt: 99999,
      qrPayload: VALID_BACKEND_PAYLOAD,
    };

    const calls: Array<{ intent: string; body: any }> = [];
    const client = mockClient(async (intent, body) => {
      calls.push({ intent, body });
      if (intent === AxisQrAuthIntents.CHALLENGE) {
        return { ok: true, data: challengeResponse };
      }
      return { ok: true, data: { ok: true } };
    });

    const result = await initiateAxisQrLogin(client, signer, {
      origin: "https://test.com",
    });

    expect(calls.length).toBe(2);
    expect(calls[0].intent).toBe("axis.auth.qr.challenge");
    expect(calls[1].intent).toBe("axis.auth.qr.attach-key");
    expect(result.challenge.challengeUid).toBe("ch-999");
    expect(result.qr.challengeUid).toBe("ch-123"); // from parsed backend payload
    expect(typeof result.browserPublicKey).toBe("string");
    expect(typeof result.browserProofSignature).toBe("string");
  });

  it("throws when challenge fails", async () => {
    const signer = makeSigner();
    const client = mockClient(async () => ({
      ok: false,
      error: "server down",
    }));

    await expect(initiateAxisQrLogin(client, signer)).rejects.toThrow(
      "server down",
    );
  });
});

// ---------------------------------------------------------------------------
// approveAxisQrLogin
// ---------------------------------------------------------------------------

describe("approveAxisQrLogin", () => {
  it("signs the payload and calls approve intent", async () => {
    const signer = makeSigner();
    const calls: Array<{ intent: string; body: any }> = [];
    const client = mockClient(async (intent, body) => {
      calls.push({ intent, body });
      return { ok: true, data: { approved: true } };
    });

    const result = await approveAxisQrLogin(client, {
      challengeUid: "ch-1",
      browserPublicKey: "bpk",
      nonce: "n",
      tickAuthChallengeUid: "ta-1",
      expiresAt: 5000,
      actorId: "actor-1",
      mobileDeviceUid: "dev-1",
      signer,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].intent).toBe("axis.auth.qr.approve");
    expect(typeof result.signedPayload).toBe("string");
    expect(typeof result.signature).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// rejectAxisQrLogin
// ---------------------------------------------------------------------------

describe("rejectAxisQrLogin", () => {
  it("calls reject intent", async () => {
    const calls: string[] = [];
    const client = mockClient(async (intent) => {
      calls.push(intent);
      return { ok: true, data: {} };
    });

    await rejectAxisQrLogin(client, {
      challengeUid: "ch-r",
      actorId: "actor-r",
    });
    expect(calls).toEqual(["axis.auth.qr.reject"]);
  });

  it("throws on failure", async () => {
    const client = mockClient(async () => ({
      ok: false,
      error: "not found",
    }));
    await expect(
      rejectAxisQrLogin(client, { challengeUid: "x", actorId: "y" }),
    ).rejects.toThrow("not found");
  });
});

// ---------------------------------------------------------------------------
// verifyAxisQrLogin
// ---------------------------------------------------------------------------

describe("verifyAxisQrLogin", () => {
  it("returns verified response", async () => {
    const verified: AxisQrVerifyResponse = {
      ok: true,
      status: "verified",
      actorId: "a",
      deviceId: "d",
      sessionUid: "s",
      capsuleId: "c",
      capsuleBytes: null,
      intentSecret: "sec",
      expiresAt: 9999,
    };
    const client = mockClient(async () => ({ ok: true, data: verified }));
    const res = await verifyAxisQrLogin(client, {
      challengeUid: "ch",
      browserPublicKey: "bpk",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe("verified");
      expect(res.actorId).toBe("a");
    }
  });

  it("returns pending response", async () => {
    const pending: AxisQrVerifyResponse = { ok: false, status: "pending" };
    const client = mockClient(async () => ({ ok: true, data: pending }));
    const res = await verifyAxisQrLogin(client, {
      challengeUid: "ch",
      browserPublicKey: "bpk",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// waitForAxisQrVerification
// ---------------------------------------------------------------------------

describe("waitForAxisQrVerification", () => {
  it("resolves on verified after polling", async () => {
    let callCount = 0;
    const verified: AxisQrVerifyResponse = {
      ok: true,
      status: "verified",
      actorId: "a",
      deviceId: "d",
      sessionUid: "s",
      capsuleId: "c",
      capsuleBytes: null,
      intentSecret: "sec",
      expiresAt: 9999,
    };
    const client = mockClient(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: true,
          data: { ok: false, status: "pending" } as AxisQrVerifyResponse,
        };
      }
      return { ok: true, data: verified };
    });

    const res = await waitForAxisQrVerification(client, {
      challengeUid: "ch",
      browserPublicKey: "bpk",
      pollIntervalMs: 10,
      timeoutMs: 5000,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("verified");
    expect(callCount).toBe(3);
  });

  it("throws on expired", async () => {
    const client = mockClient(async () => ({
      ok: true,
      data: { ok: false, status: "expired" } as AxisQrVerifyResponse,
    }));

    await expect(
      waitForAxisQrVerification(client, {
        challengeUid: "ch",
        browserPublicKey: "bpk",
        pollIntervalMs: 10,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("QR challenge expired");
  });

  it("throws on rejected", async () => {
    const client = mockClient(async () => ({
      ok: true,
      data: { ok: false, status: "rejected" } as AxisQrVerifyResponse,
    }));

    await expect(
      waitForAxisQrVerification(client, {
        challengeUid: "ch",
        browserPublicKey: "bpk",
        pollIntervalMs: 10,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("QR challenge rejected");
  });

  it("throws on timeout", async () => {
    const client = mockClient(async () => ({
      ok: true,
      data: { ok: false, status: "pending" } as AxisQrVerifyResponse,
    }));

    await expect(
      waitForAxisQrVerification(client, {
        challengeUid: "ch",
        browserPublicKey: "bpk",
        pollIntervalMs: 10,
        timeoutMs: 50,
      }),
    ).rejects.toThrow("Timed out");
  });
});
