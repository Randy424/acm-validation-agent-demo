#!/bin/bash
# Setup script for using a remote OpenShift cluster with the agent demo

set -e

echo "🔧 Remote Cluster Setup for ACM Agent Demo"
echo "==========================================="
echo

# Check if oc is installed
if ! command -v oc &> /dev/null; then
    echo "❌ Error: oc CLI not found"
    echo "   Install with: brew install openshift-cli"
    exit 1
fi

# Check if currently logged into a cluster
if ! oc whoami &> /dev/null; then
    echo "❌ Error: Not logged into an OpenShift cluster"
    echo "   Login with: oc login <cluster-url>"
    exit 1
fi

echo "✅ Connected to cluster: $(oc whoami --show-server)"
echo "   User: $(oc whoami)"
echo

# Check if ACM is installed
if ! oc get multiclusterhub -n open-cluster-management &> /dev/null; then
    echo "❌ Error: ACM not found on this cluster"
    echo "   This demo requires ACM to be pre-installed"
    exit 1
fi

ACM_VERSION=$(oc get multiclusterhub -n open-cluster-management -o jsonpath='{.items[0].status.currentVersion}' 2>/dev/null || echo "unknown")
echo "✅ ACM installed: version ${ACM_VERSION}"
echo

# Get ACM console URL
ACM_CONSOLE=$(oc get route multicloud-console -n open-cluster-management -o jsonpath='{.spec.host}' 2>/dev/null || echo "not found")
echo "✅ ACM Console: https://${ACM_CONSOLE}"
echo

# Check permissions
echo "🔍 Checking permissions..."
CAN_CREATE_SETS=$(oc auth can-i create managedclustersets.cluster.open-cluster-management.io 2>/dev/null && echo "yes" || echo "no")
CAN_CREATE_PLACEMENTS=$(oc auth can-i create placements.cluster.open-cluster-management.io --all-namespaces 2>/dev/null && echo "yes" || echo "no")

if [ "$CAN_CREATE_SETS" = "yes" ] && [ "$CAN_CREATE_PLACEMENTS" = "yes" ]; then
    echo "✅ Permissions: Can create ManagedClusterSets and Placements"
else
    echo "⚠️  Warning: Limited permissions detected"
    echo "   Can create ManagedClusterSets: ${CAN_CREATE_SETS}"
    echo "   Can create Placements: ${CAN_CREATE_PLACEMENTS}"
    echo "   You may need cluster-admin or specific RBAC permissions"
fi
echo

# Export kubeconfig
KUBECONFIG_FILE="./cluster-kubeconfig.yaml"
echo "📄 Exporting kubeconfig to ${KUBECONFIG_FILE}..."
oc config view --flatten > "${KUBECONFIG_FILE}"
echo "✅ Kubeconfig exported"
echo

# Create CLUSTER_INFO.md
echo "📝 Creating CLUSTER_INFO.md..."
cat > CLUSTER_INFO.md <<EOF
# Remote Cluster Information

**Generated:** $(date)
**Cluster API:** $(oc whoami --show-server)
**User:** $(oc whoami)
**Kubeconfig:** ${KUBECONFIG_FILE}
**ACM Version:** ${ACM_VERSION}
**ACM Console:** https://${ACM_CONSOLE}
**ACM Namespace:** open-cluster-management

## Permissions

- Can create ManagedClusterSets: ${CAN_CREATE_SETS}
- Can create Placements: ${CAN_CREATE_PLACEMENTS}

## Agent Instructions

This cluster has ACM pre-installed. The agent should:

1. Use the kubeconfig file at \`./${KUBECONFIG_FILE}\`
2. Skip ACM installation (already installed)
3. Create test resources in namespace \`bug-validation-test\`
4. Reproduce the bug from \`mock-ticket.json\`
5. Access ACM UI at https://${ACM_CONSOLE}
6. **IMPORTANT:** Clean up all test resources when done
7. Do NOT modify existing production resources

## Cleanup Required

After validation, the agent MUST delete:
- Namespace: \`bug-validation-test\`
- ManagedClusterSet: \`test-set\`
- Placement: \`test-placement\`
EOF

echo "✅ CLUSTER_INFO.md created"
echo

# Add to .gitignore
if ! grep -q "cluster-kubeconfig.yaml" .gitignore 2>/dev/null; then
    echo "cluster-kubeconfig.yaml" >> .gitignore
    echo "CLUSTER_INFO.md" >> .gitignore
    echo "✅ Added to .gitignore"
fi

# Summary
echo
echo "=========================================="
echo "✨ Setup Complete!"
echo "=========================================="
echo
echo "Next steps:"
echo "1. Open Cursor in this directory: cursor ."
echo "2. Start Cursor Agent"
echo "3. Give the agent this task:"
echo
echo "   \"Read AGENT_TASK.md and use the REMOTE cluster approach."
echo "   Use ./cluster-kubeconfig.yaml to connect."
echo "   Read CLUSTER_INFO.md for cluster details."
echo "   Reproduce the bug from mock-ticket.json."
echo "   Work autonomously and clean up when done.\""
echo
echo "Expected runtime: ~10-12 minutes"
echo

# Test connection
echo "🧪 Testing connection with exported kubeconfig..."
export KUBECONFIG="${KUBECONFIG_FILE}"
if oc get nodes &> /dev/null; then
    echo "✅ Connection test passed!"
else
    echo "❌ Connection test failed"
    echo "   The agent may have trouble connecting"
fi

echo
echo "Demo ready! 🚀"
