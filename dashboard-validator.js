// Kubernetes Dashboard Browser Validation
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function validateDashboard() {
  console.log("🌐 Starting Kubernetes Dashboard Browser Validation...\n");

  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/';
  const token = process.env.DASHBOARD_TOKEN;

  if (!token) {
    throw new Error('DASHBOARD_TOKEN not set in .env file');
  }

  console.log(`Dashboard URL: ${dashboardUrl}\n`);

  const browser = await puppeteer.launch({
    headless: false,  // Show browser for demo
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  const screenshots = [];
  let stepNumber = 0;

  async function captureStep(description) {
    stepNumber++;
    const filename = `dashboard-step-${stepNumber}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    screenshots.push({ step: stepNumber, description, filename });
    console.log(`  📸 Screenshot: ${filename}`);
    return filename;
  }

  try {
    // Step 1: Navigate to Dashboard
    console.log("1️⃣  Navigating to Kubernetes Dashboard...");
    await page.goto(dashboardUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await captureStep('dashboard-landing');
    console.log("   ✅ Dashboard loaded\n");

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Login with token
    console.log("2️⃣  Logging in with token...");

    // Check if we see the login page
    const tokenInputExists = await page.$('input[id="token"]');

    if (tokenInputExists) {
      console.log("   Found login page");

      // Click on Token radio button
      const tokenRadio = await page.$('input[value="token"]');
      if (tokenRadio) {
        await tokenRadio.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Enter the token
      await page.type('input[id="token"]', token);
      await captureStep('token-entered');

      // Click Sign In button
      const signInButton = await page.$('button[type="submit"]');
      if (signInButton) {
        await signInButton.click();
        await page.waitForNavigation({
          waitUntil: 'networkidle2',
          timeout: 10000
        }).catch(() => console.log("   Navigation timeout (may be normal)"));

        await new Promise(resolve => setTimeout(resolve, 2000));
        await captureStep('after-login');
        console.log("   ✅ Logged in\n");
      }
    } else {
      console.log("   ℹ️  Already logged in or no login required\n");
    }

    // Step 3: Navigate to Placements
    console.log("3️⃣  Navigating to Custom Resources...");

    // Try to find and click on "Custom Resource Definitions" in the sidebar
    const crdLink = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.find(a => a.textContent.includes('Custom Resource Definitions'));
    });

    if (crdLink && crdLink.asElement()) {
      await crdLink.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await captureStep('crd-list');
      console.log("   ✅ Reached CRD page\n");
    } else {
      console.log("   ℹ️  Navigating directly to placements namespace\n");
      // Navigate directly to the placement resource
      const placementUrl = `${dashboardUrl}#/placement-test/placements`;
      await page.goto(placementUrl, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Step 4: Search for Placement CRD
    console.log("4️⃣  Looking for Placement resources...");

    // Try to find "placements" in the page
    const placementFound = await page.evaluate(() => {
      const text = document.body.textContent;
      return text.includes('placement') || text.includes('Placement');
    });

    if (placementFound) {
      console.log("   ✅ Found Placement references\n");
      await captureStep('placement-found');
    }

    // Step 5: Navigate to our test placement
    console.log("5️⃣  Attempting to view test-placement...");

    // Try clicking on namespace selector to change to placement-test
    const namespaceSelector = await page.$('mat-select, select, .namespace-selector');
    if (namespaceSelector) {
      await namespaceSelector.click();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to find and click placement-test namespace
      await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('mat-option, option'));
        const placementTestOption = options.find(opt =>
          opt.textContent.includes('placement-test')
        );
        if (placementTestOption) {
          placementTestOption.click();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
      await captureStep('namespace-changed');
    }

    // Step 6: Check for the Placement resource
    console.log("6️⃣  Checking for test-placement resource...");

    // Look for test-placement in the page
    const testPlacementVisible = await page.evaluate(() => {
      return document.body.textContent.includes('test-placement');
    });

    if (testPlacementVisible) {
      console.log("   ✅ test-placement is visible in the UI\n");

      // Try to click on it
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const placementElement = elements.find(el =>
          el.textContent === 'test-placement' && el.tagName === 'A'
        );
        if (placementElement) {
          placementElement.click();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
      await captureStep('placement-detail');
      console.log("   📄 Captured placement detail page\n");
    } else {
      console.log("   ℹ️  test-placement not found in current view\n");
    }

    // Step 7: Capture final state
    console.log("7️⃣  Capturing final state...");

    // Get the current page content
    const pageContent = await page.evaluate(() => {
      return {
        url: window.location.href,
        bodyText: document.body.textContent.substring(0, 500),
        hasStatusSection: document.body.textContent.includes('Status'),
        hasConditions: document.body.textContent.includes('Conditions')
      };
    });

    await captureStep('final-state');

    console.log("\n📊 Browser Validation Results:");
    console.log(`   Screenshots captured: ${screenshots.length}`);
    console.log(`   Current URL: ${pageContent.url}`);
    console.log(`   Status section visible: ${pageContent.hasStatusSection}`);
    console.log(`   Conditions visible: ${pageContent.hasConditions}\n`);

    // Generate summary
    const summary = {
      timestamp: new Date().toISOString(),
      dashboardUrl,
      screenshots: screenshots.map(s => ({ step: s.step, description: s.description, file: s.filename })),
      pageState: pageContent
    };

    await fs.writeFile('browser-validation-summary.json', JSON.stringify(summary, null, 2));
    console.log("✅ Summary saved to: browser-validation-summary.json\n");

    console.log("⏳ Keeping browser open for 10 seconds for you to inspect...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    await browser.close();

    return summary;

  } catch (error) {
    console.error("\n❌ Error during browser validation:");
    console.error(error.message);

    await captureStep('error-state');
    await browser.close();

    throw error;
  }
}

// Run
require('dotenv').config();

validateDashboard()
  .then(summary => {
    console.log("\n✅ Browser validation complete!");
    console.log(`Captured ${summary.screenshots.length} screenshots`);
    process.exit(0);
  })
  .catch(error => {
    console.error("\n❌ Validation failed:", error);
    process.exit(1);
  });
