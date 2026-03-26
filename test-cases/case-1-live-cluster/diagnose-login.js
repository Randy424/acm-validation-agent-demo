// Quick diagnostic to see login page structure
const puppeteer = require('puppeteer');

async function diagnoseLogin() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  console.log("Navigating to console...");
  await page.goto('https://console-openshift-console.apps.your-cluster.example.com', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log("\n=== Page Info ===");
  const info = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      bodyText: document.body.textContent.substring(0, 500)
    };
  });
  console.log('URL:', info.url);
  console.log('Title:', info.title);
  console.log('Body text preview:', info.bodyText.substring(0, 200));

  console.log("\n=== All Input Elements ===");
  const inputs = await page.evaluate(() => {
    const allInputs = Array.from(document.querySelectorAll('input'));
    return allInputs.map(input => ({
      type: input.type,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      className: input.className,
      visible: input.offsetWidth > 0 && input.offsetHeight > 0
    }));
  });
  console.log(JSON.stringify(inputs, null, 2));

  console.log("\n=== All Buttons ===");
  const buttons = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    return allButtons.map(btn => ({
      text: btn.textContent.trim(),
      type: btn.type,
      className: btn.className,
      visible: btn.offsetWidth > 0 && btn.offsetHeight > 0
    }));
  });
  console.log(JSON.stringify(buttons, null, 2));

  console.log("\n=== All Links ===");
  const links = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a'));
    return allLinks.slice(0, 10).map(link => ({
      text: link.textContent.trim().substring(0, 50),
      href: link.href,
      visible: link.offsetWidth > 0 && link.offsetHeight > 0
    }));
  });
  console.log(JSON.stringify(links, null, 2));

  await page.screenshot({ path: __dirname + '/login-diagnostic.png', fullPage: true });
  console.log('\n✅ Screenshot saved: login-diagnostic.png');

  console.log('\nKeeping browser open for 30 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
}

diagnoseLogin().catch(console.error);
