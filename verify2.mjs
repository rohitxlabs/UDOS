import { chromium } from "playwright";

const base = "http://localhost:3000";
const errors = [];
const shotDir = "/private/tmp/claude-501/-Users-ro-Developer-Projects-UDOS-UDOS2/b7e3005b-a1ff-4db8-8473-5375e7a2afef/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

async function shot(name) {
  await page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: true });
}

console.log("login");
await page.goto(base + "/login");
await page.fill("#username", "rohit");
await page.fill("#password", "admin@master");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");
await shot("p2-01-dashboard");

console.log("sidebar groups");
const groups = await page.locator("aside nav p").allTextContents();
const links = await page.locator("aside nav a").allTextContents();
console.log("  groups:", groups);
console.log("  links:", links);

console.log("1) department");
await page.goto(base + "/dashboard/departments");
await page.click("text=New department");
await page.fill("#name", "Computer Science");
await page.fill("#code", "CSE");
await page.click('button:has-text("Create department")');
await page.waitForSelector("text=Computer Science");
await shot("p2-02-department");

console.log("2) academic year");
await page.goto(base + "/dashboard/academic-years");
await page.click("text=New academic year");
await page.fill("#name", "2026-27");
await page.fill("#startDate", "2026-07-01");
await page.fill("#endDate", "2027-05-31");
await page.click('button:has-text("Create academic year")');
await page.waitForSelector("text=2026-27");
await shot("p2-03-academic-year");

console.log("3) course");
await page.goto(base + "/dashboard/courses");
await page.click("text=New course");
await page.selectOption("#departmentId", { label: "Computer Science" });
await page.fill("#name", "B.Tech CSE");
await page.fill("#code", "BTCSE");
await page.fill("#durationSemesters", "8");
await page.click('button:has-text("Create course")');
await page.waitForSelector("text=B.Tech CSE");
await shot("p2-04-course");

console.log("4) generate semesters");
await page.goto(base + "/dashboard/semesters");
await page.click("text=Generate semesters");
await page.selectOption("#courseId", { label: "B.Tech CSE" });
await page.selectOption("#academicYearId", { label: "2026-27" });
await page.click('.fixed.inset-0 button[type="submit"]');
await page.waitForSelector("text=Semester 1");
await shot("p2-05-semesters");

console.log("5) section");
await page.goto(base + "/dashboard/sections");
await page.click("text=New section");
await page.selectOption("#semesterId", { label: "B.Tech CSE — 2026-27 — Sem 1" });
await page.fill("#name", "A");
await page.click('button:has-text("Create section")');
await page.waitForSelector("text=Section");
await shot("p2-06-section");

console.log("6) subject");
await page.goto(base + "/dashboard/subjects");
await page.click("text=New subject");
await page.selectOption("#semesterId", { label: "B.Tech CSE — 2026-27 — Sem 1" });
await page.fill("#name", "Data Structures");
await page.fill("#code", "CS201");
await page.fill("#credits", "4");
await page.fill("#maxMarks", "100");
await page.fill("#passMarks", "40");
await page.click('button:has-text("Create subject")');
await page.waitForSelector("text=Data Structures");
await shot("p2-07-subject");

console.log("7) faculty");
await page.goto(base + "/dashboard/faculty/new");
await page.fill("#name", "Dr. Asha Rao");
await page.fill("#employeeId", "EMP001");
await page.selectOption("#departmentId", { label: "Computer Science" });
await page.fill("#designation", "Professor");
await page.click('button:has-text("Create faculty account")');
await page.waitForSelector("text=Credentials for Dr. Asha Rao", { timeout: 10000 });
await shot("p2-08-faculty-creds");
await page.click('button:has-text("Done")');
await page.waitForURL("**/dashboard/faculty");
await shot("p2-09-faculty-list");

console.log("8) faculty detail + assignment");
await page.click("text=Dr. Asha Rao");
await page.waitForSelector("text=Subject assignments");
await page.selectOption("#assign-semester", { label: "B.Tech CSE — 2026-27 — Sem 1" });
await page.selectOption("#assign-subject", { label: "Data Structures" });
await page.selectOption("#assign-section", { label: "A" });
await page.click('button:has-text("Assign")');
await page.waitForSelector("text=Data Structures — Section A", { timeout: 10000 }).catch(() => {});
await shot("p2-10-faculty-assignment");

console.log("9) student");
await page.goto(base + "/dashboard/students/new");
await page.selectOption("#courseId", { label: "B.Tech CSE" });
await page.selectOption("#semesterPicker", { label: "2026-27 — Sem 1" });
await page.selectOption("#sectionId", { label: "A" });
await page.fill("#admissionNumber", "ADM2026001");
await page.fill("#name", "Riya Sharma");
await page.click('button:has-text("Create student account")');
await page.waitForSelector("text=Credentials for Riya Sharma", { timeout: 10000 });
await shot("p2-11-student-creds");
await page.click('button:has-text("Done")');
await page.waitForURL("**/dashboard/students");
await shot("p2-12-student-list");

console.log("10) student edit");
await page.click("text=Riya Sharma");
await page.waitForSelector("#status");
await shot("p2-13-student-edit");

console.log("\n--- console errors ---");
console.log(errors.length ? errors : "none");

await browser.close();
