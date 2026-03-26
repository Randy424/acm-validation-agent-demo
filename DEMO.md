# Demo Script - ACM Bug Validation Agent

**Recording a demo of autonomous bug validation with Stagehand AI**

---

## 🎬 Demo Flow (2-3 minutes)

### Scene 1: The Problem (15 seconds)

**Show:** Jira ticket ACM-30661

```bash
# Show the bug specification
cat test-cases/case-1-live-cluster/bug-spec.json
```

**Say:**
> "Here's a Jira ticket reporting an incorrect alert in ACM. Normally, a QE engineer would spend 30-40 minutes manually reproducing this. Let's let the AI agent handle it."

---

### Scene 2: Agent Execution (30 seconds setup + 60 seconds runtime)

**Run the agent:**

```bash
# Single command - that's it!
npm run agent -- validate agent/config/demo-acm-30661.json

# Or if installed globally:
acm-agent validate agent/config/demo-acm-30661.json
```

**Say while it runs:**
> "The agent is now:
> - Connecting to our live OpenShift cluster
> - Using Claude AI via Stagehand to navigate the UI
> - Automatically logging in via OAuth
> - Finding the Automation page
> - Extracting the alert message
> - Capturing screenshots as evidence"

**Watch the output:**
```
🤖 ACM Validation Agent v1.0.0
📋 Bug Spec: ../test-cases/case-1-live-cluster/bug-spec.json
🎯 Target: live-cluster

🌐 Live Cluster Validation

📝 Preparing cluster configuration...
   ✓ Cluster config written: cluster-config.json

📋 Preparing bug specification...
   ✓ Bug spec written: ACM-30661

🤖 Starting AI-powered validation with Stagehand...
```

---

### Scene 3: Results (30 seconds)

**Show the evidence:**

```bash
# View validation summary
cat test-cases/case-1-live-cluster/stagehand-validation-summary.json | jq .

# Show screenshots captured
ls -lh test-cases/case-1-live-cluster/stagehand-*.png

# Show the validation report
cat test-cases/case-1-live-cluster/FINAL_VALIDATION_REPORT.md
```

**Show the screenshot:**
```bash
open test-cases/case-1-live-cluster/final-3-automation-page-loaded.png
```

**Point to the alert in the screenshot**

**Say:**
> "The agent found the alert, captured it, and generated a complete validation report - all autonomously. What took 30-40 minutes manually now takes 1-2 minutes with zero human intervention."

---

### Scene 4: The Innovation (30 seconds)

**Open the validator code briefly:**

```bash
cat test-cases/case-1-live-cluster/acm-stagehand-validator.js | grep -A 5 "stagehand.act"
```

**Say:**
> "Here's what makes this special - instead of brittle CSS selectors, we use Claude AI to navigate:
>
> `stagehand.act({ action: 'click on the authentication provider' })`
>
> Claude understands the UI semantically. When the HTML changes, traditional automation breaks. This adapts."

---

## 🎯 Key Talking Points

### The Problem
- QE engineers spend 3-4 hours reproducing bugs manually
- 30-40 minutes just for this UI bug
- Error-prone, repetitive, blocks other work

### The Solution
- AI agent with Claude-powered navigation
- Autonomous end-to-end validation
- Comprehensive evidence capture
- 95% time savings

### The Innovation
- **Stagehand AI**: Claude navigates UIs intelligently
- **No brittle selectors**: Works even when UI changes
- **Semantic understanding**: "Click the login button" vs `button.pf-c-button[data-test='login']`

### The Impact
- 30-40 minutes → 1-2 minutes
- Zero human intervention
- Production-ready validation reports
- Scales to 50 bugs simultaneously

---

## 📝 Demo Checklist

**Before Recording:**
- [ ] Cluster is accessible
- [ ] AAP is uninstalled (to trigger the alert)
- [ ] `ANTHROPIC_API_KEY` is set in `.env`
- [ ] Terminal is clean and visible
- [ ] Browser automation is visible (set `headless: false` if not already)

**Verify it works:**
```bash
# Test run before recording
npm run agent -- validate agent/config/demo-acm-30661.json
```

**For the recording:**
- [ ] Clear terminal: `clear`
- [ ] Start screen recording
- [ ] Follow script above
- [ ] Keep it under 3 minutes
- [ ] End with evidence showcase

---

## 🎥 Production Tips

### Terminal Setup
```bash
# Use a large, readable font
# Clear scrollback
clear

# Show current directory for context
pwd

# Optional: Show the agent help first
acm-agent --help
```

### Pacing
- Don't rush the setup (show Jira ticket clearly)
- Let the agent output scroll (shows it's working)
- Pause on the final screenshot (the money shot!)
- End with a clear call to action

### Script Variation (Shorter - 90 seconds)

**Setup (20s):**
"Here's a bug ticket. Watch the AI agent validate it."

**Execute (40s):**
`acm-agent validate agent/config/demo-acm-30661.json`
(Let it run, minimal narration)

**Results (30s):**
Show screenshot, show report, done.

---

## 🚀 After the Demo

**Follow-up questions to expect:**

**Q: Does it only work for ACM?**
A: No - it's extensible. The AI navigation works on any web UI. We've shown ACM, but the same approach works for OpenShift Console, Jira, any web app.

**Q: What if the UI changes?**
A: That's the point! Claude understands "click the login button" regardless of the HTML structure. Traditional automation breaks; this adapts.

**Q: Can it fix bugs too?**
A: Not yet - it validates and reports. But you could extend it to apply fixes and re-validate.

**Q: How accurate is it?**
A: We've validated ACM-30661 successfully. The AI navigation is remarkably good at understanding UI intent.

---

**Demo Status:** ✅ Ready to record!
