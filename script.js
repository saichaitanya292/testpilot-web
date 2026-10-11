(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const requirement = $("requirement");
  const typeSelect = $("test-type");
  const prioritySelect = $("priority");
  // Work around Android/browser autofill and forced-colors styles that can render typed text black.
  if (requirement) {
    const forceRequirementTextColor = () => {
      requirement.style.setProperty("color", "#ffffff", "important");
      requirement.style.setProperty("-webkit-text-fill-color", "#ffffff", "important");
      requirement.style.setProperty("background-color", "#0b1323", "important");
      requirement.style.setProperty("caret-color", "#6ce5d3", "important");
      requirement.style.setProperty("opacity", "1", "important");
    };
    ["focus", "input", "keyup", "change"].forEach(eventName =>
      requirement.addEventListener(eventName, forceRequirementTextColor)
    );
    forceRequirementTextColor();
  }
  const generateBtn = $("generate-btn");
  const agentPrompt = $("agent-prompt"); const chatThread = $("chat-thread"); const chatForm = $("agent-chat-form");
  function addChatMessage(text, role) { const article=document.createElement("article"); article.className="chat-message "+(role==="user"?"user-message":"assistant-message"); const avatar=document.createElement("div"); avatar.className="message-avatar"; avatar.textContent=role==="user"?"You":"✦"; const body=document.createElement("div"); body.className="message-body"; const author=document.createElement("div"); author.className="message-author"; author.textContent=role==="user"?"You":"TestPilot"; const p=document.createElement("p"); p.textContent=text; body.append(author,p); article.append(avatar,body); chatThread.appendChild(article); article.scrollIntoView({behavior:"smooth",block:"nearest"}); }
  function submitAgentPrompt(value) {
    value = String(value || "").trim();
    if (value.length < 8) { agentPrompt.focus(); return; }
    addChatMessage(value, "user");
    agentPrompt.value = "";
    requirement.value = value;
    requirement.dispatchEvent(new Event("input", { bubbles: true }));
    addChatMessage("Here are the suggested test cases. Select the scenarios you want to include; nothing runs until you confirm.", "assistant");
    // Render chat cards independently from the legacy results workspace, which is hidden in chat-only mode.
    try {
      latestRequirement = value;
      latestType = typeSelect ? typeSelect.value : "both";
      latestCases = filterCases(buildCases(value, latestType));
      selectedCaseIds = new Set(latestCases.filter(c => c.priority === "high").map(c => c.id));
      renderChatCases(latestCases);
      const resultsList = $("results-list");
      if (resultsList) renderCasesWithoutChat(latestCases);
      const count = $("result-count");
      if (count) count.textContent = latestCases.length + (latestCases.length === 1 ? " case" : " cases");
      const code = $("playwright-code");
      if (code) code.textContent = makePlaywright(value, latestCases);
      const section = $("results-section");
      if (section) section.hidden = false;
      saveHistory(value, latestCases.length, latestType);
      if (!latestCases.length) addChatMessage("I couldn't generate cases for that request. Try describing a specific user action, such as searching for a job or signing in.", "assistant");
    } catch (error) {
      console.error("TestPilot card rendering failed:", error);
      const fallback = document.createElement("section");
      fallback.className = "chat-case-panel";
      fallback.innerHTML = '<div class="chat-case-heading"><div><strong>Test cases could not render</strong><span>Please refresh this page and try again.</span></div></div>';
      chatThread.appendChild(fallback);
      addChatMessage("The card renderer hit an error. Refresh the page and try again. If this persists, the browser console may contain details.", "assistant");
    }
    const panel = $("chat-test-cases");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  chatForm?.addEventListener("submit",e=>{e.preventDefault();submitAgentPrompt(agentPrompt.value);});
  agentPrompt?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();chatForm.requestSubmit();}});
  $("use-example")?.addEventListener("click",()=>{agentPrompt.value="Test my job website: search for Python developer jobs, open a listing, check the job details, and verify the Apply button.";agentPrompt.focus();});
  $("new-chat-btn")?.addEventListener("click",()=>{chatThread.innerHTML="";const article=document.createElement("article");article.className="chat-message assistant-message";article.innerHTML='<div class="message-avatar">✦</div><div class="message-body"><div class="message-author">TestPilot <span>AI agent</span></div><p>New test session started. What website flow would you like me to plan tests for?</p></div>';chatThread.appendChild(article);agentPrompt.value="";$("results-section").hidden=true;agentPrompt.focus();});
  document.querySelectorAll(".prompt-suggestion").forEach(b=>b.addEventListener("click",()=>{agentPrompt.value=b.dataset.prompt||"";agentPrompt.focus();}));
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

  let selectedCaseIds = new Set();

  function renderCases(cases) {
    $("results-list").innerHTML = cases.map(c => `
      <article class="case-card">
        <label class="case-select" aria-label="Select ${esc(c.title)}"><input type="checkbox" data-case-id="${c.id}" ${selectedCaseIds.has(c.id) ? "checked" : ""}></label>
        <div class="case-number">${String(c.id).padStart(2, "0")}</div>
        <div><h3 class="case-title">${esc(c.title)}</h3><p class="case-description">${esc(c.description)}</p><div class="case-meta"><span class="tag">${esc(c.type)}</span><span class="tag">Requirement-based</span></div></div>
        <span class="priority ${esc(c.priority)}">${esc(c.priority)}</span>
      </article>`).join("");
    $("results-list").querySelectorAll("[data-case-id]").forEach(input => input.addEventListener("change", () => {
      const id = Number(input.dataset.caseId);
      if (input.checked) selectedCaseIds.add(id); else selectedCaseIds.delete(id);
      syncSelectionUI();
    }));
    renderChatCases(cases);
  }

  function syncSelectionUI() {
    const count = latestCases.filter(c => selectedCaseIds.has(c.id)).length;
    const countLabel = $("chat-selected-count");
    if (countLabel) countLabel.textContent = count + " selected";
    const selectAll = $("chat-select-all");
    if (selectAll) selectAll.checked = latestCases.length > 0 && latestCases.every(c => selectedCaseIds.has(c.id));
    const selectedTitles = $("chat-selected-titles");
    if (selectedTitles) selectedTitles.textContent = count ? latestCases.filter(c => selectedCaseIds.has(c.id)).map(c => c.title).join(", ") : "Choose at least one case to continue.";
  }

  function detailedStepsFor(testCase) {
    const title = low(testCase.title);
    const goal = low(latestRequirement);
    const isJobFlow = has(goal + " " + title, ["job", "career", "apply", "employer", "vacancy", "position", "listing"]);
    const isSearch = has(title, ["search", "filter", "sort", "query", "results"]);
    const isDetail = has(title, ["detail", "listing", "open an item", "view"]);
    const isApply = has(title, ["apply", "application"]);
    const isAuth = has(title, ["sign in", "login", "credential", "password", "account"]);
    const isForm = has(title, ["form", "required", "input", "validation", "submit"]);
    const isResponsive = has(title, ["responsive", "viewport", "layout"]);
    const isLink = has(title, ["link", "navigation", "destination"]);
    const isApi = testCase.type === "API";
    let steps;
    if (isApi) {
      steps = [
        "Identify the API route and HTTP method associated with this scenario from the website's network activity or published API documentation.",
        "Record the required headers, authentication requirements, query parameters, and request body; use non-production test data.",
        "Send the valid or invalid request described by this test case and capture the response status, headers, and body.",
        "Verify the response matches the documented contract and that no sensitive data or stack traces are exposed.",
        "Check the resulting UI or resource state, where applicable, to confirm the request had only the intended effect."
      ];
    } else if (isSearch && isJobFlow) {
      steps = [
        "Open the target website and wait for the main page content to become visible; record the page title and URL.",
        "Inspect the rendered page for a job-search input using its accessible label, placeholder, role, or nearby search text; identify the search/submit control.",
        "Enter a distinctive keyword (for example, \"software engineer\") and submit using the visible search control or Enter key.",
        "Wait for the results area to update. Verify results are displayed, or that a clear empty-state message appears if there are no matches.",
        "Check a few visible result titles and snippets for relevance to the keyword; verify result cards are not blank or duplicated.",
        "If filters or sorting controls are present, apply one option and verify the visible results update consistently.",
        "Capture a screenshot and note the final URL, visible result count, console errors, and any failed network requests."
      ];
    } else if (isDetail && isJobFlow) {
      steps = [
        "Open the target website and wait until job cards or listing links are visible.",
        "Select a visible listing by its title or accessible link text; avoid relying on brittle positional selectors where possible.",
        "Wait for the detail view or destination page to load and verify the URL changes as expected.",
        "Confirm the page exposes key job information such as title, employer, location, description, and requirements when those fields are provided by the site.",
        "Verify the selected listing title matches the detail page title and that the page contains meaningful content.",
        "Use the browser Back action and confirm the previous results/listing view can be reached again.",
        "Capture a screenshot and report missing fields, broken links, or navigation errors."
      ];
    } else if (isApply && isJobFlow) {
      steps = [
        "Open a job listing and verify the job title and employer before interacting with the application control.",
        "Locate the Apply control by its accessible role and name; record whether it is a button or link and inspect its destination.",
        "Activate Apply and wait for navigation, a new tab, or an application form to appear.",
        "Verify the destination is relevant to the selected listing and that the application page/form loads successfully.",
        "If the flow asks for personal information or submits an application, stop before final submission unless an explicitly approved test account and safe test mode are available.",
        "Check required-field validation using empty or clearly invalid test data only where safe; verify feedback is visible and understandable.",
        "Capture the resulting page URL and screenshot; record any broken destination or unexpected external redirect."
      ];
    } else if (isAuth) {
      steps = [
        "Open the target website and locate the sign-in form or account entry point using visible text and accessible labels.",
        "Identify the username/email field, password field, and submit control; verify labels and input types are appropriate.",
        "For the positive path, use only an approved test account and submit valid test credentials.",
        "Verify successful sign-in by checking the expected authenticated page or account indicator, without exposing credentials in logs.",
        "For the negative path, test empty fields and an invalid test password; verify access is denied and a clear, non-sensitive message appears.",
        "Confirm password values remain masked and that keyboard focus and form validation are usable.",
        "Capture screenshots with credentials and personal data excluded."
      ];
    } else if (isForm) {
      steps = [
        "Open the relevant page and identify the form, its visible labels, required indicators, and submit control.",
        "Record the expected fields and allowed formats from the page's helper text or validation messages.",
        "Submit with required fields empty and verify field-level errors appear without losing entered data.",
        "Enter malformed values in fields with known formats and verify the form blocks invalid submission with actionable feedback.",
        "Enter valid test values and submit once; verify the expected confirmation or next page appears.",
        "Activate submit again quickly and verify the UI prevents unintended duplicate submission where appropriate.",
        "Check keyboard navigation, focus order, and mobile layout; capture a screenshot of any failure."
      ];
    } else if (isResponsive) {
      steps = [
        "Open the target website at a desktop viewport and note the main navigation, content columns, and primary actions.",
        "Resize to a mobile viewport (approximately 390 × 844) and wait for layout changes to settle.",
        "Verify text, menus, inputs, buttons, and cards remain visible and usable without horizontal page overflow.",
        "Interact with the main action at mobile size and confirm it remains reachable and responds correctly.",
        "Repeat at a tablet viewport and check for overlap, clipping, or unexpectedly hidden content.",
        "Capture screenshots at each viewport and record document width versus viewport width."
      ];
    } else if (isLink) {
      steps = [
        "Open the target website and collect visible navigation links and primary action links.",
        "Verify each relevant link has a non-empty destination and an accessible name.",
        "Open the link and wait for the destination to load; verify it returns a successful page rather than an error or blank screen.",
        "For internal links, confirm the destination remains within the expected site; for external links, confirm the destination is appropriate.",
        "Use browser Back and verify the original page remains usable.",
        "Capture the failing URL and screenshot for any broken or unexpected navigation."
      ];
    } else {
      steps = [
        "Navigate to the target website and wait for the main content to load; record the page title and current URL.",
        "Inspect the visible page and identify the controls, text, links, and expected state relevant to this scenario.",
        "Perform the primary user action described by the test case using accessible roles, labels, or visible text rather than fragile selectors.",
        "Verify the expected success state and confirm the page displays the correct content or feedback.",
        "Exercise the negative or boundary condition described by the case and verify the application handles it safely.",
        "Check that the action does not create duplicate or inconsistent state when repeated, where relevant.",
        "Capture a screenshot and record console errors, failed requests, and the exact observed-versus-expected result."
      ];
    }
    return steps;
  }

  function renderChatCases(cases) {
    const oldPanel = $("chat-test-cases");
    if (oldPanel) oldPanel.remove();
    const panel = document.createElement("section");
    panel.id = "chat-test-cases";
    panel.className = "chat-case-panel";
    const heading = document.createElement("div");
    heading.className = "chat-case-heading";
    const headingText = document.createElement("div");
    headingText.innerHTML = '<strong>Suggested test cases</strong><span>Choose which scenarios belong in this test run.</span>';
    const count = document.createElement("span");
    count.className = "chat-selected-count";
    count.id = "chat-selected-count";
    heading.append(headingText, count);
    const toolbar = document.createElement("label");
    toolbar.className = "chat-select-all";
    const all = document.createElement("input");
    all.type = "checkbox";
    all.id = "chat-select-all";
    const allText = document.createElement("span");
    allText.textContent = "Select all";
    toolbar.append(all, allText);
    all.addEventListener("change", () => {
      selectedCaseIds = all.checked ? new Set(cases.map(c => c.id)) : new Set();
      renderChatCases(cases);
      renderCasesWithoutChat(cases);
    });
    const list = document.createElement("div");
    list.className = "chat-case-list";
    list.innerHTML = cases.map(c => `
      <div class="chat-case-option">
        <label class="chat-case-choice">
          <input type="checkbox" data-chat-case-id="${c.id}" ${selectedCaseIds.has(c.id) ? "checked" : ""}>
          <span class="chat-case-copy"><strong>${esc(c.title)}</strong><span>${esc(c.description)}</span><small>${esc(c.type)} · ${esc(c.priority)} priority</small></span>
        </label>
        <details class="case-step-details">
          <summary>View detailed test steps</summary>
          <ol>${detailedStepsFor(c).map(step => "<li>" + esc(step) + "</li>").join("")}</ol>
          <p>Steps are drafted from the requirement and scenario. Live DOM/selector discovery happens only when the browser workflow runs.</p>
        </details>
      </div>`).join("");
    list.querySelectorAll("[data-chat-case-id]").forEach(input => input.addEventListener("change", () => {
      const id = Number(input.dataset.chatCaseId);
      if (input.checked) selectedCaseIds.add(id); else selectedCaseIds.delete(id);
      const matching = $("results-list")?.querySelector('[data-case-id="' + id + '"]');
      if (matching) matching.checked = input.checked;
      syncSelectionUI();
      list.querySelectorAll("[data-chat-case-id]").forEach(box => { box.checked = selectedCaseIds.has(Number(box.dataset.chatCaseId)); });
    }));
    const footer = document.createElement("div");
    footer.className = "chat-case-footer";
    const selected = document.createElement("span");
    selected.id = "chat-selected-titles";
    const note = document.createElement("small");
    note.textContent = "Select the cases you want. Nothing runs until you choose Run selected tests.";
    const runButton = document.createElement("button");
    runButton.type = "button";
    runButton.className = "chat-run-button";
    runButton.textContent = "▶ Run selected tests";
    runButton.addEventListener("click", () => {
      const chosen = latestCases.filter(c => selectedCaseIds.has(c.id));
      if (!chosen.length) {
        selected.textContent = "Select at least one test case before continuing.";
        return;
      }
      renderRunConfirmation(chosen);
    });
    footer.append(selected, note, runButton);
    panel.append(heading, toolbar, list, footer);
    // Nest the cards in the assistant message flow. This avoids flex/viewport
    // sizing quirks that can collapse a direct child to a thin divider on iOS.
    const messages = chatThread.querySelectorAll(".assistant-message");
    const lastAssistant = messages[messages.length - 1];
    const messageBody = lastAssistant && lastAssistant.querySelector(".message-body");
    if (messageBody) messageBody.appendChild(panel);
    else chatThread.appendChild(panel);
    syncSelectionUI();
    // Explicitly scroll the chat's own viewport; scrollIntoView alone can leave
    // newly appended cards below the visible area on iOS Safari.
    requestAnimationFrame(() => {
      chatThread.scrollTop = chatThread.scrollHeight;
      panel.scrollIntoView({behavior:"smooth", block:"end"});
    });
  }

  function renderRunConfirmation(chosen) {
    const existing = $("chat-run-confirmation");
    if (existing) existing.remove();
    const card = document.createElement("section");
    card.id = "chat-run-confirmation";
    card.className = "chat-run-confirmation";
    const title = document.createElement("h3");
    title.textContent = "Prepare your test run";
    const summary = document.createElement("p");
    summary.textContent = chosen.length + " selected case(s): " + chosen.map(c => c.title).join("; ");
    const urlLabel = document.createElement("label");
    urlLabel.htmlFor = "chat-run-target-url";
    urlLabel.textContent = "TARGET WEBSITE URL";
    const urlInput = document.createElement("input");
    urlInput.id = "chat-run-target-url";
    urlInput.type = "url";
    urlInput.inputMode = "url";
    urlInput.value = "https://saichaitanya292.github.io/india-job-alert-media/";
    urlInput.placeholder = "https://your-website.example";
    urlInput.autocomplete = "url";
    const scenarioLabel = document.createElement("label");
    scenarioLabel.htmlFor = "chat-run-scenario";
    scenarioLabel.textContent = "SCENARIO FOR GITHUB ACTIONS";
    const scenario = document.createElement("textarea");
    scenario.id = "chat-run-scenario";
    scenario.rows = 4;
    scenario.value = "Test these selected scenarios: " + chosen.map(c => c.title + " — " + c.description).join(" | ");
    const keywordLabel = document.createElement("label");
    keywordLabel.htmlFor = "chat-run-keyword";
    keywordLabel.textContent = "SEARCH KEYWORD";
    const keyword = document.createElement("input");
    keyword.id = "chat-run-keyword";
    keyword.type = "text";
    keyword.value = "software engineer";
    keyword.maxLength = 120;
    const notice = document.createElement("p");
    notice.className = "chat-run-notice";
    notice.textContent = "This opens the existing GitHub Actions workflow. You must sign in, enter the target URL, scenario, and keyword, then select Run workflow. The current runner does not yet execute each selected card as a separate test; the scenario is passed as guidance to the existing workflow.";
    const actions = document.createElement("div");
    actions.className = "chat-run-actions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "chat-copy-scenario";
    copyButton.textContent = "Copy scenario";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(scenario.value);
        copyButton.textContent = "Copied ✓";
      } catch {
        scenario.focus();
        scenario.select();
        copyButton.textContent = "Scenario selected — copy it";
      }
    });
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "chat-run-button";
    openButton.textContent = "Continue to GitHub Actions ↗";
    openButton.addEventListener("click", () => {
      let target;
      try { target = new URL(urlInput.value.trim()); }
      catch { notice.textContent = "Enter a valid public website URL beginning with https:// or http://."; urlInput.focus(); return; }
      if (!["http:", "https:"].includes(target.protocol) || ["localhost", "127.0.0.1", "::1"].includes(target.hostname)) {
        notice.textContent = "Use a public http:// or https:// website URL. Localhost targets are not supported by the hosted runner.";
        urlInput.focus();
        return;
      }
      window.open("https://github.com/saichaitanya292/testpilot-web/actions/workflows/playwright.yml", "_blank", "noopener,noreferrer");
      notice.textContent = "GitHub Actions opened. Enter this target URL: " + target.href + " Copy the scenario if needed, then submit the workflow form. This page cannot submit the workflow on your behalf.";
    });
    actions.append(copyButton, openButton);
    card.append(title, summary, urlLabel, urlInput, scenarioLabel, scenario, keywordLabel, keyword, notice, actions);
    chatThread.appendChild(card);
    card.scrollIntoView({behavior:"smooth", block:"nearest"});
  }

  function renderCasesWithoutChat(cases) {
    $("results-list").innerHTML = cases.map(c => `
      <article class="case-card">
        <label class="case-select" aria-label="Select ${esc(c.title)}"><input type="checkbox" data-case-id="${c.id}" ${selectedCaseIds.has(c.id) ? "checked" : ""}></label>
        <div class="case-number">${String(c.id).padStart(2, "0")}</div>
        <div><h3 class="case-title">${esc(c.title)}</h3><p class="case-description">${esc(c.description)}</p><div class="case-meta"><span class="tag">${esc(c.type)}</span><span class="tag">Requirement-based</span></div></div>
        <span class="priority ${esc(c.priority)}">${esc(c.priority)}</span>
      </article>`).join("");
    $("results-list").querySelectorAll("[data-case-id]").forEach(input => input.addEventListener("change", () => {
      const id = Number(input.dataset.caseId);
      if (input.checked) selectedCaseIds.add(id); else selectedCaseIds.delete(id);
      syncSelectionUI();
      renderChatCases(latestCases);
    }));
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
    selectedCaseIds = new Set(latestCases.filter(c => c.priority === "high").map(c => c.id));
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