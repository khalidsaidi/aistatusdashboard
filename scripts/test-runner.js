const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};

    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    const env = { ...process.env };

    let currentKey = '';
    let currentValue = '';
    let inMultiline = false;

    lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;

        const firstEq = line.indexOf('=');
        if (firstEq === -1) return;

        const key = line.substring(0, firstEq).trim();
        let value = line.substring(firstEq + 1).trim();

        // Remove surrounding quotes
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
        }

        // Process escaped newlines
        env[key] = value.replace(/\\n/g, '\n');
    });

    return env;
}

const env = loadEnv();
console.error(`Loaded ${Object.keys(env).length} env variables from .env.local`);
if (!env.FIREBASE_PROJECT_ID && !env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error('CRITICAL: FIREBASE_PROJECT_ID not found in loaded env!');
}

const cmd = spawn('npx', ['playwright', 'test', '__tests__/e2e/full-stack.spec.ts', '--project=chromium'], {
    env: { ...process.env, ...env, CI: 'true' }, // Merge with process.env to keep PATH etc.
    stdio: 'inherit'
});

cmd.on('close', (code) => {
    process.exit(code);
});
