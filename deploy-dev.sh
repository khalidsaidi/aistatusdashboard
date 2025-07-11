#!/bin/bash

# Deploy to Firebase development environment
echo "🚀 Deploying to Firebase development environment..."

# Set the Firebase project to development
firebase use ai-status-dashboard-dev

# Deploy functions and hosting
firebase deploy --only functions,hosting

echo "✅ Deployment to development environment complete!"
echo "🌐 Your app is live at: https://ai-status-dashboard-dev.web.app" 