# OpenShift + ACM Setup for Agent Demo

## Why OpenShift + ACM?

Using **real OpenShift + ACM operator + ACM UI** makes your demo more compelling:

✅ **Realistic:** Actual production environment, not mocked
✅ **Visual:** Can show ACM console UI in the video
✅ **Complete:** Real placement controller behavior, not simulated
✅ **Credible:** Audience sees this works on real infrastructure

## Installation Requirements

### System Resources

| Component | RAM | Disk | CPU |
|-----------|-----|------|-----|
| OpenShift Local (CRC) | 9GB | 35GB | 4 cores |
| ACM Operator | +2GB | +10GB | +1 core |
| **Total Recommended** | **12GB** | **50GB** | **4 cores** |

### Before the Agent Runs

**Option 1: Pre-install CRC (Recommended)**

Having CRC already installed saves time in the demo:

```bash
# Install CRC
brew install --cask crc

# One-time setup (do this BEFORE running the agent)
crc setup
crc start

# Verify it works
crc status
oc get nodes
```

Then when the agent runs, it just needs to:
- `crc start` (fast restart if already configured)
- Install ACM operator
- Run the bug reproduction

**Option 2: Let Agent Install Everything**

The agent can install CRC from scratch, but this adds 10-15 minutes:
- Download CRC binary
- Run setup
- Start CRC (long first-time init)

## Agent Execution Timeline

When the agent starts with pre-installed CRC:

```
00:00 - Read mock-ticket.json
00:01 - Start CRC (quick restart)
00:02 - Login to OpenShift
00:03 - Create namespace, OperatorGroup
00:04 - Subscribe to ACM operator
00:05-00:15 - Wait for operator pods
00:15 - Create MultiClusterHub
00:16-00:30 - Wait for ACM deployment (~15 components)
00:30 - Verify ACM console accessible
00:31 - Create ManagedClusterSet
00:32 - Create Placement
00:33 - Check Placement status (CLI)
00:34 - Access ACM UI
00:35 - Verify bug in UI
00:36 - Capture screenshots
00:37 - Capture YAML dumps
00:38 - Generate validation report
00:40 - DONE ✅
```

**Total: ~40 minutes** (but you can speed up the video to 3 minutes!)

## What the Agent Will Show in Video

The agent's video will capture:

1. **Terminal Output:**
   - `crc start` and OpenShift initialization
   - `oc` commands creating ACM resources
   - `kubectl get` showing Placement with empty status
   - ACM operator logs

2. **ACM Console (if agent captures screenshots):**
   - Login to ACM UI
   - Navigate to Placements
   - Visual proof of bug (no status shown)

3. **Evidence Collection:**
   - Exporting YAML files
   - Checking events
   - Writing validation report

## Fallback: kind (If Resources Limited)

If your system doesn't have enough resources for CRC:

```yaml
Agent will detect resource constraints and fall back to:
- kind cluster (4GB RAM)
- ACM CRDs only (no operator, no UI)
- Simulated controller behavior

This still works for the demo but loses:
- Real ACM operator validation
- UI screenshots
- "Production-like" environment
```

## Testing CRC Before the Demo

Run this yourself to verify CRC works:

```bash
# Start CRC
crc start

# Check it's healthy
crc status
oc get nodes
oc get co  # All cluster operators should be "Available=True"

# Stop CRC to free resources
crc stop
```

If CRC works for you manually, the agent can use it.

## Demo Day Checklist

Before starting the agent:

- [ ] **CRC is installed** (`crc version` works)
- [ ] **CRC is configured** (`crc setup` has been run)
- [ ] **Docker is running** (for any container operations)
- [ ] **Enough free disk space** (check with `df -h`)
- [ ] **Close other heavy apps** (browsers, IDEs) to free RAM
- [ ] **Network is stable** (operator images need to download)

Then:
1. Open Cursor in the demo directory
2. Start the agent with the AGENT_TASK.md instructions
3. Let it run (30-40 min)
4. Agent records video automatically
5. Review the generated validation report and video
6. Speed up video to 3 minutes for your demo

## What If CRC Fails?

The agent is designed to gracefully fall back:

```
If CRC not installed → use kind
If CRC fails to start → use kind
If ACM operator fails → use ACM CRDs only
If network issues → use cached images where possible
```

The demo still works, just with reduced fidelity.

## Pro Tips

**For the Fastest Agent Run:**

1. Pre-download ACM operator images:
   ```bash
   # After CRC is running, this caches the images
   crc start
   oc create namespace open-cluster-management
   # The agent will find images already available
   ```

2. Use a fast internet connection (operator images are ~2GB total)

3. Don't run other VMs (conflicts with CRC's resources)

**For the Best Video Quality:**

- Let agent run with full ACM operator (shows real behavior)
- Make sure agent captures UI screenshots (visual impact)
- Include both CLI and UI validation in the video

## Estimated Costs

- **CRC (local):** $0 (free, runs on your machine)
- **Cloud OpenShift:** ~$2-5 for a few hours (if you want even more realism)
- **AWS kind cluster:** ~$0.50/hour for a small EC2 instance

**Recommendation for hackathon:** Use CRC (local) - it's free and fully realistic.

---

**Bottom Line:**

Pre-install CRC before the demo → agent completes in ~40 min → you get a complete video showing real OpenShift + ACM + UI → speed it up to 3 min → win the hackathon! 🏆
