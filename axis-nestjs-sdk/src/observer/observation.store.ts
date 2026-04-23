import { Inject, Injectable } from "@nestjs/common";
import {
  AxisObservation,
  createObservation,
} from "@nextera.one/axis-server-sdk";
import { ClsService } from "nestjs-cls";

const OBS_KEY = "axis_observation";

/**
 * ObservationStore — CLS-backed per-request observation accessor.
 *
 * Uses `nestjs-cls` to store the current `AxisObservation` so any
 * service in the pipeline (sensors, engine, flush) can access it
 * without parameter threading.
 */
@Injectable()
export class ObservationStore {
  constructor(@Inject(ClsService) private readonly cls: ClsService) {}

  /** Initialize a new observation and store it in CLS. */
  init(transport: "http" | "ws", ip?: string): AxisObservation {
    const obs = createObservation(transport, ip);
    this.cls.set(OBS_KEY, obs);
    return obs;
  }

  /** Get the current observation (undefined if outside CLS or not initialized). */
  get(): AxisObservation | undefined {
    return this.cls.get(OBS_KEY);
  }

  /** Replace the stored observation (used when engine overrides the ID). */
  set(obs: AxisObservation): void {
    this.cls.set(OBS_KEY, obs);
  }
}
