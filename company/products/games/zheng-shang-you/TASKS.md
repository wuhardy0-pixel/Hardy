# 争上游 — done and next

## 2026-10-14
- First version: rules engine (classify/beats), 2–5 players, simple house AI (sheds low cards, keeps bombs for threats), phone-first layout, pause, hint, standings, play again. Registered on the site games section; `__zsy` test hooks; Playwright play-through test passes.

- Barbara: '18 cards and random so it is not stacked like 5 bombs'. Hands are now capped at 18 (2 players: 18 each, 18 cards sit out; 4 players: 14/14/13/13), the shuffle uses crypto randomness, and a deal is redone if any hand holds 3 or more bombs. Checked over 200 deals.

- Barbara: 'make sure player can see all of their cards'. The hand no longer scrolls: cards lay out in rows of up to 10 that overlap just enough to fit the screen width, so all 18 are visible at once with every rank readable (checked at 360, 390 and 430 px wide).

- Barbara: 'name the people and multiple people play'. Start screen now lists the seats: type each name and tap 🧑 Person / 🤖 Computer. Several people share one phone: before another person's turn a cover screen says '<name>, your turn — pass the phone', and their cards appear only after they tap. Opponent panels and standings use the names. Tested: Hardy + Mom + Grandma(computer) to the end; solo game unchanged.

- Barbara: 'people on separate devices should also be able to play — choose one device or a room; create or join'. Start screen now has 📱 One phone / 🌐 Online room. Online: name + Create (2–5 seats) → 4-letter code and share link (?room=CODE); Join with a code; lobby lists seats, host starts, empty seats become computers; the table updates live (long-poll); host gets Play again; a reload returns you to your seat. Server: `/api/zsy/rooms…` in corporate/server.py (rules engine ported to Python; rooms in memory, 2 h idle expiry).

## Next
- Ask Hardy: should the champion's rank carry over as points across games? Any regional extras (e.g. 2s as wild)?
- Sound and card-deal animation.
