// ACM-30661: Automation Alert Browser Validation (Robust Version)
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function validateACMAutomation() {
  console.log("🌐 Starting ACM Automation Alert Validation (ACM-30661)...\n");

  const configPath = path.join(__dirname, 'cluster-config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  const consoleUrl = config.credentials.console_url;
  const username = config.credentials.username;
  const password = config.credentials.password;

  console.log(`OpenShift Console: ${consoleUrl}`);
  console.log(`Username: ${username}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--window-size=1920,1080'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const screenshots = [];
  let stepNumber = 0;

  async function captureStep(description) {
    stepNumber++;
    const filename = path.join(__dirname, `step-${stepNumber}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`);
    await page.screenshot({ path: filename, fullPage: false });
    screenshots.push({ step: stepNumber, description, filename: path.basename(filename) });
    console.log(`  📸 Screenshot ${stepNumber}: ${description}`);
    return filename;
  }

  async function waitForStability(ms = 3000) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  try {
    // Step 1: Navigate and wait for redirects
    console.log("1️⃣  Navigating to OpenShift Console...");
    await page.goto(consoleUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for any OAuth redirects to settle
    await waitForStability(5000);
    await captureStep('initial-page');

    const currentUrl = page.url();
    const currentTitle = await page.title();
    console.log(`   Current URL: ${currentUrl}`);
    console.log(`   Page title: ${currentTitle}\n`);

    // Step 2: Handle login if needed
    console.log("2️⃣  Checking for login...");

    if (currentUrl.includes('oauth') || currentTitle.includes('Log in')) {
      console.log("   On login page - looking for auth provider...");

      // OpenShift OAuth often has an identity provider selection first
      // Look for "kube:admin" or "htpasswd" provider link
      await waitForStability(2000);

      const providerClicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const provider = links.find(a =>
          a.textContent.includes('kube:admin') ||
          a.textContent.includes('htpasswd') ||
          a.href.includes('htpasswd') ||
          a.href.includes('YOUR-USERNAME')
        );
        if (provider) {
          provider.click();
          return true;
        }
        return false;
      });

      if (providerClicked) {
        console.log("   Clicked auth provider");
        await waitForStability(3000);
        await captureStep('after-provider-click');
      }

      // Now try to log in
      console.log("   Looking for login form...");
      await waitForStability(2000);

      // Try to find and fill username
      try {
        await page.waitForSelector('input[type="text"]', { timeout: 5000 });
        await page.type('input[type="text"]', username, { delay: 100 });
        console.log(`   Typed username: ${username}`);

        await waitForStability(500);

        await page.waitForSelector('input[type="password"]', { timeout: 5000 });
        await page.type('input[type="password"]', password, { delay: 100 });
        console.log("   Typed password");

        await captureStep('credentials-entered');

        // Click submit
        await waitForStability(500);
        await page.click('button[type="submit"]');
        console.log("   Clicked login");

        // Wait for post-login navigation
        await waitForStability(5000);
        await captureStep('after-login');
        console.log("   ✅ Login attempt completed\n");
      } catch (loginErr) {
        console.log(`   ⚠️  Could not complete login: ${loginErr.message}\n`);
        await captureStep('login-failed');
      }
    } else {
      console.log("   ✅ Not on login page\n");
    }

    // Step 3: Navigate to Automation page
    console.log("3️⃣  Navigating to Automation page...");

    const automationUrl = `${consoleUrl}/multicloud/infrastructure/automations`;
    console.log(`   Target URL: ${automationUrl}`);

    await page.goto(automationUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    }).catch(err => console.log(`   Navigation warning: ${err.message}`));

    await waitForStability(5000);
    await captureStep('automation-page');

    const finalUrl = page.url();
    const finalTitle = await page.title();
    console.log(`   Current URL: ${finalUrl}`);
    console.log(`   Page title: ${finalTitle}\n`);

    // Step 4: Capture alerts
    console.log("4️⃣  Capturing alert messages...");

    await waitForStability(2000);

    const alertInfo = await page.evaluate(() => {
      const alertSelectors = [
        '[role="alert"]',
        '.pf-c-alert',
        '.pf-v5-c-alert',
        '[class*="alert"]',
        '[class*="Alert"]',
        '[class*="banner"]',
        '[class*="Banner"]'
      ];

      const allAlerts = [];
      alertSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            allAlerts.push({
              text: el.textContent.trim(),
              className: el.className,
              html: el.innerHTML.substring(0, 500)
            });
          }
        });
      });

      // Deduplicate based on text
      const unique = allAlerts.reduce((acc, alert) => {
        if (!acc.find(a => a.text === alert.text)) {
          acc.push(alert);
        }
        return acc;
      }, []);

      return {
        foundAlerts: unique.length > 0,
        alertCount: unique.length,
        alerts: unique
      };
    });

    console.log(`   Found ${alertInfo.alertCount} unique alert(s)\n`);

    if (alertInfo.foundAlerts) {
      alertInfo.alerts.forEach((alert, idx) => {
        console.log(`   Alert ${idx + 1}:`);
        console.log(`   ${alert.text.substring(0, 150)}...\n`);
      });
    }

    await captureStep('alerts-captured');

    // Generate summary
    const summary = {
      bug_id: "ACM-30661",
      timestamp: new Date().toISOString(),
      cluster: config.cluster_name,
      console_url: consoleUrl,
      final_url: finalUrl,
      final_title: finalTitle,
      validation_status: alertInfo.foundAlerts ? "ALERT_FOUND" : "NO_ALERT",
      screenshots: screenshots,
      alerts_captured: alertInfo.alerts,
      steps_completed: stepNumber
    };

    const summaryPath = path.join(__dirname, 'validation-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✅ Summary saved: ${path.basename(summaryPath)}\n`);

    // Generate report
    const report = generateReport(summary, alertInfo);
    const reportPath = path.join(__dirname, 'VALIDATION_REPORT.md');
    await fs.writeFile(reportPath, report);
    console.log(`✅ Report saved: ${path.basename(reportPath)}\n`);

    console.log("📊 Validation Complete:");
    console.log(`   Status: ${summary.validation_status}`);
    console.log(`   Alerts found: ${alertInfo.alertCount}`);
    console.log(`   Screenshots: ${screenshots.length}\n`);

    console.log("⏳ Keeping browser open for 20 seconds...");
    await new Promise(resolve => setTimeout(resolve, 20000));

    await browser.close();
    return summary;

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    await captureStep('error-state').catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();
    throw error;
  }
}

function generateReport(summary, alertInfo) {
  const timestamp = new Date(summary.timestamp).toLocaleString();

  return `# ACM-30661 Validation Report

**Bug:** Automation alert when AAP is not installed is incorrect
**Cluster:** ${summary.cluster}
**Validation Date:** ${timestamp}
**Status:** ${summary.validation_status}

## Test Environment

- **Cluster:** ${summary.cluster}
- **Console URL:** ${summary.console_url}
- **Final URL:** ${summary.final_url}
- **Page Title:** ${summary.final_title}

## Results

### Alerts Found: ${alertInfo.alertCount}

${alertInfo.alerts.map((alert, idx) => `
#### Alert ${idx + 1}

\`\`\`
${alert.text}
\`\`\`
`).join('\n')}

${alertInfo.alertCount === 0 ? '**No alerts found on the Automation page.**' : ''}

## Evidence

${summary.screenshots.map(s => `${s.step}. **${s.description}** - \`${s.filename}\``).join('\n')}

## Conclusion

${alertInfo.foundAlerts ? `
✅ **ALERT VISIBLE** - ${alertInfo.alertCount} alert(s) captured
` : `
⚠️ **NO ALERT** - No alerts found on Automation page
`}

---
Generated: ${timestamp}
`;
}

validateACMAutomation()
  .then(summary => {
    console.log("✅ Validation complete!");
    process.exit(0);
  })
  .catch(error => {
    console.error("❌ Failed:", error.message);
    process.exit(1);
  });
