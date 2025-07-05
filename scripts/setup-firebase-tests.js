#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Test Setup');
console.log('======================');

// Check for service account files in config/firebase directory
const firebaseConfigDir = path.join(process.cwd(), 'config/firebase');
const devServiceKey = path.join(firebaseConfigDir, 'dev-servicekey.json');
const prodServiceKey = path.join(firebaseConfigDir, 'prod-servicekey.json');

console.log(`📁 Checking Firebase config directory: ${firebaseConfigDir}`);

if (fs.existsSync(devServiceKey)) {
  console.log('✅ Found dev-servicekey.json');
  console.log('✅ Firebase tests will run automatically!');
} else {
  console.log('❌ dev-servicekey.json not found');
}

if (fs.existsSync(prodServiceKey)) {
  console.log('✅ Found prod-servicekey.json');
} else {
  console.log('❌ prod-servicekey.json not found');
}

if (!fs.existsSync(devServiceKey) && !fs.existsSync(prodServiceKey)) {
  console.log('\n📋 To set up Firebase authentication for tests:');
  console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
  console.log('2. Click "Generate new private key"');
  console.log('3. Save as config/firebase/dev-servicekey.json');
  console.log('4. Tests will automatically use this file');
} else {
  console.log('\n🧪 Run tests with: npm test');
  console.log('   Firebase integration tests will run automatically');
}

// Check current environment
console.log('\n🔍 Current test setup:');
console.log(`Dev service key: ${fs.existsSync(devServiceKey) ? '✅ Available' : '❌ Missing'}`);
console.log(`Prod service key: ${fs.existsSync(prodServiceKey) ? '✅ Available' : '❌ Missing'}`);

if (fs.existsSync(devServiceKey)) {
  console.log('\n✅ Firebase tests are ready to run!');
} else {
  console.log('\n⚠️  Firebase tests will be skipped until dev-servicekey.json is added.');
} 