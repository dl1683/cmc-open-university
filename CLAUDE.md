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
- **Site-wide search**: client-side, so visitors can find any topic instantly.
- **ClustrMaps visitor map** on the homepage (the pinned world map — it brings joy).
- **Zero build step**: modern vanilla JS (ES modules), plain static files, deploys straight to GitHub Pages, never rots.
- **Responsive + accessible**: works on phones; this is for students everywhere.

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
