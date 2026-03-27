#!/usr/bin/env node
// Test Claude-powered element instruction generation
// Demonstrates how Claude analyzes bug context + screenshots to generate optimal element discovery instructions

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { ClaudeInstructionGenerator } = require('./shared/claude-instruction-generator');
const { ConsoleKnowledgeHelper } = require('./shared/console-knowledge-helper');

async function testClaudeEnhancement() {
  console.log('🧪 Testing Claude-Powered Element Discovery\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set in .env file');
    console.log('   Get your key from: https://console.anthropic.com/');
    process.exit(1);
  }

  const generator = new ClaudeInstructionGenerator();
  const knowledgeHelper = new ConsoleKnowledgeHelper();
  await knowledgeHelper.load();

  // Example: The "Claim cluster" button bug
  const bugContext = {
    bugDescription: `When navigating to the Cluster Pools page, the "Claim cluster" button is not visible at certain zoom levels. The button should always be accessible regardless of browser zoom.`,
    bugSummary: 'Claim cluster button not visible at 90% zoom',
    screenshots: [], // Would include actual screenshots in real usage
    targetElement: {
      name: 'Claim cluster',
      type: 'button',
      description: 'Claim cluster button',
      htmlTags: ['button', 'a[role="button"]', '[type="button"]'],
      textSearchTerms: ['Claim cluster', 'cluster Claim', 'Claim'],
      attributeSearchTerms: ['claim-cluster', 'claim_cluster']
    },
    currentPage: 'clusterpools',
    consoleKnowledge: knowledgeHelper.findElement('clusterpools', 'Claim cluster')
  };

  console.log('📋 Bug Context:');
  console.log(`   Summary: ${bugContext.bugSummary}`);
  console.log(`   Page: ${bugContext.currentPage}`);
  console.log(`   Target: ${bugContext.targetElement.name} (${bugContext.targetElement.type})`);
  console.log();

  console.log('🔍 Console Knowledge:');
  console.log(`   Known IDs: ${bugContext.consoleKnowledge.ids.join(', ') || 'none'}`);
  console.log(`   Known Test IDs: ${bugContext.consoleKnowledge.testIds.join(', ') || 'none'}`);
  console.log(`   Known Selectors: ${bugContext.consoleKnowledge.selectors.join(', ') || 'none'}`);
  console.log();

  console.log('🤖 Asking Claude for optimized element discovery instructions...\n');

  try {
    const enhanced = await generator.generateElementInstructions(bugContext);

    console.log('✅ Claude Analysis Complete!\n');
    console.log('═'.repeat(70));
    console.log('OPTIMIZED ELEMENT DISCOVERY INSTRUCTIONS');
    console.log('═'.repeat(70));
    console.log();

    console.log('🎯 Primary Selector:');
    console.log(`   ${enhanced.primarySelector || 'none'}`);
    console.log();

    if (enhanced.fallbackSelectors && enhanced.fallbackSelectors.length > 0) {
      console.log('🔄 Fallback Selectors:');
      enhanced.fallbackSelectors.forEach((selector, i) => {
        console.log(`   ${i + 1}. ${selector}`);
      });
      console.log();
    }

    if (enhanced.textSearchTerms && enhanced.textSearchTerms.length > 0) {
      console.log('📝 Text Search Terms (priority order):');
      enhanced.textSearchTerms.forEach((term, i) => {
        console.log(`   ${i + 1}. "${term}"`);
      });
      console.log();
    }

    console.log('🤖 Stagehand Instruction:');
    console.log(`   "${enhanced.stagehandInstruction}"`);
    console.log();

    if (enhanced.reasoning) {
      console.log('💡 Claude\'s Reasoning:');
      console.log(`   ${enhanced.reasoning}`);
      console.log();
    }

    console.log('═'.repeat(70));
    console.log();

    console.log('📊 Comparison:');
    console.log();
    console.log('Before (manual inference):');
    console.log(`   - HTML tags: ${bugContext.targetElement.htmlTags.join(', ')}`);
    console.log(`   - Text terms: ${bugContext.targetElement.textSearchTerms.join(', ')}`);
    console.log(`   - Attribute terms: ${bugContext.targetElement.attributeSearchTerms.join(', ')}`);
    console.log();
    console.log('After (Claude-enhanced):');
    console.log(`   - Primary selector: ${enhanced.primarySelector}`);
    console.log(`   - ${enhanced.fallbackSelectors?.length || 0} fallback selectors`);
    console.log(`   - ${enhanced.textSearchTerms?.length || 0} prioritized text terms`);
    console.log(`   - Context-aware Stagehand instruction`);
    console.log();

    console.log('✨ Benefits:');
    console.log('   ✓ Uses stable selectors from console knowledge');
    console.log('   ✓ Understands bug context and intent');
    console.log('   ✓ Prioritizes most reliable discovery methods');
    console.log('   ✓ Generates natural language instructions for Stagehand');
    console.log('   ✓ Can analyze screenshots to understand visual context');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testClaudeEnhancement().catch(console.error);
