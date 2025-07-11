#!/usr/bin/env node

const fs = require('fs');
const path = require('path');




// Read service account keys
const devKeyPath = path.join(process.cwd(), 'dev-servicekey.json');
const prodKeyPath = path.join(process.cwd(), 'prod-servicekey.json');

if (!fs.existsSync(devKeyPath)) {
  
  process.exit(1);
}

if (!fs.existsSync(prodKeyPath)) {
  
  process.exit(1);
}

try {
  const devKey = JSON.parse(fs.readFileSync(devKeyPath, 'utf8'));
  const prodKey = JSON.parse(fs.readFileSync(prodKeyPath, 'utf8'));

  // Create .env.local for development
  const devEnvContent = `# Firebase Development Environment
FIREBASE_PROJECT_ID=${devKey.project_id}
FIREBASE_PRIVATE_KEY_ID=${devKey.private_key_id}
FIREBASE_PRIVATE_KEY="${devKey.private_key.replace(/\n/g, '\\n')}"
FIREBASE_CLIENT_EMAIL=${devKey.client_email}
FIREBASE_CLIENT_ID=${devKey.client_id}
FIREBASE_AUTH_URI=${devKey.auth_uri}
FIREBASE_TOKEN_URI=${devKey.token_uri}
FIREBASE_CLIENT_X509_CERT_URL=${devKey.client_x509_cert_url}

# Firebase Web App Config (Dev)
NEXT_PUBLIC_FIREBASE_API_KEY="your_firebase_api_key_here"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="ai-status-dashboard-dev.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="ai-status-dashboard-dev"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="ai-status-dashboard-dev.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="413124782229"
NEXT_PUBLIC_FIREBASE_APP_ID="1:413124782229:web:81c009a0e73157e21e139c"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-C7VKHPDHQM"

# Google Analytics (Keep existing GA4)
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-HPNE6D3YQW"

# Development Environment
NODE_ENV=development
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
`;

  // Create .env.production for production
  const prodEnvContent = `# Firebase Production Environment
FIREBASE_PROJECT_ID=${prodKey.project_id}
FIREBASE_PRIVATE_KEY_ID=${prodKey.private_key_id}
FIREBASE_PRIVATE_KEY="${prodKey.private_key.replace(/\n/g, '\\n')}"
FIREBASE_CLIENT_EMAIL=${prodKey.client_email}
FIREBASE_CLIENT_ID=${prodKey.client_id}
FIREBASE_AUTH_URI=${prodKey.auth_uri}
FIREBASE_TOKEN_URI=${prodKey.token_uri}
FIREBASE_CLIENT_X509_CERT_URL=${prodKey.client_x509_cert_url}

# Firebase Web App Config (Prod)
NEXT_PUBLIC_FIREBASE_API_KEY="***REMOVED***"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="ai-status-dashboard.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="ai-status-dashboard"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="ai-status-dashboard.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="401066429430"
NEXT_PUBLIC_FIREBASE_APP_ID="1:401066429430:web:88df5e30e599ab6c3e15d7"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-ZV3PS0MPQ7"

# Google Analytics (Keep existing GA4)
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-HPNE6D3YQW"

# Production Environment
NODE_ENV=production
NEXT_PUBLIC_SITE_URL="https://ai-status-dashboard.web.app"
`;

  // Write environment files
  fs.writeFileSync('.env.local', devEnvContent);
  fs.writeFileSync('.env.production', prodEnvContent);

  
  
  
  // Update .gitignore to ensure service keys and env files are ignored
  const gitignorePath = '.gitignore';
  let gitignoreContent = '';
  
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }
  
  const ignorePatterns = [
    '# Firebase service account keys',
    'dev-servicekey.json',
    'prod-servicekey.json',
    '# Environment files',
    '.env.local',
    '.env.production'
  ];
  
  let needsUpdate = false;
  ignorePatterns.forEach(pattern => {
    if (!gitignoreContent.includes(pattern)) {
      gitignoreContent += '\n' + pattern;
      needsUpdate = true;
    }
  });
  
  if (needsUpdate) {
    fs.writeFileSync(gitignorePath, gitignoreContent);
    
  }

  
  
  
  
  

} catch (error) {
  
  process.exit(1);
} 