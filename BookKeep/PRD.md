# BookKeep — Product Requirements Document

Last updated: 2026-08-14. Read this together with TASKS.md (state +
roadmap) and TESTING.md (test plan). AGENT_DESIGN.md holds the full AI
architecture; AI_SERVER_CONTRACT.md the app↔server API shape.

## Product

BookKeep is an **agent-first** bookkeeping app for a small/family
business (built by a parent with their kid, whose family members are
often the customers). The end goal: install it on an iPhone, then
either **dictate a transaction or photograph an invoice — the agent
does everything else**: stores the exact transcript as evidence,
proposes double-entry accounting, and after one user approval posts to
the journal, sorts into ledger T-accounts, and regenerates the
financial statements. The user's only jobs are speak/snap, review &
sign, and read reports.

## Core design rule

The LLM does every step that requires **understanding** (speech,
photos, messy language → structured entries). Deterministic code does
every step with **exactly one right answer** (balance validation,
posting to T-accounts, summing statements). The agent can never write
to the books directly — proposals pass a schema check, a deterministic
validator, and explicit user approval ("never silently post").

## Core workflow

1.  Speak or type (photo of invoice: planned Phase 2).
2.  Exact transcript stored at APPROVAL time (product decision
    2026-08-23, reversing the earlier transcript-first rule): only
    approved transactions leave evidence. Chat noise, clarifying
    questions, and cancelled proposals never become evidence. A
    multi-turn conversation is stored as one combined transcript on
    the entry it produced. T-ID, speaker (profile name), date/time,
    effective date, source (voice/typed/manual).
3.  Agent interprets: LLM API mode (recommended; backend `/api/agent`
    → OpenAI) or free local parser mode.
4.  Proposal preview: entries, accounts to create, confidence,
    duplicates flagged; ambiguity produces a clarifying question, not
    a guess.
5.  User edits/approves.
6.  Balanced journal entry (J-ID) linked to T-ID and source
    transaction; posts to the ledger (T-accounts) automatically.
7.  Statements (Balance Sheet / Income Statement / Cash Flow) are
    built strictly from ledger balances.
8.  Drill-down everywhere: statement → ledger → journal → transcript →
    signature/receipt.

## UI surface (current, deliberate)

Tabs: Dashboard, Agent, Transactions, Journal, Ledger, Evidence,
Reports, Settings.

- **Accounts and Investments tabs were removed on purpose** (product
  review 2026-08-13): the agent creates accounts as needed; the
  investments feature was legacy. Do not re-add without asking.
- Transactions: list with ✏️ edit-in-place; manual add form demoted to
  a collapsed section (the Agent is the primary entry path).
- Journal: conventional format — debit line first, credit indented,
  Dr/Cr columns, totals, Balanced badge, See-evidence button.
- Ledger: classic textbook T-accounts — title above, vertical rule,
  debits left / credits right, dated postings, totals, double-underlined
  ending balance on the normal side; account IDs (A1…) and types
  (Asset/Liability/Equity/Revenue/Expense); click a posting → evidence.
- Evidence: compact rows (date • excerpt • speaker • voice/typed •
  signed / needs-signature badges); Details page shows exact
  transcript, journal trail, signature and invoice images, integrity.
- Reports: one statement at a time (tabs); Balance Sheet displays the
  accounting equation with a live ✓/⚠ check.
- Settings: Profile (user/business name + delete-profile button,
  double-confirmed, last profile protected) → AI Agent → Accounting →
  Storage & Backup → collapsed local-agent learning.

## Data model

### Users / profiles
Multiple profiles, each with fully separate books, settings, and
learning. Renameable (no "Default User"; fresh installs say "My Books"
until named). No authentication yet — profiles are device-level, not
security.

### Transcript
T-ID, user, ISO timestamp, effective date, speaker (profile name at
capture), source voice/typed/manual, exact text. Stored before any
interpretation; persisted at capture. Manual form entries generate a
transcript too (a plain-language restatement of the form fields), so
every transaction — agent or manual — has signable evidence.

### Receipt / evidence
R-ID, T-ID link, signer name typed by user, signature image (canvas),
optional invoice/receipt photo, timestamp. Backend stores SHA-256
hashes + hash-chain audit log (tamper-evident, not tamper-proof).

### Transactions (append-only edits)
Editing never overwrites: the old record gets `superseded: true` /
`supersededBy`, the new record carries `revisionOf` + `editedAt`.
Superseded records are excluded from balances/lists/ledger but stay in
the DB and in CSV export (status + revision_of columns).

### Journal
J-ID, T-ID, `sourceTxId` (link to the transaction that produced it),
date, description, lines[{account, debit, credit}]. Debits must equal
credits. Editing a transaction supersedes its journal entry and writes
a fresh one.

### Ledger (derived)
`buildLedger(asOf)` posts active journal lines into per-account
T-accounts: stable IDs (A1…), classified type, normal balance, dated
postings, ending balance. Derived at render time — journal is the
system of record for the books; a persisted server-side ledger table
is planned (Phase 3).

## Chart of accounts

Cash, Accounts Receivable, Equipment, Supplies, Accounts Payable,
Owner's Equity, Sales Revenue, Service Revenue, Interest Income,
Other Income, Cost of Goods Sold, R&D Expense, Supplies Expense,
Rent Expense, Utilities Expense, Wages Expense, Other Expense.

Standard costing (product decision 2026-08-23): supplies are bought
as the Supplies asset; the `use_supplies` adjusting entry moves value
out of Supplies into Cost of Goods Sold (materials inside sold
products — per-product estimates from slicer grams × cost/gram), R&D
Expense (tests, failed prints, waste), or Supplies Expense (general).
A sale message that states its material cost creates the income AND
the COGS adjustment; the agent never estimates a material cost
itself. (Checking was dropped from the
displayed chart 2026-08-23 — the business is cash-only; bank accounts
can still be created by the agent on request and classify as assets.)

The full chart is shown in-app (Settings → Accounting → "Chart of
accounts", with plain-language explanations); the manual form's Type
and Category are strict grouped dropdowns of these names. **Cash is
the default money account** for fresh profiles (product decision
2026-08-23 — this is a cash-run family business); "Checking" remains
available but is no longer created by default, and legacy default
Checking accounts are migrated (unused → removed/renamed; with
history and no Cash → renamed incl. journal lines; alongside a used
Cash → left alone).

Journal/ledger account names must come from this chart (plus the
user's real accounts) — never raw item words. "Sales" is wrong;
"Sales Revenue" is right (migrations renamed legacy data). Item and
customer details belong in the note.

Buyer-vs-seller rule (this is the user's own books): someone ELSE
buying ("Daddy bought a ruler") is a customer purchase → income /
Sales Revenue; only the user's own purchases ("I bought…", "paid…")
are expenses. Saying "cash" targets a Cash account, created via a
proposed create_account action if missing.

## Agent

Two modes, switchable in Settings:

- **LLM API (recommended)** — app POSTs {model?, message, context} to
  the backend's `/api/agent` (endpoint field blank = Backend URL +
  `/api/agent`). Flask calls OpenAI (`OPENAI_API_KEY` +
  `OPENAI_MODEL` from `.env`, currently `gpt-5.6-terra`; verified also
  with `gpt-5.1`) with a strict JSON schema, then a deterministic
  validator re-checks amounts/dates/types/totals; failures come back
  as clarifying questions, never bad entries. The API key never
  reaches the browser. Handles cases the local parser can't: A/R
  invoices, A/P bills, arbitrary phrasing.
- **Local parser (free fallback)** — regex/rule-based; all amount
  regexes share one AMOUNT_SRC pattern ($1,000 / 1k / decimals /
  written numbers incl. hundred/thousand); local-time natural dates;
  reinforcement-style preference learning from approvals/corrections.

Both must: keep separate amounts separate, recompute totals, flag
duplicates, use chart accounts, never invent data, and ask instead of
guessing. CRITICAL invariant: $1,000 must never become $1.

## Voice

Mic button records through pauses until Stop or ~200 tokens;
transcript stays reviewable before submission; dictated entries store
source=voice. On iPhone the iOS keyboard mic is the recommended input
(more reliable than Web Speech in Safari).

## Financial statements

Built strictly from ledger balances so they always reconcile with the
T-accounts. Balance Sheet: Assets, Liabilities, Equity (contributed
equity accounts + current-period net income; no closing entries yet),
with the accounting equation checked and displayed. Income Statement:
revenue/expense accounts. Cash Flow: journal entries that move
cash-like accounts, classified operating/investing/financing by the
counterpart account type; cash↔cash transfers excluded. Known gap:
account opening balances aren't in the ledger yet (need opening
journal entries).

## Architecture

- **Frontend**: static HTML/CSS/JS (index.html, app.js, style.css),
  browser localStorage per user profile. Opened via file:// today.
- **Backend**: Flask + SQLite (`server.py`, run `./run_backend.sh`,
  port 5000). Tables: transcripts, receipts, journal, audit_log.
  Endpoints: transcripts/journal/receipts save with hashing +
  audit chain, `/api/audit/verify`, `/api/agent` (AI proxy).
  Secrets in `.env` (gitignored; `.env.example` documents keys).
- **Roadmap** (AGENT_DESIGN.md): Phase 2 invoice photos through the
  same agent call; Phase 3 server-side ledger_accounts + postings
  tables and statements; Phase 4 installable iPhone PWA over HTTPS,
  then Tauri 2 iOS build.
