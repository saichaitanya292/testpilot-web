const { test, expect } = require("@playwright/test");

const target = process.env.BASE_URL;
const scenario = (process.env.TEST_SCENARIO || "Search for jobs").trim();
const searchTerm = (process.env.SEARCH_TERM || "software engineer").trim();

if (!target) throw new Error("BASE_URL must be set by the GitHub Actions workflow");

const searchInputCandidates = [
  'input[type="search"]',
  'input[role="searchbox"]',
  'input[name*="search" i]',
  'input[id*="search" i]',
  'input[placeholder*="search" i]',
  'input[aria-label*="search" i]',
  'input[name*="job" i]',
  'input[id*="job" i]',
  'input[placeholder*="job" i]',
  'input[aria-label*="job" i]',
  'input[name*="keyword" i]',
  'input[placeholder*="keyword" i]',
  'form[role="search"] input',
  'input[type="text"]'
];

async function firstVisible(locator) {
  const count = await locator.count();
  for (let i = 0; i < Math.min(count, 20); i++) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
      return candidate;
    }
  }
  return null;
}

test.describe("Natural-language browser scenario", () => {
  test("discovers controls and executes: " + scenario, async ({ page }) => {
    test.setTimeout(90000);
    const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
    expect(response, "The target website should return an HTTP response").not.toBeNull();
    expect(response.status(), "The target website should not return 4xx/5xx").toBeLessThan(400);

    const normalized = scenario.toLowerCase();
    if (normalized.includes("search") && (normalized.includes("job") || normalized.includes("jobs") || normalized.includes("keyword") || normalized.includes("item"))) {
      let input = null;
      for (const selector of searchInputCandidates) {
        input = await firstVisible(page.locator(selector));
        if (input) break;
      }

      if (!input) {
        const visibleInputs = await page.locator("input, [role='searchbox'], textarea").evaluateAll(nodes =>
          nodes.filter(node => {
            const r = node.getBoundingClientRect();
            const s = getComputedStyle(node);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
          }).map(node => ({
            tag: node.tagName,
            type: node.getAttribute("type"),
            name: node.getAttribute("name"),
            id: node.id,
            placeholder: node.getAttribute("placeholder"),
            ariaLabel: node.getAttribute("aria-label")
          }))
        );
        throw new Error("Could not automatically identify a visible search field. Visible fields discovered: " + JSON.stringify(visibleInputs));
      }

      await input.fill(searchTerm);
      const submitCandidates = [
        page.getByRole("button", { name: /search|find jobs|find|go/i }),
        page.locator('button[type="submit"]'),
        page.locator('input[type="submit"]'),
        page.locator('[role="button"][aria-label*="search" i]')
      ];
      let submit = null;
      for (const candidate of submitCandidates) {
        submit = await firstVisible(candidate);
        if (submit) break;
      }

      const beforeUrl = page.url();
      if (submit) {
        await submit.click();
      } else {
        await input.press("Enter");
      }

      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1800);
      await expect(page.locator("body")).toBeVisible();
      const bodyText = (await page.locator("body").innerText().catch(() => "")).trim();
      expect(bodyText.length, "Page should still contain visible content after searching").toBeGreaterThan(0);

      const results = page.locator(
        '[class*="search-result" i], [id*="search-result" i], [class*="job-card" i], [class*="job-list" i], [data-testid*="result" i], [data-testid*="job" i], [role="list"]'
      );
      const resultCount = await results.count();
      const hasEmptyState = /no (jobs|results|matches)|0 jobs|nothing found|try another search/i.test(bodyText);
      const urlChanged = page.url() !== beforeUrl;
      const queryVisible = bodyText.toLowerCase().includes(searchTerm.toLowerCase());
      expect(
        resultCount > 0 || hasEmptyState || urlChanged || queryVisible,
        "Search was submitted but no result state could be detected. Inspect the screenshot/trace and adjust the app's result selectors if needed."
      ).toBeTruthy();

      console.log(JSON.stringify({
        scenario,
        discoveredSearchField: await input.evaluate(node => ({
          tag: node.tagName,
          type: node.getAttribute("type"),
          name: node.getAttribute("name"),
          id: node.id,
          placeholder: node.getAttribute("placeholder"),
          ariaLabel: node.getAttribute("aria-label")
        })),
        clickedSearchButton: Boolean(submit),
        searchTerm,
        finalUrl: page.url(),
        resultLikeElements: resultCount,
        emptyStateDetected: hasEmptyState
      }, null, 2));
    } else {
      // Safe generic discovery mode for scenarios not yet mapped to an executable action.
      const controls = await page.locator("input, button, a, select, textarea, [role='button']").evaluateAll(nodes =>
        nodes.filter(node => {
          const r = node.getBoundingClientRect();
          const s = getComputedStyle(node);
          return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
        }).slice(0, 100).map(node => ({
          tag: node.tagName,
          text: (node.innerText || node.value || "").trim().slice(0, 80),
          role: node.getAttribute("role"),
          type: node.getAttribute("type"),
          name: node.getAttribute("name"),
          placeholder: node.getAttribute("placeholder"),
          ariaLabel: node.getAttribute("aria-label"),
          href: node.getAttribute("href")
        }))
      );
      console.log("Scenario is not mapped to an executable action yet. Discovered visible controls:", JSON.stringify(controls, null, 2));
      expect(controls.length, "The page should expose some visible interactive controls for automatic discovery").toBeGreaterThan(0);
    }
  });
});
