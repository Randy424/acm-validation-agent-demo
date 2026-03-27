#!/usr/bin/env node
// Test: Generic button finding + Claude visual analysis for layout problems

const { Stagehand } = require('@browserbasehq/stagehand');
const { Anthropic } = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testGenericOutlineWithAnalysis() {
  console.log('🧪 Generic Outline + Visual Analysis Test\n');
  console.log('Goal: Find button generically, outline it, then have Claude analyze for issues\n');

  const stagehand = new Stagehand({
    env: 'LOCAL',
    headless: false,
    verbose: 0,
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

    // Simulate loading from bug-spec.json (generic)
    const targetElement = {
      name: 'Claim cluster',
      type: 'button',
      textSearchTerms: ['Claim cluster', 'cluster Claim', 'Claim']
    };

    console.log('📋 Target element from bug spec:');
    console.log(`   Name: "${targetElement.name}"`);
    console.log(`   Type: ${targetElement.type}`);
    console.log(`   Search terms: ${targetElement.textSearchTerms.join(', ')}\n`);

    // Navigate and authenticate
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

    // GENERIC: Find and outline using targetElement (not hardcoded)
    console.log(`🎯 Finding and outlining "${targetElement.type}" with text matching: ${targetElement.textSearchTerms[0]}...\n`);

    const result = await page.evaluate(() => {
      // Inline parameters (Stagehand evaluate doesn't support function parameters)
      const searchTerms = ['Claim cluster', 'cluster Claim', 'Claim'];
      const elementType = 'button';

      // Use element type to filter (button, link, etc.)
      const tagName = elementType.toLowerCase();
      let candidates;

      if (tagName === 'button') {
        candidates = document.querySelectorAll('button');
      } else if (tagName === 'link') {
        candidates = document.querySelectorAll('a');
      } else {
        candidates = document.querySelectorAll('button, a, input');
      }

      let bestMatch = null;
      let bestScore = 0;

      // Score each candidate against search terms
      for (const el of candidates) {
        const elText = el.textContent.trim().toLowerCase();

        for (const term of searchTerms) {
          const termLower = term.toLowerCase();
          let score = 0;

          if (elText === termLower) score = 1000;  // Exact match
          else if (elText.includes(termLower)) score = 500;  // Contains
          else if (termLower.split(/\s+/).every(word => elText.includes(word))) score = 300;  // All words

          // Bonus for shorter text (more specific)
          if (score > 0 && elText.length < 50) {
            score += (50 - elText.length) / 10;
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = el;
          }
        }
      }

      if (!bestMatch) {
        return { found: false, error: 'No matching element found' };
      }

      // Apply BRIGHT GREEN OUTLINE
      bestMatch.style.outline = '6px solid #00FF00';
      bestMatch.style.outlineOffset = '4px';
      bestMatch.style.boxShadow = '0 0 25px #00FF00';
      bestMatch.style.position = 'relative';
      bestMatch.style.zIndex = '999999';

      // Scroll into view
      bestMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Get bounding box info for analysis
      const rect = bestMatch.getBoundingClientRect();

      return {
        found: true,
        text: bestMatch.textContent.trim(),
        tagName: bestMatch.tagName,
        id: bestMatch.id || 'none',
        score: bestScore,
        position: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        }
      };
    });

    if (!result.found) {
      console.log(`❌ ${result.error}`);
      return;
    }

    console.log('✅ Element found and outlined:');
    console.log(`   Text: "${result.text}"`);
    console.log(`   Tag: <${result.tagName}>`);
    console.log(`   Match score: ${result.score}`);
    console.log(`   Position: x=${Math.round(result.position.x)}, y=${Math.round(result.position.y)}`);
    console.log(`   Size: ${Math.round(result.position.width)}x${Math.round(result.position.height)}px\n`);

    // Wait for scroll and visual effects
    await page.waitForTimeout(1500);

    // Take screenshot with outlined element
    const screenshotPath = 'visual-analysis-test.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Screenshot saved: ${screenshotPath}\n`);

    // NOW: Use Claude's vision to analyze the screenshot for layout problems
    console.log('🤖 Asking Claude to analyze the screenshot for layout issues...\n');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const imageData = await fs.readFile(screenshotPath);
    const base64Image = imageData.toString('base64');

    const analysis = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `This is a screenshot of a UI with a button outlined in BRIGHT GREEN.

The button text is: "${result.text}"

ANALYZE THIS SCREENSHOT FOR LAYOUT PROBLEMS:

1. **Overlapping Elements**: Is the green-outlined button overlapping with any other UI elements (buttons, menus, icons)?
2. **Cut-off Text**: Is any text in the button cut off or truncated?
3. **Positioning Issues**: Is the button positioned incorrectly or awkwardly placed?
4. **Spacing Problems**: Are there spacing/padding issues around the button?
5. **Accessibility**: Is the button easily clickable or is it too close to other interactive elements?

Focus especially on:
- The green-outlined button and its immediate surroundings
- Any three-dot menus (kebab menus) near the button
- Whether elements are overlapping or too close together

Provide your analysis in this format:

**ISSUES FOUND**: Yes/No

**Details**:
- [List each specific issue you observe]

**Severity**: Critical / Major / Minor / None

Be specific about what you see.`
            }
          ]
        }
      ]
    });

    const analysisText = analysis.content[0].text;

    console.log('═'.repeat(70));
    console.log('CLAUDE VISUAL ANALYSIS:');
    console.log('═'.repeat(70));
    console.log(analysisText);
    console.log('═'.repeat(70));
    console.log();

    // Parse the analysis
    const hasIssues = analysisText.toLowerCase().includes('issues found: yes');

    if (hasIssues) {
      console.log('⚠️  Claude detected layout problems!');
      console.log('   Check the details above for specifics.\n');
    } else {
      console.log('✅ Claude says: No layout issues detected\n');
    }

    console.log('Keeping browser open for 30 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    await stagehand.close();
  }
}

testGenericOutlineWithAnalysis().catch(console.error);
