import 'reflect-metadata';

export const INTENT_BODY_KEY = 'axis:intent:body';

/**
 * @IntentBody — Auto-decode the raw Uint8Array body before the handler runs.
 *
 * The router reads this metadata and applies the decoder so handlers can
 * receive a parsed payload instead of raw bytes.
 */
export function IntentBody(decoder: (buf: Buffer) => any): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(INTENT_BODY_KEY, decoder, target, propertyKey);
  };
}
