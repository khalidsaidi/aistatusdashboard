# GitHub Secrets Setup for AI Provider Discovery

## Repository: khalidsaidi/aistatusdashboard

To configure the AI provider discovery workflow for production, you need to add these secrets to your GitHub repository.

⚠️ **IMPORTANT**: This file contains placeholder values for documentation purposes. Replace with your actual credentials when setting up.

### How to Add Secrets:
1. Go to: https://github.com/khalidsaidi/aistatusdashboard/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret below with your actual values

### Required Secrets for Production:

#### SMTP Configuration (Microsoft Office365)
```
Name: SMTP_HOST
Value: smtp.office365.com
```

```
Name: SMTP_USER  
Value: status@aistatusdashboard.com
```

```
Name: SMTP_PASSWORD
Value: xcsyvdyycpnsnzmx
```

```
Name: SMTP_PORT
Value: 587
```

```
Name: SMTP_SECURE
Value: false
```

#### Email Recipients
```
Name: DISCOVERY_EMAIL_RECIPIENT
Value: admin@aistatusdashboard.com
```

```
Name: DEFAULT_FROM
Value: noreply@aistatusdashboard.com
```

```
Name: DEFAULT_REPLY_TO
Value: support@aistatusdashboard.com
```

#### Site Configuration
```
Name: NEXT_PUBLIC_SITE_URL
Value: https://aistatusdashboard.com
```

### Optional Secrets (for enhanced notifications):

#### Webhook Notifications
```
Name: DISCOVERY_NOTIFICATION_WEBHOOK
Value: [your-slack-or-discord-webhook-url]
```

```
Name: SLACK_WEBHOOK_URL
Value: [your-slack-webhook-url]
```

### Quick Setup Commands (if using GitHub CLI):

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Set repository secrets (run these one by one with your actual values)
gh secret set SMTP_HOST --body "smtp.office365.com" --repo khalidsaidi/aistatusdashboard
gh secret set SMTP_USER --body "status@aistatusdashboard.com" --repo khalidsaidi/aistatusdashboard  
gh secret set SMTP_PASSWORD --body "xcsyvdyycpnsnzmx" --repo khalidsaidi/aistatusdashboard
gh secret set SMTP_PORT --body "587" --repo khalidsaidi/aistatusdashboard
gh secret set SMTP_SECURE --body "false" --repo khalidsaidi/aistatusdashboard
gh secret set DISCOVERY_EMAIL_RECIPIENT --body "admin@aistatusdashboard.com" --repo khalidsaidi/aistatusdashboard
gh secret set DEFAULT_FROM --body "noreply@aistatusdashboard.com" --repo khalidsaidi/aistatusdashboard
gh secret set DEFAULT_REPLY_TO --body "support@aistatusdashboard.com" --repo khalidsaidi/aistatusdashboard
gh secret set NEXT_PUBLIC_SITE_URL --body "https://aistatusdashboard.com" --repo khalidsaidi/aistatusdashboard
```

### Test the Workflow:
After adding the secrets:
1. Go to: https://github.com/khalidsaidi/aistatusdashboard/actions/workflows/ai-provider-discovery.yml
2. Click "Run workflow" 
3. Check for email at your configured email address
4. Verify the workflow completes successfully

### Environment Summary:
- **Development (localhost)**: Uses local environment variables or .env files
- **Production (GitHub Actions)**: Uses GitHub repository secrets
- **Testing**: Uses jest.env.js with environment variable fallbacks

### Security Notes:
- Never commit real credentials to this file
- Use environment variables for local development
- Use GitHub secrets for CI/CD workflows
- Rotate credentials regularly 