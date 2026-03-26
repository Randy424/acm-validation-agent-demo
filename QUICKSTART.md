# Quick Start Guide - Remote Cluster

**This is the FASTEST path for your hackathon demo!**

## Prerequisites

✅ Access to an OpenShift cluster with ACM installed
✅ `oc` CLI installed
✅ Permissions to create resources

## 5-Minute Setup

```bash
cd ~/Repositories/acm-validation-agent-demo

# 1. Login to your cluster
oc login https://api.your-cluster.com:6443

# 2. Run automated setup
./setup-remote-cluster.sh

# 3. Open in Cursor
cursor .
```

## Start the Agent

In Cursor:
1. **Cmd+Shift+P** → "Cursor: Start Agent"
2. Paste this task:

```
Read AGENT_TASK.md and use the REMOTE cluster approach.
Use ./cluster-kubeconfig.yaml to connect to the cluster.
Read CLUSTER_INFO.md for cluster details.
Reproduce the bug from mock-ticket.json.
Work autonomously and clean up all test resources when done.
```

3. **Press Enter** and watch it work!

## What the Agent Will Do

```
⏱️ ~10-12 minutes total:

00:00 - Read mock-ticket.json
00:01 - Connect to remote cluster with kubeconfig
00:02 - Verify ACM is installed
00:03 - Create namespace "bug-validation-test"
00:04 - Create ManagedClusterSet "test-set"
00:05 - Create Placement "test-placement"
00:06 - Verify Placement status (bug reproduction)
00:07 - Access ACM console UI
00:08 - Take screenshot of bug in UI
00:09 - Export YAML evidence
00:10 - Generate VALIDATION_REPORT.md
00:11 - Clean up all test resources
00:12 - DONE ✅
```

## Agent Output

After completion, you'll have:

```
✅ VALIDATION_REPORT.md       - Detailed bug validation report
✅ placement-status.yaml      - Evidence of empty status
✅ managedclustersets.yaml    - Test resources created
✅ events.log                 - Kubernetes events
✅ acm-ui-placement-bug.png   - UI screenshot showing bug
✅ agent-session.mp4          - Video of entire session
```

## For Your Demo

1. **Speed up the video** to 3 minutes:
   ```bash
   # Using ffmpeg
   ffmpeg -i agent-session.mp4 -filter:v "setpts=0.25*PTS" demo-video.mp4
   ```

2. **Add voice-over** explaining what's happening

3. **Show the validation report** as the finale

## Troubleshooting

**"./setup-remote-cluster.sh: Permission denied"**
```bash
chmod +x setup-remote-cluster.sh
./setup-remote-cluster.sh
```

**"Not logged into OpenShift"**
```bash
oc login https://api.your-cluster.com:6443
# Then re-run setup-remote-cluster.sh
```

**"ACM not found"**
- Your cluster needs ACM pre-installed
- Check with: `oc get multiclusterhub -A`
- If not installed, use CRC or kind instead (see README.md)

**"Forbidden: cannot create managedclustersets"**
- You need cluster-admin or specific RBAC permissions
- Ask your cluster admin or use a different cluster

## Why This Is Best for Hackathon

✅ **Fastest** - 10 min vs 40 min with CRC
✅ **Most realistic** - Real production environment
✅ **Most impressive** - "This runs on OUR infrastructure"
✅ **Best video** - Real ACM UI, real behavior
✅ **Safest** - Agent cleans up after itself

---

**Ready?** Run `./setup-remote-cluster.sh` and you're 5 minutes from testing!
