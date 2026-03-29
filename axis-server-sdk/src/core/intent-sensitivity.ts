/**
 * AXIS Intent Sensitivity Classification
 * Protocol-level risk classification for intents.
 */

export enum IntentSensitivity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Maps known intents to their sensitivity level.
 */
export const INTENT_SENSITIVITY_MAP: Record<string, IntentSensitivity> = {
  // System intents
  'system.ping': IntentSensitivity.LOW,

  // Catalog intents
  'catalog.list': IntentSensitivity.LOW,
  'catalog.search': IntentSensitivity.LOW,
  'catalog.intent.describe': IntentSensitivity.LOW,
  'catalog.intent.complete': IntentSensitivity.LOW,

  // Stream intents
  'stream.publish': IntentSensitivity.MEDIUM,
  'stream.read': IntentSensitivity.MEDIUM,
  'stream.subscribe': IntentSensitivity.MEDIUM,

  // File intents
  'file.init': IntentSensitivity.MEDIUM,
  'file.chunk': IntentSensitivity.MEDIUM,
  'file.finalize': IntentSensitivity.MEDIUM,
  'file.status': IntentSensitivity.LOW,

  // Passport intents
  'passport.issue': IntentSensitivity.HIGH,
  'passport.verify': IntentSensitivity.MEDIUM,
  'passport.revoke': IntentSensitivity.CRITICAL,

  // Mail intents
  'mail.send': IntentSensitivity.HIGH,

  // Admin intents
  'admin.create_capsule': IntentSensitivity.CRITICAL,
  'admin.revoke_capsule': IntentSensitivity.CRITICAL,
  'admin.issue_node_cert': IntentSensitivity.CRITICAL,

  // NestFlow: Auth
  'auth.web.login.request': IntentSensitivity.MEDIUM,
  'auth.web.login.scan': IntentSensitivity.HIGH,

  // NestFlow: TickAuth
  'tickauth.challenge.create': IntentSensitivity.MEDIUM,
  'tickauth.challenge.fulfill': IntentSensitivity.HIGH,
  'tickauth.challenge.reject': IntentSensitivity.MEDIUM,

  // NestFlow: Capsule issuance
  'capsule.issue.login': IntentSensitivity.HIGH,
  'capsule.issue.device_registration': IntentSensitivity.HIGH,
  'capsule.issue.step_up': IntentSensitivity.HIGH,
  'capsule.issue.recovery': IntentSensitivity.CRITICAL,

  // NestFlow: Session
  'session.activate': IntentSensitivity.HIGH,
  'session.refresh': IntentSensitivity.MEDIUM,
  'session.logout': IntentSensitivity.LOW,

  // NestFlow: Device trust
  'device.trust.request': IntentSensitivity.HIGH,
  'device.trust.promote': IntentSensitivity.CRITICAL,
  'device.revoke': IntentSensitivity.CRITICAL,
  'device.list': IntentSensitivity.LOW,
  'device.rename': IntentSensitivity.LOW,

  // NestFlow: Protected operations
  'flow.publish': IntentSensitivity.MEDIUM,
  'flow.delete': IntentSensitivity.HIGH,
  'node.delete': IntentSensitivity.CRITICAL,
  'secret.rotate': IntentSensitivity.CRITICAL,
  'org.security.update': IntentSensitivity.CRITICAL,
  'production.execution.approve': IntentSensitivity.CRITICAL,

  // NestFlow: Recovery
  'identity.recovery.start': IntentSensitivity.CRITICAL,
  'identity.recovery.complete': IntentSensitivity.CRITICAL,
  'primary.device.rotate': IntentSensitivity.CRITICAL,
  'identity.lock': IntentSensitivity.CRITICAL,
  'identity.unlock': IntentSensitivity.CRITICAL,
};

/**
 * Classifies an intent's sensitivity level.
 *
 * Lookup strategy:
 * 1. Exact intent match
 * 2. Prefix wildcard match (realm.*)
 * 3. Default to MEDIUM
 */
export function classifyIntent(intent: string): IntentSensitivity {
  if (INTENT_SENSITIVITY_MAP[intent]) {
    return INTENT_SENSITIVITY_MAP[intent];
  }

  const realm = intent.split('.')[0];
  const wildcardKey = `${realm}.*`;
  if (INTENT_SENSITIVITY_MAP[wildcardKey]) {
    return INTENT_SENSITIVITY_MAP[wildcardKey];
  }

  return IntentSensitivity.MEDIUM;
}

/**
 * Returns the string name for a sensitivity level.
 */
export function sensitivityName(level: IntentSensitivity): string {
  switch (level) {
    case IntentSensitivity.LOW:
      return 'LOW';
    case IntentSensitivity.MEDIUM:
      return 'MEDIUM';
    case IntentSensitivity.HIGH:
      return 'HIGH';
    case IntentSensitivity.CRITICAL:
      return 'CRITICAL';
  }
}
