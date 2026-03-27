# ACM Navigation Guidelines

## OpenShift Console Perspectives

The OpenShift Console has multiple **perspectives** that change the available navigation menu and features.

### Perspective Switcher Location
- **Location:** Top left of the screen
- **Current perspective displayed:** Shows text like "Administrator", "Fleet Management", or "Fleet Virtualization"
- **Click to switch:** Opens dropdown menu with available perspectives

### Perspectives Available

| Perspective | Purpose | When to Use |
|-------------|---------|-------------|
| **Administrator** | Standard OpenShift admin view | OCP-native resources, compute, storage, networking |
| **Fleet Management** | ACM/MCE console | Clusters, applications, governance, infrastructure management |
| **Fleet Virtualization** | OpenShift Virtualization | Virtual machines, templates |

### Critical Rule: Switch to Fleet Management First

**⚠️ IMPORTANT:** Before navigating to any ACM-specific page, you MUST switch to the Fleet Management perspective.

**ACM pages require Fleet Management perspective:**
- `/multicloud/infrastructure/clusters`
- `/multicloud/infrastructure/automations`
- `/multicloud/applications`
- `/multicloud/governance`
- Cluster pools, cluster sets, managed clusters, etc.

**Navigation sequence:**
```
1. Login to OpenShift Console
2. Click perspective switcher (top left)
3. Select "Fleet Management"
4. Wait for perspective to load
5. Navigate to ACM page
```

### AI Navigation Example (Stagehand)

```javascript
// After login, switch to Fleet Management
console.log("Switching to Fleet Management perspective...");
await stagehand.act("click on the perspective switcher in the top left that says 'Administrator' or 'Fleet Management'");
await new Promise(r => setTimeout(r, 2000));

await stagehand.act("click on 'Fleet Management' in the dropdown menu");
await new Promise(r => setTimeout(r, 4000));

console.log("Now in Fleet Management perspective");

// Now you can navigate to ACM pages
await page.goto(`${console_url}/multicloud/infrastructure/clusters/managed`);
```

### Direct Navigation Example (Puppeteer)

```javascript
// Click perspective switcher
await page.click('button[data-test="perspective-switcher-toggle"]');
await new Promise(r => setTimeout(r, 2000));

// Click Fleet Management option
await page.click('a[data-test-id="fleet-management-perspective"], li:has-text("Fleet Management")');
await new Promise(r => setTimeout(r, 4000));

// Verify perspective switched
const perspective = await page.$eval('[data-test="perspective-switcher-toggle"]', el => el.textContent);
console.log(`Current perspective: ${perspective}`);
```

## Common Navigation Mistakes

### ❌ Wrong: Directly navigate to ACM URL from OCP home
```javascript
await page.goto(`${console_url}/multicloud/infrastructure/clusters`);
// Result: 404 error - page not available in Administrator perspective
```

### ✅ Correct: Switch perspective first
```javascript
// 1. Switch to Fleet Management
await switchToFleetManagement(page);

// 2. Then navigate
await page.goto(`${console_url}/multicloud/infrastructure/clusters`);
// Result: Page loads successfully
```

## Perspective-Specific URLs

### Fleet Management Perspective
- Clusters: `/multicloud/infrastructure/clusters/managed`
- Cluster sets: `/multicloud/infrastructure/clusters/sets`
- Automation: `/multicloud/infrastructure/automations`
- Applications: `/multicloud/applications`
- Governance: `/multicloud/governance/policies`

### Administrator Perspective
- Pods: `/k8s/ns/[namespace]/pods`
- Deployments: `/k8s/ns/[namespace]/deployments`
- Services: `/k8s/ns/[namespace]/services`
- Projects: `/k8s/cluster/projects`

## Troubleshooting

**Symptom:** Getting 404 errors on ACM URLs
**Cause:** Wrong perspective (likely in Administrator)
**Fix:** Switch to Fleet Management perspective before navigating

**Symptom:** Navigation menu doesn't show expected ACM items
**Cause:** Wrong perspective
**Fix:** Verify current perspective, switch to Fleet Management

**Symptom:** AI navigation keeps landing on wrong pages
**Cause:** AI is navigating Administrator perspective menu
**Fix:** Explicitly switch perspective before attempting navigation

## Best Practice: Reusable Helper Function

Create a helper function in your validators:

```javascript
async function switchToFleetManagement(stagehand, page) {
  console.log("🔄 Switching to Fleet Management perspective...");

  // Check current perspective
  const currentPerspective = await page.evaluate(() => {
    const switcher = document.querySelector('[data-test="perspective-switcher-toggle"]');
    return switcher ? switcher.textContent.trim() : 'Unknown';
  });

  console.log(`   Current: ${currentPerspective}`);

  if (currentPerspective.includes('Fleet Management')) {
    console.log("   ✅ Already in Fleet Management\n");
    return;
  }

  // Click switcher
  await stagehand.act("click on the perspective switcher menu in the top left corner");
  await new Promise(r => setTimeout(r, 2000));

  // Select Fleet Management
  await stagehand.act("click on 'Fleet Management' option");
  await new Promise(r => setTimeout(r, 4000));

  console.log("   ✅ Switched to Fleet Management\n");
}
```

## Verifying You're on the Correct Page

After navigation, **always verify** you've reached the intended page using context clues before attempting validation.

### Verification Methods

#### 1. URL Verification
```javascript
const currentUrl = page.url();
console.log(`Current URL: ${currentUrl}`);

// Check URL matches expected pattern
if (currentUrl.includes('/multicloud/infrastructure/clusters')) {
  console.log("✅ On clusters page");
} else {
  console.log("⚠️ Wrong page!");
}
```

#### 2. Page Title/Heading Verification
```javascript
const pageHeading = await page.evaluate(() => {
  const h1 = document.querySelector('h1');
  const title = document.querySelector('[data-test="page-title"]');
  return h1?.textContent || title?.textContent || 'No heading found';
});

console.log(`Page heading: ${pageHeading}`);

// Expected heading for Clusters page: "Clusters"
// Expected heading for Automation page: "Automation"
```

#### 3. Navigation Breadcrumb Verification
```javascript
const breadcrumbs = await page.evaluate(() => {
  const crumbs = Array.from(document.querySelectorAll('.pf-v5-c-breadcrumb__item, .pf-c-breadcrumb__item'));
  return crumbs.map(el => el.textContent.trim());
});

console.log(`Breadcrumbs: ${breadcrumbs.join(' > ')}`);

// Example: ["Infrastructure", "Clusters"] means you're on the clusters page
```

#### 4. Key UI Element Verification
```javascript
// Look for page-specific elements
const hasExpectedElement = await page.evaluate(() => {
  // For Clusters page, expect table or cluster list
  return !!document.querySelector('[data-ouia-component-id="cluster-table"]') ||
         !!document.querySelector('table[aria-label*="Cluster"]');
});

if (!hasExpectedElement) {
  console.log("⚠️ Expected UI element not found - may be on wrong page");
}
```

### Context Clues by Bug Type

Different bug types require different verification approaches:

#### For Cluster-Related Bugs
**Expected context clues:**
- URL contains: `/multicloud/infrastructure/clusters`
- Page heading: "Clusters" or "Managed clusters"
- Breadcrumbs: Infrastructure > Clusters
- Tabs visible: "Cluster list", "Cluster sets", "Cluster pools"
- Table with columns: Name, Namespace, Status, Distribution

**Verification code:**
```javascript
const isOnClustersPage = await page.evaluate(() => {
  const heading = document.querySelector('h1')?.textContent;
  const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map(t => t.textContent);
  const hasClustersTab = tabs.some(t => t.toLowerCase().includes('cluster'));

  return heading?.includes('Cluster') && hasClustersTab;
});
```

#### For Automation-Related Bugs
**Expected context clues:**
- URL contains: `/multicloud/infrastructure/automations`
- Page heading: "Automation" or "Ansible Automation"
- Breadcrumbs: Infrastructure > Automation
- Key text: "Ansible Automation Platform", "automation templates"

#### For Cluster Pools Bugs
**Expected context clues:**
- URL contains: `/clusters/pools` or tab says "Cluster pools"
- Active tab: "Cluster pools"
- Table columns: Pool name, Clusters, Available, Size
- "Claim cluster" button visible

**Pre-validation check:**
```javascript
// Check if cluster pools exist before attempting navigation
const { checkResourceExists } = require('../shared/acm-navigation-helper');

if (!checkResourceExists('clusterpool')) {
  console.log("⚠️ No cluster pools found - skipping this validation");
  return;
}
```

### AI-Guided Verification with Stagehand

Use Stagehand's extract() to verify page context:

```javascript
// After navigation, verify we're on the right page
const pageContext = await stagehand.extract({
  instruction: "What page am I on? Extract the page title, main heading, and visible tabs or sections",
  schema: {
    page_title: { type: 'string', description: 'Page title or main heading' },
    tabs: { type: 'array', items: { type: 'string' }, description: 'Visible tab names' },
    breadcrumbs: { type: 'array', items: { type: 'string' }, description: 'Breadcrumb trail' }
  }
});

console.log("Page context:", pageContext);

// Validate context matches expected page
if (pageContext.page_title?.includes('Cluster') && pageContext.tabs?.includes('Cluster pools')) {
  console.log("✅ Verified: On Cluster pools page");
} else {
  console.log("⚠️ Page context doesn't match - may need to navigate further");
}
```

### Complete Navigation + Verification Pattern

```javascript
async function navigateAndVerify(stagehand, page, targetPage, consoleUrl) {
  // 1. Switch perspective
  await switchToFleetManagement(stagehand, page);

  // 2. Navigate to page
  await page.goto(`${consoleUrl}${targetPage.url}`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));

  // 3. Check for 404
  const is404 = await page.evaluate(() => {
    return document.body.textContent.includes('404');
  });

  if (is404) {
    console.log(`❌ Got 404 - page doesn't exist`);
    return false;
  }

  // 4. Verify context clues
  const verification = await page.evaluate((expected) => {
    const heading = document.querySelector('h1')?.textContent || '';
    const url = window.location.href;
    const breadcrumbs = Array.from(document.querySelectorAll('.pf-v5-c-breadcrumb__item'))
      .map(el => el.textContent.trim());

    return {
      heading: heading,
      url: url,
      breadcrumbs: breadcrumbs,
      matchesExpected: heading.includes(expected.heading) && url.includes(expected.urlFragment)
    };
  }, targetPage.expected);

  console.log("Page verification:", verification);

  if (!verification.matchesExpected) {
    console.log(`⚠️ Page context doesn't match expected for ${targetPage.name}`);
    console.log(`   Expected heading to include: "${targetPage.expected.heading}"`);
    console.log(`   Expected URL to include: "${targetPage.expected.urlFragment}"`);
    console.log(`   Actual heading: "${verification.heading}"`);
    console.log(`   Actual URL: "${verification.url}"`);

    // Try AI-guided navigation as fallback
    console.log("Attempting AI-guided navigation...");
    await stagehand.act(`navigate to the ${targetPage.name} page`);
    await new Promise(r => setTimeout(r, 4000));

    // Re-verify
    const recheck = await page.evaluate((expected) => {
      const heading = document.querySelector('h1')?.textContent || '';
      return heading.includes(expected.heading);
    }, targetPage.expected);

    if (!recheck) {
      console.log(`❌ Still on wrong page after AI navigation`);
      return false;
    }
  }

  console.log(`✅ Verified: On ${targetPage.name} page\n`);
  return true;
}

// Usage
const TARGET_PAGES = {
  CLUSTERS: {
    name: 'Clusters',
    url: '/multicloud/infrastructure/clusters/managed',
    expected: { heading: 'Cluster', urlFragment: '/clusters' }
  },
  AUTOMATION: {
    name: 'Automation',
    url: '/multicloud/infrastructure/automations',
    expected: { heading: 'Automation', urlFragment: '/automations' }
  }
};

// In validator
const success = await navigateAndVerify(stagehand, page, TARGET_PAGES.CLUSTERS, consoleUrl);
if (!success) {
  throw new Error("Could not navigate to target page");
}
```

## Summary

**Golden Rule:** All ACM bug validations must start in Fleet Management perspective.

**Navigation Checklist:**
- [ ] Logged into OpenShift Console
- [ ] Switched to Fleet Management perspective
- [ ] Waited for perspective to fully load
- [ ] Navigated to target URL or used AI navigation
- [ ] **Verified context clues** (URL, heading, breadcrumbs, key elements)
- [ ] Confirmed page matches bug location
- [ ] Now safe to proceed with validation

**Verification is not optional** - always confirm you're on the right page before testing!

---

## Using the Console Repo for Navigation Reference

The **stolostron/console** repository is your source of truth for understanding ACM UI structure, routes, and navigation.

### Key Files to Reference

#### 1. Route Definitions
**File:** `frontend/src/routes/Routes.tsx` (or similar routing file)

**What to look for:**
- Exact URL paths for ACM pages
- Route parameters and query strings
- Which pages actually exist
- Nested routing structure

**Example:**
```typescript
// From console repo
<Route path="/multicloud/infrastructure/clusters/managed" component={ManagedClustersPage} />
<Route path="/multicloud/infrastructure/automations" component={AutomationPage} />
```

**How to use:**
```bash
# Find all route paths
grep -r "path.*multicloud" frontend/src/routes/

# Find cluster-related routes
grep -r "clusters" frontend/src/routes/ | grep "path"
```

#### 2. Page Components
**Location:** `frontend/src/routes/Infrastructure/Clusters/` (example)

**What to look for:**
- Page structure and layout
- Key UI elements (tables, buttons, forms)
- Data attributes (`data-test`, `data-ouia-component-id`)
- Component hierarchy

**Example:**
```typescript
// ClusterPoolsPage.tsx
<Page>
  <PageHeader title="Cluster pools" />
  <Toolbar>
    <Button data-test="claim-cluster">Claim cluster</Button>
  </Toolbar>
  <Table data-ouia-component-id="cluster-pool-table">
```

**How to use:** Know what selectors to use for finding elements

#### 3. Navigation Menu
**File:** `frontend/src/components/Navigation/Navigation.tsx` (or similar)

**What to look for:**
- How menu items are organized
- Which perspective shows which menu items
- Nested menu structure

#### 4. Data Test Attributes
**Search pattern:** `data-test=` or `data-ouia-component-id=`

**How to find:**
```bash
# Find test IDs for cluster claim button
grep -r "data-test.*claim" frontend/src/

# Find test IDs for cluster table
grep -r "data-ouia.*cluster" frontend/src/
```

**Usage in validator:**
```javascript
// Use the data-test attribute from the console repo
const button = await page.$('[data-test="claim-cluster-button"]');
```

### Practical Workflow: Validating a New Bug

1. **Read the bug description** - Understand which page the bug is on
2. **Check console repo** - Find the route definition:
   ```bash
   cd ~/path/to/stolostron/console
   grep -r "cluster.*pool" frontend/src/routes/
   # Output: path="/multicloud/infrastructure/clusters" (with tabs)
   ```

3. **Find the component** - Locate page component:
   ```bash
   find frontend/src -name "*ClusterPool*"
   # Find: frontend/src/routes/Infrastructure/Clusters/ClusterPools/ClusterPoolsPage.tsx
   ```

4. **Inspect component code** - Look for:
   - Page title: `<PageHeader title="Cluster pools" />`
   - Buttons: `<Button data-test="claim-cluster">`
   - Tables: `<Table data-test="cluster-pools-table">`
   - Tabs: `<Tab title="Cluster pools">`

5. **Build verification logic**:
   ```javascript
   // From console repo, we know:
   // - Page uses tabs: "Cluster list", "Cluster sets", "Cluster pools"
   // - "Claim cluster" button has data-test="claim-cluster"

   // Verify we're on cluster pools TAB
   const onPoolsTab = await page.evaluate(() => {
     const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
     return activeTab?.textContent?.includes('Cluster pools');
   });

   // Find button using known test ID
   const button = await page.$('[data-test="claim-cluster"]');
   ```

### Example: Finding Automation Page Route

**Goal:** Validate ACM-30661 (Automation alert bug)

**Step 1:** Search console repo for automation routes
```bash
cd ~/stolostron/console
grep -r "automation" frontend/src/routes/ | grep -i path
```

**Step 2:** Find exact path
```
// Result:
frontend/src/routes/Infrastructure/Automations/AutomationsPage.tsx
path: "/multicloud/infrastructure/automations"
```

**Step 3:** Check component for verification clues
```typescript
// AutomationsPage.tsx
<PageHeader title="Automation" />
<Alert>Ansible Automation Platform operator required...</Alert>
```

**Step 4:** Build validator
```javascript
// Navigate
await navigateToACMPage(stagehand, page, '/multicloud/infrastructure/automations', consoleUrl);

// Verify using clues from repo
const isCorrectPage = await page.evaluate(() => {
  const heading = document.querySelector('h1')?.textContent;
  const hasAlert = document.querySelector('.pf-v5-c-alert');
  return heading?.includes('Automation') && !!hasAlert;
});
```

### Console Repo Quick Reference Commands

```bash
# Find route for a specific page
grep -r "path.*YOUR_PAGE" frontend/src/routes/

# Find all data-test attributes
grep -r "data-test=" frontend/src/ | grep -i YOUR_COMPONENT

# Find component by name
find frontend/src -iname "*YOUR_COMPONENT*"

# See page structure
cat frontend/src/routes/PATH/TO/PAGE/Component.tsx

# Find tab names
grep -r "Tab.*title" frontend/src/routes/YOUR_PAGE/
```

### Benefits of Using Console Repo

✅ **Know what actually exists** - Don't try to navigate to non-existent pages
✅ **Use correct selectors** - Find exact `data-test` attributes from source
✅ **Understand structure** - Know how tabs, menus, and pages are organized
✅ **Anticipate changes** - See what version introduced or changed a route
✅ **Debug faster** - Compare expected vs actual DOM structure

### When Console Repo is Essential

- **New bug** - Never validated this page before
- **Route unknown** - Not sure what the URL path is
- **Element not found** - Need to know correct selector
- **Page structure changed** - UI was redesigned
- **Tab navigation** - Need to click specific tab to see content

**Remember:** The console repo is the source of truth. When in doubt, check the code!
