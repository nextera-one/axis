
import { Sensor } from '../decorators/sensor.decorator';
import { BAND } from '../engine/sensor-bands';
import { AxisSensor, SensorDecision, SensorInput } from '../sensor/axis-sensor';

// Public intent allowlist (exact or prefix)
const PUBLIC_INTENT_ALLOWLIST = [
  'public.',
  'schema.',
  'catalog.',
  'health.',
  'system.',
];

@Sensor()
export class IntentAllowlistSensor implements AxisSensor {
  readonly name = 'IntentAllowlistSensor';
  readonly order = BAND.IDENTITY + 20;

  supports(input: SensorInput): boolean {
    // Only run in post-decode phase when intent is available
    return !!input.intent;
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const profile = input.metadata?.profile || 'PUBLIC';
    const intent = input.intent || '';

    // PUBLIC profile: only allow whitelisted intents
    if (profile === 'PUBLIC') {
      const isAllowed = PUBLIC_INTENT_ALLOWLIST.some((prefix) =>
        intent.startsWith(prefix),
      );
      if (!isAllowed) {
        return {
          action: 'DENY',
          code: 'INTENT_NOT_ALLOWED',
          reason: `Intent '${intent}' not in public allowlist`,
        };
      }
    }

    // GUARDED profile: allow all intents (capability enforcement comes later)
    return { action: 'ALLOW' };
  }
}
