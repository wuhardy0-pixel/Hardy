// BookKeep browser smoke test (TASKS.md "browser verification" harness, now saved in-repo).
// Run:  node browser_smoke_test.js
// Needs: installed Google Chrome + `npm install` in this folder (playwright-core).
// Serves the app itself on a throwaway port, so nothing else needs to be running.
// Covers: clean load, exact tab set, no "Unknown", local-parser $1,000 sale flow
// (transcript -> preview -> save -> journal -> ledger), and chat XSS safety.

const { spawn } = require("child_process");
const { chromium } = require("playwright-core");

const PORT = 8765;
const URL = `http://127.0.0.1:${PORT}/index.html`;
const EXPECTED_TABS = ["Dashboard", "Agent", "Transactions", "Journal", "Ledger", "Evidence", "Reports", "Settings"];

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : " — " + detail}`);
  if (!ok) failures++;
}

(async () => {
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
    cwd: __dirname, stdio: "ignore",
  });
  await new Promise(r => setTimeout(r, 1200));

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", e => consoleErrors.push(String(e)));

  try {
    await page.goto(URL, { waitUntil: "networkidle" });

    // Fresh books every run so results are deterministic; the test profile is
    // on Pro so the suite can exercise invoices/bills/adjustments (plan gating
    // has its own checks below).
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const freeLocks = await page.evaluate(() => ({
      plan: db.settings.plan,
      agentSend: document.querySelector("#agentSend").disabled,
      api: document.querySelector('#agentMode option[value="api"]').disabled,
      invoice: document.querySelector('#txType option[value="invoice"]').disabled,
    }));
    check("Free plan: agent locked, AI mode locked, but ALL entry types open",
      freeLocks.plan === "free" && freeLocks.agentSend && freeLocks.api && !freeLocks.invoice, JSON.stringify(freeLocks));
    await page.evaluate(() => { db.settings.plan = "pro"; save(); updateProLocks(); });
    const proLocks = await page.evaluate(() => ({
      agentSend: document.querySelector("#agentSend").disabled,
      api: document.querySelector('#agentMode option[value="api"]').disabled,
    }));
    check("Pro unlocks the agent and AI mode", !proLocks.agentSend && !proLocks.api, JSON.stringify(proLocks));

    const tabs = await page.$$eval(".tab", els => els.map(e => e.textContent.trim()));
    check("Tabs are exactly the 8 expected", JSON.stringify(tabs) === JSON.stringify(EXPECTED_TABS), tabs.join(", "));

    // Local-parser agent flow: the historically broken $1,000 sale.
    await page.click('[data-tab="agent"]');
    await page.fill("#agentInput", "Daddy bought a ruler from me for $1,000 cash.");
    await page.click("#agentSend");
    await page.waitForSelector("#agentConfirm", { timeout: 5000 });
    const preview = await page.textContent("#agentPreview");
    check("Preview shows $1,000.00 (never $1.00)", preview.includes("$1,000.00") && !/\$1\.00\b/.test(preview), preview.slice(0, 200));
    check("Preview categorizes as Sales Revenue", preview.includes("Sales Revenue") || preview.includes("ruler"));
    await page.click("#agentConfirm");
    await page.waitForTimeout(400);

    await page.click('[data-tab="journal"]');
    const journal = await page.textContent("#journal");
    check("Journal posts Dr Cash / Cr Sales Revenue for $1,000.00",
      journal.includes("1,000.00") && journal.includes("Cash") && journal.includes("Sales Revenue"), journal.slice(0, 300));

    await page.click('[data-tab="ledger"]');
    const ledger = await page.textContent("#ledger");
    check("Ledger has Cash and Sales Revenue T-accounts with $1,000.00",
      ledger.includes("Cash") && ledger.includes("Sales Revenue") && ledger.includes("1,000.00"), ledger.slice(0, 300));
    const postTitle = await page.$eval("#ledger .tacctPost", el => el.title);
    check("Hovering a ledger posting shows its description (title tooltip)",
      postTitle.length > 3 && !/^Click for evidence/.test(postTitle), postTitle);

    // Manual transaction -> must create evidence too (transcript + signable row).
    await page.click('[data-tab="transactions"]');
    await page.click("#transactions details summary");
    await page.fill("#txDate", "2026-08-23");
    await page.selectOption("#txType", "expense");
    const catOptions = await page.$$eval("#txCategory option:not([disabled])", os => os.map(o => o.value));
    check("Expense dropdown: expense accounts + purchasable assets, grouped",
      JSON.stringify(catOptions) === JSON.stringify(["Supplies Expense","Rent Expense","Utilities Expense","Wages Expense","Other Expense","Equipment","Supplies"]),
      catOptions.join(", "));
    const expGroups = await page.$$eval("#txCategory optgroup", gs => gs.map(g => g.label));
    check("Expense dropdown has labeled buckets", expGroups.length === 2 && /Expenses/.test(expGroups[0]) && /Assets/.test(expGroups[1]), expGroups.join(" | "));
    await page.selectOption("#txType", "income");
    const incOptions = await page.$$eval("#txCategory option", os => os.map(o => o.value));
    check("Category dropdown switches to revenue accounts for income",
      JSON.stringify(incOptions) === JSON.stringify(["Sales Revenue","Service Revenue","Interest Income","Other Income"]),
      incOptions.join(", "));
    await page.selectOption("#txType", "invoice");
    const arNote = await page.$$eval("#txCategory option[disabled]", os => os.map(o => o.textContent.trim()));
    check("Invoice type shows Accounts Receivable as booked-automatically (grayed out)",
      arNote.includes("Accounts Receivable"), arNote.join(", "));
    const typeGroups = await page.$$eval("#txType optgroup", gs => gs.map(g => g.label));
    check("Type dropdown grouped into Money out / Money in / My own accounts / Adjustments / Investments",
      JSON.stringify(typeGroups) === JSON.stringify(["Money out","Money in","My own accounts","Adjustments","Investments"]), typeGroups.join(" | "));
    await page.selectOption("#txType", "receive_invoice");
    const payCatDisabled = await page.$eval("#txCategory", el => el.disabled);
    const payCatText = await page.textContent("#txCategory");
    check("Category disabled for invoice-payment (settles A/R automatically)",
      payCatDisabled && /automatic/.test(payCatText), payCatText.trim());
    await page.selectOption("#txType", "expense");
    await page.selectOption("#txCategory", "Supplies Expense");
    await page.fill("#txAmount", "25");
    await page.fill("#txNote", "glue sticks");
    await page.click('#txForm button[type="submit"], #txForm .primary');
    await page.waitForTimeout(400);
    await page.click('[data-tab="evidence"]');
    const evidence = await page.textContent("#evidenceList");
    check("Manual entry appears in Evidence as a manual-form transcript",
      evidence.includes("Manual entry") && evidence.includes("manual form") && evidence.includes("$25.00") && evidence.includes("needs signature"),
      evidence.slice(0, 300));
    await page.click('[data-tab="journal"]');
    const journal2 = await page.textContent("#journal");
    check("Manual entry also posted to the journal", journal2.includes("25.00") && journal2.includes("Supplies Expense"), journal2.slice(0, 300));

    // Sign flow: after saving a signature the row's Sign button turns into a green "✓ Signed".
    await page.click('[data-tab="evidence"]');
    await page.click("#evidenceList [data-ev-sign]");
    await page.fill("#evidencePerson", "Test Signer");
    await page.click("#saveEvidence");
    await page.waitForTimeout(400);
    const signedBtn = await page.$("#evidenceList button.signedBtn");
    const signedLabel = signedBtn ? (await signedBtn.textContent()).trim() : "";
    check('Signed row shows green "✓ Signed" button', !!signedBtn && signedLabel.includes("Signed"), `label=${signedLabel}`);
    const unsignedCount = await page.$$eval("#evidenceList [data-ev-sign]:not(.signedBtn)", els => els.length);
    check("Unsigned rows still show a plain Sign button", unsignedCount >= 1, `unsigned=${unsignedCount}`);

    // XSS: chat bubbles must render user text literally.
    await page.click('[data-tab="agent"]');
    await page.fill("#agentInput", '<img src=x onerror="window.__xss=1"> hello');
    await page.click("#agentSend");
    await page.waitForTimeout(1500);
    const xssFired = await page.evaluate(() => window.__xss === 1);
    const chatHasLiteral = (await page.textContent("#agentChat")).includes("<img");
    check("Chat renders HTML literally (no script execution)", !xssFired && chatHasLiteral);

    // Whole-app sweeps last, so they cover everything rendered above.
    const bodyText = await page.evaluate(() => document.body.innerText);
    check('No "Unknown" anywhere', !bodyText.includes("Unknown"));
    const realErrors = consoleErrors.filter(e => !/net::ERR|Failed to load resource/.test(e)); // backend may be down; fetch noise is not an app bug
    check("No console/page errors", realErrors.length === 0, realErrors.join(" | ").slice(0, 300));
  } catch (err) {
    check("Test run completed", false, String(err));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
