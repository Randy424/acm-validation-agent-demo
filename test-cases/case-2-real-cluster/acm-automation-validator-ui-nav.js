// ACM-30661: UI Navigation to Automation
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function validateACMAutomation() {
  console.log("🌐 ACM-30661 Validation - UI Navigation\n");

  const configPath = path.join(__dirname, 'cluster-config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  const consoleUrl = config.credentials.console_url;
  const username = config.credentials.username;
  const password = config.credentials.password;

  console.log(`Console: ${consoleUrl}`);
  console.log(`User: ${username}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  const screenshots = [];
  let stepNumber = 0;

  async function captureStep(description) {
    stepNumber++;
    const filename = path.join(__dirname, `ui-nav-${stepNumber}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`);
    await page.screenshot({ path: filename, fullPage: false });
    screenshots.push({ step: stepNumber, description, filename: path.basename(filename) });
    console.log(`  📸 ${stepNumber}: ${description}`);
    return filename;
  }

  async function wait(ms = 3000) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  try {
    // Navigate and login
    console.log("1️⃣  Navigating to console...");
    await page.goto(consoleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(5000);
    await captureStep('console-landing');

    if (page.url().includes('oauth') || (await page.title()).includes('Log in')) {
      console.log("2️⃣  Logging in...");

      // Click auth provider
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const provider = links.find(a => a.textContent.includes('kube:admin') || a.href.includes('htpasswd'));
        if (provider) provider.click();
      });
      await wait(3000);
      await captureStep('auth-provider-selected');

      // Login
      await page.waitForSelector('input[type="text"]', { timeout: 5000 });
      await page.type('input[type="text"]', username, { delay: 100 });
      await page.type('input[type="password"]', password, { delay: 100 });
      await captureStep('credentials-entered');

      await page.click('button[type="submit"]');
      await wait(6000);
      await captureStep('logged-in');
      console.log("   ✅ Logged in\n");
    }

    // Navigate through UI
    console.log("3️⃣  Looking for ACM/Clusters menu...");
    await wait(2000);

    // Try to find and click "All Clusters" or navigation menu
    const navClicked = await page.evaluate(() => {
      // Look for various possible menu items
      const selectors = [
        'All Clusters',
        'Clusters',
        'Infrastructure',
        'Cluster Management',
        'Advanced Cluster Management'
      ];

      for (const text of selectors) {
        const elements = Array.from(document.querySelectorAll('a, button, nav a, [role="menuitem"]'));
        const elem = elements.find(e =>
          e.textContent.trim() === text ||
          e.textContent.includes(text)
        );
        if (elem) {
          console.log(`Found: ${text}`);
          elem.click();
          return text;
        }
      }
      return null;
    });

    if (navClicked) {
      console.log(`   Clicked: ${navClicked}`);
      await wait(3000);
      await captureStep('after-clusters-click');
    } else {
      console.log("   No clusters menu found, trying console home");
      await captureStep('no-clusters-menu');
    }

    // Look for Automation link
    console.log("4️⃣  Looking for Automation link...");
    await wait(2000);

    const automationClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, nav a, [role="menuitem"], li'));
      const automation = elements.find(e =>
        e.textContent.trim() === 'Automation' ||
        (e.textContent.includes('Automation') && !e.textContent.includes('Policy'))
      );
      if (automation) {
        automation.click();
        return true;
      }
      return false;
    });

    if (automationClicked) {
      console.log("   Clicked Automation");
      await wait(4000);
      await captureStep('automation-page');
    } else {
      console.log("   Automation link not found");
      await captureStep('no-automation-link');

      // Try common ACM URLs
      const possibleUrls = [
        '/multicloud/infrastructure/clusters/managed',
        '/multicloud/infrastructure/automation',
        '/k8s/all-namespaces/clusterserviceversions',
        consoleUrl + '/multicloud'
      ];

      for (const url of possibleUrls) {
        console.log(`   Trying: ${url}`);
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await wait(3000);
          const title = await page.title();
          if (!title.includes('404')) {
            console.log(`   ✅ Found working page: ${title}`);
            await captureStep('found-page');
            break;
          }
        } catch (e) {
          console.log(`   Failed: ${e.message}`);
        }
      }
    }

    // Capture current state
    console.log("5️⃣  Capturing final state...");
    await wait(2000);

    const pageState = await page.evaluate(() => {
      // Look for alerts
      const alertElements = document.querySelectorAll('[role="alert"], .pf-c-alert, .pf-v5-c-alert, .pf-v6-c-alert, [class*="alert"]');
      const alerts = Array.from(alertElements)
        .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0)
        .map(el => ({
          text: el.textContent.trim(),
          className: el.className
        }));

      // Get all visible text
      const bodyText = document.body.textContent;

      return {
        url: window.location.href,
        title: document.title,
        alerts: alerts,
        hasAutomationText: bodyText.includes('Automation') || bodyText.includes('automation'),
        hasAAPText: bodyText.includes('AAP') || bodyText.includes('Ansible'),
        bodyPreview: bodyText.substring(0, 500)
      };
    });

    console.log(`\n   URL: ${pageState.url}`);
    console.log(`   Title: ${pageState.title}`);
    console.log(`   Alerts found: ${pageState.alerts.length}`);
    console.log(`   Has 'Automation' text: ${pageState.hasAutomationText}`);
    console.log(`   Has 'AAP/Ansible' text: ${pageState.hasAAPText}\n`);

    if (pageState.alerts.length > 0) {
      pageState.alerts.forEach((alert, idx) => {
        console.log(`   Alert ${idx + 1}: ${alert.text.substring(0, 100)}...`);
      });
    }

    await captureStep('final-state');

    // Save summary
    const summary = {
      bug_id: "ACM-30661",
      timestamp: new Date().toISOString(),
      cluster: config.cluster_name,
      final_url: pageState.url,
      final_title: pageState.title,
      alerts: pageState.alerts,
      page_info: pageState,
      screenshots: screenshots
    };

    await fs.writeFile(
      path.join(__dirname, 'ui-nav-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log("\n✅ Summary saved: ui-nav-summary.json");
    console.log(`📸 Screenshots: ${screenshots.length}\n`);

    console.log("⏳ Browser stays open for 30 seconds...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    await browser.close();
    return summary;

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    await captureStep('error').catch(() => {});
    await wait(5000);
    await browser.close();
    throw error;
  }
}

validateACMAutomation()
  .then(() => {
    console.log("✅ Complete!");
    process.exit(0);
  })
  .catch(error => {
    console.error("❌ Failed:", error.message);
    process.exit(1);
  });
