/**
 * AXIS Intent Catalog Types
 * Protocol-level intent metadata definitions.
 */

export interface IntentDefinition {
  intent: string;
  description: string;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredProof: string[];
  contract: {
    maxDbWrites: number;
    maxTimeMs: number;
  };
  examples?: string[];
  deprecated?: boolean;
}
