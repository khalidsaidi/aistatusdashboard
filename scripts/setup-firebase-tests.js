#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check for service account files in config/firebase directory
const firebaseConfigDir = path.join(process.cwd(), 'config/firebase');
const devServiceKey = path.join(firebaseConfigDir, 'dev-servicekey.json');
const prodServiceKey = path.join(firebaseConfigDir, 'prod-servicekey.json');

if (fs.existsSync(devServiceKey)) {
} else {
}

if (fs.existsSync(prodServiceKey)) {
} else {
}

if (!fs.existsSync(devServiceKey) && !fs.existsSync(prodServiceKey)) {
} else {
}

// Check current environment

if (fs.existsSync(devServiceKey)) {
} else {
}
