/**
 * Firebase Connectivity Test
 * Production-grade validation of Firebase connection
 */

const { initializeTestFirebase, cleanupTestFirebase } = require('../lib/test-firebase-config');
const { doc, getDoc } = require('firebase/firestore');

async function testFirebaseConnectivity(): Promise<void> {
  try {
    console.log('   Initializing Firebase...');
    const firebase = await initializeTestFirebase();
    console.log('   ✅ Firebase initialization successful');

    console.log('   Testing database connection...');
    const testDoc = doc(firebase.db, 'test', 'connectivity');

    try {
      await getDoc(testDoc);
      console.log('   ✅ Database connection verified');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED')) {
          console.log('   ✅ Database connection verified (permission check passed)');
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Cleanup
    await cleanupTestFirebase();

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error('   ❌ Firebase connectivity test failed:', error.message);
    } else {
      console.error('   ❌ Firebase connectivity test failed:', String(error));
    }
    process.exit(1);
  }
}

testFirebaseConnectivity();
