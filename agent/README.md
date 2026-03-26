# ACM Validation Agent

**Unified interface for autonomous bug validation across different environments**

The agent provides a consistent CLI and configuration-driven approach to validating ACM bugs on both live clusters and local test environments.

---

## Architecture

```
agent/
├── index.js                       # Main entry point & CLI
├── lib/
│   ├── live-cluster-validator.js  # Live cluster validation (Stagehand AI)
│   └── local-kind-validator.js    # Local kind cluster validation
└── config/
    ├── live-cluster.example.json  # Example config for live clusters
    └── local-kind.example.json    # Example config for kind clusters
```

---

## Usage

### Command Line Interface

```bash
# Run validation
acm-agent validate <config-file>

# Show help
acm-agent --help

# Show version
acm-agent --version
```

### Via npm Scripts

```bash
# Using example configs
npm run validate:live    # Live cluster validation
npm run validate:kind    # Local kind cluster validation

# Using custom config
npm run agent -- validate path/to/my-config.json
```

---

## Configuration

### Live Cluster Configuration

```json
{
  "type": "live-cluster",
  "bug_spec": "path/to/bug-spec.json",
  "cluster": {
    "name": "production-cluster",
    "username": "YOUR-USERNAME",
    "password": "your-password",
    "api_url": "https://api.cluster.example.com:6443",
    "console_url": "https://console-openshift-console.apps.cluster.example.com"
  },
  "options": {
    "screenshots": true,
    "video": false,
    "cleanup": false
  }
}
```

**Fields:**
- `type`: Must be `"live-cluster"`
- `bug_spec`: Path to bug specification JSON file
- `cluster.name`: Cluster identifier (for reporting)
- `cluster.username`: OpenShift username (typically `YOUR-USERNAME`)
- `cluster.password`: OpenShift password
- `cluster.api_url`: Kubernetes API URL
- `cluster.console_url`: OpenShift Console URL
- `options.screenshots`: Capture screenshots (default: true)
- `options.video`: Record video (not yet implemented)
- `options.cleanup`: Clean up test resources after validation

---

### Local Kind Configuration

```json
{
  "type": "local-kind",
  "bug_spec": "path/to/bug-spec.json",
  "cluster": {
    "name": "acm-validation"
  },
  "options": {
    "provision": true,
    "browser": false,
    "cleanup": false
  }
}
```

**Fields:**
- `type`: Must be `"local-kind"`
- `bug_spec`: Path to bug specification JSON file
- `cluster.name`: Kind cluster name
- `options.provision`: Create cluster if it doesn't exist (default: true)
- `options.browser`: Run browser validation (default: false)
- `options.cleanup`: Delete cluster after validation (default: false)

---

## Bug Specification Format

```json
{
  "jira_ticket": "ACM-XXXXX",
  "summary": "Brief description of the bug",
  "steps_to_reproduce": [
    {
      "step": 1,
      "action": "Navigate to page X"
    },
    {
      "step": 2,
      "action": "Click button Y"
    }
  ],
  "expected_result": "What should happen",
  "actual_result": "What actually happens",
  "validation_criteria": {
    "bug_confirmed_if": [
      "Condition 1",
      "Condition 2"
    ]
  }
}
```

---

## Workflow

### Live Cluster Validation

```
┌─────────────────────┐
│  User provides      │
│  configuration      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Agent prepares      │
│ cluster config      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Stagehand AI        │
│ navigates UI        │
│ (Claude-powered)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Capture evidence    │
│ - Screenshots       │
│ - Alert messages    │
│ - Page state        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Generate report     │
│ - Summary JSON      │
│ - Markdown report   │
└─────────────────────┘
```

### Local Kind Validation

```
┌─────────────────────┐
│  User provides      │
│  configuration      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check prerequisites │
│ - Docker            │
│ - kind              │
│ - kubectl           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Provision cluster   │
│ (if needed)         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Install ACM CRDs    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Create test         │
│ resources           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ CLI validation      │
│ (kubectl)           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Generate report     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Cleanup (optional)  │
└─────────────────────┘
```

---

## Examples

### Example 1: Validate UI Bug on Production Cluster

```bash
# 1. Create configuration
cat > my-bug.json <<EOF
{
  "type": "live-cluster",
  "bug_spec": "../test-cases/case-1-live-cluster/bug-spec.json",
  "cluster": {
    "name": "prod-cluster",
    "username": "YOUR-USERNAME",
    "password": "secret123",
    "console_url": "https://console.example.com"
  }
}
EOF

# 2. Run validation
acm-agent validate my-bug.json

# 3. Check results
ls -la ../test-cases/case-1-live-cluster/
# - stagehand-validation-summary.json
# - FINAL_VALIDATION_REPORT.md
# - stagehand-*.png (screenshots)
```

### Example 2: Test Locally with Kind

```bash
# 1. Create configuration
cat > test-local.json <<EOF
{
  "type": "local-kind",
  "cluster": {
    "name": "test-cluster"
  },
  "options": {
    "provision": true,
    "cleanup": true
  }
}
EOF

# 2. Run validation
acm-agent validate test-local.json

# Cluster will be created, tested, and deleted automatically
```

---

## Environment Variables

The agent respects these environment variables:

- `ANTHROPIC_API_KEY` - Required for Stagehand AI navigation
- `DEBUG` - Set to `true` for verbose output

```bash
# Set in .env file
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
DEBUG=false
```

---

## Exit Codes

- `0` - Success
- `1` - Validation failed or error occurred

---

## Extending the Agent

### Adding a New Validator

1. Create validator in `lib/`:

```javascript
// lib/my-validator.js
class MyValidator {
  constructor(config) {
    this.config = config;
  }

  async run() {
    console.log('Running my validator...');
    // Implementation
  }
}

module.exports = MyValidator;
```

2. Register in `index.js`:

```javascript
if (config.type === 'my-type') {
  const MyValidator = require('./lib/my-validator');
  const validator = new MyValidator(config);
  await validator.run();
}
```

3. Create example config in `config/my-type.example.json`

---

## Troubleshooting

### "Command not found: acm-agent"

```bash
# Option 1: Use npm script
npm run agent -- validate config.json

# Option 2: Install globally
npm install -g .
acm-agent --version

# Option 3: Run directly
node agent/index.js validate config.json
```

### "Stagehand initialization failed"

- Check that `ANTHROPIC_API_KEY` is set in `.env`
- Verify API key is valid
- Check internet connection

### "Cluster not accessible"

- Verify cluster credentials in config
- Test connection: `oc login <api-url> -u <username> -p <password>`
- Check network/VPN access

---

## Learn More

- [Main README](../README.md)
- [Test Case 1: Live Cluster](../test-cases/case-1-live-cluster/README.md)
- [Test Case 2: Local Kind](../test-cases/case-2-local-kind/README.md)
- [Stagehand Documentation](https://github.com/browserbasehq/stagehand)
