
import { Sensor } from '../decorators/sensor.decorator';
import { BAND } from '../engine/sensor-bands';
import { AxisSensor, SensorDecision } from '../sensor/axis-sensor';

@Sensor()
export class ReceiptPolicySensor implements AxisSensor {
  readonly name = 'ReceiptPolicySensor';
  readonly order = BAND.BUSINESS + 20;

  supports(): boolean {
    return true;
  }

  async run(): Promise<SensorDecision> {
    // Stub: allow. Real impl defines which intents must yield signed receipts.
    return { action: 'ALLOW' };
  }
}
