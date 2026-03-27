// Stagehand Instruction Builder
// Generates semantic, context-aware instructions for Stagehand AI
// Instead of "click the Claim cluster button", generates intelligent prompts
// that help Stagehand understand WHAT we're looking for and WHY

class StagehandInstructionBuilder {
  /**
   * Build a semantic instruction for finding an element
   *
   * @param {Object} context - The full context
   * @param {string} context.elementName - What we're looking for (e.g., "Claim cluster")
   * @param {string} context.elementType - Type of element (button, link, input)
   * @param {string} context.bugSummary - The bug summary for context
   * @param {string} context.currentPage - Where we are (e.g., "cluster pools page")
   * @param {string} context.purpose - What this element does (optional)
   * @returns {string} Semantic instruction for Stagehand
   */
  static buildFindInstruction(context) {
    const {
      elementName,
      elementType = 'element',
      bugSummary,
      currentPage,
      purpose
    } = context;

    // Extract key concepts from the element name without listing them explicitly
    const concepts = this._extractConcepts(elementName);

    // Build semantic description based on element type
    let instruction = '';

    switch (elementType.toLowerCase()) {
      case 'button':
        instruction = this._buildButtonInstruction(elementName, concepts, currentPage, purpose);
        break;
      case 'link':
        instruction = this._buildLinkInstruction(elementName, concepts, currentPage);
        break;
      case 'input':
      case 'textbox':
        instruction = this._buildInputInstruction(elementName, concepts);
        break;
      default:
        instruction = this._buildGenericInstruction(elementName, elementType, currentPage);
    }

    // Add bug context if available
    if (bugSummary) {
      const bugContext = this._extractBugContext(bugSummary);
      if (bugContext) {
        instruction += `\n\nContext: ${bugContext}`;
      }
    }

    return instruction;
  }

  /**
   * Build instruction for finding a button semantically
   */
  static _buildButtonInstruction(elementName, concepts, currentPage, purpose) {
    // Infer purpose from concepts if not provided
    if (!purpose) {
      purpose = this._inferPurpose(elementName, concepts);
    }

    const location = currentPage ? ` on the ${currentPage}` : '';

    if (concepts.action && concepts.target) {
      // e.g., "Claim cluster" = action:"claim", target:"cluster"
      return `Find the interactive button${location} that allows you to ${concepts.action} a ${concepts.target}. ` +
             `This button should enable the user to perform the ${concepts.action} operation. ` +
             `Look for a button element (not a link or text) that serves this purpose.`;
    } else {
      // Fallback for simpler names like "Submit" or "Create"
      return `Find the button${location} that ${purpose || `performs the action described as "${elementName}"`}. ` +
             `This should be a clickable button element.`;
    }
  }

  /**
   * Build instruction for finding a link
   */
  static _buildLinkInstruction(elementName, concepts, currentPage) {
    const location = currentPage ? ` on the ${currentPage}` : '';

    if (concepts.target) {
      return `Find the navigation link${location} that takes you to ${concepts.target}. ` +
             `This should be a hyperlink (not a button) that navigates when clicked.`;
    } else {
      return `Find the link${location} labeled "${elementName}". ` +
             `Look for a hyperlink element that navigates to a new page or section.`;
    }
  }

  /**
   * Build instruction for finding an input field
   */
  static _buildInputInstruction(elementName, concepts) {
    if (concepts.target) {
      return `Find the input field where you enter ${concepts.target} information. ` +
             `This should be a text input box or textarea element.`;
    } else {
      return `Find the input field labeled "${elementName}". ` +
             `Look for a textbox or input element where users can type information.`;
    }
  }

  /**
   * Build generic instruction
   */
  static _buildGenericInstruction(elementName, elementType, currentPage) {
    const location = currentPage ? ` on the ${currentPage}` : '';
    return `Find the ${elementType}${location} that corresponds to "${elementName}". ` +
           `Look for an interactive element that matches this description.`;
  }

  /**
   * Extract key concepts from element name
   * e.g., "Claim cluster" → { action: "claim", target: "cluster" }
   */
  static _extractConcepts(elementName) {
    const nameLower = elementName.toLowerCase();
    const words = nameLower.split(/\s+/);

    const concepts = {
      action: null,
      target: null,
      modifier: null
    };

    // Common action verbs
    const actions = [
      'create', 'delete', 'claim', 'edit', 'update', 'add', 'remove',
      'start', 'stop', 'enable', 'disable', 'configure', 'manage',
      'view', 'open', 'close', 'save', 'cancel', 'submit', 'apply'
    ];

    // Find action word
    for (const word of words) {
      if (actions.includes(word)) {
        concepts.action = word;
        break;
      }
    }

    // Find target (usually the noun after the action)
    if (concepts.action) {
      const actionIndex = words.indexOf(concepts.action);
      if (actionIndex < words.length - 1) {
        concepts.target = words.slice(actionIndex + 1).join(' ');
      }
    } else if (words.length >= 2) {
      // If no action found, last word might be the target
      concepts.action = words[0];
      concepts.target = words.slice(1).join(' ');
    }

    return concepts;
  }

  /**
   * Infer purpose from element name and concepts
   */
  static _inferPurpose(elementName, concepts) {
    if (concepts.action && concepts.target) {
      return `${concepts.action} a ${concepts.target}`;
    } else if (concepts.action) {
      return `${concepts.action} something`;
    } else {
      return `perform the action: ${elementName}`;
    }
  }

  /**
   * Extract relevant context from bug summary
   */
  static _extractBugContext(bugSummary) {
    // Extract key phrases that describe the issue
    const lowerSummary = bugSummary.toLowerCase();

    // Look for issue descriptions
    if (lowerSummary.includes('not visible') || lowerSummary.includes('hidden')) {
      return 'This element may have visibility issues depending on zoom level or screen size.';
    }

    if (lowerSummary.includes('not clickable') || lowerSummary.includes('cannot click')) {
      return 'This element may have click/interaction issues.';
    }

    if (lowerSummary.includes('repositioned') || lowerSummary.includes('layout')) {
      return 'This element may have layout or positioning issues at different zoom levels.';
    }

    return null;
  }

  /**
   * Build a natural language instruction for Stagehand actions
   * This is used for act() calls
   */
  static buildActionInstruction(context) {
    const {
      action,  // 'click', 'type', 'select', etc.
      element,
      value,   // For type/select actions
      currentPage,
      bugContext
    } = context;

    const findInstruction = this.buildFindInstruction({
      elementName: element.name,
      elementType: element.type,
      bugSummary: bugContext?.summary,
      currentPage: currentPage
    });

    switch (action.toLowerCase()) {
      case 'click':
        return `${findInstruction}\n\nOnce you've identified the correct element, click on it.`;

      case 'type':
        return `${findInstruction}\n\nOnce you've found the input field, type "${value}" into it.`;

      case 'select':
        return `${findInstruction}\n\nOnce you've found the dropdown, select the option "${value}".`;

      default:
        return `${findInstruction}\n\nThen ${action} it.`;
    }
  }
}

module.exports = { StagehandInstructionBuilder };
