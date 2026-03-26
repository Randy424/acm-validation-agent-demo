# 🚀 START HERE - Cursor Agent Demo

## What You're About to See

The Cursor agent will **autonomously provision a complete ACM stack from scratch** and validate a bug - all in ~30 minutes with zero human intervention.

---

## Prerequisites

✅ **Cursor Business/Pro** subscription with Agent mode
✅ **That's it!** The agent builds everything else

---

## Run the Demo (3 Steps)

### Step 1: Open in Cursor

```bash
cd ~/Repositories/acm-validation-agent-demo
cursor .
```

### Step 2: Start Cursor Agent

In Cursor:
1. Press **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux)
2. Type "Cursor: Start Agent"
3. Select it

### Step 3: Give the Agent This Task

Copy and paste this into the agent prompt:

```
Read AGENT_TASK_ISOLATED.md and execute all instructions autonomously.

Build complete infrastructure from scratch:
- kind cluster
- OLM
- ACM operator
- MultiClusterHub

Then reproduce the bug from mock-ticket.json, capture evidence,
generate a validation report, and clean up everything.

Work completely autonomously - do not ask for human input.
```

Press **Enter**.

---

## What Happens Next

The agent will work for ~25-30 minutes:

```
[00:00-00:03] Installing kind and kubectl
[00:03-00:05] Creating kind cluster
[00:05-00:08] Installing OLM
[00:08-00:15] Installing ACM operator
[00:15-00:28] Deploying MultiClusterHub (all ACM components)
[00:28-00:30] Creating test resources
[00:30-00:32] Validating bug exists
[00:32-00:34] Capturing evidence
[00:34-00:35] Generating validation report
[00:35-00:36] Deleting kind cluster (cleanup)
[00:36]       DONE ✅
```

**You can watch it work in real-time** via Cursor's agent interface.

**You can do other work** - the agent runs autonomously.

---

## When It Finishes

Check your directory:

```bash
ls -la

# You should see:
# ✅ VALIDATION_REPORT.md       - Detailed bug report
# ✅ agent-session.mp4          - Video of the entire session
# ✅ placement-status.yaml      - Bug evidence
# ✅ *.yaml, *.log files        - Additional evidence
```

**Read the report:**
```bash
cat VALIDATION_REPORT.md
```

**Watch the video:**
- The agent recorded its entire session
- This video shows complete infrastructure provisioning
- Speed it up 10× for your 3-minute hackathon demo

---

## For Your Hackathon Demo

### 1. Speed Up the Video

```bash
# Speed up 10× (30 min → 3 min)
ffmpeg -i agent-session.mp4 -filter:v "setpts=0.1*PTS" demo-fast.mp4
```

### 2. Add Voice-Over

While the video plays, narrate:

> "Here's a Jira ticket about a Placement bug in ACM.
>
> Instead of spending 4 hours manually reproducing it, I gave it to a Cursor agent.
>
> Watch as it autonomously:
> - Provisions a complete Kubernetes cluster
> - Installs the ACM operator stack
> - Reproduces the exact bug scenario
> - Validates the issue exists
> - Captures full evidence
> - Cleans up everything
>
> Total time: 30 minutes autonomous. My time: 30 seconds.
>
> This is intelligent delegation - the agent did all the toil."

### 3. Show the Report

End by showing `VALIDATION_REPORT.md`:

> "And here's the validation report - ready for the engineering team.
>
> Bug confirmed. Evidence attached. Zero manual work."

---

## Troubleshooting

### "Cursor Agent not available"
- Ensure you have Cursor Business/Pro subscription
- Check Cursor version (needs latest)
- Try restarting Cursor

### Agent gets stuck during ACM installation
- This is normal - ACM deployment takes 10-15 minutes
- Let it run - the agent will wait
- Check agent's terminal for progress

### Agent fails to install OLM
- Might be networking issue downloading images
- Agent should retry automatically
- Check agent logs for specific errors

### Want to stop early?
- You can stop the agent anytime
- But: kind cluster will be left running
- Manually clean up: `kind delete cluster --name acm-bug-validation`

---

## What Makes This Impressive

This isn't just automation - it's **autonomous infrastructure provisioning**:

✅ **Complete isolation** - Everything in the agent's VM
✅ **From scratch** - No pre-existing infrastructure needed
✅ **Real ACM** - Actual operator, not mocked behavior
✅ **Unattended** - Agent makes all decisions
✅ **Self-cleaning** - Destroys everything when done
✅ **Auditable** - Full video + logs + evidence

**This matches the Cursor blog examples** - true autonomous computer use.

---

## Ready?

```bash
cd ~/Repositories/acm-validation-agent-demo
cursor .

# Then start the agent and paste the task above!
```

**Good luck with your hackathon! 🏆**
