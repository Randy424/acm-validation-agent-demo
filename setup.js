#!/usr/bin/env node
// ACM Validation Agent - Interactive Setup
// Run this to configure the agent for your environment

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const CONFIG_DIR = path.join(__dirname, 'agent/config');
const USER_CONFIG_PATH = path.join(CONFIG_DIR, 'user-config.json');
const ENV_PATH = path.join(__dirname, '.env');

class SetupWizard {
  constructor() {
    this.config = {
      environment: {},
      cluster: {},
      tools: {},
      jira: {}
    };
  }

  async prompt(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async promptWithDefault(question, defaultValue) {
    const answer = await this.prompt(`${question} [${defaultValue}]: `);
    return answer || defaultValue;
  }

  async promptYesNo(question, defaultYes = true) {
    const defaultAnswer = defaultYes ? 'Y/n' : 'y/N';
    const answer = await this.prompt(`${question} [${defaultAnswer}]: `);
    const normalized = answer.toLowerCase();

    if (!normalized) return defaultYes;
    return normalized === 'y' || normalized === 'yes';
  }

  async checkExistingConfig() {
    try {
      const existingConfig = await fs.readFile(USER_CONFIG_PATH, 'utf8');
      const config = JSON.parse(existingConfig);

      console.log('\n📋 Found existing configuration:');
      console.log(`   Environment: ${config.environment.type}`);
      console.log(`   Cluster: ${config.cluster.name || 'N/A'}`);
      console.log(`   Tools: ${config.tools.browser_automation}`);
      console.log(`   Jira: ${config.jira.enabled ? 'Enabled' : 'Disabled'}\n`);

      const useExisting = await this.promptYesNo('Would you like to use this configuration?', true);

      if (useExisting) {
        console.log('\n✅ Using existing configuration\n');
        return config;
      }

      console.log('\n🔄 Creating new configuration...\n');
      return null;
    } catch (error) {
      // No existing config, proceed with setup
      return null;
    }
  }

  async gatherEnvironmentInfo() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 ENVIRONMENT SETUP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const envType = await this.prompt(
      'Test environment type?\n' +
      '  1) Live OpenShift cluster (recommended)\n' +
      '  2) Local kind cluster\n' +
      'Choose [1/2]: '
    );

    this.config.environment = {
      type: envType === '2' ? 'local-kind' : 'live-cluster',
      timestamp: new Date().toISOString()
    };

    console.log(`\n✓ Environment: ${this.config.environment.type}\n`);
  }

  async gatherClusterCredentials() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 CLUSTER CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (this.config.environment.type === 'live-cluster') {
      this.config.cluster.name = await this.prompt('Cluster name (e.g., "prod-cluster"): ');
      this.config.cluster.username = await this.promptWithDefault('Username', 'kubeadmin');
      this.config.cluster.password = await this.prompt('Password: ');
      this.config.cluster.console_url = await this.prompt('Console URL (e.g., https://console-openshift-console.apps...): ');
      this.config.cluster.api_url = await this.prompt('API URL (optional, press Enter to skip): ');

      if (!this.config.cluster.api_url) {
        delete this.config.cluster.api_url;
      }

      console.log(`\n✓ Cluster configured: ${this.config.cluster.name}\n`);
    } else {
      this.config.cluster.name = await this.promptWithDefault('Kind cluster name', 'acm-validation');
      this.config.cluster.auto_provision = await this.promptYesNo('Auto-create cluster if not exists?', true);

      console.log(`\n✓ Kind cluster: ${this.config.cluster.name}\n`);
    }
  }

  async gatherToolPreferences() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛠️  TOOL CONFIGURATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const toolChoice = await this.prompt(
      'Browser automation tool?\n' +
      '  1) Stagehand (AI-powered, recommended)\n' +
      '  2) Puppeteer (direct selectors)\n' +
      'Choose [1/2]: '
    );

    this.config.tools.browser_automation = toolChoice === '2' ? 'puppeteer' : 'stagehand';

    if (this.config.tools.browser_automation === 'stagehand') {
      console.log('\n🤖 Stagehand requires an Anthropic API key');
      const apiKey = await this.prompt('Anthropic API key (sk-ant-api03-...): ');
      this.config.tools.anthropic_api_key = apiKey;
    }

    this.config.tools.headless = await this.promptYesNo('Run browser in headless mode?', false);
    this.config.tools.screenshot_quality = await this.promptWithDefault('Screenshot quality (0-100)', '90');

    console.log(`\n✓ Tools configured: ${this.config.tools.browser_automation}\n`);
  }

  async gatherJiraConfig() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 JIRA INTEGRATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const enableJira = await this.promptYesNo('Enable Jira integration?', true);

    if (enableJira) {
      this.config.jira.enabled = true;
      this.config.jira.server = await this.promptWithDefault(
        'Jira server URL',
        'https://redhat.atlassian.net'
      );

      const authMethod = await this.prompt(
        'Authentication method?\n' +
        '  1) API Token (recommended)\n' +
        '  2) Username/Password\n' +
        'Choose [1/2]: '
      );

      if (authMethod === '2') {
        this.config.jira.auth_type = 'basic';
        this.config.jira.username = await this.prompt('Jira username/email: ');
        this.config.jira.password = await this.prompt('Jira password: ');
      } else {
        this.config.jira.auth_type = 'token';
        this.config.jira.api_token = await this.prompt('Jira API token: ');
      }

      this.config.jira.default_project = await this.promptWithDefault('Default project key', 'ACM');

      console.log(`\n✓ Jira integration enabled\n`);
    } else {
      this.config.jira.enabled = false;
      console.log('\n✓ Jira integration disabled\n');
    }
  }

  async saveConfiguration() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 SAVING CONFIGURATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Save user config
    await fs.writeFile(
      USER_CONFIG_PATH,
      JSON.stringify(this.config, null, 2)
    );
    console.log(`✓ Config saved: ${path.relative(process.cwd(), USER_CONFIG_PATH)}`);

    // Save .env file for Stagehand
    if (this.config.tools.browser_automation === 'stagehand') {
      const envContent = `# Anthropic API Key for Stagehand AI browser automation\nANTHROPIC_API_KEY=${this.config.tools.anthropic_api_key}\n`;
      await fs.writeFile(ENV_PATH, envContent);
      console.log(`✓ .env file created: ${path.relative(process.cwd(), ENV_PATH)}`);
    }

    console.log('\n✅ Configuration complete!\n');
  }

  async displayNextSteps() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 NEXT STEPS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('To validate a defect:');
    console.log('  1. Create a bug spec: mkdir test-cases/ACM-XXXXX');
    console.log('  2. Define the bug: edit test-cases/ACM-XXXXX/bug-spec.json');
    console.log('  3. Run validation: node shared/generic-validator.js test-cases/ACM-XXXXX\n');

    console.log('Or use the agent CLI:');
    console.log('  npm run validate:jira ACM-XXXXX\n');

    console.log('For help:');
    console.log('  cat VALIDATOR-GUIDE.md\n');

    console.log('To reconfigure:');
    console.log('  node setup.js\n');
  }

  async run() {
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║  ACM VALIDATION AGENT - SETUP WIZARD  ║');
    console.log('╚═══════════════════════════════════════╝\n');

    console.log('This wizard will configure the validation agent for your environment.\n');
    console.log('⚠️  Your credentials will be stored locally in agent/config/user-config.json');
    console.log('⚠️  This file is gitignored and will not be committed\n');

    const proceed = await this.promptYesNo('Proceed with setup?', true);
    if (!proceed) {
      console.log('\n❌ Setup cancelled\n');
      rl.close();
      return;
    }

    // Check for existing config
    const existingConfig = await this.checkExistingConfig();
    if (existingConfig) {
      this.config = existingConfig;
      await this.displayNextSteps();
      rl.close();
      return;
    }

    // Gather all configuration
    await this.gatherEnvironmentInfo();
    await this.gatherClusterCredentials();
    await this.gatherToolPreferences();
    await this.gatherJiraConfig();

    // Save everything
    await this.saveConfiguration();
    await this.displayNextSteps();

    rl.close();
  }
}

// Run setup wizard
const wizard = new SetupWizard();
wizard.run().catch(error => {
  console.error('\n❌ Setup failed:', error.message);
  rl.close();
  process.exit(1);
});
