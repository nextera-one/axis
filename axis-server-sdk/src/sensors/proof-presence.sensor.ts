import { Injectable } from '@nestjs/common';

import { Sensor } from '../decorators/sensor.decorator';
import { BAND } from '../engine/sensor-bands';
import {
  ProofPresenceInput,
  ProofPresenceInputZ,
} from '../schemas/axis-schemas';
import { AxisError } from '../core/axis-error';
import { AxisSensor, SensorDecision } from '../sensor/axis-sensor';

@Sensor()
@Injectable()
export class ProofPresenceSensor implements AxisSensor {
  readonly name = 'ProofPresenceSensor';
  readonly order = BAND.IDENTITY + 30;

  supports(input: ProofPresenceInput): boolean {
    return !!input.profile && !!input.visibility;
  }

  async run(input: ProofPresenceInput): Promise<SensorDecision> {
    // Validate input with Zod
    const validatedInput = ProofPresenceInputZ.safeParse(input);
    if (!validatedInput.success) {
      throw new AxisError(
        'SENSOR_INVALID_INPUT',
        `Input validation failed: ${validatedInput.error.message}`,
        400,
      );
    }

    const {
      visibility,
      requiredProof,
      hasCapsule,
      hasPassportSignature,
      profile,
      intent,
    } = validatedInput.data;

    // Public intents don't require proof
    if (visibility === 'PUBLIC') {
      return { action: 'ALLOW' };
    }

    // If NONE is in required proofs, allow without proof
    if (requiredProof.includes('NONE')) {
      return { action: 'ALLOW' };
    }

    // Check if any required proof is satisfied
    const hasCapsuleProof = requiredProof.includes('CAPSULE') && hasCapsule;
    const hasPassportProof =
      requiredProof.includes('PASSPORT') && hasPassportSignature;
    const hasNodeProof = requiredProof.includes('MTLS') && profile === 'NODE';

    const satisfied = hasCapsuleProof || hasPassportProof || hasNodeProof;

    if (!satisfied) {
      throw new AxisError(
        'SENSOR_PROOF_REQUIRED',
        `Proof required for guarded intent: ${intent}`,
        403,
      );
    }

    return { action: 'ALLOW' };
  }
}
