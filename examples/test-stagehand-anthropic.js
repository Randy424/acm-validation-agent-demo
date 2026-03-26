// Test script for Stagehand using Anthropic/Claude
require('dotenv').config();
const { Stagehand } = require("@browserbasehq/stagehand");
const { Anthropic } = require("@anthropic-ai/sdk");

async function testStagehand() {
  console.log("🚀 Starting Stagehand test with Anthropic/Claude...\n");

  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 1,
    headless: false,  // Show browser
    debugDom: false,
    llmProvider: "anthropic",
    llmClientOptions: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: "claude-3-5-sonnet-20241022"
    }
  });

  try {
    await stagehand.init();
    console.log("✅ Stagehand initialized with Anthropic\n");

    // Test 1: Navigate using AI
    console.log("📄 Test 1: Navigate to example.com using AI...");
    await stagehand.act("navigate to https://example.com");
    console.log("✅ Navigation successful\n");

    // Wait a moment for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 2: Extract information
    console.log("👀 Test 2: Extract information using AI...");
    const heading = await stagehand.extract("what is the main heading text on this page?");
    console.log(`✅ AI extracted: "${heading}"\n`);

    // Test 3: Screenshot if page is accessible
    console.log("📸 Test 3: Taking screenshot...");
    if (stagehand.ctx && stagehand.ctx.page) {
      await stagehand.ctx.page.screenshot({ path: "test-screenshot.png", fullPage: true });
      console.log("✅ Screenshot saved\n");
    }

    console.log("🎉 All tests passed! Stagehand + Anthropic is working!\n");

    await stagehand.close();

  } catch (error) {
    console.error("❌ Error during test:");
    console.error(error.message);

    if (stagehand) {
      await stagehand.close().catch(() => {});
    }
    process.exit(1);
  }
}

// Run the test
testStagehand()
  .then(() => {
    console.log("✅ Test complete - Ready for ACM demo!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
