# 🚀 Deployment Guide

## Overview

This guide explains how to deploy the AI Status Dashboard to your own infrastructure while maintaining security and functionality.

## 🔧 Configuration

The project uses environment variables for all configuration. **No hardcoded values** are required to be changed in the source code.

### Required Environment Variables

Copy the appropriate example file and configure:

```bash
# For development
cp env.example .env.local

# For production  
cp env.production.example .env.production
```

### Core Configuration

```bash
# === SITE CONFIGURATION ===
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_API_BASE_URL=https://region-your-project.cloudfunctions.net

# === FIREBASE CONFIGURATION ===
FIREBASE_PROJECT_ID=your-firebase-project
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
# ... other Firebase config
```

### Optional Deployment Overrides

These variables allow you to override the default project naming:

```bash
# Override default Firebase projects
DEFAULT_FIREBASE_PROJECT_ID=your-prod-project
DEFAULT_FIREBASE_DEV_PROJECT_ID=your-dev-project

# Override default region
FIREBASE_FUNCTIONS_REGION=europe-west1

# Override production site URL
PRODUCTION_SITE_URL=https://your-domain.com
```

## 🔥 Firebase Setup

### 1. Create Firebase Projects

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Create projects
firebase projects:create your-dev-project
firebase projects:create your-prod-project
```

### 2. Initialize Firebase

```bash
# Initialize in your project directory
firebase init

# Select:
# - Firestore
# - Functions  
# - Hosting
# - Storage
```

### 3. Configure Projects

Update `.firebaserc`:

```json
{
  "projects": {
    "default": "your-dev-project",
    "dev": "your-dev-project",
    "prod": "your-prod-project"
  }
}
```

### 4. Update Firebase Hosting

Edit `firebase.json` redirect destination:

```json
{
  "hosting": {
    "redirects": [
      {
        "source": "**",
        "destination": "https://your-domain.com",
        "type": 301
      }
    ]
  }
}
```

## 🛡️ Security Configuration

### Firestore Rules

The included `firestore.rules` provides secure defaults:

- ✅ Public read access to status data
- ✅ Server-only write access  
- ✅ User-scoped subscriptions
- ✅ Authenticated comments with validation

### Storage Rules

The included `storage.rules` provides secure defaults:

- ✅ Public read for status/logos
- ✅ Server-only write access
- ✅ User-scoped uploads
- ❌ No unauthorized access

### Environment Security

- ✅ All secrets in environment variables
- ✅ No hardcoded credentials
- ✅ Gitignored sensitive files
- ✅ Separate dev/prod projects

## 🚀 Deployment Steps

### Development Deployment

```bash
# Set development project
firebase use dev

# Deploy to development
npm run build
firebase deploy
```

### Production Deployment

```bash
# Set production project  
firebase use prod

# Deploy to production
npm run build
firebase deploy
```

### Automated Deployment

Use GitHub Actions with secrets:

```yaml
env:
  FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
  FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
```

## 🔍 Verification

After deployment, verify:

1. **Site loads**: Visit your domain
2. **API works**: Check `/api/status` endpoint
3. **Storage secure**: Test file upload restrictions
4. **Functions work**: Test Cloud Functions endpoints

## 🆘 Troubleshooting

### Common Issues

**Firebase project not found**
- Check `.firebaserc` configuration
- Verify project exists: `firebase projects:list`

**Functions deployment fails**
- Check `functions/package.json` dependencies
- Verify Node.js version compatibility

**Storage rules too restrictive**
- Review `storage.rules` for your use case
- Test with Firebase console

**Environment variables not loading**
- Check file names: `.env.local` vs `.env.development`
- Verify no syntax errors in env files

### Support

- 📖 [Firebase Documentation](https://firebase.google.com/docs)
- 🐛 [Report Issues](https://github.com/khalidsaidi/aistatusdashboard/issues)
- 💬 [Discussions](https://github.com/khalidsaidi/aistatusdashboard/discussions)

## 📝 License

This project is MIT licensed. See [LICENSE](LICENSE) for details. 