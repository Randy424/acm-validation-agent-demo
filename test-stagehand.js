// Test script for Stagehand AI browser automation
require('dotenv').config();
const { Stagehand } = require("@browserbasehq/stagehand");

async function testStagehand() {
  console.log("🚀 Starting Stagehand test...\n");

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ Error: ANTHROPIC_API_KEY not found in environment");
    console.log("\nTo fix this:");
    console.log("1. Get your API key from: https://console.anthropic.com/");
    console.log("2. Create a .env file with: ANTHROPIC_API_KEY=your-key-here");
    console.log("3. Or export it: export ANTHROPIC_API_KEY=your-key-here\n");
    process.exit(1);
  }

  console.log("✅ API key found");
  console.log("✅ Initializing Stagehand...\n");

  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 1,
    debugDom: true,
    enableCaching: false,
    headless: false  // Show browser for demo purposes
  });

  try {
    await stagehand.init();
    console.log("✅ Stagehand initialized successfully\n");

    // Get the page object from context
    const page = stagehand.page;

    if (!page) {
      throw new Error("Page object not available after init");
    }

    // Test 1: Navigate to a simple page
    console.log("📄 Test 1: Navigate to example.com...");
    await page.goto("https://example.com");
    console.log("✅ Navigation successful\n");

    // Wait a moment for the page to load
    await page.waitForTimeout(2000);

    // Test 2: Take a screenshot
    console.log("📸 Test 2: Taking screenshot...");
    await page.screenshot({
      path: "test-screenshot.png",
      fullPage: true
    });
    console.log("✅ Screenshot saved as test-screenshot.png\n");

    // Test 3: Use AI to act on the page
    console.log("🤖 Test 3: Using AI to interact with page...");
    const result = await stagehand.act({
      action: "observe the main heading on this page"
    });
    console.log(`✅ AI result: ${JSON.stringify(result, null, 2)}\n`);

    console.log("🎉 All tests passed! Stagehand is working correctly.\n");

    await stagehand.close();

  } catch (error) {
    console.error("❌ Error during test:");
    console.error(error.message);
    console.error(error.stack);

    if (error.message.includes("API key")) {
      console.log("\n💡 Tip: Make sure your ANTHROPIC_API_KEY is valid");
    }

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
