import { Injectable } from "@nestjs/common";
import {
  ProofVerificationService as CoreProofVerificationService,
  type DeviceSEContext,
  type MTLSContext,
  type ProofType,
  type ProofVerificationResult,
} from "@nextera.one/axis-server-sdk";
export type {
  DeviceSEContext,
  MTLSContext,
  ProofType,
  ProofVerificationResult,
};

@Injectable()
export class ProofVerificationService extends CoreProofVerificationService {}
