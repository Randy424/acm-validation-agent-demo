/**
 * Live Cluster Validator
 *
 * Validates bugs on existing OpenShift/ACM clusters
 * Uses Stagehand AI for intelligent browser automation
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class LiveClusterValidator {
  constructor(config) {
    this.config = config;
    this.testCaseDir = path.join(__dirname, '../../test-cases/case-1-live-cluster');
  }

  /**
   * Run validation on live cluster
   */
  async run() {
    console.log('🌐 Live Cluster Validation\n');

    // Step 1: Prepare cluster configuration
    await this.prepareClusterConfig();

    // Step 2: Prepare bug specification
    await this.prepareBugSpec();

    // Step 3: Run Stagehand validator
    console.log('🤖 Starting AI-powered validation with Stagehand...\n');
    await this.runValidator();

    // Step 4: Collect results
    await this.collectResults();

    console.log('\n✅ Live cluster validation complete!');
  }

  /**
   * Prepare cluster configuration file
   */
  async prepareClusterConfig() {
    console.log('📝 Preparing cluster configuration...');

    const clusterConfig = {
      cluster_name: this.config.cluster.name || 'target-cluster',
      cluster_type: 'openshift',
      credentials: {
        username: this.config.cluster.username,
        password: this.config.cluster.password,
        api_url: this.config.cluster.api_url,
        console_url: this.config.cluster.console_url
      }
    };

    const configPath = path.join(this.testCaseDir, 'cluster-config.json');
    await fs.writeFile(configPath, JSON.stringify(clusterConfig, null, 2));

    console.log(`   ✓ Cluster config written to: ${path.basename(configPath)}\n`);
  }

  /**
   * Prepare bug specification
   */
  async prepareBugSpec() {
    console.log('📋 Preparing bug specification...');

    let bugSpec;

    if (this.config.bug_spec) {
      // Load from file
      const specPath = path.resolve(this.config.bug_spec);
      bugSpec = JSON.parse(await fs.readFile(specPath, 'utf8'));
    } else if (this.config.bug) {
      // Use inline bug definition
      bugSpec = this.config.bug;
    } else {
      throw new Error('No bug specification provided');
    }

    const specPath = path.join(this.testCaseDir, 'bug-spec.json');
    await fs.writeFile(specPath, JSON.stringify(bugSpec, null, 2));

    console.log(`   ✓ Bug spec written: ${bugSpec.jira_ticket || 'inline'}\n`);
  }

  /**
   * Run the Stagehand validator
   */
  async runValidator() {
    const scriptPath = path.join(this.testCaseDir, 'acm-stagehand-validator.js');

    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        cwd: this.testCaseDir,
        stdio: 'inherit',
        env: { ...process.env }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Validator exited with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Collect and display results
   */
  async collectResults() {
    console.log('\n📊 Collecting validation results...\n');

    const summaryPath = path.join(this.testCaseDir, 'stagehand-validation-summary.json');

    try {
      const summary = JSON.parse(await fs.readFile(summaryPath, 'utf8'));

      console.log('   Results Summary:');
      console.log(`   ✓ Bug ID: ${summary.bug_id}`);
      console.log(`   ✓ Cluster: ${summary.cluster}`);
      console.log(`   ✓ Screenshots: ${summary.screenshots?.length || 0}`);
      console.log(`   ✓ Alerts found: ${summary.findings?.alert_count || summary.alerts?.length || 0}`);

      // Show evidence files
      console.log('\n   Evidence Files:');
      const files = await fs.readdir(this.testCaseDir);
      const evidenceFiles = files.filter(f =>
        f.endsWith('.png') ||
        f.endsWith('.json') ||
        f.endsWith('REPORT.md')
      );

      evidenceFiles.forEach(file => {
        console.log(`   - ${file}`);
      });

    } catch (error) {
      console.log('   ⚠️  Could not read summary file');
      console.log(`   Check ${this.testCaseDir} for results`);
    }
  }
}

module.exports = LiveClusterValidator;
