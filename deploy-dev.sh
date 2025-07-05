#!/bin/bash

echo "🚀 Deploying to dev environment..."

# Switch to dev project
firebase use ai-status-dashboard-dev

# Build functions
cd functions
npm run build
cd ..

# Deploy functions only
firebase deploy --only functions --force

echo "✅ Deployment to dev complete!"
