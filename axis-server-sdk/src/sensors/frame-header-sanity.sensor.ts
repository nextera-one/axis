import { Injectable } from '@nestjs/common';

import { Sensor } from '../decorators/sensor.decorator';
import { AXIS_MAGIC, AXIS_VERSION, MAX_FRAME_LEN } from '../core/constants';
import { BAND } from '../engine/sensor-bands';
import { AxisSensor, SensorDecision, SensorInput } from '../sensor/axis-sensor';

@Injectable()
@Sensor({ phase: 'PRE_DECODE' })
export class FrameHeaderSanitySensor implements AxisSensor {
  readonly name = 'FrameHeaderSanitySensor';
  readonly order = BAND.WIRE + 30;

  supports(input: SensorInput): boolean {
    return !!input.peek && input.peek.length >= 7;
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const peek = input.peek!;
    const contentLen = input.contentLength || 0;

    // Check magic (first 5 bytes: AXIS1)
    if (peek.length < 5 || !this.bufferEqual(peek.slice(0, 5), AXIS_MAGIC)) {
      return {
        action: 'DENY',
        code: 'INVALID_MAGIC',
        reason: 'Frame magic is not AXIS1',
      };
    }

    // Check version (byte 5)
    if (peek[5] !== AXIS_VERSION) {
      return {
        action: 'DENY',
        code: 'UNSUPPORTED_VERSION',
        reason: `Unsupported version: ${peek[5]}`,
      };
    }

    // Check frame length against hard limit
    if (contentLen > MAX_FRAME_LEN) {
      return {
        action: 'DENY',
        code: 'FRAME_TOO_LARGE',
        reason: `Frame size ${contentLen} exceeds max ${MAX_FRAME_LEN}`,
      };
    }

    return { action: 'ALLOW' };
  }

  private bufferEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
