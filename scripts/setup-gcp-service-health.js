const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_PATH = path.resolve(__dirname, '..', '.env.production.local');
const OUTPUT_PATH = path.resolve(__dirname, '..', '.ai', 'creds', 'gcp-service-health.json');

const TOPIC_NAME = 'aistatusdashboard-service-health';
const SINK_NAME = 'aistatusdashboard-service-health';
const SUB_NAME = 'aistatusdashboard-service-health-push';

function parseEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  return lines.reduce((acc, line) => {
    if (!line || line.trim().startsWith('#')) return acc;
    const idx = line.indexOf('=');
    if (idx === -1) return acc;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    acc[key] = value;
    return acc;
  }, {});
}

function execJson(cmd) {
  return JSON.parse(execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString());
}

function getProjectId(env) {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID;
  const value = execSync('gcloud config get-value project', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
  return value;
}

function ensureTopic(projectId) {
  try {
    execSync(`gcloud pubsub topics describe ${TOPIC_NAME} --project ${projectId}`, { stdio: 'ignore' });
  } catch {
    execSync(`gcloud pubsub topics create ${TOPIC_NAME} --project ${projectId}`, { stdio: 'ignore' });
  }
}

function ensureSink(projectId, filter) {
  try {
    execSync(`gcloud logging sinks describe ${SINK_NAME} --project ${projectId}`, { stdio: 'ignore' });
  } catch {
    execSync(
      `gcloud logging sinks create ${SINK_NAME} pubsub.googleapis.com/projects/${projectId}/topics/${TOPIC_NAME} --log-filter='${filter}' --project ${projectId}`,
      { stdio: 'ignore' }
    );
  }
  const sink = execJson(
    `gcloud logging sinks describe ${SINK_NAME} --project ${projectId} --format=json`
  );
  return sink.writerIdentity;
}

function ensureSinkPermissions(projectId, writerIdentity) {
  execSync(
    `gcloud pubsub topics add-iam-policy-binding ${TOPIC_NAME} --project ${projectId} --member='${writerIdentity}' --role='roles/pubsub.publisher'`,
    { stdio: 'ignore' }
  );
}

function ensureSubscription(projectId, endpoint) {
  try {
    execSync(`gcloud pubsub subscriptions describe ${SUB_NAME} --project ${projectId}`, { stdio: 'ignore' });
  } catch {
    execSync(
      `gcloud pubsub subscriptions create ${SUB_NAME} --project ${projectId} --topic ${TOPIC_NAME} --push-endpoint='${endpoint}' --ack-deadline=30`,
      { stdio: 'ignore' }
    );
  }
}

function main() {
  const env = parseEnv();
  const secret = env.GCP_INGEST_SECRET || env.APP_GCP_INGEST_SECRET;
  if (!secret) {
    throw new Error('Missing GCP_INGEST_SECRET in .env.production.local');
  }

  const projectId = getProjectId(env);
  const baseUrl = (env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com').replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/ingest/gcp-health?secret=${secret}`;
  const filter = 'logName:"servicehealth.googleapis.com"';

  ensureTopic(projectId);
  const writerIdentity = ensureSink(projectId, filter);
  ensureSinkPermissions(projectId, writerIdentity);
  ensureSubscription(projectId, endpoint);

  const report = {
    projectId,
    topic: TOPIC_NAME,
    sink: SINK_NAME,
    subscription: SUB_NAME,
    endpoint,
    writerIdentity,
    filter,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
}

main();
