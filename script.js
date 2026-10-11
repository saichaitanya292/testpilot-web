(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const requirement = $("requirement");
  const typeSelect = $("test-type");
  const prioritySelect = $("priority");
  const generateBtn = $("generate-btn");
  let latestCases = [];
  let latestRequirement = "";
  let latestType = "both";

  const esc = (value) => String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const shorten = (s, max = 110) => s.length > max ? s.slice(0, max - 1).trim() + "…" : s;
  const low = (s) => s.toLowerCase();
  const has = (s, terms) => terms.some(term => s.includes(term));
  const addCase = (arr, title, description, type, priority = "medium") => arr.push({ id: arr.length + 1, title, description, type, priority });

  function buildCases(text, kind) {
    const s = low(text);
    const cases = [];
    const ui = kind !== "api";
    const api = kind !== "ui";
    const auth = has(s, ["login","log in","sign in","signin","password","authentication","authenticate","account"]);
    const form = has(s, ["form","submit","input","field","required","validation","register","sign up","signup","email"]);
    const payment = has(s, ["payment","checkout","cart","order","purchase","refund","price","coupon"]);
    const search = has(s, ["search","filter","sort","query","results"]);
    const upload = has(s, ["upload","file","attachment","document","image"]);
    const role = has(s, ["role","permission","admin","authorized","access","forbidden"]);
    const reset = has(s, ["reset","forgot password","recover password"]);
    const generic = [
      ["Positive path", "Complete the main user journey with valid data and verify the expected success state.", "high"],
      ["Required data and empty input", "Submit with required values missing or empty; verify validation feedback and that invalid data is not accepted.", "high"],
      ["Invalid and boundary values", "Try malformed, unsupported, and boundary values; verify the application handles them safely and clearly.", "high"],
      ["Error handling and recovery", "Simulate a failed action or unavailable dependency; verify a useful error is shown and the user can recover.", "medium"],
      ["Repeated action / idempotency", "Repeat the same action and verify it does not create unintended duplicate or inconsistent results.", "medium"],
      ["Keyboard and accessibility", "Navigate the key controls with a keyboard and verify labels, focus visibility, and accessible feedback.", "medium"],
      ["Responsive layout", "Check the flow at mobile, tablet, and desktop viewport sizes; verify controls remain usable.", "low"],
      ["Data persistence", "Refresh or revisit the relevant view and verify saved state is retained only when expected.", "medium"]
    ];
    if (ui) {
      if (auth) {
        addCase(cases, "Sign in with valid credentials", "Enter a registered account and correct password; verify successful authentication and the expected landing page.", "UI", "high");
        addCase(cases, "Reject invalid credentials", "Enter an incorrect password or unknown account; verify access is denied and a clear, non-sensitive error appears.", "UI", "high");
        addCase(cases, "Handle locked or disabled account", "Attempt to sign in with a locked or disabled account; verify the account policy is enforced.", "UI", "high");
        if (reset) addCase(cases, "Recover a forgotten password", "Request password recovery with a registered email and verify confirmation without revealing whether unrelated accounts exist.", "UI", "medium");
      }
      if (form) {
        addCase(cases, "Validate required fields", "Leave required fields blank and submit; verify field-level feedback and that no invalid submission is completed.", "UI", "high");
        addCase(cases, "Validate input formats", "Enter malformed email, overlong values, and disallowed characters; verify appropriate validation.", "UI", "high");
        addCase(cases, "Prevent duplicate submission", "Submit once, then rapidly activate the submit control again; verify duplicate records or requests are not created.", "UI", "medium");
      }
      if (payment) {
        addCase(cases, "Complete checkout with valid details", "Use a valid test order and payment method; verify totals, confirmation, and order state.", "UI", "high");
        addCase(cases, "Handle declined payment", "Use a payment-provider test decline; verify the order is not marked paid and retry guidance is shown.", "UI", "high");
        addCase(cases, "Verify totals and discounts", "Change quantity or apply/remove a valid and invalid coupon; verify subtotal, discount, tax, and final total.", "UI", "high");
      }
      if (search) {
        addCase(cases, "Search for an existing item", "Search with a known term and verify relevant results, count, and result navigation.", "UI", "high");
        addCase(cases, "Handle no-result and special-character queries", "Search for a nonexistent term and input containing punctuation; verify an empty state and safe handling.", "UI", "medium");
        addCase(cases, "Combine filters and sorting", "Apply multiple filters and change sort order; verify results consistently match the selected criteria.", "UI", "medium");
      }
      if (upload) {
        addCase(cases, "Upload a supported file", "Upload a valid file within the configured size limit; verify success and correct file details.", "UI", "high");
        addCase(cases, "Reject unsupported or oversized files", "Try a disallowed file type and an oversized file; verify rejection and clear feedback.", "UI", "high");
      }
      if (role) {
        addCase(cases, "Enforce role-based access", "Open a restricted page or action as a user without the required permission; verify access is denied.", "UI", "high");
      }
      generic.forEach(([title, desc, priority]) => addCase(cases, title, desc, "UI", priority));
    }
    if (api) {
      addCase(cases, "API accepts a valid request", "Send a valid request with all required fields; verify the documented success status, response schema, and persisted outcome.", "API", "high");
      addCase(cases, "API validates missing and malformed data", "Omit required fields and send invalid types or formats; verify a documented 4xx response with safe validation details.", "API", "high");
      addCase(cases, "API rejects unauthenticated requests", "Call a protected endpoint without credentials and with an invalid or expired token; verify access is denied.", "API", "high");
      addCase(cases, "API authorization boundaries", "Use a valid identity lacking the required role or ownership; verify protected data and actions are not exposed.", role ? "API" : "API", "high");
      addCase(cases, "API handles not-found and conflict cases", "Request a missing resource and attempt a conflicting or duplicate operation; verify suitable status codes.", "API", "medium");
      addCase(cases, "API response contract and headers", "Verify content type, required response fields, data types, and documented headers for the endpoint.", "API", "medium");
      addCase(cases, "API rate limits and resilience", "Exercise reasonable repeated requests and simulate a dependency failure; verify documented throttling and safe error handling.", "API", "medium");
    }
    // Keep a useful compact set and avoid duplicate titles.
    const unique = cases.filter((item, index, all) => all.findIndex(other => other.title === item.title) === index);
    return unique.map((item, index) => ({ ...item, id: index + 1 })).slice(0, 22);
  }

  function filterCases(cases) {
    const filter = prioritySelect.value;
    if (filter === "high") return cases.filter(c => c.priority === "high");
    if (filter === "medium") return cases.filter(c => c.priority !== "low");
    return cases;
  }

  function makePlaywright(text, cases) {
    const titles = cases.filter(c => c.type === "UI").slice(0, 5);
    const lines = [
      "import { test, expect } from '@playwright/test';",
      "",
      "// Starter template generated by TestPilot AI Browser Edition.",
      "// Replace the URL, selectors, test data and assertions for your application.",
      "test.describe('Requirement-based checks', () => {",
      "  test.beforeEach(async ({ page }) => {",
      "    await page.goto('http://localhost:3000'); // TODO: replace with your app URL",
      "  });",
      ""
    ];
    if (titles.length) {
      titles.forEach(c => {
        lines.push("  test(" + JSON.stringify(c.title) + ", async ({ page }) => {");
        lines.push("    // Requirement: " + text.replace(/\s+/g, " ").slice(0, 180).replace(/[\r\n]/g, " "));
        lines.push("    // TODO: add selectors and assertions for this scenario.");
        lines.push("    await expect(page.locator('body')).toBeVisible();");
        lines.push("  });", "");
      });
    } else {
      lines.push("  test('API requirement checks', async ({ request }) => {");
      lines.push("    // TODO: replace endpoint and payload with your API contract.");
      lines.push("    const response = await request.get('http://localhost:3000/health');");
      lines.push("    expect(response.ok()).toBeTruthy();");
      lines.push("  });", "");
    }
    lines.push("});", "");
    return lines.join("\n");
  }

  function renderCases(cases) {
    $("results-list").innerHTML = cases.map(c => `
      <article class="case-card">
        <div class="case-number">${String(c.id).padStart(2, "0")}</div>
        <div><h3 class="case-title">${esc(c.title)}</h3><p class="case-description">${esc(c.description)}</p><div class="case-meta"><span class="tag">${esc(c.type)}</span><span class="tag">Requirement-based</span></div></div>
        <span class="priority ${esc(c.priority)}">${esc(c.priority)}</span>
      </article>`).join("");
  }

  function readHistory() {
    try { const value = JSON.parse(localStorage.getItem("testpilot-history") || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function saveHistory(text, count, type) {
    const history = readHistory();
    history.unshift({ id: Date.now(), requirement: text, count, type, date: new Date().toLocaleString() });
    try { localStorage.setItem("testpilot-history", JSON.stringify(history.slice(0, 6))); } catch { /* storage may be disabled */ }
    renderHistory();
  }
  function renderHistory() {
    const history = readHistory();
    const target = $("history-list");
    if (!history.length) { target.innerHTML = '<div class="empty-history">Your recent runs will appear here on this device.</div>'; return; }
    target.innerHTML = history.map(item => `
      <div class="history-item"><div><div class="history-title">${esc(shorten(item.requirement, 100))}</div><div class="history-sub">${esc(item.date)} · ${Number(item.count) || 0} cases · ${esc(item.type.toUpperCase())}</div></div><button class="secondary-btn history-open" data-id="${Number(item.id)}">Use again ↗</button></div>`).join("");
    target.querySelectorAll("[data-id]").forEach(btn => btn.addEventListener("click", () => {
      const item = readHistory().find(entry => entry.id === Number(btn.dataset.id));
      if (item) { requirement.value = item.requirement; typeSelect.value = item.type; $("char-count").textContent = item.requirement.length + " / 5000"; requirement.focus(); window.scrollTo({top: 0, behavior: "smooth"}); }
    }));
  }

  function showResults(text, kind, save = true) {
    latestRequirement = text;
    latestType = kind;
    latestCases = filterCases(buildCases(text, kind));
    renderCases(latestCases);
    $("result-count").textContent = latestCases.length + (latestCases.length === 1 ? " case" : " cases");
    $("playwright-code").textContent = makePlaywright(text, latestCases);
    $("results-section").hidden = false;
    if (save) saveHistory(text, latestCases.length, kind);
  }
  function download(filename, content, mime) {
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function csvCell(value) { return '"' + String(value).replace(/"/g, '""') + '"'; }

  requirement.addEventListener("input", () => $("char-count").textContent = requirement.value.length + " / 5000");
  generateBtn.addEventListener("click", () => {
    const text = requirement.value.trim();
    $("error-message").hidden = true;
    if (text.length < 8) { $("error-message").textContent = "Enter a requirement with a little more detail (at least 8 characters)."; $("error-message").hidden = false; requirement.focus(); return; }
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating test plan…";
    try { showResults(text, typeSelect.value); $("results-section").scrollIntoView({behavior:"smooth", block:"start"}); }
    finally { generateBtn.disabled = false; generateBtn.innerHTML = '<span>✦</span> Generate test cases <span class="btn-arrow">→</span>'; }
  });
  prioritySelect.addEventListener("change", () => {
    if (!latestRequirement) return;
    latestCases = filterCases(buildCases(latestRequirement, latestType));
    renderCases(latestCases);
    $("result-count").textContent = latestCases.length + (latestCases.length === 1 ? " case" : " cases");
    $("playwright-code").textContent = makePlaywright(latestRequirement, latestCases);
  });
  $("export-json").addEventListener("click", () => {
    if (!latestCases.length) return;
    download("testpilot-test-cases.json", JSON.stringify({requirement:latestRequirement, test_type:latestType, generated_at:new Date().toISOString(), generated_by:"browser-rules", test_cases:latestCases}, null, 2), "application/json");
  });
  $("export-csv").addEventListener("click", () => {
    if (!latestCases.length) return;
    const rows = [["ID","Title","Description","Type","Priority"], ...latestCases.map(c => [c.id,c.title,c.description,c.type,c.priority])];
    download("testpilot-test-cases.csv", rows.map(row => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  });
  $("copy-code").addEventListener("click", async () => {
    const code = $("playwright-code").textContent;
    try { await navigator.clipboard.writeText(code); $("copy-code").textContent = "Copied ✓"; }
    catch { const range = document.createRange(); range.selectNodeContents($("playwright-code")); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); $("copy-code").textContent = "Select and copy"; }
    setTimeout(() => $("copy-code").textContent = "Copy code", 1800);
  });
  $("clear-results").addEventListener("click", () => { $("results-section").hidden = true; latestCases = []; latestRequirement = ""; });
  $("clear-history").addEventListener("click", () => { try { localStorage.removeItem("testpilot-history"); } catch {} renderHistory(); });
  renderHistory();

  async function refreshWorkflowRuns() {
    const target = $("workflow-runs");
    const button = $("refresh-runs");
    if (button) { button.disabled = true; button.textContent = "Loading…"; }
    target.innerHTML = '<div class="empty-history">Checking GitHub Actions…</div>';
    try {
      const response = await fetch("https://api.github.com/repos/saichaitanya292/testpilot-web/actions/workflows/playwright.yml/runs?per_page=5", { headers: { "Accept": "application/vnd.github+json" } });
      if (!response.ok) throw new Error("GitHub API returned " + response.status);
      const data = await response.json();
      const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
      if (!runs.length) {
        target.innerHTML = '<div class="empty-history">No runs yet. Tap “Start on GitHub”, sign in, choose Run workflow, then refresh here.</div>';
        return;
      }
      target.innerHTML = runs.map(run => {
        const conclusion = run.conclusion || run.status || "unknown";
        const state = conclusion === "success" ? "success" : (["failure","cancelled","timed_out","action_required"].includes(conclusion) ? "failure" : "running");
        const label = conclusion.replace(/_/g, " ");
        const started = run.created_at ? new Date(run.created_at).toLocaleString() : "Time unavailable";
        const title = run.display_title || run.name || "Playwright browser tests";
        return '<a class="workflow-run" href="' + esc(run.html_url) + '" target="_blank" rel="noreferrer">' +
          '<span class="run-status ' + state + '"></span><span class="run-info"><strong>' + esc(title) +
          '</strong><small>#' + Number(run.run_number) + ' · ' + esc(started) + '</small></span>' +
          '<span class="run-conclusion ' + state + '">' + esc(label) + ' ↗</span></a>';
      }).join("");
    } catch (error) {
      target.innerHTML = '<div class="empty-history">Could not load runs. Open <a href="https://github.com/saichaitanya292/testpilot-web/actions/workflows/playwright.yml" target="_blank" rel="noreferrer">GitHub Actions</a> and check repository visibility or refresh later.</div>';
    } finally {
      if (button) { button.disabled = false; button.textContent = "↻ Refresh"; }
    }
  }
  $("refresh-runs")?.addEventListener("click", refreshWorkflowRuns);
  refreshWorkflowRuns();

})();