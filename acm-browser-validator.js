// ACM Browser Validation with Puppeteer
// This script navigates the ACM console and validates bugs visually

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function validateACMBug(options = {}) {
  const {
    acmConsoleUrl = process.env.ACM_CONSOLE_URL || 'http://localhost:3000',
    username = process.env.ACM_USERNAME || 'YOUR-USERNAME',
    password = process.env.ACM_PASSWORD || 'password',
    placementName = 'test-placement',
    placementNamespace = 'placement-test',
    headless = false,
    recordVideo = true
  } = options;

  console.log("🌐 Starting ACM Browser Validation...\n");
  console.log(`ACM Console: ${acmConsoleUrl}`);
  console.log(`Target: Placement "${placementName}" in namespace "${placementNamespace}"\n`);

  const browser = await puppeteer.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  // Set up video recording if requested
  let videoPath = null;
  if (recordVideo) {
    videoPath = path.join(__dirname, `acm-validation-${Date.now()}.webm`);
    // Note: Puppeteer video recording requires CDP session
    // For now, we'll focus on screenshots
    console.log("📹 Video recording: Will capture screenshots at each step\n");
  }

  const screenshots = [];
  let stepNumber = 0;

  async function captureStep(description) {
    stepNumber++;
    const filename = `step-${stepNumber}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    screenshots.push({ step: stepNumber, description, filename });
    console.log(`  📸 Screenshot: ${filename}`);
  }

  try {
    // Step 1: Navigate to ACM Console
    console.log("1️⃣  Navigating to ACM console...");
    try {
      await page.goto(acmConsoleUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await captureStep('acm-console-landing');
      console.log("   ✅ Loaded ACM console\n");
    } catch (error) {
      console.log("   ⚠️  Could not reach ACM console");
      console.log(`   Error: ${error.message}`);
      console.log("   This is expected if ACM is not yet deployed\n");
      await captureStep('console-unreachable');
    }

    // Step 2: Login (if login page detected)
    console.log("2️⃣  Checking for login page...");
    const loginDetected = await page.evaluate(() => {
      return document.body.textContent.toLowerCase().includes('log in') ||
             document.querySelector('input[type="password"]') !== null;
    });

    if (loginDetected) {
      console.log("   Found login page, attempting to log in...");

      // Try to find and fill username field
      const usernameSelector = 'input[name="username"], input[type="text"], input[id*="username"]';
      await page.waitForSelector(usernameSelector, { timeout: 5000 }).catch(() => {});
      await page.type(usernameSelector, username);

      // Fill password field
      const passwordSelector = 'input[type="password"]';
      await page.type(passwordSelector, password);

      await captureStep('login-credentials-entered');

      // Click login button
      const loginButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Log in")');
      if (loginButton) {
        await loginButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await captureStep('after-login');
        console.log("   ✅ Login attempted\n");
      }
    } else {
      console.log("   ℹ️  No login required or already logged in\n");
    }

    // Step 3: Navigate to Placements
    console.log("3️⃣  Navigating to Placements...");

    // Try multiple navigation strategies
    const navStrategies = [
      // Strategy 1: Direct URL
      async () => {
        await page.goto(`${acmConsoleUrl}/multicloud/applications/placements`, {
          waitUntil: 'networkidle2',
          timeout: 10000
        });
      },
      // Strategy 2: Click navigation menu
      async () => {
        const placementsLink = await page.$('a[href*="placements"]');
        if (placementsLink) {
          await placementsLink.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        } else {
          throw new Error('Placements link not found');
        }
      }
    ];

    let navSuccess = false;
    for (const strategy of navStrategies) {
      try {
        await strategy();
        navSuccess = true;
        break;
      } catch (error) {
        console.log(`   ⚠️  Navigation strategy failed: ${error.message}`);
      }
    }

    if (navSuccess) {
      await captureStep('placements-list');
      console.log("   ✅ Reached Placements page\n");
    } else {
      console.log("   ⚠️  Could not navigate to Placements (ACM may not be fully deployed)\n");
    }

    // Step 4: Find and click on the test placement
    console.log("4️⃣  Searching for Placement: " + placementName);

    // Search for placement in the list
    const placementFound = await page.evaluate((name) => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => el.textContent.includes(name));
    }, placementName);

    if (placementFound) {
      console.log(`   ✅ Found Placement: ${placementName}`);

      // Try to click on it
      const placementLink = await page.$(`a:has-text("${placementName}")`);
      if (placementLink) {
        await placementLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await captureStep('placement-detail-page');
        console.log("   ✅ Opened Placement detail page\n");
      }
    } else {
      console.log(`   ⚠️  Placement "${placementName}" not found in UI`);
      console.log("   This may be because ACM is not fully deployed or placement wasn't created yet\n");
    }

    // Step 5: Check the status section
    console.log("5️⃣  Checking Placement status in UI...");

    const statusInfo = await page.evaluate(() => {
      // Look for status-related elements
      const statusSection = document.querySelector('[data-test="status"], .status-section, #status');
      const conditionsSection = document.querySelector('[data-test="conditions"], .conditions-section');
      const decisionsSection = document.querySelector('[data-test="decisions"], .decisions-section');

      return {
        statusVisible: !!statusSection,
        statusText: statusSection?.textContent || '',
        conditionsVisible: !!conditionsSection,
        decisionsVisible: !!decisionsSection,
        bodyText: document.body.textContent
      };
    });

    await captureStep('status-section');

    // Analyze what we found
    const bugDetected =
      !statusInfo.statusVisible ||
      statusInfo.statusText.toLowerCase().includes('no status') ||
      statusInfo.bodyText.toLowerCase().includes('no status information');

    if (bugDetected) {
      console.log("   ✅ BUG CONFIRMED: Status section is empty or shows no information");
    } else {
      console.log("   ❓ Status information appears to be present");
      console.log(`   Status: ${statusInfo.statusText.substring(0, 100)}...`);
    }

    console.log("\n📊 Validation Results:");
    console.log("   Screenshots captured:", screenshots.length);
    console.log("   Bug detected:", bugDetected ? "YES" : "NO");

    await browser.close();

    // Generate summary
    const summary = {
      timestamp: new Date().toISOString(),
      acmConsoleUrl,
      placementName,
      placementNamespace,
      bugDetected,
      screenshots: screenshots.map(s => s.filename),
      statusInfo
    };

    await fs.writeFile('browser-validation-summary.json', JSON.stringify(summary, null, 2));
    console.log("\n✅ Browser validation complete!");
    console.log("   Summary saved to: browser-validation-summary.json\n");

    return summary;

  } catch (error) {
    console.error("\n❌ Error during browser validation:");
    console.error(error.message);

    await captureStep('error-state');
    await browser.close();

    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  validateACMBug({
    headless: false,  // Show browser for demo
    recordVideo: true
  })
    .then(summary => {
      console.log("Validation summary:", summary);
      process.exit(0);
    })
    .catch(error => {
      console.error("Validation failed:", error);
      process.exit(1);
    });
}

module.exports = { validateACMBug };
