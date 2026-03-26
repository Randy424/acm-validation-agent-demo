# Agent Task: Reproduce ACM Bug from Jira Ticket

## Your Mission

You are an autonomous bug reproduction agent. Your task is to:

1. Read the bug report from `mock-ticket.json`
2. Set up a test environment
3. Reproduce the bug exactly as described
4. Capture evidence (logs, screenshots, YAML outputs)
5. Generate a validation report

**Note:** Your session will be automatically recorded as video. This video artifact will serve as proof of autonomous reproduction and can be shared with engineers for review.

## Environment Setup

You have access to:
- A Linux VM with Docker installed
- `kind` for local Kubernetes clusters
- `kubectl` for cluster management
- Standard Linux tools

## Step-by-Step Process

### 1. Read the Bug Ticket
- Parse `mock-ticket.json`
- Extract: issue key, description, reproduction steps, expected vs actual behavior
- Identify the ACM components involved (Placement, ManagedClusterSet)

### 2. Connect to OpenShift + ACM Environment

**Option 1: Use Existing Remote Cluster (RECOMMENDED ⭐)**

If a kubeconfig file exists at `./cluster-kubeconfig.yaml`, use the existing remote cluster:

```bash
# Check if remote cluster config exists
if [ -f "./cluster-kubeconfig.yaml" ]; then
    echo "Found remote cluster kubeconfig - using existing OpenShift cluster"
    export KUBECONFIG=./cluster-kubeconfig.yaml

    # Verify connection
    oc whoami
    oc cluster-info

    # Verify ACM is installed
    oc get multiclusterhub -n open-cluster-management

    # Get ACM console URL
    echo "ACM Console: https://$(oc get route multicloud-console -n open-cluster-management -o jsonpath='{.spec.host}')"

    # Skip to step 4 (ACM is already installed)
else
    echo "No remote cluster config found - will provision local environment"
fi
```

**Benefits of remote cluster:**
- ✅ ACM already installed (saves 15-20 minutes)
- ✅ Production environment (more realistic)
- ✅ Real ACM UI accessible
- ✅ Faster total runtime (~10 min vs ~40 min)

**Option 2: Use OpenShift Local (CodeReady Containers)**

If no remote cluster is available, use CRC for local OpenShift + ACM:

```bash
# Check if CRC is installed
if ! command -v crc &> /dev/null; then
    echo "CRC not found. Install from: https://developers.redhat.com/products/openshift-local/overview"
    echo "For this demo, proceeding with kind fallback..."
fi

# Start CRC (takes ~10-15 minutes on first run)
crc start

# Wait for CRC to be ready
crc status

# Configure environment
eval $(crc oc-env)

# Login as admin
oc login -u YOUR-USERNAME -p $(crc console --credentials | grep -oP '(?<=password: ).*')

# Verify cluster is ready
oc get nodes
oc get co  # Check cluster operators
```

**Alternative: kind (Faster but no UI)**

If CRC is not available, use kind:
```bash
kind create cluster --name acm-bug-test
kubectl config use-context kind-acm-bug-test
kubectl get nodes
```

### 3. Install ACM (Skip if using remote cluster)

**If using remote cluster with ACM already installed:** Skip to Step 4.

#### If using OpenShift Local (CRC):

Install ACM operator from OperatorHub:

```bash
# Create namespace
oc create namespace open-cluster-management

# Create OperatorGroup
oc apply -f - <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: open-cluster-management
  namespace: open-cluster-management
spec:
  targetNamespaces:
  - open-cluster-management
EOF

# Subscribe to ACM operator
oc apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: advanced-cluster-management
  namespace: open-cluster-management
spec:
  channel: release-2.16
  installPlanApproval: Automatic
  name: advanced-cluster-management
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF

# Wait for operator pods (5-10 minutes)
echo "Waiting for ACM operator to install..."
oc wait --for=condition=ready pod -l name=multicluster-operators-subscription \
  -n open-cluster-management --timeout=600s || echo "Operator pods may still be starting..."

# Create MultiClusterHub to deploy ACM
oc apply -f - <<EOF
apiVersion: operator.open-cluster-management.io/v1
kind: MultiClusterHub
metadata:
  name: multiclusterhub
  namespace: open-cluster-management
spec: {}
EOF

# Wait for ACM components (10-15 minutes)
echo "Waiting for ACM to be ready (this may take 10-15 minutes)..."
oc wait --for=condition=Complete multiclusterhub/multiclusterhub \
  -n open-cluster-management --timeout=1200s

# Get ACM console URL
echo "ACM Console URL:"
oc get route multicloud-console -n open-cluster-management \
  -o jsonpath='{.spec.host}' && echo

# Verify installation
oc get pods -n open-cluster-management
```

#### If using kind (Fallback):

Install ACM CRDs directly:

If the full operator install doesn't work on kind, create simplified CRDs:

**ManagedClusterSet CRD (simplified):**
```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: managedclustersets.cluster.open-cluster-management.io
spec:
  group: cluster.open-cluster-management.io
  names:
    kind: ManagedClusterSet
    plural: managedclustersets
  scope: Cluster
  versions:
  - name: v1beta2
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
```

**Placement CRD (simplified):**
```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: placements.cluster.open-cluster-management.io
spec:
  group: cluster.open-cluster-management.io
  names:
    kind: Placement
    plural: placements
  scope: Namespaced
  versions:
  - name: v1beta1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              clusterSets:
                type: array
                items:
                  type: string
              predicates:
                type: array
          status:
            type: object
```

### 4. Reproduce the Bug

Follow the exact steps from the ticket:

```bash
# Step 1: Create ManagedClusterSet
kubectl apply -f - <<EOF
apiVersion: cluster.open-cluster-management.io/v1beta2
kind: ManagedClusterSet
metadata:
  name: test-set
EOF

# Step 2: Create Placement with label selector
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
# (In our simulation, there are no ManagedClusters at all)

# Step 4: Check Placement status
kubectl get placement test-placement -n placement-test -o yaml
```

### 5. Validate the Bug

Check if the observed behavior matches the ticket's "Actual Result":
- Does the Placement status remain empty?
- Are there no conditions set?
- Is it stuck in a pending/waiting state?

Document your findings.

#### Verify in ACM UI (Recommended)

Access the ACM console and check the Placement status visually:

```bash
# Get ACM console URL
echo "ACM Console: https://$(oc get route multicloud-console -n open-cluster-management -o jsonpath='{.spec.host}')"

# For remote cluster: Use your existing credentials
# For CRC: Get credentials with:
# echo "Password: $(crc console --credentials | grep -oP '(?<=password: ).*')"
```

In the ACM UI:
1. Navigate to Applications → Placements (or use search)
2. Find "test-placement" in namespace "placement-test"
3. Observe the status - it should show no decisions and no conditions
4. Take a screenshot showing the empty/stuck status

This visual evidence from the UI reinforces the bug report and is compelling for the demo.

### 6. Capture Evidence

Save the following to files:
```bash
# Placement full YAML
kubectl get placement test-placement -n placement-test -o yaml > placement-status.yaml

# Cluster resources
kubectl get managedclustersets -o yaml > managedclustersets.yaml

# Events (if any)
kubectl get events -n placement-test > events.log

# If using OpenShift: Capture ACM console screenshot
# Take a screenshot of the ACM UI showing the Placement with empty status
# Save as: acm-ui-placement-bug.png
```

**Video Recording:** Cursor will automatically record your entire session as a video artifact. This video will show:
- Terminal commands being executed
- kubectl/oc outputs
- ACM UI navigation (if using OpenShift)
- The complete reproduction workflow
- Any debugging steps you take

This video serves as visual proof of the autonomous reproduction and can be shared with engineers.

### 7. Generate Validation Report

Create `VALIDATION_REPORT.md` with:

```markdown
# Bug Validation Report: ACM-9876

**Date:** [current date]
**Validator:** Autonomous Bug Reproduction Agent
**Environment:** kind cluster (local)

## Summary
[One sentence: was the bug reproduced successfully?]

## Reproduction Steps Executed
- [x] Created ManagedClusterSet 'test-set'
- [x] Created Placement targeting 'test-set' with environment=production selector
- [x] Verified no matching clusters exist
- [x] Observed Placement status

## Observed Behavior
[What actually happened]

## Expected Behavior (from ticket)
[What should have happened]

## Bug Confirmed?
**[YES/NO]**

## Evidence Files
- `placement-status.yaml` - Full Placement resource with status
- `managedclustersets.yaml` - ManagedClusterSet resources
- `events.log` - Kubernetes events

## Recommendations
[Suggestions for next steps - e.g., "Confirmed bug, ready for developer investigation"]

## Environment Details
- Kubernetes: [version]
- kind: [version]
- Test duration: [X minutes]
```

### 8. Cleanup

**IMPORTANT:** Clean up test resources to leave the environment as you found it.

#### If using remote cluster:
```bash
# Delete test resources (REQUIRED for remote clusters)
oc delete placement test-placement -n placement-test
oc delete namespace placement-test
oc delete managedclusterset test-set

# Verify cleanup
oc get managedclusterset test-set 2>&1 | grep "NotFound"
```

#### If using CRC:
```bash
# Option 1: Just delete test resources (keep CRC running)
oc delete placement test-placement -n placement-test
oc delete namespace placement-test
oc delete managedclusterset test-set

# Option 2: Stop CRC entirely (optional)
crc stop
```

#### If using kind:
```bash
# Delete the entire test cluster
kind delete cluster --name acm-bug-test
```

## Success Criteria

You have successfully completed this task when:
- ✅ Bug ticket has been read and parsed
- ✅ Test environment is provisioned
- ✅ All reproduction steps have been executed
- ✅ Bug behavior has been validated (confirmed or denied)
- ✅ Evidence files are generated
- ✅ Validation report is written

## Notes

- Be autonomous: Don't ask for human input, make reasonable decisions
- Be thorough: Capture all relevant logs and outputs
- Be clear: The validation report should be readable by engineers who weren't present
- If you encounter issues with the full ACM stack, use simplified CRDs as shown above
- Focus on reproducing the BEHAVIOR described, not necessarily with full production setup

Good luck! 🤖
