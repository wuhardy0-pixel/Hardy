# House rules for anyone (human or agent) working in company/

1. **Read first.** Open the folder's `README.md`, then `PRD.md`, `TASKS.md`, `TESTING.md` (where they exist) before changing anything. The company map is `company/README.md`.
2. **One database, one login.** Only `corporate/` stores customers, orders, sessions or books. Site, shop, games and apps ask corporate through its API. Never copy customer data elsewhere.
3. **Products are independent.** A game or app must not depend on another product. It may borrow the sign-in bar from hardywu.com with one script line; it never contains sign-in code.
4. **Never commit** `corporate/data/`, `corporate/.env`, `node_modules`, `.next`, `.venv`, Unity `Library/`, or files over about 10 MB.
5. **Finish properly.** Run the folder's `TESTING.md` checks, add a dated line to its `TASKS.md`, and delete any test people, test orders, test backups or test activity you created. Real customer data must look exactly as it did before you started.
6. **Naming.** Lowercase with dashes, the name customers see (`football-sim`, not `fifa`).
7. **Barbara is the owner and is not technical.** Decide technical matters yourself; ask her only plain-language business questions. Hardy Wu (wuhardy0@gmail.com) is the creator and sees orders, the print queue and visitors.
8. **Live system.** The server on this Mac serves real customers. Restart it only after a syntax check, and check `/api/health` afterwards. Test with `X-Forwarded-Proto: https` and a `Host:` header against 127.0.0.1:5000.
