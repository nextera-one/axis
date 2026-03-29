export interface ExecutionContract {
  maxDbWrites: number;
  maxDbReads?: number;
  maxExternalCalls: number;
  maxTimeMs: number;
  allowedEffects: string[];
  maxMemoryMb?: number;
}

export const DEFAULT_CONTRACTS: Record<string, ExecutionContract> = {
  // System intents
  'system.ping': {
    maxDbWrites: 0,
    maxExternalCalls: 0,
    maxTimeMs: 100,
    allowedEffects: ['system.pong'],
  },

  // Catalog intents
  'catalog.list': {
    maxDbWrites: 0,
    maxExternalCalls: 0,
    maxTimeMs: 200,
    allowedEffects: ['catalog.listed'],
  },
  'catalog.search': {
    maxDbWrites: 0,
    maxExternalCalls: 0,
    maxTimeMs: 300,
    allowedEffects: ['catalog.searched'],
  },

  // Passport intents
  'passport.issue': {
    maxDbWrites: 10,
    maxExternalCalls: 0,
    maxTimeMs: 500,
    allowedEffects: ['passport.issued', 'passport.rejected'],
  },
  'passport.revoke': {
    maxDbWrites: 5,
    maxExternalCalls: 0,
    maxTimeMs: 300,
    allowedEffects: ['passport.revoked', 'passport.revoke_failed'],
  },

  // File intents
  'file.init': {
    maxDbWrites: 2,
    maxExternalCalls: 0,
    maxTimeMs: 200,
    allowedEffects: ['file.initialized'],
  },
  'file.chunk': {
    maxDbWrites: 2,
    maxExternalCalls: 0,
    maxTimeMs: 1000,
    allowedEffects: ['file.chunk.stored'],
  },
  'file.finalize': {
    maxDbWrites: 2,
    maxExternalCalls: 0,
    maxTimeMs: 500,
    allowedEffects: ['file.finalized'],
  },

  // Stream intents
  'stream.publish': {
    maxDbWrites: 1,
    maxExternalCalls: 0,
    maxTimeMs: 200,
    allowedEffects: ['stream.published'],
  },
  'stream.read': {
    maxDbWrites: 0,
    maxExternalCalls: 0,
    maxTimeMs: 300,
    allowedEffects: ['stream.data'],
  },

  // Mail intents
  'mail.send': {
    maxDbWrites: 3,
    maxExternalCalls: 1, // Email service
    maxTimeMs: 2000,
    allowedEffects: ['mail.sent', 'mail.failed'],
  },
};

// Default contract for unknown intents
export const FALLBACK_CONTRACT: ExecutionContract = {
  maxDbWrites: 10,
  maxExternalCalls: 0,
  maxTimeMs: 1000,
  allowedEffects: ['*'], // Allow any effect
};
