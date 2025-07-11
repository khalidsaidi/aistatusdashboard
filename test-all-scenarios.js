const { chromium } = require('playwright');

async function testAllScenarios() {
  console.log('🚀 Starting COMPREHENSIVE Development Testing...');
  console.log('📧 Testing Gmail notifications to: khalidsaidi66@gmail.com');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 2000 // Slow down for better observation
  });
  const page = await browser.newPage();
  
  // Capture all network requests
  const requests = [];
  const responses = [];
  
  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
    console.log(`📤 Request: ${request.method()} ${request.url()}`);
  });
  
  page.on('response', (response) => {
    responses.push({
      url: response.url(),
      status: response.status(),
      statusText: response.statusText()
    });
    console.log(`📥 Response: ${response.status()} ${response.url()}`);
  });
  
  try {
    console.log('\n=== PHASE 1: DASHBOARD TESTING ===');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Test dashboard functionality
    console.log('✅ Dashboard loaded');
    const statusCount = await page.locator('[data-testid="provider-card"], .status-card, .provider-status').count();
    console.log(`📊 Found ${statusCount} provider status elements`);
    
    console.log('\n=== PHASE 2: NOTIFICATIONS TESTING ===');
    
    // Navigate to notifications
    const notificationsTab = page.locator('text=🔔 Notifications');
    await notificationsTab.click();
    await page.waitForTimeout(2000);
    console.log('🔔 Notifications tab clicked');
    
    // Test Email Alerts Tab
    console.log('\n--- Testing Email Alerts ---');
    const emailTab = page.locator('text=📧 Email Alerts');
    await emailTab.click();
    await page.waitForTimeout(1000);
    
    // Fill email form
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('khalidsaidi66@gmail.com');
    console.log('📧 Email filled: khalidsaidi66@gmail.com');
    
    // Select some providers
    const openaiCheckbox = page.locator('text=Openai').locator('input[type="checkbox"]');
    if (await openaiCheckbox.isVisible()) {
      await openaiCheckbox.check();
      console.log('✅ Selected OpenAI provider');
    }
    
    const anthropicCheckbox = page.locator('text=Anthropic').locator('input[type="checkbox"]');
    if (await anthropicCheckbox.isVisible()) {
      await anthropicCheckbox.check();
      console.log('✅ Selected Anthropic provider');
    }
    
    // Submit email subscription
    const subscribeButton = page.locator('button:has-text("Subscribe to Email Alerts")');
    await subscribeButton.click();
    await page.waitForTimeout(3000);
    console.log('📤 Email subscription submitted');
    
    // Check for success message
    const successMessage = await page.locator('text=✅').first().textContent();
    if (successMessage) {
      console.log('✅ Email subscription result:', successMessage);
    }
    
    // Test Web Push Notifications
    console.log('\n--- Testing Web Push Notifications ---');
    const webPushTab = page.locator('text=🔔 Web Push');
    await webPushTab.click();
    await page.waitForTimeout(1000);
    
    // Check push notification support
    const pushContent = await page.textContent('body');
    if (pushContent.includes('Browser Push Notifications')) {
      console.log('🔔 Push notifications section found');
      
      // Try to enable push notifications (will require user permission)
      const enablePushButton = page.locator('button:has-text("Enable Push Notifications")');
      if (await enablePushButton.isVisible() && !await enablePushButton.isDisabled()) {
        console.log('🔔 Attempting to enable push notifications...');
        await enablePushButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Test Webhooks
    console.log('\n--- Testing Webhooks ---');
    const webhooksTab = page.locator('text=🪝 Webhooks');
    await webhooksTab.click();
    await page.waitForTimeout(1000);
    
    const webhookUrlInput = page.locator('input[placeholder*="webhook"]');
    if (await webhookUrlInput.isVisible()) {
      await webhookUrlInput.fill('https://webhook.site/test-ai-status');
      console.log('🪝 Webhook URL filled');
      
      const registerWebhookButton = page.locator('button:has-text("Register Webhook")');
      await registerWebhookButton.click();
      await page.waitForTimeout(2000);
      console.log('📤 Webhook registration submitted');
    }
    
    // Test Incidents Tab
    console.log('\n--- Testing Incidents ---');
    const incidentsTab = page.locator('text=📋 Incidents');
    await incidentsTab.click();
    await page.waitForTimeout(2000);
    console.log('📋 Incidents tab loaded');
    
    console.log('\n=== PHASE 3: COMMENTS TESTING ===');
    
    // Navigate to comments
    const commentsTab = page.locator('text=💬 Comments');
    await commentsTab.click();
    await page.waitForTimeout(2000);
    console.log('💬 Comments tab clicked');
    
    // Fill comment form
    const nameInput = page.locator('input[placeholder*="name"]');
    await nameInput.fill('Test User Dev');
    console.log('👤 Name filled: Test User Dev');
    
    const emailCommentInput = page.locator('input[placeholder*="email"]');
    await emailCommentInput.fill('khalidsaidi66@gmail.com');
    console.log('📧 Email filled for comment');
    
    // Select comment type
    const commentTypeSelect = page.locator('select');
    await commentTypeSelect.selectOption('feedback');
    console.log('💬 Comment type selected: feedback');
    
    // Fill message
    const messageTextarea = page.locator('textarea[placeholder*="thoughts"]');
    await messageTextarea.fill('This is a comprehensive test of the comments system in development environment. Testing all functionality before production deployment.');
    console.log('📝 Comment message filled');
    
    // Submit comment
    const postCommentButton = page.locator('button:has-text("Post Comment")');
    await postCommentButton.click();
    await page.waitForTimeout(3000);
    console.log('📤 Comment submitted');
    
    // Check for comment success
    const commentResult = await page.locator('text=✅').first().textContent();
    if (commentResult) {
      console.log('✅ Comment result:', commentResult);
    }
    
    // Refresh to see if comment appears
    const refreshButton = page.locator('button:has-text("Refresh")');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(2000);
      console.log('🔄 Comments refreshed');
    }
    
    console.log('\n=== PHASE 4: API TESTING ===');
    
    // Navigate to API tab
    const apiTab = page.locator('text=🚀 API');
    await apiTab.click();
    await page.waitForTimeout(2000);
    console.log('🚀 API tab loaded');
    
    // Test API endpoints
    const testButtons = page.locator('button:has-text("Test")');
    const testButtonCount = await testButtons.count();
    console.log(`🧪 Found ${testButtonCount} API test buttons`);
    
    // Test health check
    const healthTestButton = testButtons.first();
    await healthTestButton.click();
    await page.waitForTimeout(3000);
    console.log('🏥 Health check API tested');
    
    // Test status API
    if (testButtonCount > 1) {
      const statusTestButton = testButtons.nth(1);
      await statusTestButton.click();
      await page.waitForTimeout(3000);
      console.log('📊 Status API tested');
    }
    
    console.log('\n=== PHASE 5: NOTIFICATION TESTING ===');
    
    // Test email notification sending
    console.log('📧 Testing email notification to khalidsaidi66@gmail.com...');
    
    // Go back to notifications and try to send a test notification
    await notificationsTab.click();
    await page.waitForTimeout(1000);
    
    // Look for test notification button
    const testNotificationButton = page.locator('button:has-text("Test"), button:has-text("Send Test")');
    if (await testNotificationButton.count() > 0) {
      await testNotificationButton.first().click();
      await page.waitForTimeout(2000);
      console.log('📤 Test notification sent');
    }
    
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('💥 Test execution error:', error.message);
  }
  
  await browser.close();
  
  // Summary
  console.log('\n📊 COMPREHENSIVE TEST SUMMARY:');
  console.log(`📤 Total requests made: ${requests.length}`);
  console.log(`📥 Total responses received: ${responses.length}`);
  
  // Show Firebase Functions calls
  const firebaseCalls = requests.filter(req => 
    req.url.includes('cloudfunctions.net') || 
    req.url.includes('/api/')
  );
  console.log(`🔥 Firebase/API calls: ${firebaseCalls.length}`);
  
  // Show successful responses
  const successfulResponses = responses.filter(res => res.status >= 200 && res.status < 300);
  console.log(`✅ Successful responses: ${successfulResponses.length}`);
  
  // Show failed responses
  const failedResponses = responses.filter(res => res.status >= 400);
  console.log(`❌ Failed responses: ${failedResponses.length}`);
  
  if (failedResponses.length > 0) {
    console.log('\n❌ FAILED REQUESTS:');
    failedResponses.forEach(res => {
      console.log(`   ${res.status} ${res.statusText} - ${res.url}`);
    });
  }
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Check your Gmail (khalidsaidi66@gmail.com) for email notifications');
  console.log('2. Verify comment appears in the comments section');
  console.log('3. Check webhook.site for webhook notifications');
  console.log('4. Review Firebase Functions logs for any errors');
  console.log('5. Test push notifications in browser (if enabled)');
  
  return {
    totalRequests: requests.length,
    totalResponses: responses.length,
    firebaseCalls: firebaseCalls.length,
    successfulResponses: successfulResponses.length,
    failedResponses: failedResponses.length
  };
}

// Run the comprehensive test
testAllScenarios()
  .then((results) => {
    console.log('\n🎉 COMPREHENSIVE TESTING COMPLETED!');
    console.log('📊 Results:', results);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  }); 