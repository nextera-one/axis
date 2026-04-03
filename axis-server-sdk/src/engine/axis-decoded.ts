import type { Axis1DecodedFrame } from '../types/frame';
import type { AxisPacket as AxisBinaryPacket } from '../types/packet';
import type { AxisContext } from '../schemas/axis-schemas';
import type { SensorInput } from '../sensor/axis-sensor';
import type { AxisObservation } from './axis-observation';

export interface AxisDecoded {
  frame: Axis1DecodedFrame;
  packet: AxisBinaryPacket;
  axisCtx: AxisContext;
  correlationId: Buffer;
  correlationIdHex: string;
  sensorInput: SensorInput;
  extra: { ip?: string; demoPubkeyHex?: string };
  observation: AxisObservation;
}
