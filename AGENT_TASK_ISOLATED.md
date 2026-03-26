# Agent Task: Reproduce ACM Bug in Isolated Environment

## Your Mission

You are an autonomous bug reproduction agent with **complete isolation**. Your task is to:

1. Provision a Kubernetes cluster from scratch (in your VM)
2. Install the ACM operator and all components
3. Reproduce the bug from the Jira ticket
4. Capture evidence with full audit trail
5. Generate a validation report
6. Clean up everything (delete the cluster)

**Important:** This is 100% isolated. You have NO external dependencies. Build everything from scratch.

**Note:** Your session will be automatically recorded as video. This video will demonstrate complete autonomous infrastructure provisioning.

---

## Environment

You have access to:
- A Linux VM (Cursor provides this)
- Internet access (to download tools and images)
- Root/sudo access
- Standard Linux tools (curl, wget, etc.)

You will install:
- kind (Kubernetes in Docker)
- kubectl
- OLM (Operator Lifecycle Manager)
- ACM operator
- MultiClusterHub

---

## Step-by-Step Process

### 1. Read the Bug Ticket

Parse `mock-ticket.json` and extract:
- Issue key: ACM-9876
- Component: Placement
- Reproduction steps
- Expected vs actual behavior

The bug: **Placement status remains empty when ManagedClusterSet has no matching clusters**

---

### 2. Install Prerequisites

Install kind and kubectl if not already available:

```bash
# Install kind
echo "Installing kind..."
curl -Lo /tmp/kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x /tmp/kind
sudo mv /tmp/kind /usr/local/bin/kind

# Verify kind
kind version

# Install kubectl
echo "Installing kubectl..."
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/kubectl

# Verify kubectl
kubectl version --client
```

---

### 3. Create kind Cluster

Provision a Kubernetes cluster inside your VM:

```bash
# Create kind cluster
echo "Creating kind cluster..."
kind create cluster --name acm-bug-validation --wait 5m

# Set context
kubectl config use-context kind-acm-bug-validation

# Verify cluster is ready
kubectl cluster-info
kubectl get nodes
kubectl get pods -A

# Wait for all system pods to be ready
kubectl wait --for=condition=ready pod --all -n kube-system --timeout=300s
```

**Expected time:** ~2-3 minutes

---

### 4. Install Operator Lifecycle Manager (OLM)

OLM manages operator installations:

```bash
echo "Installing OLM..."

# Install OLM CRDs
kubectl apply -f https://github.com/operator-framework/operator-lifecycle-manager/releases/download/v0.28.0/crds.yaml

# Install OLM components
kubectl apply -f https://github.com/operator-framework/operator-lifecycle-manager/releases/download/v0.28.0/olm.yaml

# Wait for OLM to be ready
echo "Waiting for OLM to be ready..."
kubectl wait --for=condition=ready pod -l app=olm-operator -n olm --timeout=300s
kubectl wait --for=condition=ready pod -l app=catalog-operator -n olm --timeout=300s

# Verify OLM is running
kubectl get pods -n olm
kubectl get catalogsources -n olm
```

**Expected time:** ~2-3 minutes

---

### 5. Install ACM Operator

Install the Advanced Cluster Management operator via OLM:

```bash
echo "Installing ACM operator..."

# Create namespace for ACM
kubectl create namespace open-cluster-management

# Create OperatorGroup
kubectl apply -f - <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: open-cluster-management
  namespace: open-cluster-management
spec:
  targetNamespaces:
  - open-cluster-management
EOF

# Subscribe to ACM operator from OperatorHub.io
kubectl apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: advanced-cluster-management
  namespace: open-cluster-management
spec:
  channel: release-2.11
  name: advanced-cluster-management
  source: operatorhubio-catalog
  sourceNamespace: olm
  installPlanApproval: Automatic
EOF

# Wait for operator to install (this may take 5-10 minutes)
echo "Waiting for ACM operator pods to start (this may take 5-10 minutes)..."
sleep 30

# Monitor operator installation
kubectl get csv -n open-cluster-management -w --timeout=600s || echo "CSV watch timed out, checking status..."

# Check if operator is ready
kubectl wait --for=condition=ready pod -l name=multiclusterhub-operator -n open-cluster-management --timeout=600s || echo "Operator pods may still be starting..."

# Verify operator is installed
kubectl get pods -n open-cluster-management
kubectl get csv -n open-cluster-management
```

**Expected time:** ~5-10 minutes

**Note:** If the operator installation fails or times out, you may need to troubleshoot. Check `kubectl get events -n open-cluster-management` for errors.

---

### 6. Deploy MultiClusterHub

Create the MultiClusterHub instance to deploy all ACM components:

```bash
echo "Deploying MultiClusterHub..."

# Create MultiClusterHub
kubectl apply -f - <<EOF
apiVersion: operator.open-cluster-management.io/v1
kind: MultiClusterHub
metadata:
  name: multiclusterhub
  namespace: open-cluster-management
spec:
  availabilityConfig: Basic
EOF

# Wait for MultiClusterHub to be ready (this may take 10-15 minutes)
echo "Waiting for MultiClusterHub to deploy (this may take 10-15 minutes)..."

# Monitor the deployment
kubectl get multiclusterhub -n open-cluster-management -w --timeout=1200s || echo "Watch timed out, checking status..."

# Check MultiClusterHub status
kubectl get multiclusterhub -n open-cluster-management -o yaml

# Wait for condition
kubectl wait --for=condition=Complete multiclusterhub/multiclusterhub -n open-cluster-management --timeout=1200s || echo "MultiClusterHub may still be deploying..."

# Verify all ACM components are running
kubectl get pods -n open-cluster-management
kubectl get deployments -n open-cluster-management
```

**Expected time:** ~10-15 minutes

**Success criteria:**
- MultiClusterHub status shows `phase: Running` or `conditions: Complete`
- All pods in `open-cluster-management` namespace are Ready
- Key components running: placement controller, cluster manager, etc.

---

### 7. Reproduce the Bug

Now that ACM is fully installed, follow the exact steps from the ticket:

```bash
echo "Reproducing bug from ticket ACM-9876..."

# Step 1: Create ManagedClusterSet
echo "Step 1: Creating ManagedClusterSet 'test-set'..."
kubectl apply -f - <<EOF
apiVersion: cluster.open-cluster-management.io/v1beta2
kind: ManagedClusterSet
metadata:
  name: test-set
EOF

# Verify it was created
kubectl get managedclusterset test-set

# Step 2: Create Placement with label selector
echo "Step 2: Creating Placement with label selector..."
kubectl create namespace placement-test

kubectl apply -f - <<EOF
apiVersion: cluster.open-cluster-management.io/v1beta1
kind: Placement
metadata:
  name: test-placement
  namespace: placement-test
spec:
  clusterSets:
    - test-set
  predicates:
    - requiredClusterSelector:
        labelSelector:
          matchLabels:
            environment: production
EOF

# Step 3: Verify no matching clusters exist
echo "Step 3: Verifying no clusters match the selector..."
kubectl get managedclusters --show-labels
echo "Expected: No ManagedClusters (or none with label environment=production)"

# Step 4: Wait for placement controller to reconcile
echo "Step 4: Waiting for placement controller to process (30 seconds)..."
sleep 30

# Check Placement status
echo "Checking Placement status..."
kubectl get placement test-placement -n placement-test -o yaml
```

---

### 8. Validate the Bug

Check if the observed behavior matches the ticket:

```bash
# Get the Placement status
PLACEMENT_STATUS=$(kubectl get placement test-placement -n placement-test -o jsonpath='{.status}')

if [ -z "$PLACEMENT_STATUS" ] || [ "$PLACEMENT_STATUS" = "{}" ]; then
    echo "✅ BUG CONFIRMED: Placement status is empty"
    echo "Expected: Status with conditions and numberOfSelectedClusters=0"
    echo "Actual: Status is {}"
else
    echo "❓ Unexpected: Placement has status"
    echo "Status: $PLACEMENT_STATUS"
    echo "This may not be the bug, or it has been fixed"
fi
```

**Expected Result (Bug):**
```yaml
status: {}  # Empty - no conditions, no decisions
```

**What SHOULD happen (if bug were fixed):**
```yaml
status:
  numberOfSelectedClusters: 0
  conditions:
    - type: PlacementSatisfied
      status: "False"
      reason: NoMatchingClusters
```

---

### 9. Capture Evidence

Save all relevant artifacts:

```bash
echo "Capturing evidence..."

# Placement full YAML
kubectl get placement test-placement -n placement-test -o yaml > placement-status.yaml

# ManagedClusterSet
kubectl get managedclusterset test-set -o yaml > managedclusterset.yaml

# List all ManagedClusters (should be empty or none matching)
kubectl get managedclusters -o yaml > managedclusters.yaml

# Events in placement namespace
kubectl get events -n placement-test > placement-events.log

# Placement controller logs (if accessible)
PLACEMENT_POD=$(kubectl get pods -n open-cluster-management -l app=placement -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$PLACEMENT_POD" ]; then
    kubectl logs $PLACEMENT_POD -n open-cluster-management > placement-controller.log
fi

# ACM component status
kubectl get pods -n open-cluster-management > acm-components.txt

echo "Evidence files created:"
ls -lh *.yaml *.log *.txt
```

---

### 10. Generate Validation Report

Create a comprehensive report:

```bash
cat > VALIDATION_REPORT.md <<'EOF'
# Bug Validation Report: ACM-9876

**Date:** $(date +%Y-%m-%d)
**Validator:** Autonomous Bug Reproduction Agent
**Environment:** kind cluster (isolated VM) with ACM operator

## Summary
✅ **Bug CONFIRMED** - Placement status remains empty when ManagedClusterSet has no matching clusters.

## Environment Details

- **Kubernetes:** $(kubectl version --short 2>/dev/null | grep Server || echo "v1.28+")
- **kind:** $(kind version 2>/dev/null)
- **ACM Version:** $(kubectl get multiclusterhub -n open-cluster-management -o jsonpath='{.items[0].status.currentVersion}' 2>/dev/null || echo "2.11+")
- **Test Duration:** Full stack provisioning + bug validation
- **Infrastructure:** Fully isolated - kind cluster in Cursor agent VM

## Reproduction Steps Executed

- [x] Created kind cluster in isolated VM
- [x] Installed OLM
- [x] Installed ACM operator via OLM
- [x] Deployed MultiClusterHub
- [x] Created ManagedClusterSet 'test-set'
- [x] Created Placement targeting 'test-set' with environment=production selector
- [x] Verified no matching clusters exist
- [x] Observed Placement status after controller reconciliation

## Observed Behavior

The Placement resource was created successfully, but after waiting for the placement controller to reconcile, the status field remains:

\`\`\`yaml
status: {}
\`\`\`

**Key Observations:**
- No \`conditions\` array in status
- No \`numberOfSelectedClusters\` field
- No \`decisions\` array
- Resource appears stuck with no feedback

## Expected Behavior (from ticket)

The Placement should populate status with:

\`\`\`yaml
status:
  numberOfSelectedClusters: 0
  conditions:
    - type: PlacementSatisfied
      status: "False"
      reason: NoMatchingClusters
      message: "No ManagedClusters match the placement's cluster selector"
\`\`\`

## Bug Confirmed?

**YES** ✅

The placement controller is not populating status information when zero clusters match the selector. This leaves users without feedback about why their workload isn't being scheduled.

## Evidence Files

| File | Description |
|------|-------------|
| \`placement-status.yaml\` | Full Placement resource showing empty status |
| \`managedclusterset.yaml\` | ManagedClusterSet 'test-set' |
| \`managedclusters.yaml\` | List of ManagedClusters (empty or no matches) |
| \`placement-events.log\` | Kubernetes events from placement-test namespace |
| \`placement-controller.log\` | Logs from placement controller pod (if available) |
| \`acm-components.txt\` | Status of all ACM components |
| \`agent-session.mp4\` | Video recording of complete session (auto-generated) |

## Impact Assessment

**Severity:** Major (as reported)

**User Impact:**
- No feedback when Placements don't select any clusters
- Cannot distinguish configuration errors from legitimate zero-match scenarios
- Silent failures impede debugging
- Applications don't know why workloads aren't deploying

**Affected Workflows:**
- Multi-cluster application deployment
- Policy distribution via Placements
- Cluster selection for GitOps workflows

## Recommendations

### For Developers
1. Investigate placement controller reconciliation logic
2. Ensure status is always populated, even when decisions array is empty
3. Add condition with type=PlacementSatisfied, status=False when no clusters match
4. Add e2e test for "zero matching clusters" scenario

### For QA
- Add regression test to CI/CD
- Test across ACM versions to determine when bug was introduced
- Verify fix doesn't break existing Placement behavior

### For Documentation
- Document expected status structure for all scenarios
- Add troubleshooting guide for "empty Placement status"

## Autonomous Validation Highlights

**What makes this impressive:**
- ✅ Complete infrastructure provisioning from scratch (kind + OLM + ACM)
- ✅ Full ACM operator stack deployed autonomously
- ✅ Real placement controller behavior validated
- ✅ Zero external dependencies
- ✅ Complete isolation in agent VM
- ✅ ~25-30 minute runtime for full stack + validation
- ✅ Automated cleanup (cluster destroyed after validation)

**Manual equivalent:** 3-4 hours (including environment setup, troubleshooting, documentation)

---

**Validation Status:** ✅ COMPLETE
**Automation Runtime:** ~30 minutes (vs ~3-4 hours manual)
**Confidence Level:** HIGH - Real ACM operator behavior in isolated environment

---

*Generated by ACM Bug Reproduction Agent v1.0*
*Powered by Cursor Agent with Computer Use*
*Complete autonomous infrastructure provisioning demonstrated*
EOF

# Display report
cat VALIDATION_REPORT.md
```

---

### 11. Cleanup

**IMPORTANT:** Destroy all infrastructure to leave the VM clean:

```bash
echo "Cleaning up..."

# Delete the kind cluster (this removes everything)
kind delete cluster --name acm-bug-validation

# Verify cluster is deleted
kind get clusters

# Remove downloaded binaries (optional)
# sudo rm /usr/local/bin/kind /usr/local/bin/kubectl

echo "✅ Cleanup complete - VM returned to clean state"
```

---

## Success Criteria

You have successfully completed this task when:

- ✅ kind cluster created in your VM
- ✅ OLM installed and running
- ✅ ACM operator installed via OLM
- ✅ MultiClusterHub deployed and ready
- ✅ Bug reproduction steps executed
- ✅ Placement status validated (empty = bug confirmed)
- ✅ Evidence files generated
- ✅ Validation report written
- ✅ kind cluster deleted (cleanup)
- ✅ Video automatically recorded by Cursor

---

## Troubleshooting

### OLM installation fails
- Check internet connectivity: `curl -I https://github.com`
- Verify kind cluster is healthy: `kubectl get nodes`
- Check events: `kubectl get events -A`

### ACM operator won't install
- Check OLM is ready: `kubectl get pods -n olm`
- Check catalog source: `kubectl get catalogsources -n olm`
- View operator logs: `kubectl logs -n olm -l app=catalog-operator`

### MultiClusterHub stuck
- This can take 15+ minutes - be patient
- Check pod status: `kubectl get pods -n open-cluster-management`
- Check events: `kubectl get events -n open-cluster-management`
- View operator logs: `kubectl logs -n open-cluster-management -l control-plane=multiclusterhub-operator`

### Placement status not empty (bug not reproduced)
- Verify ACM version - bug may be fixed in newer versions
- Check placement controller logs for errors
- Document in report: "Bug could not be reproduced - may be fixed"

---

## Notes

- **Be patient:** Full ACM deployment takes 20-30 minutes
- **Be autonomous:** Don't wait for human input - make decisions
- **Be thorough:** Capture all logs and evidence
- **Be clean:** Always delete the cluster when done

This is a complete infrastructure-as-code demonstration. You're building and destroying a full OpenShift-alternative stack autonomously!

Good luck! 🤖🚀
