#!/usr/bin/env node
// Test: Can we get Stagehand to FIND an element and then OUTLINE it?
// Goal: Visual indication of WHERE the button is

const { Stagehand } = require('@browserbasehq/stagehand');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testStagehandOutline() {
  console.log('🧪 Testing Stagehand Find + Outline\n');
  console.log('Goal: Have Stagehand find the button, then we outline it\n');

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

    // Navigate and authenticate (same as before)
    const consoleUrl = 'https://console-openshift-console.apps.cs-aws-420-hh7j9.dev02.red-chesterfield.com';
    console.log('🌐 Navigating to console...');
    await page.goto(consoleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    console.log('🔐 Authenticating...');
    await stagehand.act("click on the link or button labeled 'kube:admin'");
    await page.waitForTimeout(2000);
    await stagehand.act('type "kubeadmin" in the username field');
    await stagehand.act('type "9FKcW-7pe42-kGn64-rFRS7" in the password field');
    await stagehand.act("click the login or submit button");
    await page.waitForTimeout(6000);
    console.log('✓ Authenticated\n');

    console.log('📍 Navigating to Cluster Pools...');
    await stagehand.act("navigate to Cluster pools tab under Infrastructure or Clusters");
    await page.waitForTimeout(3000);
    console.log('✓ On Cluster Pools page\n');

    // Screenshot before
    await page.screenshot({ path: 'outline-before.png', fullPage: false });
    console.log('📸 Before: outline-before.png\n');

    // THE TEST: Use extract() to get info about the button WITHOUT clicking
    console.log('🎯 Asking Stagehand to LOCATE (not click) the button...\n');

    const result = await stagehand.extract({
      instruction: "Find the BUTTON element on this page that contains the text 'Claim cluster'. " +
                   "It must be an actual <button> HTML tag in the table. " +
                   "Report exactly where it is.",
      schema: {
        found: { type: 'boolean', description: 'Whether the button was found' },
        text: { type: 'string', description: 'The exact text on the button' },
        location: { type: 'string', description: 'Where the button is located (e.g., "in table row", "top right")' }
      }
    });

    console.log('Stagehand result:');
    console.log(`  Found: ${result?.found}`);
    console.log(`  Text: "${result?.text}"`);
    console.log(`  Location: ${result?.location}\n`);

    if (result?.found) {
      // Now find and outline the button using the text
      console.log('📍 Finding the button in DOM to outline it...\n');

      const outlined = await page.evaluate((buttonText) => {
        // Find the button element
        const buttons = document.querySelectorAll('button');
        let targetButton = null;

        for (const btn of buttons) {
          if (btn.textContent.trim().toLowerCase().includes(buttonText.toLowerCase())) {
            targetButton = btn;
            break;
          }
        }

        if (!targetButton) return false;

        // Apply a simple, visible outline
        targetButton.style.outline = '5px solid #00ff00';  // Bright green
        targetButton.style.outlineOffset = '3px';
        targetButton.style.boxShadow = '0 0 20px #00ff00';
        targetButton.style.position = 'relative';
        targetButton.style.zIndex = '999999';

        // Scroll it into view
        targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });

        return {
          text: targetButton.textContent.trim(),
          tagName: targetButton.tagName,
          className: targetButton.className
        };
      }, result.text);

      if (outlined) {
        console.log('✅ Button outlined successfully!');
        console.log(`   Element: <${outlined.tagName}> "${outlined.text}"`);
        console.log(`   Class: ${outlined.className}\n`);

        // Wait for scroll to complete
        await page.waitForTimeout(1000);

        // Screenshot AFTER outlining
        await page.screenshot({ path: 'outline-after.png', fullPage: false });
        console.log('📸 After: outline-after.png\n');

        console.log('═'.repeat(70));
        console.log('\n✅ SUCCESS!\n');
        console.log('Compare the screenshots:');
        console.log('  - outline-before.png: No outline');
        console.log('  - outline-after.png: Button should have BRIGHT GREEN outline\n');
        console.log('If you can see the green outline, this approach works!');

      } else {
        console.log('❌ Could not find button in DOM with text:', result.text);
      }

    } else {
      console.log('❌ Stagehand could not locate the button');
    }

    console.log('\nBrowser staying open for 30 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    await stagehand.close();
  }
}

testStagehandOutline().catch(console.error);
