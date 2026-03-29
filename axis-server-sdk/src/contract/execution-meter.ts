export class ContractViolationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ContractViolationError';
  }
}

export interface ExecutionMetrics {
  dbWrites: number;
  dbReads: number;
  externalCalls: number;
  elapsedMs: number;
}

export class ExecutionMeter {
  private dbWrites = 0;
  private dbReads = 0;
  private externalCalls = 0;
  private startTime: number;
  private contract: any; // ExecutionContract

  constructor(contract: any) {
    this.contract = contract;
    this.startTime = Date.now();
  }

  recordDbWrite(): void {
    this.dbWrites++;
    if (this.dbWrites > this.contract.maxDbWrites) {
      throw new ContractViolationError(
        'MAX_DB_WRITES_EXCEEDED',
        `DB writes exceeded: ${this.dbWrites}/${this.contract.maxDbWrites}`,
      );
    }
  }

  recordDbRead(): void {
    this.dbReads++;
    if (this.contract.maxDbReads && this.dbReads > this.contract.maxDbReads) {
      throw new ContractViolationError(
        'MAX_DB_READS_EXCEEDED',
        `DB reads exceeded: ${this.dbReads}/${this.contract.maxDbReads}`,
      );
    }
  }

  recordExternalCall(): void {
    this.externalCalls++;
    if (this.externalCalls > this.contract.maxExternalCalls) {
      throw new ContractViolationError(
        'MAX_EXTERNAL_CALLS_EXCEEDED',
        `External calls exceeded: ${this.externalCalls}/${this.contract.maxExternalCalls}`,
      );
    }
  }

  checkTime(): void {
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.contract.maxTimeMs) {
      throw new ContractViolationError(
        'MAX_TIME_EXCEEDED',
        `Execution time exceeded: ${elapsed}ms/${this.contract.maxTimeMs}ms`,
      );
    }
  }

  validateEffect(effect: string): void {
    // Wildcard allows any effect
    if (this.contract.allowedEffects.includes('*')) {
      return;
    }

    if (!this.contract.allowedEffects.includes(effect)) {
      throw new ContractViolationError(
        'INVALID_EFFECT',
        `Effect '${effect}' not allowed. Allowed: ${this.contract.allowedEffects.join(', ')}`,
      );
    }
  }

  getMetrics(): ExecutionMetrics {
    return {
      dbWrites: this.dbWrites,
      dbReads: this.dbReads,
      externalCalls: this.externalCalls,
      elapsedMs: Date.now() - this.startTime,
    };
  }

  getContract() {
    return this.contract;
  }
}
