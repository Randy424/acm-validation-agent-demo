# 3-Minute Hackathon Demo Script

## Pre-Demo Checklist

- [ ] Docker is running
- [ ] kind and kubectl are installed
- [ ] Cursor is open with acm-validation-agent-demo project
- [ ] Screen recording software ready (QuickTime/OBS)
- [ ] Test run completed successfully (you know it works)
- [ ] Voice-over notes printed/visible

---

## Demo Flow (3 minutes)

### 00:00 - 00:40 | THE PROBLEM (40 seconds)

**[SCREEN: Show mock-ticket.json]**

> "Here's a real problem we face every sprint. A Jira ticket comes in: 'Placement fails when ManagedClusterSet has no matching clusters.'
>
> Normally, I'd spend the next 3 hours:
> - Spinning up an OpenShift cluster
> - Installing ACM
> - Following vague reproduction steps
> - Taking screenshots
> - Writing up findings
>
> Three. Hours. For one bug.
>
> What if an AI could do this for us?"

---

### 00:40 - 01:20 | THE SOLUTION (40 seconds)

**[SCREEN: Show AGENT_TASK.md briefly, then start Cursor Agent]**

> "Meet our validation agent. I'm giving it two things:
> 1. The Jira ticket JSON
> 2. Instructions to reproduce it
>
> Watch what happens next..."

**[ACTION: Start Cursor Agent]**

**[TYPE into Cursor Agent prompt:]**
```
Read AGENT_TASK.md and execute the instructions to reproduce
the bug described in mock-ticket.json. Work autonomously.
```

**[SHOW: Agent starting to work in terminal]**

> "It's reading the ticket... parsing reproduction steps...
> provisioning a kind cluster... creating Kubernetes resources...
>
> No human intervention. I'm literally watching it work while I
> could be writing code for ACM 2.17."

---

### 01:20 - 02:20 | THE MAGIC (60 seconds)

**[SCREEN: Play the AGENT'S VIDEO - sped up 10x]**

> "Here's the video the agent recorded of its own work.
>
> Watch it autonomously BUILD EVERYTHING from scratch:
> - Provisions a Kubernetes cluster in an isolated VM
> - Installs Operator Lifecycle Manager
> - Installs the ACM operator
> - Deploys MultiClusterHub - all 20+ ACM components
> - Creates a ManagedClusterSet
> - Creates a Placement with the exact selector from the ticket
> - Validates the bug using the real placement controller
> - Captures logs, YAML dumps, controller outputs
> - Destroys the entire cluster when done
>
> This is autonomous computer use - COMPLETE infrastructure provisioning.
> The agent started with nothing. Built a full ACM stack. Validated the bug.
> Cleaned up. Zero human intervention. Zero external dependencies."

**[SHOW: Video ends, switch to show generated files]**
```bash
ls -la *.yaml *.md *.mp4
```

> "And... done. Let's see what it found."

---

### 02:20 - 02:50 | THE RESULTS (30 seconds)

**[SCREEN: Open VALIDATION_REPORT.md]**

> "Here's the validation report. The agent confirmed the bug -
> the Placement status is empty when it should show zero matches.
>
> Evidence attached: full YAML dumps, logs, exact reproduction.
>
> Time elapsed? Eight minutes.
>
> My time spent? Thirty seconds to start the agent."

---

### 02:50 - 03:00 | THE IMPACT (10 seconds)

**[SCREEN: Show comparison slide or just speak to camera]**

> "Manual: 3 hours, one bug at a time, 'works on my machine' issues.
>
> Agent: 8 minutes, run 5 in parallel, hermetic environments.
>
> We just multiplied our bug triage capacity by 20×.
>
> Questions?"

---

## Alternative Ending (If Time)

If you have 15-20 extra seconds, add this impact statement:

> "Imagine running this overnight on 50 backlog bugs.
> You wake up to 50 validation reports.
> That's 150 hours of manual work done while you slept.
>
> This isn't replacing engineers - it's amplifying us to focus
> on what matters: fixing bugs, not reproducing them."

---

## Key Talking Points to Hit

✅ **Pain Point:** 2-3 hours per bug, manual, error-prone
✅ **Solution:** Autonomous agent with computer control
✅ **Demo:** Live execution showing real work
✅ **Results:** 8 min vs 3 hrs, full evidence, reliable
✅ **Impact:** 20× throughput multiplier for the team

## What to Show on Screen

1. **mock-ticket.json** - "Here's the bug"
2. **AGENT_TASK.md** - "Here are the instructions"
3. **Cursor Agent starting** - "Watch it work"
4. **Agent's video** (sped up 2-3×) - "Autonomous execution" ⭐ **KEY MOMENT**
5. **Generated files** - "Evidence produced"
6. **VALIDATION_REPORT.md** - "Bug confirmed"

**Pro Tip:** The agent's video is your best visual evidence. It proves the agent worked autonomously without human intervention.

## Voice-Over Tips

- **Energy:** Enthusiastic but not overselling
- **Clarity:** Speak clearly, not too fast
- **Emphasis:** Stress "autonomous", "no human intervention", "8 minutes"
- **Connection:** Tie back to hackathon theme ("eliminate manual toil")

## Recording Setup

### Option 1: Live Demo (Risky but Impressive)
```bash
# Make sure everything works first
kind delete cluster --name acm-bug-test  # Clean slate
# Do a full test run
# THEN record live
```

### Option 2: Use Agent's Video + Voice-over (Recommended ⭐)
```bash
# Run the agent once
# Let it complete and generate its video
# Use the agent's video as the core of your demo
# Add your own voice-over explaining what's happening
# Bookend with slides showing the ticket and results
```

**Why Option 2 is Best:**
- Agent's video is the "proof" - shows autonomous execution
- You can speed it up (2-3×) to fit in 3 minutes
- No need to record your own screen capture
- Professional looking (Cursor's video quality is good)
- Shows exactly what the agent did, no editing needed

### Option 3: Hybrid (Screen Recording + Agent Video)
```bash
# Record yourself starting the agent (15 seconds)
# Cut to agent's video (sped up)
# Record yourself reviewing results (30 seconds)
```

**Recommendation:** Option 2 for hackathon. The agent's video IS your demo - just add narration and context.

## Backup Plan

If agent gets stuck during live demo:

> "Here's what it generated when I ran this earlier..."
> [Switch to pre-recorded VALIDATION_REPORT.md]

Always have a fallback!

---

## Post-Demo: Slack Channel Posting

After uploading your video to #acm-216-celebration-minihackathon:

**Suggested Message:**
```
🤖 Demo: Autonomous Bug Validation Agent

Just posted my hackathon demo! Built an AI agent that autonomously
reproduces ACM bugs from Jira tickets.

What it does:
• Reads Jira ticket
• Provisions test environment (kind + ACM)
• Executes repro steps
• Validates bug exists
• Generates report with evidence

Manual time: 3 hours
Agent time: 8 minutes
My time: 30 seconds to start it

Impact: Team bug triage capacity × 20

This is what "intelligent delegation" looks like!

Video: [link]
Code: https://github.com/[your-repo]/acm-validation-agent-demo

#MinecraftHackathon #AgenticSDLC #NoMoreManualToil
```

---

**You've got this! 🚀**

Remember: The goal isn't perfection - it's showing a compelling vision of how AI eliminates toil. Your enthusiasm and the concept will carry the demo.
