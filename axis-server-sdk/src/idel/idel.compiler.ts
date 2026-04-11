/**
 * IDEL Compiler — Intent Description & Execution Language
 *
 * Compiles raw intent proposals into validated, executable structures.
 *
 * Pipeline:
 *   1. Resolve: match raw input to a known intent schema
 *   2. Validate: check all required params and constraints
 *   3. Assess risk: evaluate intent risk level
 *   4. Generate clarifications: if ambiguous or incomplete
 *   5. Output: CompiledIntent ready for AXIS execution
 */

import type {
  AlternativeIntent,
  ClarificationQuestion,
  CompilationError,
  CompilationResult,
  CompiledIntent,
  IntentConstraint,
  IntentParamSchema,
  IntentProposal,
  IntentRisk,
  IntentSchema,
  RiskLevel,
} from './idel.types';

// ────────────────────────────────────────────────────────────────────────────
// Schema Registry
// ────────────────────────────────────────────────────────────────────────────

export class IdelSchemaRegistry {
  private schemas = new Map<string, IntentSchema>();
  private aliases = new Map<string, string>();

  register(schema: IntentSchema): void {
    this.schemas.set(schema.intent, schema);
  }

  registerAlias(alias: string, intent: string): void {
    this.aliases.set(alias.toLowerCase(), intent);
  }

  get(intent: string): IntentSchema | undefined {
    return this.schemas.get(intent);
  }

  resolve(raw: string): IntentSchema | undefined {
    // Exact match
    const exact = this.schemas.get(raw);
    if (exact) return exact;

    // Alias match
    const aliased = this.aliases.get(raw.toLowerCase());
    if (aliased) return this.schemas.get(aliased);

    // Prefix match (e.g., "payment" → "payment.create")
    const candidates = [...this.schemas.keys()].filter(
      (k) => k.startsWith(raw + '.') || k.toLowerCase().includes(raw.toLowerCase()),
    );
    if (candidates.length === 1) {
      return this.schemas.get(candidates[0]);
    }

    return undefined;
  }

  /**
   * Find all schemas that partially match the raw input.
   * Returns scored candidates for ambiguity resolution.
   */
  findCandidates(raw: string): Array<{ schema: IntentSchema; score: number }> {
    const normalized = raw.toLowerCase().trim();
    const results: Array<{ schema: IntentSchema; score: number }> = [];

    for (const [key, schema] of this.schemas) {
      let score = 0;

      // Exact match
      if (key === raw) {
        score = 1.0;
      }
      // Case-insensitive exact
      else if (key.toLowerCase() === normalized) {
        score = 0.95;
      }
      // Alias match
      else if (this.aliases.get(normalized) === key) {
        score = 0.9;
      }
      // Prefix match
      else if (key.toLowerCase().startsWith(normalized)) {
        score = 0.7;
      }
      // Contains match
      else if (key.toLowerCase().includes(normalized)) {
        score = 0.5;
      }
      // Tag match
      else if (schema.tags?.some((t) => t.toLowerCase().includes(normalized))) {
        score = 0.4;
      }
      // Description match
      else if (schema.description.toLowerCase().includes(normalized)) {
        score = 0.3;
      }

      if (score > 0) {
        results.push({ schema, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  list(): IntentSchema[] {
    return [...this.schemas.values()];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// IDEL Compiler
// ────────────────────────────────────────────────────────────────────────────

export class IdelCompiler {
  constructor(private readonly registry: IdelSchemaRegistry) {}

  /**
   * Compile a raw intent proposal into a validated, executable structure.
   */
  compile(proposal: IntentProposal): CompilationResult {
    const errors: CompilationError[] = [];

    // 1. Resolve intent
    const candidates = this.registry.findCandidates(proposal.raw);
    if (candidates.length === 0) {
      return {
        ok: false,
        errors: [{
          code: 'IDEL_UNKNOWN_INTENT',
          message: `No intent found matching '${proposal.raw}'`,
        }],
      };
    }

    const best = candidates[0];
    const schema = best.schema;

    // 2. Build alternatives
    const alternatives: AlternativeIntent[] = candidates
      .slice(1, 4)
      .filter((c) => c.score >= 0.3)
      .map((c) => ({
        intent: c.schema.intent,
        confidence: c.score,
        reason: c.schema.description,
      }));

    // 3. Validate parameters
    const constraints: IntentConstraint[] = [];
    const clarifications: ClarificationQuestion[] = [];
    const params = { ...proposal.params };

    for (const paramSchema of schema.params) {
      const value = params[paramSchema.name];

      // Required check
      if (paramSchema.required && value === undefined) {
        if (paramSchema.default !== undefined) {
          params[paramSchema.name] = paramSchema.default;
          constraints.push({
            kind: 'required_param',
            field: paramSchema.name,
            description: `Defaulted to ${JSON.stringify(paramSchema.default)}`,
            satisfied: true,
            value: paramSchema.default,
          });
        } else {
          constraints.push({
            kind: 'required_param',
            field: paramSchema.name,
            description: `Required parameter '${paramSchema.name}' is missing`,
            satisfied: false,
          });
          clarifications.push({
            id: `clarify_${paramSchema.name}`,
            question: paramSchema.description ?? `What is the ${paramSchema.name}?`,
            field: paramSchema.name,
            options: paramSchema.enum?.map(String),
            required: true,
          });
        }
        continue;
      }

      if (value === undefined) continue;

      // Type check
      const typeValid = validateType(value, paramSchema.type);
      constraints.push({
        kind: 'type_check',
        field: paramSchema.name,
        description: `Must be ${paramSchema.type}`,
        satisfied: typeValid,
        value,
        expected: paramSchema.type,
      });
      if (!typeValid) {
        errors.push({
          code: 'IDEL_TYPE_ERROR',
          message: `Parameter '${paramSchema.name}' must be ${paramSchema.type}, got ${typeof value}`,
          field: paramSchema.name,
        });
      }

      // Range check
      if (paramSchema.min !== undefined || paramSchema.max !== undefined) {
        const numVal = typeof value === 'number' ? value : Number(value);
        const inRange =
          (paramSchema.min === undefined || numVal >= paramSchema.min) &&
          (paramSchema.max === undefined || numVal <= paramSchema.max);
        constraints.push({
          kind: 'range',
          field: paramSchema.name,
          description: `Must be between ${paramSchema.min ?? '-∞'} and ${paramSchema.max ?? '∞'}`,
          satisfied: inRange,
          value: numVal,
        });
      }

      // Pattern check
      if (paramSchema.pattern) {
        const matches = new RegExp(paramSchema.pattern).test(String(value));
        constraints.push({
          kind: 'pattern',
          field: paramSchema.name,
          description: `Must match ${paramSchema.pattern}`,
          satisfied: matches,
          value,
          expected: paramSchema.pattern,
        });
      }

      // Enum check
      if (paramSchema.enum) {
        const inEnum = paramSchema.enum.some(
          (e) => JSON.stringify(e) === JSON.stringify(value),
        );
        constraints.push({
          kind: 'custom',
          field: paramSchema.name,
          description: `Must be one of: ${paramSchema.enum.join(', ')}`,
          satisfied: inEnum,
          value,
          expected: paramSchema.enum,
        });
      }
    }

    // 4. Assess risk
    const risk = assessRisk(schema, proposal, constraints);

    // 5. Compute confidence
    const unsatisfied = constraints.filter((c) => !c.satisfied);
    const needsClarification = clarifications.length > 0;
    let confidence = best.score;
    if (unsatisfied.length > 0) {
      confidence *= 1 - (unsatisfied.length / Math.max(constraints.length, 1)) * 0.5;
    }
    if (errors.length > 0) {
      confidence *= 0.5;
    }

    const compiled: CompiledIntent = {
      intent: schema.intent,
      actor_id: proposal.actor_id,
      target: proposal.target,
      params,
      constraints,
      confidence,
      alternatives,
      needs_clarification: needsClarification,
      clarifications,
      expected_outcome: schema.description,
      fallback: schema.related?.[0],
      risk,
      metadata: {
        schema_intent: schema.intent,
        resolved_from: proposal.raw,
        has_side_effects: schema.has_side_effects,
        reversible: schema.reversible,
      },
    };

    return {
      ok: errors.length === 0 && !needsClarification,
      compiled,
      errors,
    };
  }

  /**
   * Apply clarification answers and re-compile.
   */
  applyClarifications(
    compiled: CompiledIntent,
    answers: Record<string, unknown>,
  ): CompilationResult {
    const proposal: IntentProposal = {
      raw: compiled.intent,
      actor_id: compiled.actor_id,
      target: compiled.target,
      params: { ...compiled.params, ...answers },
    };
    return this.compile(proposal);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function validateType(value: unknown, expectedType: IntentParamSchema['type']): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

function assessRisk(
  schema: IntentSchema,
  proposal: IntentProposal,
  constraints: IntentConstraint[],
): IntentRisk {
  const factors: string[] = [];
  let score = 0;

  // Base risk from schema
  const baseRiskMap: Record<RiskLevel, number> = {
    none: 0,
    low: 0.1,
    medium: 0.3,
    high: 0.6,
    critical: 0.9,
  };
  score = baseRiskMap[schema.risk_level] ?? 0;
  if (schema.risk_level !== 'none') {
    factors.push(`Base risk: ${schema.risk_level}`);
  }

  // Side effects increase risk
  if (schema.has_side_effects) {
    score += 0.1;
    factors.push('Has side effects');
  }

  // Irreversible actions increase risk
  if (!schema.reversible) {
    score += 0.1;
    factors.push('Not reversible');
  }

  // Failed constraints increase risk
  const failed = constraints.filter((c) => !c.satisfied);
  if (failed.length > 0) {
    score += 0.05 * failed.length;
    factors.push(`${failed.length} unsatisfied constraint(s)`);
  }

  // Clamp
  score = Math.min(score, 1.0);

  let level: RiskLevel;
  if (score <= 0) level = 'none';
  else if (score <= 0.2) level = 'low';
  else if (score <= 0.5) level = 'medium';
  else if (score <= 0.8) level = 'high';
  else level = 'critical';

  return { level, score, factors };
}
