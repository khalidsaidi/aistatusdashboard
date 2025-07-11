#!/usr/bin/env node

// Production Environment Setup Script
// Configures environment variables for production deployment

const fs = require('fs');
const path = require('path');

const PRODUCTION_ENV_CONFIG = `# === PRODUCTION ENVIRONMENT CONFIGURATION ===
NODE_ENV=production

# === EMAIL CONFIGURATION ===
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=khalid@microsoft.com
SMTP_PASSWORD=your-microsoft-app-password
DEFAULT_FROM=AI Status Dashboard <noreply@aistatusdashboard.com>
DEFAULT_REPLY_TO=support@aistatusdashboard.com

# === TEST EMAIL CONFIGURATION ===
TEST_EMAIL_PROD=khalid@microsoft.com
TEST_EMAIL_DEV=khalidsaidi66@gmail.com

# === MONITORING CONFIGURATION ===
ENABLE_REAL_MONITORING=true
ENABLE_REAL_NOTIFICATIONS=true
ENABLE_REAL_EMAIL_SENDING=true
APP_ENABLE_REAL_MONITORING=true

# === FIREBASE CONFIGURATION ===
NEXT_PUBLIC_API_BASE_URL=https://us-central1-ai-status-dashboard-prod.cloudfunctions.net

# === SITE CONFIGURATION ===
NEXT_PUBLIC_SITE_URL=https://aistatusdashboard.com
APP_BASE_URL=https://aistatusdashboard.com

# === RATE LIMITING ===
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=60000

# === DISCOVERY CONFIGURATION ===
DISCOVERY_EMAIL_RECIPIENT=admin@aistatusdashboard.com

# === FIREBASE CLOUD MESSAGING ===
FCM_SENDER_ID=413124782229
NEXT_PUBLIC_FCM_VAPID_KEY=BMYqIaqVu5CNkN04mVnyidHNjKkBtNmwACTW1mbfQdcWLC9lH47hTBeonwFqRJMZLh3qTsA3750tvYGji8POR34
FCM_VAPID_PRIVATE_KEY=your-production-vapid-private-key
`;

async function setupProductionEnvironment() {
  console.log('🚀 Setting up production environment configuration...');

  try {
    // Write production environment template
    const envProdPath = path.join(process.cwd(), '.env.production.template');
    fs.writeFileSync(envProdPath, PRODUCTION_ENV_CONFIG);
    console.log('✅ Created .env.production.template');

    console.log('\n📋 PRODUCTION SETUP INSTRUCTIONS:');
    console.log('1. Copy .env.production.template to .env.production');
    console.log('2. Update SMTP_PASSWORD with your Microsoft app password');
    console.log('3. Update FCM_VAPID_PRIVATE_KEY with your production VAPID private key');
    console.log('4. Deploy Firebase Functions to production project');
    console.log('5. Update NEXT_PUBLIC_API_BASE_URL to production Firebase Functions URL');

    console.log('\n🔧 KEY DIFFERENCES - DEV vs PROD:');
    console.log('📧 Email: khalidsaidi66@gmail.com (dev) → khalid@microsoft.com (prod)');
    console.log('🔗 API: ai-status-dashboard-dev → ai-status-dashboard-prod');
    console.log('🌐 Site: localhost:3000 → aistatusdashboard.com');
  } catch (error) {
    console.error('❌ Failed to setup production environment:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setupProductionEnvironment();
}

module.exports = { setupProductionEnvironment };
