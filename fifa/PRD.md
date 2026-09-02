# Product Requirements Document (PRD)
## Project "FIFA" — Original AAA-Style Football Simulation

> **Read this first.** This document defines WHAT we are building and the quality bar.
> See [TASKS.md](TASKS.md) for the build order and [TESTING.md](TESTING.md) for how we verify quality.

---

## 1. Vision

Build a **high-quality, realistic 3D football/soccer video game** inspired by the gameplay depth, responsiveness, and broadcast-style polish of modern AAA football games (e.g., EA Sports FC 25) — while using **100% original branding, fictional clubs and players, original UI, original stadiums, and original audio**.

The result must feel like a **polished commercial football simulation**, not an arcade prototype.

### The single highest priority
The game must **play extremely well**. Visual similarity to existing games is NOT the goal — the goal is the same *level* of polish, realism, and fun, achieved with original systems and assets.

### Quality standard (in priority order)
1. Responsiveness
2. Realistic ball physics
3. Intelligent AI
4. Smooth animations
5. Player individuality
6. Tactical depth
7. Realistic football positioning
8. Broadcast-quality presentation
9. Stable 60 FPS
10. Fun gameplay

---

## 2. Hard Constraints (non-negotiable)

### Legal / originality — DO NOT copy or use:
- EA code, FC 25 UI graphics, or any proprietary game assets
- Real player likenesses, names, or licensed club logos/kits
- Licensed stadium assets, commentary recordings, music, or animations

All clubs, players, leagues, kits, stadiums, audio, and UI must be **original or fictional**.

### Technical
- **Target: 1080p / 60 FPS minimum** during gameplay
- Scale gracefully across low-end, mid-range, and high-end PCs
- Prioritize gameplay responsiveness over visual effects
- Movement must have believable inertia — no players "sliding" or instantly turning 180° at sprint speed
- The ball must be a true physics object — never magnetically stuck to a player's feet

---

## 3. Core Experience

A full **11-vs-11 real-time football match simulation** with:

- Real-time control of one player, with player switching
- AI teammates and AI opponents that behave like an organized team (never all chasing the ball)
- Full action set: passing, through balls, crossing, shooting, headers, volleys, tackling, sliding tackles, interceptions, goalkeeping, sprinting, shielding, dribbling, skill moves
- Full rules: fouls, yellow/red cards, corners, throw-ins, goal kicks, free kicks, penalties, offside, advantage rule, injury time
- Match clock, scoreboard, substitutions

---

## 4. Match Flow

| Stage | Contents |
|---|---|
| **Pre-match** | Team, home/away, formation, lineup + bench, ratings, kits, stadium preview, difficulty, duration, weather, day/night |
| **Intro cinematic** | Stadium exterior, tunnel walk-out, lineups, formation graphics, kickoff transition |
| **Match** | Fully playable, both halves |
| **Halftime** | Score, possession, shots (on target), passes/accuracy, tackles, fouls, corners, xG, ratings, heatmaps; tactical changes + subs allowed |
| **Full time** | Final score, highlights, Player of the Match, full stats and ratings |

---

## 5. Gameplay Systems (summary of requirements)

### Movement & locomotion
Walk / jog / run / sprint / explosive acceleration / deceleration, turning, side-stepping, backpedaling, jockeying, shoulder-to-shoulder, jumping, stumbling, falling, recovery. Speed governed by acceleration, sprint speed, agility, balance, strength, fatigue, momentum, and direction. **Realistic inertia is mandatory.**

### Ball physics
Simulate gravity, spin, friction, air resistance, bounce, rolling resistance, and collisions (players, posts, crossbar, net). Behavior varies by pass/shot strength, contact point, player skill, spin, surface, and weather. Support ground/driven/lofted passes, through balls (ground + lobbed), crosses (standard/driven/curled), chips, finesse shots, power shots, headers, volleys, half-volleys, deflections.

### Dribbling & skill moves
Close control, sprint dribbling, slow dribbling, first touch, shielding, knock-ons, precision dribbling. Better players = faster, tighter touches; weaker players take heavier touches. Skill moves (stepovers, body feints, ball roll, roulette, drag back, fake shot, elastico, la croqueta, rainbow flick, etc.) gated by skill rating.

### Passing & shooting
Contextual passing (short, driven, through, lobbed through, lofted, cross, cutback, backheel, header pass) with accuracy driven by attributes, body orientation, pressure, distance, and momentum. Shooting (normal, finesse, power, chip, header, volley, bicycle, first-time, low driven) with outcomes driven by finishing, power, composure, weak foot, position, pressure, and angle.

### Goalkeeping
Sophisticated AI: positioning, dynamic (not canned) diving/saving, catching vs. parrying, 1-on-1s, cross claiming/punching, sweeper-keeper behavior, distribution. Keepers make realistic attribute-based mistakes.

### Defending
Standing/sliding tackles, shoulder challenges, jockey + sprint jockey, interceptions, shot blocking, pressing, second-man press. Defenders maintain shape, track runners, cover space, protect lanes, and adapt depth to attacker speed.

### Referee & rules
Fouls, advantage, cards, offside, handball (toggleable), penalties, free kicks. Decisions weigh contact severity, tackle timing, position, and denial of goal-scoring opportunity.

### Set pieces
Playable corners, free kicks (aim/power/curve/topspin/knuckleball), penalties, throw-ins, goal kicks.

---

## 6. Players, AI & Tactics

### Attributes (every player)
- **Pace:** acceleration, sprint speed
- **Shooting:** finishing, shot power, long shots, volleys, penalties
- **Passing:** vision, crossing, short passing, long passing, curve
- **Dribbling:** agility, balance, reactions, ball control, dribbling, composure
- **Defending:** interceptions, heading, defensive awareness, standing tackle, sliding tackle
- **Physical:** jumping, stamina, strength, aggression
- **Goalkeeping:** diving, handling, kicking, reflexes, positioning

Ratings must **visibly** influence gameplay.

### Player personality archetypes
Fast winger (explosive, wide, aggressive runs), playmaker (drops deep, creative passes), target striker (hold-up play, attacks crosses), defensive midfielder (screens defense, intercepts).

### Team tactics
Formations: 4-4-2, 4-3-3, 4-2-3-1, 4-1-2-1-2, 3-5-2, 3-4-3, 5-3-2. Sliders/settings for depth, width, pressing, build-up speed, players in box, fullback behavior, striker runs. Presets from Ultra Defensive to Ultra Attacking.

### Team AI
Attackers make overlapping/diagonal/counterattacking runs and stay onside; midfielders keep passing triangles, switch play, control tempo; defenders hold shape, track runners, close lanes. **The AI must never simply chase the ball.**

### Difficulty
Beginner → Amateur → Semi-Pro → Professional → World Class → Legendary. Higher difficulty improves *decision-making* (tactics, passing, positioning, finishing) — it must NOT just make opponents unrealistically faster.

---

## 7. Presentation

- **Cameras:** Broadcast (default), Dynamic, Co-op, End-to-end, Player (3rd person), Replay (cinematic)
- **Replays:** auto-generated for goals, near misses, great saves, fouls, skill moves — slow motion + cinematic angles
- **Graphics:** detailed grass with mow patterns and deformation, realistic lighting/shadows, cloth/jersey/hair physics, weather (rain, wet pitch, mud), net physics
- **Stadium:** 40,000–70,000 animated spectators, team colors, flags, screens, ad boards, benches, staff, tunnel; crowd reacts dynamically (goals, misses, red cards, late winners)
- **Audio:** spatial stadium audio — chants, roars, whistles, ball impacts, tackles; volume reacts to events
- **Commentary:** dynamic, non-repetitive, reacting to goals/shots/saves/fouls/cards/subs/performance; original or placeholder voices only
- **Celebrations:** knee slide, arms raised, team huddle, corner-flag, custom selection; teammates join dynamically

---

## 8. Modes & UI

### Main menu
PLAY · CAREER · TOURNAMENT · ONLINE · TRAINING · CUSTOMIZE · SETTINGS — premium sports-broadcast styling, sleek animation.

### In-match HUD
Score/teams/clock (top corner), controlled player name/stamina/rating (bottom corner), minimap, player indicators, card and substitution notifications.

### Modes
- **Manager Career:** club selection, transfers (buy/sell/loan), scouting, youth academy, training, contracts, development, injuries, morale, chemistry, budgets, board objectives; season = league + domestic cup + continental tournament. Fictional leagues/clubs.
- **Player Career:** create-a-player (name, number, nationality, position, body, appearance), progress via training/matches/objectives/transfers, skill points, national team.
- **Tournament:** knockout, group+knockout, custom competitions with team selection.
- **Training:** drills (passing, shooting, dribbling, defending, set pieces, goalkeeping) + free-practice arena.
- **Local multiplayer:** PvAI, PvP, multiple controllers.

### Controls (remappable)
Left stick = movement · Right stick = skill moves · A/X = short pass · B/Circle = shoot · X/Square = cross · Y/Triangle = through ball · RT/R2 = sprint · LT/L2 = shield/jockey · RB/R1 = press/finesse · LB/L1 = run modifier.

---

## 9. Performance Requirements

- 1080p / 60 FPS minimum; graphics presets for low/mid/high-end PCs
- Use LOD systems, occlusion culling, GPU instancing, crowd optimization, texture streaming, animation optimization

---

## 10. Out of Scope (for now)

- Online multiplayer implementation (menu entry may exist as placeholder)
- Licensed content of any kind
- Mobile/console ports

---

## 11. Success Criteria

The game ships when:
1. A full 11v11 match can be played start to finish with all rules enforced
2. Movement, ball physics, and shooting feel responsive and skill-based (per [TESTING.md](TESTING.md))
3. AI teams demonstrably hold formation and make intelligent runs
4. 60 FPS is stable on mid-range hardware at 1080p
5. All content is verifiably original
