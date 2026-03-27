# ACM Validation Agent - User Guide

## Overview

The ACM Validation Agent is a **configuration-driven** system that validates bugs autonomously. **No custom code needed per defect** - just configure the bug spec and run.

---

## Quick Start

### 1. Create Bug Specification

```bash
mkdir test-cases/ACM-XXXXX
```

Create `test-cases/ACM-XXXXX/bug-spec.json`:

```json
{
  "jira_ticket": "ACM-XXXXX",
  "summary": "Brief description of the bug",
  "validation_type": "zoom-test",
  "environment": {
    "component": "Cluster Pools"
  }
}
```

### 2. Create Cluster Config

Create `test-cases/ACM-XXXXX/cluster-config.json`:

```json
{
  "cluster_name": "your-cluster",
  "cluster_type": "openshift",
  "credentials": {
    "username": "kubeadmin",
    "password": "your-password",
    "console_url": "https://console-openshift-console.apps.your-cluster.com"
  }
}
```

### 3. Run Validation

```bash
node shared/generic-validator.js test-cases/ACM-XXXXX
```

**That's it!** No custom scripts needed.

---

## Validation Types

### Zoom Test (`validation_type: "zoom-test"`)

Tests UI element positioning at different zoom levels.

**Bug Spec:**
```json
{
  "jira_ticket": "ACM-31343",
  "validation_type": "zoom-test",
  "zoom_levels": [50, 75, 100, 125, 150, 200],
  "environment": {
    "component": "Cluster Pools"
  },
  "steps_to_reproduce": [
    {
      "step": 1,
      "action": "click on the first cluster pool in the list"
    }
  ]
}
```

**What it does:**
1. Navigates to specified component
2. Executes reproduction steps
3. Tests each zoom level
4. Captures screenshots at each level
5. Generates report

---

### Alert Check (`validation_type: "alert-check"`)

Validates alert messages on a page.

**Bug Spec:**
```json
{
  "jira_ticket": "ACM-30661",
  "validation_type": "alert-check",
  "environment": {
    "component": "Automation"
  }
}
```

**What it does:**
1. Navigates to specified component
2. Uses AI to extract all alert messages
3. Captures screenshots
4. Generates report with alert details

---

### UI Element Check (`validation_type: "ui-element"`)

Validates UI element behavior through specific steps.

**Bug Spec:**
```json
{
  "jira_ticket": "ACM-XXXXX",
  "validation_type": "ui-element",
  "environment": {
    "component": "Clusters"
  },
  "steps_to_reproduce": [
    {
      "step": 1,
      "action": "click on the Create cluster button"
    },
    {
      "step": 2,
      "action": "select OpenShift from the provider list"
    },
    {
      "step": 3,
      "action": "observe the form validation message"
    }
  ]
}
```

**What it does:**
1. Navigates to specified component
2. Executes each step using AI
3. Captures screenshot after each step
4. Generates report

---

### Standard Validation (`validation_type: "standard"`)

Default validation - navigates to page and captures evidence.

**Bug Spec:**
```json
{
  "jira_ticket": "ACM-XXXXX",
  "validation_type": "standard",
  "environment": {
    "component": "Applications"
  }
}
```

---

## Component Navigation

The validator automatically maps components to pages:

| Component | Page Path |
|-----------|-----------|
| `Cluster Pools` | `/multicloud/infrastructure/clusters/clusterpools` |
| `Automation` | `/multicloud/infrastructure/automations` |
| `Clusters` | `/multicloud/infrastructure/clusters` |
| `Applications` | `/multicloud/applications` |
| `Governance` | `/multicloud/governance` |

**AI Navigation:** The validator first tries AI-powered navigation, then falls back to direct URLs.

---

## Generated Artifacts

Each validation produces:

```
test-cases/ACM-XXXXX/
├── bug-spec.json                           # Your configuration
├── cluster-config.json                     # Cluster credentials
├── ACM-XXXXX-validation-summary.json       # Machine-readable results
├── ACM-XXXXX-VALIDATION-REPORT.md          # Human-readable report
├── ACM-XXXXX-1-console-landing.png         # Screenshot 1
├── ACM-XXXXX-2-provider-selected.png       # Screenshot 2
├── ACM-XXXXX-3-credentials-entered.png     # Screenshot 3
└── ...                                     # More screenshots
```

---

## Configuration Reference

### Bug Spec Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `jira_ticket` | ✅ | string | Jira ticket ID (e.g., "ACM-31343") |
| `summary` | ✅ | string | Brief description |
| `validation_type` | ❌ | string | Type: `zoom-test`, `alert-check`, `ui-element`, `standard` (default) |
| `zoom_levels` | ❌ | number[] | Zoom percentages for zoom-test |
| `steps_to_reproduce` | ❌ | object[] | Steps for ui-element validation |
| `environment.component` | ✅ | string | Target component name |
| `expected_result` | ❌ | string | What should happen |
| `actual_result` | ❌ | string | What actually happens |

### Cluster Config Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `cluster_name` | ✅ | string | Cluster identifier |
| `cluster_type` | ✅ | string | Type: `openshift` |
| `credentials.username` | ✅ | string | OpenShift username |
| `credentials.password` | ✅ | string | OpenShift password |
| `credentials.console_url` | ✅ | string | Console URL |

---

## Using the Agent CLI

The agent framework wraps the generic validator:

```bash
# Using agent CLI
npm run agent -- validate agent/config/acm-31343.json

# Or directly
node shared/generic-validator.js test-cases/ACM-31343
```

---

## Troubleshooting

### "ANTHROPIC_API_KEY not found"

Ensure `.env` file exists in project root:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### "Failed to authenticate"

- Verify cluster credentials in `cluster-config.json`
- Ensure cluster is accessible
- Check VPN connection if needed

### "Navigation failed"

The validator tries AI navigation first, then falls back to direct URLs. Both failures are logged.

### Custom Components

To add new components, edit `generic-validator.js`:

```javascript
const navMap = {
  'Your Component': 'navigate to Your Component under Menu',
  // ...
};

const urlMap = {
  'Your Component': '/multicloud/your/path',
  // ...
};
```

---

## Best Practices

1. **One directory per bug**: `test-cases/ACM-XXXXX/`
2. **Descriptive validation types**: Choose the right type for your bug
3. **Clear reproduction steps**: Use natural language AI can understand
4. **Verify cluster access**: Test credentials before validation
5. **Review screenshots**: Always verify visual evidence

---

## Example: Complete Workflow

```bash
# 1. Create test case directory
mkdir test-cases/ACM-32000

# 2. Create bug spec
cat > test-cases/ACM-32000/bug-spec.json <<EOF
{
  "jira_ticket": "ACM-32000",
  "summary": "Button overlaps text on Applications page",
  "validation_type": "ui-element",
  "environment": {
    "component": "Applications"
  },
  "steps_to_reproduce": [
    {
      "step": 1,
      "action": "click on Create application"
    }
  ]
}
EOF

# 3. Create cluster config (copy from existing)
cp test-cases/acm-31343/cluster-config.json test-cases/ACM-32000/

# 4. Run validation
node shared/generic-validator.js test-cases/ACM-32000

# 5. Review results
ls test-cases/ACM-32000/
cat test-cases/ACM-32000/ACM-32000-VALIDATION-REPORT.md
```

---

## Migration from Old Scripts

**Before (custom scripts):**
```
test-cases/acm-31343/
├── acm-31343-zoom-validator.js        ❌ Custom code
├── acm-31343-zoom-validator-v2.js     ❌ More custom code
├── acm-31343-simple-validator.js      ❌ Even more custom code
└── bug-spec.json
```

**After (configuration-driven):**
```
test-cases/acm-31343/
├── bug-spec.json                       ✅ Just configuration
├── cluster-config.json                 ✅ Just configuration
└── [generated artifacts]
```

**No more custom scripts per defect!**

---

## Summary

✅ **Configuration-driven** - No coding per defect
✅ **Multiple validation types** - zoom, alerts, UI elements, standard
✅ **AI-powered navigation** - Natural language instructions
✅ **Automatic evidence capture** - Screenshots + reports
✅ **Consistent experience** - Same workflow for all defects
✅ **Scalable** - Add new defects in minutes, not hours
