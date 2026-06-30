# CMC Open University Writing System

This repository is not a visualization gallery. It is a free computer-science
course built out of individual, linkable topic pages. Every topic should leave
the reader able to use the idea, not merely recognize the animation.

The animation is evidence. The prose is the teaching.

## The Standard

A topic is complete when a motivated outsider can answer these questions
without leaving the page:

1. What problem made this idea necessary?
2. What would a reasonable person try first?
3. Why does that obvious approach fail?
4. What is the core insight, invariant, or data layout that makes this work?
5. Why is the algorithm correct?
6. What does it cost as input size changes?
7. Where is it useful in real systems?
8. Where is it the wrong tool?
9. What should the reader study next?

If the page only says what the animation is doing, it has failed. "Compare the
middle element with the target" is a caption. "The comparison discards half the
array because sorted order makes every value on one side impossible" is
education.

## Two Kinds of Text

Every topic has two teaching surfaces. They have different jobs.

### Step Explanations

Step explanations are synchronized with the animation. They should stay short,
but they must not be empty captions.

Each step should do at least one of these jobs:

- Name the decision being made.
- State the invariant being preserved.
- Explain why some work can be skipped.
- Show what just became impossible.
- Connect the visual movement to cost.
- Surface a failure mode or boundary condition.

Bad:

> Move left to index 3.

Good:

> The target is smaller than 12, so every value to the right is now impossible.
> Sorted order lets one comparison delete half the search space.

Bad:

> Swap 7 and 3.

Good:

> 7 and 3 are inverted. Swapping them fixes this adjacent pair without changing
> the order of anything outside the pair.

Bad:

> Visit neighbor B.

Good:

> B is the next unvisited neighbor, so BFS puts it at distance 2. The queue
> preserves the rule that all distance-1 nodes finish before any distance-2
> node expands.

Step text should be readable at playback speed. One or two sentences is usually
enough. If the idea needs a paragraph, put the paragraph in the study notes and
let the step text point at the invariant.

### Study Notes

Study notes are not appendix text. They are the article. They turn the animation
into transferable understanding.

The default study-note shape is:

1. **Why This Exists**
   Name the practical problem and attach a concrete constraint. What gets slow,
   expensive, fragile, impossible, or hard to reason about?

2. **The Obvious Approach**
   Explain what a reasonable learner or engineer would try first, and why that
   attempt is not stupid. The old approach should feel earned, not mocked.

3. **The Wall**
   Name the exact reason the obvious approach breaks. Not "it does not scale."
   Say what grows, what is lost, what invariant is missing, or what case forces
   the failure.

4. **The Core Insight**
   State the one idea that changes the problem. For an algorithm, this is often
   an invariant. For a data structure, it is often a layout. For a system, it is
   often a boundary or contract.

5. **How It Works**
   Walk the mechanism step by step, matching the animation but not repeating it.
   The reader should understand the causal chain: because this is true, the
   algorithm can do that.

6. **Why It Works**
   Give the proof sketch or correctness argument in plain language. Name the
   invariant, monotonic property, exchange argument, optimal-substructure rule,
   ordering guarantee, or conservation law that makes the result trustworthy.

7. **Cost and Behavior**
   Explain cost as behavior, not just notation. Do not stop at O(log n). Say what
   happens when n doubles, which operation dominates, and what memory is being
   stored.

8. **Where It Wins**
   Give real uses and the access pattern that makes the idea appropriate. This
   should not be a vague list. Explain why the fit is real.

9. **Where It Fails**
   Name the tax. Every technique has one: memory, implementation complexity,
   bad worst case, update cost, false positives, cache behavior, concurrency
   hazards, adversarial inputs, or misleading benchmarks.

10. **Study Next**
    Give the next topics by role: prerequisite gaps, natural extensions,
    production versions, and contrasting alternatives.

Not every section needs the same length. None of the jobs can be absent.

## The DSJS Five-Beat Arc

Use this arc inside every major concept section.

### Beat 1: The Problem With a Constraint

Start from a concrete pain.

Weak:

> Linear search is inefficient for large arrays.

Strong:

> Linear search checks one item at a time. With 1,000,000 sorted records, the
> worst case is still 1,000,000 comparisons even though the order is sitting
> there unused.

### Beat 2: The Reasonable First Attempt

Explain the obvious path.

For binary search, the reasonable first attempt is scanning. For Dijkstra, it is
BFS. For a Bloom filter, it is a hash set. For a B-tree, it is a binary search
tree. Show why that attempt works for a while.

### Beat 3: The Wall

Name the precise failure.

Scanning fails because it throws away sorted order. BFS fails on weighted graphs
because one edge no longer means one unit of distance. A plain hash set can be
too large when the only question is "definitely absent or maybe present."

### Beat 4: The Insight

Make the core move explicit.

Binary search:

> Sorted order turns one comparison into a proof about half the array.

Dijkstra:

> The smallest tentative distance is safe to finalize because every remaining
> path would have to add nonnegative edge weight.

Bloom filter:

> If several independent bits are all present, membership is plausible; if any
> bit is missing, absence is proven.

### Beat 5: The Tax

Say what the idea costs.

Binary search needs sorted data and random access. Dijkstra needs nonnegative
weights and a priority queue. Bloom filters save memory by accepting false
positives. A B-tree reduces disk reads by making nodes wide, but each node
operation is more complex than a simple pointer chase.

## Animation Design and Text Should Co-Evolve

Do not write text after the animation as an afterthought. Each visualization
should be designed around the teaching claims the page needs to prove.

Before implementing a topic, write these first:

- The invariant the animation must make visible.
- The naive approach the animation contrasts against.
- The moment where the learner should say "that is why this works."
- The failure case or tax the page must not hide.
- The real use case that justifies learning the idea.

If the animation cannot show the invariant, redesign the animation.

### Market-Report-Aligned Editorial Rule

This section system follows the same default writing hierarchy we use in Market
Reports:

1. `WRITING_SYSTEM.md` here defines technical depth, proof structure, and course
   coverage.
2. `PROSE_SIMPLICITY.md` in Market Reports defines sentence discipline.
3. Keep craft for rare emphasis points only.

For every topic page:

- Information quality is the first filter.
- Plain clarity is the second.
- Decorative style is the exception.

If this stack breaks, the text is wrong for students.

Examples:

- Binary search should show the eliminated range, not only the midpoint.
- Dijkstra should show tentative distances and the finalized set, not only edge
  traversal.
- Union-find should show why path compression changes future cost, not only the
  parent pointer update.
- LRU cache should show recency order and eviction pressure, not only gets and
  puts.
- Attention should show the cost of the all-pairs table, not only the heatmap.

## Correctness and Proof

Every algorithm page needs a correctness explanation. Keep it plain.

Useful proof patterns:

- **Invariant:** This property is true before and after every step.
- **Monotonicity:** The algorithm only moves in one direction, so it never needs
  to reconsider discarded work.
- **Exchange argument:** If an optimal solution does not make this greedy choice,
  we can swap choices without making it worse.
- **Cut property:** Once a boundary is defined, the best crossing choice is safe.
- **Induction:** If the smaller case is solved correctly, the current step builds
  a correct larger case.
- **Conservation:** The algorithm rearranges state without losing or creating
  information.

Do not over-formalize. The goal is transfer. A learner should be able to predict
what happens on a new input because they understand why the algorithm is safe.

## Cost Must Behave in the Reader's Head

Big-O is necessary but insufficient.

Weak:

> Binary search is O(log n).

Strong:

> Binary search is O(log n): every comparison halves the remaining range. 1,024
> items take at most 10 comparisons. 1,000,000 items take at most 20. Doubling
> the input adds one comparison.

Cost sections should include:

- Time for the main operations.
- Space used by the structure or algorithm.
- What happens when input doubles.
- Which operation dominates in practice.
- Any precondition cost, such as sorting before binary search.
- Any hidden constant that matters, such as pointer chasing, cache locality, or
  disk/page reads.

## Real Use and Non-Use

Every topic should include both.

Use cases should be causal:

> Databases use B-trees because a wide node can hold many keys in one disk page,
> so one read eliminates a large range of possible rows.

Not:

> B-trees are used in databases.

Non-use cases matter just as much:

> A hash table is usually better than a binary search tree for exact lookup when
> you do not need sorted order, predecessor queries, or range scans.

This is where learners become engineers. They stop asking "what is this?" and
start asking "when would I choose this?"

## Sources and Freshness

Classic algorithm facts are stable. Current systems, model-serving details,
browser APIs, cloud products, benchmarks, hardware specs, and paper claims are
not. For unstable topics, verify current facts before adding or revising a page.

Use primary sources where possible:

- Original papers for algorithms, model architectures, and systems.
- Official docs for browser APIs, database behavior, Kubernetes, CUDA, etc.
- Well-maintained educational references for classic DSA.
- Source code or design docs when a case study is about a specific system.

Study notes should not become citation dumps. Sources should support claims,
not replace explanation.

## Required Topic Shape

Every study note should eventually have these sections, with canonical headings:

- Why this exists
- The obvious approach
- The wall
- The core insight
- How it works
- Why it works
- Cost and complexity
- Real-world uses
- Where it fails
- Worked example
- Sources and study next
- How to read the animation

Use `How to read the animation` at the beginning of the article to connect the
visual to the claim set. It should define active/visited/found state semantics and
show one specific inference rule that is safe.

## Prose Standard

### The Simplicity Doctrine

Default to plain, direct prose. This is not optional style polish. It is part of
the teaching contract.

Readers come here to understand an idea. Do not make them pay a prose tax before
they get the mechanism. Do not write stiff AI prose. Do not stretch one insight
across five sentences. Do not announce importance when you can show the actual
reason something matters.

Plain DSJS prose should sound like a strong engineer teaching a smart learner at
a whiteboard: direct, specific, human, and efficient.

The rule is simple: one real idea earns one clear sentence. If the draft has
more sentences than ideas, compress it.

Before:

> Why does this matter? Because binary search is a powerful technique that lets
> us dramatically reduce the search space. This is significant because it means
> we can find values much more efficiently than checking every element.

After:

> Binary search is fast because each comparison makes half the remaining array
> impossible.

The second version teaches the mechanism. The first version wastes time.

### Compression Rules

- One idea per sentence.
- Lead with the point.
- Use specific nouns and numbers.
- Prefer the concrete mechanism over the abstract claim.
- Avoid "powerful," "robust," "significant," "dramatically," and similar empty
  intensifiers unless the magnitude is stated.
- Avoid rhetorical setup when a direct sentence works.
- Do not write like a textbook trying to sound official.
- Do not write like marketing.
- Do not write like an AI trying to sound thoughtful.
- Do not repeat the same point in new clothes.
- Cut transition bridges such as "with that in mind," "this brings us to," and
  "now that we understand." Section order should carry the reader.
- Cut questions that are immediately answered. State the answer.
- Cut "not X, but Y" unless the reader would actually believe X.
- Cut caveat sandwiches. If the caveat matters, give it evidence. If it does
  not, remove it.
- Cut vague significance signals. Replace "this is important" with the reason
  it changes runtime, correctness, memory, reliability, or usability.

### Anti-Filler Test

For every paragraph, ask:

1. What are the actual ideas here?
2. Could each idea be said once, plainly?
3. Did any sentence only introduce, repeat, decorate, hedge, or hype another
   sentence?
4. If a student skimmed this paragraph before an exam or interview, would every
   sentence help?

Delete anything that fails.

This repository should be rich, not long. Depth comes from mechanism,
correctness, tradeoffs, examples, and non-use cases. It does not come from
padding.

## Topic Acceptance Checklist

Before a new or revised topic is done, check:

- Step explanations teach decisions, invariants, or consequences.
- The study notes answer why the idea exists.
- The obvious alternative is named.
- The wall or failure mode is specific.
- The core insight is stated in one clear paragraph.
- Correctness is explained.
- Cost is explained as behavior, not just notation.
- Real uses are tied to access patterns or constraints.
- Non-use cases and tradeoffs are explicit.
- Study-next links are role-based, not a flat list.
- The prose passes the simplicity doctrine: no filler, no stiff AI phrasing, no
  repeated ideas in different clothes, no wasted setup.
- Any current technical facts were verified from primary or official sources.

If a page cannot pass this checklist, it may still be a working visualization,
but it is not yet a finished educational topic.

## Visual Enrichment Standard

The style reference for article depth and visual density is **Lilian Weng's
blog** (lilianweng.github.io). Her technical posts are the gold standard this
site aims to match: deep, long-form articles with rich inline images, diagrams,
and charts woven throughout every section.

### What This Means in Practice

Every major section of a topic article should include at least one visual
element where it genuinely helps comprehension. Visual elements include:

- **Images** from any public URL (with source attribution in the caption).
- **Diagrams** (ASCII art or structured text showing layouts, flows, or state).
- **Code blocks** showing the mechanism in pseudocode or real code.
- **Bullet lists** comparing approaches, costs, or properties.

Do not use tables. The site renderer does not handle them well. Use bullet
lists, side-by-side callouts, or prose comparisons instead.

Do not add visuals for decoration. Add them where a reader would otherwise have
to build a mental picture from prose alone. The test: if a section describes a
structure, a flow, a comparison, or a state transition, it should show one.

### Image Guidelines

- Images can come from any publicly accessible URL on the internet — Wikimedia
  Commons, documentation sites, research papers, blog posts, educational
  resources, etc. The entire internet is our source.
- Always cite the source with a link in the caption.
- Prefer diagrams and architecture visuals over logos (logos are fine as a
  secondary visual, but the primary images should teach).
- Every image block must include: `src` (full public URL), `alt` (descriptive
  alt text), and `caption` (with source attribution and link).
- Images should appear inline in the section they support, not collected at
  the end.

### Depth Standard

Articles should match Lilian Weng's depth: thorough first-principles coverage
that a motivated reader can use as a standalone reference. This means:

- Worked examples with concrete numbers, not just abstract descriptions.
- Mathematical reasoning where it clarifies (not where it intimidates).
- Tradeoff analysis that names specific costs, not vague "it depends."
- Real system context: where is this deployed, what scale, what constraints.
- Failure modes and limits: what breaks, when, and why.
- Historical context where it helps: who built this, what problem triggered it.

A finished article should be long enough that a reader could skip the animation
entirely and still learn the topic deeply from the prose and visuals alone.

### Callout Blocks

Every article should have at least one callout block capturing the core
architectural insight in a single sentence. Callouts use
`{type: 'callout', text: '...'}` and render as a highlighted box. They anchor
the reader's takeaway for the section.

### Editorial Review Standard

Every Codex editorial reviewer must read this document (WRITING_SYSTEM.md)
before making recommendations. Reviews should evaluate articles against the
Lilian Weng standard: sufficient depth, inline visuals in every major section,
and prose that teaches mechanisms rather than summarizing them.
