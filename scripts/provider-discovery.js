#!/usr/bin/env node

// AI Provider Discovery Script - Sends Real Email Notifications
// This script monitors AI provider status and sends real emails when changes are detected

const API_BASE = 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api';
const NOTIFICATION_EMAIL = 'admin@aistatusdashboard.com';

// Production script - console output removed for performance

async function fetchProviderStatus() {
  // Fetching provider status...

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${API_BASE}/status`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    // Provider status fetched successfully

    return data;
  } catch (error) {
    // Error fetching provider status
    throw error;
  }
}

async function sendEmailNotification(type, data) {
  try {
    const fetch = (await import('node-fetch')).default;
    let response;

    if (type === 'status_summary') {
      // Send status summary email
      const subject = `🤖 AI Provider Status Summary - ${data.summary.operational}/${data.summary.total} Operational`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>AI Provider Status Summary</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .summary { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 20px; margin: 20px 0; }
            .provider { padding: 10px; margin: 5px 0; border-radius: 3px; }
            .operational { background: #d4edda; border-left: 4px solid #28a745; }
            .degraded { background: #fff3cd; border-left: 4px solid #ffc107; }
            .down { background: #f8d7da; border-left: 4px solid #dc3545; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🤖 AI Provider Status Discovery Report</h1>
            
            <div class="summary">
              <h2>📊 Current Status Summary</h2>
              <p><strong>Total Providers:</strong> ${data.summary.total}</p>
              <p><strong>✅ Operational:</strong> ${data.summary.operational}</p>
              <p><strong>⚠️ Degraded:</strong> ${data.summary.degraded}</p>
              <p><strong>❌ Down:</strong> ${data.summary.down}</p>
              <p><strong>📅 Checked:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <h3>🔍 Provider Details</h3>
            ${data.providers
              .map(
                (provider) => `
              <div class="provider ${provider.status}">
                <strong>${provider.name}</strong> - ${provider.status.toUpperCase()}
                <br><small>Response Time: ${provider.responseTime}ms | Last Checked: ${new Date(provider.lastChecked).toLocaleString()}</small>
              </div>
            `
              )
              .join('')}
            
            <div class="footer">
              <p>This is a real email notification from your AI Status Dashboard provider discovery system.</p>
              <p>Dashboard: <a href="https://ai-status-dashboard-dev.web.app">https://ai-status-dashboard-dev.web.app</a></p>
            </div>
          </div>
        </body>
        </html>
      `;

      response = await fetch(`${API_BASE}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: NOTIFICATION_EMAIL,
          subject,
          html,
          text: `AI Provider Status Summary: ${data.summary.operational}/${data.summary.total} providers operational. Check the dashboard for details.`,
        }),
      });
    } else if (type === 'test_alert') {
      // Send test status alert
      response = await fetch(`${API_BASE}/sendTestNotification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: NOTIFICATION_EMAIL,
          type: 'status',
        }),
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
    } else {
    }

    return result;
  } catch (error) {
    throw error;
  }
}

async function runProviderDiscovery() {
  try {
    // 1. Fetch current provider status
    const statusData = await fetchProviderStatus();

    // 2. Send status summary email

    await sendEmailNotification('status_summary', statusData);

    // 3. Send test alert email

    await sendEmailNotification('test_alert');

    // 4. Summary
  } catch (error) {
    process.exit(1);
  }
}

// Run the discovery
runProviderDiscovery().catch((error) => {
  console.error('Provider discovery failed:', error);
  process.exit(1);
});
