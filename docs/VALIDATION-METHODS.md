# Validation Methods: Stagehand vs Puppeteer

The ACM Validation Agent supports two browser automation methods. Choose based on your use case.

---

## 🤖 Stagehand (AI-Powered) - **Recommended for Demo**

**What it is:** Browser automation using Claude AI to understand and navigate UIs semantically.

### When to Use
- ✅ **UI changes frequently** - AI adapts to HTML/CSS changes
- ✅ **Complex navigation** - Multi-step flows with dynamic content
- ✅ **Demo/POC** - Showcasing AI capabilities
- ✅ **Exploratory testing** - When selectors aren't known upfront
- ✅ **Cross-version testing** - Same script works across UI versions

### Pros
- 🎯 **Self-healing** - Works even when class names/IDs change
- 🧠 **Semantic understanding** - "Click the login button" vs CSS selectors
- 🔄 **Adaptable** - Handles dynamic UIs, modals, dropdowns
- 📝 **Readable** - Natural language instructions

### Cons
- 💰 **API costs** - Requires Anthropic API key ($)
- ⏱️ **Slower** - AI inference adds 1-3 seconds per action
- 🎲 **Non-deterministic** - Occasional failures need retry logic
- 🔧 **Complex setup** - Requires proper model configuration

### Setup
```bash
# Set Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Run with Stagehand (default)
npm run agent -- validate agent/config/acm-8376.json
```

### Example Code
```javascript
// Natural language instructions
await stagehand.act("click on the help menu in the top right");
await stagehand.act("click on 'About' in the dropdown");

const versions = await stagehand.extract({
  instruction: "Extract ACM and MCE versions from Dynamic plugins list",
  schema: { acm_version: { type: 'string' } }
});
```

---

## 🎯 Puppeteer (Traditional) - **Alternative Option**

**What it is:** Traditional browser automation using CSS selectors and direct DOM manipulation.

### When to Use
- ✅ **Stable UIs** - UI structure doesn't change often
- ✅ **Production/CI** - Fast, deterministic, no API costs
- ✅ **Known selectors** - You have CSS selectors documented
- ✅ **High volume** - Running hundreds of validations
- ✅ **Offline environments** - No external API calls needed

### Pros
- ⚡ **Fast** - No AI inference delay
- 💯 **Deterministic** - Same input = same output
- 💸 **Free** - No API costs
- 🔒 **Offline** - Works in air-gapped environments
- 🎯 **Precise** - Direct DOM control

### Cons
- 💔 **Brittle** - Breaks when HTML/CSS changes
- 🔧 **Maintenance** - Requires updating selectors for each UI change
- 📝 **Verbose** - More code for complex flows
- 🔍 **Selector hunting** - Need to find/test CSS selectors

### Setup
```bash
# No API key needed, just run
npm run agent -- validate agent/config/acm-8376-puppeteer.json
```

### Example Code
```javascript
// CSS selectors and direct DOM manipulation
await page.click('button[aria-label="Help menu"]');
await page.click('a[href$="/about"]');

const versions = await page.evaluate(() => {
  const plugins = document.querySelectorAll('[role="dialog"] li');
  return Array.from(plugins).map(li => li.textContent);
});
```

---

## 📊 Comparison Matrix

| Feature | Stagehand (AI) | Puppeteer (Traditional) |
|---------|---------------|------------------------|
| **Speed** | 🐢 Slower (AI inference) | ⚡ Fast (direct DOM) |
| **Cost** | 💰 API fees (~$0.01-0.05/run) | 💸 Free |
| **Reliability** | 🎲 95-98% (retry recommended) | 💯 99%+ (if UI stable) |
| **Maintenance** | ✅ Low (self-healing) | ⚠️ High (brittle selectors) |
| **UI Changes** | ✅ Adapts automatically | ❌ Breaks, needs updates |
| **Setup Complexity** | ⚠️ Moderate (API key, config) | ✅ Simple (works OOTB) |
| **Debugging** | ⚠️ Harder (AI black box) | ✅ Easy (explicit selectors) |
| **Demo Value** | 🌟 High (shows AI magic) | 📊 Low (standard automation) |

---

## 🎯 Decision Guide

### Choose Stagehand if:
```
✅ Demonstrating AI capabilities to stakeholders
✅ UI changes frequently (across versions/releases)
✅ Don't want to maintain selector libraries
✅ Budget allows for API costs
✅ Exploratory testing / POC phase
```

### Choose Puppeteer if:
```
✅ Running in CI/CD pipelines (cost-sensitive)
✅ UI is stable and selectors are documented
✅ Need deterministic, fast execution
✅ Air-gapped or offline environment
✅ Production regression testing
```

---

## 🔄 Hybrid Approach (Recommended for Production)

Use **both** methods strategically:

1. **Stagehand** for initial implementation and exploration
2. **Puppeteer** for production CI/CD (once selectors are stable)
3. **Stagehand** as fallback when Puppeteer fails due to UI changes

### Example Workflow
```javascript
try {
  // Try Puppeteer first (fast, cheap)
  await validateWithPuppeteer();
} catch (error) {
  console.log('Puppeteer failed, falling back to Stagehand...');
  // Fallback to Stagehand (slower, self-healing)
  await validateWithStagehand();
}
```

---

## 📁 File Organization

```
test-cases/case-1-live-cluster/
├── acm-8376-validator.js              # Stagehand (AI-powered) ⭐
├── acm-8376-puppeteer-validator.js    # Puppeteer (traditional)
└── bug-spec-acm-8376.json             # Shared bug specification

agent/config/
├── acm-8376.json                      # Stagehand config (default)
└── acm-8376-puppeteer.json            # Puppeteer config
```

---

## 🚀 Quick Start Examples

### Using Stagehand (AI)
```bash
# 1. Set API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# 2. Run validation
npm run agent -- validate agent/config/acm-8376.json

# 3. Check results
cat test-cases/case-1-live-cluster/acm-8376-validation-summary.json
```

### Using Puppeteer
```bash
# 1. Run validation (no API key needed)
npm run agent -- validate agent/config/acm-8376-puppeteer.json

# OR directly:
node test-cases/case-1-live-cluster/acm-8376-puppeteer-validator.js

# 2. Check results
cat test-cases/case-1-live-cluster/puppeteer-acm-8376-validation-summary.json
```

---

## 💡 Tips

### For Stagehand
- Use **clear, imperative instructions**: "click the About link" not "maybe click About"
- Add **wait times** after navigation to let DOM settle
- Implement **retry logic** for critical actions
- Use **post-processing** when extraction returns raw text

### For Puppeteer
- **Document selectors** in a separate file for easy updates
- Use **multiple selector fallbacks** for robustness
- Test selectors in **browser DevTools** before coding
- Add **generous timeouts** for slow-loading UIs

---

**For this demo:** We're using **Stagehand** to showcase AI-powered validation, but **Puppeteer is available** as a production-ready alternative!
