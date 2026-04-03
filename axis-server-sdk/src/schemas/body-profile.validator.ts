import { Injectable, Logger } from '@nestjs/common';

import { decodeTLVsList } from '../core/tlv';

/**
 * Body Profile Types
 */
export enum BodyProfile {
  RAW = 0, // Raw binary (no structure)
  TLV_MAP = 1, // Flat TLV map (type -> value)
  OBJ = 2, // Nested object (OBJ TLVs)
  ARR = 3, // Array (ARR TLVs)
}

export interface BodyProfileValidation {
  valid: boolean;
  error?: string;
  profile: BodyProfile;
}

/**
 * Validates AXIS frame body against declared body profile
 */
@Injectable()
export class BodyProfileValidator {
  private readonly logger = new Logger(BodyProfileValidator.name);

  /**
   * Validate body matches declared profile
   */
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

  /**
   * RAW profile - no validation, any bytes accepted
   */
  private validateRaw(body: Uint8Array): BodyProfileValidation {
    return {
      valid: true,
      profile: BodyProfile.RAW,
    };
  }

  /**
   * TLV_MAP profile - flat TLV list (no nested structures)
   */
  private validateTlvMap(body: Uint8Array): BodyProfileValidation {
    try {
      const tlvs = decodeTLVsList(body);

      // Check no nested structures (OBJ or ARR types)
      for (const tlv of tlvs) {
        if (tlv.type === 254 || tlv.type === 255) {
          return {
            valid: false,
            error: 'TLV_MAP profile cannot contain nested OBJ/ARR types',
            profile: BodyProfile.TLV_MAP,
          };
        }
      }

      return {
        valid: true,
        profile: BodyProfile.TLV_MAP,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        error: `TLV_MAP decode failed: ${message}`,
        profile: BodyProfile.TLV_MAP,
      };
    }
  }

  /**
   * OBJ profile - must be valid nested object
   */
  private validateObj(body: Uint8Array): BodyProfileValidation {
    try {
      const tlvs = decodeTLVsList(body);

      // Must contain at least one OBJ type (254)
      const hasObj = tlvs.some((t) => t.type === 254);
      if (!hasObj && tlvs.length > 0) {
        return {
          valid: false,
          error: 'OBJ profile must contain OBJ type (254)',
          profile: BodyProfile.OBJ,
        };
      }

      return {
        valid: true,
        profile: BodyProfile.OBJ,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        error: `OBJ decode failed: ${message}`,
        profile: BodyProfile.OBJ,
      };
    }
  }

  /**
   * ARR profile - must be valid array
   */
  private validateArr(body: Uint8Array): BodyProfileValidation {
    try {
      const tlvs = decodeTLVsList(body);

      // Must contain at least one ARR type (255)
      const hasArr = tlvs.some((t) => t.type === 255);
      if (!hasArr && tlvs.length > 0) {
        return {
          valid: false,
          error: 'ARR profile must contain ARR type (255)',
          profile: BodyProfile.ARR,
        };
      }

      return {
        valid: true,
        profile: BodyProfile.ARR,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        error: `ARR decode failed: ${message}`,
        profile: BodyProfile.ARR,
      };
    }
  }
}
