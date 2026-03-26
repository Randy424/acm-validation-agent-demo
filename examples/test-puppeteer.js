// Test Puppeteer browser automation
const puppeteer = require('puppeteer');

async function testPuppeteer() {
  console.log("🚀 Starting Puppeteer test...\n");

  const browser = await puppeteer.launch({
    headless: false,  // Show browser window
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log("✅ Browser launched\n");

    // Test 1: Navigate to example.com
    console.log("📄 Test 1: Navigating to example.com...");
    await page.goto('https://example.com', { waitUntil: 'networkidle2' });
    console.log("✅ Navigation successful\n");

    // Test 2: Extract the heading text
    console.log("👀 Test 2: Extracting heading text...");
    const heading = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent : 'No heading found';
    });
    console.log(`✅ Found heading: "${heading}"\n`);

    // Test 3: Take a screenshot
    console.log("📸 Test 3: Taking screenshot...");
    await page.screenshot({
      path: 'puppeteer-test-screenshot.png',
      fullPage: true
    });
    console.log("✅ Screenshot saved as puppeteer-test-screenshot.png\n");

    // Test 4: Take a video recording (using page.video if available)
    console.log("🎥 Note: Video recording can be added with puppeteer-screen-recorder\n");

    console.log("🎉 All tests passed!\n");
    console.log("Puppeteer is working correctly and ready for ACM demo.");

    await browser.close();

  } catch (error) {
    console.error("❌ Error:", error.message);
    await browser.close();
    process.exit(1);
  }
}

testPuppeteer()
  .then(() => {
    console.log("\n✅ Test complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
