#!/usr/bin/env node
// Simple test: Find button by text and outline it with Puppeteer

const { Stagehand } = require('@browserbasehq/stagehand');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testSimpleOutline() {
  console.log('🧪 Simple Outline Test\n');
  console.log('Find the button by text and apply bright green outline\n');

  const stagehand = new Stagehand({
    env: 'LOCAL',
    headless: false,
    verbose: 0,  // Less verbose
    debugDom: false,
    enableCaching: false,
    model: "anthropic/claude-sonnet-4-20250514",
    browserOptions: {
      args: ['--window-size=1920,1080', '--window-position=0,0']
    }
  });

  try {
    await stagehand.init();
    const pages = Array.from(stagehand.ctx.pagesByTarget.values());
    const page = pages[0];

    console.log('✓ Browser initialized\n');

    const consoleUrl = 'https://console-openshift-console.apps.cs-aws-420-hh7j9.dev02.red-chesterfield.com';
    console.log('🌐 Navigating and authenticating...');
    await page.goto(consoleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    await stagehand.act("click on the link or button labeled 'kube:admin'");
    await page.waitForTimeout(2000);
    await stagehand.act('type "kubeadmin" in the username field');
    await stagehand.act('type "9FKcW-7pe42-kGn64-rFRS7" in the password field');
    await stagehand.act("click the login or submit button");
    await page.waitForTimeout(6000);

    console.log('✓ Authenticated');
    console.log('📍 Going to Cluster Pools...');
    await stagehand.act("navigate to Cluster pools tab under Infrastructure or Clusters");
    await page.waitForTimeout(3000);
    console.log('✓ On Cluster Pools page\n');

    // Screenshot BEFORE outlining
    await page.screenshot({ path: 'simple-before.png', fullPage: false });
    console.log('📸 Before: simple-before.png');

    // Find and outline the "Claim cluster" button
    console.log('\n🎯 Finding and outlining "Claim cluster" button...\n');

    const result = await page.evaluate(() => {
      const searchText = 'claim cluster';
      const buttons = document.querySelectorAll('button');

      let bestMatch = null;
      let bestScore = 0;

      // Find button with best text match
      for (const btn of buttons) {
        const btnText = btn.textContent.trim().toLowerCase();

        // Exact match
        if (btnText === searchText) {
          bestMatch = btn;
          bestScore = 1000;
          break;
        }

        // Contains both words
        if (btnText.includes('claim') && btnText.includes('cluster')) {
          if (!bestMatch || btnText.length < bestMatch.textContent.trim().length) {
            bestMatch = btn;
            bestScore = 500;
          }
        }

        // Contains "claim"
        if (btnText.includes('claim') && bestScore < 100) {
          bestMatch = btn;
          bestScore = 100;
        }
      }

      if (!bestMatch) {
        return { found: false, error: 'No button found' };
      }

      // Apply BRIGHT GREEN OUTLINE (simple and visible)
      bestMatch.style.outline = '6px solid #00FF00';
      bestMatch.style.outlineOffset = '4px';
      bestMatch.style.boxShadow = '0 0 25px #00FF00';
      bestMatch.style.position = 'relative';
      bestMatch.style.zIndex = '999999';

      // Scroll into view
      bestMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });

      return {
        found: true,
        text: bestMatch.textContent.trim(),
        tagName: bestMatch.tagName,
        id: bestMatch.id || 'none',
        score: bestScore
      };
    });

    console.log('Result:');
    console.log(`  Found: ${result.found}`);
    if (result.found) {
      console.log(`  Text: "${result.text}"`);
      console.log(`  Tag: <${result.tagName}>`);
      console.log(`  ID: ${result.id}`);
      console.log(`  Match score: ${result.score}\n`);

      // Wait for scroll animation
      await page.waitForTimeout(1000);

      // Screenshot AFTER outlining
      await page.screenshot({ path: 'simple-after.png', fullPage: false });
      console.log('📸 After: simple-after.png\n');

      console.log('═'.repeat(70));
      console.log('\n✅ SUCCESS! The button should have a BRIGHT GREEN outline.\n');
      console.log('Check simple-after.png to see if the green outline is visible.\n');

    } else {
      console.log(`  Error: ${result.error}\n`);
    }

    console.log('Keeping browser open for 30 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await stagehand.close();
  }
}

testSimpleOutline().catch(console.error);
