# BookKeep — AI Agent Architecture (v1)

## Goal

On an iPhone: **dictate a transaction or take a picture of an invoice.
Everything else is automated by the agent** — transcript storage,
evidence hashing, journal entry, posting to T-accounts, statements.
The user's only remaining jobs are (1) speak or snap, (2) review and
approve/sign, (3) look at reports. No manual bookkeeping.

## The one design rule

The LLM does every step that requires **understanding** (speech,
photos, messy human language → structured data). Deterministic code
does every step that has **exactly one correct answer** (balance
checks, posting debits/credits into accounts, adding up statements).
The agent still "does all the transformation" — but the sort and
statement steps are *tools the agent calls*, not text it generates, so
a hallucination can never corrupt the books. Every proposal passes a
validator, and nothing posts without user approval (PRD rule: never
silently post).

## User experience (iPhone)

1. Open BookKeep (home-screen app).
2. Tap 🎤 and talk, or tap 📷 and photograph the invoice/receipt.
3. Agent thinks for a few seconds → shows: proposed journal entry
   (Dr/Cr, standard chart accounts), the date, the evidence attached,
   and a confidence note or a clarifying question.
4. User taps Approve (and signs if it's a receipt situation).
5. Done. Journal → T-accounts → statements all update automatically.

## Architecture

```
iPhone (web UI, installed)                 Your Mac / server
┌──────────────────────────┐      ┌────────────────────────────────┐
│ 🎤 dictation → text      │      │ Flask backend                  │
│ 📷 camera → image        │ HTTPS│  POST /api/agent               │
│ ✍️ signature canvas      ├─────▶│   1. store transcript (T-ID)   │
│ review & approve UI      │      │   2. store image (R-ID + hash) │
└──────────────────────────┘      │   3. call LLM (key stays here) │
                                  │   4. validate (balanced? schema│
                                  │      ? duplicate? date sane?)  │
                                  │   5. return proposal           │
                                  │  POST /api/approve             │
                                  │   6. post journal → ledger     │
                                  │   7. rebuild statements        │
                                  │  SQLite: transcripts, receipts,│
                                  │  journal, ledger_accounts,     │
                                  │  postings, audit_log           │
                                  └───────────┬────────────────────┘
                                              │ one API call
                                              ▼
                                   Claude API (or OpenAI — pluggable)
```

Key points:

- **The API key never touches the phone.** The app talks only to your
  Flask server; the server talks to the AI provider. (Already the
  rule in AI_SERVER_CONTRACT.md.)
- **Evidence is stored before the AI sees anything.** Transcript and
  image are written and hashed first; the T-ID/R-ID goes into the
  agent request, so the whole chain stays tamper-evident.
- **Provider is pluggable.** The app's contract is with *your*
  server. Behind it you can use Claude (recommended — one model does
  both text and invoice photos with schema-enforced JSON) or the
  ChatGPT API. Swapping providers is a server-side change only.

## The agent's contract

One multimodal call per transaction. Input:

```json
{
  "transcript": "Daddy bought a ruler from me for $1,000 cash",   // optional
  "image": "<base64 photo of invoice>",                            // optional
  "transcriptId": "T_...",
  "context": {
    "today": "2026-08-13",
    "accountingMethod": "cash",
    "chartOfAccounts": ["Cash","Checking","Accounts Receivable","Supplies",
      "Equipment","Accounts Payable","Owner's Equity","Sales Revenue",
      "Service Revenue","Interest Income","Other Income","Supplies Expense",
      "Rent Expense","Utilities Expense","Wages Expense","Other Expense"],
    "userAccounts": [{"name":"Checking","type":"Checking"}],
    "recentTransactions": ["...last 10, for duplicate detection..."]
  }
}
```

Output is **schema-enforced JSON** (the provider is forced to match
this shape — no parsing failures):

```json
{
  "needs_clarification": false,
  "question": "",
  "summary": "1 cash sale of $1,000 (ruler, customer: Daddy).",
  "extracted": {                      // filled from the photo, if any
    "vendor": "Hardware Depot", "invoiceDate": "2026-08-12",
    "lineItems": [{"desc":"PLA filament","amount":22.00}], "total": 22.00
  },
  "entries": [{
    "date": "2026-08-13",
    "description": "Cash sale — ruler (Customer: Daddy)",
    "lines": [
      {"account": "Cash",          "debit": 1000, "credit": 0},
      {"account": "Sales Revenue", "debit": 0,    "credit": 1000}
    ],
    "confidence": 0.95
  }]
}
```

Rules baked into the system prompt: account names must come from the
chart of accounts (plus the user's real accounts) — never raw item
words; separate transactions stay separate; totals are computed from
the lines; ambiguity → `needs_clarification`, never a guess.

## Tools the agent system needs

| Tool | Kind | What it does |
|---|---|---|
| Speech→text | iOS built-in dictation (recommended: free, on-device, works in Safari today) or Whisper API server-side | Voice → transcript |
| Vision | The same LLM call (Claude and GPT-4-class models read images natively — no separate OCR service needed) | Invoice photo → vendor/date/items/total |
| `validate_entry` | Deterministic code | Debits = credits, accounts in chart, date in range, amount > 0 — rejects before the user ever sees it |
| `check_duplicate` | Deterministic code | Same date+amount+description → warn |
| `post_to_ledger` | Deterministic code (exists: buildLedger) | Approved journal lines → T-accounts, runs on approve |
| `build_statements` | Deterministic code | Ledger balances → BS / IS / CF |
| `ask_user` | UI | Clarifying question when the agent flags ambiguity |

## Model recommendation

- **Default: Claude Opus 5** (`claude-opus-5`, $5/$25 per MTok) — one
  model handles the transcript, the invoice photo (high-res vision),
  and schema-enforced JSON output in a single call.
- **Budget option: Claude Haiku 4.5** ($1/$5) — fine for simple
  dictated entries; keep Opus for photos.
- **ChatGPT option**: GPT-4-class models through the same server
  contract; only `call_provider()` on the server changes.
- **Cost reality check**: a dictated entry ≈ 1–2¢; an entry with an
  invoice photo ≈ 3–5¢ on Opus 5 (a photo is up to ~4.8K input
  tokens). Even heavy family use is a few dollars a month.
- **Free fallback stays**: the existing local parser remains the
  no-API mode; the agent endpoint is additive.

Server sketch (Flask, key stays server-side):

```python
import anthropic
client = anthropic.Anthropic()  # ANTHROPIC_API_KEY from env

def run_agent(transcript, image_b64, context):
    content = []
    if image_b64:
        content.append({"type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}})
    content.append({"type": "text",
        "text": f"Transcript: {transcript}\nContext: {json.dumps(context)}"})
    resp = client.messages.create(
        model="claude-opus-5",
        max_tokens=16000,
        system=BOOKKEEPER_SYSTEM_PROMPT,   # chart-of-accounts rules above
        output_config={"format": {"type": "json_schema", "schema": ENTRY_SCHEMA}},
        messages=[{"role": "user", "content": content}],
    )
    if resp.stop_reason == "refusal":
        return {"needs_clarification": True, "question": "I couldn't process that — try rephrasing."}
    return json.loads(resp.content[0].text)
```

## Getting it onto the iPhone

Phased, cheapest-first:

1. **PWA (do this first, ~zero new code)**: serve the existing UI
   over HTTPS from the Flask server, add a web-app manifest → "Add to
   Home Screen" in Safari. Camera already works in mobile Safari via
   `<input type="file" capture="environment">`; voice works via the
   iOS keyboard's dictation mic into the text box (more reliable on
   iOS than the Web Speech API).
2. **Tauri 2 mobile** (matches the PRD's Tauri plan — Tauri 2 builds
   iOS apps): wrap the same UI when you want a real App Store-style
   install, offline SQLite on device, and native mic access.

## Phased build plan

1. **Phase 1 — text agent on the server**: `POST /api/agent`
   (transcript → proposed journal via LLM + validator), wire the
   existing "API mode" setting to it. App unchanged otherwise.
2. **Phase 2 — invoice photos**: image upload in the same call;
   extracted invoice shown next to the proposal; photo stored as
   receipt evidence with hash (already supported).
3. **Phase 3 — ledger + statements on the server**: `ledger_accounts`
   + `postings` tables (the "sort" output persisted, per the DB
   design), statements built from ledger; statement drill-down.
4. **Phase 4 — iPhone**: manifest + HTTPS → installable PWA; later
   Tauri 2 iOS build.

## Safety / trust checklist

- Transcript + image stored and hashed **before** interpretation.
- Agent output schema-validated, then accounting-validated
  (balanced, chart accounts only), then duplicate-checked.
- User approves (and signs) before posting — the agent can never
  write to the journal directly.
- Posting and statements are deterministic code; the LLM never does
  the arithmetic that the books depend on.
- API key lives only on the server; the phone never sees it.
