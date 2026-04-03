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

export const INTENT_CATALOG: IntentDefinition[] = [
  //axis.actor_keys.list
  {
    intent: 'axis.actor_keys.list',
    description: 'List all actor keys',
    sensitivity: 'CRITICAL',
    requiredProof: ['CAPSULE', 'WITNESS'],
    contract: { maxDbWrites: 5, maxTimeMs: 300 },
  },
  //Capsule Intents
  {
    intent: 'capsule.issue',
    description: 'Issue new capsule',
    sensitivity: 'CRITICAL',
    requiredProof: ['CAPSULE'],
    contract: { maxDbWrites: 10, maxTimeMs: 500 },
  },
  {
    intent: 'capsule.revoke',
    description: 'Revoke existing capsule',
    sensitivity: 'CRITICAL',
    requiredProof: ['CAPSULE', 'WITNESS'],
    contract: { maxDbWrites: 5, maxTimeMs: 300 },
  },
  {
    intent: 'capsule.update',
    description: 'Update existing capsule',
    sensitivity: 'CRITICAL',
    requiredProof: ['CAPSULE', 'WITNESS'],
    contract: { maxDbWrites: 5, maxTimeMs: 300 },
  },
  {
    intent: 'capsule.list',
    description: 'List all capsules',
    sensitivity: 'CRITICAL',
    requiredProof: ['CAPSULE', 'WITNESS'],
    contract: { maxDbWrites: 5, maxTimeMs: 300 },
  },
  {
    intent: 'capsule.read',
    description: 'Read capsule details',
    sensitivity: 'CRITICAL',
    requiredProof: ['CAPSULE', 'WITNESS'],
    contract: { maxDbWrites: 5, maxTimeMs: 300 },
  },
  {
    intent: 'capsule.delete',
    description: 'Delete existing capsule',
    sensitivity: 'CRITICAL',
    requiredProof: ['CAPSULE', 'WITNESS'],
    contract: { maxDbWrites: 5, maxTimeMs: 300 },
  },
  {
    intent: 'capsule.search',
    description: 'Search capsules by keyword',
    sensitivity: 'CRITICAL',
    requiredProof: ['CAPSULE', 'WITNESS'],
    contract: { maxDbWrites: 5, maxTimeMs: 300 },
  },
  {
    intent: 'system.ping',
    description: 'Health check ping',
    sensitivity: 'LOW',
    requiredProof: [],
    contract: { maxDbWrites: 0, maxTimeMs: 100 },
  },
  {
    intent: 'catalog.list',
    description: 'List all available intents',
    sensitivity: 'LOW',
    requiredProof: [],
    contract: { maxDbWrites: 0, maxTimeMs: 200 },
  },
  {
    intent: 'catalog.search',
    description: 'Search intents by keyword',
    sensitivity: 'LOW',
    requiredProof: [],
    contract: { maxDbWrites: 0, maxTimeMs: 300 },
  },
  {
    intent: 'stream.publish',
    description: 'Publish message to stream',
    sensitivity: 'MEDIUM',
    requiredProof: ['CAPSULE'],
    contract: { maxDbWrites: 1, maxTimeMs: 200 },
  },
  {
    intent: 'stream.read',
    description: 'Read messages from stream',
    sensitivity: 'MEDIUM',
    requiredProof: ['CAPSULE'],
    contract: { maxDbWrites: 0, maxTimeMs: 300 },
  },
  {
    intent: 'file.init',
    description: 'Initialize file upload',
    sensitivity: 'MEDIUM',
    requiredProof: ['CAPSULE'],
    contract: { maxDbWrites: 2, maxTimeMs: 200 },
  },
  {
    intent: 'file.chunk',
    description: 'Upload file chunk',
    sensitivity: 'MEDIUM',
    requiredProof: ['CAPSULE'],
    contract: { maxDbWrites: 2, maxTimeMs: 1000 },
  },
  {
    intent: 'file.finalize',
    description: 'Finalize file upload',
    sensitivity: 'MEDIUM',
    requiredProof: ['CAPSULE'],
    contract: { maxDbWrites: 2, maxTimeMs: 500 },
  },
];
