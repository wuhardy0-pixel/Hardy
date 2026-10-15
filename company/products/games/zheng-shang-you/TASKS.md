# 争上游 — done and next

## 2026-10-14
- First version: rules engine (classify/beats), 2–5 players, simple house AI (sheds low cards, keeps bombs for threats), phone-first layout, pause, hint, standings, play again. Registered on the site games section; `__zsy` test hooks; Playwright play-through test passes.

- Barbara: '18 cards and random so it is not stacked like 5 bombs'. Hands are now capped at 18 (2 players: 18 each, 18 cards sit out; 4 players: 14/14/13/13), the shuffle uses crypto randomness, and a deal is redone if any hand holds 3 or more bombs. Checked over 200 deals.

## Next
- Ask Hardy: should the champion's rank carry over as points across games? Any regional extras (e.g. 2s as wild)?
- Sound and card-deal animation.
