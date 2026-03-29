import { AxisClient, HttpTransport, Ed25519Signer } from '../src'; // Import from local src
import * as crypto from 'crypto';

// Polyfill fetch for Node if needed (Node 18+ has it global)
// import fetch from 'node-fetch'; 

async function main() {
  console.log('--- Axis System Verification ---');

  // 1. Setup Client
  const privKey = crypto.randomBytes(32);
  const signer = new Ed25519Signer(new Uint8Array(privKey));
  const pubKey = await signer.getPublicKey();
  const actorId = Buffer.from(pubKey).toString('hex');
  
  // Assuming Backend running on port 3000
  const transport = new HttpTransport('http://127.0.0.1:7781/axis', {
    headers: {
        'x-fingerprint': 'verify-script-fp',
        'x-ray-id': 'verify-script-ray',
    }
  });
  
  const client = new AxisClient({
    signer,
    transport,
    actorId
  });

  console.log(`Actor ID: ${actorId}`);

  try {
    // 2. Send 'system.ping' (Need to make sure backend handles this or throws IntentNotFound)
    // We expect IntentNotFound (400/500) or success if we register a handler.
    // For now, let's just see if we get a Receipt Frame back (even if error).
    
    console.log('Sending system.ping...');
    const res = await client.send('system.ping', new Uint8Array([]));
    
    console.log('Response:', res);
  } catch (e: any) {
    console.log('Verification Finished with Error (Expected if intent not mapped):');
    console.log(e.message);
    
    if (e.message.includes('Intent not found') || e.message.includes('Axis Error')) {
        console.log('✅ SUCCESS: Protocol spoke AXIS and Backend responded with Axis Error!');
    } else {
        console.log('❌ FAILURE: Unexpected transport/network error');
        process.exit(1);
    }
  }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
