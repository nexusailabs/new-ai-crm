import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];

page.on('response', res => {
  if (res.status() >= 400) {
    errors.push(res.status() + ': ' + res.url());
  }
});

console.log('Testing https://bkf.app/ai-crm ...');

try {
  await page.goto('https://bkf.app/ai-crm', { waitUntil: 'networkidle', timeout: 30000 });
  const title = await page.title();
  console.log('Page title:', title);

  if (errors.length > 0) {
    console.log('HTTP Errors found:');
    errors.forEach(e => console.log('  - ' + e));
  } else {
    console.log('SUCCESS: No HTTP errors detected');
  }

  // Test new API endpoint
  console.log('\nTesting /ai-crm/api/trading-accounts ...');
  const apiResponse = await page.goto('https://bkf.app/ai-crm/api/trading-accounts', { timeout: 10000 });
  console.log('API Status:', apiResponse.status());
  if (apiResponse.status() === 200) {
    const body = await apiResponse.text();
    console.log('API Response (first 200 chars):', body.substring(0, 200));
  }

} catch (e) {
  console.error('Error:', e.message);
}

await browser.close();
console.log('\nTest completed.');
