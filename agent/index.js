#!/usr/bin/env node
/**
 * ACM Bug Validation Agent
 *
 * Main entry point for autonomous bug validation
 * Supports live clusters and local kind clusters
 */

const path = require('path');
const fs = require('fs');

// Agent version
const VERSION = '1.0.0';

/**
 * Display usage information
 */
function showUsage() {
  console.log(`
ACM Bug Validation Agent v${VERSION}

USAGE:
  acm-agent validate <config-file>
  acm-agent --help
  acm-agent --version

EXAMPLES:
  # Validate on live cluster
  acm-agent validate config/live-cluster.json

  # Validate using kind cluster
  acm-agent validate config/local-kind.json

CONFIG FILE FORMAT:
  {
    "type": "live-cluster" | "local-kind",
    "bug_spec": "path/to/bug-spec.json",
    "cluster": {
      // cluster connection details
    },
    "options": {
      "screenshots": true,
      "video": false,
      "cleanup": true
    }
  }

LEARN MORE:
  https://github.com/Randy424/acm-validation-agent-demo
`);
}

/**
 * Main agent entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`ACM Validation Agent v${VERSION}`);
    process.exit(0);
  }

  // Parse command
  const command = args[0];
  const configFile = args[1];

  if (command !== 'validate') {
    console.error('Error: Unknown command. Use "validate" or --help');
    process.exit(1);
  }

  if (!configFile) {
    console.error('Error: Config file required. Usage: acm-agent validate <config-file>');
    process.exit(1);
  }

  // Load configuration
  let config;
  try {
    const configPath = path.resolve(configFile);
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error(`Error loading config: ${error.message}`);
    process.exit(1);
  }

  // Validate config
  if (!config.type) {
    console.error('Error: Config must specify "type" (live-cluster or local-kind)');
    process.exit(1);
  }

  // Route to appropriate validator
  console.log(`\n🤖 ACM Validation Agent v${VERSION}`);
  console.log(`📋 Bug Spec: ${config.bug_spec || 'inline'}`);
  console.log(`🎯 Target: ${config.type}\n`);

  if (config.type === 'live-cluster') {
    const LiveClusterValidator = require('./lib/live-cluster-validator');
    const validator = new LiveClusterValidator(config);
    await validator.run();
  } else if (config.type === 'local-kind') {
    const LocalKindValidator = require('./lib/local-kind-validator');
    const validator = new LocalKindValidator(config);
    await validator.run();
  } else {
    console.error(`Error: Unknown type "${config.type}". Must be "live-cluster" or "local-kind"`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Agent failed:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = { main, VERSION };
