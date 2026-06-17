// Lookahead decoding: generate candidate n-grams in parallel, cache useful
// continuations, and verify accepted prefixes with the target model.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'lookahead-decoding-ngram-pool-case-study',
  title: 'Lookahead Decoding N-Gram Pool Case Study',
  category: 'AI & ML',
  summary: 'A draft-model-free decoding case study: Jacobi-style lanes, candidate n-gram pools, verification branches, exact acceptance, and pool eviction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['jacobi lanes', 'ngram pool'], defaultValue: 'jacobi lanes' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function lookGraph(title) {
  return graphState({
    nodes: [
      { id: 'pref', label: 'pre', x: 0.7, y: 3.4, note: 'prefix' },
      { id: 'lane1', label: 'L1', x: 2.3, y: 1.5, note: 'guess' },
      { id: 'lane2', label: 'L2', x: 2.3, y: 3.4, note: 'guess' },
      { id: 'lane3', label: 'L3', x: 2.3, y: 5.3, note: 'guess' },
      { id: 'pool', label: 'pool', x: 4.2, y: 3.4, note: 'grams' },
      { id: 'match', label: 'hit', x: 5.9, y: 2.1, note: 'prefix' },
      { id: 'ver', label: 'ver', x: 5.9, y: 4.8, note: 'logits' },
      { id: 'out', label: 'out', x: 7.6, y: 3.4, note: 'emit' },
      { id: 'led', label: 'led', x: 9.1, y: 3.4, note: 'stats' },
    ],
    edges: [
      { id: 'e-pre-l1', from: 'pref', to: 'lane1' },
      { id: 'e-pre-l2', from: 'pref', to: 'lane2' },
      { id: 'e-pre-l3', from: 'pref', to: 'lane3' },
      { id: 'e-l1-pool', from: 'lane1', to: 'pool' },
      { id: 'e-l2-pool', from: 'lane2', to: 'pool' },
      { id: 'e-l3-pool', from: 'lane3', to: 'pool' },
      { id: 'e-pool-match', from: 'pool', to: 'match' },
      { id: 'e-match-ver', from: 'match', to: 'ver' },
      { id: 'e-ver-out', from: 'ver', to: 'out' },
      { id: 'e-out-led', from: 'out', to: 'led' },
    ],
  }, { title });
}

function* jacobiLanes() {
  yield {
    state: lookGraph('Lookahead lanes propose n-grams'),
    highlight: { active: ['pref', 'lane1', 'lane2', 'lane3', 'e-pre-l1', 'e-pre-l2', 'e-pre-l3'], found: ['pool'] },
    explanation: 'Lookahead decoding does not require a draft model. It uses parallel lanes to produce candidate future n-grams, then later verifies whether any candidate matches the ordinary autoregressive path.',
    invariant: 'A candidate n-gram is only a speed hint until target verification accepts it.',
  };

  yield {
    state: labelMatrix(
      'Lane snapshots',
      [
        { id: 'l1', label: 'L1' },
        { id: 'l2', label: 'L2' },
        { id: 'l3', label: 'L3' },
        { id: 'l4', label: 'L4' },
      ],
      [
        { id: 'g1', label: 'g1' },
        { id: 'g2', label: 'g2' },
        { id: 'g3', label: 'g3' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['the', 'model', 'can', 'yes'],
        ['the', 'model', 'will', 'yes'],
        ['answer', 'is', '.', 'some'],
        ['tool', 'call', '{', 'some'],
      ],
    ),
    highlight: { active: ['l1:keep', 'l2:keep'], compare: ['l3:keep', 'l4:keep'] },
    explanation: 'The lanes collect possible n-grams. Repeated prefixes are valuable because they may match future decode positions; low-quality or rarely used lanes are cheap to evict from the pool.',
  };

  yield {
    state: lookGraph('Verification checks the matching prefix'),
    highlight: { active: ['pool', 'match', 'ver', 'e-pool-match', 'e-match-ver'], found: ['out'], compare: ['lane1', 'lane2', 'lane3'] },
    explanation: 'When the current prefix matches a stored candidate, the verifier checks the proposed continuation. Accepted tokens advance output; a mismatch falls back to the target token.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'pool hit rate', min: 0, max: 100 }, y: { label: 'decode speedup', min: 0.8, max: 2.8 } },
      series: [
        { id: 'short', label: '2-gram', points: [{ x: 5, y: 0.95 }, { x: 20, y: 1.15 }, { x: 40, y: 1.35 }, { x: 60, y: 1.55 }, { x: 80, y: 1.72 }] },
        { id: 'long', label: '4-gram', points: [{ x: 5, y: 0.85 }, { x: 20, y: 1.05 }, { x: 40, y: 1.55 }, { x: 60, y: 2.05 }, { x: 80, y: 2.35 }] },
      ],
      markers: [
        { id: 'be', x: 28, y: 1.15, label: 'breakeven' },
      ],
    }),
    highlight: { active: ['long', 'be'], compare: ['short'] },
    explanation: 'Longer n-grams pay off only when the pool hit rate is high enough. Otherwise the extra parallel work costs more than the saved serial decode steps.',
  };
}

function* ngramPool() {
  yield {
    state: lookGraph('N-gram pool is the reusable memory'),
    highlight: { active: ['lane1', 'lane2', 'lane3', 'pool', 'e-l1-pool', 'e-l2-pool', 'e-l3-pool'], compare: ['ver'], found: ['led'] },
    explanation: 'The n-gram pool is a small cache of candidate continuations. It needs keys, hit counts, acceptance history, age, and eviction policy, just like any performance cache.',
  };

  yield {
    state: labelMatrix(
      'Pool entry table',
      [
        { id: 'a', label: 'gramA' },
        { id: 'b', label: 'gramB' },
        { id: 'c', label: 'gramC' },
        { id: 'd', label: 'gramD' },
        { id: 'e', label: 'gramE' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'hit', label: 'hit' },
        { id: 'act', label: 'act' },
      ],
      [
        ['the', 'high', 'keep'],
        ['def', 'med', 'keep'],
        ['json', 'low', 'age'],
        ['rare', 'low', 'drop'],
        ['copy', 'high', 'pin'],
      ],
    ),
    highlight: { active: ['a:act', 'b:act', 'e:act'], compare: ['c:act'], removed: ['d:act'] },
    explanation: 'A practical pool keeps common prefixes and repeated boilerplate, ages out rare continuations, and pins highly reusable patterns such as code or JSON scaffolds.',
  };

  yield {
    state: labelMatrix(
      'Complete case: repetitive agent output',
      [
        { id: 'r0', label: 'pre' },
        { id: 'r1', label: 'pool' },
        { id: 'r2', label: 'ver' },
        { id: 'r3', label: 'emit' },
      ],
      [
        { id: 'gram', label: 'gram' },
        { id: 'test', label: 'test' },
        { id: 'act', label: 'act' },
      ],
      [
        ['tool', 'hit', 'try'],
        ['call', 'hit', 'keep'],
        ['call', 'pass', 'emit'],
        ['call', 'log', 'store'],
      ],
    ),
    highlight: { active: ['r0:act', 'r1:act', 'r2:act', 'r3:act'], found: ['r2:test'], compare: ['r0:gram'] },
    explanation: 'Agent outputs often repeat tool-call and JSON fragments. Lookahead can reuse those fragments when they match the current prefix, but target verification still owns the final token stream.',
  };

  yield {
    state: lookGraph('Pool metrics feed the runtime controller'),
    highlight: { active: ['pool', 'match', 'ver', 'out', 'led', 'e-pool-match', 'e-match-ver', 'e-ver-out', 'e-out-led'], found: ['pref'] },
    explanation: 'The controller should disable lookahead when hit rate, accepted length, or tail latency falls below target. Lookahead is an adaptive serving method, not a permanent global switch.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'jacobi lanes') yield* jacobiLanes();
  else if (view === 'ngram pool') yield* ngramPool();
  else throw new InputError('Pick a Lookahead decoding view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Lookahead decoding exists because autoregressive generation wastes wall-clock time on an awkward dependency. The target model can only emit token t + 1 after token t is known, so decoding often becomes a long serial loop. Even when the GPU has spare parallel compute, the next-token dependency keeps the serving path waiting on one small step after another.',
        'Speculative decoding attacks the same bottleneck with a draft model. A smaller model proposes future tokens, and the target model verifies them. Lookahead decoding is different: it tries to get some of the benefit without a separate draft model. It uses parallel lanes to generate candidate n-grams, stores reusable continuations in a pool, and verifies those continuations against the target model before any token becomes output.',
        'The important point is that Lookahead is not a new language model and not a shortcut around correctness. It is a runtime strategy for finding safe parallel work around a serial process. The target model still owns the emitted text. The pool only offers guesses that might let one verification step accept several tokens.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious serving approach is plain greedy or sampling decode: run the target model, choose one token, append it, update the KV cache, and repeat. This is simple and exact. It also leaves performance on the table when outputs contain predictable local structure. Code, JSON, tool calls, markdown tables, boilerplate refusals, and repeated templates often contain short continuations that can be guessed safely if the target verifies them.',
        'A second obvious approach is to always run a draft model. That can work, but it adds another model to load, tune, batch, and keep aligned with the target. Draft-model quality strongly affects acceptance. A weak draft wastes verification bandwidth; a strong draft may cost enough memory and compute to complicate serving. Lookahead asks whether some traffic can be accelerated with candidates produced and recycled inside the target-model runtime itself.',
        'The failure of both simple stories is that there is no universal free speedup. Plain decoding is exact but serial. Drafting can be fast but operationally heavier. Lookahead is only useful when candidate work is cheap, hits are common, and accepted prefixes are long enough to beat the overhead.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'The invariant is exactness under target verification. A proposed n-gram is not output. It is a candidate. The verifier asks the target model how many proposed tokens match the ordinary autoregressive path under the chosen decoding rule. Only the accepted prefix is emitted. At the first mismatch, the runtime falls back to the target token and continues normally.',
        'This invariant is what lets Lookahead be an acceleration method rather than a quality-changing approximation. The pool can be noisy. Lanes can guess badly. Eviction can be imperfect. None of those mistakes should change the final distribution if verification is implemented correctly for the chosen decoding mode.',
        'The invariant also defines the useful metric. Proposal length is not success. Pool size is not success. Hit rate alone is not success. The metric that matters is accepted target-equivalent tokens per unit of extra work. A large pool that proposes long continuations but has low acceptance is just a latency tax.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A Lookahead runtime keeps several small data structures. The lane table tracks parallel candidate streams. The n-gram pool stores candidate continuations. A prefix index maps the current suffix or prefix key to pool entries that might apply. The verifier result table records how many tokens were accepted. The accepted-token ledger aggregates performance by request type, model, route, sampling policy, and batch shape.',
        'A pool entry should include a key, a candidate continuation, token ids, hit count, accepted length history, rejection count, age, traffic segment, and memory cost. This is a cache entry, not a belief. It earns its place by reducing future serial decode steps. If it stops doing that, it should age out.',
        'Segmentation is not optional in a serious runtime. A continuation useful for Python code may be harmful for legal prose. A JSON tool-call fragment may be valuable for an agent route and irrelevant for chat. Mixing all traffic into one pool can make average metrics look acceptable while hurting important slices.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The runtime begins with the current target-model state and runs lookahead lanes that propose short future sequences. Those sequences are turned into n-grams and inserted into the pool if they look reusable. Later, when decoding reaches a matching prefix, the runtime retrieves candidate continuations and sends them through a verification path.',
        'Verification can accept zero, one, or many proposed tokens. If the first proposed token does not match the target decision, the candidate earns no output and ordinary decoding supplies the next token. If several proposed tokens match, the runtime appends them, updates bookkeeping, and skips serial target passes that would otherwise have produced the same tokens one by one.',
        'The mechanism is easiest to compare with branch prediction. A CPU predictor does not abolish control dependencies; it guesses around them and pays a penalty when wrong. Lookahead does not abolish autoregressive dependency; it guesses local continuations and relies on target verification to keep the output exact.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Lookahead works when local text is predictable enough that reusable n-grams appear again and again. Structured outputs have this property. Code contains syntax, indentation, imports, braces, and common idioms. Tool calls contain fixed keys and schemas. Logs and reports contain repeated boilerplate. In those regions, one accepted candidate can replace several target-model loop iterations.',
        'It also works because modern accelerators often prefer larger, better-shaped work to many tiny serial steps. If verification can be batched with active requests, the runtime may use available parallelism to check candidates while reducing the number of decode iterations. The gain is wall-clock, not theoretical asymptotics. The serial dependency remains; Lookahead just makes some future steps safe to consume early.',
        'The method fails gracefully only if exact fallback is cheap. A rejected candidate should not corrupt the KV cache, block unrelated requests, or force a slow rebuild of state. The implementation must treat rejection as a normal path, because good candidate systems are still wrong often.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an agent service that repeatedly emits tool-call JSON. Many completions include fragments such as an opening object, quoted property names, commas, arrays, and closing delimiters. The n-gram pool learns that after a prefix like `"arguments": {`, continuations such as `"query":` or `"path":` often appear. When a later request reaches the same prefix, the pool retrieves those candidates.',
        'The verifier then checks the candidate against the current target-model state. If the target would have emitted the same token sequence under the active decoding rule, the runtime accepts several tokens and advances. If the request is asking a different tool or a different schema, acceptance drops and ordinary decoding resumes after the first mismatch.',
        'Now change the route to open-ended analysis. The surface text becomes less repetitive and more dependent on retrieved evidence. The same pool policy may produce many plausible but wrong continuations. A good runtime notices that accepted length fell, decreases candidate length, switches to a segment-specific pool, or disables Lookahead for that route.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep candidate state separate from committed decode state. Do not mutate the authoritative KV cache as if a candidate were accepted until verification says so. If the implementation uses temporary branches, make branch lifetime explicit and cheap to discard. Candidate cleanup bugs are a common way for speculative systems to become slow or wrong.',
        'Make the pool bounded by both memory and usefulness. A simple policy can combine recency, hit rate, accepted length, and segment. Pinning common structural n-grams is reasonable, but pins should be auditable. A permanently pinned bad candidate is worse than an ordinary stale cache entry because it keeps taxing the verifier.',
        'Integrate with batching from the beginning. A verifier that creates odd-shaped microbatches, waits behind prefill work, or blocks continuous batching can erase the speedup. The correct comparison is not candidate decode in isolation. It is end-to-end tokens per second, p50 and p99 latency, GPU utilization, and cost per accepted token under real traffic.',
        'Treat sampling carefully. Greedy verification is easier to reason about than stochastic sampling. If the product uses temperature, top-p, or other sampling rules, verification must preserve the intended distribution rather than quietly turning the route into greedy decode. The exact acceptance rule belongs in tests, not only in a paper summary.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track pool hit rate, accepted tokens per verification, rejection position, verifier overhead, stale-entry rate, pool memory, batch interference, fallback rate, and latency by route. These metrics answer the real question: is Lookahead reducing serial target passes, or is it adding proposal work that mostly gets rejected?',
        'Measure by traffic segment. A route that emits tool calls may show strong speedup while creative writing slows down. A single blended average can hide that. Segment-level reporting lets the controller enable Lookahead where it earns its keep and disable it where plain decoding is better.',
        'Use cost per accepted token as a rollout gate. If proposals are cheap and accepted often, Lookahead can improve serving. If candidates are expensive, mostly rejected, or harmful to tail latency, the simpler baseline wins. An adaptive controller should be allowed to say no.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Lookahead wins on repetitive, locally structured outputs: code completion, schema-constrained JSON, tool-call arguments, logs, templated customer-support replies, repeated report sections, and narrow domain formats. It is especially attractive when the serving stack already has spare parallelism during decode and can verify candidates without disrupting active batches.',
        'It also wins as a draft-model-free deployment step. Teams that cannot afford another model, cannot tune a draft model for every target, or need a simpler operational footprint may still be able to exploit n-gram repetition. The pool is easier to update than a model checkpoint, and its behavior can be inspected with cache-style metrics.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Lookahead fails when the workload has little reusable local structure. Highly contextual reasoning, long evidence-dependent prose, novel creative writing, and routes with diverse schemas may produce low hit rates and short accepted prefixes. In those cases the verifier spends effort rejecting guesses that ordinary decoding would never have made.',
        'It can also fail inside a serving engine. Candidate generation can fight continuous batching, increase memory pressure, create tail latency, or add branch-management complexity. A method that looks fast in an isolated benchmark may lose when mixed with prefill-heavy traffic, long contexts, many concurrent users, or strict latency objectives.',
        'The correctness failure is more serious than the performance failure. If candidates can leak into output without exact target verification, Lookahead is no longer a safe acceleration method. Tests should compare output equivalence under controlled seeds and decoding settings, including mismatch at the first token, partial acceptance, and repeated fallback.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lookahead Decoding at https://arxiv.org/abs/2402.02057 and https://github.com/hao-ai-lab/LookaheadDecoding. For the broader family, study speculative decoding, suffix decoding, Medusa-style candidate trees, and EAGLE-style feature drafting. The recurring pattern is always the same: propose ahead, verify with the target, and measure accepted work.',
        'Study next: Multi-Token Decoding, Medusa Tree Attention Candidate Mask Case Study, EAGLE Feature Draft Tree Case Study, Speculative Decoding Runtime Controller Case Study, Speculative Decoding Acceptance Ledger, Prefix Caching RadixAttention, LLM Continuous Batching, KV Cache, and SLO-Aware LLM Request Router Case Study.',
      ],
    },
  ],
};
