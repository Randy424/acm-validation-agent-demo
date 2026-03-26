# Examples and Tests

This directory contains example scripts and test files for development.

## Test Scripts

### Browser Automation Tests

- `test-puppeteer.js` - Basic Puppeteer test
- `test-stagehand.js` - Initial Stagehand test
- `test-stagehand-anthropic.js` - Stagehand with Anthropic API
- `test-stagehand-working.js` - Working Stagehand example
- Other test-stagehand-*.js - Debug/development versions

### Setup Scripts

- `setup-remote-cluster.sh` - Helper script for remote cluster configuration

### Example Data

- `mock-ticket.json` - Example Jira ticket format

## Usage

These are for development and testing only. For production use, see the [agent documentation](../agent/README.md).

### Running Tests

```bash
# Test Puppeteer
node test-puppeteer.js

# Test Stagehand
node test-stagehand-working.js
```

## Note

These files are not required for normal agent operation. They're kept for:
- Development reference
- Testing new features
- Debugging issues
