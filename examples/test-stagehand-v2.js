// Test script for Stagehand - using correct API
require('dotenv').config();
const { Stagehand } = require("@browserbasehq/stagehand");

async function testStagehand() {
  console.log("🚀 Starting Stagehand test (v2)...\n");

  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 1,
    headless: true
  });

  try {
    await stagehand.init();
    console.log("✅ Stagehand initialized\n");

    // Check if we have access to page through ctx
    const page = stagehand.ctx?.page || stagehand.page;
    console.log("Page available:", !!page);

    if (page) {
      console.log("📄 Navigating to example.com...");
      await page.goto("https://example.com");
      console.log("✅ Navigation successful\n");

      console.log("📸 Taking screenshot...");
      await page.screenshot({ path: "test-screenshot.png" });
      console.log("✅ Screenshot saved\n");
    }

    // Try using the act method directly
    console.log("🤖 Testing act method...");
    if (typeof stagehand.act === 'function') {
      const result = await stagehand.act({
        action: "go to https://example.com"
      });
      console.log("✅ Act method worked:", result);
    } else {
      console.log("ℹ️  Act method not available directly");
    }

    await stagehand.close();
    console.log("\n✅ Test complete!");

  } catch (error) {
    console.error("❌ Error:", error.message);
    if (stagehand) {
      await stagehand.close().catch(() => {});
    }
  }
}

testStagehand();
