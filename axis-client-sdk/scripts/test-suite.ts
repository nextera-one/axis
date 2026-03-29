import { AxisClient, HttpTransport, Ed25519Signer } from '../src';
import * as crypto from 'crypto';
import chalk from 'chalk';

const ENDPOINT = 'http://127.0.0.1:7781/axis';
const DELAY = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(chalk.bold.cyan('🚀 Starting Axis Automated Verification Suite'));
  console.log(chalk.gray(`Endpoint: ${ENDPOINT}`));

  // 1. Setup Identity
  const privateKey = new Uint8Array(crypto.randomBytes(32));
  const signer = new Ed25519Signer(privateKey);
  const pubKey = await signer.getPublicKey();
  const actorId = Buffer.from(pubKey).toString('hex');
  
  console.log(chalk.gray(`Actor: ${actorId.substring(0, 16)}...`));

  const client = new AxisClient({
    signer,
    transport: new HttpTransport(ENDPOINT, {
        headers: { 
            'x-fingerprint': 'axis-test-suite',
            'x-ray-id': `test-${Date.now()}`
        }
    }),
    actorId
  });

  // Test 1: System Ping
  await runTest('System Ping', async () => {
    const res = await client.send('system.ping', new Uint8Array(0));
    if (!res.ok) throw new Error(`Ping failed: ${res.effect}`);
    console.log(chalk.green('  ✓ Ping successful'));
  });

  // Test 2: Stream Publish & Read
  const streamName = `test-stream-${Date.now()}`;
  const messageData = 'Verification Message';
  
  await runTest('Stream Operations', async () => {
    // Publish
    const pubPayload = JSON.stringify({
        stream: streamName,
        data: Buffer.from(messageData).toString('base64')
    });
    const pubRes = await client.send('stream.publish', Buffer.from(pubPayload));
    if (!pubRes.ok) throw new Error(`Publish failed: ${pubRes.effect}`);
    
    const pubResult = JSON.parse(new TextDecoder().decode(pubRes.body));
    console.log(chalk.green(`  ✓ Published: ${pubResult.id}`));

    await DELAY(100);

    // Read
    const readPayload = JSON.stringify({ stream: streamName, lastId: '0-0' });
    const readRes = await client.send('stream.read', Buffer.from(readPayload));
    if (!readRes.ok) throw new Error(`Read failed: ${readRes.effect}`);

    const messages = JSON.parse(new TextDecoder().decode(readRes.body));
    if (messages.length === 0) throw new Error('No messages returned');
    
    const receivedData = Buffer.from(messages[0].data, 'base64').toString('utf8');
    if (receivedData !== messageData) throw new Error(`Data mismatch: ${receivedData}`);
    
    console.log(chalk.green('  ✓ Read verification successful'));
  });

  // Test 3: File Upload (Small)
  await runTest('File Upload', async () => {
    const fileContent = crypto.randomBytes(1024 * 5); // 5KB
    const filename = `test-file-${Date.now()}.bin`;
    
    // Init
    const initPayload = JSON.stringify({ filename, size: fileContent.length });
    const initRes = await client.send('file.init', Buffer.from(initPayload));
    if (!initRes.ok) throw new Error(`File Init failed: ${initRes.effect}`);
    
    const { fileId } = JSON.parse(new TextDecoder().decode(initRes.body));
    console.log(chalk.green(`  ✓ Init fileId: ${fileId}`));

    // Chunk
    const chunkPayload = JSON.stringify({
        fileId,
        offset: 0,
        data: fileContent.toString('base64')
    });
    const chunkRes = await client.send('file.chunk', Buffer.from(chunkPayload));
    if (!chunkRes.ok) throw new Error(`File Chunk failed: ${chunkRes.effect}`);
    console.log(chalk.green('  ✓ Chunk uploaded'));

    // Finalize
    const finPayload = JSON.stringify({ fileId });
    const finRes = await client.send('file.finalize', Buffer.from(finPayload));
    if (!finRes.ok) throw new Error(`File Finalize failed: ${finRes.effect}`);
    
    console.log(chalk.green('  ✓ File finalized'));
  });

  console.log(chalk.bold.magenta('\n✨ All Tests Passed!'));
}

async function runTest(name: string, fn: () => Promise<void>) {
    process.stdout.write(chalk.yellow(`\n• Running ${name}...`));
    try {
        console.log('');
        await fn();
    } catch (e: any) {
        console.error(chalk.red(`\n❌ ${name} Failed: ${e.message}`));
        process.exit(1);
    }
}

main();
