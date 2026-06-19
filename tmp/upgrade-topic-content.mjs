import fs from 'node:fs';

const replacements = [
  { file: 'src/topics/graph-bfs.js', heading: 'Worked example', markers: ['Walk one concrete input all the way through.', 'Keep this short and exact: state the state, the move, and the outcome at each step.', 'The goal is prediction, not a one-off demonstration.'], replacementLines: ['Use A as the source and target F. The search starts with queue = [A], seen = {A}.', 'Step one: dequeue A, visit unseen neighbors B and C, set both distance = 1, then enqueue [B, C].', 'Step two: dequeue B, visit unseen neighbors and assign distance = 2, then enqueue unseen nodes. Step three: dequeue C, visit unseen neighbors and do not revisit A, then discover F via the B/C region. The first discovery fixes the best parent chain.', 'Step four: if F is the goal, parent reconstruction gives F <- E <- C <- A, a three-edge shortest path. No shorter path can appear later because all queued states with smaller distance already processed.'] },
  { file: 'src/topics/dijkstra.js', heading: 'How to read the animation', markers: ["Read the animation as the execution trace for Dijkstra's Shortest Path.", 'Active items are the current decision point.', 'Found markers are outcomes now guaranteed true.'], replacementLines: ["Watch the priority queue of unsettled nodes first. The node with smallest tentative distance is always expanded next.", "For every expansion, every outgoing edge proposes a candidate path through that node; relaxation writes improvements only when they are strictly better than what we already know.", "The green settled set means those distances are final. Once a node is settled, later paths to that node cannot improve without violating the greedy frontier order.", "Track two questions per frame: what changed in queue ordering, and which parent pointer improved. Those two traces are the proof of correctness." ] },
  { file: 'src/topics/attention.js', heading: 'The wall', markers: ['Keep this topic tied to one crisp practical claim.', 'Use attention as a checkpoint'], replacementLines: ['The wall is conflating all-to-all similarity with deterministic attention. Hard attention in production is a learned weighted read, not a single winner index.', 'The first production failure is shape. As context grows, quadratic score tables become the bottleneck even when model quality is fine.', 'The second wall is masking discipline. If mask and position constraints are wrong, the model may attend to forbidden future tokens or padded positions and leak information.'] },
  { file: 'src/topics/attention.js', heading: 'The core insight', markers: ['Keep this topic tied to one crisp practical claim.', 'Use attention as a checkpoint'], replacementLines: ['Attention is a learned read operator: each query computes compatibility with every key, converts scores to probabilities, then blends values by those probabilities.', 'The key invariant is row-wise normalization. Each row sums to one, so each token output is an interpretable weighted average of all value vectors it reads.', 'Scaling by sqrt(d_k) keeps these scores in a numerically stable range so the distribution does not collapse to one token too early.'] },
  { file: 'src/topics/attention.js', heading: 'Worked example', markers: ['Keep this topic tied to one crisp practical claim.', 'Use attention as a checkpoint'], replacementLines: ['Use tokens [The, cat, sat, on]. For token "sat", the attention score row might prefer prior context tokens "the" and "cat".', 'After softmax, the output for sat becomes a weighted mix of those nearby vectors, which lets it carry subject and article cues forward.', 'Now bias the query so "on" score increases. The same token row shifts to location-focused attention, producing a different sat representation with unchanged token set.'] },
  { file: 'src/topics/heap-sort.js', heading: 'The wall', markers: ['Keep this topic tied to one crisp practical claim.', 'Use heap sort as a checkpoint'], replacementLines: ['The wall is treating heap sort as only “sort in a tree”. Real performance comes from preserving the max-heap invariant while updating in-place.', 'If sift-down is buggy once, the extraction contract fails and the sorted suffix guarantee collapses. The largest root extracted is no longer trustworthy.', 'Second wall: heap sort is robust in memory but sometimes slower than hybrid sorts on nearly ordered data.'] },
  { file: 'src/topics/retries-jitter.js', heading: 'The wall', markers: ['The wall is the precise failure mode that blocks the obvious approach.', 'Make it concrete: the missing invariant, the extra operation, or the case that forces failure.'], replacementLines: ['The wall is synchronized retries. If every worker retries at the same delays, failures can amplify into a thundering herd.', 'A second wall is missing idempotency. Retrying side-effecting operations without keys can duplicate work and produce inconsistencies.', 'A third wall is unbounded loops: retrying forever under outage steals capacity from healthy traffic.'] },
  { file: 'src/topics/retries-jitter.js', heading: 'Worked example', markers: ['Walk one concrete input all the way through.', 'Keep this short and exact: state the state, the move, and the outcome at each step.'], replacementLines: ['Suppose 1,000 clients hit a timeout at t = 0. Without jitter, all retry together at 1s, 2s, 3s and create synchronized load spikes.', 'With jitter in [100ms, 900ms], retry times are spread out. The aggregate traffic is similar, but peak load drops and the dependency recovers faster.', 'Add a retry budget of 3 and a 5-second deadline: beyond that, stop and fail fast to boundedly protect system capacity.'] },
  { file: 'src/topics/backpressure.js', heading: 'The wall', markers: ['The wall is the precise failure mode that blocks the obvious approach.', 'Make it concrete: the missing invariant, the extra operation, or the case that forces failure.'], replacementLines: ['The wall is one-way buffering. If only consumers track queue depth, source continues overproducing and overload stays hidden.', 'The second wall is silent failure. A queue absorbs load until memory collapses or latency explodes, and the system no longer signals meaningful health.', 'Backpressure works only when both ends participate: source and destination must share explicit control signals.'] },
  { file: 'src/topics/backpressure.js', heading: 'Worked example', markers: ['Walk one concrete input all the way through.', 'Keep this short and exact: state the state, the move, and the outcome at each step.'], replacementLines: ['Producer emits 10,000 events/s while consumer capacity is 2,000/s. Without backpressure, queue depth grows by 8,000 each second and user latency escalates.', 'With bounded queue and producer rejection, pressure appears immediately at source and traffic is shaped toward what the system can absorb.', 'With AIMD credits, producers ramp up slowly and cut in half on congestion, producing a controlled operating point instead of overload.'] },
  { file: 'src/topics/tail-latency.js', heading: 'The wall', markers: ['The wall is the precise failure mode that blocks the obvious approach.', 'Make it concrete: the missing invariant, the extra operation, or the case that forces failure.'], replacementLines: ['The wall is equating a healthy average with a healthy user experience. Tails are what users feel most often in production.', 'The second wall is retry coupling: retrying a straggling dependency can multiply the tail instead of masking it.', 'Reducing tail requires composition-aware architecture—timeouts, concurrency limits, and queue control—not one isolated optimization.'] },
  { file: 'src/topics/tail-latency.js', heading: 'Worked example', markers: ['Walk one concrete input all the way through.', 'Keep this short and exact: state the state, the move, and the outcome at each step.'], replacementLines: ['One call depends on 20 services each with p99 latency 20ms and p50 5ms. Composed behavior is dominated by stragglers, not the median.', 'If one in five requests has a slow dependency, users observe that often enough that “works most of the time” is not enough.', 'Add service-level budgets and isolate non-critical branches; tail metrics should improve even if p50 changes very little.'] },
  { file: 'src/topics/causal-graphs.js', heading: 'Worked example', markers: ['Keep this topic tied to one crisp practical claim.', 'Use causal graphs as a checkpoint'], replacementLines: ['Use the kidney-stone setup from the topic. If treatment A is used more often for mild cases while B is used for severe cases, naive aggregates can hide the true treatment effect.', 'Count outcomes separately by severity subgroup; A beats B in every subgroup but can look worse in aggregate due to different subgroup sizes.', 'The causal graph points to the confounder edge and the adjustment set needed before interpreting treatment effect.'] },
  { file: 'src/topics/transformer-block.js', heading: 'The wall', markers: ['Keep this topic tied to one crisp practical claim.', 'Use transformer block as a checkpoint'], replacementLines: ['The wall is dropping the residual path. Without skip connections, depth degrades into fragile representations and unstable gradients.', 'Another wall is unstable scaling. Without consistent normalization order, activations drift across layers and optimization becomes difficult.', 'The third wall is interface drift: any block changing shape breaks all later composition.'] },
  { file: 'src/topics/transformer-block.js', heading: 'Why it works', markers: ['Keep this topic tied to one crisp practical claim.', 'Use transformer block as a checkpoint'], replacementLines: ['The block combines context mixing, residual propagation, normalization, and local nonlinear feature transform at one fixed interface.', 'Residual connections preserve signal across depth, which is why deep stacks can remain trainable instead of collapsing.', 'Layer norms keep distributions stable and support deeper stacks without uncontrolled scale growth or collapse.'] },
  { file: 'src/topics/transformer-block.js', heading: 'Worked example', markers: ['Keep this topic tied to one crisp practical claim.', 'Use transformer block as a checkpoint'], replacementLines: ['Run a short sentence through one block. Attention mixes context first, then residual add preserves the input stream.', 'Layer norm and FFN apply a nonlinear transform on each token. Skip-add keeps essential signals while still allowing representation improvement.', 'Stacking repeats this behavior, which is why one block is the atomic unit of large language models.'] },
  { file: 'src/topics/transformer-inference-roofline.js', heading: 'Worked example', markers: ['Keep this topic tied to one crisp practical claim.', 'Use transformer inference roofline as a checkpoint'], replacementLines: ['For prefill: 4k-token prompt at batch 16 can appear compute-heavy and near the compute roof in the animation.', 'For decode, each step is small and serial; the same request can move to a memory-bound regime with poor arithmetic intensity.', 'Use phase points to target optimization: compute tuning helps prefill, memory/cache tuning helps decode.'] },
  { file: 'src/topics/prefix-caching-radixattention.js', heading: 'The wall', markers: ['The wall is the precise failure mode that blocks the obvious approach.', 'Make it concrete: the missing invariant, the extra operation, or the case that forces failure.'], replacementLines: ['The wall is assuming semantic similarity is cacheable when prefix reuse is exact-indexed. Prefix caches need exact token-prefix matches under fixed model, adapters, and position state.', 'The second wall is cache churn under heavy unique traffic. Over-retaining keys increases memory pressure and can hurt both latency and hit rate.', 'Use an eviction policy that balances reuse probability with active memory budget.'] },
  { file: 'src/topics/prefix-caching-radixattention.js', heading: 'Worked example', markers: ['Walk one concrete input all the way through.', 'Keep this short and exact: state the state, the move, and the outcome at each step.'], replacementLines: ['Request 1: "System: concise. User: explain BFS." and Request 2: "System: concise. User: explain DFS." share the same system prefix.', 'A radix cache should reuse the shared prefix state and compute only the differing suffix for request 2.', 'If the system prompt changes, the cache should miss because exact prefix matching and runtime context changed.'] },
  { file: 'src/topics/quantization.js', heading: 'Worked example', markers: ['Keep this topic tied to one crisp practical claim.', 'Use quantization as a checkpoint'], replacementLines: ['Use the animated 4x4 matrix and bits 4. Quantized values become integer steps on a scale controlled by range and outliers.', 'Dequantize to float and compare error map. Then inspect 2-bit results to see structural collapse and why quality cliffs appear.', 'Per-group quantization often recovers local precision for sensitive channels by choosing tighter scales per group.'] },
  { file: 'src/topics/event-loop.js', heading: 'The wall', markers: ['Keep this topic tied to one crisp practical claim.', 'Use event loop as a checkpoint'], replacementLines: ['The wall is assuming async equals true parallelism. On one thread, tasks still run one at a time in event-loop order.', 'A second wall is queue misunderstanding. Microtasks and render phases have priorities that can change outcome ordering.', 'The practical fix is workload shaping: yield frequently and keep UI-critical work ahead of heavy background loops.'] },
  { file: 'src/topics/webassembly-linear-memory-case-study.js', heading: 'The wall', markers: ['Keep this topic tied to one crisp practical claim.', 'Use webassembly linear memory case study as a checkpoint'], replacementLines: ['The wall is pointer-style thinking. Wasm offsets are sandboxed numbers into a bounded memory, not native host pointers.', 'The second wall is stale view behavior on growth. Cached views can become invalid after memory growth or reallocation.', 'The practical boundary is strict ownership and interface contracts: allocate, pass lengths, refresh views, and free carefully.'] },
];

function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'); }

function findMatchingBracket(text, openIndex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] || '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingle) {
      if (escaped) { escaped = false; }
      else if (ch === '\\') { escaped = true; }
      else if (ch === "'") { inSingle = false; }
      continue;
    }
    if (inDouble) {
      if (escaped) { escaped = false; }
      else if (ch === '\\') { escaped = true; }
      else if (ch === '"') { inDouble = false; }
      continue;
    }
    if (inTemplate) {
      if (escaped) { escaped = false; }
      else if (ch === '\\') { escaped = true; }
      else if (ch === '`') { inTemplate = false; }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

for (const file of [...new Set(replacements.map((c) => c.file))]) {
  let text = fs.readFileSync(file, 'utf8');
  const fileChanges = replacements.filter((c) => c.file === file);

  for (const change of fileChanges) {
    const headingPattern = new RegExp("heading:\\s*(?:'|\"|`)" + escapeRegex(change.heading) + "(?:'|\"|`)\\s*,", 'g');
    let replaced = false;

    for (const match of text.matchAll(headingPattern)) {
      const headingStart = match.index;
      const paraIndex = text.indexOf('paragraphs:', headingStart);
      if (paraIndex === -1) continue;
      const bracketStart = text.indexOf('[', paraIndex);
      if (bracketStart === -1) continue;
      const bracketEnd = findMatchingBracket(text, bracketStart);
      if (bracketEnd === -1) continue;

      const sectionText = text.slice(bracketStart, bracketEnd + 1);
      if (!change.markers.every((marker) => sectionText.includes(marker))) continue;

      const lineStart = text.lastIndexOf('\n', paraIndex) + 1;
      const indentMatch = text.slice(lineStart).match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      const itemIndent = `${indent}  `;
      const inner = change.replacementLines.map((line) => `${itemIndent}'${line}',`).join('\n');
      const replacement = `[\n${inner}\n${indent}]`;

      text = text.slice(0, bracketStart) + replacement + text.slice(bracketEnd + 1);
      replaced = true;
      break;
    }

    if (!replaced) throw new Error(`No matching section found for ${change.heading} in ${file}`);
  }

  fs.writeFileSync(file, text, 'utf8');
}

console.log('topic text upgraded');