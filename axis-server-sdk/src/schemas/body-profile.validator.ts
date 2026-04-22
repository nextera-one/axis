import { decodeTLVsList } from "../core/tlv";

export enum BodyProfile {
  RAW = 0,
  TLV_MAP = 1,
  OBJ = 2,
  ARR = 3,
}

export interface BodyProfileValidation {
  valid: boolean;
  error?: string;
  profile: BodyProfile;
}

/**
 * Validates AXIS frame body against declared body profile.
 */
export class BodyProfileValidator {
  validate(body: Uint8Array, profile: BodyProfile): BodyProfileValidation {
    switch (profile) {
      case BodyProfile.RAW:
        return this.validateRaw(body);
      case BodyProfile.TLV_MAP:
        return this.validateTlvMap(body);
      case BodyProfile.OBJ:
        return this.validateObj(body);
      case BodyProfile.ARR:
        return this.validateArr(body);
      default:
        return {
          valid: false,
          error: `Unknown body profile: ${profile}`,
          profile,
        };
    }
  }

  private validateRaw(_body: Uint8Array): BodyProfileValidation {
    return { valid: true, profile: BodyProfile.RAW };
  }

  private validateTlvMap(body: Uint8Array): BodyProfileValidation {
    try {
      const tlvs = decodeTLVsList(body);
      for (const tlv of tlvs) {
        if (tlv.type === 254 || tlv.type === 255) {
          return {
            valid: false,
            error: "TLV_MAP profile cannot contain nested OBJ/ARR types",
            profile: BodyProfile.TLV_MAP,
          };
        }
      }
      return { valid: true, profile: BodyProfile.TLV_MAP };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        valid: false,
        error: `TLV_MAP decode failed: ${message}`,
        profile: BodyProfile.TLV_MAP,
      };
    }
  }

  private validateObj(body: Uint8Array): BodyProfileValidation {
    try {
      const tlvs = decodeTLVsList(body);
      const hasObj = tlvs.some((t) => t.type === 254);
      if (!hasObj && tlvs.length > 0) {
        return {
          valid: false,
          error: "OBJ profile must contain OBJ type (254)",
          profile: BodyProfile.OBJ,
        };
      }
      return { valid: true, profile: BodyProfile.OBJ };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        valid: false,
        error: `OBJ decode failed: ${message}`,
        profile: BodyProfile.OBJ,
      };
    }
  }

  private validateArr(body: Uint8Array): BodyProfileValidation {
    try {
      const tlvs = decodeTLVsList(body);
      const hasArr = tlvs.some((t) => t.type === 255);
      if (!hasArr && tlvs.length > 0) {
        return {
          valid: false,
          error: "ARR profile must contain ARR type (255)",
          profile: BodyProfile.ARR,
        };
      }
      return { valid: true, profile: BodyProfile.ARR };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        valid: false,
        error: `ARR decode failed: ${message}`,
        profile: BodyProfile.ARR,
      };
    }
  }
}
