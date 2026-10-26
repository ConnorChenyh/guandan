# Qingzhuo · Guandan

**English** | [简体中文](README.zh-CN.md)

A lightweight single-player web version of Guandan (掼蛋), the four-player Chinese partnership card game. You play with the computer partner opposite you against two computer opponents, at easy, normal or hard difficulty. Plain HTML, CSS and JavaScript: no runtime dependencies, no backend, database, accounts or external APIs.

Built mobile-first: the whole game fits on one phone screen in portrait (two-row hand) or landscape (table and hand side by side), and you can swipe across cards to select them.

<p align="center"><img src="docs/screenshots/mobile.jpg" alt="Game screen on a phone" width="320"></p>

## Run locally

ES modules and Web Workers need an HTTP server (opening `index.html` via `file://` won't work). With Python 3:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8080`. Any static web server works. No `npm install` needed.

## Features

- Two decks (108 cards), 27 cards each; you partner with “Xiaobei” sitting opposite.
- Patterns: single, pair, triple, three-with-pair, straight, three consecutive pairs, two consecutive triples (steel plate), bombs, straight flush, four-joker bomb.
- Level cards, heart level card as a wild, passing the lead to a finished player's partner, rank-based level-ups, passing A, single/double tribute, tribute refusal and return.
- Each seat shows its latest play; a seat that passes shows “不出” (pass). A finished player's last cards disappear once beaten or once the trick ends. Only the current player's avatar is highlighted.
- Tap or swipe to select, hints (tap again for another suggestion), sort, pause, new game, end-of-round results. Keyboard: Enter / H / P / Esc.
- The current game and difficulty are saved in your browser and resume on refresh. No cross-device sync.

The game uses one fixed casual rule set, described in the in-game rules dialog and in [docs/rules.md](docs/rules.md). It does not try to cover every regional variant.

## Computer players

- **Easy**: a simple heuristic that mostly plays at random among legal moves.
- **Normal**: splits the hand into the fewest playable groups and scores each move by how good the remaining hand is plus the value of winning the trick. It takes control with its smallest unbeatable card, cashes control cards only in the final run, saves bombs until they matter, stays out of its partner's way and feeds a partner who is about to go out.
- **Hard**: normal, plus card counting, inferences from opponents' passes, and an endgame search that deals the unseen cards many plausible ways and plays each candidate move out.

No difficulty ever reads another player's hidden hand. The AI runs in a Web Worker and falls back to the normal strategy if the worker fails or times out.

## Deploy

```sh
sh deploy/package.sh
```

This builds `dist/` and `release/guandan-web.zip`. Upload only the contents of `dist/` to your web root, or unzip the archive there. The server needs no Node, Python, database or build step. All paths are relative, so a subdirectory such as `https://example.com/guandan/` works too (keep the trailing `/`). See [docs/deployment.md](docs/deployment.md) for Nginx and Docker examples.

## Development

Tests need Node.js 18+ and no npm packages:

```sh
npm test
```

They cover card patterns, wild-card limits, bomb order, passing the lead, passing A, tribute, full-match simulations at every difficulty, card conservation, save/restore, and AI scenarios.

AI self-play benchmark (each deal is played twice with seats swapped):

```sh
node tests/bench.mjs 200 hard normal
```

## Project layout

- `index.html`, `styles.css`: table and responsive UI.
- `js/rules.js`: pattern recognition, legal move generation and comparison (pure functions).
- `js/game.js`: dealing, turns, tribute, finishing order and level-up state machine.
- `js/app.js`: interaction, saving and scheduling computer moves.
- `js/ai.js`, `js/ai-worker.js`: AI entry point and Web Worker.
- `js/ai/`: hand decomposition (`decompose`), card tracking (`tracker`), move strategy (`strategy`), endgame search (`search`) and the easy-mode heuristic (`basic`).
- `tests/`: Node tests, the self-play benchmark and local preview pages (not included in the deploy package).
- `deploy/`: packaging script, Nginx and Docker examples.
