# BookKeep Lite v13 — Clean Start

This version intentionally starts clean.

## What changed

- There is **no reset button** in the app.
- The browser uses a brand-new localStorage namespace, so old test users/transactions from prior versions will not appear.
- The backend uses a brand-new database file: `bookkeep_v13.db`.
- The backend evidence files use a brand-new folder: `evidence_files_v13`.

## If you already ran an older backend

Old databases such as `bookkeep.db` are not used by v13.

To wipe the v13 backend later from Terminal, close the backend and run:

```bash
python3 wipe_backend.py
```

To wipe the browser-side data (users, transactions, transcripts,
evidence stored in localStorage), open `wipe_browser.html` in the same
browser you use for the app — it removes only the BookKeep keys and
links back to a fresh app.

Then restart:

```bash
./run_backend.sh
```

## Important

The app cannot directly delete files from your Mac. Browser data and backend database files live on your device.
This v13 package avoids old test data by using new storage/database names.
