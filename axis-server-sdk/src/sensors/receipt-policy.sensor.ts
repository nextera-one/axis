
import { Sensor } from '../decorators/sensor.decorator';
import { BAND } from '../engine/sensor-bands';
import { AxisSensor, SensorDecision } from '../sensor/axis-sensor';

@Sensor()
export class ReceiptPolicySensor implements AxisSensor {
  readonly name = 'ReceiptPolicySensor';
  readonly order = BAND.BUSINESS + 20;

  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(): boolean {
    return true;
  }

  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(): Promise<SensorDecision> {
    // Stub: allow. Real impl defines which intents must yield signed receipts.
    return { action: 'ALLOW' };
  }
}
