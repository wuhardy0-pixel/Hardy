# fifa/game — playable prototype (v1.1)

### Added in v1.6 — PlayStyles + surface play (no save wipe)
- **PlayStyles (traits):** every player carries 1–2 badges with real mechanical effects, shown as ⚡chips in squad/market: Power Shot (+12% shot power), Finesse (accuracy), Low Driven / Chip Master (boost height-modified kicks), Rapid (+6% speed), Technical (+15% skill-move success), Tiki-Taka (near-perfect short passes), Long Ball (faster/truer long passes & through balls), Interceptor (bigger loose-ball reach), Anchor (standing tackles), Slide Master (cleaner slides, half the foul risk), Aerial (+35% header power), Bruiser (−28% chance of being dispossessed), Second Wind (−40% stamina drain), Set-Piece Spec (laser free kicks/corners); GK-only: Cat Reflexes (+12% saves), Sweeper Keeper (claims far off his line), Footwork (better distribution). Existing careers get traits backfilled; the create-a-player builder offers a choice of 3 role-appropriate PlayStyles.
- **Surface & weather gameplay (v1.5.1):** per-match grass cut (short = quick surface, long = slow), rain accelerates low driven balls (+15%), and hold **1** (low & driven) / **2** (lofted) to control the height of any pass or shot — mirrored in the set-piece aim line.

### Added in v1.5 — trophy scenes, kit designs, player builder (no save wipe)
- **Trophy scenes:** winning the league, Champions Cup, Club World Cup, or World Cup triggers a full celebration — the squad gathers in the centre circle, the captain (highest OVR) hoists a golden trophy overhead, teammates bounce with arms aloft, 500 pieces of confetti rain down, the camera orbits slowly, and the booth erupts ("And there it is! … Lift it high, captain!"). Runs until you continue with 6.
- **Kit designs:** clubs now wear stripes, hoops, sashes, or solids (assigned deterministically per club name) rather than flat single-color shirts.
- **Create-a-player 2.0:** full point-allocation builder — 300 points across PAC/SHO/PAS/DEF/PHY (each 40–99), live OVR preview, in-panel name input (typing doesn't trigger game keys), potential up to 99.
- Model search note: re-searched online for rigged footballer models — free CC0 options are unrigged T-poses (Meshy) and the rigged packs are paid (Studio Ochi/Sketchfab Store); procedural players remain the right call.

### Added in v1.4 — action animations (no save wipe)
- Layered animation system (`setAnim`/`applyActionAnim`) on top of the run cycle, covering: **kick** (backswing + follow-through on every pass/shot, planted standing leg, torso lean), **throw-in** arm whip, **goalkeeper dives** (sideways stretch with reach, used on catches and parries), **jumping headers** with head-snap, **stumbles** when dispossessed, and **falls with recovery** when fouled (the victim goes down and picks himself up — and stays down through the referee's whistle).

### Added in v1.3 — emotional two-man broadcast booth (no save wipe)
- **Emotion engine:** every line carries an emotional register mapped to voice prosody — calm, build, tense, excited, euphoric, drama, sad — with per-line random micro-variation so no two calls sound identical.
- **Context-aware goal calls:** multi-burst euphoria for your goals ("GOOOOAL!" → scorer line → scoreline), special lines for equalisers, late winners ("UNBELIEVABLE! A late, late winner…"), braces ("His second of the match!") and **hat-tricks**; deflated, slower delivery when you concede ("Ohh no… ").
- **Color analyst (second voice):** a deeper co-commentator chimes in after big moments — goals for/against, saves, red cards, misses, penalties ("For me, the defending just was not good enough.").
- **Broadcast open:** "Good evening, and welcome to Meridian Park, under the floodlights…" with weather woven in.
- **Situational chatter:** trailing late = urgency; leading late = game management; opening minutes = scene-setting.
- Near-miss calls for shots dragged wide (agonised for yours, relieved for theirs), tense added-time board announcement, result-aware full-time tone.

### Added in v1.2 — voiced play-by-play commentary (no save wipe)
- **The commentator SPEAKS** via the browser's built-in text-to-speech (Web Speech API — synthesized locally, no copyrighted recordings, works offline). Prefers a British English voice when available. Toggle with **N** (persisted).
- **True play-by-play with player names:** passes ("Silva… finds Adeyemi"), shots (range-aware), saves by keeper name, clean tackles & sliding challenges, skill moves, fouls/yellow ("goes into the book")/red ("He's off!"), offside by name, substitutions, kickoff intro naming both clubs, half-time and full-time score read-outs, goals announced with scorer and the new scoreline, plus idle possession chatter every ~15–25 s.
- Priority system: goals interrupt anything, big moments queue-jump, chatter never talks over an ongoing call. Text ticker mirrors every spoken line.

### Added in v1.1 — the beauty pass (no save wipe)
- **Real CC0 grass photo** (ambientCG Grass001, public domain, embedded as data URI in `assets.js`) under the mow stripes and painted lines.
- **Jointed player bodies:** two-segment arms/legs with elbows & knees that bend during the run cycle, pumping arms, torso counter-rotation, pelvis+tapered chest, neck, eyes, collars, 4 hair styles (incl. bald/curly/long), hands, and per-player height/bulk derived from PHY/PAC ratings.
- **Crowd v2:** rows of individual supporters (heads, shirts, seat shadows, scarves) instead of noise.
- **Sky dome:** day (clouds), night (stars), rain (grey) — switches with match weather.
- **Jumbotron:** live score/clock/competition screen above the far stand.
- **Paneled ball**, **woven net texture**, **floodlight towers** that glow at night, **club crest** in the menu, **sponsor ad boards**, corner flags.
- Asset sourcing note: searched for ready-made CC0 rigged players (Quaternius etc.) — they exist but are fantasy-clothed with baked textures (can't show team kits/numbers), so bodies stay purpose-built; photographic textures come from CC0 libraries.

### Added in v1.0 — the full-list push (no save wipe)
- **Weather & day/night:** each match rolls day/night and rain (particle rain; wet pitch = ball skids farther and bounces lower). Night uses floodlight-style lighting. Conditions shown at kickoff.
- **Instant replays:** goals trigger a slow-motion replay of the final ~2 seconds from a low cinematic camera near the goal, then the celebration (knee-slide or arms-aloft run, random).
- **Cameras (V):** Broadcast, Tele High, Pitchside, End-to-End. Choice persists. Replay camera is automatic.
- **Gamepad support:** left stick move, A pass, B shoot (hold = power), X skill, Y through ball, LB switch, RB slide, triggers sprint, Start continue.
- **Training mode:** 🏋 button on the start menu — free practice vs a keeper (no clock, no fouls, ball auto-resets). EXIT button returns to career (page reload; career is saved).
- **Advanced stats:** xG per team, live player match ratings (goals/assists/tackles/saves/passes move them; fouls/cards lower them), and a ⭐ Player of the Match in the full-time panel.
- **Kit selection** (CLUB tab): 6 kit colors for Hardy FC.
- **Create-a-player** (CLUB tab, £20M): name your own 18-year-old wonderkid in any position (potential up to 96).
- **Volleys:** press K near a loose airborne ball to strike it first-time.
- **Graphics pass:** ACES filmic tone mapping + sRGB output, fictional sponsor ad boards (Meridian Air, Volt Cola…), corner flags.

### Added in v0.9 — rules, stats & presentation (no save wipe)
- **Offside:** flagged players (beyond ball + second-last defender at the moment of the pass, in the opposing half) are called when first to the ball → free kick. Any touch by another player resets the flag. Throw-ins/restarts exempt.
- **Advantage rule:** ~30% of fouls where the fouled team keeps the ball → "ADVANTAGE — play on".
- **Injury time:** 1–5 added minutes per half based on stoppages (fouls/goals); clock shows 45+X′/90+X′.
- **Sliding tackle (J):** committed lunge with slide animation — longer reach and higher steal chance than a standing tackle, but a much higher foul risk. Can also hook loose balls clear.
- **Headers:** high balls that strike a player's head are nodded on toward goal (arm-height contact can still be handball; head-height cannot).
- **Match stats:** possession, shots, on target, passes, fouls, corners tracked and shown in a panel at half time and full time (league table stays on T).
- **Minimap radar** (bottom center): live dots for both teams in kit colors, ball, and controlled-player ring.
- **Commentary ticker:** original text lines react to goals, saves, woodwork, fouls, cards, offside, kickoffs (anti-repeat).
- **Goal celebrations:** the scorer wheels away to the corner, arms aloft, with the two nearest teammates chasing him.
- **Difficulty levels** (TACTICS tab): Beginner → Legendary. Higher levels make AI opponents smarter — better passing/finishing/pressing and faster decisions — never physically faster. Default: Professional.

### Added in v0.8
- **Trophy cabinet** (CLUB tab): league titles, Champions Cup, Club World Cup, and World Cup wins are recorded with the season number.
- **Club World Cup:** win your league → after the Champions Cup you play the champions of Azuria, Valdorra and Norland (semi + final, draws → pens, £8M for the title). Simulated with winner announced if you're not champions.
- **World Cup:** every 4th season, after club competitions, you coach the **Meridia national team** (own red kit, generated national squad) through an 8-nation knockout (QF → SF → Final; £8M federation bonus + trophy).
- **Season flow:** league (15 MDs) → Champions Cup (groups + KO) → Club World Cup → World Cup (season 4, 8, …) → awards → new season.
- **🎁 Newbie Pack:** new careers start with **£300M** (one-time welcome message).
- **Set-piece trajectory line:** dotted aim arc for penalties & free kicks (aim with WASD, charge with K — arc updates live).
- **Keeper tuning:** save chances lowered overall; hard-struck shots are much harder to save; more parries/rebounds.
- Save v7 (fresh career).

### Added in v0.7 — real management
- **Positions:** the SQUAD screen shows each starter's exact position (GK/LB/CB/RB/DM/CM/AM/LM/RM/LW/ST/RW derived from the formation). Swapping two starters (⇄ + ⇄) swaps their positions; starter+bench swaps who plays. Lineup is slot-aligned and saved.
- **Substitutions:** open the Team Menu during a match — starter+bench swaps are live substitutions (max 5 per match, counter shown). Position swaps also work live.
- **Hard pause:** the match is completely frozen while the Team Menu is open (previously play could resume behind the menu after a restart).
- **Key 6** starts/continues (next match, cup rounds, season awards). R still works.
- **Champions Cup restructured to real-CL format & timing:** the league's 15 matchdays finish first, then the cup: **32 qualifiers** (top 8 of Div 1 + top 8 of each foreign league; Div 2 excluded) are drawn into **8 groups of 4**, each club plays 3 group matches (draws allowed, 3/1/0 points), the **top 2 per group (16 clubs) advance to the Round of 16**, then knockout (draws → penalties) to the final. The new season starts after the final. The CUP tab shows live group tables; holders shown between seasons.

### Added in v0.6 — Champions Cup, 16-team leagues, growth, academy & scouts
- **16 clubs per league** (Div 1, Div 2, and all three foreign leagues — 80 clubs total). League season = 15 matchdays (each rival once). Relegation/promotion is now 3 up / 3 down.
- **Champions Cup** (replaces the open Meridian Cup): 16 entrants = **top 8 of the Meridian League** (qualification zone shown in teal on the table) + the top 2 from each foreign league + the 2 best third-placers. Foreign clubs are fully playable opponents with their own kits. Rounds after matchdays 3/6/9/12; finals pay £12M. Season 1 qualification is strength-based (Hardy included); after that you must finish top 8.
- **Ages, growth & potential:** every player has an Age and a POT (potential) rating. Each summer, players ≤23 grow sharply toward potential, 24–27 grow slowly, 29+ decline (pace fades first). Values update with ratings. Squad and market tables show Age + POT.
- **Youth academy (CLUB tab):** graduates 2–4 academy players (age 16–18) into your squad every season; upgradeable to level 5 (£5M→£35M) for more and better prospects with high potential.
- **Scouting network (CLUB tab):** stocks the transfer market (6+level players per matchday, better/higher-potential at higher levels; upgradeable £4M→£30M). "Send scouts" button (£1M) refreshes the market instantly.
- Save format v5 (fresh career on first load).

### v0.5 — the football world
- **20 domestic clubs in two divisions:** Meridian League (Div 1, 10 clubs incl. Hardy FC) and Meridian League 2 (Div 2, 10 clubs). 18-matchday season (each rival twice, shuffled).
- **Relegation & promotion:** bottom 2 of Div 1 swap with top 2 of Div 2 every season — Hardy FC can go down (and back up). Table shows colored zones: gold = champions, red = relegation, green = promotion.
- **Meridian Cup:** 16-team knockout (all Div 1 + 6 Div 2 clubs) played during the season — rounds after matchdays 4/8/12/16. Draws in cup ties go to penalties. Cup prize money per round; win the final for £10M. Cup ties show a 🏆 by the clock.
- **Three foreign leagues** (Ligue Azure/Azuria, Liga Dorada/Valdorra, Nordic Premier/Norland — 30 fictional clubs) fully simulated every matchday; browse all tables via tabs in the league panel (T).
- **Form column** (last 5 results as W/D/L dots) in every table.
- **Ratings overhaul:** attribute ranges now produce dramatic on-pitch differences (pace 10 ≈ walking speed vs pace 95 ≈ elite sprinter; keeper save chance 30–95% by rating; wide passing/shooting error ranges; tackle success steeply rating-driven; heavy touches for low control).
- Save format upgraded (old saves start a fresh career).

### Added in v0.4
- **Shot power bar:** hold K to charge (bar shown under stamina), release to shoot — full power is faster but harder to place. Works for penalties too.
- **Skill moves:** Q performs a roulette/burst move past a defender (1.6 s cooldown). Success chance scales with overall rating; Wingers get a bonus; failing it means a heavy touch and a loose ball.
- **⚡ SIM MATCH button:** simulates the rest of the current match with an animated progress bar — result is based on the two squads' average ratings and time remaining, then normal full-time flow (money, league table) applies.
- **Restart bug fixed:** thrown/corner balls no longer get called "out" the instant they're released (the ball legitimately starts on/behind the line, so out-of-play calls are suppressed for 0.8 s after a restart kick). AI corner takers now cross into the box instead of dribbling along the goal line.
- **Scorer credit fixed:** goals are credited to the player who actually last touched the ball (dribbled goals, tackles, and restarts now update the credit). Names are unique within a match.

**To play:** open `index.html` in any web browser (double-click it). No install needed; works offline. Google Chrome recommended (progress saving is confirmed to work there).

Built toward the goals in [../PRD.md](../PRD.md) with Three.js (`three.min.js`, MIT license, bundled locally). All clubs, players, and audio are original/fictional. You manage and play **Hardy FC** in the 8-club **Meridian League**.

## What's implemented (maps to TASKS.md)
- **Phase 1:** 3D pitch, goals with post/crossbar physics, stadium with crowd, 11v11, momentum-based movement, physical ball (never glued to feet), broadcast camera.
- **Phase 2 (partial):** contextual passing, through balls, shooting, dribbling with looser sprint touches, tackling, body blocks, stamina.
- **Phase 3:** formation-holding team AI, pressing (intensity scales with mentality), forwards/mids push up in possession, no ball-chasing swarms.
- **Phase 4 (partial):** goalkeepers (save chance driven by rating), fouls, handballs, yellow/red cards (2nd yellow = red, send-offs), penalties for fouls in the box, free kicks, corners, goal kicks, proper throw-ins (taker off-pitch with space), halves/halftime/full time, match clock, referee character.
- **Phase 5 (partial):** humanoid player models with run-cycle animation; **full ratings system** (PAC/SHO/PAS/DEF/PHY → overall) wired into speed, acceleration, passing error, shot error/power, tackle success, keeper saves, stamina drain; **play styles** (Winger, Playmaker, Poacher, Target Man, Ball-Winner, Wide Runner) that change positioning, decision-making, and pressing.
- **Phase 7 (partial):** clickable Team Menu (M or the ☰ button): SQUAD (all players + ratings + contracts, sell/renew), TACTICS (5 formations: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2 + Defensive/Balanced/Attacking mentality, both apply live mid-match), TRANSFERS (7-player market refreshed each matchday, buy with budget).
- **Phase 8 (partial):** career loop — rotating fixtures (a different opponent each matchday with own colors/squad/formation), 14-matchday seasons, match prize money (win £3M / draw £1.5M / loss £0.5M), season prize by final position, contracts that tick down each season (expired players leave; renew in the squad screen), auto youth players if the squad gets too small, full persistence via localStorage.

## v0.2 bug fixes carried into v0.3
- Goal kicks: keeper sets and clears — never dribbles toward his own goal.
- Throw-ins: taker stands off-pitch, opponents pushed back, pressing suspended briefly.
- "Always the same opponent" — fixed by fixture rotation.
- "Table resets on its own" — the accidental N-reset hotkey was removed; the table only resets at a real season end. A warning now appears if the browser can't save progress.

## Not yet implemented (see ../TASKS.md)
Offside, advantage rule, aimable set-piece mechanics, substitutions, skill moves, replays, commentary, cup competitions, player growth/training, gamepad support.

## Controls
WASD/arrows move · Shift sprint · Space pass / throw-in / tackle · K shoot · L through ball · C switch player · **M team menu (mouse-driven)** · T league table · P pause · H hide help · R continue after full time.

## Debug
Console logs `[Hardy FC] season/matchday/budget/saving` at boot. Open with `#menu` in the URL to auto-open the team menu (used by tests).

## Verified
Headless-browser tested (v0.3): renders correctly; simulated full matches with zero JS errors; menu tabs render; save persists across separate browser launches (same Chrome profile).
