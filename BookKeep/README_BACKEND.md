# BookKeep Lite v12 — Durable Evidence Backend

## What this adds

- SQLite database for transcripts, receipts/evidence, and double-entry journal entries.
- Receipt/signature images saved as files instead of only browser localStorage.
- SHA-256 hash for every transcript, journal entry, signature, and uploaded receipt/invoice image.
- Hash-chained audit log so later changes to stored records can be detected more easily.
- Browser can keep a local cache while sending new evidence to the backend.
- Manual "Sync current user now" button.

## Run on Mac/Linux

Open Terminal in this folder:

```bash
chmod +x run_backend.sh
./run_backend.sh
```

The backend will run at:

```text
http://127.0.0.1:5000
```

Then open `index.html`, go to Settings:
- Backend URL: `http://127.0.0.1:5000`
- Storage mode: `Backend + browser cache`
- Press `Test backend`
- Press `Sync current user now`

## Windows

Run:

```text
run_backend.bat
```

## Important evidence note

The SHA-256 hashes and hash-chained audit log make records **tamper-evident**, not legally immutable. Someone with full control of the computer/database could still alter or replace the database. For stronger evidentiary integrity, a later production version should use authenticated users, server access controls, encrypted backups, an append-only/WORM store, and optionally an external timestamp/notary service.
