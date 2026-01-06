const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};

    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    const env = { ...process.env };

    lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;

        const firstEq = line.indexOf('=');
        if (firstEq === -1) return;

        const key = line.substring(0, firstEq).trim();
        let value = line.substring(firstEq + 1).trim();

        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
        }

        // Only fill missing env vars; never override explicitly provided process.env values.
        if (env[key] === undefined) {
            env[key] = value.replace(/\\n/g, '\n');
        }
    });

    return env;
}

function isWsl() {
    if (process.env.WSL_DISTRO_NAME) return true;
    try {
        return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
    } catch {
        return false;
    }
}

const env = loadEnv();
const port = process.env.PORT || env.PORT || '3001';
const host = process.env.DEV_HOST || env.DEV_HOST || process.env.HOST || env.HOST || (isWsl() ? '0.0.0.0' : null);
const args = ['run', 'dev'];
if (host) {
    args.push('--', '--hostname', host);
}
const cmd = spawn('npm', args, {
    env: { ...env, PORT: port },
    stdio: 'inherit'
});

cmd.on('close', (code) => {
    process.exit(code);
});
