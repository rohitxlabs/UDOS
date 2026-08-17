import { chromium } from "playwright";

const base = "http://localhost:3000";
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

async function shot(name) {
  await page.screenshot({ path: `/private/tmp/claude-501/-Users-ro-Developer-Projects-UDOS-UDOS2/b7e3005b-a1ff-4db8-8473-5375e7a2afef/scratchpad/${name}.png`, fullPage: true });
}

console.log("1) nav /");
await page.goto(base + "/");
await page.waitForURL("**/login");
console.log("   -> redirected to", page.url());
await shot("01-login");

console.log("2) login as rohit");
await page.fill("#username", "rohit");
await page.fill("#password", "admin@master");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");
console.log("   -> now at", page.url());
await shot("02-dashboard");

console.log("3) sidebar links");
const links = await page.locator("aside nav a").allTextContents();
console.log("   sidebar:", links);

console.log("4) users page - create user");
await page.goto(base + "/dashboard/users");
await page.waitForSelector("text=New user");
await page.click("text=New user");
await page.fill("#name", "Test Teacher");
await page.selectOption("#role", "TEACHER");
await page.click('button:has-text("Create account")');
await page.waitForSelector("text=Credentials for Test Teacher", { timeout: 10000 });
await shot("03-credentials-dialog");
const creds = await page.locator("code").allTextContents();
console.log("   generated creds:", creds);
await page.click('button:has-text("Done")');
await page.waitForSelector("text=Test Teacher");
await shot("04-users-table");

console.log("5) settings page");
await page.goto(base + "/dashboard/settings");
await page.fill("#name", "Demo College");
await page.click('button:has-text("Save settings")');
await page.waitForSelector("text=College settings saved", { timeout: 10000 });
await shot("05-settings-saved");

console.log("6) audit logs");
await page.goto(base + "/dashboard/audit-logs");
await page.waitForSelector("table");
const rows = await page.locator("table tbody tr").allTextContents();
console.log("   audit rows:", rows.slice(0, 10));
await shot("06-audit-logs");

console.log("\n--- console errors ---");
console.log(errors.length ? errors : "none");

await browser.close();
