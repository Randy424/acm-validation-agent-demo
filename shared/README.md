# Shared Modules

Reusable components for ACM bug validation across different test cases.

## Files

### `dashboard-validator.js`
**Purpose:** Kubernetes Dashboard browser automation

**Features:**
- Token authentication
- Navigation to Custom Resource Definitions
- Screenshot capture at each step
- JSON summary generation

**Usage:**
```bash
# Ensure kubectl proxy is running
kubectl proxy &

# Set environment variables
export DASHBOARD_URL="http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/"
export DASHBOARD_TOKEN="your-token-here"

# Run
node dashboard-validator.js
```

**Dependencies:** Puppeteer, dotenv

---

### `acm-crds.yaml`
**Purpose:** ACM Custom Resource Definitions for kind clusters

**Includes:**
- ManagedClusterSet CRD
- Placement CRD
- ManagedCluster CRD

**Features:**
- Compatible with Kubernetes 1.35+
- Flexible spec with `x-kubernetes-preserve-unknown-fields: true`
- Minimal version for testing without full ACM operator

**Usage:**
```bash
kubectl apply -f acm-crds.yaml
```

---

### `customer-spec.json`
**Purpose:** Example bug specification format

**Structure:**
```json
{
  "bug_id": "ACM-XXXXX",
  "description": "Bug summary",
  "test_scenario": {
    "resources_to_create": [],
    "expected_behavior": "",
    "actual_behavior": ""
  }
}
```

**Usage:**
- Copy and modify for new test cases
- Use as input to automation scripts
- Provides consistent format across validations

---

## How to Use These Modules

### In Your Test Case

1. **Copy to your test case directory:**
```bash
cp shared/dashboard-validator.js test-cases/my-case/
```

2. **Modify for your needs:**
- Update navigation steps
- Change selectors
- Add custom validation logic

3. **Keep shared version updated:**
```bash
# After improving your validator
cp test-cases/my-case/improved-validator.js shared/
```

### Creating New Shared Modules

Guidelines for adding new shared modules:

1. **Make it reusable** - Parameterize cluster URLs, credentials, etc.
2. **Document it** - Add clear comments and usage examples
3. **Test it** - Verify on both kind and real clusters
4. **Update this README** - Add section for your module

---

## Best Practices

### Configuration
- Use environment variables for cluster-specific values
- Provide `.env.example` templates
- Support both env vars and config files

### Error Handling
- Add try/catch blocks
- Capture screenshots on errors
- Log verbose output for debugging

### Evidence Capture
- Screenshot at each major step
- Save JSON summaries
- Generate human-readable reports

### Timing
- Add explicit waits for page loads
- Use `waitForSelector` instead of fixed delays
- Handle OAuth redirects gracefully

---

## Module Checklist

When creating new shared modules:

- [ ] Works with kind clusters
- [ ] Works with real OpenShift clusters
- [ ] Handles authentication (token, OAuth)
- [ ] Captures screenshots
- [ ] Generates JSON summary
- [ ] Has error handling
- [ ] Documented in this README
- [ ] Example usage provided
- [ ] Dependencies listed in package.json

---

## Contributing

To add new shared modules:

1. Create your module in `shared/`
2. Test in at least one test case
3. Document in this README
4. Update main README.md if significant

---

## Dependencies

All shared modules assume:
- Node.js >= 18.0.0
- npm >= 9.0.0
- Puppeteer installed
- Docker running (for kind)
- kubectl configured

Install all dependencies:
```bash
npm install
```
