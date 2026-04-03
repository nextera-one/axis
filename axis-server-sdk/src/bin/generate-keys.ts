/**
 * AXIS Key Generator
 *
 * Generates Ed25519 keypairs for AXIS issuer and actors
 * For development and testing only - use proper KMS/Vault in production
 *
 * Usage:
 *   npm run generate-keys -- --type issuer
 *   npm run generate-keys -- --type actor --actor-id user_123
 */
import { createHash, createPublicKey, generateKeyPairSync } from 'crypto';
import { randomBytes } from 'crypto';

interface KeyPairResult {
  kid: string;
  publicKeyPem: string;
  privateKeyPem: string;
  fingerprint: string;
  sql?: string;
}

/**
 * Calculate SHA-256 fingerprint of public key
 */
function calculateFingerprint(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({
    type: 'spki',
    format: 'der',
  }) as Buffer;
  return createHash('sha256').update(der).digest('hex');
}

/**
 * Generate UUID v4 as binary hex for MySQL
 */
function generateUuid(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant
  return bytes.toString('hex');
}

/**
 * Generate Ed25519 keypair for AXIS issuer
 */
function generateIssuerKey(): KeyPairResult {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');

  const publicKeyPem = publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString();
  const privateKeyPem = privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();

  const fingerprint = calculateFingerprint(publicKeyPem);
  const kid = `axis_issuer_${fingerprint.slice(0, 16)}`;

  const uuid = generateUuid();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const sql = `
-- AXIS Issuer Key
INSERT INTO axis_issuer_keys (
  id, kid, issuer_id, alg, public_key_pem, status, 
  fingerprint, created_at, updated_at
) VALUES (
  UNHEX('${uuid}'),
  '${kid}',
  'axis-capsule-service',
  'EdDSA',
  '${publicKeyPem.replace(/\n/g, '\\n')}',
  'ACTIVE',
  '${fingerprint}',
  '${now}',
  '${now}'
);`;

  return {
    kid,
    publicKeyPem,
    privateKeyPem,
    fingerprint,
    sql,
  };
}

/**
 * Generate Ed25519 keypair for AXIS actor
 */
function generateActorKey(actorId: string): KeyPairResult {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');

  const publicKeyPem = publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString();
  const privateKeyPem = privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();

  // Extract raw public key bytes (32 bytes for Ed25519)
  const der = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const publicKeyBytes = der.slice(-32); // Last 32 bytes are the raw key

  const fingerprint = calculateFingerprint(publicKeyPem);
  const kid = `${actorId}_${fingerprint.slice(0, 12)}`;

  const uuid = generateUuid();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const sql = `
-- AXIS Actor Key for ${actorId}
INSERT INTO axis_actor_keys (
  id, actor_id, key_id, algorithm, public_key, purpose, status,
  is_primary, created_at, updated_at
) VALUES (
  UNHEX('${uuid}'),
  '${actorId}',
  '${kid}',
  'ED25519',
  UNHEX('${publicKeyBytes.toString('hex')}'),
  'SIGN',
  'ACTIVE',
  1,
  '${now}',
  '${now}'
);`;

  return {
    kid,
    publicKeyPem,
    privateKeyPem,
    fingerprint,
    sql,
  };
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const typeIndex = args.indexOf('--type');
  const actorIdIndex = args.indexOf('--actor-id');

  const type = typeIndex >= 0 ? args[typeIndex + 1] : 'issuer';
  const actorId =
    actorIdIndex >= 0 ? args[actorIdIndex + 1] : `actor_${Date.now()}`;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AXIS Key Generator (Ed25519)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  let result: KeyPairResult;

  if (type === 'issuer') {
    console.log('Generating ISSUER keypair...');
    console.log('');
    result = generateIssuerKey();
  } else if (type === 'actor') {
    console.log(`Generating ACTOR keypair for: ${actorId}`);
    console.log('');
    result = generateActorKey(actorId);
  } else {
    console.error('Invalid type. Use --type issuer or --type actor');
    process.exit(1);
  }

  console.log('✓ Keypair generated successfully');
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('KID (Key Identifier):');
  console.log('───────────────────────────────────────────────────────────');
  console.log(result.kid);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('Fingerprint (SHA-256):');
  console.log('───────────────────────────────────────────────────────────');
  console.log(result.fingerprint);
  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('PUBLIC KEY (PEM):');
  console.log('───────────────────────────────────────────────────────────');
  console.log(result.publicKeyPem);
  console.log('───────────────────────────────────────────────────────────');
  console.log('PRIVATE KEY (PEM):');
  console.log('⚠️  KEEP SECRET - Do not commit to version control');
  console.log('───────────────────────────────────────────────────────────');
  console.log(result.privateKeyPem);

  if (type === 'issuer') {
    console.log('───────────────────────────────────────────────────────────');
    console.log('Environment Variables (add to .env):');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`AXIS_ISSUER_KID=${result.kid}`);
    console.log(`AXIS_ISSUER_ALG=EdDSA`);
    console.log(
      `AXIS_ISSUER_PRIVATE_KEY_PEM="${result.privateKeyPem.replace(/\n/g, '\\n')}"`,
    );
    console.log('');
  }

  if (result.sql) {
    console.log('───────────────────────────────────────────────────────────');
    console.log('SQL INSERT Statement:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(result.sql);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Next steps:');
  if (type === 'issuer') {
    console.log('1. Add environment variables to .env');
    console.log('2. Run SQL statement to insert public key into database');
    console.log('3. Store private key securely (Vault/KMS in production)');
  } else {
    console.log('1. Run SQL statement to insert actor key into database');
    console.log('2. Distribute private key securely to actor/device');
  }
  console.log('');
}

main();
