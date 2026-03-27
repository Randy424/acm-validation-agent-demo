#!/usr/bin/env node
// Test Scoring Logic
// Demonstrates that the new scored matching finds the BEST match, not just any match

console.log('🧪 Testing Element Scoring Logic\n');

// Simulate buttons from the cluster pools page
const mockButtons = [
  { text: 'Create cluster pool', id: 'create-cluster-pool' },
  { text: 'Actions', id: 'actions-menu' },
  { text: 'Claim cluster', id: 'claim-button' },  // The one we want!
  { text: 'Cluster pools', id: 'cluster-pools-tab' },
  { text: 'Destroy', id: 'destroy-pool' },
  { text: 'Scale', id: 'scale-pool' },
  { text: 'Claim', id: 'claim-modal' },  // Also valid but less specific
  { text: 'Close', id: 'close-button' },
  { text: 'Learn more about cluster pools', id: 'learn-more' }
];

// Search terms we're using
const searchTerms = ['Claim cluster', 'cluster Claim', 'Claim'];

console.log('📝 Search Terms:', searchTerms.join(', '));
console.log(`🔍 Searching through ${mockButtons.length} buttons:\n`);

mockButtons.forEach(btn => {
  console.log(`  - "${btn.text}" (${btn.id})`);
});

console.log('\n' + '='.repeat(70));
console.log('SCORING RESULTS:');
console.log('='.repeat(70) + '\n');

// Score each button
const scored = mockButtons.map(btn => {
  const elText = btn.text.toLowerCase();
  let bestScore = 0;
  let matchedTerm = '';

  searchTerms.forEach(term => {
    const termLower = term.toLowerCase();
    let score = 0;

    // Exact match (highest priority)
    if (elText === termLower) {
      score = 1000;
    }
    // Exact word match
    else if (elText.split(/\s+/).includes(termLower)) {
      score = 500;
    }
    // Contains all words from search term
    else if (termLower.split(/\s+/).every(word => elText.includes(word))) {
      score = 300;
    }
    // Contains search term
    else if (elText.includes(termLower)) {
      score = 100;
    }
    // Search term contains element text (weak match)
    else if (termLower.includes(elText) && elText.length > 3) {
      score = 50;
    }

    // Bonus for shorter text (more specific)
    if (score > 0 && elText.length < 50) {
      score += (50 - elText.length) / 10;
    }

    if (score > bestScore) {
      bestScore = score;
      matchedTerm = term;
    }
  });

  return {
    ...btn,
    score: bestScore,
    matchedTerm: matchedTerm
  };
}).filter(btn => btn.score > 0)
  .sort((a, b) => b.score - a.score);

// Display results
scored.forEach((btn, i) => {
  const emoji = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
  console.log(`${emoji} [Score: ${btn.score.toFixed(1)}] "${btn.text}"`);
  console.log(`   ID: ${btn.id}`);
  console.log(`   Matched term: "${btn.matchedTerm}"`);
  console.log();
});

console.log('='.repeat(70));
console.log('WINNER:');
console.log('='.repeat(70) + '\n');

const winner = scored[0];
console.log(`✅ "${winner.text}" (${winner.id})`);
console.log(`   Score: ${winner.score.toFixed(1)}`);
console.log(`   Why it won: ${getScoreReason(winner.text, winner.matchedTerm)}\n`);

function getScoreReason(text, term) {
  const elText = text.toLowerCase();
  const termLower = term.toLowerCase();

  if (elText === termLower) {
    return 'Exact match to search term';
  } else if (termLower.split(/\s+/).every(word => elText.includes(word))) {
    return 'Contains all words from search term + short length bonus';
  } else if (elText.includes(termLower)) {
    return 'Contains full search term';
  } else if (termLower.includes(elText)) {
    return 'Search term contains this text';
  }
  return 'Partial match';
}

console.log('=' + '='.repeat(70));
console.log('\n📊 Summary:');
console.log(`  - Old logic: Would find first match → "${mockButtons.find(b => b.text.toLowerCase().includes('claim')).text}"`);
console.log(`  - New logic: Finds best match → "${winner.text}" ✨`);
console.log();
