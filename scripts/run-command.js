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
        env[key] = value.replace(/\\n/g, '\n');
    });

    return env;
}

const env = loadEnv();
const args = process.argv.slice(2);

if (args.length === 0) {
    console.error('Usage: node run-command.js <command> [args...]');
    process.exit(1);
}

const cmd = spawn(args[0], args.slice(1), {
    env,
    stdio: 'inherit'
});

cmd.on('close', (code) => {
    process.exit(code);
});
