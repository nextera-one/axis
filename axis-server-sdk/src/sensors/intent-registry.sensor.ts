
import { Sensor } from '../decorators/sensor.decorator';
import {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from '../sensor/axis-sensor';
import { IntentRouter } from '../engine/intent.router';
import { BAND } from '../engine/sensor-bands';

/**
 * IntentRegistrySensor
 *
 * Runs early in POST_DECODE to reject intents that have no registered handler.
 * This prevents wasting resources on sensors, decoding, and routing for
 * intents that will inevitably fail with "Intent not found".
 *
 * Order: BAND.IDENTITY + 25 (65) — right after IntentAllowlistSensor (60).
 */
@Sensor({ phase: 'POST_DECODE' })
export class IntentRegistrySensor implements AxisSensor {
  readonly name = 'IntentRegistrySensor';
  readonly order = BAND.IDENTITY + 25;

  constructor(private readonly router: IntentRouter) {}

  supports(input: SensorInput): boolean {
    return !!input.intent;
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const intent = input.intent!;

    if (this.router.has(intent)) {
      return { action: 'ALLOW' };
    }

    return {
      action: 'DENY',
      code: 'INTENT_NOT_REGISTERED',
      reason: `Intent '${intent}' is not registered`,
    };
  }
}
