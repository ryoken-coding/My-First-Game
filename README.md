# Ley & Lantern

An original, playable 2D isometric RPG prototype about magic, survival, exploration and learning real-world skills through problem-solving. Written in TypeScript, drawn on HTML5 Canvas, styled with CSS. No game engine. Ships as a static site that runs in any modern desktop browser with nothing to install.

- **Playable now:** the built site is in `docs/` and runs straight from GitHub Pages.
- **Eight languages:** English, Português, Español, Français, Deutsch, 日本語, 한국어, 简体中文.
- **Accessible:** keyboard-driven menus, text size, reduced motion, high contrast, mute and volume.

---

## Contents

1. [Quick start](#quick-start)
2. [Scripts](#scripts)
3. [Publishing to GitHub Pages](#publishing-to-github-pages)
4. [Controls](#controls)
5. [What is in the game](#what-is-in-the-game)
6. [Project layout](#project-layout)
7. [Adding a language](#adding-a-language)
8. [Assumptions and limits](#assumptions-and-limits)
9. [Safety and real-world content](#safety-and-real-world-content)

---

## Quick start

### Requirements

- **Node.js 18 or newer** (includes `npm`). Check with `node -v`.
- A modern desktop browser (current Chrome, Edge, Firefox or Safari).

### Setup

```bash
git clone https://github.com/ryoken-coding/My-First-Game.git
cd My-First-Game
git checkout arena/fef420be-my-first-game   # or main, once merged
npm install
```

`npm install` fetches two development dependencies only: `esbuild` (bundler) and `typescript` (type checker). The game itself has no runtime dependencies.

### Run locally

The easiest route is one command. It builds the game, then starts a static server:

```bash
npm start
```

Then open **http://localhost:8080** in your browser.

To change the port, set `PORT`:

```bash
PORT=3000 npm start        # macOS / Linux
set PORT=3000 && npm start # Windows cmd
```

If you are editing code, use watch mode in one terminal and the server in another:

```bash
npm run dev                # rebuilds docs/ on every change
npm run serve              # serves docs/ at http://localhost:8080
```

Refresh the browser after each rebuild.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Installs `esbuild` and `typescript`. |
| `npm run build` | Production build (does not type-check; run `npm run typecheck` for that). Bundles `src/main.ts` into `docs/assets/game.js` (minified), copies `web/index.html` and `web/style.css` into `docs/`, and writes `docs/.nojekyll`. |
| `npm run dev` | Same build with watch mode and inline source maps. |
| `npm run serve` | Static server for `docs/` on `0.0.0.0`, port from `PORT` (default 8080). |
| `npm start` | `build` followed by `serve`. |
| `npm run typecheck` | Runs `tsc --noEmit` with strict settings. The locale dictionaries are checked here: a missing or extra key in any language is a compile error. |

Always run `npm run build` before committing changes to `src/`, `web/` or `scripts/`. The published site lives in `docs/`, so that folder must be regenerated and committed.

---

## Publishing to GitHub Pages

The site is plain static files in `docs/`. GitHub Pages can serve that folder directly.

1. **Build and commit the output.**

   ```bash
   npm install
   npm run build
   git add docs
   git commit -m "Publish build"
   ```

   `docs/.nojekyll` is included so GitHub does not run Jekyll over the files.

2. **Push** your branch (or merge it into `main`).

   ```bash
   git push origin <your-branch>
   ```

3. **Enable Pages in the repository settings.**
   - Open the repository on GitHub, then **Settings → Pages**.
   - Under **Build and deployment → Source**, choose **Deploy from a branch**.
   - Pick the branch that holds the `docs/` folder (usually `main`), and set the folder to **`/docs`**.
   - Click **Save**.

4. **Open the site.** After a minute or two it is available at:

   `https://<your-user>.github.io/<repository-name>/`

   For this repository that is `https://ryoken-coding.github.io/My-First-Game/`.

### Subdirectory-safe paths

Every asset reference is relative (`./assets/game.js`, `./assets/style.css`), so the game works whether it is served from the domain root or from a repository subfolder such as `/My-First-Game/`. Do not add root-absolute paths such as `/assets/...` to `web/index.html`.

### Re-publishing

After any change: `npm run build`, commit `docs/` together with your source changes, and push. GitHub Pages redeploys automatically.

---

## Controls

Keyboard only. The on-screen hint bar and the in-game **Controls** entry in the pause menu show the same bindings.

### Playing

| Action | Keys |
| --- | --- |
| Move | **W A S D** or **arrow keys** (diagonals allowed) |
| Talk / interact / advance dialogue | **E** or **Enter** (dialogue: **Space** also advances, **Escape** skips to the end) |
| Strike | **J** or **Z** |
| Dodge (brief invulnerability, uses stamina) | **Space** or **X** |
| Cast ability in slot 1–4 | **1**, **2**, **3**, **4** |
| Combat tip | **H** |
| Character sheet | **Tab** or **C** |
| Skills | **K** |
| Inventory | **I** |
| Quests | **Q** |
| Journal (concepts, hints, procedures) | **N** |
| Pause and settings | **Escape** |

### Menus and challenges

| Action | Keys |
| --- | --- |
| Move between items | **Arrow keys** or **Tab / Shift+Tab** (menus) |
| Switch tab | **Left / Right arrow**, **Tab**, or the tab letter above |
| Choose / confirm | **Enter** or **Space** |
| Choose a numbered option in a challenge | **1–9** |
| Hint (challenges) | Click the **Hint** button in the challenge panel |
| Close a panel | **Escape** (challenge progress is kept) |

Hints and explanations never reset quest or challenge progress. Using a hint only removes the no-hint bonus for that stage.

### Display and sound

Settings (from the pause menu) include language, text size, map zoom, show hints, high-contrast interface, reduced motion (disables screen shake, flashes and smooth camera drift), mute and volume. All of these are saved in the browser.

---

## What is in the game

**Premise.** You arrive in Thornmere, a valley where Ley-currents hum through rivers, stone and machines. You can use magic, but the valley's problems are solved by observation, planning and testing.

**Starting area and first objective.** The village opens with a clear goal: the square pump has stopped, and the elder Maren asks you to find out why. Oskar in the Millrace Works is the mechanic who helps you fix it.

**Magic and affinities.** Six affinities (Anti-magic, Enhancement, Emission, Transmutation, Manipulation, Conjuration) are rolled at character creation into whole percentages that always sum to exactly 100. You can also re-roll, or use the optional Atelier Pass to set them by hand. Abilities, combinations and potency all come from these numbers, and each affinity has its own mastery track.

**Builds and balance.**
- A purely physical build can raise raw Strength to 100, the highest raw value possible.
- Magic never raises the raw cap. Strength is the base stat, and magic acts on top of it.
- **Enhancement** magic (Iron Stance) raises effective strength by up to 40% while active, scaled by your Enhancement percentage. An Enhancement-focused character can out-hit a pure physical one while the ability runs.
- Every build has trade-offs. Heavy magic drains Mana, physical builds need practice and gear, and Enhancement only helps while active.

**Combat.** Real-time action with melee strikes, a dodge, four ability slots, a defensive ward, projectiles, pushes and pulls, and summoned familiars. Enemies (crystal slimes, moss-back boars, scrap sentries, Ley wisps, thorn crawlers) each have a simple weakness or pattern to read. Combinations such as Ignition Lance and Gale Shot appear when two affinities are high enough.

**Practical challenges.** Nine hands-on challenges built from stage types: quiz, sequence, tune (sliders plus a simulation), debug, diagnose, and a single-choice variant. Topics: pump repair, lantern debugging, meal and food safety, bridge construction and logistics, chip manufacturing (abstracted), irrigation, training and recovery, first aid (abstracted, not medical advice), and laboratory safety.

**Progression.** Abilities unlock through mastery, practical skills (electronics, mechanics, programming, chemistry, cooking, training, agriculture, medicine, construction, logistics) level up through challenges, and attributes (strength, vitality, agility, mind) are spent from level-up points.

**Journal.** Every concept is tagged as **real-world principle**, **simplified model** or **fictional rule**, so you always know what kind of claim you are reading. The journal keeps observations, hints you have used, and the procedures you have completed.

**Quests and zones.** Village, Millrace Works, river fields, the Gorge (where a broken bridge must be repaired through a challenge), the Wilds, the Lantern Ruins, and the training yard. The Ruins end with a guardian boss that must be unravelled before it can be beaten.

**Saves.** Progress is written to your browser's local storage at key moments, such as quest steps, challenge completion and leaving the world. Choosing **Save and return to title** from the pause menu saves explicitly. Use **Continue** on the title screen to resume, and erase the save from the settings menu.

**Atelier Pass (optional, mock).** The pass unlocks manual affinity allocation. It is an in-game unlock, found as an item in the world, or simulated from the character creation screen with a clearly labelled "mock purchase" that charges nothing. **The game is complete without it.** No payments, accounts or network calls are involved.

---

## Project layout

```
My-First-Game/
├── web/                    Static HTML and CSS (copied into docs/ on build)
│   ├── index.html
│   └── style.css
├── src/
│   ├── main.ts             Entry point: canvas loop, input routing, UI boot
│   ├── core/               Utilities, RNG and affinity rolls, settings, procedural audio
│   ├── data/               Affinities, abilities, challenges, NPCs, objects, quests
│   ├── game/               Game state, combat, save data types
│   ├── world/              Map generation, isometric helpers, world renderer
│   ├── art/                Canvas pixel painter, sprites, tiles (all drawn in code)
│   ├── ui/                 DOM overlays: HUD, dialogue, menus, challenges, diagrams, screens
│   └── i18n/               Locale dictionaries and the translation helper
│       ├── en.ts           Reference dictionary; other locales are typed against it
│       ├── pt.ts  es.ts  fr.ts  de.ts  ja.ts  ko.ts  zh.ts
│       └── index.ts        Locale list, setLang(), t(), L()
├── scripts/
│   ├── build.mjs           esbuild bundle + copy web/ to docs/
│   └── serve.mjs           Static server for docs/
├── docs/                   Published site (generated, committed)
├── tsconfig.json
└── package.json
```

The game is a single bundled file (`docs/assets/game.js`), plus `docs/assets/style.css`. There are no image or audio files. Pixel art is painted at load time on canvases, and sound effects are synthesized with the Web Audio API.

---

## Adding a language

1. Copy `src/i18n/en.ts` to `src/i18n/<code>.ts`. Import the type from `./en` and export a `Dict` object.
2. Translate every string. The compiler will flag each missing or extra key, so `npm run typecheck` is the checklist.
3. Register the locale in `src/i18n/index.ts`: add it to `LangCode`, `LANGUAGES` and `dicts`.
4. Run `npm run build`. The new language appears in the in-game language selector.

Keep placeholders such as `{n}`, `{item}` and `{concept}` intact, and keep the `real` / `simplified` / `fiction` tags as they are, since they drive the journal filters.

---

## Assumptions and limits

- **Target browsers:** current desktop Chrome, Edge, Firefox and Safari. Mobile and touch input are not implemented.
- **Storage:** saves and settings use `localStorage`. Clearing site data erases them. If storage is unavailable, the game still runs but progress cannot be kept (a notice is shown).
- **Audio:** sound starts only after the first user interaction, which browsers require. Use the mute toggle in settings to silence it.
- **Motion and flashing:** the default effects are gentle. Reduced motion removes camera drift and screen shake.
- **Simplified models:** the bridge loads, pump pressure, chip stages, irrigation moisture, training fatigue and similar systems are game models. Numbers are rounded for play and are not engineering data.
- **Fiction:** Ley, Atelier Passes, Ley-cells, the Guardian and conjured tools are invented. They are labelled as fiction in the journal.
- **No real payments:** the Atelier Pass is a labelled mock. It does not contact any service.
- **Testing:** the project type-checks and builds cleanly. During development, gameplay flows, menus, challenges, save/reload, and all eight locales were exercised with headless DOM tests (jsdom). Sprites were checked from rendered pixel output. No live browser session was run, so expect minor layout tuning after you play it on your own screen.
- **Not included:** multiplayer, cloud saves, achievements, gamepads, and mobile controls.

---

## Safety and real-world content

The game teaches real problem-solving, so some scenes touch real subjects. The project follows these rules:

- Real procedures are described only at the level of **principles**. Dangerous procedures are not described at all: no weapons, explosives, poisons, hazardous devices or drug synthesis.
- The chemistry lab uses fictional reagents and concentrates on safety habits: labelling, small quantities, protective equipment, observation and disposal.
- Food safety covers cooling, reheating and dry storage. It does not replace local food-safety guidance.
- First aid is an abstracted lesson. It is **not medical advice**. Real first aid requires a certified course with hands-on practice, and emergency numbers should be used in a real emergency.
- The chip-manufacturing challenge is an abstraction. Real semiconductor fabrication happens in specialised, controlled facilities and should not be attempted at home.
- Every concept in the journal carries a tag, so you can always tell a real-world principle from a simplified game model or a fictional rule.

---

## License

No license file is included yet. Add one before accepting outside contributions or reuse.
