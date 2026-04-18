import { hasScope } from "./scopes";

export interface InlineCapsuleClaims {
  id?: string;
  actorId?: string;
  intents?: string[];
  issuedAt?: bigint;
  expiresAt?: bigint;
  realm?: string;
  node?: string;
  scopes?: string[];
  raw: Record<string, unknown>;
}

export function normalizeInlineCapsule(
  input: unknown,
): InlineCapsuleClaims | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const scopes = normalizeStringList(raw.scopes ?? raw.scope);

  return {
    id: normalizeScalar(raw.id),
    actorId: normalizeScalar(raw.actorId),
    intents: normalizeStringList(raw.intents),
    issuedAt: normalizeTimestamp(raw.issuedAt ?? raw.iat),
    expiresAt: normalizeTimestamp(raw.expiresAt ?? raw.exp),
    realm: normalizeScalar(raw.realm),
    node: normalizeScalar(raw.node),
    scopes,
    raw,
  };
}

export function inlineCapsuleAllowsIntent(
  capsule: InlineCapsuleClaims,
  intent: string,
): boolean {
  if (!capsule.intents || capsule.intents.length === 0) {
    return false;
  }

  for (const pattern of capsule.intents) {
    if (pattern === "*" || pattern === intent) {
      return true;
    }

    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -1);
      if (intent.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

export function isInlineCapsuleExpired(
  capsule: InlineCapsuleClaims,
  clockSkewMs = 30000,
): boolean {
  if (capsule.expiresAt === undefined) {
    return false;
  }

  return BigInt(Date.now()) > capsule.expiresAt + BigInt(clockSkewMs);
}

export function resolvePolicyScopes(
  scopes: string[],
  context: {
    body?: unknown;
    intent: string;
    actorId?: string;
    chainId?: string;
    stepId?: string;
  },
): string[] {
  return scopes.map((scope) =>
    scope.replace(/\$\{([^}]+)\}/g, (_match, expression: string) => {
      const resolved = resolveTemplateExpression(expression.trim(), context);
      if (resolved === undefined || resolved === null || resolved === "") {
        throw new Error(`CAPSULE_SCOPE_TEMPLATE_UNRESOLVED:${expression}`);
      }
      return String(resolved);
    }),
  );
}

export function inlineCapsuleSatisfiesScopes(
  capsule: InlineCapsuleClaims,
  requiredScopes: string[],
  mode: "all" | "any" = "all",
): boolean {
  if (!capsule.scopes || capsule.scopes.length === 0) {
    return false;
  }

  if (mode === "any") {
    return requiredScopes.some((scope) => hasScope(capsule.scopes!, scope));
  }

  return requiredScopes.every((scope) => hasScope(capsule.scopes!, scope));
}

function resolveTemplateExpression(
  expression: string,
  context: {
    body?: unknown;
    intent: string;
    actorId?: string;
    chainId?: string;
    stepId?: string;
  },
): unknown {
  if (expression === "intent") {
    return context.intent;
  }

  if (expression === "actorId") {
    return context.actorId;
  }

  if (expression === "chainId") {
    return context.chainId;
  }

  if (expression === "stepId") {
    return context.stepId;
  }

  if (expression.startsWith("body.")) {
    return getNestedValue(context.body, expression.slice(5));
  }

  return undefined;
}

function getNestedValue(value: unknown, path: string): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function normalizeScalar(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }

  return undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const list = Array.isArray(value) ? value : [value];
  const normalized = list
    .map((entry) => (typeof entry === "string" ? entry : undefined))
    .filter((entry): entry is string => !!entry && entry.trim().length > 0);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function normalizeTimestamp(value: unknown): bigint | undefined {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}