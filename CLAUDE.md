# DataStructuresInJavaScript — Project Mission

## What this is

Devansh's revived 2017 visualization site, reborn as a **free, ever-growing computer-science education resource**. Live at: https://dl1683.github.io/DataStructuresInJavaScript/ (GitHub Pages, this repo). The old successor project (datastructures.dev) is dead — all references to it and "the team" are gone. This repo is the canonical home again.

## Mission

Teach anyone, for free, how computing actually works — by *showing* it. Every topic pairs an animated visualization with a synchronized, plain-English, step-by-step explanation. Education first, eye candy second. People will read the source code as teaching material, so the code itself must be exemplary.

## Content domains (growing over time)

1. **Classic data structures** — linked list, stack, queue, hashtable, BST, heaps, …
2. **Classic algorithms** — sorting (bubble/quick/merge/heap), searching (linear/binary), …
3. **Core concepts** — recursion visualization, Big-O intuition, …
4. **AI / ML** — attention mechanism visualization, core AI algorithms, paper explainers, AI tools. Devansh works in AI research; this domain is a first-class citizen, not an afterthought.

## Product requirements

- **Synchronized step-by-step explanations**: every animation step carries a human-readable explanation rendered alongside it.
- **Education-first pacing (Devansh, 2026-06-11)**: people come here to learn, not to watch boxes fly. The explanation text sits ABOVE the animation so both can be followed at once, and the default playback speed must be slow enough to read every step (1× = 5s/step — there is text AND animation to absorb). Users can speed up to 8×; they cannot slow down past a point, so defaults always err slow. A fast default is a bug.
- **Site-wide search**: client-side, so visitors can find any topic instantly.
- **Visitor world map**: ClustrMaps and its sister Mapmyvisitors are dead (DNS/origin gone, verified 2026-06-11). Dropped for now; bring a map back when Devansh registers with a living service (GoatCounter is the healthiest free option, needs his signup).
- **Zero build step**: modern vanilla JS (ES modules), plain static files, deploys straight to GitHub Pages, never rots.
- **Responsive + accessible**: works on phones; this is for students everywhere.

## Visual direction (Devansh, 2026-06-11)

Visualizations should be **strategically dimensional** (Devansh): simple structures — trees, searches, lists — stay clean 2D because they explain simply; reach for 3D where it genuinely earns its keep — activation functions and loss surfaces, side-by-side algorithm comparisons, embedding spaces. Content and information density are king; dimensionality is a tool, not a style. Current implementation: a 2.5D depth pass (shadows, glow pulses on semantic highlights, gradient stage) in the zero-dependency SVG engine. **Future step**: a true-3D renderer (WebGL/Three.js, vendored as a static file to preserve no-build) behind the *same* step contract, used for topics where 3D genuinely adds insight (trees, graphs, embedding spaces, loss landscapes). Adding that vendored dependency needs an explicit go-ahead from Devansh since it bends the zero-dependency rule.

## Hard decisions (already made — do not relitigate)

- Modern vanilla JS, ES modules, no framework, no build step.
- Clean rewrite: old 2017 code is deleted; git history preserves it.
- One canonical pattern per topic; shared visualization engine; minimal files.
- Commit format: short description + "Committed by Devansh".

## Dev workflow

- ES modules require HTTP locally: `python -m http.server` from repo root.
- Pushing to `master` publishes the live site — get Devansh's confirmation before the first push of the rewrite.

## Governance

Global constitution at `~/.claude/CLAUDE.md` applies: Codex design/PR gates, anti-entropy, experiment discipline. Codex review artifacts live outside this repo.
