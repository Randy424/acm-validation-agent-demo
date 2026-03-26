# Using Your Remote OpenShift Cluster

## Why This Is Better

Instead of installing CRC locally or provisioning cloud infrastructure, use your **existing OpenShift cluster with ACM already installed**:

✅ **Instant start** - No cluster provisioning wait time
✅ **Real production environment** - Your actual ACM setup
✅ **Faster demo** - 5-10 minutes instead of 40 minutes
✅ **Real ACM UI** - Production console, not local test instance
✅ **No resource constraints** - Uses remote cluster, not your laptop

## Prerequisites

You need access to:
- ✅ OpenShift cluster with ACM already installed
- ✅ Kubeconfig file or credentials to authenticate
- ✅ Permissions to create ManagedClusterSets and Placements
- ✅ (Optional) ACM console URL for UI validation

## Setup Steps

### 1. Get Your Kubeconfig

```bash
# If you have oc CLI configured:
oc config view --flatten > ~/acm-cluster-kubeconfig.yaml

# Or download from OpenShift console:
# Console → Username → Copy Login Command → Display Token → Copy kubeconfig
```

### 2. Place Kubeconfig in Demo Directory

```bash
cd ~/Repositories/acm-validation-agent-demo
cp ~/acm-cluster-kubeconfig.yaml ./cluster-kubeconfig.yaml

# Make sure it works
export KUBECONFIG=./cluster-kubeconfig.yaml
oc get nodes
oc get multiclusterhub -A
```

### 3. Get ACM Console URL

```bash
# Get the ACM console route
oc get route multicloud-console -n open-cluster-management -o jsonpath='{.spec.host}'

# Example output: multicloud-console-open-cluster-management.apps.your-cluster.com
```

Save this URL - the agent will use it for UI validation.

## Updated Agent Instructions

Create a file called `CLUSTER_INFO.md` in your demo directory:

```markdown
# Remote Cluster Information

**Cluster API:** https://api.your-cluster.com:6443
**Kubeconfig:** ./cluster-kubeconfig.yaml
**ACM Console:** https://multicloud-console-open-cluster-management.apps.your-cluster.com
**ACM Namespace:** open-cluster-management
**ACM Version:** 2.16.0 (or whatever you have)

## Agent Instructions

Use the provided kubeconfig to connect to this remote cluster.
ACM is already installed - do not attempt to install operators.
Create test resources in a new namespace to avoid conflicts.
Clean up all test resources when done.
```

## Agent Task (Updated for Remote Cluster)

When starting the agent, you'll say:

```
Read AGENT_TASK.md but use the REMOTE cluster approach:

1. Read mock-ticket.json for the bug description
2. Use the kubeconfig in ./cluster-kubeconfig.yaml to connect
3. Verify ACM is installed and ready
4. Create test resources (ManagedClusterSet, Placement)
5. Reproduce the bug on this production cluster
6. Capture evidence (CLI + ACM UI)
7. Clean up test resources
8. Generate validation report

Work autonomously.
```

## Expected Timeline (Remote Cluster)

```
00:00 - Read mock-ticket.json
00:01 - Load kubeconfig and connect to remote cluster
00:02 - Verify ACM installation
00:03 - Create namespace "bug-validation-test"
00:04 - Create ManagedClusterSet "test-set"
00:05 - Create Placement "test-placement"
00:06 - Observe Placement status (bug reproduction)
00:07 - Access ACM console UI
00:08 - Capture UI screenshot showing bug
00:09 - Export YAML evidence
00:10 - Generate validation report
00:11 - Clean up test resources
00:12 - DONE ✅
```

**Total: ~12 minutes** (vs 40 min with CRC!)

## Safety Considerations

### Namespace Isolation

The agent will create resources in a dedicated namespace:

```bash
# Agent creates:
kubectl create namespace bug-validation-test

# All test resources go here:
# - Placements in this namespace
# - Clean separation from production workloads
```

### Cleanup

The agent should clean up after itself:

```bash
# At the end of validation:
kubectl delete namespace bug-validation-test
kubectl delete managedclusterset test-set

# Leaves your cluster in the same state as before
```

### Read-Only Alternative

If you're concerned about creating resources, you could:
- Use a pre-existing bug scenario on your cluster
- Agent just reads and documents (doesn't create)
- Still validates the behavior, just doesn't reproduce from scratch

## Security Notes

**Kubeconfig Protection:**

```bash
# Add to .gitignore
echo "cluster-kubeconfig.yaml" >> .gitignore
echo "CLUSTER_INFO.md" >> .gitignore

# Never commit credentials to git!
```

**Limited Permissions:**

If possible, create a service account with limited permissions:
- Can create ManagedClusterSets
- Can create Placements
- Can read ACM resources
- Cannot modify existing production resources

## Demo Advantages

**Using your remote cluster makes the demo MORE impressive:**

1. **"This is our actual production ACM"** - not a toy environment
2. **Real operator behavior** - not simulated or mocked
3. **Production UI** - the actual console your team uses
4. **Faster** - no waiting for infrastructure
5. **Credible** - audience sees this works on real infrastructure

## Troubleshooting

### "Cannot connect to cluster"

```bash
# Test manually first:
export KUBECONFIG=./cluster-kubeconfig.yaml
oc whoami
oc get nodes
```

### "Forbidden: User cannot create ManagedClusterSets"

You need cluster-admin or specific RBAC permissions:

```bash
# Check your permissions:
oc auth can-i create managedclustersets.cluster.open-cluster-management.io
oc auth can-i create placements.cluster.open-cluster-management.io -n bug-validation-test
```

If you don't have permissions, ask your cluster admin or use CRC locally.

### "ACM console not accessible"

```bash
# Get the correct URL:
oc get route multicloud-console -n open-cluster-management

# Check if it requires VPN or specific network access
```

## Quick Test Before Agent Run

Verify everything works manually:

```bash
# 1. Connect
export KUBECONFIG=./cluster-kubeconfig.yaml
oc get nodes

# 2. Check ACM
oc get multiclusterhub -n open-cluster-management

# 3. Test permissions
oc create namespace test-permissions
oc delete namespace test-permissions

# 4. Access UI
echo "ACM Console: https://$(oc get route multicloud-console -n open-cluster-management -o jsonpath='{.spec.host}')"
# Open in browser, verify you can login
```

If all of the above works, the agent can use your cluster!

---

## Updated Demo Flow

**Your 3-minute demo becomes:**

```
00:00-00:30 | Show mock-ticket.json
            "Here's a Placement bug reported by our team..."

00:30-02:30 | Play agent's video (sped up slightly)
            "Watch the agent autonomously validate this on our
             PRODUCTION ACM cluster..."
            - Agent connects to remote cluster
            - Creates test resources
            - Validates bug exists
            - Captures CLI + UI evidence
            - Cleans up

02:30-03:00 | Show validation report
            "Bug confirmed in production. Took 12 minutes autonomous.
             Would've taken me 3 hours manual."
```

**The "production cluster" angle makes it even more impressive!**

---

**Ready to use your remote cluster?** Just need:
1. Kubeconfig file
2. ACM console URL
3. Confirmation you have permissions to create resources

Then update AGENT_TASK.md to use the remote approach instead of CRC/kind.
