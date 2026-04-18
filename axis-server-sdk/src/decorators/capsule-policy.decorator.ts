import "reflect-metadata";

export const CAPSULE_POLICY_METADATA_KEY = "axis:capsule:policy";

export type CapsuleScopeMode = "all" | "any";

export interface CapsulePolicyOptions {
  required?: boolean;
  scopes?: string | string[];
  scopeMode?: CapsuleScopeMode;
  intentBound?: boolean;
  allowCapsuleRef?: boolean;
}

export function CapsulePolicy(
  options: CapsulePolicyOptions = {},
): ClassDecorator & MethodDecorator {
  const normalized = normalizeCapsulePolicyOptions(options);

  return ((target: object | Function, propertyKey?: string | symbol) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(
        CAPSULE_POLICY_METADATA_KEY,
        normalized,
        target,
        propertyKey,
      );
      return;
    }

    Reflect.defineMetadata(
      CAPSULE_POLICY_METADATA_KEY,
      normalized,
      target as Function,
    );
  }) as ClassDecorator & MethodDecorator;
}

export function normalizeCapsulePolicyOptions(
  options: CapsulePolicyOptions = {},
): CapsulePolicyOptions {
  return {
    required: options.required ?? true,
    scopes: normalizeScopeValue(options.scopes),
    scopeMode: options.scopeMode ?? "all",
    intentBound: options.intentBound ?? true,
    allowCapsuleRef: options.allowCapsuleRef ?? false,
  };
}

export function mergeCapsulePolicyOptions(
  base?: CapsulePolicyOptions,
  override?: CapsulePolicyOptions,
): CapsulePolicyOptions | undefined {
  if (!base && !override) {
    return undefined;
  }

  const normalizedBase = base ? normalizeCapsulePolicyOptions(base) : undefined;
  const normalizedOverride = override
    ? normalizeCapsulePolicyOptions(override)
    : undefined;

  const scopes = [
    ...toScopeList(normalizedBase?.scopes),
    ...toScopeList(normalizedOverride?.scopes),
  ];

  return {
    required: normalizedOverride?.required ?? normalizedBase?.required ?? true,
    scopes: normalizeScopeValue(scopes),
    scopeMode:
      normalizedOverride?.scopeMode ?? normalizedBase?.scopeMode ?? "all",
    intentBound:
      normalizedOverride?.intentBound ??
      normalizedBase?.intentBound ??
      true,
    allowCapsuleRef:
      normalizedOverride?.allowCapsuleRef ??
      normalizedBase?.allowCapsuleRef ??
      false,
  };
}

function normalizeScopeValue(
  value?: string | string[],
): string | string[] | undefined {
  const list = toScopeList(value);
  if (list.length === 0) {
    return undefined;
  }
  return list.length === 1 ? list[0] : list;
}

function toScopeList(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }

  return Array.from(new Set(Array.isArray(value) ? value : [value])).filter(
    (entry) => entry.trim().length > 0,
  );
}