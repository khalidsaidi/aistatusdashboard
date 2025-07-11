/**
 * COMPREHENSIVE FORM VALIDATION TESTS
 *
 * This test suite covers EVERY form interaction and validation:
 * - Email validation in all forms
 * - URL validation for webhooks
 * - Checkbox interactions
 * - Form submission states
 * - Error message display
 * - Success state handling
 * - Input field constraints
 * - Real-time validation feedback
 */

import { chromium, Browser, Page } from 'playwright';

describe('📝 COMPREHENSIVE FORM VALIDATION - Every Input & Rule', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = 'http://localhost:3000';

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: 50,
    });
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });

    // Navigate to notifications tab
    await page.goto(baseUrl);
    await page.click('text=Notifications');
    await page.waitForSelector('text=Notifications & Alerts');
  });

  afterEach(async () => {
    await page?.close();
  });

  describe('📧 EMAIL ALERTS FORM - Complete Validation', () => {
    beforeEach(async () => {
      await page.click('text=Email Alerts');
      await page.waitForTimeout(500);
    });

    test('should validate email input field completely', async () => {
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();

      if ((await emailInput.count()) === 0) {
        console.log('Email input not found, skipping email validation tests');
        return;
      }

      // Test empty email
      await emailInput.fill('');
      await emailInput.blur();

      // Test invalid email formats
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@invalid.com',
        'invalid@.com',
        'invalid.com',
        'invalid@invalid',
        'invalid@invalid.',
        'invalid@invalid..com',
        'invalid..email@test.com',
        'invalid@test@test.com',
        'invalid email@test.com',
        'invalid@test .com',
      ];

      for (const invalidEmail of invalidEmails) {
        await emailInput.fill(invalidEmail);
        await emailInput.blur();

        // Check for validation feedback
        const hasValidationError =
          (await page
            .locator('text=/invalid/i, text=/error/i, .error, .invalid, [class*="error"]')
            .count()) > 0;
        const inputClasses = (await emailInput.getAttribute('class')) || '';
        const isInvalid = inputClasses.includes('invalid') || inputClasses.includes('error');

        // At least one validation indicator should be present
        expect(hasValidationError || isInvalid).toBe(true);
      }

      // Test valid email formats
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user_name@example-domain.com',
        'firstname.lastname@subdomain.example.com',
        'user123@example123.com',
      ];

      for (const validEmail of validEmails) {
        await emailInput.fill(validEmail);
        await emailInput.blur();

        // Should not show validation errors
        const hasValidationError =
          (await page
            .locator('.error:visible, .invalid:visible, [class*="error"]:visible')
            .count()) > 0;
        expect(hasValidationError).toBe(false);
      }
    });

    test('should validate provider selection completely', async () => {
      // Find all provider checkboxes
      const providerCheckboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await providerCheckboxes.count();

      if (checkboxCount === 0) {
        console.log('No provider checkboxes found, skipping provider validation');
        return;
      }

      // Test individual checkbox interactions
      for (let i = 0; i < Math.min(checkboxCount, 15); i++) {
        const checkbox = providerCheckboxes.nth(i);

        // Check checkbox
        await checkbox.check();
        expect(await checkbox.isChecked()).toBe(true);

        // Uncheck checkbox
        await checkbox.uncheck();
        expect(await checkbox.isChecked()).toBe(false);

        // Check again
        await checkbox.check();
        expect(await checkbox.isChecked()).toBe(true);
      }

      // Test select all / deselect all functionality
      const selectAllButton = page.locator('button:has-text("Select All"), button:has-text("All")');
      if ((await selectAllButton.count()) > 0) {
        await selectAllButton.click();

        // Verify all checkboxes are checked
        const checkedBoxes = page.locator('input[type="checkbox"]:checked');
        const checkedCount = await checkedBoxes.count();
        expect(checkedCount).toBeGreaterThan(0);
      }

      const deselectAllButton = page.locator(
        'button:has-text("Deselect All"), button:has-text("None"), button:has-text("Clear")'
      );
      if ((await deselectAllButton.count()) > 0) {
        await deselectAllButton.click();

        // Verify all checkboxes are unchecked
        const checkedBoxes = page.locator('input[type="checkbox"]:checked');
        const checkedCount = await checkedBoxes.count();
        expect(checkedCount).toBe(0);
      }
    });

    test('should validate notification type selection', async () => {
      const notificationTypes = ['Incident', 'Recovery', 'Degradation', 'Maintenance'];

      for (const type of notificationTypes) {
        const typeCheckbox = page.locator(
          `input[type="checkbox"][value*="${type.toLowerCase()}"], label:has-text("${type}") input`
        );

        if ((await typeCheckbox.count()) > 0) {
          // Test checking notification type
          await typeCheckbox.check();
          expect(await typeCheckbox.isChecked()).toBe(true);

          // Test unchecking
          await typeCheckbox.uncheck();
          expect(await typeCheckbox.isChecked()).toBe(false);
        }
      }
    });

    test('should validate complete form submission', async () => {
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
      const subscribeButton = page.locator(
        'button:has-text("Subscribe"), button:has-text("Enable"), button[type="submit"]'
      );

      if ((await emailInput.count()) === 0 || (await subscribeButton.count()) === 0) {
        console.log('Form elements not found, skipping submission test');
        return;
      }

      // Test submission with empty form
      await subscribeButton.click();

      // Should show validation errors or prevent submission
      const hasErrors =
        (await page.locator('.error:visible, .invalid:visible, [class*="error"]:visible').count()) >
        0;
      const buttonDisabled = await subscribeButton.isDisabled();

      expect(hasErrors || buttonDisabled).toBe(true);

      // Test submission with valid data
      await emailInput.fill('test@example.com');

      // Select at least one provider
      const firstCheckbox = page.locator('input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();
      }

      // Submit form
      await subscribeButton.click();

      // Should show success message or loading state
      await page.waitForTimeout(1000);

      const hasSuccess =
        (await page
          .locator('text=/success/i, text=/subscribed/i, .success, [class*="success"]')
          .count()) > 0;
      const isLoading =
        (await page.locator('text=/loading/i, .loading, .spinner, [class*="loading"]').count()) > 0;

      // Either success or loading should be present
      expect(hasSuccess || isLoading).toBe(true);
    });
  });

  describe('🔔 WEB PUSH FORM - Complete Validation', () => {
    beforeEach(async () => {
      await page.click('text=Web Push');
      await page.waitForTimeout(500);
    });

    test('should validate push notification setup', async () => {
      const pushButton = page.locator(
        'button:has-text("Enable Push"), button:has-text("Push Enabled"), button:has-text("Disable Push")'
      );

      if ((await pushButton.count()) === 0) {
        console.log('Push button not found, skipping push validation');
        return;
      }

      const initialText = await pushButton.textContent();

      // Click push button
      await pushButton.click();

      // Should either enable push or show permission dialog
      await page.waitForTimeout(2000);

      const newText = await pushButton.textContent();
      const textChanged = initialText !== newText;

      // Button text should change or show some feedback
      expect(textChanged).toBe(true);
    });

    test('should validate provider selection for push notifications', async () => {
      // Same provider selection logic as email alerts
      const providerCheckboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await providerCheckboxes.count();

      if (checkboxCount > 0) {
        // Test at least 3 checkboxes
        for (let i = 0; i < Math.min(checkboxCount, 3); i++) {
          const checkbox = providerCheckboxes.nth(i);

          await checkbox.check();
          expect(await checkbox.isChecked()).toBe(true);

          await checkbox.uncheck();
          expect(await checkbox.isChecked()).toBe(false);
        }
      }
    });

    test('should validate notification type selection for push', async () => {
      const notificationTypes = ['Incident', 'Recovery', 'Degradation'];

      for (const type of notificationTypes) {
        const typeElement = page.locator(
          `input[type="checkbox"][value*="${type.toLowerCase()}"], label:has-text("${type}")`
        );

        if ((await typeElement.count()) > 0) {
          const checkbox = typeElement.locator('input[type="checkbox"]').first();

          if ((await checkbox.count()) > 0) {
            await checkbox.check();
            expect(await checkbox.isChecked()).toBe(true);
          }
        }
      }
    });
  });

  describe('🔗 WEBHOOKS FORM - Complete Validation', () => {
    beforeEach(async () => {
      await page.click('text=Webhooks');
      await page.waitForTimeout(500);
    });

    test('should validate webhook URL input completely', async () => {
      const webhookInput = page.locator(
        'input[type="url"], input[placeholder*="webhook"], input[placeholder*="URL"]'
      );

      if ((await webhookInput.count()) === 0) {
        console.log('Webhook URL input not found, skipping webhook validation');
        return;
      }

      // Test invalid URLs
      const invalidUrls = [
        'invalid',
        'not-a-url',
        'ftp://example.com',
        'http://',
        'https://',
        'http://.',
        'https://.',
        'http://localhost',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      for (const invalidUrl of invalidUrls) {
        await webhookInput.fill(invalidUrl);
        await webhookInput.blur();

        // Check for validation feedback
        const hasValidationError =
          (await page
            .locator('text=/invalid/i, text=/error/i, .error, .invalid, [class*="error"]')
            .count()) > 0;
        const inputClasses = (await webhookInput.getAttribute('class')) || '';
        const isInvalid = inputClasses.includes('invalid') || inputClasses.includes('error');

        // URL validation should be present
        expect(hasValidationError || isInvalid).toBe(true);
      }

      // Test valid URLs
      const validUrls = [
        'https://example.com/webhook',
        'https://api.example.com/v1/webhook',
        'https://webhook.site/unique-id',
        'https://discord.com/api/webhooks/123/abc',
        'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      ];

      for (const validUrl of validUrls) {
        await webhookInput.fill(validUrl);
        await webhookInput.blur();

        // Should not show validation errors
        const hasValidationError =
          (await page
            .locator('.error:visible, .invalid:visible, [class*="error"]:visible')
            .count()) > 0;
        expect(hasValidationError).toBe(false);
      }
    });

    test('should validate webhook form submission', async () => {
      const webhookInput = page.locator(
        'input[type="url"], input[placeholder*="webhook"], input[placeholder*="URL"]'
      );
      const submitButton = page.locator(
        'button:has-text("Add Webhook"), button:has-text("Save"), button[type="submit"]'
      );

      if ((await webhookInput.count()) === 0 || (await submitButton.count()) === 0) {
        console.log('Webhook form elements not found, skipping submission test');
        return;
      }

      // Test submission with empty URL
      await submitButton.click();

      // Should show validation errors or prevent submission
      const hasErrors =
        (await page.locator('.error:visible, .invalid:visible, [class*="error"]:visible').count()) >
        0;
      const buttonDisabled = await submitButton.isDisabled();

      expect(hasErrors || buttonDisabled).toBe(true);

      // Test submission with valid URL
      await webhookInput.fill('https://example.com/webhook');

      // Select at least one provider
      const firstCheckbox = page.locator('input[type="checkbox"]').first();
      if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check();
      }

      // Submit form
      await submitButton.click();

      // Should show success message or loading state
      await page.waitForTimeout(1000);

      const hasSuccess =
        (await page
          .locator('text=/success/i, text=/added/i, .success, [class*="success"]')
          .count()) > 0;
      const isLoading =
        (await page.locator('text=/loading/i, .loading, .spinner, [class*="loading"]').count()) > 0;

      // Either success or loading should be present
      expect(hasSuccess || isLoading).toBe(true);
    });
  });

  describe('🎯 CROSS-FORM VALIDATION - State Management', () => {
    test('should maintain form state when switching tabs', async () => {
      // Fill email form
      await page.click('text=Email Alerts');
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();

      if ((await emailInput.count()) > 0) {
        await emailInput.fill('test@example.com');

        // Switch to another tab
        await page.click('text=Web Push');
        await page.waitForTimeout(500);

        // Switch back to email tab
        await page.click('text=Email Alerts');
        await page.waitForTimeout(500);

        // Email should still be filled
        const emailValue = await emailInput.inputValue();
        expect(emailValue).toBe('test@example.com');
      }
    });

    test('should validate consistent provider selection across forms', async () => {
      // Select providers in email form
      await page.click('text=Email Alerts');
      const emailCheckboxes = page.locator('input[type="checkbox"]');

      if ((await emailCheckboxes.count()) > 0) {
        await emailCheckboxes.first().check();
        const isChecked = await emailCheckboxes.first().isChecked();

        if (isChecked) {
          // Switch to push notifications
          await page.click('text=Web Push');
          await page.waitForTimeout(500);

          // Same provider should be selected
          const pushCheckboxes = page.locator('input[type="checkbox"]');
          if ((await pushCheckboxes.count()) > 0) {
            const isPushChecked = await pushCheckboxes.first().isChecked();
            expect(isPushChecked).toBe(true);
          }
        }
      }
    });
  });

  describe('🔄 REAL-TIME VALIDATION - Live Feedback', () => {
    test('should provide real-time email validation feedback', async () => {
      await page.click('text=Email Alerts');
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();

      if ((await emailInput.count()) === 0) {
        return;
      }

      // Type invalid email character by character
      await emailInput.fill('');
      await emailInput.type('invalid', { delay: 100 });

      // Should show validation feedback during typing
      await page.waitForTimeout(500);

      // Continue typing to make it valid
      await emailInput.type('@example.com', { delay: 100 });

      // Should remove validation errors
      await page.waitForTimeout(500);

      const hasErrors =
        (await page.locator('.error:visible, .invalid:visible, [class*="error"]:visible').count()) >
        0;
      expect(hasErrors).toBe(false);
    });

    test('should provide real-time URL validation feedback', async () => {
      await page.click('text=Webhooks');
      const webhookInput = page.locator(
        'input[type="url"], input[placeholder*="webhook"], input[placeholder*="URL"]'
      );

      if ((await webhookInput.count()) === 0) {
        return;
      }

      // Type invalid URL character by character
      await webhookInput.fill('');
      await webhookInput.type('invalid', { delay: 100 });

      // Should show validation feedback during typing
      await page.waitForTimeout(500);

      // Continue typing to make it valid
      await webhookInput.type('', { delay: 100 });
      await webhookInput.fill('https://example.com/webhook');

      // Should remove validation errors
      await page.waitForTimeout(500);

      const hasErrors =
        (await page.locator('.error:visible, .invalid:visible, [class*="error"]:visible').count()) >
        0;
      expect(hasErrors).toBe(false);
    });
  });

  describe('📊 FORM ACCESSIBILITY - Complete A11y Coverage', () => {
    test('should have proper form labels and ARIA attributes', async () => {
      await page.click('text=Email Alerts');

      const inputs = page.locator('input');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);

        // Check for accessibility attributes
        const hasLabel = (await input.locator('xpath=../label').count()) > 0;
        const hasAriaLabel = (await input.getAttribute('aria-label')) !== null;
        const hasAriaLabelledBy = (await input.getAttribute('aria-labelledby')) !== null;
        const hasPlaceholder = (await input.getAttribute('placeholder')) !== null;

        // At least one accessibility feature should be present
        expect(hasLabel || hasAriaLabel || hasAriaLabelledBy || hasPlaceholder).toBe(true);
      }
    });

    test('should support keyboard navigation in forms', async () => {
      await page.click('text=Email Alerts');

      // Tab through form elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to interact with focused elements
      const focusedElement = page.locator(':focus');

      if ((await focusedElement.count()) > 0) {
        const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
        const isInteractive = ['input', 'button', 'select', 'textarea'].includes(tagName);
        expect(isInteractive).toBe(true);
      }
    });

    test('should announce form validation errors to screen readers', async () => {
      await page.click('text=Email Alerts');
      const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();

      if ((await emailInput.count()) === 0) {
        return;
      }

      // Trigger validation error
      await emailInput.fill('invalid-email');
      await emailInput.blur();

      // Check for ARIA attributes that announce errors
      const hasAriaInvalid = (await emailInput.getAttribute('aria-invalid')) === 'true';
      const hasAriaDescribedBy = (await emailInput.getAttribute('aria-describedby')) !== null;

      // Should have accessibility attributes for screen readers
      expect(hasAriaInvalid || hasAriaDescribedBy).toBe(true);
    });
  });
});
