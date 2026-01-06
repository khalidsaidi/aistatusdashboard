const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_PATH = path.resolve(__dirname, '..', '.env.production.local');
const OUTPUT_PATH = path.resolve(__dirname, '..', '.ai', 'creds', 'aws-eventbridge.json');

const CONNECTION_NAME = 'aistatusdashboard-aws-health';
const API_DESTINATION_NAME = 'aistatusdashboard-aws-health';
const RULE_NAME = 'aistatusdashboard-aws-health';
const ROLE_NAME = 'aistatusdashboard-eventbridge';
const POLICY_NAME = 'aistatusdashboard-eventbridge';

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

function ensureRole() {
  try {
    execSync(`aws iam get-role --role-name ${ROLE_NAME}`, { stdio: 'ignore' });
  } catch {
    const trustPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'events.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    };
    execSync(
      `aws iam create-role --role-name ${ROLE_NAME} --assume-role-policy-document '${JSON.stringify(trustPolicy)}'`,
      { stdio: 'ignore' }
    );
  }
  const role = execJson(`aws iam get-role --role-name ${ROLE_NAME}`);
  return role.Role.Arn;
}

function ensureConnection(secret) {
  const params = {
    ApiKeyAuthParameters: {
      ApiKeyName: 'x-ingest-secret',
      ApiKeyValue: secret,
    },
  };
  try {
    const existing = execJson(`aws events describe-connection --name ${CONNECTION_NAME}`);
    execSync(
      `aws events update-connection --name ${CONNECTION_NAME} --authorization-type API_KEY --auth-parameters '${JSON.stringify(
        params
      )}'`,
      { stdio: 'ignore' }
    );
    return existing.ConnectionArn;
  } catch {
    const created = execJson(
      `aws events create-connection --name ${CONNECTION_NAME} --authorization-type API_KEY --auth-parameters '${JSON.stringify(
        params
      )}'`
    );
    return created.ConnectionArn;
  }
}

function ensureApiDestination(connectionArn, ingestUrl) {
  try {
    const existing = execJson(`aws events describe-api-destination --name ${API_DESTINATION_NAME}`);
    execSync(
      `aws events update-api-destination --name ${API_DESTINATION_NAME} --connection-arn ${connectionArn} --invocation-endpoint ${ingestUrl} --http-method POST --invocation-rate-limit-per-second 5`,
      { stdio: 'ignore' }
    );
    return existing.ApiDestinationArn;
  } catch {
    const created = execJson(
      `aws events create-api-destination --name ${API_DESTINATION_NAME} --connection-arn ${connectionArn} --invocation-endpoint ${ingestUrl} --http-method POST --invocation-rate-limit-per-second 5`
    );
    return created.ApiDestinationArn;
  }
}

function ensureRule() {
  const eventPattern = {
    source: ['aws.health'],
    'detail-type': ['AWS Health Event', 'AWS Health Scheduled Change', 'AWS Health Account Notification'],
  };
  execSync(
    `aws events put-rule --name ${RULE_NAME} --event-pattern '${JSON.stringify(eventPattern)}'`,
    { stdio: 'ignore' }
  );
  const rule = execJson(`aws events describe-rule --name ${RULE_NAME}`);
  return rule.Arn;
}

function ensurePolicy(roleArn, apiDestinationArn) {
  const policyDoc = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: 'events:InvokeApiDestination',
        Resource: apiDestinationArn,
      },
    ],
  };
  execSync(
    `aws iam put-role-policy --role-name ${ROLE_NAME} --policy-name ${POLICY_NAME} --policy-document '${JSON.stringify(
      policyDoc
    )}'`,
    { stdio: 'ignore' }
  );
  return roleArn;
}

function ensureTarget(apiDestinationArn, roleArn) {
  const target = [
    {
      Id: 'aistatusdashboard',
      Arn: apiDestinationArn,
      RoleArn: roleArn,
    },
  ];
  execSync(
    `aws events put-targets --rule ${RULE_NAME} --targets '${JSON.stringify(target)}'`,
    { stdio: 'ignore' }
  );
}

function main() {
  const env = parseEnv();
  const secret = env.AWS_INGEST_SECRET || env.APP_AWS_INGEST_SECRET;
  if (!secret) {
    throw new Error('Missing AWS_INGEST_SECRET in .env.production.local');
  }

  const baseUrl = (env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com').replace(/\/$/, '');
  const ingestUrl = `${baseUrl}/api/ingest/aws-health`;

  const roleArn = ensureRole();
  const connectionArn = ensureConnection(secret);
  const apiDestinationArn = ensureApiDestination(connectionArn, ingestUrl);
  ensurePolicy(roleArn, apiDestinationArn);
  ensureRule();
  ensureTarget(apiDestinationArn, roleArn);

  const report = {
    connection: CONNECTION_NAME,
    apiDestination: API_DESTINATION_NAME,
    rule: RULE_NAME,
    role: ROLE_NAME,
    ingestUrl,
    apiDestinationArn,
    roleArn,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
}

main();
