#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables if not in GitHub Actions
if (!process.env.GITHUB_ACTIONS) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
  } catch (error) {
    // dotenv not available, continue without it
  }
}

// Load configuration
function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config', 'discovery-sources.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Override with environment variables
    config.notification.email.to = process.env.NOTIFICATION_EMAIL || 'admin@example.com';
    config.notification.email.from = 'ai-discovery@yourdomain.com';
    
    return config;
  } catch (error) {
    
    
    
    // Fallback configuration
    return {
      sources: [
        {
          name: 'GitHub AI Awesome Lists',
          url: 'https://api.github.com/search/repositories?q=awesome+ai+llm+language+model&sort=updated&per_page=10',
          type: 'github',
          enabled: true,
          confidence: 0.7
        }
      ],
      knownProviders: [
        'openai', 'anthropic', 'google-ai', 'huggingface', 'cohere', 
        'replicate', 'groq', 'deepseek', 'meta', 'xai', 'perplexity', 
        'claude', 'mistral', 'aws', 'azure'
      ],
      filters: {
        minLength: 3,
        maxLength: 20,
        excludeWords: ['api', 'www', 'http', 'https', 'com', 'org', 'net'],
        requiredConfidence: 0.5
      },
      notification: {
        email: {
          enabled: true,
          to: process.env.NOTIFICATION_EMAIL || 'admin@example.com',
          from: 'ai-discovery@yourdomain.com'
        },
        github: {
          enabled: true,
          createIssue: true,
          labels: ['ai-discovery', 'automated']
        }
      }
    };
  }
}

const CONFIG = loadConfig();

class AIProviderDiscovery {
  constructor() {
    this.newProviders = [];
    this.errors = [];
  }

  async run() {
    
    
    
    try {
      await this.discoverFromAllSources();
      await this.analyzeResults();
      await this.sendNotifications();
      await this.updateResults();
    } catch (error) {
      
      await this.sendErrorNotification(error);
    }
  }

  async discoverFromAllSources() {
    
    
    // Filter enabled sources only
    const enabledSources = CONFIG.sources.filter(source => source.enabled !== false);
    
    
    const promises = enabledSources.map(source => this.fetchFromSource(source));
    const results = await Promise.allSettled(promises);
    
    this.discoveredProviders = [];
    
    results.forEach((result, index) => {
      const source = enabledSources[index];
      if (result.status === 'fulfilled') {
        
        this.discoveredProviders.push(...result.value);
      } else {
        
        this.errors.push(`${source.name}: ${result.reason.message}`);
      }
    });
  }

  async fetchFromSource(source) {
    
    
    switch (source.type) {
      case 'github':
        return await this.fetchFromGitHub(source);
      case 'html':
        return await this.fetchFromHTML(source);
      case 'api':
        return await this.fetchFromAPI(source);
      case 'reddit':
        return await this.fetchFromReddit(source);
      default:
        throw new Error(`Unknown source type: ${source.type}`);
    }
  }

  async fetchFromGitHub(source) {
    const data = await this.makeRequest(source.url, {
      'User-Agent': 'AI-Status-Dashboard-Discovery/1.0',
      'Accept': 'application/vnd.github.v3+json'
    });
    
    const repos = JSON.parse(data).items || [];
    const providers = [];
    
    for (const repo of repos.slice(0, 5)) {
      try {
        // Fetch README to extract AI provider mentions
        const readmeUrl = `https://api.github.com/repos/${repo.full_name}/readme`;
        const readmeData = await this.makeRequest(readmeUrl, {
          'User-Agent': 'AI-Status-Dashboard-Discovery/1.0',
          'Accept': 'application/vnd.github.v3+json'
        });
        
        const readme = JSON.parse(readmeData);
        const content = Buffer.from(readme.content, 'base64').toString('utf8').toLowerCase();
        
        // Use configured patterns or default ones
        const patterns = source.patterns || [
          '(?:api\\.)?([a-z0-9-]+)\\.(?:ai|com|org)(?:\\/api)?',
          '([a-z0-9-]+)\\s+(?:ai|llm|language model|api)',
          '(?:https?:\\/\\/)?([a-z0-9-]+)\\.(?:openai|anthropic|cohere|huggingface)'
        ];
        
        patterns.forEach(patternStr => {
          const pattern = new RegExp(patternStr, 'g');
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const provider = this.normalizeProviderName(match[1]);
            if (this.isValidProvider(provider)) {
              providers.push({
                name: provider,
                source: `GitHub: ${repo.full_name}`,
                url: repo.html_url,
                description: repo.description || source.description || 'Found in awesome list',
                confidence: source.confidence || 0.7
              });
            }
          }
        });
      } catch (error) {
        
      }
    }
    
    return this.deduplicateProviders(providers);
  }

  async fetchFromHTML(source) {
    const data = await this.makeRequest(source.url);
    const providers = [];
    
    // Use configured patterns or default ones
    const patterns = source.patterns || [
      '(?:https?:\\/\\/)?(?:api\\.)?([a-z0-9-]+)\\.(?:ai|com|org)(?:\\/api)?',
      '([a-z0-9-]+)\\s+(?:ai|api|llm)',
      '"([a-z0-9-]+)"\\s*:\\s*"[^"]*(?:ai|llm|language|model)'
    ];
    
    patterns.forEach(patternStr => {
      const pattern = new RegExp(patternStr, 'gi');
      let match;
      while ((match = pattern.exec(data)) !== null) {
        const provider = this.normalizeProviderName(match[1]);
        if (this.isValidProvider(provider)) {
          providers.push({
            name: provider,
            source: source.name,
            url: source.url,
            description: source.description || 'Found via web scraping',
            confidence: source.confidence || 0.6
          });
        }
      }
    });
    
    return this.deduplicateProviders(providers);
  }

  async fetchFromAPI(source) {
    const data = await this.makeRequest(source.url);
    const json = JSON.parse(data);
    const providers = [];
    
    // Process API response based on structure
    if (Array.isArray(json)) {
      json.forEach(item => {
        if (item.name || item.id) {
          const provider = this.normalizeProviderName(item.name || item.id);
          if (this.isValidProvider(provider)) {
            providers.push({
              name: provider,
              source: source.name,
              url: source.url,
              description: item.description || 'Found via API',
              confidence: source.confidence || 0.8
            });
          }
        }
      });
    }
    
    return this.deduplicateProviders(providers);
  }

  async fetchFromReddit(source) {
    const data = await this.makeRequest(source.url);
    const json = JSON.parse(data);
    const providers = [];
    
    // Process Reddit API response
    if (json.data && json.data.children) {
      json.data.children.forEach(post => {
        const title = (post.data.title || '').toLowerCase();
        const selftext = (post.data.selftext || '').toLowerCase();
        const content = `${title} ${selftext}`;
        
        // Use configured patterns or default ones
        const defaultPatterns = [
          '([a-z0-9-]+)\\.ai',
          '([a-z0-9-]+)\\s+(?:AI|API|LLM)',
          '\\b([a-z0-9-]+)\\s+(?:launches|releases|announces)'
        ];
        
        const patternStrings = source.patterns || defaultPatterns;
        
        patternStrings.forEach(patternStr => {
          // Convert string patterns to RegExp objects
          const pattern = new RegExp(patternStr, 'gi');
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const provider = this.normalizeProviderName(match[1]);
            if (this.isValidProvider(provider)) {
              providers.push({
                name: provider,
                source: `${source.name}: ${post.data.title}`,
                url: `https://reddit.com${post.data.permalink}`,
                description: post.data.title || 'Found in Reddit discussion',
                confidence: source.confidence || 0.5
              });
            }
          }
        });
      });
    }
    
    return this.deduplicateProviders(providers);
  }

  normalizeProviderName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^(api|www|chat|gpt|llm)[-.]?/g, '')
      .replace(/[-.]?(api|ai|llm|gpt)$/g, '')
      .trim();
  }

  isValidProvider(name) {
    const filters = CONFIG.filters || {};
    const minLength = filters.minLength || 3;
    const maxLength = filters.maxLength || 20;
    const excludeWords = filters.excludeWords || ['api', 'www', 'http', 'https', 'com', 'org', 'net'];
    
    return name && 
           name.length >= minLength && 
           name.length <= maxLength &&
           !excludeWords.includes(name) &&
           !/^\d+$/.test(name);
  }

  deduplicateProviders(providers) {
    const seen = new Set();
    return providers.filter(provider => {
      const key = provider.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async analyzeResults() {
    
    
    // Use discovered providers from sources
    const allDiscovered = this.discoveredProviders || [];
    
    // Filter out known providers and apply confidence threshold
    this.newProviders = allDiscovered.filter(provider => {
      const isNew = !CONFIG.knownProviders.includes(provider.name);
      const meetsConfidence = provider.confidence >= (CONFIG.filters?.requiredConfidence || 0.5);
      return isNew && meetsConfidence;
    });
    
    // Sort by confidence score
    this.newProviders.sort((a, b) => b.confidence - a.confidence);
    
    // Limit results
    const maxResults = CONFIG.storage?.maxResultsPerRun || 50;
    if (this.newProviders.length > maxResults) {
      
      this.newProviders = this.newProviders.slice(0, maxResults);
    }
    
    
    
    
    
    
  }

  async sendNotifications() {
    if (this.newProviders.length === 0 && this.errors.length === 0) {
      
      return;
    }
    
    const subject = `🤖 AI Provider Discovery Report - ${this.newProviders.length} new providers found`;
    const body = this.generateEmailBody();
    
    
    await this.sendEmail(subject, body);
  }

  generateEmailBody() {
    let body = `# AI Provider Discovery Report\n\n`;
    body += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
    
    if (this.newProviders.length > 0) {
      body += `## 🆕 New Providers Discovered (${this.newProviders.length})\n\n`;
      
      this.newProviders.forEach((provider, index) => {
        body += `### ${index + 1}. ${provider.name}\n`;
        body += `- **Source:** ${provider.source}\n`;
        body += `- **Description:** ${provider.description}\n`;
        body += `- **Confidence:** ${(provider.confidence * 100).toFixed(0)}%\n`;
        body += `- **URL:** ${provider.url}\n\n`;
      });
      
      body += `## 🔧 Next Steps\n\n`;
      body += `1. Review each provider for legitimacy\n`;
      body += `2. Check if they have public status pages\n`;
      body += `3. Add valid providers to the dashboard configuration\n`;
      body += `4. Update the known providers list\n\n`;
    }
    
    if (this.errors.length > 0) {
      body += `## ⚠️ Errors Encountered\n\n`;
      this.errors.forEach(error => {
        body += `- ${error}\n`;
      });
      body += `\n`;
    }
    
    body += `---\n`;
    body += `Generated by AI Status Dashboard Discovery Bot\n`;
    body += `Repository: https://github.com/khalidsaidi/aistatusdashboard\n`;
    
    return body;
  }

  async sendEmail(subject, body) {
    // Send REAL emails using configured email service
    
    if (process.env.ENABLE_REAL_EMAIL_SENDING !== 'true') {
      
      
      
      return;
    }

    if (process.env.GITHUB_ACTIONS) {
      // In GitHub Actions, send real email AND create an issue
      await this.sendRealEmail(subject, body);
      await this.createGitHubIssue(subject, body);
    } else {
      // Local development - send real email
      await this.sendRealEmail(subject, body);
    }
  }

  async sendRealEmail(subject, body) {
    try {
      // Check if email credentials are configured
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        
        return;
      }

      const nodemailer = require('nodemailer');
      
      // Create transporter with real SMTP configuration
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      // Verify SMTP connection
      await transporter.verify();

      const recipientEmail = process.env.DISCOVERY_EMAIL_RECIPIENT || CONFIG.notification.email.to;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

      // Create HTML email content
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>AI Provider Discovery Report</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
            .new-providers { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0; }
            .provider { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 3px; padding: 10px; margin: 10px 0; }
            .errors { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
            pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🤖 AI Provider Discovery Report</h1>
              <p>Automated discovery scan completed at ${new Date().toLocaleString()}</p>
            </div>

            ${this.newProviders.length > 0 ? `
            <div class="new-providers">
              <h2>🎉 New Providers Discovered (${this.newProviders.length})</h2>
              ${this.newProviders.map(provider => `
                <div class="provider">
                  <h3>${provider.name}</h3>
                  <p><strong>URL:</strong> <a href="${provider.url}">${provider.url}</a></p>
                  <p><strong>Status Page:</strong> <a href="${provider.statusPageUrl}">${provider.statusPageUrl}</a></p>
                  <p><strong>Detection Method:</strong> ${provider.detectionMethod}</p>
                  <p><strong>Confidence:</strong> ${provider.confidence}</p>
                </div>
              `).join('')}
            </div>
            ` : '<p>✅ No new providers discovered in this scan.</p>'}

            ${this.errors.length > 0 ? `
            <div class="errors">
              <h2>⚠️ Discovery Errors (${this.errors.length})</h2>
              ${this.errors.map(error => `
                <div class="provider">
                  <p><strong>URL:</strong> ${error.url}</p>
                  <p><strong>Error:</strong> ${error.error}</p>
                </div>
              `).join('')}
            </div>
            ` : ''}

            <div class="footer">
              <p>This report was generated by the AI Status Dashboard provider discovery system.</p>
              <p>Visit the <a href="${siteUrl}">AI Status Dashboard</a> to view current status.</p>
              <p>To configure this notification, update the DISCOVERY_EMAIL_RECIPIENT environment variable.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.DEFAULT_FROM || process.env.SMTP_USER,
        to: recipientEmail,
        subject: subject,
        text: body,
        html: htmlBody
      };

      const result = await transporter.sendMail(mailOptions);
      
      
      
      
      

      // Also send to webhook if configured
      await this.sendWebhookNotification(subject, body);

    } catch (error) {
      
      
      
      
    }
  }

  async sendWebhookNotification(subject, body) {
    try {
      const webhookUrl = process.env.DISCOVERY_NOTIFICATION_WEBHOOK;
      if (!webhookUrl) {
        return; // No webhook configured
      }

      const payload = {
        text: `${subject}\n\n${body}`,
        username: 'AI Status Dashboard',
        icon_emoji: ':robot_face:',
        attachments: [
          {
            color: this.newProviders.length > 0 ? 'good' : 'warning',
            title: subject,
            text: body,
            footer: 'AI Status Dashboard Provider Discovery',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        
      } else {
        
      }
    } catch (error) {
      
    }
  }

  async createGitHubIssue(title, body) {
    if (!process.env.GITHUB_TOKEN) {
      
      return;
    }
    
    const issueData = {
      title: title,
      body: body,
      labels: ['ai-discovery', 'automated']
    };
    
    const options = {
      hostname: 'api.github.com',
      path: '/repos/khalidsaidi/aistatusdashboard/issues',
      method: 'POST',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'AI-Status-Dashboard-Discovery/1.0',
        'Content-Type': 'application/json'
      }
    };
    
    try {
      await this.makeHttpRequest(options, JSON.stringify(issueData));
      
    } catch (error) {
      
    }
  }

  async updateResults() {
    const results = {
      timestamp: new Date().toISOString(),
      newProviders: this.newProviders,
      errors: this.errors,
      summary: {
        totalDiscovered: this.newProviders.length,
        highConfidence: this.newProviders.filter(p => p.confidence > 0.7).length,
        sourcesChecked: CONFIG.sources.length,
        errorsCount: this.errors.length
      }
    };
    
    // Save results for historical tracking
    const resultsPath = path.join(__dirname, '..', 'logs', 'discovery-results.json');
    
    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(resultsPath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Load existing results
      let allResults = [];
      if (fs.existsSync(resultsPath)) {
        allResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      }
      
      // Add new results
      allResults.push(results);
      
      // Keep only last 30 days of results
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      allResults = allResults.filter(r => new Date(r.timestamp) > thirtyDaysAgo);
      
      // Save updated results
      fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
      
      
    } catch (error) {
      
    }
  }

  async sendErrorNotification(error) {
    const subject = '🚨 AI Provider Discovery Failed';
    const body = `# Discovery Error Report\n\n**Date:** ${new Date().toLocaleDateString()}\n\n**Error:** ${error.message}\n\n**Stack Trace:**\n\`\`\`\n${error.stack}\n\`\`\`\n\nPlease check the discovery script and fix any issues.`;
    
    await this.sendEmail(subject, body);
  }

  makeRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'AI-Status-Dashboard-Discovery/1.0',
          ...headers
        }
      };
      
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      }).on('error', reject);
    });
  }

  makeHttpRequest(options, data) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }
}

// Run if called directly
if (require.main === module) {
  const discovery = new AIProviderDiscovery();
  discovery.run().catch(error => {
    console.error('❌ Discovery failed:', error.message);
    process.exit(1);
  });
}

module.exports = AIProviderDiscovery;