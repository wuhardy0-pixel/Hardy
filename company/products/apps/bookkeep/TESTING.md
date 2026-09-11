# BookKeep — TESTING Plan

Last updated: 2026-08-22. Record version, input, expected, actual,
Pass/Fail for failures.

Automated coverage:
- `node parser_tests.js` — 30 money/date/parser cases extracted from
  the live app.js (run after every parser or accounting change).
- `node browser_smoke_test.js` — headless-Chrome UI suite, saved
  in-repo (needs `npm install` once + installed Google Chrome; serves
  the app itself). Covers: clean load, exact tab set, local-parser
  $1,000 sale → preview → journal → ledger, chat XSS safety,
  no-"Unknown"/console-error sweep. Run after every UI-facing change.

## Startup / UI

-   [ ] App loads without console errors.
-   [ ] Tabs are exactly: Dashboard, Agent, Transactions, Journal,
    Ledger, Evidence, Reports, Settings (no Accounts, no Investments).
-   [ ] Add/switch users works without cross-user leakage.
-   [ ] Refresh preserves valid data.
-   [ ] The word "Unknown" appears nowhere in any tab.

## Profile / users

-   [ ] Fresh install is named "My Books" (never "Default User").
-   [ ] Settings → Profile rename updates the switcher immediately and
    is used as speaker on NEW transcripts.
-   [ ] User A's data can never appear under User B (books, learning,
    evidence).
-   [ ] Settings → Profile → "Delete this user profile…" asks twice,
    removes the profile and its data, and switches to a remaining
    user; the last profile cannot be deleted (alert instead).

## Microphone / dictation

-   [ ] Speak requests permission and transcribes.
-   [ ] Short pauses do not end the session; recognition auto-restarts.
-   [ ] Stop ends recording; ~200-token cap enforced; restarts don't
    duplicate words.
-   [ ] Dictated entries store source=voice; typed store source=typed.

## Evidence at approval (changed 2026-08-23: transactions only)

-   [ ] Unparseable chat / clarifying questions / cancelled proposals
    leave NO transcript.
-   [ ] Approving a plan writes exactly one transcript with the exact
    words (multi-turn: all user messages since the last save/cancel,
    joined); the journal entries carry its T-ID.
-   [ ] Clear chat also clears the pending evidence buffer.
-   [ ] Backend mode persists the transcript in SQLite with SHA-256.

## Agent — LLM API mode (backend running, key in .env)

-   [ ] Settings → Agent mode "LLM API" with blank endpoint uses
    Backend URL + /api/agent.
-   [ ] `Daddy bought a ruler from me for $1,000 cash.` → proposes
    Create account Cash (if missing) + income $1,000.00, category
    Sales Revenue — never $1.00.
-   [ ] `Daddy bought a ruler for $3 and Mommy bought a crab gauge for
    $5 yesterday.` → TWO income entries ($3, $5), total $8, dated
    yesterday (buyers are customers, not expenses).
-   [ ] `I did $500 of consulting and will be paid later` → invoice
    (A/R), Service Revenue.
-   [ ] `Received a $300 utility bill I have not paid` → bill (A/P),
    Utilities Expense.
-   [ ] `I got some money` → clarifying question, zero actions.
-   [ ] With an open $300 utility bill on the books: `I paid the $300
    utility bill` → pay_bill (settles A/P), NOT a second expense.
    With no open bill: `paid the $40 water bill` → plain expense.
    (App sends openInvoices/openBills in the agent context.)
-   [ ] Invoice → payment cycle: A/R dashboard card returns to $0.00
    and revenue is counted exactly once.
-   [ ] With multiple money accounts and no account named in the
    message, the agent asks which account (never guesses).
-   [ ] Multi-turn: "someone loaned me a 3D printer that cost $1,000"
    → question; "I owe 1,000 for it" (+ garbled "Ode to Mommy") →
    bill $1,000 category Equipment, note names the printer and Mommy.
    Clear chat resets the memory. True loan with nothing owed →
    "nothing to record" explanation, no entry.
-   [ ] Edge gauntlet (all verified 2026-08-23, LLM mode): $1,000.50 /
    written numbers / 1.5k / 50 cents / "2 at $3 each"; last Monday,
    August 12, day-before-yesterday; sale+expense in one sentence;
    three sales stay separate; new account proposed for "my new
    Savings"/"Piggy Bank" (income + transfer); gift → Other Income;
    LOST bet → expense; refund given; $0 sale refused; future
    "maybe" sale → no entry; prompt-injection → no actions (no
    destructive action even exists in the schema); small talk → no
    entry; long rambling voice-style story → one correct entry;
    HTML/special characters survive safely.
-   [ ] Server validator fail-safes (unit-tested): zero/negative/NaN
    amounts, bad dates, unknown types/action kinds, missing accounts,
    transfer without destination, empty plans all blocked; the server
    recomputes the income total itself and ignores the model's claim.
-   [ ] Backend down / key missing → readable error in chat (not
    "error 500").
-   [ ] Settings Model-name field overrides .env OPENAI_MODEL.

## Agent — local parser mode (free fallback)

Money: `$1`→1, `$10`→10, `$1000`→1000, `$1,000`→1000,
`$1,000.50`→1000.50, `1k`→1000, `1.5k`→1500, `ten dollars`→10,
`one hundred dollars`→100, `one thousand dollars`→1000,
`two thousand five hundred dollars`→2500.
-   [ ] CRITICAL: `$1,000` never becomes `$1` — including inside a
    sale sentence (`...for $1,000 cash.`), the historically broken
    path. No phantom $1 duplicate entry either.

Dates: today / yesterday / tomorrow / N days ago / day before
yesterday / last-next weekday / August 12 / 8/12/2026 / 2026-08-12.
-   [ ] Evening test: after ~5 p.m. local, "today"/"yesterday" resolve
    to LOCAL dates (UTC regression).
-   [ ] Month/year boundaries and leap years.

-   [ ] Sale item extraction: `bought a ruler from me` → item "ruler"
    (no "from me" in notes/journal).
-   [ ] Category is Sales Revenue (chart name), not "Sales".

## Supplies method (adjusting entries)

-   [ ] Buy $500 filament with Category "Supplies" (Assets bought) →
    Supplies asset $500, no expense yet.
-   [ ] Agent (local or LLM): "We used up $30 of filament this month"
    → use_supplies proposal; after save: journal Dr Supplies Expense
    / Cr Supplies $30; Supplies asset $470; income statement shows
    the $30 expense; equation ✓; evidence transcript stored.
-   [ ] Manual form: Type "Used up supplies/materials" (Adjustments
    group) offers exactly Cost of Goods Sold / R&D Expense / Supplies
    Expense as the destination.
-   [ ] Standard costing: "Sold a ruler for $10 cash. It used about
    50 cents of filament." → income $10 AND use_supplies $0.50 as
    Cost of Goods Sold (LLM). "Wasted $5 of filament on failed test
    prints" → R&D Expense (both parsers). "Used $1 of supplies
    cleaning" → Supplies Expense. Income statement lists the three
    separately; Supplies asset decreases by the total; equation ✓.

## Investments (Pro)

-   [ ] "Bought 2 shares of AAPL for $300 cash" then "1 share for
    $180" → holdings 3 sh / $480 (avg $160). "Sold 1 share for $200"
    → journal Dr Cash 200 / Cr Investments 160 / Cr Investment Income
    40; holdings 2 sh / $320. Selling more than held is refused.
-   [ ] Dashboard "Investments (at cost)" card, Balance Sheet
    Investments asset, Income Statement realized gain, Analysis
    holdings list (shares + avg cost) all agree; equation ✓; cash
    flow shows buys/sells under Investing.
-   [ ] Manual form: Investments types reveal Stock symbol + Shares
    fields (hidden otherwise); both required; "at $X each" and "for
    $X total" both parse in the agents; dividends → Investment Income.

## Transactions — append-only edits

-   [ ] Transaction rows show only ✏️ Edit (no delete buttons in the
    list — removed by request 2026-08-23). Inside the Edit form there
    is a red "Delete this transaction" button: confirm dialog quotes
    the entry; deleting marks it superseded+voidedAt (kept in DB/CSV
    as history), retires its journal entries, and all balances/
    reports update; equation stays ✓. Nothing is silently erased.

-   [ ] Every active row has ✏️ Edit; saving writes a NEW record
    (revisionOf set) and marks the old one superseded.
-   [ ] After editing $1,000→$900: dashboard, journal, ledger, and all
    three statements show $900; no $1,000 anywhere active.
-   [ ] DB keeps both records; CSV export includes status
    (active/superseded) and revision_of columns.
-   [ ] Superseded journal entries disappear from Journal and Ledger.
-   [ ] Manual form Type is grouped (Money out / Money in / My own
    accounts) with plain-English labels; values unchanged. Category is
    a strict dropdown of chart accounts in labeled buckets: income/
    invoice → "Revenue"; expense/bill → "Expenses" + "Assets bought"
    (Equipment, Supplies); disabled with an explanation for transfer,
    receive_invoice ("pays down A/R"), and pay_bill ("pays down A/P").
    Invoice/bill show A/R / A/P grayed out as booked-automatically.
    Edit-in-place uses the same grouped dropdowns. Automated in
    browser_smoke_test.
-   [ ] Manual add-transaction (collapsed form) also creates a journal
    entry (books stay complete) AND an evidence transcript (source
    "📝 manual form", text = what the form said, signable in the
    Evidence tab; journal entry carries its T-ID). Automated in
    browser_smoke_test.js.

## Journal (conventional format)

-   [ ] Debit line first; credit account indented below; Dr/Cr amount
    columns; totals rule; Balanced badge; J-ID + T-ID visible;
    See-evidence button works.
-   [ ] Unbalanced entries cannot post (validator + badge).

## Ledger (classic T-accounts)

-   [ ] One T per account: title above, vertical rule, debits left,
    credits right, dated postings, totals, double-underlined ending
    balance on the correct normal side.
-   [ ] Accounts carry stable IDs (A1…) and types (Asset/Liability/
    Equity/Revenue/Expense); Cash=Asset, Sales Revenue=Revenue.
-   [ ] Clicking a posting opens Evidence Details for its transcript.
-   [ ] Multiple entries accumulate correctly.

## Reports (built from ledger)

-   [ ] One statement visible at a time; pills switch BS/IS/CF.
-   [ ] Balance Sheet shows the accounting equation line with ✓ and
    the numbers reconcile to the Ledger tab exactly.
-   [ ] Income Statement revenue/expenses/net income match ledger
    revenue/expense balances.
-   [ ] Cash Flow (fixed 2026-08-27): ALL user money accounts count as
    cash (incl. "Earnings"); Operating = revenue/expenses/supplies/
    A-R collections/A-P payments; Investing = equipment & stock buys/
    sells only; Financing = owner money (opening balances/equity);
    money↔money transfers excluded; NET CHANGE MUST EQUAL the actual
    movement of all money accounts to the penny.
-   [ ] As-of date filters postings.
-   [ ] An account with an opening balance shows it on the balance
    sheet via an "Opening balance" journal entry (created once,
    idempotent across reloads); equation ✓.
-   [ ] Backups: "Back up all profiles to server now" writes dated
    JSON per profile to backups_v13/ (restorable via Import backup);
    automatic backup runs ~daily when the backend is reachable;
    status line shows the last backup time.
-   Known gaps (expected failures, tracked in TASKS.md):
    cash-vs-accrual setting not yet applied to ledger statements; no
    closing/retained earnings.

## Reports → 📊 Analysis

-   [ ] Known scenario ($100 sale, $20 COGS, $5 R&D, $30 bill):
    gross margin 80.0%, net margin 45.0%, net income $45.00, R&D
    share 5.0%; EPS $0.45 at 100 shares and $4.50 at 10 (input
    persists in settings); ROA/ROE, current ratio, working capital,
    debt-to-equity, A/R, A/P, and cash-flow rows all present; "—"
    shown when a ratio cannot be computed.
-   [ ] Evidence 🧹 Rebuild: removes orphan transcripts (+their
    signatures), reconstructs missing evidence from transactions,
    wipes the backend evidence store (creator only) and re-syncs in
    backend mode; /api/audit/verify ✓ afterwards.

## Evidence

-   [ ] List is compact: date • excerpt • speaker • 🎤/⌨️ • badges
    ("N journal", "✍️ signed" / "needs signature"); Sign and Details
    buttons.
-   [ ] Signer name must be typed; signature draws and saves; invoice
    photo uploads and displays.
-   [ ] Evidence rows that produced NO journal entries show a 🗑️
    delete button (confirm dialog quotes the transcript; removes its
    signatures too); rows linked to journal entries never show it and
    deletion is refused even if forced. Books are unaffected.
-   [ ] After saving a signature the row's Sign button becomes a green
    "✓ Signed" button (still clickable to add another signature);
    unsigned rows keep the plain Sign button. Automated in
    browser_smoke_test.js.
-   [ ] Details shows exact transcript (HTML renders literally),
    journal trail, receipts, integrity section.
-   [ ] Backend audit verification re-hashes every stored record AND
    checks chain continuity; hand-editing any row in SQLite makes it
    report the exact table/id that no longer matches.

## Security & robustness

-   [ ] Account name/category/note/transcript containing
    `<b>x</b>` or `<img src=x onerror=alert(1)>` renders literally in
    journal, ledger, transactions, evidence, agent chat bubbles,
    proposal preview/edit cards, user switcher, reports, and the
    learning panel (automated: chat case in browser_smoke_test.js).
-   [ ] JSON export→import round-trip preserves everything; old
    backups migrate (ensureDbShape) without crashing.
-   [ ] Migrations: legacy "Unknown"/"Sales"/"Sales Income" data is
    renamed/attached on load.
-   [ ] Evidence backfill: a transaction with no transcript gets a
    "Reconstructed evidence…" row on load (signable, linked to its
    journal entries); reloading never duplicates it; agent entries
    are not double-evidenced. (Automated during development —
    recreate from TASKS 2026-08-23 notes if regressing.)
-   [ ] API key never appears in any browser-delivered file.

## Remote login (name-only, no password — owner's choice)

-   [ ] From the Mac (127.0.0.1/localhost): no login required anywhere.
-   [ ] Through the tunnel/public URL: pages redirect to /login ("Who's
    using BookKeep?" — no password field); API calls 401 until a name
    is given; empty name rejected.
-   [ ] After entering a name: 90-day session; the app automatically
    opens (or creates, once) the profile with that name on the device;
    reloads don't duplicate profiles; /logout returns to the login page.

## Plans (Free $0 / Standard $10 / Pro $50 — restructured 2026-08-24)

-   [ ] New profiles start on Free; three cards, current highlighted.
-   [ ] Free: full manual bookkeeping with ALL entry types (incl.
    investments); the agent composer is disabled with an explanatory
    placeholder; AI mode locked.
-   [ ] Standard: helper (local) agent books entries; AI (LLM) mode
    still shows "— Pro" and is locked.
-   [ ] Upgrade confirms $50/month and unlocks everything; downgrade
    re-locks and switches the agent back to the free local parser.
-   [ ] Email login: both name and email required (fake emails
    refused); member emails appear in the Members list; the owner
    email (BOOKKEEP_OWNER_EMAIL) is creator no matter the name typed;
    creator has all Pro features free on any plan (👑 on Plan page).
-   [ ] Top-right chip shows 👤 name (+👑 creator) when logged in,
    💻 Creator on the Mac; clicking logs out after confirm. Closing
    the tab does NOT log out (90-day session).
-   [ ] Members 🗑️ removes only the membership row (creator only;
    404 for unknown names; non-creators 403); books/backups untouched.
-   [ ] Creator tools: logging in as "Hardy Wu" (or any local access)
    shows Settings → Members with every login name, dates, visit
    counts, and a discount editor; other members get 403 on the API
    and no panel. A saved discount appears on that member's Plan
    cards as a crossed-out price and a 🎁 note.

## Backend failure modes

-   [ ] storage mode=backend with server stopped: local entry still
    works; an amber banner appears at the bottom saying N records are
    not yet saved to the backend.
-   [ ] The banner and its queue survive a page reload.
-   [ ] Once the backend is reachable again, clicking the banner (or
    waiting ≤45 s, or the device coming back online) drains the queue
    and removes the banner; SQLite row counts match.
-   [ ] Re-saving the same record twice (retry/sync) does NOT add a
    second audit-log event.
-   [ ] Restart + "Sync current user now" uploads missed records;
    SQLite row counts match.
-   [ ] /api/agent with missing key → clear error message in chat.

## Regression list (rerun after every parser/accounting change)

`node parser_tests.js`, plus manually: $1,000-in-sentence, evening
"today", multi-sale $3+$5, cash-sale journal (Dr Cash / Cr Sales
Revenue), A/R invoice case, edit-a-transaction ($→ ledger+statements
update, history kept), balance-sheet ✓ equation, evidence signature,
no-"Unknown" sweep.
