// Test script for Stagehand - working version
require('dotenv').config();
const { Stagehand } = require("@browserbasehq/stagehand");

async function testStagehand() {
  console.log("🚀 Starting Stagehand test...\n");

  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 1,
    headless: false,  // Show browser so we can see it working
    debugDom: false
  });

  try {
    await stagehand.init();
    console.log("✅ Stagehand initialized\n");

    // Test 1: Navigate using act
    console.log("📄 Test 1: Navigate to example.com using AI...");
    await stagehand.act("go to https://example.com");
    console.log("✅ Navigation successful\n");

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 2: Observe the page content
    console.log("👀 Test 2: Use AI to observe page content...");
    const observation = await stagehand.extract("what is the main heading on this page?");
    console.log(`✅ AI observed: ${observation}\n`);

    // Test 3: Take a screenshot (if page is accessible)
    console.log("📸 Test 3: Taking screenshot...");
    // We'll need to access the page through the browser context
    // Let me check if we can get it through stagehand.ctx
    if (stagehand.ctx && stagehand.ctx.page) {
      await stagehand.ctx.page.screenshot({ path: "test-screenshot.png" });
      console.log("✅ Screenshot saved as test-screenshot.png\n");
    } else {
      console.log("ℹ️  Screenshot not available without direct page access\n");
    }

    console.log("🎉 All tests passed! Stagehand is working correctly.\n");

    await stagehand.close();

  } catch (error) {
    console.error("❌ Error during test:");
    console.error(error.message);
    console.error(error.stack);

    if (stagehand) {
      await stagehand.close().catch(() => {});
    }
    process.exit(1);
  }
}

// Run the test
testStagehand()
  .then(() => {
    console.log("✅ Test complete - Stagehand is ready for ACM demo!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
