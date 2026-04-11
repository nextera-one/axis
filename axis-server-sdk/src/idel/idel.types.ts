/**
 * IDEL Types — Intent Description & Execution Language
 *
 * IDEL is the structured cognition layer that sits above AXIS execution.
 * It transforms intent proposals into validated, executable structures.
 *
 * IDEL answers: "What does the actor want to do, and is it well-formed?"
 * AXIS answers: "Execute it."
 * TickAuth answers: "Is it allowed?"
 */

// ────────────────────────────────────────────────────────────────────────────
// Intent Proposal (raw input before compilation)
// ────────────────────────────────────────────────────────────────────────────

export interface IntentProposal {
  /** Raw intent name or free-text description */
  raw: string;
  /** Actor proposing the intent */
  actor_id: string;
  /** Optional explicit target */
  target?: string;
  /** Optional raw parameters */
  params?: Record<string, unknown>;
  /** Optional context (environment, device, location) */
  context?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Compiled Intent (output of IDEL compilation)
// ────────────────────────────────────────────────────────────────────────────

export interface CompiledIntent {
  /** Resolved intent name (dot notation) */
  intent: string;
  /** Actor */
  actor_id: string;
  /** Target resource or entity */
  target?: string;
  /** Validated and normalized parameters */
  params: Record<string, unknown>;
  /** Extracted constraints */
  constraints: IntentConstraint[];
  /** Confidence that the compilation is correct (0.0 – 1.0) */
  confidence: number;
  /** Alternative interpretations (if ambiguous) */
  alternatives: AlternativeIntent[];
  /** Whether the intent requires clarification before execution */
  needs_clarification: boolean;
  /** Clarification questions (if needs_clarification is true) */
  clarifications: ClarificationQuestion[];
  /** Expected outcome description */
  expected_outcome?: string;
  /** Fallback intent if this one fails */
  fallback?: string;
  /** Risk assessment */
  risk: IntentRisk;
  /** Metadata from compilation */
  metadata: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Constraints
// ────────────────────────────────────────────────────────────────────────────

export type ConstraintKind =
  | 'required_param'
  | 'type_check'
  | 'range'
  | 'pattern'
  | 'temporal'
  | 'spatial'
  | 'authority'
  | 'safety'
  | 'custom';

export interface IntentConstraint {
  kind: ConstraintKind;
  field: string;
  description: string;
  satisfied: boolean;
  value?: unknown;
  expected?: unknown;
}

// ────────────────────────────────────────────────────────────────────────────
// Alternatives and Clarification
// ────────────────────────────────────────────────────────────────────────────

export interface AlternativeIntent {
  intent: string;
  confidence: number;
  reason: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  field: string;
  options?: string[];
  required: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Risk
// ────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface IntentRisk {
  level: RiskLevel;
  score: number; // 0.0 – 1.0
  factors: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Intent Schema (definition of what intents exist and their requirements)
// ────────────────────────────────────────────────────────────────────────────

export interface IntentParamSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  default?: unknown;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: unknown[];
}

export interface IntentSchema {
  intent: string;
  description: string;
  params: IntentParamSchema[];
  /** Required authority / scope */
  required_scopes?: string[];
  /** Risk level of this intent */
  risk_level: RiskLevel;
  /** Whether the intent has side effects */
  has_side_effects: boolean;
  /** Whether this intent is reversible */
  reversible: boolean;
  /** Related intents */
  related?: string[];
  /** Tags for categorization */
  tags?: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Compilation Result
// ────────────────────────────────────────────────────────────────────────────

export interface CompilationResult {
  ok: boolean;
  compiled?: CompiledIntent;
  errors: CompilationError[];
}

export interface CompilationError {
  code: string;
  message: string;
  field?: string;
}
