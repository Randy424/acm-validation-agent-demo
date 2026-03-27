#!/usr/bin/env node
// Test: Can Stagehand click on "Claim cluster" button?
// If yes, does the click provide visual feedback we can screenshot?

const { Stagehand } = require('@browserbasehq/stagehand');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testStagehandClickHighlight() {
  console.log('🧪 Testing Stagehand Click-Based Highlighting\n');
  console.log('Goal: See if clicking shows us WHERE the button is\n');

  const stagehand = new Stagehand({
    env: 'LOCAL',
    headless: false,
    verbose: 1,
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

    // Navigate to console
    const consoleUrl = 'https://console-openshift-console.apps.cs-aws-420-hh7j9.dev02.red-chesterfield.com';
    console.log('🌐 Navigating to console...');
    await page.goto(consoleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000); // Wait longer for OAuth page to load

    // Take screenshot to see OAuth page
    await page.screenshot({ path: 'test-oauth-page.png', fullPage: false });
    console.log('📸 OAuth page screenshot: test-oauth-page.png');

    // Authenticate
    console.log('🔐 Authenticating...');
    await stagehand.act("click on the link or button labeled 'kube:admin'");
    await page.waitForTimeout(2000);
    await stagehand.act('type "kubeadmin" in the username field');
    await stagehand.act('type "9FKcW-7pe42-kGn64-rFRS7" in the password field');
    await stagehand.act("click the login or submit button");
    await page.waitForTimeout(6000);
    console.log('✓ Authenticated\n');

    // Navigate to cluster pools
    console.log('📍 Navigating to Cluster Pools...');
    await stagehand.act("navigate to Cluster pools tab under Infrastructure or Clusters");
    await page.waitForTimeout(3000);
    console.log('✓ On Cluster Pools page\n');

    // Take screenshot BEFORE clicking
    await page.screenshot({ path: 'test-before-click.png', fullPage: false });
    console.log('📸 Screenshot taken: test-before-click.png\n');

    // Now the test: Tell Stagehand to click on "Claim cluster" button
    console.log('🎯 Test: Asking Stagehand to click "Claim cluster" button...\n');
    console.log('Instruction: "Click on the BUTTON element that contains the text \'Claim cluster\'. ');
    console.log('             It must be an actual <button> tag, not a link or container."\n');

    try {
      await stagehand.act(
        "Click on the BUTTON element that contains the text 'Claim cluster'. " +
        "It must be an actual <button> HTML tag, not a link or container div."
      );

      console.log('✅ Stagehand executed the click!\n');

      // Take screenshot IMMEDIATELY after click
      // The button should show some visual feedback (focus ring, ripple, pressed state)
      await page.waitForTimeout(500); // Brief pause to capture any visual state
      await page.screenshot({ path: 'test-after-click.png', fullPage: false });
      console.log('📸 Screenshot taken: test-after-click.png\n');

      // Wait a bit more to see if modal/dialog opens
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-after-click-2sec.png', fullPage: false });
      console.log('📸 Screenshot taken: test-after-click-2sec.png\n');

      console.log('═'.repeat(70));
      console.log('\n✅ SUCCESS! Check the screenshots:\n');
      console.log('  1. test-before-click.png - Before clicking');
      console.log('  2. test-after-click.png - Immediately after (should show button state)');
      console.log('  3. test-after-click-2sec.png - 2 seconds later (modal/dialog?)\n');
      console.log('If screenshot #2 shows the button location, we can use this approach!');
      console.log('If it opened a modal, we know the button exists and works.\n');

    } catch (clickError) {
      console.error('❌ Stagehand could NOT click the button');
      console.error(`   Error: ${clickError.message}\n`);
      console.log('This means Stagehand cannot find the button with this instruction.');
      console.log('We need to adjust our approach.\n');

      // Take screenshot anyway to see what's on screen
      await page.screenshot({ path: 'test-failed-state.png', fullPage: false });
      console.log('📸 Screenshot of failed state: test-failed-state.png\n');
    }

    // Keep browser open for review
    console.log('Browser staying open for 30 seconds for manual review...\n');
    console.log('Press Ctrl+C to exit early.\n');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await stagehand.close();
  }
}

testStagehandClickHighlight().catch(console.error);
