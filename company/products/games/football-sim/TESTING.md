# TESTING.md — Quality Verification Guide
## Project "FIFA" — Original AAA-Style Football Simulation

> This file defines how we PROVE the game meets the bar set in [PRD.md](PRD.md).
> Each phase in [TASKS.md](TASKS.md) has an exit gate — the corresponding suite below must pass before the next phase begins.
> **The core question for every test: does it feel like a polished football simulation, not an arcade prototype?**

---

## 1. Testing principles

1. **Feel is testable.** "Responsive" and "realistic" are verified with concrete checks (input latency, turn radius, ball behavior), not opinions alone.
2. **Regression matters.** Re-run earlier suites whenever core systems change — a Phase 6 crowd feature must not break Phase 2 shooting.
3. **Watch AI vs AI.** Many bugs only appear when no human is steering. Every suite includes an AI-vs-AI soak match.
4. **Test on the weakest target.** Performance checks run on the low-end/mid-range profile, not the dev machine's best settings.

---

## 2. Performance & responsiveness (every phase)

| Check | Target | How to verify |
|---|---|---|
| Frame rate | ≥ 60 FPS at 1080p, mid-range profile | Profiler over a full match; record 1% lows |
| Frame rate (worst case) | No sustained drops during goals/replays/crowd celebrations | Trigger each event 10×, watch frame graph |
| Input latency | Button press → visible action start feels immediate; audit any added latency each phase | Frame-step recording of press → animation start |
| Memory | No leaks over a 90-minute session | Memory profile across 3 consecutive full matches |
| Load times | Menu → match reasonable; no hitching mid-match | Stopwatch + hitch logging |

**Fail condition:** any merged change that drops the frame rate below target is reverted or fixed before other work continues.

---

## 3. Gameplay feel suites

### 3.1 Movement & locomotion (Phase 1 gate)
- [ ] Sprint at full speed, reverse direction: player must visibly decelerate, plant, and turn — an instant 180° is a FAIL
- [ ] Feet do not slide/skate during walk, jog, run, or turns
- [ ] Acceleration/deceleration differ between a high-pace and low-pace test player
- [ ] Fatigued players (late match) are measurably slower and heavier
- [ ] Player switching selects the sensible nearest/best player and never locks up

### 3.2 Ball physics (Phase 1 gate)
- [ ] Ball is never magnetically glued to feet — heavy touches at sprint separate ball from player
- [ ] Bounce, roll, and spin look natural on flat ground; curl visibly bends flight paths
- [ ] Post, crossbar, and net collisions behave correctly (no pass-throughs, no absurd rebounds) — test 20 shots at each
- [ ] Wet-pitch weather (once implemented) changes ball speed/skid noticeably

### 3.3 Passing & shooting (Phase 2 gate)
- [ ] Every pass type (short, driven, lofted, through, lobbed through, cross, driven cross, curled cross, cutback, backheel) is performable and lands where aimed within skill-based error
- [ ] Every shot type (normal, finesse, power, chip, low driven, header, volley, half-volley, first-time) works from open play
- [ ] Pressure, body orientation, and momentum visibly degrade accuracy
- [ ] A 90-passing player and a 55-passing player produce clearly different results over 20 identical attempts

### 3.4 Dribbling & skill moves (Phases 2/5 gates)
- [ ] Close control keeps ball near feet at low speed; sprint dribbling produces knock-ons
- [ ] Each implemented skill move triggers reliably from its input and can beat a defender
- [ ] Low-skill players fail or are locked out of elite skill moves per rating gates

### 3.5 Defending (Phase 2 gate)
- [ ] Standing and sliding tackles can win the ball cleanly; mistimed tackles concede fouls (once refs exist)
- [ ] Jockey containment slows attackers without auto-winning the ball
- [ ] Interceptions occur when passes are lazily played through covered lanes

---

## 4. AI quality suites (Phase 3 gate, re-run every phase after)

### 4.1 The swarm test (critical)
- [ ] Watch 10 minutes of AI vs AI: at no point do multiple players abandon position to chase the ball like a swarm — **this is an automatic FAIL of the phase gate**

### 4.2 Team shape
- [ ] Pause at random moments: both teams' formations are recognizable (e.g., a 4-4-2 looks like a 4-4-2)
- [ ] Defensive line steps up and drops as a unit; tracks runners
- [ ] Attackers make overlapping/diagonal runs and stay onside during buildup

### 4.3 Difficulty honesty
- [ ] Legendary AI wins via better decisions (passing, positioning, finishing) — log and compare AI attribute/speed values across difficulties to confirm **no hidden speed boosts**
- [ ] Beginner AI is beatable by a new player within their first 3 matches

### 4.4 Personality
- [ ] In a scripted scenario, the fast winger stays wide and sprints in behind; the playmaker drops deep; the target striker attacks crosses; the DM screens the back line

### 4.5 Goalkeepers (Phase 4 gate)
- [ ] Keepers save dynamically — the same shot from the same spot does not produce an identical canned animation every time
- [ ] Keepers occasionally make attribute-appropriate mistakes (log rate over 20 matches; should be rare but nonzero)
- [ ] 1-on-1s, cross claims, and sweeper clearances all occur naturally in soak matches

---

## 5. Rules correctness suite (Phase 4 gate)

Run 10 consecutive full AI-vs-AI matches with event logging. Zero rule errors allowed.

- [ ] Offside: flagged when a player is beyond the last defender at the moment of the pass; NOT flagged when level or onside — verify with replay frame-stepping on 10 offside events
- [ ] Fouls: severity-appropriate cards (light contact = no card, reckless = yellow, violent/DOGSO = red); second yellow = red
- [ ] Advantage: play continues when the fouled team retains a promising attack; play is called back when it doesn't
- [ ] Restarts: corners, throw-ins, goal kicks, free kicks, penalties awarded from the correct spot with correct team
- [ ] Penalties: awarded only for fouls inside the box; playable with aim/power
- [ ] Free kicks: aim, power, curve, topspin, knuckleball all function; walls form correctly
- [ ] Injury time: added time correlates with stoppages; clock, halftime, and full-time transitions are correct
- [ ] Substitutions: work in-match, respect limits, update HUD and stats

---

## 6. Presentation suites (Phases 6–7 gates)

### 6.1 Stadium & crowd
- [ ] Crowd celebrates goals, groans at misses, boos red cards, erupts for late winners — trigger each scripted event and verify audio + animation response
- [ ] Full 40k+ crowd holds 60 FPS (see §2)

### 6.2 Audio & commentary
- [ ] Commentary reacts correctly to goals, saves, fouls, cards, subs
- [ ] No commentary line repeats within a single match under normal event density
- [ ] Spatial audio: ball strikes, net sounds, whistle, and crowd pan/attenuate correctly with camera position
- [ ] All audio is original/placeholder — no copyrighted recordings

### 6.3 Cameras & replays
- [ ] All six cameras (Broadcast, Dynamic, Co-op, End-to-end, Player, Replay) are selectable and playable
- [ ] Auto-replays trigger for goals, near misses, great saves, and fouls; slow-mo is smooth; replay never corrupts match state on return

### 6.4 UI/UX
- [ ] A first-time user reaches a playable match from a cold launch without help (hallway test)
- [ ] HUD elements (score, clock, stamina, minimap, cards, subs) update correctly through a full match
- [ ] All controls are remappable and persist after restart; multiple controllers work in local multiplayer

---

## 7. Modes suites (Phase 8 gate)

- [ ] Tournament: a 16-team knockout and a group+knockout tournament complete with correct advancement and a champion
- [ ] Manager career: simulate 3 full seasons — no crashes, transfers/contracts/injuries/morale all fire, league tables and cup brackets stay consistent
- [ ] Player career: created player progresses, earns skill points, and can transfer clubs
- [ ] Save/load: saving mid-season and reloading restores identical state (verify roster, table, budget, date)
- [ ] Training drills all launch, score the player, and exit cleanly

---

## 8. Originality audit (every phase; final gate at Phase 9)

- [ ] No real player names, likenesses, or real club names/badges/kits anywhere (search content database + assets)
- [ ] No EA/FC 25 code, UI graphics, fonts, stadium assets, animations, music, or commentary recordings
- [ ] All leagues, clubs, players, and branding are fictional/original
- [ ] Third-party assets (if any) have verified licenses permitting commercial use

---

## 9. Bug logging & severity

Log every bug in `fifa/BUGS.md` (create it when the first bug is found) with: description, repro steps, phase/system, severity.

| Severity | Definition | Policy |
|---|---|---|
| **S1 — Blocker** | Crash, corrupted save, match cannot complete, rule error | Fix before any new feature work |
| **S2 — Major** | Gameplay-feel breaker: sliding movement, magnetic ball, AI swarm, canned keeper saves, FPS below target | Fix before the current phase gate |
| **S3 — Minor** | Visual/audio glitch, UI polish, rare cosmetic issue | Fix by Phase 9 |
| **S4 — Nice-to-have** | Tuning suggestions, ideas | Backlog |

---

## 10. Final acceptance (ship checklist)

- [ ] All phase-gate suites above pass
- [ ] 10 consecutive full matches (mixed human and AI) with zero S1/S2 bugs
- [ ] 1080p/60 FPS verified on low, mid, and high graphics presets on representative hardware
- [ ] Full playtest sessions confirm the top-3 priorities: **responsive controls, realistic ball, intelligent AI**
- [ ] Originality audit (§8) signed off
- [ ] The game is genuinely fun to play — playtesters want a rematch
