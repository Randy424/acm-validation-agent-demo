// Debug script to see what Stagehand gives us
require('dotenv').config();
const { Stagehand } = require("@browserbasehq/stagehand");

async function debug() {
  console.log("🔍 Debugging Stagehand API...\n");

  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 2,
    headless: true
  });

  try {
    const initResult = await stagehand.init();
    console.log("Init result:", initResult);
    console.log("\nStagehand object keys:", Object.keys(stagehand));
    console.log("\nStagehand properties:");
    for (const key of Object.keys(stagehand)) {
      console.log(`  - ${key}: ${typeof stagehand[key]}`);
    }

    // Try to navigate
    console.log("\n📄 Attempting navigation...");
    await stagehand.goto("https://example.com");
    console.log("✅ Navigation worked with stagehand.goto()!");

    // Try to take screenshot
    console.log("\n📸 Attempting screenshot...");
    await stagehand.screenshot({ path: "debug-screenshot.png" });
    console.log("✅ Screenshot worked!");

    await stagehand.close();
    console.log("\n✅ Debug complete!");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (stagehand) {
      await stagehand.close().catch(() => {});
    }
  }
}

debug();
