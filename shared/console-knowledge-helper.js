// Console Knowledge Helper
// Uses extracted console knowledge to improve element targeting

const fs = require('fs').promises;
const path = require('path');

class ConsoleKnowledgeHelper {
  constructor(knowledgeFilePath) {
    this.knowledgeFilePath = knowledgeFilePath || path.join(__dirname, '../agent/config/console-knowledge.json');
    this.knowledge = null;
  }

  async load() {
    try {
      const content = await fs.readFile(this.knowledgeFilePath, 'utf8');
      this.knowledge = JSON.parse(content);
      return true;
    } catch (error) {
      console.warn(`⚠️  Could not load console knowledge: ${error.message}`);
      return false;
    }
  }

  /**
   * Find element information based on page and element name
   * @param {string} pageName - Page name (e.g., "clusterpools", "clustersets")
   * @param {string} elementName - Element name to search for (e.g., "Claim cluster")
   * @returns {Object|null} Element information with selectors, IDs, etc.
   */
  findElement(pageName, elementName) {
    if (!this.knowledge) return null;

    const normalizedPage = pageName.toLowerCase().replace(/\s+/g, '');
    const normalizedElement = elementName.toLowerCase();

    const result = {
      found: false,
      ids: [],
      testIds: [],
      texts: [],
      selectors: [],
      i18nKeys: [],
      htmlTags: ['button', 'a[role="button"]', '[type="button"]'] // Default
    };

    // Search test patterns for this page
    const testPatterns = this.knowledge.testPatterns[normalizedPage] || [];
    for (const pattern of testPatterns) {
      if (pattern.text && pattern.text.toLowerCase().includes(normalizedElement)) {
        result.found = true;
        result.texts.push(pattern.text);

        if (pattern.testId) {
          result.testIds.push(pattern.testId);
          result.selectors.push(`[data-testid="${pattern.testId}"]`);
        }

        if (pattern.selector) {
          result.selectors.push(pattern.selector);
        }

        if (pattern.role) {
          result.htmlTags = [`[role="${pattern.role}"]`, ...result.htmlTags];
        }
      }
    }

    // Search component metadata
    for (const [componentName, metadata] of Object.entries(this.knowledge.components || {})) {
      // Check button texts
      for (const button of metadata.buttons || []) {
        if (button.text.toLowerCase().includes(normalizedElement)) {
          result.found = true;
          result.texts.push(button.text);
          if (button.i18nKey) {
            result.i18nKeys.push(button.i18nKey);
          }
        }
      }

      // Check IDs that might match
      for (const id of metadata.ids || []) {
        const idLower = id.toLowerCase();
        const searchTerms = normalizedElement.split(/\s+/);

        if (searchTerms.some(term => idLower.includes(term))) {
          result.found = true;
          result.ids.push(id);
          result.selectors.push(`#${id}`);
        }
      }

      // Check test IDs
      for (const testId of metadata.testIds || []) {
        const testIdLower = testId.toLowerCase();
        const searchTerms = normalizedElement.split(/\s+/);

        if (searchTerms.some(term => testIdLower.includes(term))) {
          result.found = true;
          result.testIds.push(testId);
          result.selectors.push(`[data-testid="${testId}"]`);
        }
      }
    }

    // Deduplicate
    result.ids = [...new Set(result.ids)];
    result.testIds = [...new Set(result.testIds)];
    result.texts = [...new Set(result.texts)];
    result.selectors = [...new Set(result.selectors)];
    result.i18nKeys = [...new Set(result.i18nKeys)];
    result.htmlTags = [...new Set(result.htmlTags)];

    return result.found ? result : null;
  }

  /**
   * Get i18n translation for a key
   * @param {string} key - i18n key
   * @returns {string|null} Translated text
   */
  getTranslation(key) {
    if (!this.knowledge || !this.knowledge.i18n) return null;
    return this.knowledge.i18n[key] || null;
  }

  /**
   * Find i18n key for a given text
   * @param {string} text - Text to search for
   * @returns {string|null} i18n key
   */
  findI18nKey(text) {
    if (!this.knowledge || !this.knowledge.i18n_reverse) return null;
    return this.knowledge.i18n_reverse[text.toLowerCase()] || null;
  }

  /**
   * Get all known elements for a page
   * @param {string} pageName - Page name
   * @returns {Array} List of element patterns
   */
  getPageElements(pageName) {
    if (!this.knowledge) return [];

    const normalizedPage = pageName.toLowerCase().replace(/\s+/g, '');
    return this.knowledge.testPatterns[normalizedPage] || [];
  }

  /**
   * Enhance element search strategy with console knowledge
   * @param {string} pageName - Current page
   * @param {Object} targetElement - Element from inferTargetElementFromBug
   * @returns {Object} Enhanced target element with console knowledge
   */
  enhanceElementSearch(pageName, targetElement) {
    const knowledge = this.findElement(pageName, targetElement.name);

    if (!knowledge) {
      // No knowledge found, return original
      return targetElement;
    }

    console.log(`   📚 Console knowledge found for "${targetElement.name}":`);

    if (knowledge.ids.length > 0) {
      console.log(`      IDs: ${knowledge.ids.join(', ')}`);
    }

    if (knowledge.testIds.length > 0) {
      console.log(`      Test IDs: ${knowledge.testIds.join(', ')}`);
    }

    if (knowledge.texts.length > 0) {
      console.log(`      Known texts: ${knowledge.texts.join(', ')}`);
    }

    // Merge with target element
    return {
      ...targetElement,
      // Add known selectors
      knownSelectors: knowledge.selectors,
      knownIds: knowledge.ids,
      knownTestIds: knowledge.testIds,
      // Enhance text search terms with known variations
      textSearchTerms: [
        ...targetElement.textSearchTerms,
        ...knowledge.texts
      ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
      // Add attribute search from IDs
      attributeSearchTerms: [
        ...targetElement.attributeSearchTerms,
        ...knowledge.ids.map(id => id.toLowerCase()),
        ...knowledge.testIds.map(id => id.toLowerCase())
      ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
      // Override HTML tags if we have specific knowledge
      htmlTags: knowledge.htmlTags.length > 0 ? knowledge.htmlTags : targetElement.htmlTags,
      // Add i18n keys
      i18nKeys: knowledge.i18nKeys
    };
  }
}

module.exports = { ConsoleKnowledgeHelper };
