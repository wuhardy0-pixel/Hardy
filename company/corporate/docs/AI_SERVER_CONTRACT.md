# AI Bookkeeping Server Contract

> **Built-in implementation:** `server.py` now ships `POST /api/agent`
> implementing this contract with the OpenAI API (key + model in
> `.env`, schema-enforced JSON, deterministic validation). The app's
> "LLM API" mode uses it automatically when the API endpoint field is
> left blank (Backend URL + `/api/agent`). A custom external server
> only needs to honor the shapes below.

The browser app POSTs JSON to the endpoint configured in Settings:

```json
{
  "model": "optional model name",
  "message": "Daddy bought a ruler for $1...",
  "context": {
    "today": "2026-08-13",
    "accountingMethod": "cash",
    "accounts": [{"name":"Checking","type":"Checking"}],
    "instructions": ["..."],
    "responseShape": {"...":"..."}
  }
}
```

Your server should call the LLM and return JSON in this shape:

```json
{
  "needs_clarification": false,
  "question": "",
  "summary": "I found two sales totaling $6.00.",
  "total": 6,
  "actions": [
    {"kind":"create_account","name":"Income","type":"Income"},
    {
      "kind":"transaction",
      "entry":{
        "date":"2026-08-11",
        "type":"income",
        "accountName":"Income",
        "category":"Sales",
        "amount":1,
        "note":"Ruler — Customer: Daddy"
      }
    },
    {
      "kind":"transaction",
      "entry":{
        "date":"2026-08-11",
        "type":"income",
        "accountName":"Income",
        "category":"Sales",
        "amount":5,
        "note":"Crab Gauge — Customer: Mommy"
      }
    }
  ]
}
```

If the message is ambiguous, return:

```json
{
  "needs_clarification": true,
  "question": "Which account received the $100?",
  "summary": "",
  "total": 0,
  "actions": []
}
```

Keep the provider API key on the server, never in the public browser/itch.io JavaScript.
