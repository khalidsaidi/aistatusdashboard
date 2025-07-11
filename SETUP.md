# 🚀 AI Status Dashboard - Setup Guide

This guide will help you set up the AI Status Dashboard for local development.

## Prerequisites

- **Node.js 18+** (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- **npm** or **yarn** or **pnpm**
- **Git**
- **Firebase account** (for full functionality)

## Quick Start (Basic Setup)

```bash
# 1. Clone the repository
git clone https://github.com/khalidsaidi/aistatusdashboard.git
cd aistatusdashboard

# 2. Install dependencies
npm install

# 3. Start development server (demo mode)
npm run dev
```

Visit `http://localhost:3000` to see the dashboard running in demo mode.

## Full Setup (With Firebase)

For complete functionality including notifications, data persistence, and cloud functions:

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable the following services:
   - **Firestore Database**
   - **Cloud Functions**
   - **Firebase Hosting**
   - **Firebase Storage**

### 2. Get Firebase Credentials

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Go to Project Settings → General → Your apps
5. Add a web app and copy the config

### 3. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env.local

# Edit .env.local with your Firebase credentials
```

Fill in the following variables in `.env.local`:

```bash
# From your service account JSON
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL=your-client-email

# From your web app config
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
# ... (see .env.example for complete list)
```

### 4. Firebase Configuration

```bash
# Login to Firebase CLI
npm run firebase:login

# Update .firebaserc with your project IDs
# Edit .firebaserc and replace placeholder project IDs with your actual ones

# Initialize Firebase features (if needed)
npm run firebase:init
```

### 5. Deploy Functions (Optional)

```bash
# Deploy to development
npm run firebase:deploy:dev

# Or deploy to production
npm run firebase:deploy:prod
```

## Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
npm run test:e2e

# Linting and formatting
npm run lint
npm run format

# Type checking
npm run type-check
```

## Project Structure

```
aistatusdashboard/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── components/        # React components
│   └── page.tsx           # Main page
├── lib/                   # Core libraries
│   ├── providers.ts       # AI provider configurations
│   ├── status-fetcher.ts  # Status monitoring logic
│   └── database.ts        # Database operations
├── functions/             # Firebase Cloud Functions
├── public/                # Static assets
└── config/                # Configuration files
```

## Features by Setup Type

| Feature             | Demo Mode | With Firebase |
| ------------------- | --------- | ------------- |
| Status monitoring   | ✅        | ✅            |
| Real-time updates   | ✅        | ✅            |
| Historical data     | ❌        | ✅            |
| Email notifications | ❌        | ✅            |
| Webhooks            | ❌        | ✅            |
| Incident tracking   | ❌        | ✅            |
| Data persistence    | ❌        | ✅            |

## Troubleshooting

### Common Issues

**"Firebase not initialized" error:**

- Check your `.env.local` file has all required Firebase variables
- Ensure Firebase project has required services enabled

**API endpoints returning 404:**

- Make sure Firebase Functions are deployed
- Check your Firebase project configuration

**Build errors:**

- Run `npm run type-check` to identify TypeScript issues
- Ensure all dependencies are installed: `npm install`

### Getting Help

- 📖 **Documentation**: Check other `.md` files in the repository
- 🐛 **Issues**: [GitHub Issues](https://github.com/khalidsaidi/aistatusdashboard/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/khalidsaidi/aistatusdashboard/discussions)

## Contributing

Once you have the project running:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md)
2. Check [docs/GITHUB_WORKFLOW.md](docs/GITHUB_WORKFLOW.md) for development process
3. Look at open issues for contribution opportunities

## Next Steps

- **Add a new AI provider**: Edit `lib/providers.ts`
- **Customize the UI**: Modify components in `app/components/`
- **Add new features**: Follow the TDD approach outlined in the docs
- **Deploy your own instance**: See deployment guides in README.md

Happy coding! 🎉
