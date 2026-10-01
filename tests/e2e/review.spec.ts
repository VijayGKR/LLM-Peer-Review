import { expect, test } from '@playwright/test';

const markup = 'Text:\nHello <REPLACE new="world" reason="Clarity">earth</REPLACE><INSERT text="!" reason="Energy"/><COMMENT reason="Good opening"/> café 📝';

test('validates form, keeps key field focused, and handles provider failures', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Review Text' }).click();
  await expect(page.getByText('Please enter your API key')).toBeVisible();
  await page.getByLabel('Anthropic API Key').pressSequentially('test-key-not-a-credential');
  await expect(page.getByLabel('Anthropic API Key')).toBeFocused();
  await expect(page.getByLabel('Anthropic API Key')).toHaveValue('test-key-not-a-credential');
  await page.getByRole('button', { name: 'Review Text' }).click();
  await expect(page.getByText('Error: Please enter text to review')).toBeVisible();
  await page.getByRole('textbox', { name: 'Text to review' }).fill('Hello earth');
  await page.route('**/api/review-essay', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'The Anthropic API key is invalid. Please check it and try again.' }) }));
  await page.getByRole('button', { name: 'Review Text' }).click();
  await expect(page.getByText(/Error: The Anthropic API key is invalid/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review Text' })).toBeEnabled();
});

test('streams split markup and Unicode, accepts/rejects, copies and resets without a real model call', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  // A synthetic browser-side response exercises arbitrary byte boundaries. This
  // test never sends a key or text to Anthropic or the application's API route.
  await page.evaluate((responseText) => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      if (String(input) !== '/api/review-essay') return originalFetch(input, init);
      const bytes = new TextEncoder().encode(responseText);
      return new Response(new ReadableStream({
        start(controller) {
          for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
          controller.close();
        },
      }));
    };
  }, markup);
  await page.getByLabel('Anthropic API Key').fill('test-key-not-a-credential');
  await page.getByRole('textbox', { name: 'Text to review' }).fill('Hello earth café 📝');
  await page.getByRole('button', { name: 'Review Text' }).click();
  await expect(page.getByRole('button', { name: 'Copy Text' })).toBeVisible();
  await expect(page.getByText('earth', { exact: true })).toHaveCount(1);
  await page.getByText('earth', { exact: true }).click();
  await expect(page.getByText('Clarity', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await page.locator('span.bg-green-200').last().click();
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.locator('span.bg-blue-200').last().click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Copy Text' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Hello world café 📝');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Text to review' })).toBeEmpty();
  await page.getByRole('button', { name: 'Review Text' }).click();
  await expect(page.getByText('Error: Please enter text to review')).toBeVisible();
  expect(errors).toEqual([]);
});
