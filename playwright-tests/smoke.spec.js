const { test, expect } = require("@playwright/test");

const target = process.env.BASE_URL;
if (!target) throw new Error("BASE_URL must be set by the GitHub Actions workflow");

test.describe("TestPilot website smoke tests", () => {
  test("website responds successfully", async ({ page }) => {
    const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
    expect(response, "Navigation should return an HTTP response").not.toBeNull();
    expect(response.status(), "Website should not return a 4xx/5xx status").toBeLessThan(400);
  });

  test("page has a meaningful title and visible content", async ({ page }) => {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
    await expect(page.locator("body")).toBeVisible();
    const title = (await page.title()).trim();
    expect(title.length, "Page title should not be empty").toBeGreaterThan(0);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("page has no uncaught JavaScript page errors during initial load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("page has a usable viewport without severe horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth
    }));
    expect(dimensions.page, "Page should not overflow horizontally on a mobile viewport")
      .toBeLessThanOrEqual(dimensions.viewport + 2);
  });

  test("internal links have destinations", async ({ page }) => {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
    const missing = await page.locator("a").evaluateAll(links =>
      links.filter(link => !link.getAttribute("href") || !link.getAttribute("href").trim())
        .map(link => (link.textContent || "").trim()).slice(0, 10)
    );
    expect(missing, "Anchors should have href destinations").toEqual([]);
  });
});
