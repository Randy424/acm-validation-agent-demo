#!/usr/bin/env node
// Test Semantic Stagehand Instruction Builder
// Shows how we generate smart, context-aware instructions for Stagehand

const { StagehandInstructionBuilder } = require('./shared/stagehand-instruction-builder');

console.log('🤖 Semantic Stagehand Instruction Builder\n');
console.log('Instead of "Click the Claim cluster button", we generate semantic prompts\n');
console.log('='.repeat(70));

// Test 1: Simple button
console.log('\n📝 Test 1: "Claim cluster" button\n');

const instruction1 = StagehandInstructionBuilder.buildFindInstruction({
  elementName: 'Claim cluster',
  elementType: 'button',
  currentPage: 'cluster pools page',
  bugSummary: '[UI] Cluster pool - cluster claim button not re-positioned properly when zooming in/out'
});

console.log('Generated instruction:');
console.log(`"${instruction1}"`);

// Test 2: Create button
console.log('\n' + '='.repeat(70));
console.log('\n📝 Test 2: "Create cluster pool" button\n');

const instruction2 = StagehandInstructionBuilder.buildFindInstruction({
  elementName: 'Create cluster pool',
  elementType: 'button',
  currentPage: 'cluster pools page'
});

console.log('Generated instruction:');
console.log(`"${instruction2}"`);

// Test 3: Navigation link
console.log('\n' + '='.repeat(70));
console.log('\n📝 Test 3: "Cluster pools" navigation link\n');

const instruction3 = StagehandInstructionBuilder.buildFindInstruction({
  elementName: 'Cluster pools',
  elementType: 'link',
  currentPage: 'main navigation'
});

console.log('Generated instruction:');
console.log(`"${instruction3}"`);

// Test 4: Input field
console.log('\n' + '='.repeat(70));
console.log('\n📝 Test 4: "Cluster name" input field\n');

const instruction4 = StagehandInstructionBuilder.buildFindInstruction({
  elementName: 'Cluster name',
  elementType: 'input'
});

console.log('Generated instruction:');
console.log(`"${instruction4}"`);

// Test 5: Full action instruction
console.log('\n' + '='.repeat(70));
console.log('\n📝 Test 5: Full action - Click "Claim cluster"\n');

const actionInstruction = StagehandInstructionBuilder.buildActionInstruction({
  action: 'click',
  element: {
    name: 'Claim cluster',
    type: 'button'
  },
  currentPage: 'cluster pools page',
  bugContext: {
    summary: '[UI] Cluster pool - cluster claim button not re-positioned properly when zooming'
  }
});

console.log('Generated action instruction:');
console.log(`"${actionInstruction}"`);

console.log('\n' + '='.repeat(70));
console.log('\n✨ Benefits:\n');
console.log('✓ Stagehand understands PURPOSE, not just keywords');
console.log('✓ Works even if text varies slightly ("Claim" vs "Claim cluster")');
console.log('✓ Distinguishes between element types (button vs link)');
console.log('✓ Uses bug context for additional hints');
console.log('✓ More robust than exact text matching\n');
