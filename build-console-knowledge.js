#!/usr/bin/env node
// Console Knowledge Extractor
// Extracts element selectors, IDs, and text from the ACM console repo
// to improve validation agent element targeting

const fs = require('fs').promises;
const path = require('path');

const CONSOLE_REPO = '/Users/rbrunopi/Repositories/console';
const OUTPUT_FILE = path.join(__dirname, 'agent/config/console-knowledge.json');

class ConsoleKnowledgeExtractor {
  constructor() {
    this.knowledge = {
      pages: {},
      components: {},
      i18n: {},
      testPatterns: {},
      metadata: {
        extracted_at: new Date().toISOString(),
        console_repo: CONSOLE_REPO
      }
    };
  }

  async extract() {
    console.log('📚 Building Console Knowledge Base...\n');

    // Step 1: Extract i18n translations (foundation)
    await this.extractI18n();

    // Step 2: Extract test patterns (how developers find elements)
    await this.extractTestPatterns();

    // Step 3: Extract component metadata (actual DOM structure)
    await this.extractComponentMetadata();

    // Step 4: Save knowledge base
    await this.saveKnowledge();

    console.log('\n✅ Console knowledge base built successfully!');
    console.log(`📁 Saved to: ${OUTPUT_FILE}\n`);
  }

  async extractI18n() {
    console.log('🌐 Extracting i18n translations...');

    const translationPath = path.join(CONSOLE_REPO, 'frontend/public/locales/en/translation.json');

    try {
      const content = await fs.readFile(translationPath, 'utf8');
      const translations = JSON.parse(content);

      // Index by key for quick lookup
      this.knowledge.i18n = translations;

      // Build reverse index: text -> key
      const textToKey = {};
      for (const [key, value] of Object.entries(translations)) {
        if (typeof value === 'string') {
          textToKey[value.toLowerCase()] = key;
        }
      }
      this.knowledge.i18n_reverse = textToKey;

      console.log(`   ✓ Loaded ${Object.keys(translations).length} translations\n`);
    } catch (error) {
      console.log(`   ⚠️  Could not load translations: ${error.message}\n`);
    }
  }

  async extractTestPatterns() {
    console.log('🧪 Extracting test patterns...');

    const testFiles = await this.findFiles(
      path.join(CONSOLE_REPO, 'frontend/src/routes/Infrastructure/Clusters'),
      /\.test\.(tsx?)$/
    );

    let patternsFound = 0;

    for (const testFile of testFiles) {
      const content = await fs.readFile(testFile, 'utf8');
      const pageName = this.inferPageNameFromPath(testFile);

      // Extract test patterns
      const patterns = this.parseTestFile(content);

      if (patterns.length > 0) {
        if (!this.knowledge.testPatterns[pageName]) {
          this.knowledge.testPatterns[pageName] = [];
        }
        this.knowledge.testPatterns[pageName].push(...patterns);
        patternsFound += patterns.length;
      }
    }

    console.log(`   ✓ Found ${patternsFound} test patterns across ${Object.keys(this.knowledge.testPatterns).length} pages\n`);
  }

  parseTestFile(content) {
    const patterns = [];

    // Pattern: clickByText('text', index)
    const clickByTextMatches = content.matchAll(/clickByText\(['"]([^'"]+)['"]/g);
    for (const match of clickByTextMatches) {
      patterns.push({
        type: 'click',
        method: 'clickByText',
        text: match[1],
        selector: null
      });
    }

    // Pattern: typeByTestId('testId', value)
    const typeByTestIdMatches = content.matchAll(/typeByTestId\(['"]([^'"]+)['"]/g);
    for (const match of typeByTestIdMatches) {
      patterns.push({
        type: 'input',
        method: 'typeByTestId',
        testId: match[1],
        selector: `[data-testid="${match[1]}"]`
      });
    }

    // Pattern: waitForText('text')
    const waitForTextMatches = content.matchAll(/waitForText\(['"]([^'"]+)['"]/g);
    for (const match of waitForTextMatches) {
      patterns.push({
        type: 'text',
        method: 'waitForText',
        text: match[1],
        selector: null
      });
    }

    // Pattern: getByRole('button', { name: 'text' })
    const getByRoleMatches = content.matchAll(/getByRole\(['"]([^'"]+)['"],\s*\{\s*name:\s*['"]([^'"]+)['"]/g);
    for (const match of getByRoleMatches) {
      patterns.push({
        type: 'role',
        method: 'getByRole',
        role: match[1],
        name: match[2],
        selector: `[role="${match[1]}"]`
      });
    }

    return patterns;
  }

  async extractComponentMetadata() {
    console.log('🧩 Extracting component metadata...');

    const componentFiles = await this.findFiles(
      path.join(CONSOLE_REPO, 'frontend/src/routes/Infrastructure/Clusters'),
      /\.(tsx?)$/,
      /\.test\./  // Exclude test files
    );

    let componentsProcessed = 0;

    for (const componentFile of componentFiles) {
      const content = await fs.readFile(componentFile, 'utf8');
      const componentName = this.inferComponentNameFromPath(componentFile);

      const metadata = this.parseComponentFile(content);

      if (metadata.elements.length > 0 || metadata.ids.length > 0) {
        this.knowledge.components[componentName] = metadata;
        componentsProcessed++;
      }
    }

    console.log(`   ✓ Processed ${componentsProcessed} components\n`);
  }

  parseComponentFile(content) {
    const metadata = {
      elements: [],
      ids: [],
      testIds: [],
      ariaLabels: [],
      buttons: []
    };

    // Extract id attributes: id="something"
    const idMatches = content.matchAll(/id=["']([^"']+)["']/g);
    for (const match of idMatches) {
      metadata.ids.push(match[1]);
    }

    // Extract data-testid attributes
    const testIdMatches = content.matchAll(/data-testid=["']([^"']+)["']/g);
    for (const match of testIdMatches) {
      metadata.testIds.push(match[1]);
    }

    // Extract aria-label attributes
    const ariaLabelMatches = content.matchAll(/aria-label=["']([^"']+)["']/g);
    for (const match of ariaLabelMatches) {
      metadata.ariaLabels.push(match[1]);
    }

    // Extract button patterns: <Button ... label={t('key')} or label="text"
    const buttonLabelMatches = content.matchAll(/label=\{t\(['"]([^'"]+)['"]\)\}|label=["']([^"']+)["']/g);
    for (const match of buttonLabelMatches) {
      const i18nKey = match[1];
      const literalText = match[2];

      if (i18nKey && this.knowledge.i18n[i18nKey]) {
        metadata.buttons.push({
          text: this.knowledge.i18n[i18nKey],
          i18nKey: i18nKey
        });
      } else if (literalText) {
        metadata.buttons.push({
          text: literalText,
          i18nKey: null
        });
      }
    }

    return metadata;
  }

  async findFiles(dir, includePattern, excludePattern = null) {
    const files = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...await this.findFiles(fullPath, includePattern, excludePattern));
        } else if (entry.isFile()) {
          if (includePattern.test(entry.name)) {
            if (!excludePattern || !excludePattern.test(entry.name)) {
              files.push(fullPath);
            }
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }

    return files;
  }

  inferPageNameFromPath(filePath) {
    const relativePath = filePath.replace(CONSOLE_REPO, '');
    const match = relativePath.match(/\/routes\/Infrastructure\/Clusters\/([^\/]+)/);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  inferComponentNameFromPath(filePath) {
    const basename = path.basename(filePath, path.extname(filePath));
    return basename;
  }

  async saveKnowledge() {
    console.log('💾 Saving knowledge base...');

    // Ensure directory exists
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

    // Save pretty-printed JSON
    await fs.writeFile(
      OUTPUT_FILE,
      JSON.stringify(this.knowledge, null, 2),
      'utf8'
    );

    // Generate summary
    const stats = {
      pages: Object.keys(this.knowledge.testPatterns).length,
      components: Object.keys(this.knowledge.components).length,
      translations: Object.keys(this.knowledge.i18n).length,
      testPatterns: Object.values(this.knowledge.testPatterns).flat().length
    };

    console.log('\n📊 Knowledge Base Statistics:');
    console.log(`   Pages with tests: ${stats.pages}`);
    console.log(`   Components: ${stats.components}`);
    console.log(`   i18n keys: ${stats.translations}`);
    console.log(`   Test patterns: ${stats.testPatterns}`);
  }
}

// Run extraction
async function main() {
  const extractor = new ConsoleKnowledgeExtractor();
  await extractor.extract();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

module.exports = { ConsoleKnowledgeExtractor };
