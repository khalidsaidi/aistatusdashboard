const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3002', 10);
const HOST = process.env.HOST || '127.0.0.1';
const OUT_DIR = process.env.WEBHOOK_SINK_DIR || path.join(process.cwd(), '.ai', 'webhook-sink');

fs.mkdirSync(OUT_DIR, { recursive: true });

const requestsFile = path.join(OUT_DIR, 'requests.jsonl');
const lastFile = path.join(OUT_DIR, 'last.json');

function appendRequest(record) {
    fs.appendFileSync(requestsFile, JSON.stringify(record) + '\n');
    fs.writeFileSync(lastFile, JSON.stringify(record, null, 2));
}

const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
        res.writeHead(404);
        res.end();
        return;
    }

    let body = '';
    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', () => {
        let parsedBody = null;
        let parseError = null;

        try {
            parsedBody = body ? JSON.parse(body) : null;
        } catch (e) {
            parseError = e instanceof Error ? e.message : 'Invalid JSON';
        }

        const record = {
            receivedAt: new Date().toISOString(),
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: parsedBody,
            rawBody: parsedBody ? undefined : body,
            parseError,
        };

        appendRequest(record);

        console.log('\n📥 WEBHOOK RECEIVED!');
        console.log('URL:', req.url);
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        if (parsedBody) {
            console.log('Payload:', JSON.stringify(parsedBody, null, 2));
        } else {
            console.log('Payload (raw):', body);
        }
        console.log('--- END OF PAYLOAD ---\n');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
    });
});

server.listen(PORT, HOST, () => {
    console.log(`📡 Webhook Receiver listening on http://${HOST}:${PORT}`);
    console.log(`📁 Writing webhook payloads to ${OUT_DIR}`);
});
