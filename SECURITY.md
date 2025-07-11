# 🔒 Security Guidelines

## Secret Management

### ❌ Never Commit These Files

- `*.env` (except `.env.example`)
- `service-account*.json`
- `*firebase-adminsdk*.json`
- `*.key`, `*.pem`, `*.crt`
- `*.token`, `*.api-key`
- Files in `secrets/` or `credentials/` directories

### ✅ Safe to Commit

- `.env.example` files with placeholder values
- Configuration templates with `your-value-here` placeholders
- Public Firebase configuration (project IDs, etc.)

### 🛡️ Environment File Setup

1. **Copy example files:**

   ```bash
   cp .env.example .env.local
   cp environments/production.env.example environments/production.env
   ```

2. **Replace placeholder values:**

   ```bash
   # Replace 'your-api-key-here' with actual values
   FIREBASE_API_KEY=your-actual-api-key
   ```

3. **Verify .gitignore coverage:**
   ```bash
   git status  # Should not show your .env files
   ```

### 🚨 If You Accidentally Commit Secrets

1. **Immediately rotate the exposed credentials**
2. **Remove from git history:**
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch path/to/secret-file" \
   --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push (⚠️ dangerous):**
   ```bash
   git push origin --force --all
   ```

### 🔍 GitHub Security Scanning

Our repository uses:

- **GitHub Secret Scanning** - Automatically detects exposed secrets
- **TruffleHog** - Scans for secrets in CI/CD
- **CodeQL** - Static analysis for security vulnerabilities

### 📧 Security Alerts

When GitHub detects secrets:

1. **Email alerts** are sent immediately
2. **CI/CD pipeline fails** and blocks deployment
3. **Security tab** shows detailed findings
4. **Fix immediately** by rotating credentials and removing from git

### 🛠️ Local Development

Use environment variables or local files:

```bash
# Local development
export FIREBASE_API_KEY="your-dev-key"
npm run dev

# Or use .env.local file
echo "FIREBASE_API_KEY=your-dev-key" >> .env.local
```

### 🏭 Production Deployment

All production secrets are managed via:

- **GitHub Secrets** for CI/CD
- **Firebase Environment Config** for Cloud Functions
- **Vercel/Hosting Environment Variables** for frontend

Never hardcode production credentials in source code.

## Reporting Security Issues

Email security issues to: `security@aistatusdashboard.com`

Do not create public GitHub issues for security vulnerabilities.
