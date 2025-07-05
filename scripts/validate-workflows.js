#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// Load package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const availableScripts = Object.keys(packageJson.scripts || {});

// Known GitHub Actions and their schemas
const actionSchemas = {
  '8398a7/action-slack@v3': {
    inputs: ['status', 'text', 'mention', 'if_mention', 'job_name', 'fields', 'custom_payload'],
    env: ['SLACK_WEBHOOK_URL']
  },
  'actions/checkout@v4': {
    inputs: ['repository', 'ref', 'token', 'ssh-key', 'path', 'clean', 'fetch-depth', 'lfs', 'submodules']
  },
  'actions/setup-node@v4': {
    inputs: ['node-version', 'node-version-file', 'architecture', 'cache', 'cache-dependency-path']
  },
  'actions/upload-artifact@v3': {
    inputs: ['name', 'path', 'retention-days', 'if-no-files-found']
  },
  'actions/download-artifact@v3': {
    inputs: ['name', 'path']
  },
  'codecov/codecov-action@v3': {
    inputs: ['token', 'files', 'flags', 'fail_ci_if_error', 'verbose']
  },
  'actions/github-script@v7': {
    inputs: ['script', 'github-token', 'previews', 'user-agent', 'debug', 'result-encoding']
  }
};

function validateWorkflow(workflowPath) {
  console.log(`\nValidating ${workflowPath}...`);
  const content = fs.readFileSync(workflowPath, 'utf8');
  const workflow = yaml.load(content);
  const errors = [];

  // Traverse the workflow
  for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
    for (const [stepIndex, step] of (job.steps || []).entries()) {
      // Check npm run commands
      if (step.run) {
        const npmCommands = step.run.match(/npm run (\S+)/g) || [];
        for (const cmd of npmCommands) {
          const script = cmd.replace('npm run ', '');
          if (!availableScripts.includes(script)) {
            errors.push({
              job: jobName,
              step: stepIndex + 1,
              error: `npm script '${script}' not found in package.json`,
              line: step.run
            });
          }
        }

        // Check for file references
        const fileRefs = step.run.match(/(?:\.\/|[^/\s]+\/)[^\s]+/g) || [];
        for (const ref of fileRefs) {
          if (ref.includes('config.js') || ref.includes('.json')) {
            if (!fs.existsSync(ref)) {
              errors.push({
                job: jobName,
                step: stepIndex + 1,
                error: `Referenced file '${ref}' not found`,
                line: step.run
              });
            }
          }
        }
      }

      // Check GitHub Actions
      if (step.uses) {
        const actionMatch = step.uses.match(/^([^@]+@v\d+)/);
        if (actionMatch && actionSchemas[actionMatch[1]]) {
          const schema = actionSchemas[actionMatch[1]];
          
          // Check for invalid inputs
          if (step.with) {
            for (const input of Object.keys(step.with)) {
              if (schema.inputs && !schema.inputs.includes(input)) {
                errors.push({
                  job: jobName,
                  step: stepIndex + 1,
                  error: `Invalid input '${input}' for action ${step.uses}`,
                  suggestion: `Valid inputs: ${schema.inputs.join(', ')}`
                });
              }
            }
          }
          
          // Check if env vars should be used instead of inputs
          if (step.with && schema.env) {
            for (const envVar of schema.env) {
              const inputName = envVar.toLowerCase().replace(/_/g, '_');
              if (step.with[inputName] || step.with.webhook_url) {
                errors.push({
                  job: jobName,
                  step: stepIndex + 1,
                  error: `Use environment variable ${envVar} instead of input`,
                  suggestion: `env:\n  ${envVar}: \${{ secrets.YOUR_SECRET }}`
                });
              }
            }
          }
        }
      }
    }
  }

  return errors;
}

// Validate all workflows
const workflowDir = '.github/workflows';
const workflows = fs.readdirSync(workflowDir)
  .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

let hasErrors = false;

for (const workflow of workflows) {
  const errors = validateWorkflow(path.join(workflowDir, workflow));
  if (errors.length > 0) {
    hasErrors = true;
    console.error(`\n❌ Errors in ${workflow}:`);
    errors.forEach(err => {
      console.error(`  - Job '${err.job}', Step ${err.step}: ${err.error}`);
      if (err.suggestion) {
        console.error(`    💡 ${err.suggestion}`);
      }
    });
  } else {
    console.log(`✅ ${workflow} is valid`);
  }
}

if (hasErrors) {
  console.error('\n❌ Workflow validation failed');
  process.exit(1);
} else {
  console.log('\n✅ All workflows are valid');
} 