// Debug Stagehand API
require('dotenv').config();
const { Stagehand } = require('@browserbasehq/stagehand');

async function debugStagehand() {
  console.log("Initializing Stagehand...");

  const stagehand = new Stagehand({
    env: 'LOCAL',
    headless: false,
    verbose: 2
  });

  await stagehand.init();

  console.log("\nStagehand object properties:");
  console.log(Object.keys(stagehand));

  console.log("\nStagehand.page type:", typeof stagehand.page);
  console.log("Stagehand.page value:", stagehand.page);

  console.log("\nStagehand.ctx:", stagehand.ctx);
  console.log("\nStagehand.ctx.page:", stagehand.ctx?.page);

  console.log("\nTrying to get page from pagesByTarget...");
  const pages = Array.from(stagehand.ctx.pagesByTarget.values());
  console.log("Number of pages:", pages.length);

  if (pages.length > 0) {
    const page = pages[0];
    console.log("Got page:", !!page);

    try {
      await page.goto('https://example.com');
      console.log("✅ Navigation worked!");
      await page.screenshot({ path: 'debug-screenshot.png' });
      console.log("✅ Screenshot worked!");
    } catch (e) {
      console.error("❌ Failed:", e.message);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
  await stagehand.close();
}

debugStagehand().catch(console.error);
