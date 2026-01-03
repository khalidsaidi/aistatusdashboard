const { SMTPServer } = require('smtp-server');
const fs = require('fs');
const path = require('path');

const HOST = process.env.SMTP_HOST || '127.0.0.1';
const PORT = parseInt(process.env.SMTP_PORT || '2525', 10);
const OUT_DIR = process.env.SMTP_SINK_DIR || path.join(process.cwd(), '.ai', 'smtp-sink');

fs.mkdirSync(OUT_DIR, { recursive: true });

const indexFile = path.join(OUT_DIR, 'index.json');

function loadIndex() {
  try {
    const raw = fs.readFileSync(indexFile, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

let index = loadIndex();
let counter = index.length;

function saveIndex() {
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
}

function parseHeaders(raw) {
  const text = raw.toString('utf8');
  const headerEnd = text.indexOf('\r\n\r\n') !== -1 ? text.indexOf('\r\n\r\n') : text.indexOf('\n\n');
  const headerBlock = headerEnd !== -1 ? text.slice(0, headerEnd) : text;

  const lines = headerBlock.split(/\r?\n/);
  const unfolded = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ' ' + line.trim();
    } else {
      unfolded.push(line);
    }
  }

  const headers = {};
  for (const line of unfolded) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = value;
  }
  return headers;
}

const server = new SMTPServer({
  // For local testing we don't need TLS. Disabling STARTTLS prevents nodemailer from
  // attempting an upgrade that can fail due to self-signed/expired default certs.
  disabledCommands: ['STARTTLS'],
  authOptional: true,
  allowInsecureAuth: true,
  onAuth(auth, _session, callback) {
    callback(null, { user: auth.username || 'anonymous' });
  },
  onData(stream, _session, callback) {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => {
      const raw = Buffer.concat(chunks);
      const headers = parseHeaders(raw);

      counter += 1;
      const filename = `email-${String(counter).padStart(4, '0')}.eml`;
      fs.writeFileSync(path.join(OUT_DIR, filename), raw);

      const record = {
        id: counter,
        receivedAt: new Date().toISOString(),
        file: filename,
        from: headers.from || null,
        to: headers.to || null,
        subject: headers.subject || null,
      };
      index.push(record);
      saveIndex();

      console.log(`📨 SMTP sink received #${counter}: to=${record.to} subject=${record.subject}`);
      callback(null);
    });
  },
});

server.listen(PORT, HOST, () => {
  console.log(`📮 SMTP sink listening on ${HOST}:${PORT}`);
  console.log(`📁 Writing emails to ${OUT_DIR}`);
});
