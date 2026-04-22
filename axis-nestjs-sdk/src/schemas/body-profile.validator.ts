import { Injectable } from "@nestjs/common";
import {
  BodyProfile,
  BodyProfileValidator as CoreBodyProfileValidator,
  type BodyProfileValidation,
} from "@nextera.one/axis-server-sdk";

export { BodyProfile };
export type { BodyProfileValidation };

@Injectable()
export class BodyProfileValidator extends CoreBodyProfileValidator {}
