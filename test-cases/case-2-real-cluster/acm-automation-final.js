// ACM-30661: Final Automation Alert Validation
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function validateACMAutomation() {
  console.log("🌐 ACM-30661: Automation Alert Validation\n");

  const configPath = path.join(__dirname, 'cluster-config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  const consoleUrl = config.credentials.console_url;
  const username = config.credentials.username;
  const password = config.credentials.password;

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
    const filename = path.join(__dirname, `final-${stepNumber}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`);
    await page.screenshot({ path: filename, fullPage: true });
    screenshots.push({ step: stepNumber, description, filename: path.basename(filename) });
    console.log(`  📸 ${stepNumber}: ${description}`);
    return filename;
  }

  async function wait(ms = 3000) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  try {
    // Navigate
    console.log("1️⃣  Loading console...");
    await page.goto(consoleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(5000);
    await captureStep('landing');

    // Login
    if (page.url().includes('oauth') || (await page.title()).includes('Log in')) {
      console.log("2️⃣  Logging in...");
      await page.evaluate(() => {
        const provider = Array.from(document.querySelectorAll('a')).find(a =>
          a.textContent.includes('kube:admin') || a.href.includes('htpasswd')
        );
        if (provider) provider.click();
      });
      await wait(3000);

      await page.waitForSelector('input[type="text"]', { timeout: 5000 });
      await page.type('input[type="text"]', username, { delay: 50 });
      await page.type('input[type="password"]', password, { delay: 50 });
      await page.click('button[type="submit"]');
      await wait(6000);
      await captureStep('logged-in');
      console.log("   ✅ Logged in");
    }

    // Navigate to Automations
    console.log("3️⃣  Navigating to Automations page...");
    const automationUrl = `${consoleUrl}/multicloud/infrastructure/automations`;
    await page.goto(automationUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await wait(5000);
    await captureStep('automation-page-loaded');

    console.log(`   URL: ${page.url()}`);
    console.log(`   Title: ${await page.title()}`);

    // Scroll to load any lazy content
    console.log("4️⃣  Scrolling to load content...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(2000);
    await captureStep('after-scroll');

    // Comprehensive alert search
    console.log("5️⃣  Searching for alerts and messages...");
    const findings = await page.evaluate(() => {
      const results = {
        alerts: [],
        ansibleMentions: [],
        aapMentions: [],
        deprecationMentions: [],
        allText: document.body.textContent
      };

      // Find all alerts
      const alertSelectors = [
        '[role="alert"]',
        '.pf-c-alert', '.pf-v5-c-alert', '.pf-v6-c-alert',
        '[class*="alert"]', '[class*="Alert"]',
        '[class*="banner"]', '[class*="Banner"]',
        '[class*="message"]', '[class*="Message"]',
        '.pf-c-empty-state', '.pf-v5-c-empty-state', '.pf-v6-c-empty-state'
      ];

      alertSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            const text = el.textContent.trim();
            if (text.length > 10) {
              results.alerts.push({
                text: text,
                className: el.className,
                tagName: el.tagName,
                selector: selector
              });
            }
          }
        });
      });

      // Search for Ansible/AAP/deprecation mentions
      const textContent = document.body.textContent.toLowerCase();
      if (textContent.includes('ansible')) {
        const regex = /ansible[^.!?]{0,200}[.!?]/gi;
        results.ansibleMentions = (document.body.textContent.match(regex) || []);
      }
      if (textContent.includes('aap')) {
        const regex = /aap[^.!?]{0,200}[.!?]/gi;
        results.aapMentions = (document.body.textContent.match(regex) || []);
      }
      if (textContent.includes('deprecat')) {
        const regex = /deprecat[^.!?]{0,200}[.!?]/gi;
        results.deprecationMentions = (document.body.textContent.match(regex) || []);
      }

      // Deduplicate alerts
      const seen = new Set();
      results.alerts = results.alerts.filter(alert => {
        if (seen.has(alert.text)) return false;
        seen.add(alert.text);
        return true;
      });

      return results;
    });

    console.log(`\n   Found ${findings.alerts.length} unique alerts/messages`);
    console.log(`   Ansible mentions: ${findings.ansibleMentions.length}`);
    console.log(`   AAP mentions: ${findings.aapMentions.length}`);
    console.log(`   Deprecation mentions: ${findings.deprecationMentions.length}\n`);

    if (findings.alerts.length > 0) {
      console.log("   📋 Alerts found:");
      findings.alerts.forEach((alert, idx) => {
        console.log(`\n   ${idx + 1}. [${alert.tagName}] ${alert.selector}`);
        console.log(`      ${alert.text.substring(0, 150)}...`);
      });
    }

    if (findings.ansibleMentions.length > 0) {
      console.log("\n   🔍 Ansible mentions:");
      findings.ansibleMentions.slice(0, 3).forEach((mention, idx) => {
        console.log(`   ${idx + 1}. ${mention.substring(0, 100)}...`);
      });
    }

    await captureStep('final-state');

    // Save comprehensive summary
    const summary = {
      bug_id: "ACM-30661",
      timestamp: new Date().toISOString(),
      cluster: config.cluster_name,
      url: page.url(),
      title: await page.title(),
      screenshots: screenshots,
      findings: {
        alert_count: findings.alerts.length,
        alerts: findings.alerts,
        ansible_mentions: findings.ansibleMentions,
        aap_mentions: findings.aapMentions,
        deprecation_mentions: findings.deprecationMentions
      },
      validation_status: findings.alerts.length > 0 ? "ALERTS_FOUND" : "NO_ALERTS"
    };

    await fs.writeFile(
      path.join(__dirname, 'final-validation-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Generate report
    const report = `# ACM-30661 Validation Report

**Bug:** Automation alert when AAP is not installed is incorrect
**Date:** ${new Date(summary.timestamp).toLocaleString()}
**Cluster:** ${summary.cluster}

## Environment

- **URL:** ${summary.url}
- **Page Title:** ${summary.title}
- **AAP Status:** Not installed (namespace empty)

## Findings

### Alerts: ${summary.findings.alert_count}

${summary.findings.alerts.map((alert, idx) => `
#### Alert ${idx + 1}

**Element:** \`${alert.tagName}\` matching \`${alert.selector}\`

**Content:**
\`\`\`
${alert.text}
\`\`\`
`).join('\n')}

${summary.findings.alert_count === 0 ? '**No alerts found on the Automation page.**\n' : ''}

### Text Analysis

- **Ansible mentions:** ${summary.findings.ansible_mentions.length}
- **AAP mentions:** ${summary.findings.aap_mentions.length}
- **Deprecation mentions:** ${summary.findings.deprecation_mentions.length}

${summary.findings.ansible_mentions.length > 0 ? `
#### Sample Ansible Mentions
${summary.findings.ansible_mentions.slice(0, 3).map((m, i) => `${i + 1}. ${m}`).join('\n')}
` : ''}

## Evidence

${summary.screenshots.map(s => `${s.step}. **${s.description}** - \`${s.filename}\``).join('\n')}

## Conclusion

${summary.findings.alert_count > 0 ? `
✅ **${summary.findings.alert_count} alert(s) found** on the Automation page.

Review the alerts above to determine if any match the bug description:
- Incorrect information about Ansible workflow deprecation
- Outdated message not reflecting current ACM capabilities
` : `
⚠️ **No alerts found** on the Automation page.

Possible reasons:
1. Bug may be fixed in this ACM version (2.17.0)
2. Alert may be displayed conditionally
3. Alert may appear in a different location
`}

---
Generated: ${new Date(summary.timestamp).toLocaleString()}
`;

    await fs.writeFile(path.join(__dirname, 'FINAL_VALIDATION_REPORT.md'), report);

    console.log("\n✅ Summary: final-validation-summary.json");
    console.log("✅ Report: FINAL_VALIDATION_REPORT.md");
    console.log(`📸 Screenshots: ${screenshots.length}\n`);

    console.log("⏳ Browser open for 30 seconds...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    await browser.close();
    return summary;

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    await captureStep('error').catch(() => {});
    await wait(3000);
    await browser.close();
    throw error;
  }
}

validateACMAutomation()
  .then(summary => {
    console.log("✅ Validation complete!");
    console.log(`Status: ${summary.validation_status}`);
    process.exit(0);
  })
  .catch(error => {
    console.error("❌ Failed:", error.message);
    process.exit(1);
  });
