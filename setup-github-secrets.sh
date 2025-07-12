#!/bin/bash

# Setup GitHub Secrets for AI Status Dashboard CI/CD
# This script creates all the required secrets for the GitHub Actions workflow

set -e

echo "🔑 Setting up GitHub Secrets for AI Status Dashboard CI/CD..."

# Firebase DEV Environment Secrets
echo "Setting up DEV environment secrets..."
gh secret set FIREBASE_API_KEY_DEV --body "AIzaSyB-PApl2fcKWYSjnORl9rn-4NMVGnjVF1Q"
gh secret set FIREBASE_MESSAGING_SENDER_ID_DEV --body "413124782229"
gh secret set FIREBASE_APP_ID_DEV --body "1:413124782229:web:81c009a0e73157e21e139c"

# Firebase PROD Environment Secrets
echo "Setting up PROD environment secrets..."
gh secret set FIREBASE_API_KEY_PROD --body "AIzaSyCgJ68MuGknSH4bZPh4tNkr2wePTA9QvGw"
gh secret set FIREBASE_MESSAGING_SENDER_ID_PROD --body "401066429430"
gh secret set FIREBASE_APP_ID_PROD --body "1:401066429430:web:88df5e30e599ab6c3e15d7"

# Firebase Token (need to generate this)
echo "⚠️  Firebase Token needs to be generated manually:"
echo "   Run: firebase login:ci"
echo "   Then: gh secret set FIREBASE_TOKEN --body \"<token-from-firebase-login-ci>\""

# Firebase Service Account (need to generate this)
echo "⚠️  Firebase Service Account needs to be generated manually:"
echo "   1. Go to Firebase Console -> Project Settings -> Service Accounts"
echo "   2. Generate new private key for ai-status-dashboard-dev"
echo "   3. Download the JSON file"
echo "   4. Run: gh secret set FIREBASE_SERVICE_ACCOUNT_DEV --body \"$(cat path/to/service-account.json)\""

# Slack Webhook (optional - not needed for now)
echo "ℹ️  Slack webhook is optional and disabled in CI workflow"

echo "✅ GitHub secrets setup completed!"
echo "🔍 To verify secrets were created:"
echo "   gh secret list" 