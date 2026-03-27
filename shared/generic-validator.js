// Generic ACM Bug Validator
// Configuration-driven validator that works for any defect based on bug-spec.json
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Stagehand } = require('@browserbasehq/stagehand');
const fs = require('fs').promises;
const { ConsoleKnowledgeHelper } = require('./console-knowledge-helper');
const { ClaudeInstructionGenerator } = require('./claude-instruction-generator');
const { StagehandInstructionBuilder } = require('./stagehand-instruction-builder');

class GenericValidator {
  constructor(testCaseDir) {
    this.testCaseDir = testCaseDir;
    this.screenshots = [];
    this.bugScreenshots = [];
    this.stepNumber = 0;
    this.page = null;
    this.stagehand = null;
    this.config = null;
    this.bugSpec = null;
    this.consoleKnowledge = new ConsoleKnowledgeHelper();
    this.instructionGenerator = new ClaudeInstructionGenerator();
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

    // Load console knowledge base
    await this.consoleKnowledge.load();

    // Load bug reporter's screenshots if available
    this.bugScreenshots = [];
    if (this.bugSpec.screenshots && this.bugSpec.screenshots.length > 0) {
      console.log(`   📸 Found ${this.bugSpec.screenshots.length} screenshot(s) from bug report`);
      for (const screenshot of this.bugSpec.screenshots) {
        const screenshotPath = path.join(this.testCaseDir, screenshot.filename);
        try {
          await fs.access(screenshotPath);
          this.bugScreenshots.push({
            filename: screenshot.filename,
            path: screenshotPath,
            original_filename: screenshot.original_filename
          });
          console.log(`      ✓ ${screenshot.filename} (from ${screenshot.original_filename})`);
        } catch (err) {
          console.log(`      ⚠️  Screenshot not found: ${screenshot.filename}`);
        }
      }
    }
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
        args: [
          '--window-size=1920,1080',
          '--window-position=0,0',
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox'
        ]
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

  /**
   * Score an element against search terms to find the best match
   * @param {Element} element - DOM element to score
   * @param {Array<string>} textSearchTerms - Terms to match against
   * @returns {number} Score (higher is better match)
   */
  scoreElement(element, textSearchTerms) {
    const elText = element.textContent.trim().toLowerCase();
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    const combinedText = `${elText} ${ariaLabel}`;

    let bestScore = 0;

    textSearchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      let score = 0;

      // Exact match (highest priority)
      if (elText === termLower || ariaLabel === termLower) {
        score = 1000;
      }
      // Exact word match (high priority)
      else if (elText.split(/\s+/).includes(termLower) || combinedText === termLower) {
        score = 500;
      }
      // Contains all words from search term (good match)
      else if (termLower.split(/\s+/).every(word => combinedText.includes(word))) {
        score = 300;
      }
      // Contains search term (okay match)
      else if (combinedText.includes(termLower)) {
        score = 100;
      }
      // Search term contains element text (weak match)
      else if (termLower.includes(elText) && elText.length > 3) {
        score = 50;
      }

      // Bonus for shorter text (more specific)
      if (score > 0 && elText.length < 50) {
        score += (50 - elText.length) / 10;
      }

      if (score > bestScore) {
        bestScore = score;
      }
    });

    return bestScore;
  }

  async highlightIssues(issues, zoomLevel) {
    console.log(`      🎨 Highlighting ${issues.length} issue(s)...`);

    for (const issue of issues) {
      try {
        // Use verified selector if available (from pre-zoom location step)
        if (issue.verifiedSelector) {
          console.log(`         Using verified selector: ${issue.verifiedSelector}`);

          const found = await this.page.evaluate((selector, severity) => {
            try {
              const el = document.querySelector(selector);
              if (!el) return false;

              const color = severity === 'target' ? '#0066cc' :
                           severity === 'critical' ? '#ff0000' :
                           severity === 'major' ? '#ff9900' : '#ffcc00';

              el.style.outline = `4px solid ${color}`;
              el.style.boxShadow = `0 0 15px ${color}99`;
              el.style.position = 'relative';
              el.style.zIndex = '999999';
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });

              return true;
            } catch (e) {
              return false;
            }
          }, issue.verifiedSelector, issue.severity || 'target');

          if (found) {
            console.log(`         ✅ Highlighted using verified selector`);
          } else {
            console.log(`         ⚠️  Verified selector didn't match`);
          }
          continue;
        }

        // Fallback: scored matching (find AND highlight in one call)
        console.log(`         Using scored text matching...`);
        const result = await this.page.evaluate((issue) => {
          // Use the same scored matching logic we use for discovery
          const htmlSelector = issue.htmlTags && issue.htmlTags.length > 0
            ? issue.htmlTags.join(', ')
            : 'button, a, input, select, [role="button"]';

          const candidates = document.querySelectorAll(htmlSelector);
          const textTerms = issue.textSearchTerms || [];

          let bestMatch = null;
          let bestScore = 0;

          Array.from(candidates).forEach(el => {
            const elText = el.textContent.trim().toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

            textTerms.forEach(term => {
              const termLower = term.toLowerCase();
              let score = 0;

              // Exact text match
              if (elText === termLower || ariaLabel === termLower) score = 1000;
              // Exact word match
              else if (elText.split(/\s+/).includes(termLower)) score = 500;
              // All words present
              else if (termLower.split(/\s+/).every(word => elText.includes(word))) score = 300;
              // Contains term
              else if (elText.includes(termLower) || ariaLabel.includes(termLower)) score = 100;

              // Bonus for shorter text (more specific)
              if (score > 0 && elText.length < 50) {
                score += (50 - elText.length) / 10;
              }

              if (score > bestScore) {
                bestScore = score;
                bestMatch = el;
              }
            });
          });

          if (!bestMatch) {
            return { found: false };
          }

          // Apply highlight styling
          const severity = issue.severity || 'target';
          const color = severity === 'target' ? '#0066cc' :
                       severity === 'critical' ? '#ff0000' :
                       severity === 'major' ? '#ff9900' : '#ffcc00';

          bestMatch.style.outline = `6px solid ${color}`;
          bestMatch.style.outlineOffset = '4px';
          bestMatch.style.boxShadow = `0 0 25px ${color}`;
          bestMatch.style.position = 'relative';
          bestMatch.style.zIndex = '999999';

          // Scroll into view
          bestMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });

          return {
            found: true,
            text: bestMatch.textContent.trim().substring(0, 50),
            tagName: bestMatch.tagName,
            score: bestScore
          };
        }, issue);

        if (result.found) {
          console.log(`         ✓ Highlighted: "${result.text}" (score: ${result.score})`);
        } else {
          console.log(`         ⚠️  Could not find element`);
        }
      } catch (err) {
        console.log(`         ❌ Error highlighting: ${err.message}`);
      }
    }

    await this.page.waitForTimeout(2000);
  }

  // Old page.evaluate version - keeping as backup
  async highlightIssuesOld(issues, zoomLevel) {
    await this.page.evaluate((issuesData, zoom) => {
      // Inject CSS for highlights if not already present
      if (!document.getElementById('validation-highlights-style')) {
        const style = document.createElement('style');
        style.id = 'validation-highlights-style';
        style.textContent = `
          .validation-highlight-target {
            outline: 4px solid #0066cc !important;
            box-shadow: 0 0 15px rgba(0, 102, 204, 0.6) !important;
            position: relative !important;
            z-index: 999998 !important;
          }
          .validation-highlight-target::before {
            content: "🎯 TESTING THIS ELEMENT" !important;
            position: absolute !important;
            top: -25px !important;
            left: 0 !important;
            background: #0066cc !important;
            color: white !important;
            padding: 4px 8px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            border-radius: 3px !important;
            z-index: 1000000 !important;
          }
          .validation-highlight-critical {
            outline: 4px solid #ff0000 !important;
            box-shadow: 0 0 15px rgba(255, 0, 0, 0.6) !important;
            position: relative !important;
            z-index: 999999 !important;
          }
          .validation-highlight-critical::before {
            content: "🔴 CRITICAL ISSUE" !important;
            position: absolute !important;
            top: -25px !important;
            left: 0 !important;
            background: #ff0000 !important;
            color: white !important;
            padding: 4px 8px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            border-radius: 3px !important;
            z-index: 1000000 !important;
          }
          .validation-highlight-major {
            outline: 4px solid #ff9900 !important;
            box-shadow: 0 0 15px rgba(255, 153, 0, 0.6) !important;
            position: relative !important;
            z-index: 999999 !important;
          }
          .validation-highlight-major::before {
            content: "🟠 MAJOR ISSUE" !important;
            position: absolute !important;
            top: -25px !important;
            left: 0 !important;
            background: #ff9900 !important;
            color: white !important;
            padding: 4px 8px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            border-radius: 3px !important;
            z-index: 1000000 !important;
          }
          .validation-highlight-minor {
            outline: 3px solid #ffcc00 !important;
            box-shadow: 0 0 10px rgba(255, 204, 0, 0.5) !important;
            position: relative !important;
            z-index: 999999 !important;
          }
          .validation-highlight-minor::before {
            content: "🟡 MINOR ISSUE" !important;
            position: absolute !important;
            top: -25px !important;
            left: 0 !important;
            background: #ffcc00 !important;
            color: black !important;
            padding: 4px 8px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            border-radius: 3px !important;
            z-index: 1000000 !important;
          }
        `;
        document.head.appendChild(style);
      }

      // Highlight each issue
      issuesData.forEach(issue => {
        let element = null;

        // Priority 0: Try known selectors from console knowledge (most reliable)
        if (!element && issue.knownSelectors && issue.knownSelectors.length > 0) {
          for (const selector of issue.knownSelectors) {
            try {
              // Handle :contains() pseudo-selector (jQuery/CSS4, not supported natively)
              if (selector.includes(':contains(')) {
                const match = selector.match(/^([^:]+):contains\(['"](.+)['"]\)$/);
                if (match) {
                  const [_, baseSelector, searchText] = match;
                  const candidates = document.querySelectorAll(baseSelector);
                  element = Array.from(candidates).find(el => {
                    const text = el.textContent.trim();
                    // Direct text match (not nested children)
                    return text === searchText || text.includes(searchText);
                  });
                  if (element) {
                    console.log(`         Found via :contains(): ${selector}`);
                    break;
                  }
                }
              } else {
                // Standard CSS selector
                element = document.querySelector(selector);
                if (element) {
                  console.log(`         Found via selector: ${selector}`);
                  break;
                }
              }
            } catch (e) {
              // Invalid selector
              console.log(`         Invalid selector: ${selector}`);
            }
          }
        }

        // Priority 1: Try CSS selector first (most precise)
        if (!element && issue.css_selector) {
          try {
            element = document.querySelector(issue.css_selector);
          } catch (e) {
            // Invalid selector
          }
        }

        // Priority 2: Structured search using htmlTags + text content
        if (!element && (issue.htmlTags || issue.textSearchTerms)) {
          // Build selector for HTML element types
          const htmlSelector = issue.htmlTags && issue.htmlTags.length > 0
            ? issue.htmlTags.join(', ')
            : 'button, a, input, select, [role="button"], [role="tab"], [role="menuitem"]';

          const candidates = document.querySelectorAll(htmlSelector);

          // Score all candidates to find BEST match using helper method
          const textTerms = issue.textSearchTerms || issue.searchTerms || [];
          if (textTerms.length > 0) {
            let bestMatch = null;
            let bestScore = 0;

            Array.from(candidates).forEach(el => {
              // Use the scoreElement helper - but it's not in browser context
              // So we need to inline a simplified version here
              const elText = el.textContent.trim().toLowerCase();
              const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
              const combinedText = `${elText} ${ariaLabel}`;

              textTerms.forEach(term => {
                const termLower = term.toLowerCase();
                let score = 0;

                if (elText === termLower || ariaLabel === termLower) score = 1000;
                else if (elText.split(/\s+/).includes(termLower) || combinedText === termLower) score = 500;
                else if (termLower.split(/\s+/).every(word => combinedText.includes(word))) score = 300;
                else if (combinedText.includes(termLower)) score = 100;
                else if (termLower.includes(elText) && elText.length > 3) score = 50;

                if (score > 0 && elText.length < 50) {
                  score += (50 - elText.length) / 10;
                }

                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = el;
                }
              });
            });

            if (bestMatch) {
              element = bestMatch;
              console.log(`         Matched with score ${bestScore}: "${element.textContent.trim().substring(0, 30)}"`);
            }
          }

          // Fallback: Search by attributes
          if (!element && issue.attributeSearchTerms && issue.attributeSearchTerms.length > 0) {
            element = Array.from(candidates).find(el => {
              const id = (el.id || '').toLowerCase();
              const classes = (el.className || '').toLowerCase();
              const dataAttrs = Array.from(el.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .map(attr => attr.value.toLowerCase())
                .join(' ');

              const combinedAttrs = `${id} ${classes} ${dataAttrs}`;

              return issue.attributeSearchTerms.some(attrTerm =>
                combinedAttrs.includes(attrTerm.toLowerCase())
              );
            });
          }
        }

        if (element) {
          element.classList.add(`validation-highlight-${issue.severity}`);
          element.setAttribute('data-validation-issue', issue.description);

          // Log what was actually found
          console.log(`         Found and highlighted: "${element.textContent.trim()}" (${element.tagName})`);

          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          console.log(`         ⚠️  Could not find element to highlight: ${issue.element}`);
        }
      });
    }, issues, zoomLevel);

    await this.page.waitForTimeout(2000); // Wait for smooth scroll
  }

  async removeHighlights() {
    await this.page.evaluate(() => {
      // Remove all highlight classes
      const highlighted = document.querySelectorAll('[class*="validation-highlight-"]');
      highlighted.forEach(el => {
        el.classList.remove('validation-highlight-target');
        el.classList.remove('validation-highlight-critical');
        el.classList.remove('validation-highlight-major');
        el.classList.remove('validation-highlight-minor');
        el.removeAttribute('data-validation-issue');
      });

      // Remove style tag
      const style = document.getElementById('validation-highlights-style');
      if (style) {
        style.remove();
      }
    });
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

    // Determine target page from bug spec
    let targetComponent = this.bugSpec.environment?.component;
    let targetUrl = null;

    // If component is generic or not in our map, try to infer from steps_to_reproduce
    if (!targetComponent || targetComponent === 'Console' || targetComponent === 'UI') {
      console.log("   Inferring target page from reproduction steps...");
      const firstStep = this.bugSpec.steps_to_reproduce?.[0];
      if (firstStep?.action) {
        const action = firstStep.action.toLowerCase();
        if (action.includes('cluster pool')) {
          targetComponent = 'Cluster Pools';
        } else if (action.includes('automation')) {
          targetComponent = 'Automation';
        } else if (action.includes('cluster')) {
          targetComponent = 'Clusters';
        } else if (action.includes('application')) {
          targetComponent = 'Applications';
        } else if (action.includes('governance')) {
          targetComponent = 'Governance';
        }
      }
    }

    // Also check if target_page is specified in bug spec
    if (this.bugSpec.target_page) {
      targetUrl = this.bugSpec.target_page.replace('{poolName}', '');
      console.log(`   Target URL from bug spec: ${targetUrl}`);
    }

    if (targetComponent) {
      console.log(`📍 Navigating to ${targetComponent}...`);

      // Map component to navigation instruction
      // Routes sourced from @stolostron/console NavigationPath.tsx
      const navMap = {
        'Cluster Pools': 'navigate to Cluster pools tab under Infrastructure or Clusters',
        'Automation': 'navigate to Automation under Infrastructure',
        'Clusters': 'navigate to Clusters under Infrastructure',
        'Applications': 'navigate to Applications',
        'Governance': 'navigate to Governance',
        'Console': 'stay on the main console dashboard'
      };

      const urlMap = {
        'Cluster Pools': '/multicloud/infrastructure/clusters/pools',
        'Cluster Sets': '/multicloud/infrastructure/clusters/sets',
        'Managed Clusters': '/multicloud/infrastructure/clusters/managed',
        'Discovered Clusters': '/multicloud/infrastructure/clusters/discovered',
        'Placements': '/multicloud/infrastructure/clusters/placements',
        'Automation': '/multicloud/infrastructure/automations',
        'Clusters': '/multicloud/infrastructure/clusters',
        'Applications': '/multicloud/applications',
        'Governance': '/multicloud/governance/policies',
        'Policy Sets': '/multicloud/governance/policy-sets',
        'Credentials': '/multicloud/credentials',
        'Environments': '/multicloud/infrastructure/environments'
      };

      const navInstruction = navMap[targetComponent];
      const fallbackUrl = targetUrl || urlMap[targetComponent];

      if (navInstruction && targetComponent !== 'Console') {
        try {
          console.log(`   Using AI: "${navInstruction}"`);
          await this.stagehand.act(navInstruction);
          await this.page.waitForTimeout(5000);

          // Verify we're on the right page
          const currentUrl = this.page.url();
          console.log(`   Current URL: ${currentUrl}`);

          if (fallbackUrl && !currentUrl.includes(fallbackUrl.split('/').pop())) {
            console.log(`   ⚠️  AI navigation may have failed, using direct URL`);
            await this.page.goto(`${consoleUrl}${fallbackUrl}`, {
              waitUntil: 'domcontentloaded'
            });
            await this.page.waitForTimeout(5000);
          }
        } catch (navError) {
          console.log(`   ❌ AI navigation failed: ${navError.message}`);
          console.log("   Using direct URL fallback");
          if (fallbackUrl) {
            await this.page.goto(`${consoleUrl}${fallbackUrl}`, {
              waitUntil: 'domcontentloaded'
            });
            await this.page.waitForTimeout(5000);
          }
        }

        // Confirm final URL
        const finalUrl = this.page.url();
        console.log(`   ✓ Final URL: ${finalUrl}\n`);
        await this.captureStep(`${targetComponent.toLowerCase().replace(/\s+/g, '-')}-page`);
      }
    } else {
      console.log("   ⚠️  Could not determine target page from bug spec");
      console.log("   Staying on current page\n");
    }
  }

  async executeValidation() {
    const validationType = this.bugSpec.validation_type || 'standard';

    switch (validationType) {
      case 'zoom-test':
        return await this.executeZoomTest();
      case 'alert-check':
        return await this.executeAlertCheck();
      case 'ui-element':
        return await this.executeUIElementCheck();
      default:
        return await this.executeStandardValidation();
    }
  }

  inferTargetElementFromBug() {
    // Extract UI element being tested from bug summary/description
    const summary = this.bugSpec.summary || '';
    const description = this.bugSpec.description || '';
    const combined = `${summary} ${description}`;

    // HTML element keywords that should be used as element type filters
    const htmlElementTypes = {
      button: { tags: ['button', 'a[role="button"]', '[type="button"]'], description: 'button' },
      link: { tags: ['a:not([role="button"])'], description: 'link' },
      input: { tags: ['input', 'textarea'], description: 'input field' },
      select: { tags: ['select'], description: 'dropdown' },
      dropdown: { tags: ['select', '[role="combobox"]', '[role="listbox"]'], description: 'dropdown' },
      checkbox: { tags: ['input[type="checkbox"]'], description: 'checkbox' },
      radio: { tags: ['input[type="radio"]'], description: 'radio button' },
      tab: { tags: ['[role="tab"]', 'button[aria-selected]'], description: 'tab' },
      menu: { tags: ['[role="menu"]', '[role="menuitem"]'], description: 'menu item' },
      modal: { tags: ['[role="dialog"]', '[role="alertdialog"]', '.pf-c-modal'], description: 'modal' },
      dialog: { tags: ['[role="dialog"]', '[role="alertdialog"]'], description: 'dialog' },
      table: { tags: ['table', '[role="table"]'], description: 'table' },
      form: { tags: ['form'], description: 'form' }
    };

    let elementName = null;
    let elementType = null;
    let htmlTags = [];
    let textSearchTerms = [];
    let attributeSearchTerms = [];

    // Priority 1: Look for ui_element in spec (most reliable)
    if (this.bugSpec.ui_element?.name) {
      elementName = this.bugSpec.ui_element.name;
      elementType = this.bugSpec.ui_element.type || 'element';

      console.log(`   🎯 Using element from spec: "${elementName}" (${elementType})`);
    } else {
      // Priority 2: Look for quoted text (often the exact element label)
      const quotedMatch = combined.match(/["']([^"']+)["']/);
      if (quotedMatch) {
        elementName = quotedMatch[1];
        textSearchTerms.push(elementName);
      }

      // Priority 3: Identify HTML element type keywords
      const lowerCombined = combined.toLowerCase();
      for (const [keyword, config] of Object.entries(htmlElementTypes)) {
        if (lowerCombined.includes(keyword)) {
          elementType = config.description;
          htmlTags = config.tags;

          // Extract text before the HTML keyword as the element name
          const regex = new RegExp(`([\\w\\s-]+)\\s+${keyword}`, 'i');
          const typeMatch = combined.match(regex);
          if (typeMatch && !elementName) {
            const candidateName = typeMatch[1].trim()
              .replace(/^(the|a|an)\s+/i, '')
              .replace(/\s+(the|a|an)\s+/gi, ' ')
              .trim();

            elementName = candidateName;
          }
          break;
        }
      }
    }

    // If we have element type, get HTML tags to search
    if (elementType && !htmlTags.length && htmlElementTypes[elementType]) {
      htmlTags = htmlElementTypes[elementType].tags;
    }

    // Build search terms from element name
    if (elementName && elementName !== 'the UI element') {
      // Remove type keywords from name to get pure text content
      let cleanName = elementName;
      for (const keyword of Object.keys(htmlElementTypes)) {
        cleanName = cleanName.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '').trim();
      }

      if (cleanName) {
        textSearchTerms.push(cleanName);

        // Add word reordering for compound names
        const words = cleanName.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 2) {
          textSearchTerms.push(`${words[1]} ${words[0]}`);
        }

        // Also use as potential ID/class search
        const idifiedName = cleanName.toLowerCase().replace(/\s+/g, '-');
        attributeSearchTerms.push(idifiedName);
        attributeSearchTerms.push(cleanName.toLowerCase().replace(/\s+/g, '_'));
      }
    }

    // Fallback
    if (!elementName) {
      elementName = 'the UI element';
      elementType = 'button';
      htmlTags = htmlElementTypes.button.tags;
      textSearchTerms = ['button'];
    }

    // Dedupe
    textSearchTerms = [...new Set(textSearchTerms)];
    attributeSearchTerms = [...new Set(attributeSearchTerms)];

    console.log(`   🎯 Inferred target element: "${elementName}" (${elementType || 'element'})`);
    console.log(`   🏷️  HTML element types: ${htmlTags.join(', ') || 'any'}`);
    console.log(`   📝 Text search terms: ${textSearchTerms.join(', ')}`);
    if (attributeSearchTerms.length) {
      console.log(`   🔖 Attribute search terms: ${attributeSearchTerms.join(', ')}`);
    }

    return {
      name: elementName,
      type: elementType || 'element',
      description: `${elementName} ${elementType || ''}`.trim(),
      htmlTags: htmlTags,
      textSearchTerms: textSearchTerms,
      attributeSearchTerms: attributeSearchTerms,
      // Legacy compatibility
      searchTerms: textSearchTerms
    };
  }

  /**
   * Use Claude to generate optimized element discovery instructions
   * Combines bug context, screenshots, and console knowledge for best results
   */
  async enhanceWithClaude(targetElement, pageName) {
    console.log(`   🤖 Asking Claude for optimized element discovery...`);

    try {
      const consoleKnowledge = this.consoleKnowledge.findElement(pageName, targetElement.name);

      const enhanced = await this.instructionGenerator.generateElementInstructions({
        bugDescription: this.bugSpec.description || '',
        bugSummary: this.bugSpec.summary || '',
        screenshots: this.bugScreenshots.map(s => s.path),
        targetElement: targetElement,
        currentPage: pageName,
        consoleKnowledge: consoleKnowledge
      });

      console.log(`   ✓ Claude generated optimized instructions:`);
      console.log(`     Primary selector: ${enhanced.primarySelector || 'none'}`);
      console.log(`     Fallback selectors: ${enhanced.fallbackSelectors?.length || 0}`);
      console.log(`     Text terms: ${enhanced.textSearchTerms?.length || 0}`);
      console.log(`     Reasoning: ${enhanced.reasoning?.substring(0, 100)}...`);

      return {
        ...targetElement,
        ...enhanced,
        // Merge Claude's suggestions with existing knowledge
        knownSelectors: [
          ...(enhanced.primarySelector ? [enhanced.primarySelector] : []),
          ...(enhanced.fallbackSelectors || []),
          ...(targetElement.knownSelectors || [])
        ],
        textSearchTerms: [
          ...(enhanced.textSearchTerms || []),
          ...(targetElement.textSearchTerms || [])
        ]
      };
    } catch (error) {
      console.log(`   ⚠️  Claude enhancement failed: ${error.message}`);
      console.log(`   Continuing with console knowledge only...`);
      return targetElement;
    }
  }

  async executeZoomTest() {
    console.log("🔍 Executing zoom validation...\n");

    // Infer what element we're testing from the bug description
    let targetElement = this.inferTargetElementFromBug();

    // Enhance with console knowledge if available
    const pageName = this.bugSpec.environment?.component || 'unknown';
    if (this.consoleKnowledge.knowledge) {
      targetElement = this.consoleKnowledge.enhanceElementSearch(pageName, targetElement);
    }

    // Further enhance with Claude's analysis of bug context + screenshots
    if (this.bugScreenshots.length > 0 && process.env.ANTHROPIC_API_KEY) {
      targetElement = await this.enhanceWithClaude(targetElement, pageName);
    }

    console.log(`   Will search for and highlight: ${targetElement.description}\n`);

    // IMPORTANT: Locate the element BEFORE starting zoom tests
    // Build a direct, clear instruction for Stagehand
    let elementSelector = null;
    const elementType = targetElement.type || 'element';
    const elementText = targetElement.textSearchTerms?.[0] || targetElement.name;

    console.log(`   🎯 Locating ${elementType} before zoom test...`);

    const locateInstruction = `Find the ${elementType.toUpperCase()} element on this page that contains the text "${elementText}". ` +
                              `It must be an actual <${elementType}> HTML element, not a container or wrapper div. ` +
                              `The ${elementType} must have "${elementText}" in its visible text content. ` +
                              `If there are multiple ${elementType}s, choose the one that most specifically matches "${elementText}".`;

    console.log(`   Instruction: ${locateInstruction.substring(0, 150)}...`);

    try {
      // Use Stagehand to find the element
      const result = await this.stagehand.extract({
        instruction: locateInstruction,
        schema: {
          found: { type: 'boolean', description: 'Whether the element was found' },
          text: { type: 'string', description: 'The exact text content of the element' },
          tagName: { type: 'string', description: 'The HTML tag name (e.g., BUTTON, A)' }
        }
      });

      if (result && result.found) {
        console.log(`   ✅ Stagehand found: <${result.tagName}> "${result.text}"`);

        // Now get a reliable selector for this element
        elementSelector = await this.page.evaluate((searchText, tagName) => {
          const elements = document.querySelectorAll(tagName.toLowerCase());
          for (const el of elements) {
            if (el.textContent.trim() === searchText) {
              // Try to get a unique selector
              if (el.id) return `#${el.id}`;
              if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`;
              if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;

              // Fallback: use nth-of-type
              const siblings = Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName);
              const index = siblings.indexOf(el) + 1;
              return `${tagName.toLowerCase()}:nth-of-type(${index})`;
            }
          }
          return null;
        }, result.text, result.tagName);

        if (elementSelector) {
          console.log(`   📍 Element selector: ${elementSelector}`);
          // Store this for highlighting
          targetElement.verifiedSelector = elementSelector;
          targetElement.verifiedText = result.text;
        }
      } else {
        console.log(`   ⚠️  Stagehand could not locate the element`);
      }
    } catch (err) {
      console.log(`   ⚠️  Element location failed: ${err.message}`);
    }

    console.log();

    // First, execute reproduction steps if they exist
    if (this.bugSpec.steps_to_reproduce && this.bugSpec.steps_to_reproduce.length > 0) {
      console.log("   Executing reproduction steps before zoom test...\n");

      for (const step of this.bugSpec.steps_to_reproduce) {
        // Skip the first step if it's just navigation (we already did that)
        if (step.step === 1 && step.action.toLowerCase().includes('navigate to')) {
          console.log(`   ✓ Step ${step.step}: Already navigated\n`);
          continue;
        }

        console.log(`   Step ${step.step}: ${step.action}`);

        try {
          // Ensure page is scrolled to top before action
          await this.page.evaluate(() => window.scrollTo(0, 0));
          await this.page.waitForTimeout(500);

          // Capture URL before action
          const urlBefore = this.page.url();
          console.log(`      URL before action: ${urlBefore}`);

          await this.stagehand.act(step.action);
          await this.page.waitForTimeout(3000);

          // Capture URL after action
          const urlAfter = this.page.url();
          console.log(`      URL after action: ${urlAfter}`);

          if (urlBefore !== urlAfter) {
            console.log(`      ✅ Navigation detected: URL changed`);
          } else {
            console.log(`      ⚠️  Warning: URL did not change - may be inline expansion or action failed`);
          }

          // After action, capture both top and scrolled view if needed
          await this.captureStep(`step-${step.step}-after-action`);

          // Check if there's content below the fold
          const isScrollable = await this.page.evaluate(() => {
            return document.documentElement.scrollHeight > window.innerHeight;
          });

          if (isScrollable) {
            await this.page.evaluate(() => {
              window.scrollTo(0, document.documentElement.scrollHeight / 2);
            });
            await this.page.waitForTimeout(1000);
            await this.captureStep(`step-${step.step}-scrolled`);
            await this.page.evaluate(() => window.scrollTo(0, 0));
          }

          if (step.critical && step.note) {
            console.log(`      ⚠️  CRITICAL: ${step.note}`);
          }

          // If this is a critical navigation step and URL didn't change, warn and potentially fail
          if (step.critical && urlBefore === urlAfter && step.action.toLowerCase().includes('navigate')) {
            console.log(`      ⚠️  CRITICAL STEP ISSUE: Expected navigation but URL unchanged`);
            console.log(`      Continuing with validation, but may be on wrong page...`);
          }
        } catch (error) {
          console.log(`      ❌ Step failed: ${error.message}`);
          if (step.critical) {
            throw new Error(`Critical step ${step.step} failed: ${error.message}`);
          }
        }
        console.log();
      }

      console.log("   ✓ Reproduction steps complete. Starting zoom test...\n");
    } else {
      // No reproduction steps - ask AI to navigate intelligently
      console.log(`   ℹ️  No reproduction steps provided. AI will navigate to find "${targetElement.name}"...\n`);

      try {
        const navResult = await this.stagehand.extract({
          instruction: `You need to find the "${targetElement.name}" element on this page or navigate to where it exists.

CURRENT SITUATION:
- Bug: ${this.bugSpec.summary}
- Target: ${targetElement.name}
- Current page: ${this.page.url()}

YOUR TASK:
1. Check if "${targetElement.name}" is visible on the current page
2. If NOT visible:
   - If on a list page, try clicking on an item name/link to open details
   - Try expanding rows by clicking chevrons or arrows
   - Try scrolling to find it
3. Report what you found and what actions you took

Take whatever navigation steps are needed to make "${targetElement.name}" visible and accessible for testing.

Answer: FOUND: yes/no | LOCATION: where it is | ACTION: what to do next`
        });

        console.log(`   Navigation response: ${navResult}`);

        const found = navResult.toLowerCase().includes('found: yes');
        const needsAction = navResult.toLowerCase().includes('action:');

        if (!found && needsAction) {
          // Extract the action from the response
          const actionMatch = navResult.match(/ACTION:\s*(.+)/i);
          if (actionMatch) {
            const action = actionMatch[1].trim();
            console.log(`   Executing: ${action}`);
            await this.stagehand.act(action);
            await this.page.waitForTimeout(3000);
            await this.captureStep('ai-navigation-complete');
          }
        } else if (found) {
          console.log(`   ✓ Element already visible, proceeding with validation`);
        }

        console.log(`   ✓ Navigation assessment complete\n`);
      } catch (navError) {
        console.log(`   ⚠️  AI navigation encountered issue: ${navError.message}`);
        console.log(`   Proceeding with current page...\n`);
      }
    }

    // Verify we can find the target element before starting zoom tests
    const currentUrl = this.page.url();
    console.log(`   📍 Current page: ${currentUrl}`);
    console.log(`   🔍 Verifying "${targetElement.name}" is accessible...`);

    try {
      const elementCheck = await this.stagehand.extract({
        instruction: `Quick check: Can you see "${targetElement.name}" button on this page? Answer YES or NO and say where it is.`
      });

      const checkText = typeof elementCheck === 'string' ? elementCheck : JSON.stringify(elementCheck);
      const visible = checkText.toLowerCase().includes('yes');

      if (visible) {
        console.log(`   ✅ Target element found: ${elementCheck}`);
        console.log(`   Proceeding with zoom validation\n`);
      } else {
        console.log(`   ⚠️  Target element not visible: ${elementCheck}`);
        console.log(`   Attempting to navigate/reveal the element...\n`);

        // Try one more navigation attempt
        await this.stagehand.act(`Find and make "${targetElement.name}" visible. This might require clicking a link, expanding a row, or scrolling.`);
        await this.page.waitForTimeout(3000);
        await this.captureStep('element-reveal-attempt');

        console.log(`   Continuing with validation - element may become visible at different zoom levels\n`);
      }
    } catch (checkError) {
      console.log(`   ⚠️  Could not verify element visibility: ${checkError.message}`);
      console.log(`   Proceeding with validation anyway\n`);
    }

    const zoomLevels = this.bugSpec.zoom_levels || [50, 75, 100, 125, 150, 200];
    const results = [];

    for (const zoomLevel of zoomLevels) {
      console.log(`   Testing ${zoomLevel}% zoom...`);

      // Set zoom level
      await this.page.evaluate((zoom) => {
        document.body.style.zoom = `${zoom}%`;
      }, zoomLevel);

      await this.page.waitForTimeout(2000);

      // Always scroll through page after zoom change to ensure all content is discovered
      console.log(`      Scrolling through page at ${zoomLevel}% zoom to discover all content...`);
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.page.waitForTimeout(1000);
      await this.captureStep(`zoom-${zoomLevel}pct-top`);

      const pageInfo = await this.page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const height = Math.max(
          body.scrollHeight, body.offsetHeight,
          html.clientHeight, html.scrollHeight, html.offsetHeight
        );
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollHeight: height,
          scrollable: height > window.innerHeight
        };
      });

      // Always scroll through the page after zoom changes to make content discoverable
      if (pageInfo.scrollable) {
        // Scroll to middle
        await this.page.evaluate(() => {
          const scrollAmount = (document.documentElement.scrollHeight - window.innerHeight) / 2;
          window.scrollTo(0, scrollAmount);
        });
        await this.page.waitForTimeout(1000);
        await this.captureStep(`zoom-${zoomLevel}pct-middle`);

        // Scroll to bottom
        await this.page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
        await this.page.waitForTimeout(1000);
        await this.captureStep(`zoom-${zoomLevel}pct-bottom`);

        // Return to top for AI analysis
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(1000);
      }

      console.log(`      ✓ Full page scroll complete, starting AI analysis...`);

      // Use inferred target element
      const targetElementName = targetElement.name;
      const searchTerms = targetElement.searchTerms || [targetElement.name];
      const expectedBehavior = this.bugSpec.expected_result || 'elements should be properly positioned';
      const bugSummary = this.bugSpec.summary || 'UI layout issue';
      const bugDescription = this.bugSpec.description || '';

      console.log(`      AI Agent analyzing page for: ${targetElementName}...`);
      if (searchTerms.length > 1) {
        console.log(`      Search variations: ${searchTerms.join(', ')}`);
      }

      let analysisResult = null;
      try {
        // Build context from bug reporter's commentary
        let reporterContext = '';
        if (bugDescription) {
          reporterContext = `\n\nBUG REPORTER'S COMMENTARY:\n"${bugDescription}"\n`;
        }
        if (this.bugSpec.validation_instructions?.navigation) {
          reporterContext += `\nIMPORTANT NOTE: ${this.bugSpec.validation_instructions.navigation}\n`;
        }

        // Add screenshot context if available
        let screenshotContext = '';
        if (this.bugScreenshots && this.bugScreenshots.length > 0) {
          screenshotContext = `\n\n📸 BUG REPORTER PROVIDED SCREENSHOT(S):
The bug reporter attached ${this.bugScreenshots.length} screenshot(s) showing the issue:
${this.bugScreenshots.map((s, i) => `${i + 1}. ${s.original_filename}`).join('\n')}

These screenshots show what the bug reporter saw when they encountered the issue.
Use this as REFERENCE for:
- What the element should look like or where it should be
- What the problematic state looks like (overlap, misalignment, etc.)
- Spatial context and positioning of elements
- Visual evidence of the described issue

IMPORTANT: The current page state may differ from the screenshots. Your job is to:
1. Look for the SAME element/feature shown in the reporter's screenshots
2. Compare CURRENT state vs SCREENSHOT state
3. Identify if the issue still exists or has changed
4. Report any visual discrepancies you observe\n`;
        }

        // Use extract() to get AI analysis with our specific instruction
        const observation = await this.stagehand.extract({
          instruction: `You are a UI/UX Quality Assurance expert validating this bug: "${bugSummary}"${reporterContext}${screenshotContext}

CURRENT STATE: Testing at ${zoomLevel}% zoom level
NOTE: The page has already been scrolled top → middle → bottom → top, so all content should now be discoverable.

YOUR TASK AS A VISUAL QA EXPERT:

1. FIND THE TARGET ELEMENT
   Target: "${targetElementName}" (${targetElement.type})

   SEARCH STRATEGY - Follow this order:

   Step 1: Filter by HTML Element Type (if specified)
   ${targetElement.htmlTags && targetElement.htmlTags.length > 0 ? `
   First, narrow your search to these HTML element types:
   ${targetElement.htmlTags.map(tag => `   - ${tag}`).join('\n')}

   This means: Look for <button>, <a role="button">, etc. - NOT just any element with "button" in the text.
   The word "button" is an HTML keyword, so prioritize actual button elements first.
   ` : 'No specific HTML element type - search all interactive elements.'}

   Step 2: Search Text Content
   Within those element types, look for text content matching:
   ${targetElement.textSearchTerms.map(term => `   - "${term}"`).join('\n')}

   The element might use word variations. For example:
   - "Claim cluster" and "cluster claim" are the same
   - Case doesn't matter (CamelCase, lowercase, etc.)
   - Partial matches are OK if context is clear

   Step 3: Check Attributes (if text search fails)
   ${targetElement.attributeSearchTerms && targetElement.attributeSearchTerms.length > 0 ? `
   Look for these patterns in id, class, aria-label, or data attributes:
   ${targetElement.attributeSearchTerms.map(attr => `   - ${attr}`).join('\n')}
   ` : 'No specific attribute patterns to search.'}

   When you find it, report:
     * The ACTUAL text/label on the element (not the search term)
     * Its HTML tag (button, a, div, etc.)
     * Its CSS selector or unique identifier (id, class, aria-label)
     * Whether you found it (element_found: true/false)

2. PERFORM COMPREHENSIVE VISUAL ANALYSIS

   The bug report says: "${expectedBehavior}"

   BUT bug reports are often vague! "Not positioned properly" could mean ANY of these ACTUAL problems:

   **CRITICAL ISSUES TO DETECT:**
   ⚠️  **Overlapping Elements** - Most common zoom bug! LOOK FOR THESE CAREFULLY:
       - Buttons overlapping other buttons (e.g., "Claim cluster" button overlapping kebab menu)
       - Action buttons (three dots/kebab menus) overlapping with nearby buttons
       - Text overlapping text
       - Elements stacking on top of each other
       - Z-index issues causing wrong layering
       - Elements in table rows overlapping with row action buttons

       HOW TO DETECT OVERLAP:
       - Look at the bounding boxes of elements - do they share the same space?
       - Check if clickable elements are too close together (< 8px gap)
       - See if one element's edge crosses into another element's area
       - At high zoom (>125%), buttons often overlap in table rows

   ⚠️  **Text & Content Issues**
       - Text cut off or truncated unexpectedly
       - Text overflowing containers
       - Words breaking mid-character
       - Unreadable text (too small, poor contrast)

   ⚠️  **Layout Breaking**
       - Elements pushed outside their containers
       - Flexbox/grid layouts collapsing incorrectly
       - Containers too small for their content
       - Horizontal scrollbars appearing when they shouldn't

   ⚠️  **Spacing & Alignment**
       - Inconsistent spacing between elements
       - Elements misaligned with their row/column
       - Padding/margin collapsing incorrectly
       - Elements not centered when they should be

   ⚠️  **Accessibility Issues**
       - Clickable areas too small (< 44x44px)
       - Interactive elements not visually distinct
       - Focus indicators missing or broken
       - Insufficient color contrast

   ⚠️  **Responsive Design Failures**
       - Fixed widths causing overflow at this zoom level
       - Elements sized in pixels instead of relative units
       - Layout doesn't adapt to zoom changes
       - Absolute positioning breaking at different zooms

3. SPECIFIC CHECKS FOR "${targetElementName}":
   - Is it visible and fully within the viewport?
   - Is it overlapping with ANY other element?
   - Is its text fully readable (not cut off)?
   - Is it properly aligned with surrounding elements?
   - Does it have adequate spacing from neighbors?
   - Is it the right size for this zoom level?

4. REPORT FINDINGS:
   For EACH problem you find:
   - Describe what's wrong specifically (e.g., "Submit button overlaps Cancel button by 15px")
   - Identify WHICH elements are affected (CSS selectors or text)
   - Classify severity:
     * critical = element unusable, major UX issue, overlapping elements
     * major = visible problem but element still usable
     * minor = cosmetic issue, slightly off alignment

REMEMBER:
- "Positioning issues" often means OVERLAPPING or MISALIGNMENT
- Look at the ACTUAL visual state, not just whether elements exist
- A button can exist but be overlapped by another element - that's a bug!
- Compare elements at THIS zoom level vs what's reasonable

Report what you ACTUALLY SEE, even if it's different from what the bug report describes.

Format your response as:
ELEMENT_FOUND: yes/no
ELEMENT_TEXT: actual button text
ISSUES: list each issue with severity (critical/major/minor) and description
LAYOUT_OK: yes/no`
        });

        // Parse the observation - handle both string and object responses
        let observationText = '';
        if (typeof observation === 'string') {
          observationText = observation;
        } else if (observation && observation.elements) {
          // Stagehand returned structured elements - convert to text description
          observationText = observation.elements
            .map(el => `${el.description} (${el.method})`)
            .join('\n');
          console.log(`      📋 Stagehand found ${observation.elements.length} elements`);
        } else if (observation && typeof observation === 'object') {
          // Try to extract text from object
          observationText = JSON.stringify(observation);
        }

        analysisResult = {
          raw_observation: observation, // Save full raw response
          element_found: observationText.toLowerCase().includes('element_found: yes') ||
                        observationText.toLowerCase().includes(targetElementName.toLowerCase()),
          element_actual_text: null,
          issues_found: [],
          layout_appears_correct: observationText.toLowerCase().includes('layout_ok: yes')
        };

        // Try to extract element text
        const elementTextMatch = observationText.match(/ELEMENT_TEXT:\s*(.+)/i);
        if (elementTextMatch) {
          analysisResult.element_actual_text = elementTextMatch[1].trim();
        }

        // Try to extract issues - improved parsing
        const issuesSection = observationText.match(/ISSUES:\s*([\s\S]+?)(?=LAYOUT_OK:|$)/i);
        if (issuesSection) {
          const issueText = issuesSection[1].trim();

          // Handle "None", "No issues", etc.
          if (issueText.toLowerCase().includes('none') ||
              issueText.toLowerCase().includes('no issues') ||
              issueText.toLowerCase().includes('no problems')) {
            analysisResult.issues_found = [];
          } else {
            // Parse actual issues
            const issueLines = issueText.split('\n').filter(line => line.trim());
            issueLines.forEach(line => {
              const severityMatch = line.match(/\b(critical|major|minor)\b/i);

              if (severityMatch) {
                // Extract description (everything except severity marker)
                let description = line
                  .replace(/^[-*•]\s*/, '') // Remove bullet points
                  .replace(/\b(critical|major|minor)\b:?\s*/i, '') // Remove severity word
                  .trim();

                if (description) {
                  analysisResult.issues_found.push({
                    severity: severityMatch[1].toLowerCase(),
                    description: description,
                    issue_type: line.toLowerCase().includes('overlap') ? 'overlapping' : 'other'
                  });
                }
              }
            });
          }
        }

        console.log(`      Raw AI observation (first 300 chars):`);
        console.log(`      ${observationText.substring(0, 300)}...`);

        console.log(`      Element found: ${analysisResult.element_found}`);
        if (analysisResult.element_actual_text) {
          console.log(`      Element text: ${analysisResult.element_actual_text}`);
        }
        console.log(`      Layout OK: ${analysisResult.layout_appears_correct}`);
        console.log(`      Issues found: ${analysisResult.issues_found.length}`);
        if (analysisResult.issues_found.length > 0) {
          analysisResult.issues_found.forEach((issue, idx) => {
            console.log(`         ${idx + 1}. [${issue.severity}] ${issue.description}`);
          });
        }

        // If AI recommends an action, let it execute
        if (analysisResult.recommendations && !analysisResult.recommendations.toLowerCase().includes('fine')) {
          console.log(`      AI recommendation: ${analysisResult.recommendations}`);

          // Let AI act on its own recommendation
          try {
            await this.stagehand.act(analysisResult.recommendations);
            await this.page.waitForTimeout(2000);
            await this.captureStep(`zoom-${zoomLevel}pct-after-adjustment`);
          } catch (actError) {
            console.log(`      Could not execute recommendation: ${actError.message}`);
          }
        }

        // Always highlight the target element being tested (blue outline)
        console.log(`      Highlighting target element: ${targetElementName}...`);

        // Use the ACTUAL element text from AI analysis if available
        const actualElementText = analysisResult.element_actual_text || searchTerms[0];
        const actualElementSelector = analysisResult.element_css_selector;

        console.log(`      AI found element with text: "${actualElementText}"`);
        if (actualElementSelector) {
          console.log(`      AI found element selector: ${actualElementSelector}`);
        }

        // If AI didn't provide selector, try to find it ourselves using known selectors
        let verifiedSelector = actualElementSelector;
        if (!verifiedSelector && targetElement.knownSelectors && targetElement.knownSelectors.length > 0) {
          console.log(`      Trying known selectors...`);
          for (const knownSel of targetElement.knownSelectors) {
            try {
              const matchInfo = await this.page.evaluate((sel, searchTerms) => {
                const el = document.querySelector(sel);
                if (!el) return { exists: false };

                // Get direct text only (excluding nested elements)
                const directText = Array.from(el.childNodes)
                  .filter(node => node.nodeType === Node.TEXT_NODE)
                  .map(node => node.textContent.trim())
                  .join(' ')
                  .toLowerCase();

                // Also check attributes
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                const title = (el.getAttribute('title') || '').toLowerCase();

                // Full text as fallback for small buttons that might have nested spans
                const fullText = el.textContent.trim().toLowerCase();
                const isSmallElement = fullText.length < 50;

                // Check if this element matches our search terms
                const matchesSearch = searchTerms.some(term => {
                  const termLower = term.toLowerCase();

                  // Prioritize: aria-label > direct text > title > full text (if small)
                  return ariaLabel.includes(termLower) ||
                         directText.includes(termLower) ||
                         title.includes(termLower) ||
                         (isSmallElement && fullText === termLower);
                });

                return {
                  exists: true,
                  text: (ariaLabel || fullText).substring(0, 50),
                  tag: el.tagName.toLowerCase(),
                  matches: matchesSearch
                };
              }, knownSel, targetElement.textSearchTerms || [actualElementText]);

              if (matchInfo.exists && matchInfo.matches) {
                verifiedSelector = knownSel;
                console.log(`      ✅ Found matching element: ${knownSel} ("${matchInfo.text}")`);
                break;
              } else if (matchInfo.exists) {
                console.log(`      ⚠️  Selector exists but doesn't match: ${knownSel} ("${matchInfo.text}")`);
              }
            } catch (e) {
              // Invalid selector or evaluation error
            }
          }
        }

        // If still no selector, ask AI to find it explicitly
        if (!verifiedSelector && analysisResult.element_found) {
          console.log(`      Asking AI to locate element selector...`);
          try {
            const selectorResult = await this.stagehand.extract({
              instruction: `Find the CSS selector for the "${actualElementText}" button. Provide the most specific selector possible (id, data-testid, or unique class).

Format: SELECTOR: #id or [data-testid="..."] or .specific-class`
            });

            const resultText = typeof selectorResult === 'string' ? selectorResult : JSON.stringify(selectorResult);
            const selectorMatch = resultText.match(/SELECTOR:\s*(.+)/i);
            if (selectorMatch) {
              verifiedSelector = selectorMatch[1].trim();
              console.log(`      AI provided selector: ${verifiedSelector}`);
            }
          } catch (e) {
            console.log(`      Could not get selector from AI: ${e.message}`);
          }
        }

        // Use structured search for highlighting
        const targetHighlight = [{
          severity: 'target',
          description: `Target element being tested: ${targetElementName}`,
          element: actualElementText || targetElementName,
          text_content: actualElementText || targetElementName,
          // Use pre-located selector if available (from before zoom tests started)
          verifiedSelector: targetElement.verifiedSelector,
          verifiedText: targetElement.verifiedText,
          css_selector: verifiedSelector || targetElement.primarySelector,
          htmlTags: targetElement.htmlTags || [],
          textSearchTerms: targetElement.textSearchTerms || searchTerms,
          attributeSearchTerms: targetElement.attributeSearchTerms || [],
          searchTerms: searchTerms
        }];

        // Add any detected issues to the highlight list
        const allHighlights = [...targetHighlight];
        if (analysisResult.issues_found && analysisResult.issues_found.length > 0) {
          console.log(`      ⚠️  Issues detected:`);
          analysisResult.issues_found.forEach(issue => {
            console.log(`         [${issue.severity}] ${issue.description}`);
            allHighlights.push(issue);
          });
        } else {
          console.log(`      ✓ No issues detected at this zoom level`);
        }

        // Highlight everything (target element + any issues)
        await this.highlightIssues(allHighlights, zoomLevel);

        // Capture screenshot with highlights
        const screenshotSuffix = analysisResult.issues_found?.length > 0
          ? 'with-issues-highlighted'
          : 'target-highlighted';
        await this.captureStep(`zoom-${zoomLevel}pct-${screenshotSuffix}`);

        // Remove highlights
        await this.removeHighlights();
      } catch (analysisError) {
        console.log(`      ⚠️  AI analysis failed: ${analysisError.message}`);
        console.log(`      Error details:`, analysisError.stack);

        // Even if AI analysis fails, still try to highlight the target element
        console.log(`      Attempting basic highlighting without AI analysis...`);
        try {
          const basicHighlight = [{
            severity: 'target',
            description: `Target element: ${targetElementName}`,
            element: searchTerms[0], // Use first search term
            text_content: searchTerms[0],
            searchTerms: searchTerms // Include all search variations
          }];

          await this.highlightIssues(basicHighlight, zoomLevel);
          await this.captureStep(`zoom-${zoomLevel}pct-target-highlighted-fallback`);
          await this.removeHighlights();
        } catch (highlightError) {
          console.log(`      ⚠️  Fallback highlighting also failed: ${highlightError.message}`);
        }
      }

      const zoomResult = {
        zoom_level: `${zoomLevel}%`,
        page_dimensions: pageInfo,
        screenshot: `${this.bugSpec.jira_ticket}-${this.stepNumber}-zoom-${zoomLevel}pct.png`,
        scroll_positions_captured: pageInfo.scrollable ? ['top', 'middle', 'bottom'] : ['top'],
        ai_analysis: analysisResult,
        element_found: analysisResult?.element_found,
        element_text: analysisResult?.element_actual_text,
        issues_count: analysisResult?.issues_found?.length || 0
      };

      results.push(zoomResult);

      console.log(`      Page size: ${pageInfo.width}x${pageInfo.height}`);
      console.log(`      Scrollable: ${pageInfo.scrollable ? 'Yes' : 'No'}`);
      if (pageInfo.scrollable) {
        console.log(`      Scroll height: ${pageInfo.scrollHeight}px`);
      }
      console.log(`      Zoom result saved:`, JSON.stringify({
        zoom: zoomLevel,
        element_found: zoomResult.element_found,
        has_analysis: !!zoomResult.ai_analysis,
        issues_count: zoomResult.ai_analysis?.issues_found?.length || 0
      }));
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

      // Summary of all issues found
      const allIssues = [];
      summary.results.zoom_results.forEach((result) => {
        if (result.ai_analysis?.issues_found) {
          result.ai_analysis.issues_found.forEach(issue => {
            allIssues.push({
              zoom: result.zoom_level,
              ...issue
            });
          });
        }
      });

      if (allIssues.length > 0) {
        report += `### 🐛 Issues Discovered\n\n`;
        const criticalIssues = allIssues.filter(i => i.severity === 'critical');
        const majorIssues = allIssues.filter(i => i.severity === 'major');
        const minorIssues = allIssues.filter(i => i.severity === 'minor');

        // Group issues by type
        const issuesByType = {};
        allIssues.forEach(issue => {
          const type = issue.issue_type || 'other';
          if (!issuesByType[type]) issuesByType[type] = [];
          issuesByType[type].push(issue);
        });

        report += `**Issue Summary by Type:**\n`;
        Object.keys(issuesByType).forEach(type => {
          const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
          report += `- ${typeLabel}: ${issuesByType[type].length}\n`;
        });
        report += `\n`;

        if (criticalIssues.length > 0) {
          report += `**🔴 Critical Issues (${criticalIssues.length}):**\n`;
          criticalIssues.forEach(issue => {
            const typeLabel = issue.issue_type ? `[${issue.issue_type}]` : '';
            report += `- **${issue.zoom}** ${typeLabel} ${issue.description}\n`;
            if (issue.visual_evidence) {
              report += `  - Visual: ${issue.visual_evidence}\n`;
            }
            if (issue.affected_element_2) {
              report += `  - Affects: ${issue.element} + ${issue.affected_element_2}\n`;
            }
          });
          report += `\n`;
        }

        if (majorIssues.length > 0) {
          report += `**🟠 Major Issues (${majorIssues.length}):**\n`;
          majorIssues.forEach(issue => {
            const typeLabel = issue.issue_type ? `[${issue.issue_type}]` : '';
            report += `- **${issue.zoom}** ${typeLabel} ${issue.description}\n`;
            if (issue.visual_evidence) {
              report += `  - Visual: ${issue.visual_evidence}\n`;
            }
          });
          report += `\n`;
        }

        if (minorIssues.length > 0) {
          report += `**🟡 Minor Issues (${minorIssues.length}):**\n`;
          minorIssues.forEach(issue => {
            const typeLabel = issue.issue_type ? `[${issue.issue_type}]` : '';
            report += `- **${issue.zoom}** ${typeLabel} ${issue.description}\n`;
          });
          report += `\n`;
        }

        report += `**Bug Status:** ✅ CONFIRMED - ${allIssues.length} UI issue(s) detected across ${Object.keys(issuesByType).length} categories\n\n`;
      } else {
        report += `**Bug Status:** ❌ NOT CONFIRMED - No UI issues detected at tested zoom levels\n\n`;
      }

      report += `### Detailed Results by Zoom Level\n\n`;
      summary.results.zoom_results.forEach((result) => {
        report += `#### ${result.zoom_level} Zoom\n`;
        report += `- **Screenshots**: ${result.screenshot}\n`;
        if (result.scroll_positions_captured) {
          report += `- **Scroll Positions**: ${result.scroll_positions_captured.join(', ')}\n`;
        }
        report += `- **Page Dimensions**: ${result.page_dimensions.width}x${result.page_dimensions.height}\n`;

        if (result.element_found !== undefined) {
          report += `- **Target Element Found**: ${result.element_found ? '✅ Yes' : '❌ No'}\n`;
        }
        if (result.ai_actions) {
          report += `- **AI Actions**: ${result.ai_actions}\n`;
        }

        if (result.ai_analysis) {
          if (result.ai_analysis.overall_assessment) {
            report += `- **Assessment**: ${result.ai_analysis.overall_assessment}\n`;
          }
          report += `- **Layout Correct**: ${result.ai_analysis.layout_appears_correct ? '✅ Yes' : '❌ No'}\n`;

          if (result.ai_analysis.issues_found && result.ai_analysis.issues_found.length > 0) {
            report += `- **Issues Detected**:\n`;
            result.ai_analysis.issues_found.forEach(issue => {
              const typeLabel = issue.issue_type ? ` [${issue.issue_type}]` : '';
              report += `  - **[${issue.severity}]**${typeLabel} ${issue.description}\n`;
              if (issue.visual_evidence) {
                report += `    - _Observed: ${issue.visual_evidence}_\n`;
              }
            });
          } else {
            report += `- **Issues Detected**: None - layout appears correct\n`;
          }

          if (result.ai_recommendations) {
            report += `- **Recommendations**: ${result.ai_recommendations}\n`;
          }
        }

        report += `\n`;
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
