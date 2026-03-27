#!/usr/bin/env node
// Test console knowledge helper

const { ConsoleKnowledgeHelper } = require('./shared/console-knowledge-helper');

async function test() {
  console.log('🧪 Testing Console Knowledge Helper\n');

  const helper = new ConsoleKnowledgeHelper();
  await helper.load();

  // Test 1: Find "Claim cluster" button
  console.log('Test 1: Finding "Claim cluster" button on cluster pools page');
  const claimButton = helper.findElement('clusterpools', 'Claim cluster');

  if (claimButton) {
    console.log('✅ Found element knowledge:');
    console.log(`   IDs: ${claimButton.ids.join(', ') || 'none'}`);
    console.log(`   Test IDs: ${claimButton.testIds.join(', ') || 'none'}`);
    console.log(`   Known texts: ${claimButton.texts.slice(0, 5).join(', ')}`);
    console.log(`   Selectors: ${claimButton.selectors.slice(0, 3).join(', ')}`);
    console.log(`   HTML tags: ${claimButton.htmlTags.slice(0, 3).join(', ')}`);
  } else {
    console.log('❌ No knowledge found');
  }

  // Test 2: Find translation
  console.log('\nTest 2: i18n translation lookup');
  const claimText = helper.getTranslation('claim');
  console.log(`   "claim" → "${claimText}"`);

  const claimKey = helper.findI18nKey('Claim');
  console.log(`   "Claim" → key: "${claimKey}"`);

  // Test 3: Get all page elements
  console.log('\nTest 3: All known elements for cluster pools page');
  const pageElements = helper.getPageElements('clusterpools');
  const uniqueTexts = [...new Set(pageElements.map(e => e.text))].filter(Boolean);
  console.log(`   Found ${pageElements.length} test patterns`);
  console.log(`   Unique button texts: ${uniqueTexts.slice(0, 10).join(', ')}...`);

  // Test 4: Enhance a target element
  console.log('\nTest 4: Enhancing element search with console knowledge');
  const mockTargetElement = {
    name: 'Claim cluster',
    type: 'button',
    description: 'Claim cluster button',
    htmlTags: ['button'],
    textSearchTerms: ['Claim cluster', 'cluster Claim'],
    attributeSearchTerms: ['claim-cluster']
  };

  const enhanced = helper.enhanceElementSearch('clusterpools', mockTargetElement);
  console.log('   Enhanced search includes:');
  if (enhanced.knownIds) {
    console.log(`   - Known IDs: ${enhanced.knownIds.join(', ')}`);
  }
  if (enhanced.knownSelectors) {
    console.log(`   - Known selectors: ${enhanced.knownSelectors.join(', ')}`);
  }
  console.log(`   - Text terms: ${enhanced.textSearchTerms.length} variations`);
  console.log(`   - Attribute terms: ${enhanced.attributeSearchTerms.length} variations`);
}

test().catch(console.error);
