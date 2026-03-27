// Claude Instruction Generator
// Uses Claude API to generate optimized Stagehand instructions based on bug context

const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');

class ClaudeInstructionGenerator {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * Generate optimized element discovery instructions using Claude
   *
   * @param {Object} context - The context for instruction generation
   * @param {string} context.bugDescription - The Jira bug description
   * @param {string} context.bugSummary - The Jira bug summary
   * @param {Array} context.screenshots - Array of screenshot paths from bug report
   * @param {Object} context.targetElement - The element we're trying to find
   * @param {string} context.currentPage - Description of current page (e.g., 'clusterpools')
   * @param {Object} context.consoleKnowledge - Known selectors/IDs from console repo
   * @param {string} context.currentPageHtml - Optional: Current page HTML/DOM snippet
   * @returns {Promise<Object>} Optimized search instructions
   */
  async generateElementInstructions(context) {
    const {
      bugDescription,
      bugSummary,
      screenshots = [],
      targetElement,
      currentPage,
      consoleKnowledge = {},
      currentPageHtml = null
    } = context;

    // Build the prompt for Claude
    const systemPrompt = `You are an expert at web automation and element discovery. Your job is to analyze a bug report and generate the most precise instructions for finding UI elements on a web page.

Given:
1. A bug description from a QE engineer
2. Screenshots showing the issue
3. The target element we need to find
4. Knowledge from the application's test suite (known selectors, IDs, text patterns)
5. The current page context

You will generate:
1. The most precise CSS selector to find the element
2. Alternative selectors as fallbacks
3. Text-based search terms in priority order
4. A natural language instruction optimized for AI browser automation (Stagehand)

Be specific and leverage all available context. Prefer stable selectors (data-testid, unique IDs) over brittle ones (positional selectors, generic classes).`;

    const userPrompt = this._buildUserPrompt(
      bugDescription,
      bugSummary,
      targetElement,
      currentPage,
      consoleKnowledge,
      currentPageHtml
    );

    // Prepare the message with screenshots
    const content = [{ type: 'text', text: userPrompt }];

    // Add screenshots if available
    for (const screenshotPath of screenshots) {
      try {
        const imageData = await fs.readFile(screenshotPath);
        const base64Image = imageData.toString('base64');
        const ext = path.extname(screenshotPath).toLowerCase();
        const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Image
          }
        });
      } catch (err) {
        console.log(`   ⚠️  Could not load screenshot: ${screenshotPath}`);
      }
    }

    // Call Claude API
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: content
        }
      ]
    });

    // Parse Claude's response
    const analysisText = response.content[0].text;
    return this._parseResponse(analysisText, targetElement);
  }

  _buildUserPrompt(bugDescription, bugSummary, targetElement, currentPage, consoleKnowledge, currentPageHtml) {
    let prompt = `# Bug Context\n\n`;
    prompt += `**Summary**: ${bugSummary}\n\n`;
    prompt += `**Description**:\n${bugDescription}\n\n`;
    prompt += `---\n\n`;
    prompt += `# Target Element\n\n`;
    prompt += `**Element Name**: ${targetElement.name}\n`;
    prompt += `**Element Type**: ${targetElement.type}\n`;
    prompt += `**Description**: ${targetElement.description}\n`;
    prompt += `**Current Page**: ${currentPage}\n\n`;

    if (consoleKnowledge && Object.keys(consoleKnowledge).length > 0) {
      prompt += `# Known Selectors from Console Test Suite\n\n`;

      if (consoleKnowledge.ids && consoleKnowledge.ids.length > 0) {
        prompt += `**Known IDs**: ${consoleKnowledge.ids.join(', ')}\n`;
      }

      if (consoleKnowledge.testIds && consoleKnowledge.testIds.length > 0) {
        prompt += `**Known Test IDs**: ${consoleKnowledge.testIds.join(', ')}\n`;
      }

      if (consoleKnowledge.selectors && consoleKnowledge.selectors.length > 0) {
        prompt += `**Known Selectors**: ${consoleKnowledge.selectors.join(', ')}\n`;
      }

      if (consoleKnowledge.texts && consoleKnowledge.texts.length > 0) {
        prompt += `**Known Text Patterns**: ${consoleKnowledge.texts.slice(0, 5).join(', ')}\n`;
      }

      prompt += `\n`;
    }

    if (currentPageHtml) {
      prompt += `# Current Page DOM\n\n`;
      prompt += `\`\`\`html\n${currentPageHtml}\n\`\`\`\n\n`;
    }

    prompt += `---\n\n`;
    prompt += `# Task\n\n`;
    prompt += `Based on the bug description and screenshots, provide:\n\n`;
    prompt += `**IMPORTANT**: Generate selectors that target the SPECIFIC ${targetElement.type} element (e.g., <button>, <a>), NOT parent containers or modals.\n`;
    prompt += `Prefer attribute-based selectors (aria-label, data-testid) over generic IDs that might match containers.\n\n`;
    prompt += `For a button labeled "${targetElement.name}", good selectors are:\n`;
    prompt += `✓ button[aria-label="${targetElement.name}"]\n`;
    prompt += `✓ button:contains("${targetElement.name}")\n`;
    prompt += `✓ [data-testid="claim-cluster-button"]\n\n`;
    prompt += `Bad selectors (too generic, match containers):\n`;
    prompt += `✗ #claim (could be a modal ID)\n`;
    prompt += `✗ .claim-section (could be a container class)\n\n`;
    prompt += `Provide:\n\n`;
    prompt += `1. **Primary Selector**: A specific CSS selector targeting the ${targetElement.type} element itself\n`;
    prompt += `2. **Fallback Selectors**: 2-3 alternative selectors as backups\n`;
    prompt += `3. **Text Search Terms**: Ordered list of text patterns to search for (most specific first)\n`;
    prompt += `4. **Stagehand Instruction**: A precise natural language instruction optimized for AI automation\n\n`;
    prompt += `Format your response as JSON:\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "primarySelector": "CSS selector",\n`;
    prompt += `  "fallbackSelectors": ["selector1", "selector2"],\n`;
    prompt += `  "textSearchTerms": ["term1", "term2", "term3"],\n`;
    prompt += `  "stagehandInstruction": "natural language instruction",\n`;
    prompt += `  "reasoning": "brief explanation of your choices"\n`;
    prompt += `}\n`;
    prompt += `\`\`\`\n`;

    return prompt;
  }

  _parseResponse(analysisText, targetElement) {
    // Extract JSON from Claude's response
    const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          primarySelector: parsed.primarySelector,
          fallbackSelectors: parsed.fallbackSelectors || [],
          textSearchTerms: parsed.textSearchTerms || [],
          stagehandInstruction: parsed.stagehandInstruction,
          reasoning: parsed.reasoning,
          htmlTags: targetElement.htmlTags || [],
          attributeSearchTerms: targetElement.attributeSearchTerms || []
        };
      } catch (err) {
        console.log('   ⚠️  Could not parse Claude response as JSON, using fallback');
      }
    }

    // Fallback: return original target element with analysis as reasoning
    return {
      ...targetElement,
      reasoning: analysisText,
      stagehandInstruction: `Find and interact with ${targetElement.name}`
    };
  }

  /**
   * Generate optimized instructions for a full validation step
   *
   * @param {Object} context - Step context including all bug information
   * @returns {Promise<string>} Natural language instruction for Stagehand
   */
  async generateStepInstruction(context) {
    const {
      bugDescription,
      bugSummary,
      screenshots = [],
      step,
      currentPage,
      currentUrl
    } = context;

    const systemPrompt = `You are an expert at web automation. Generate precise, actionable instructions for an AI browser automation tool (Stagehand) that uses Claude.

Your instructions should:
- Be clear and specific
- Avoid ambiguity
- Use exact text labels when known
- Specify element types (button, link, input, etc.)
- Include relevant context from the bug report
- Be optimized for AI understanding

Keep instructions concise but complete.`;

    const userPrompt = `# Bug Context

**Summary**: ${bugSummary}

**Description**:
${bugDescription}

**Current Page**: ${currentPage}
**Current URL**: ${currentUrl}

# Validation Step

${JSON.stringify(step, null, 2)}

# Task

Generate a precise Stagehand instruction to perform this validation step. Consider the bug context and be specific about what element to interact with and how.

Return only the instruction text, no explanation.`;

    // Prepare content with screenshots
    const content = [{ type: 'text', text: userPrompt }];

    for (const screenshotPath of screenshots) {
      try {
        const imageData = await fs.readFile(screenshotPath);
        const base64Image = imageData.toString('base64');
        const ext = path.extname(screenshotPath).toLowerCase();
        const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Image
          }
        });
      } catch (err) {
        console.log(`   ⚠️  Could not load screenshot: ${screenshotPath}`);
      }
    }

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: content
        }
      ]
    });

    return response.content[0].text.trim();
  }
}

module.exports = { ClaudeInstructionGenerator };
