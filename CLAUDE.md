# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Clan Saga is a Japanese tactical RPG (ぽちぽち戦略RPG) implemented as a **single self-contained `index.html` file** (~19,000 lines). There is no build system, no package manager, and no separate JS/CSS files — all HTML, CSS, and JavaScript live in `index.html`. The game runs in-browser and requires only a static file server.

## Running Locally

```bash
# Any static server works — Firebase auth requires a proper origin (not file://)
python3 -m http.server 8080
# then open http://localhost:8080
```

## Updating Card Data

`replace_cards.js` is a Node.js utility that bulk-replaces the `CARDS` block in `index.html`:

```bash
# Place new card definitions in new_cards_fragment.txt, then:
node replace_cards.js
```

It looks for the markers `\nconst CARDS = {` and `\n};\n\n// カードLv計算` to locate the block. It also runs a quick syntax check on the resulting script after replacement.

## Architecture

### File Layout

```
index.html          — the entire application (~19 000 lines)
assets/
  images/           — PNG icons for classes, roles, card types, items
  audio/bgm_main.mp3
replace_cards.js    — standalone Node script to swap CARDS data
```

### JavaScript Structure (inside `<script>` blocks in index.html)

The file is divided into clearly-marked sections separated by `// ====` comment banners. Key sections in order:

| Lines | Section |
|-------|---------|
| 1–70 | Firebase initialization & auth state listener |
| 78–3043 | CSS (`<style>` block) |
| 3044–3361 | Audio System (Web Audio API — procedural BGM/SFX) |
| 3362–4131 | Icon constants, `CLASS_DATA` master table |
| 4132–4246 | Species / attack-type system |
| 4247–5283 | `CARDS` master data (skill cards by class & rarity ★1–★3) |
| 5284–6564 | `PASSIVE_POOL`, `BABEL_AREAS`, `SHRINE_STAGES` stage data |
| 6565–6810 | Gacha pools, `defaultState()`, `makeUnit()`, `saveState()`, `loadState()` |
| 6811–7343 | Game init, hamburger menu, `startGame()`, `resetAndStart()` |
| 7344–7619 | Achievement system |
| 7620–8318 | News / notice system |
| 8319–9028 | Home tab render, beginner mission panel |
| 9029–9242 | Chara tab render & character upgrade UI |
| 9243–9791 | Formation tab, Imagine (guardian spirit) system & UI |
| 9792–10264 | Sortie tab, Shield system, CC system, Cover system |
| 10265–10928 | Battle system core: `makeCombatant()`, `initBattle()`, `tickBattle()` |
| 10929–11500 | Battle AI, `combatantAct()`, TACTICS-based skill selection |
| 11501–11937 | Battle effects, heal/damage application |
| 11938–12629 | Damage formula (`computeDmg()`) — 7-step multiplicative model |
| 12630–13168 | Recruit (tavern), Gacha (char, artifact, card) |
| 13169–14067 | Card gacha, char unlock, beginner missions, tutorial system |
| 14068–14462 | Help modal, card slot UI |
| 14463–15379 | Mine modal, Tactics system, Missions system |
| 15380–15644 | Base tab |
| 15645–end | VIP system, Artifact system, Accessory system, Auth UI, Boot sequence |

### Global State (`gState`)

`gState` is the single source of truth for all player data. Key sub-objects:

```
gState.player          — currencies (gold, starCrystal, ether…), stamina, VIP level
gState.ownedUnits[]    — unit objects with classId, passives, equippedCards, tactics
gState.unitProgress    — {[uid]: {level, exp}}  — stored separately from unit defs
gState.presets[0..14]  — 15 formation presets, each with formation.slots[], tactics, imagineId
gState.activePreset    — which preset is active in battle
gState.ownedCards[]    — collected skill cards
gState.artifacts[]     — owned artifact instances
gState.progress        — babel/shrine cleared stages, colosseum rank
gState.missions        — daily/weekly counters and claim state
gState.achievements    — unlocked/claimed flags
gState.gacha           — pity counters for each gacha type
```

### Persistence

- `localStorage` key `cs_state` — synchronous, written on every `saveState()` call
- Firestore collection `saves/{uid}` — asynchronous cloud backup via `cloudSaveState()` / `cloudLoadState()`
- Legacy key `cob_state` is automatically migrated to `cs_state` on first load
- `normalizeState()` is called after every load to fill in missing fields added in later versions

### Battle Engine

The battle is an **ATB (Active Time Battle)** loop driven by `setInterval(tickBattle, 50/battleSpeed)`.

- Each tick adds `spd * 0.02` to each combatant's `atb` gauge
- When `atb >= 100` the combatant acts via `combatantAct()`
- Buff/debuff durations tick every 150 game-ticks (~3 seconds real time at 1×)
- Day phase: 60 seconds elapsed → prompt night phase choice
- Night phase: additional 60-second timer → forced retreat on expiry
- `makeCombatant(unit, isEnemy, …)` converts a `gState` unit + `CLASS_DATA` entry into a live battle object with stats computed by `calcStats()`

### Damage Formula (`computeDmg`)

7-step multiplicative model:
1. Base ATK
2. ATK buffs (percentage)
3. Passive bonus stacks
4. Skill power multiplier (`skill.power`)
5. Critical hit (crit rate → crit damage multiplier)
6. Physical/magic defense reduction (`pdef`/`mdef`, capped at 99%)
7. Species/attack-type advantage bonus

### Tab Navigation

`switchTab(tab)` shows the matching `#tab-{tab}` panel and calls the corresponding `render*Tab()` function. Available tabs: `home`, `sortie`, `chara`, `formation`, `cards`, `artifact`, `acc`, `base`.

### Firebase / Auth

- Firebase compat SDK (v10) loaded from CDN — no modular imports
- All Firebase calls go through the wrapper object `window._fbFns` to keep the calling code agnostic of the compat API shape
- Auth state changes fire `window._onFirebaseSignIn` / `window._onFirebaseSignOut` callbacks defined in the Boot section
- Cloud save is best-effort: failures are logged but do not block gameplay

## Key Conventions

- **Japanese comments**: inline comments and section headers are in Japanese; match this style when adding new sections
- **Section headers**: use the `// ====…====` / `//  SECTION NAME` two-line banner pattern to delimit major sections
- **No modules**: everything is in global scope; name new functions/constants clearly to avoid collisions
- **`saveState()` after mutations**: call `saveState()` after any change to `gState` that should persist
- **`normalizeState()` for new fields**: when adding a new field to `gState`, add a default assignment in `normalizeState()` so existing saves are upgraded gracefully
- **Render functions are idempotent**: each `render*Tab()` rebuilds its panel from scratch using `innerHTML`; avoid accumulating state in the DOM
