# True Isolation: kind + ACM CRDs in Cursor VM

## The Cursor Blog Model

This approach matches the Cursor blog examples - **everything runs in the agent's isolated VM**.

```
┌─────────────────────────────────────────┐
│ Cursor Agent VM (Isolated Sandbox)     │
│                                         │
│  ┌────────────────────────────────┐    │
│  │ kind cluster                   │    │
│  │  ↓                             │    │
│  │ ACM CRDs installed             │    │
│  │  ↓                             │    │
│  │ Test resources created         │    │
│  │  ↓                             │    │
│  │ Bug validated                  │    │
│  │  ↓                             │    │
│  │ Evidence captured              │    │
│  └────────────────────────────────┘    │
│                                         │
│  Video recording: agent-session.mp4    │
└─────────────────────────────────────────┘
```

**After demo: VM destroyed, zero artifacts left on host**

## Benefits of This Approach

✅ **True isolation** - Everything in Cursor's VM
✅ **Repeatable** - Provisions from scratch every time
✅ **No external dependencies** - No cluster credentials needed
✅ **Parallel execution** - Multiple agents, multiple VMs
✅ **Fast** - kind creates cluster in ~2 minutes
✅ **Safe** - Can't affect production resources
✅ **Impressive** - "Watch the agent build everything autonomously"

## What We CAN Test (Without Full ACM Operator)

### Category 1: CRD Validation Bugs

These test Kubernetes API validation, not controller logic:

**Example 1: Cross-Namespace Reference Bug**
```yaml
Bug: "ManagedClusterSetBinding accepts invalid namespace references"

Steps:
1. Create ManagedClusterSet "prod-set" (cluster-scoped)
2. Create namespace "test-ns"
3. Create ManagedClusterSetBinding in "test-ns" referencing non-existent set
4. Observe: Accepted (BUG - should validate reference)

Evidence: kubectl get managedclustersetbinding shows invalid resource
```

**Example 2: Label Selector Parsing**
```yaml
Bug: "Placement accepts invalid label selector syntax"

Steps:
1. Create Placement with malformed label selector: "environment=prod;tier=*"
2. Observe: Accepted (BUG - should reject invalid syntax)

Evidence: kubectl get placement shows invalid selector stored
```

**Example 3: Schema Validation**
```yaml
Bug: "ManagedCluster allows negative resource values"

Steps:
1. Create ManagedCluster with capacity.cpu: -100
2. Observe: Accepted (BUG - should reject negative values)

Evidence: kubectl get managedcluster shows negative value
```

### Category 2: With Minimal Controller

If we install just the Placement controller (lightweight):

**Example: Status Population Bug**
```yaml
Bug: "Placement status empty when ManagedClusterSet has no clusters"

Steps:
1. Install Placement controller
2. Create empty ManagedClusterSet
3. Create Placement referencing it
4. Wait for controller reconciliation
5. Observe: Status remains {} (BUG)

Evidence: kubectl get placement -o yaml shows empty status field
```

## Implementation: Pure CRD Approach

### Updated mock-ticket.json

```json
{
  "key": "ACM-8888",
  "fields": {
    "summary": "ManagedClusterSetBinding accepts references to non-existent ClusterSets",
    "description": "When creating a ManagedClusterSetBinding, the API does not validate that the referenced ManagedClusterSet exists. This allows orphaned bindings that will never function.\n\n*Steps to Reproduce:*\n# Create namespace 'test-binding'\n# Create ManagedClusterSetBinding referencing 'ghost-set' (which doesn't exist)\n# Observe binding is accepted without validation\n# Query for 'ghost-set' and confirm it doesn't exist\n\n*Expected Result:*\nAPI should reject the ManagedClusterSetBinding with validation error: 'ManagedClusterSet ghost-set not found'\n\n*Actual Result:*\nManagedClusterSetBinding is created successfully, leaving an orphaned resource\n\n*Environment:*\n- ACM Version: 2.16.0\n- Kubernetes: 1.28+",
    "issuetype": {"name": "Bug"},
    "status": {"name": "New"},
    "priority": {"name": "Major"}
  }
}
```

### Updated AGENT_TASK.md (Isolated Section)

```markdown
### 2. Provision Isolated Test Environment

Create a complete test environment inside the Cursor VM:

```bash
# Install kind (if not present)
if ! command -v kind &> /dev/null; then
    echo "Installing kind..."
    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
    chmod +x ./kind
    sudo mv ./kind /usr/local/bin/kind
fi

# Create kind cluster
kind create cluster --name acm-bug-validation --wait 5m

# Verify cluster
kubectl cluster-info --context kind-acm-bug-validation
kubectl get nodes
```

### 3. Install ACM CRDs

Install only the CRDs (no operator, no controllers):

```bash
# Install ManagedClusterSet CRD
kubectl apply -f https://raw.githubusercontent.com/open-cluster-management-io/api/main/cluster/v1beta2/0000_00_clusters.open-cluster-management.io_managedclustersets.crd.yaml

# Install ManagedClusterSetBinding CRD
kubectl apply -f https://raw.githubusercontent.com/open-cluster-management-io/api/main/cluster/v1beta2/0000_01_clusters.open-cluster-management.io_managedclustersetbindings.crd.yaml

# Verify CRDs installed
kubectl get crd | grep open-cluster-management
```

### 4. Reproduce the Bug

Follow the exact steps from mock-ticket.json:

```bash
# Step 1: Create namespace
kubectl create namespace test-binding

# Step 2: Create ManagedClusterSetBinding referencing non-existent set
kubectl apply -f - <<EOF
apiVersion: cluster.open-cluster-management.io/v1beta2
kind: ManagedClusterSetBinding
metadata:
  name: ghost-binding
  namespace: test-binding
spec:
  clusterSet: ghost-set
EOF

# Step 3: Verify binding was accepted (BUG!)
kubectl get managedclustersetbinding ghost-binding -n test-binding

# Step 4: Confirm the referenced set doesn't exist
kubectl get managedclusterset ghost-set
# Expected output: Error: "ghost-set" not found

# Step 5: Document that binding exists with invalid reference
kubectl get managedclustersetbinding ghost-binding -n test-binding -o yaml
```

### 5. Validate the Bug

Check if behavior matches the ticket:
- Was ManagedClusterSetBinding accepted? YES (bug confirmed)
- Does the referenced ManagedClusterSet exist? NO
- Should API have rejected this? YES (validation missing)

This proves the bug: **API accepts orphaned resource references**
```

## Timeline: Isolated VM Approach

```
00:00 - Read mock-ticket.json
00:01 - Check if kind is installed
00:02 - Install kind if needed
00:03 - Create kind cluster
00:05 - Verify cluster ready
00:06 - Install ACM CRDs
00:07 - Create test namespace
00:08 - Create ManagedClusterSetBinding (invalid reference)
00:09 - Verify binding accepted (BUG REPRODUCED)
00:10 - Verify referenced set doesn't exist (PROOF)
00:11 - Capture YAML evidence
00:12 - Generate validation report
00:13 - Cleanup: Delete kind cluster
00:14 - DONE ✅
```

**Total: ~14 minutes** (all in isolated VM)

## Advantages Over Remote Cluster

| Aspect | Remote Cluster | Isolated kind+CRDs |
|--------|---------------|-------------------|
| **Setup** | Need cluster credentials | Nothing needed |
| **Speed** | 10-12 min | 14 min |
| **Isolation** | ❌ External | ✅ Complete |
| **Repeatability** | Depends on cluster state | ✅ Always from scratch |
| **Safety** | Could affect prod | ✅ Sandboxed |
| **Parallelization** | Limited by cluster | ✅ Unlimited VMs |
| **Cleanup** | Manual | ✅ Destroy VM |
| **Matches Cursor blog** | ❌ External dep | ✅ True isolation |

## Types of Bugs We Can Validate

✅ **CRD schema violations**
✅ **API validation gaps**
✅ **Resource reference issues**
✅ **Label/selector parsing**
✅ **Admission webhook failures** (if we add webhooks)
✅ **RBAC issues** (create/get/delete permissions)

❌ **Controller logic bugs** (need operator running)
❌ **Operator reconciliation** (need full MultiClusterHub)
❌ **UI bugs** (no console without operator)

## Best Bug Scenarios for This Approach

1. **API validation gaps** (references, schemas, formats)
2. **YAML structure issues** (parsing, validation)
3. **CRD schema bugs** (type constraints, required fields)
4. **Resource creation rules** (uniqueness, conflicts)
5. **Label selector syntax** (invalid patterns accepted)

## Demo Narrative

> "Here's what makes this compelling: The agent starts with NOTHING.
>
> Watch as it autonomously:
> - Provisions a Kubernetes cluster from scratch
> - Installs ACM components
> - Creates the exact scenario from the bug ticket
> - Validates the issue exists
> - Captures proof
> - Destroys everything when done
>
> Complete isolation. Complete autonomy.
> No human intervention. No external dependencies.
>
> This is what the Cursor agents were built for."

## Next Steps

1. **Pick a validation bug** from the examples above
2. **Update mock-ticket.json** with that bug scenario
3. **Update AGENT_TASK.md** to use kind + CRDs approach
4. **Test with Cursor agent** - should complete in ~14 minutes
5. **Record demo** - agent's video shows full provisioning

---

**This approach gives you the TRUE Cursor agent experience** - autonomous provisioning in complete isolation!
