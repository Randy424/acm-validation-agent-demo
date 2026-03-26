# OpenShift + ACM Setup Guide

## Why OpenShift + ACM?

Using **real OpenShift + ACM operator + ACM UI** provides the most realistic validation:

✅ **Realistic:** Actual production environment, not mocked
✅ **Visual:** Full ACM console UI available
✅ **Complete:** Real placement controller behavior, not simulated
✅ **Production-ready:** Tests on actual infrastructure

## Installation Requirements

### System Resources

| Component | RAM | Disk | CPU |
|-----------|-----|------|-----|
| OpenShift Local (CRC) | 9GB | 35GB | 4 cores |
| ACM Operator | +2GB | +10GB | +1 core |
| **Total Recommended** | **12GB** | **50GB** | **4 cores** |

### Installation Options

**Option 1: Pre-install CRC (Recommended)**

Having CRC already installed saves time:

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

**Total: ~40 minutes**

## What the Agent Captures

The validation process includes:

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

## Pre-Validation Checklist

Before running validation:

- [ ] **CRC is installed** (`crc version` works)
- [ ] **CRC is configured** (`crc setup` has been run)
- [ ] **Docker is running** (for any container operations)
- [ ] **Enough free disk space** (check with `df -h`)
- [ ] **Close other heavy apps** (browsers, IDEs) to free RAM
- [ ] **Network is stable** (operator images need to download)

Then:
1. Navigate to the project directory
2. Run the validation script
3. Wait for completion (30-40 min)
4. Review the generated validation report

## What If CRC Fails?

The agent is designed to gracefully fall back:

```
If CRC not installed → use kind
If CRC fails to start → use kind
If ACM operator fails → use ACM CRDs only
If network issues → use cached images where possible
```

Validation still works, just with reduced fidelity.

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

**For the Best Validation Results:**

- Run with full ACM operator (shows real behavior)
- Ensure UI screenshots are captured (visual evidence)
- Include both CLI and UI validation

## Estimated Costs

- **CRC (local):** $0 (free, runs on your machine)
- **Cloud OpenShift:** ~$2-5 for a few hours (more realistic environment)
- **AWS kind cluster:** ~$0.50/hour for a small EC2 instance

**Recommendation:** Use CRC (local) - it's free and provides a fully realistic OpenShift environment.
