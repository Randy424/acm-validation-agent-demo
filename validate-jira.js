#!/usr/bin/env node
// ACM Validation Agent - Validate from Jira
// Fetches bug from Jira and runs validation

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const USER_CONFIG_PATH = path.join(__dirname, 'agent/config/user-config.json');
const TEST_CASES_DIR = path.join(__dirname, 'test-cases');

class JiraValidator {
  constructor(jiraTicket) {
    this.jiraTicket = jiraTicket;
    this.config = null;
    this.testCaseDir = path.join(TEST_CASES_DIR, jiraTicket);
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(USER_CONFIG_PATH, 'utf8');
      this.config = JSON.parse(configData);

      if (!this.config.jira || !this.config.jira.enabled) {
        throw new Error('Jira integration is not enabled. Run "node setup.js" to configure.');
      }

      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Configuration not found. Please run "node setup.js" first.');
      }
      throw error;
    }
  }

  async fetchJiraIssue() {
    console.log(`\n🎫 Fetching ${this.jiraTicket} from Jira...\n`);

    const jiraApiCmd = this.config.jira.use_cli
      ? `jira-api view ${this.jiraTicket}`
      : this.buildCurlCommand();

    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', jiraApiCmd], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to fetch Jira issue: ${stderr}`));
        } else {
          try {
            // Try to parse the output
            const issueData = this.parseJiraOutput(stdout);
            resolve(issueData);
          } catch (parseError) {
            reject(new Error(`Failed to parse Jira response: ${parseError.message}`));
          }
        }
      });
    });
  }

  buildCurlCommand() {
    const { server, auth_type, api_token, username, password } = this.config.jira;

    let authHeader;
    if (auth_type === 'token') {
      const token = api_token || process.env.JIRA_API_TOKEN;
      const emailOrUser = username || process.env.JIRA_EMAIL || process.env.USER + '@redhat.com';
      const base64Auth = Buffer.from(`${emailOrUser}:${token}`).toString('base64');
      authHeader = `Authorization: Basic ${base64Auth}`;
    } else {
      const base64Auth = Buffer.from(`${username}:${password}`).toString('base64');
      authHeader = `Authorization: Basic ${base64Auth}`;
    }

    return `curl -s "${server}/rest/api/2/issue/${this.jiraTicket}?expand=attachment" -H "${authHeader}"`;
  }

  parseJiraOutput(output) {
    // If output looks like JSON, parse it
    if (output.trim().startsWith('{')) {
      const json = JSON.parse(output);

      // Extract image attachments (only available from REST API with expand=attachment)
      let attachments = [];
      if (json.fields && json.fields.attachment) {
        attachments = json.fields.attachment
          .filter(att => att.mimeType && att.mimeType.startsWith('image/'))
          .map(att => ({
            filename: att.filename,
            url: att.content,
            mimeType: att.mimeType,
            size: att.size
          }));
      }

      return {
        key: json.key,
        summary: json.fields?.summary,
        description: json.fields?.description,
        status: json.fields?.status?.name,
        component: json.fields?.components?.[0]?.name,
        priority: json.fields?.priority?.name,
        attachments
      };
    }

    // Otherwise assume it's formatted output from jira-api tool
    const lines = output.split('\n');
    const issue = {};

    for (const line of lines) {
      if (line.startsWith('KEY:')) issue.key = line.substring(4).trim();
      if (line.startsWith('SUMMARY:')) issue.summary = line.substring(8).trim();
      if (line.startsWith('STATUS:')) issue.status = line.substring(7).trim();
      if (line.includes('DESCRIPTION:')) {
        const descIndex = lines.indexOf(line);
        issue.description = lines.slice(descIndex + 1).join('\n').trim();
      }
    }

    // CLI tool doesn't provide attachments
    issue.attachments = [];

    return issue;
  }

  async fetchJiraAttachments(attachments) {
    if (!attachments || attachments.length === 0) {
      console.log('   ℹ No image attachments found\n');
      return [];
    }

    console.log(`\n📸 Downloading ${attachments.length} screenshot(s)...\n`);

    const { server, auth_type, api_token, username, password } = this.config.jira;
    let authHeader;

    if (auth_type === 'token') {
      const token = api_token || process.env.JIRA_API_TOKEN;
      const emailOrUser = username || process.env.JIRA_EMAIL || process.env.USER + '@redhat.com';
      const base64Auth = Buffer.from(`${emailOrUser}:${token}`).toString('base64');
      authHeader = `Authorization: Basic ${base64Auth}`;
    } else {
      const base64Auth = Buffer.from(`${username}:${password}`).toString('base64');
      authHeader = `Authorization: Basic ${base64Auth}`;
    }

    const downloadedFiles = [];

    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      const ext = path.extname(attachment.filename) || '.png';
      const filename = `bug-screenshot-${i + 1}${ext}`;
      const filepath = path.join(this.testCaseDir, filename);

      console.log(`   Downloading: ${attachment.filename} → ${filename}`);
      console.log(`   URL: ${attachment.url}`);

      const curlCmd = `curl -sL "${attachment.url}" -H "${authHeader}" -o "${filepath}"`;

      await new Promise((resolve, reject) => {
        const child = spawn('bash', ['-c', curlCmd], {
          stdio: ['inherit', 'pipe', 'pipe']
        });

        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0) {
            downloadedFiles.push({
              original_filename: attachment.filename,
              saved_as: filename,
              path: filepath,
              size: attachment.size
            });
            resolve();
          } else {
            console.error(`   ⚠ Failed to download ${attachment.filename}`);
            if (stderr) {
              console.error(`   Error: ${stderr.substring(0, 200)}`);
            }
            resolve(); // Continue with other attachments
          }
        });

        child.on('error', reject);
      });
    }

    console.log(`   ✓ Downloaded ${downloadedFiles.length} screenshot(s)\n`);
    return downloadedFiles;
  }

  inferValidationType(issue) {
    const summaryLower = issue.summary.toLowerCase();
    const descLower = (issue.description || '').toLowerCase();

    if (summaryLower.includes('zoom') || descLower.includes('zoom')) {
      return 'zoom-test';
    }

    if (summaryLower.includes('alert') || descLower.includes('alert')) {
      return 'alert-check';
    }

    if (summaryLower.includes('button') || summaryLower.includes('form') ||
        summaryLower.includes('field') || summaryLower.includes('ui')) {
      return 'ui-element';
    }

    return 'standard';
  }

  inferUIElement(issue) {
    const summary = issue.summary || '';
    const description = issue.description || '';
    const combined = `${summary} ${description}`.toLowerCase();

    // Try to extract UI element from summary
    // Example: "cluster claim button not re-positioned" -> "Claim cluster" button
    if (combined.includes('cluster claim button') || combined.includes('claim cluster')) {
      return {
        name: 'Claim cluster',
        type: 'button'
      };
    }

    // Generic button extraction
    const buttonMatch = combined.match(/([a-z\s]+)\s+button/i);
    if (buttonMatch) {
      return {
        name: buttonMatch[1].trim(),
        type: 'button'
      };
    }

    return null;
  }

  inferStepsToReproduce(issue) {
    const summary = issue.summary || '';
    const description = issue.description || '';
    const combined = `${summary} ${description}`.toLowerCase();
    const steps = [];

    // Check for cluster pool related bugs
    if (combined.includes('cluster pool')) {
      steps.push({
        step: 1,
        action: 'navigate to Cluster pools tab under Infrastructure or Clusters',
        critical: true,
        note: 'Must navigate to cluster pools page'
      });

      // If it mentions "cluster claim" or details page, add step to open a pool
      if (combined.includes('claim') || combined.includes('detail')) {
        steps.push({
          step: 2,
          action: 'click on any cluster pool name to open the cluster pool details page',
          critical: true,
          note: 'This should navigate to a specific pool\'s detail page where the Claim cluster button exists'
        });
      }
    }

    return steps.length > 0 ? steps : null;
  }

  async createBugSpec(issueData, screenshots = []) {
    console.log(`📋 Creating bug specification for ${issueData.key}...\n`);

    const validationType = this.inferValidationType(issueData);
    const uiElement = this.inferUIElement(issueData);
    const stepsToReproduce = this.inferStepsToReproduce(issueData);

    const bugSpec = {
      jira_ticket: issueData.key,
      summary: issueData.summary,
      description: issueData.description || 'No description provided',
      validation_type: validationType,
      environment: {
        component: issueData.component || 'Unknown',
        status: issueData.status,
        priority: issueData.priority
      }
    };

    // Add UI element if inferred
    if (uiElement) {
      bugSpec.ui_element = uiElement;
    }

    // Add reproduction steps if inferred
    if (stepsToReproduce) {
      bugSpec.steps_to_reproduce = stepsToReproduce;
      bugSpec.validation_instructions = {
        navigation: stepsToReproduce.length > 1
          ? "After completing reproduction steps, you should be on the correct page to test the UI element."
          : "Navigate to the page mentioned in the reproduction steps."
      };
    }

    // Add type-specific config
    if (validationType === 'zoom-test') {
      bugSpec.zoom_levels = [50, 75, 100, 125, 150, 200];
    }

    // Add screenshots if available
    if (screenshots && screenshots.length > 0) {
      bugSpec.screenshots = screenshots.map(s => ({
        filename: s.saved_as,
        original_filename: s.original_filename
      }));
    }

    // Create test case directory
    await fs.mkdir(this.testCaseDir, { recursive: true });

    // Save bug spec
    const bugSpecPath = path.join(this.testCaseDir, 'bug-spec.json');
    await fs.writeFile(bugSpecPath, JSON.stringify(bugSpec, null, 2));

    console.log(`   ✓ Bug spec created: ${path.relative(process.cwd(), bugSpecPath)}`);

    return bugSpec;
  }

  async createClusterConfig() {
    console.log(`🔐 Creating cluster configuration...\n`);

    const clusterConfig = {
      cluster_name: this.config.cluster.name,
      cluster_type: this.config.environment.type === 'local-kind' ? 'kind' : 'openshift',
      credentials: this.config.cluster
    };

    const clusterConfigPath = path.join(this.testCaseDir, 'cluster-config.json');
    await fs.writeFile(clusterConfigPath, JSON.stringify(clusterConfig, null, 2));

    console.log(`   ✓ Cluster config created: ${path.relative(process.cwd(), clusterConfigPath)}\n`);
  }

  async runValidation() {
    console.log(`🚀 Starting validation...\n`);

    const validatorPath = path.join(__dirname, 'shared/generic-validator.js');

    return new Promise((resolve, reject) => {
      const child = spawn('node', [validatorPath, this.testCaseDir], {
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Validation failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  async run() {
    try {
      console.log('\n╔═══════════════════════════════════════╗');
      console.log('║   ACM VALIDATION - JIRA INTEGRATION   ║');
      console.log('╚═══════════════════════════════════════╝\n');

      // Load config
      await this.loadConfig();
      console.log(`✓ Configuration loaded\n`);

      // Fetch Jira issue
      const issueData = await this.fetchJiraIssue();
      console.log(`✓ Jira issue fetched: ${issueData.summary}\n`);

      // Download attachments
      const screenshots = await this.fetchJiraAttachments(issueData.attachments);

      // Create bug spec
      await this.createBugSpec(issueData, screenshots);

      // Create cluster config
      await this.createClusterConfig();

      // Run validation
      await this.runValidation();

      console.log('\n✅ Validation complete!\n');
      console.log(`📁 Results: test-cases/${this.jiraTicket}/\n`);

      return 0;

    } catch (error) {
      console.error(`\n❌ Error: ${error.message}\n`);
      return 1;
    }
  }
}

// CLI
const jiraTicket = process.argv[2];

if (!jiraTicket) {
  console.error('\n❌ Usage: node validate-jira.js ACM-XXXXX\n');
  process.exit(1);
}

const validator = new JiraValidator(jiraTicket);
validator.run().then(exitCode => {
  process.exit(exitCode);
});
