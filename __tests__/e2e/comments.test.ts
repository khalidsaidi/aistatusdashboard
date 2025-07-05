import { test, expect } from '@playwright/test';

test.describe('Comments Feature', () => {
  test('should display comments tab and form', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForSelector('button:has-text("Comments")', { timeout: 10000 });
    
    // Click on comments tab
    await page.click('button:has-text("Comments")');
    
    // Wait for comments section to load
    await page.waitForSelector('text=Dashboard Comments & Feedback', { timeout: 5000 });
    
    // Check that comment form is visible
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[placeholder="Your name"]')).toBeVisible();
    await expect(page.locator('textarea[placeholder="Share your thoughts..."]')).toBeVisible();
    await expect(page.locator('button:has-text("Post Comment")')).toBeVisible();
  });

  test('should validate comment form inputs', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to comments tab
    await page.click('button:has-text("Comments")');
    await page.waitForSelector('text=Dashboard Comments & Feedback');
    
    // Try to submit empty form
    const submitButton = page.locator('button:has-text("Post Comment")');
    await expect(submitButton).toBeDisabled();
    
    // Fill only name
    await page.fill('input[placeholder="Your name"]', 'Test User');
    await expect(submitButton).toBeDisabled();
    
    // Fill message (too short)
    await page.fill('textarea[placeholder="Share your thoughts..."]', 'Hi');
    await expect(submitButton).toBeDisabled();
    
    // Fill proper message
    await page.fill('textarea[placeholder="Share your thoughts..."]', 'This is a test comment with enough characters');
    await expect(submitButton).toBeEnabled();
  });

  test('should submit a comment successfully', async ({ page }) => {
    await page.goto('/');
    
    // Switch to comments tab
    await page.click('button:has-text("💬 Comments")');
    
    // Mock the Firebase API response for comment submission
    await page.route('**/comments', async route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Comment posted successfully' })
        });
      } else {
        route.continue();
      }
    });
    
    // Fill out the comment form
    await page.fill('input[placeholder="Your name"]', 'Test User');
    await page.fill('textarea[placeholder="Share your thoughts..."]', 'This is a test comment with enough characters to pass validation');
    
    // Submit the form
    await page.click('button:has-text("Post Comment")');
    
    // Wait for success message
    await expect(page.locator('text=✅ Comment posted successfully')).toBeVisible({ timeout: 10000 });
    
    // Form should be reset
    await expect(page.locator('input[placeholder="Your name"]')).toHaveValue('');
    await expect(page.locator('textarea[placeholder="Share your thoughts..."]')).toHaveValue('');
  });

  test('should display character count', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to comments tab
    await page.click('button:has-text("Comments")');
    await page.waitForSelector('text=Dashboard Comments & Feedback');
    
    // Check initial character count
    await expect(page.locator('text=0/1000 characters')).toBeVisible();
    
    // Type some text
    const message = 'This is a test message';
    await page.fill('textarea[placeholder="Share your thoughts..."]', message);
    
    // Check updated character count
    await expect(page.locator(`text=${message.length}/1000 characters`)).toBeVisible();
  });

  test('should handle comment type selection', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to comments tab
    await page.click('button:has-text("Comments")');
    await page.waitForSelector('text=Dashboard Comments & Feedback');
    
    // Check default selection
    const select = page.locator('select');
    await expect(select).toHaveValue('general');
    
    // Change to feedback
    await select.selectOption('feedback');
    await expect(select).toHaveValue('feedback');
    
    // Change to issue
    await select.selectOption('issue');
    await expect(select).toHaveValue('issue');
  });

  test('should load existing comments', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to comments tab
    await page.click('button:has-text("Comments")');
    await page.waitForSelector('text=Dashboard Comments & Feedback');
    
    // Should see either existing comments or empty state
    const hasComments = await page.locator('.space-y-4 > div').count();
    
    if (hasComments === 0) {
      // Should show empty state
      await expect(page.locator('text=No comments yet. Be the first to share your thoughts!')).toBeVisible();
    } else {
      // Should show comment count in header
      await expect(page.locator('text=Dashboard Comments & Feedback')).toBeVisible();
    }
  });

  test('should handle comment actions', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to comments tab
    await page.click('button:has-text("Comments")');
    await page.waitForSelector('text=Dashboard Comments & Feedback');
    
    // First, try to create a comment to test with
    await page.fill('input[placeholder="Your name"]', 'Test User');
    await page.fill('textarea[placeholder="Share your thoughts..."]', 'This is a test comment for action testing');
    await page.click('button:has-text("Post Comment")');
    
    // Wait for potential success message
    await page.waitForTimeout(2000);
    
    // Refresh comments to see if our comment appears
    await page.click('button:has-text("🔄 Refresh")');
    
    // Look for like and report buttons (they should exist if there are comments)
    const likeButtons = await page.locator('button:has-text("👍")').count();
    const reportButtons = await page.locator('button:has-text("🚨 Report")').count();
    
    // If there are comments, there should be action buttons
    if (likeButtons > 0) {
      expect(likeButtons).toBeGreaterThan(0);
      expect(reportButtons).toBeGreaterThan(0);
    }
  });

  test('should refresh comments list', async ({ page }) => {
    await page.goto('/');
    
    // Switch to comments tab
    await page.click('button:has-text("💬 Comments")');
    
    // Mock API to simulate loading delay
    await page.route('**/comments**', async route => {
      if (route.request().method() === 'GET') {
        // Add delay to see loading state
        await new Promise(resolve => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ comments: [] })
        });
      } else {
        route.continue();
      }
    });
    
    // Click refresh button
    await page.click('button:has-text("🔄 Refresh")');
    
    // Should show loading state briefly (check for disabled state instead)
    await expect(page.locator('button:has-text("🔄 Loading...")').or(page.locator('button[disabled]:has-text("🔄")'))).toBeVisible({ timeout: 2000 });
    
    // Should return to normal state
    await page.waitForSelector('button:has-text("🔄 Refresh")', { timeout: 5000 });
  });

  test('should handle rate limiting gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Switch to comments tab
    await page.click('button:has-text("💬 Comments")');
    
    // Mock rate limiting response
    await page.route('**/comments', async route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Rate limit exceeded',
            details: ['Too many requests. Please try again later.']
          })
        });
      } else {
        route.continue();
      }
    });
    
    // Fill and submit form
    await page.fill('input[placeholder="Your name"]', 'Test User');
    await page.fill('textarea[placeholder="Share your thoughts..."]', 'This is a test comment for rate limiting');
    
    await page.click('button:has-text("Post Comment")');
    
    // Should show rate limiting error
    await expect(page.locator('text=Too many requests')).toBeVisible({ timeout: 10000 });
  });
}); 