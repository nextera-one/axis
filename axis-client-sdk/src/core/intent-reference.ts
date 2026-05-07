export const HANDLER_INTENT_SEPARATOR = '...';

export interface AxisIntentReference {
  handlerName?: string;
  intent: string;
}

export function buildIntentReference(
  intent: string,
  handlerName?: string,
): string {
  const normalizedIntent = normalizeIntentPart(intent, 'Intent');
  const normalizedHandlerName = handlerName?.trim();

  if (!normalizedHandlerName) {
    return normalizedIntent;
  }

  if (normalizedIntent.includes(HANDLER_INTENT_SEPARATOR)) {
    return normalizedIntent;
  }

  return `${normalizedHandlerName}${HANDLER_INTENT_SEPARATOR}${normalizedIntent}`;
}

export function parseIntentReference(value: string): AxisIntentReference {
  const normalized = normalizeIntentPart(value, 'Intent reference');
  const separatorIndex = normalized.indexOf(HANDLER_INTENT_SEPARATOR);

  if (
    separatorIndex <= 0 ||
    separatorIndex + HANDLER_INTENT_SEPARATOR.length >= normalized.length
  ) {
    return { intent: normalized };
  }

  return {
    handlerName: normalized.slice(0, separatorIndex),
    intent: normalized.slice(separatorIndex + HANDLER_INTENT_SEPARATOR.length),
  };
}

function normalizeIntentPart(value: string, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty`);
  }

  return normalized;
}
