# ACM Validation Agent - Onboarding Guide

## Quick Start (First Time Setup)

When you clone this repository for the first time, follow these steps to get up and running:

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Setup Wizard

```bash
npm run setup
```

The setup wizard will ask you for:

#### Environment Configuration
- **Test environment type**: Live OpenShift cluster or local kind cluster
  - Choose **live-cluster** for UI bug validation (recommended)
  - Choose **local-kind** for API/backend bug testing

#### Cluster Credentials
For live clusters:
- Cluster name (e.g., "prod-cluster")
- Username (default: kubeadmin)
- Password
- Console URL (e.g., https://console-openshift-console.apps.your-cluster.com)
- API URL (optional)

For kind clusters:
- Cluster name (default: acm-validation)
- Auto-provision option

#### Tool Configuration
- **Browser automation**: Stagehand (AI-powered) vs Puppeteer (direct selectors)
  - **Stagehand recommended** - uses Claude AI for intelligent navigation
  - Requires Anthropic API key
- Headless mode preference
- Screenshot quality (0-100)

#### Jira Integration (Optional)
- Enable/disable Jira integration
- Jira server URL (default: https://redhat.atlassian.net)
- Authentication method:
  - **API Token** (recommended)
  - Username/Password
- Default project key (e.g., ACM)

### 3. Configuration Storage

All your settings are saved in:
- `agent/config/user-config.json` (your credentials - gitignored)
- `.env` (Anthropic API key - gitignored)

**These files are never committed to git** - they're in .gitignore for security.

---

## Usage Patterns

### Pattern 1: Validate from Jira Ticket

The easiest way to validate a bug:

```bash
npm run validate:jira ACM-31343
```

**What happens:**
1. ✅ Fetches bug details from Jira automatically
2. ✅ Creates bug-spec.json from Jira data
3. ✅ Infers validation type from bug description
4. ✅ Creates test case directory
5. ✅ Runs validation with your configured cluster
6. ✅ Generates report with screenshots

**Output:**
```
test-cases/ACM-31343/
├── bug-spec.json                      # Auto-generated from Jira
├── cluster-config.json                # From your setup
├── ACM-31343-validation-summary.json  # Results
├── ACM-31343-VALIDATION-REPORT.md     # Human-readable report
└── ACM-31343-*.png                    # Screenshots
```

### Pattern 2: Manual Bug Spec

If you want more control or don't have Jira integration:

```bash
# 1. Create test case directory
mkdir test-cases/ACM-XXXXX

# 2. Create bug spec manually
cat > test-cases/ACM-XXXXX/bug-spec.json <<EOF
{
  "jira_ticket": "ACM-XXXXX",
  "summary": "Brief description",
  "validation_type": "zoom-test",
  "environment": {
    "component": "Cluster Pools"
  }
}
EOF

# 3. Run validation
npm run validate test-cases/ACM-XXXXX
```

### Pattern 3: Custom Configuration

Override your default config for a specific test:

```bash
# Edit the auto-generated cluster-config.json before running
vim test-cases/ACM-XXXXX/cluster-config.json

# Run validation
npm run validate test-cases/ACM-XXXXX
```

---

## Validation Types

The validator automatically infers the validation type from your bug description, or you can specify it manually:

### 1. Zoom Test (`validation_type: "zoom-test"`)

**Auto-detected when:** Bug mentions "zoom", "zoom in", "zoom out"

**Tests:** UI element positioning at different zoom levels (50%, 75%, 100%, 125%, 150%, 200%)

**Example:**
```json
{
  "jira_ticket": "ACM-31343",
  "validation_type": "zoom-test",
  "zoom_levels": [50, 75, 100, 125, 150, 200]
}
```

### 2. Alert Check (`validation_type: "alert-check"`)

**Auto-detected when:** Bug mentions "alert", "warning", "error message"

**Tests:** Extracts and validates all alert messages on a page

**Example:**
```json
{
  "jira_ticket": "ACM-30661",
  "validation_type": "alert-check",
  "environment": {
    "component": "Automation"
  }
}
```

### 3. UI Element (`validation_type: "ui-element"`)

**Auto-detected when:** Bug mentions "button", "form", "field", "ui"

**Tests:** Step-by-step UI interaction validation

**Example:**
```json
{
  "jira_ticket": "ACM-XXXXX",
  "validation_type": "ui-element",
  "steps_to_reproduce": [
    { "step": 1, "action": "click on Create cluster" },
    { "step": 2, "action": "select AWS provider" }
  ]
}
```

### 4. Standard (`validation_type: "standard"`)

**Default fallback:** Basic page navigation and screenshot

---

## Reconfiguration

### Update Existing Configuration

```bash
npm run setup
```

The wizard will detect your existing config and ask if you want to update it.

### View Current Configuration

```bash
cat agent/config/user-config.json
```

### Delete Configuration (Start Fresh)

```bash
rm agent/config/user-config.json
rm .env
npm run setup
```

---

## Working with Multiple Clusters

You can configure multiple clusters by creating separate config files:

```bash
# Setup for prod cluster
npm run setup
mv agent/config/user-config.json agent/config/prod-cluster.json

# Setup for dev cluster
npm run setup
mv agent/config/user-config.json agent/config/dev-cluster.json

# Use specific config
cp agent/config/prod-cluster.json agent/config/user-config.json
npm run validate:jira ACM-XXXXX
```

---

## Jira Integration Details

### With jira-api CLI Tool

If you have `jira-api` installed:

```bash
# The validator will use this automatically
jira-api view ACM-31343
```

### With Direct API Access

The validator can also fetch directly via curl if configured with:
- Jira server URL
- API token or credentials

### Manual Jira Workflow

If Jira integration is disabled:

1. Manually copy issue details from Jira
2. Create bug-spec.json with the details
3. Run validation: `npm run validate test-cases/ACM-XXXXX`

---

## Directory Structure

After onboarding, your repository will look like:

```
acm-validation-agent-demo/
├── .env                           # Your Anthropic API key (gitignored)
├── agent/
│   └── config/
│       ├── user-config.json       # Your settings (gitignored)
│       ├── *.example.json         # Templates (committed)
│       └── ...
├── test-cases/
│   ├── ACM-31343/                 # Auto-created per bug
│   │   ├── bug-spec.json
│   │   ├── cluster-config.json
│   │   ├── *.png                  # Screenshots
│   │   └── *REPORT.md             # Results
│   └── ...
├── shared/
│   └── generic-validator.js       # The single validator
├── setup.js                       # Setup wizard
├── validate-jira.js               # Jira integration
└── VALIDATOR-GUIDE.md             # Usage reference
```

---

## Troubleshooting

### "Configuration not found"

```bash
npm run setup
```

### "Jira integration is not enabled"

Re-run setup and enable Jira:
```bash
npm run setup
# Answer "yes" to "Enable Jira integration?"
```

### "Failed to fetch Jira issue"

Check your Jira credentials:
```bash
cat agent/config/user-config.json
# Verify jira.api_token or jira.username/password
```

Test Jira access manually:
```bash
jira-api view ACM-31343
```

### "ANTHROPIC_API_KEY not found"

Check your .env file:
```bash
cat .env
# Should contain: ANTHROPIC_API_KEY=sk-ant-api03-...
```

If missing, re-run setup:
```bash
npm run setup
```

### "Cluster not accessible"

Test cluster access:
```bash
curl -k https://console-openshift-console.apps.your-cluster.com
```

Verify credentials in `agent/config/user-config.json`

---

## Security Best Practices

1. **Never commit credentials**
   - `agent/config/user-config.json` is gitignored
   - `.env` is gitignored
   - `test-cases/*/cluster-config.json` is gitignored

2. **API Key Storage**
   - Anthropic API key goes in `.env`
   - Jira API token goes in `user-config.json`
   - Both are gitignored

3. **Cluster Credentials**
   - Stored only in local config files
   - Never in git history
   - Automatically excluded from commits

4. **Review .gitignore**
   ```bash
   cat .gitignore
   # Verify your sensitive files are listed
   ```

---

## Next Steps After Onboarding

Once setup is complete:

1. **Validate your first bug:**
   ```bash
   npm run validate:jira ACM-31343
   ```

2. **Review the results:**
   ```bash
   ls test-cases/ACM-31343/
   cat test-cases/ACM-31343/ACM-31343-VALIDATION-REPORT.md
   ```

3. **Explore validation types:**
   ```bash
   cat VALIDATOR-GUIDE.md
   ```

4. **Customize for your workflow:**
   - Edit `agent/config/user-config.json` to adjust settings
   - Create bug-spec templates for common bug types
   - Set up shortcuts in your shell profile

---

## Getting Help

- **Setup questions:** `cat ONBOARDING.md` (this file)
- **Usage questions:** `cat VALIDATOR-GUIDE.md`
- **Technical details:** `cat README.md`
- **Issues:** https://github.com/Randy424/acm-validation-agent-demo/issues

---

**Welcome to the ACM Validation Agent! 🎉**

You're now ready to validate bugs autonomously with AI-powered testing.
