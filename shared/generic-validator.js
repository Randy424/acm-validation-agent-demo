// Generic ACM Bug Validator
// Configuration-driven validator that works for any defect based on bug-spec.json
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Stagehand } = require('@browserbasehq/stagehand');
const fs = require('fs').promises;

class GenericValidator {
  constructor(testCaseDir) {
    this.testCaseDir = testCaseDir;
    this.screenshots = [];
    this.stepNumber = 0;
    this.page = null;
    this.stagehand = null;
    this.config = null;
    this.bugSpec = null;
  }

  async loadConfig() {
    // Try to load cluster-config.json from test case dir
    const configPath = path.join(this.testCaseDir, 'cluster-config.json');

    try {
      this.config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    } catch (error) {
      // Fallback to user-config.json
      console.log('   No cluster-config.json found, using user configuration...');
      const userConfigPath = path.join(__dirname, '../agent/config/user-config.json');
      const userConfig = JSON.parse(await fs.readFile(userConfigPath, 'utf8'));

      this.config = {
        cluster_name: userConfig.cluster.name,
        cluster_type: userConfig.environment.type,
        credentials: userConfig.cluster
      };
    }

    const bugSpecPath = path.join(this.testCaseDir, 'bug-spec.json');
    this.bugSpec = JSON.parse(await fs.readFile(bugSpecPath, 'utf8'));
  }

  async init() {
    console.log(`🔍 Starting validation for ${this.bugSpec.jira_ticket}...\n`);
    console.log(`Summary: ${this.bugSpec.summary}\n`);

    this.stagehand = new Stagehand({
      env: 'LOCAL',
      headless: false,
      verbose: 1,
      debugDom: true,
      enableCaching: false,
      model: "anthropic/claude-sonnet-4-20250514",
      browserOptions: {
        args: ['--window-size=1920,1080']
      }
    });

    await this.stagehand.init();
    const pages = Array.from(this.stagehand.ctx.pagesByTarget.values());
    this.page = pages[0];

    if (!this.page) {
      throw new Error("Failed to get page from Stagehand");
    }

    await this.page.waitForTimeout(2000);
    console.log(`   Stagehand initialized, browser ready\n`);
  }

  async captureStep(description) {
    this.stepNumber++;
    const filename = path.join(
      this.testCaseDir,
      `${this.bugSpec.jira_ticket}-${this.stepNumber}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`
    );

    try {
      await this.page.waitForTimeout(2000);
      await this.page.screenshot({ path: filename, fullPage: true });
      this.screenshots.push({
        step: this.stepNumber,
        description,
        filename: path.basename(filename)
      });
      console.log(`  📸 ${this.stepNumber}: ${description}`);
    } catch (error) {
      console.log(`  ⚠️  Screenshot failed: ${error.message}`);
    }

    return filename;
  }

  async authenticate() {
    console.log("🔐 Handling authentication...");

    const currentUrl = this.page.url();
    if (!currentUrl.includes('oauth') && !currentUrl.includes('login')) {
      console.log("   Already authenticated\n");
      return;
    }

    console.log("   On OAuth login page");

    const username = this.config.credentials.username;
    const password = this.config.credentials.password;

    // Click auth provider
    await this.stagehand.act("click on the button labeled 'kube:admin'");
    await this.page.waitForTimeout(3000);
    await this.captureStep('provider-selected');

    // Fill credentials
    await this.stagehand.act(`type "${username}" in the username field`);
    await this.stagehand.act(`type "${password}" in the password field`);
    await this.captureStep('credentials-entered');

    // Submit
    await this.stagehand.act("click the login or submit button");
    await this.page.waitForTimeout(6000);
    await this.captureStep('logged-in');
    console.log("   ✅ Authentication complete\n");
  }

  async navigateToTargetPage() {
    const consoleUrl = this.config.credentials.console_url;

    console.log("🧭 Navigating to console...");
    await this.page.goto(consoleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(6000);
    await this.captureStep('console-landing');

    await this.authenticate();

    // Navigate based on bug spec environment
    if (this.bugSpec.environment?.component) {
      const component = this.bugSpec.environment.component;
      console.log(`📍 Navigating to ${component}...`);

      // Map component to navigation instruction
      const navMap = {
        'Cluster Pools': 'navigate to Cluster pools under Infrastructure or Clusters',
        'Automation': 'navigate to Automation under Infrastructure',
        'Clusters': 'navigate to Clusters under Infrastructure',
        'Applications': 'navigate to Applications',
        'Governance': 'navigate to Governance'
      };

      const navInstruction = navMap[component];

      if (navInstruction) {
        try {
          await this.stagehand.act(navInstruction);
          await this.page.waitForTimeout(5000);
        } catch (navError) {
          console.log("   AI navigation failed, using direct URL");
          // Fallback URL map
          const urlMap = {
            'Cluster Pools': '/multicloud/infrastructure/clusters/clusterpools',
            'Automation': '/multicloud/infrastructure/automations',
            'Clusters': '/multicloud/infrastructure/clusters',
            'Applications': '/multicloud/applications',
            'Governance': '/multicloud/governance'
          };

          const targetUrl = urlMap[component];
          if (targetUrl) {
            await this.page.goto(`${consoleUrl}${targetUrl}`, {
              waitUntil: 'domcontentloaded'
            });
            await this.page.waitForTimeout(5000);
          }
        }

        await this.captureStep(`${component.toLowerCase().replace(/\s+/g, '-')}-page`);
      }
    }
  }

  async executeValidation() {
    const validationType = this.bugSpec.validation_type || 'standard';

    switch (validationType) {
      case 'zoom-test':
        await this.executeZoomTest();
        break;
      case 'alert-check':
        await this.executeAlertCheck();
        break;
      case 'ui-element':
        await this.executeUIElementCheck();
        break;
      default:
        await this.executeStandardValidation();
    }
  }

  async executeZoomTest() {
    console.log("🔍 Executing zoom validation...\n");

    const zoomLevels = this.bugSpec.zoom_levels || [50, 75, 100, 125, 150, 200];
    const results = [];

    for (const zoomLevel of zoomLevels) {
      console.log(`   Testing ${zoomLevel}% zoom...`);

      await this.page.evaluate((zoom) => {
        document.body.style.zoom = `${zoom}%`;
      }, zoomLevel);

      await this.page.waitForTimeout(3000);
      await this.captureStep(`zoom-${zoomLevel}pct`);

      const dimensions = await this.page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
      }));

      results.push({
        zoom_level: `${zoomLevel}%`,
        page_dimensions: dimensions,
        screenshot: `${this.bugSpec.jira_ticket}-${this.stepNumber}-zoom-${zoomLevel}pct.png`
      });

      console.log(`      Page size: ${dimensions.width}x${dimensions.height}`);
    }

    // Reset zoom
    await this.page.evaluate(() => {
      document.body.style.zoom = '100%';
    });

    return { zoom_results: results };
  }

  async executeAlertCheck() {
    console.log("⚠️  Executing alert check...\n");

    const alertInfo = await this.stagehand.extract({
      instruction: "Find all alert messages on this page, especially warnings, errors, or informational alerts",
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

    await this.captureStep('alerts-extracted');

    return { alerts: alertInfo.alerts || [] };
  }

  async executeUIElementCheck() {
    console.log("🎯 Executing UI element check...\n");

    // Execute steps from bug spec
    if (this.bugSpec.steps_to_reproduce) {
      for (const step of this.bugSpec.steps_to_reproduce) {
        console.log(`   Step ${step.step}: ${step.action}`);

        // Convert step action to AI instruction
        await this.stagehand.act(step.action);
        await this.page.waitForTimeout(2000);
        await this.captureStep(`step-${step.step}`);
      }
    }

    return { steps_completed: this.bugSpec.steps_to_reproduce?.length || 0 };
  }

  async executeStandardValidation() {
    console.log("📋 Executing standard validation...\n");

    // Take final screenshot
    await this.captureStep('validation-complete');

    return { validation_type: 'standard' };
  }

  async generateReport(validationResults) {
    const summary = {
      bug_id: this.bugSpec.jira_ticket,
      summary: this.bugSpec.summary,
      timestamp: new Date().toISOString(),
      cluster: this.config.cluster_name,
      url: this.page.url(),
      validation_method: "Generic Validator - Stagehand AI (Claude Sonnet 4)",
      validation_type: this.bugSpec.validation_type || 'standard',
      screenshots: this.screenshots,
      results: validationResults,
      findings: {
        total_screenshots: this.screenshots.length,
        bug_spec: this.bugSpec
      }
    };

    const summaryPath = path.join(this.testCaseDir, `${this.bugSpec.jira_ticket}-validation-summary.json`);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    const report = this.buildMarkdownReport(summary);
    const reportPath = path.join(this.testCaseDir, `${this.bugSpec.jira_ticket}-VALIDATION-REPORT.md`);
    await fs.writeFile(reportPath, report);

    console.log(`\n✅ Validation complete!`);
    console.log(`📸 Screenshots: ${this.screenshots.length}`);
    console.log(`📋 Report: ${path.basename(reportPath)}`);
    console.log(`📊 Summary: ${path.basename(summaryPath)}\n`);

    return summary;
  }

  buildMarkdownReport(summary) {
    let report = `# ${summary.bug_id} Validation Report\n\n`;
    report += `## Bug Information\n`;
    report += `- **Jira Ticket**: ${summary.bug_id}\n`;
    report += `- **Summary**: ${summary.summary}\n`;
    report += `- **Cluster**: ${summary.cluster}\n`;
    report += `- **Validation Date**: ${summary.timestamp}\n`;
    report += `- **Validation Type**: ${summary.validation_type}\n\n`;

    report += `## Test Results\n`;
    report += `- **Screenshots Captured**: ${summary.findings.total_screenshots}\n`;
    report += `- **Current URL**: ${summary.url}\n\n`;

    if (summary.results && summary.results.zoom_results) {
      report += `## Zoom Test Results\n\n`;
      summary.results.zoom_results.forEach((result) => {
        report += `### ${result.zoom_level} Zoom\n`;
        report += `- **Screenshot**: ${result.screenshot}\n`;
        report += `- **Page Dimensions**: ${result.page_dimensions.width}x${result.page_dimensions.height}\n\n`;
      });
    }

    if (summary.results && summary.results.alerts) {
      report += `## Alerts Found\n\n`;
      summary.results.alerts.forEach((alert, idx) => {
        report += `### Alert ${idx + 1}\n`;
        report += `- **Title**: ${alert.title}\n`;
        report += `- **Message**: ${alert.message}\n`;
        report += `- **Type**: ${alert.type || 'N/A'}\n\n`;
      });
    }

    report += `## Evidence\n\n`;
    summary.screenshots.forEach(shot => {
      report += `- ${shot.filename} - ${shot.description}\n`;
    });

    report += `\n## Next Steps\n\n`;
    report += `1. Review all screenshots for visual evidence\n`;
    report += `2. Compare findings against expected behavior\n`;
    report += `3. Update Jira ticket with validation results\n`;

    return report;
  }

  async run() {
    try {
      await this.loadConfig();
      await this.init();
      await this.navigateToTargetPage();

      const validationResults = await this.executeValidation();

      await this.generateReport(validationResults);

      console.log("⏳ Keeping browser open for 20 seconds for review...");
      await this.page.waitForTimeout(20000);

      await this.stagehand.close();
      return 0;

    } catch (error) {
      console.error("\n❌ Error:", error.message);
      console.error(error.stack);

      if (this.page) {
        await this.captureStep('error').catch(() => {});
      }

      if (this.stagehand) {
        await this.stagehand.close();
      }

      return 1;
    }
  }
}

// CLI execution
if (require.main === module) {
  const testCaseDir = process.argv[2] || process.cwd();

  const validator = new GenericValidator(testCaseDir);
  validator.run().then(exitCode => {
    process.exit(exitCode);
  });
}

module.exports = GenericValidator;
