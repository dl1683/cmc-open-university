# CMC Open University

**Live site: https://dl1683.github.io/cmc-open-university/**

Free, visual computer-science education. Pick a topic, press play, and watch the
algorithm run — with a synchronized plain-English explanation of what is
happening and *why* at every single step. Change the inputs and run it again.

Topics span classic data structures (linked lists, stacks, queues, hash tables,
BSTs, heaps, tree traversals, graphs with BFS and Dijkstra), classic algorithms
(six sorts, two searches), core concepts (recursion as a live call tree,
memoization, Big-O growth curves), systems design (LRU cache, load balancer,
bloom filter), and modern AI (attention, gradient descent, k-means, BPE
tokenization, softmax & temperature, embeddings). Topics declare what simpler
ideas they are *built from*, so every page links back to its ingredients and
forward to what it unlocks. Below every animation sit **study notes** — what it
is, how it works, real costs, real-world uses, pitfalls, and what to learn
next — so the site works as a course, not just a gallery. Any visualization
can be **exported as a video** (WebM) with the explanations baked in, for
sharing. More is added continuously —
the goal is a free CS resource for anyone who wants to understand how
computing works.

## How it works

Plain static files — no framework, no build step, no dependencies. Every
algorithm is a generator function that yields steps:

```js
yield {
  state: arrayState(values),          // a snapshot the renderer can draw
  highlight: { compare: ['i2', 'i3'] }, // what to emphasize, semantically
  explanation: 'Compare neighbors 9 and 2: out of order — swap them.',
};
```

The shared engine (`src/core/`) plays those steps: SVG rendering, play/pause/
step/speed controls, and the explanation panel. Topic modules contain *only*
algorithm logic and are written to be read as teaching material.

## Learning paths

The site now has a curriculum layer in `src/tracks.js`. Categories are broad
shelves; learning paths are ordered courses with audience, outcome, modules,
capstone, and next-track guidance. Homepage visitors see these paths first,
then a compact domain map, with the full 1,000+ topic library still available
behind search and the "browse all" disclosure.

Topic pages also use the same track data to explain where a topic fits: which
course module it belongs to, what to learn before, what it unlocks, and the
previous/next topic inside the active path.

## Writing system

`WRITING_SYSTEM.md` is required reading before creating or revising a topic.
Step explanations should teach decisions, invariants, and consequences; study
notes should teach the full idea: why it exists, the obvious alternative, the
wall, the core insight, correctness, cost, real uses, tradeoffs, and what to
study next. The prose standard is deliberately plain: no stiff AI phrasing, no
filler setup, no repeated ideas in different clothes. A working animation with
caption-level text is not a finished topic.

## Run it locally

```bash
python -m http.server 8000   # ES modules need HTTP, not file://
# open http://localhost:8000/
```

## Review a change

This is a static teaching site, not a package with a unit-test workflow. Run it
locally, open the changed pages, and check the actual experience: navigation,
animation pacing, responsive layout, explanation quality, and whether the topic
passes `WRITING_SYSTEM.md`.

## Add a topic

1. Create `src/topics/<id>.js` exporting a `topic` descriptor and a `run`
   generator (copy any existing topic as a template).
2. Register it in `src/registry.js` (one entry — title, category, tags).
3. If it belongs in a guided course, add it to the right module in
   `src/tracks.js`.
4. Apply `WRITING_SYSTEM.md`: strengthen step explanations and study notes until
   the page teaches why the idea works, where it is useful, and where it fails.

That's it: the homepage, search, and topic page pick it up automatically.
If adding a topic ever requires more than that, the architecture has drifted.

## History

This site first went up in 2017 as a jQuery-era collection of visualization
pages, was abandoned for a successor project that has since gone offline, and
was revived in 2026 as the canonical home — fully rewritten, same mission.
The original implementation lives on in git history.

Created by [Devansh](https://github.com/dl1683/). Free forever.
