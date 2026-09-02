# TASKS.md — Build Plan & Task Breakdown
## Project "FIFA" — Original AAA-Style Football Simulation

> **Read [PRD.md](PRD.md) first** for full requirements. This file defines the ORDER of work.
> **Rule #1: do not skip ahead.** Core gameplay (Phases 1–4) must work before any polish, menus, or cinematics. Do not spend effort on menus or cutscenes until the football itself plays well.
> Verify each phase against [TESTING.md](TESTING.md) before moving to the next.

---

## How to work this file
- Tasks are grouped into 9 phases. Complete phases in order.
- Check off tasks as they are completed: `- [x]`
- Each phase ends with an **Exit criteria** gate — all must pass (see TESTING.md) before starting the next phase.

---

## Phase 1 — Foundation: pitch, teams, movement, ball
> Goal: two teams of capsules/placeholder models on a pitch, one controllable player, a physically believable ball.

- [ ] Project setup: engine choice, repo structure, 60 FPS performance budget established from day one
- [ ] Regulation-size pitch with boundaries, goals, and center circle (placeholder textures OK)
- [ ] Spawn 11v11 players in formation (placeholder models OK)
- [ ] Player locomotion controller: walk/jog/run/sprint with acceleration, deceleration, turning inertia, momentum (NO instant 180° turns at sprint)
- [ ] Player switching between team members
- [ ] Ball physics: gravity, bounce, roll, friction, air resistance, spin; collisions with players, posts, crossbar, net
- [ ] Basic camera (broadcast-style follow)
- [ ] Controller + keyboard input layer (remappable architecture from the start)

**Exit criteria:** ball never sticks magnetically to feet; movement has visible momentum; stable 60 FPS with 22 players + ball.

---

## Phase 2 — Core actions: passing, shooting, dribbling, defending
> Goal: a fun 1v1-to-small-sided kickabout.

- [ ] Contextual passing: short, driven, lofted, through ball, lobbed through ball
- [ ] Crossing: standard, driven, curled; cutbacks and backheels
- [ ] Shooting: normal, finesse, power, chip, low driven, first-time; headers, volleys, half-volleys
- [ ] First touch and close-control dribbling; sprint dribbling with knock-on touches; slow/precision dribbling; shielding
- [ ] Defending: standing tackle, sliding tackle, shoulder challenge, jockey + sprint jockey, interception, shot blocking
- [ ] Pass/shot outcome driven by placeholder attribute values (accuracy, power, composure, pressure, body orientation)
- [ ] Skill moves (first batch): stepover, body feint, ball roll, drag back, fake shot

**Exit criteria:** passing/shooting feel responsive and aimable; tackles win the ball cleanly or concede fouls-to-be; dribbling differentiates a 90-rated vs 60-rated placeholder player.

---

## Phase 3 — 11v11 tactical AI
> Goal: both teams behave like organized football teams.

- [ ] Formation system (4-4-2, 4-3-3, 4-2-3-1, 4-1-2-1-2, 3-5-2, 3-4-3, 5-3-2) with positional anchoring
- [ ] Off-ball attacking AI: overlapping runs, diagonal runs, staying onside, finding space, counterattack runs
- [ ] Midfield AI: passing triangles, switching play, tempo control, defensive cover
- [ ] Defensive AI: line-keeping, shape maintenance, tracking runners, closing passing lanes, covering teammates, pressing + second-man press
- [ ] Team tactics settings: depth, width, pressing intensity, build-up speed, players in box, fullback behavior, striker runs; presets Ultra Defensive → Ultra Attacking
- [ ] Difficulty levels (Beginner → Legendary) affecting decision quality, NOT raw speed
- [ ] Player personality archetypes: fast winger, playmaker, target striker, defensive midfielder

**Exit criteria:** watching AI vs AI looks like football — no ball-chasing swarms; formations visibly hold; difficulty changes are noticeable in decisions.

---

## Phase 4 — Rules, goalkeepers, set pieces
> Goal: a complete legal match can be played start to finish.

- [ ] Goalkeeper AI: positioning, dynamic diving/reaching saves (no canned outcomes), catch vs parry, 1-on-1s, claiming/punching crosses, sweeper behavior, distribution
- [ ] Referee system: fouls (contact severity + timing), advantage rule, yellow/red cards, penalty awards
- [ ] Offside detection with correct restart
- [ ] Set pieces: corners, throw-ins, goal kicks, penalties
- [ ] Free kicks with aim/power/curve/topspin/knuckleball controls
- [ ] Match structure: kickoff, halves, halftime, injury time, full time, match clock, scoreboard
- [ ] Substitutions (in-match)
- [ ] Halftime + full-time statistics screens (possession, shots, xG, ratings, heatmaps)

**Exit criteria:** a full match runs with zero rule errors across 10 consecutive test matches; keepers save realistically and occasionally err.

---

## Phase 5 — Animation & player attributes
> Goal: players move beautifully and individually.

- [ ] Full animation pass: foot planting, turning, stumbles, falls, recovery, jumps, landings, shoulder-to-shoulder
- [ ] Full attribute system wired to gameplay (all categories in PRD §6) — ratings must visibly matter
- [ ] Fatigue/stamina system affecting speed and precision late in matches
- [ ] Remaining skill moves: roulette, heel-to-heel, elastico, reverse elastico, la croqueta, scoop turn, rainbow flick, heel flick, spin move (skill-rating gated)
- [ ] Weak foot and composure effects
- [ ] Celebration animations: knee slide, arms raised, jump, team huddle, corner-flag; teammates join dynamically

**Exit criteria:** side-by-side test of high vs low-rated players shows obvious behavioral difference; animation blends without sliding feet.

---

## Phase 6 — Stadium, crowd, audio, broadcast presentation
> Goal: it looks and sounds like a televised match.

- [ ] Full stadium: 40k–70k animated crowd (instanced/optimized), flags, screens, ad boards, benches, tunnel, staff
- [ ] Dynamic crowd reactions (goals, misses, cards, late winners)
- [ ] Spatial audio: chants, roar, whistles, ball impacts, net sounds, tackles
- [ ] Dynamic commentary system with anti-repetition logic (original/placeholder voices)
- [ ] Camera suite: Broadcast, Dynamic, Co-op, End-to-end, Player, Replay
- [ ] Auto-replay system: goals, near misses, saves, fouls, skill moves — slow-mo + cinematic angles
- [ ] Pitch detail: mow patterns, grass deformation, footprints; weather (rain, wet pitch) affecting ball behavior
- [ ] Lighting: day/night, stadium shadows; cloth/jersey/hair physics

**Exit criteria:** 60 FPS holds with full stadium; crowd/commentary react correctly to 20 scripted match events.

---

## Phase 7 — Menus, team selection, tactics UI
> Goal: the full pre-match → match → post-match loop with premium UI.

- [ ] Main menu: PLAY / CAREER / TOURNAMENT / ONLINE (placeholder) / TRAINING / CUSTOMIZE / SETTINGS
- [ ] Pre-match flow: team select, home/away, formation, lineup + bench editing, kits, stadium preview, difficulty, duration, weather, day/night
- [ ] Cinematic match intro: stadium exterior, tunnel, walk-out, lineups, formation graphics
- [ ] In-match HUD: score/clock, player name/stamina/rating, minimap, indicators, card/sub notifications
- [ ] In-match pause menu: tactics changes, substitutions, camera settings, controls
- [ ] Full remappable controls UI; multi-controller local multiplayer (PvP, co-op)
- [ ] Fictional content database: leagues, clubs, kits, badges, ~500+ generated players with attributes

**Exit criteria:** a new user can go from launch to playing a full match without documentation; all UI is original.

---

## Phase 8 — Career & tournament modes
> Goal: long-term play value.

- [ ] Tournament mode: knockout, group+knockout, custom competitions, team selection
- [ ] Manager career: club selection, budgets, transfers (buy/sell/loan), scouting, youth academy, contracts, training, player development, injuries, morale, chemistry, board objectives
- [ ] Season structure: league + domestic cup + continental tournament, with tables, fixtures, results simulation for non-played matches
- [ ] Player career: create-a-player (appearance, position, nationality, number), match objectives, skill-point progression, transfers, national team call-ups
- [ ] Training mode: drills (passing, shooting, dribbling, defending, free kicks, penalties, goalkeeping) + free-practice arena
- [ ] Save/load system for careers and tournaments

**Exit criteria:** a full simulated season completes without errors; saves survive restart.

---

## Phase 9 — Polish, optimization, bug fixing
> Goal: ship quality.

- [ ] Performance pass: LOD, occlusion culling, GPU instancing, texture streaming, animation LODs, crowd optimization
- [ ] Graphics presets: low / medium / high; verify 1080p60 minimum on mid-range hardware
- [ ] Menu transitions, motion graphics, depth of field in cutscenes
- [ ] Full bug triage and fix pass (all severities from TESTING.md logs)
- [ ] Game-feel tuning pass: input latency audit, pass/shot assistance tuning, difficulty curve balancing
- [ ] Final originality audit: confirm zero copyrighted assets, names, likenesses, or recordings anywhere

**Exit criteria:** all TESTING.md acceptance suites pass; performance targets met on all three hardware tiers.

---

## Cross-cutting rules (apply to every phase)
1. **60 FPS is a feature.** Profile every phase; never merge work that drops the frame rate below target on mid-range hardware.
2. **Responsiveness beats visuals.** Any effect that adds input latency gets cut.
3. **Original assets only.** No copyrighted names, logos, kits, faces, audio, or code — ever, including placeholders that could "slip through."
4. **Test before advancing.** Run the relevant TESTING.md suite at each phase gate.
5. **Log bugs, don't hide them.** Every known issue goes in the bug log (see TESTING.md §7).
