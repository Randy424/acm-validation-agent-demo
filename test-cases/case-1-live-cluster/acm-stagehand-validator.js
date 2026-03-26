// ACM-30661: Automation Alert Validation with Stagehand
// AI-powered browser automation using Claude
require('dotenv').config({ path: '../../.env' });
const { Stagehand } = require('@browserbasehq/stagehand');
const fs = require('fs').promises;
const path = require('path');

async function validateWithStagehand() {
  console.log("🤖 Starting Stagehand AI Validation (ACM-30661)...\n");

  // Load cluster config
  const configPath = path.join(__dirname, 'cluster-config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  const consoleUrl = config.credentials.console_url;
  const username = config.credentials.username;
  const password = config.credentials.password;

  console.log(`Console: ${consoleUrl}`);
  console.log(`Using Claude AI for navigation\n`);

  // Initialize Stagehand with Anthropic
  const stagehand = new Stagehand({
    env: 'LOCAL',
    headless: false,
    verbose: 1,
    debugDom: true,
    enableCaching: false
  });

  const screenshots = [];
  let stepNumber = 0;

  let page; // Will be set after init

  async function captureStep(description) {
    stepNumber++;
    const filename = path.join(__dirname, `stagehand-${stepNumber}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`);
    await page.screenshot({ path: filename, fullPage: true });
    screenshots.push({ step: stepNumber, description, filename: path.basename(filename) });
    console.log(`  📸 ${stepNumber}: ${description}`);
    return filename;
  }

  try {
    await stagehand.init();
    // Get page from Stagehand's context
    const pages = Array.from(stagehand.ctx.pagesByTarget.values());
    page = pages[0];

    if (!page) {
      throw new Error("Failed to get page from Stagehand");
    }

    console.log(`   Stagehand initialized, browser ready\n`);

    // Step 1: Navigate to console
    console.log("1️⃣  AI navigating to OpenShift Console...");
    await page.goto(consoleUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await captureStep('console-landing');

    // Step 2: AI-powered login
    console.log("2️⃣  AI handling authentication...");

    // Check if on login page
    const currentUrl = page.url();
    if (currentUrl.includes('oauth') || currentUrl.includes('login')) {
      console.log("   On OAuth login page");

      // Use Stagehand AI to click auth provider
      await stagehand.act({
        action: "click on the authentication provider link that mentions 'kube:admin' or 'htpasswd'"
      });
      await page.waitForTimeout(3000);
      await captureStep('provider-selected');

      // Use Stagehand AI to fill login form
      await stagehand.act({
        action: `type "${username}" in the username field`
      });

      await stagehand.act({
        action: `type "${password}" in the password field`
      });

      await captureStep('credentials-entered');

      // Submit login
      await stagehand.act({
        action: "click the login or submit button"
      });

      await page.waitForTimeout(6000);
      await captureStep('logged-in');
      console.log("   ✅ AI completed login\n");
    }

    // Step 3: AI navigate to Automation
    console.log("3️⃣  AI navigating to Automation page...");

    // Try AI navigation first
    try {
      await stagehand.act({
        action: "navigate to the Automation section under Infrastructure or Clusters"
      });
      await page.waitForTimeout(4000);
    } catch (navError) {
      // Fallback to direct URL
      console.log("   AI navigation failed, using direct URL");
      await page.goto(`${consoleUrl}/multicloud/infrastructure/automations`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForTimeout(5000);
    }

    await captureStep('automation-page');
    console.log(`   Current URL: ${page.url()}\n`);

    // Step 4: AI extract alerts
    console.log("4️⃣  AI extracting alerts...");

    const alertInfo = await stagehand.extract({
      instruction: "Find all alert messages on this page, especially those related to Ansible Automation Platform, AAP, or operator requirements",
      schema: {
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              message: { type: 'string' },
              type: { type: 'string' }
            }
          }
        }
      }
    });

    console.log(`   AI found ${alertInfo.alerts?.length || 0} alerts\n`);

    if (alertInfo.alerts && alertInfo.alerts.length > 0) {
      alertInfo.alerts.forEach((alert, idx) => {
        console.log(`   Alert ${idx + 1}:`);
        console.log(`   Title: ${alert.title}`);
        console.log(`   Message: ${alert.message}\n`);
      });
    }

    await captureStep('alerts-extracted');

    // Save results
    const summary = {
      bug_id: "ACM-30661",
      timestamp: new Date().toISOString(),
      cluster: config.cluster_name,
      url: page.url(),
      validation_method: "Stagehand AI (Claude Sonnet 4)",
      alerts: alertInfo.alerts || [],
      screenshots: screenshots
    };

    await fs.writeFile(
      path.join(__dirname, 'stagehand-validation-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log("\n✅ Stagehand validation complete!");
    console.log(`📸 Screenshots: ${screenshots.length}`);
    console.log(`🤖 Alerts found by AI: ${alertInfo.alerts?.length || 0}\n`);

    console.log("⏳ Keeping browser open for 20 seconds...");
    await page.waitForTimeout(20000);

    await stagehand.close();
    return summary;

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    await captureStep('error').catch(() => {});
    await stagehand.close();
    throw error;
  }
}

validateWithStagehand()
  .then(summary => {
    console.log("✅ Success!");
    process.exit(0);
  })
  .catch(error => {
    console.error("❌ Failed:", error.message);
    process.exit(1);
  });
