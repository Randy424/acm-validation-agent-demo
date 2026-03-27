#!/usr/bin/env node
// Test Element Discovery Logic
// Verifies that the improved scored matching can find the "Claim cluster" button

const { Stagehand } = require('@browserbasehq/stagehand');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testElementDiscovery() {
  console.log('🧪 Testing Element Discovery Logic\n');

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

    // Navigate to cluster pools
    const consoleUrl = 'https://console-openshift-console.apps.cs-aws-420-hh7j9.dev02.red-chesterfield.com';
    console.log('🌐 Navigating to console...');
    await page.goto(consoleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Authenticate
    console.log('🔐 Authenticating...');
    await stagehand.act("click on the button labeled 'kube:admin'");
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

    // Test element discovery with scored matching
    console.log('🎯 Testing element discovery with scored matching...\n');

    const targetElement = {
      htmlTags: ['button', 'a[role="button"]', '[type="button"]'],
      textSearchTerms: ['Claim cluster', 'cluster Claim', 'Claim'],
      attributeSearchTerms: ['claim-cluster', 'claim_cluster'],
      knownSelectors: ['#claim'] // From console knowledge
    };

    // Try console knowledge selector first
    console.log('Testing console knowledge selector: #claim');
    const claimById = await page.evaluate(() => {
      const el = document.querySelector('#claim');
      return el ? {
        found: true,
        text: el.textContent.trim(),
        tagName: el.tagName,
        id: el.id
      } : { found: false };
    });

    if (claimById.found) {
      console.log(`✅ Found via #claim: "${claimById.text}" (${claimById.tagName})\n`);
    } else {
      console.log('❌ Not found via #claim\n');
    }

    // Test scored matching logic
    console.log('Testing scored text matching...');
    const scoredResult = await page.evaluate((searchConfig) => {
      const { htmlTags, textSearchTerms } = searchConfig;
      const htmlSelector = htmlTags.join(', ');
      const candidates = document.querySelectorAll(htmlSelector);

      let bestMatch = null;
      let bestScore = 0;
      const scores = [];

      Array.from(candidates).forEach(el => {
        const elText = el.textContent.trim().toLowerCase();

        textSearchTerms.forEach(term => {
          const termLower = term.toLowerCase();
          let score = 0;

          // Exact match
          if (elText === termLower) {
            score = 1000;
          }
          // Exact word match
          else if (elText.split(/\s+/).includes(termLower)) {
            score = 500;
          }
          // Contains all words
          else if (termLower.split(/\s+/).every(word => elText.includes(word))) {
            score = 300;
          }
          // Contains term
          else if (elText.includes(termLower)) {
            score = 100;
          }
          // Weak match
          else if (termLower.includes(elText) && elText.length > 3) {
            score = 50;
          }

          // Bonus for shorter text
          if (score > 0 && elText.length < 50) {
            score += (50 - elText.length) / 10;
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              text: el.textContent.trim(),
              tagName: el.tagName,
              id: el.id || '',
              className: el.className || '',
              score: score,
              searchTerm: term
            };
          }

          if (score > 0) {
            scores.push({
              text: el.textContent.trim().substring(0, 50),
              score: score,
              searchTerm: term
            });
          }
        });
      });

      return {
        bestMatch,
        topScores: scores.sort((a, b) => b.score - a.score).slice(0, 10)
      };
    }, targetElement);

    console.log('\n📊 Scoring Results:');
    console.log(`\nBest Match (score ${scoredResult.bestMatch?.score || 0}):`);
    if (scoredResult.bestMatch) {
      console.log(`  Text: "${scoredResult.bestMatch.text}"`);
      console.log(`  Tag: ${scoredResult.bestMatch.tagName}`);
      console.log(`  ID: ${scoredResult.bestMatch.id || 'none'}`);
      console.log(`  Search term: "${scoredResult.bestMatch.searchTerm}"`);
    }

    console.log('\nTop 10 Matches:');
    scoredResult.topScores.forEach((match, i) => {
      console.log(`  ${i + 1}. [${match.score}] "${match.text}" (term: ${match.searchTerm})`);
    });

    console.log('\n✅ Test complete! Check browser window to see the page.\n');
    console.log('Press Ctrl+C to exit and close browser.\n');

    // Keep browser open
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await stagehand.close();
  }
}

testElementDiscovery();
