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
      heading: 'What it is',
      paragraphs: [
        'Lookahead decoding is a draft-model-free method for reducing autoregressive decode steps. It generates candidate n-grams in parallel, stores useful continuations in a pool, and verifies candidate prefixes against the target model before emitting tokens.',
        'Multi-Token Decoding introduces Lookahead at a high level. This module focuses on the actual data structures: lanes, n-gram pool entries, prefix matching, verifier branches, accepted-length metrics, and eviction policy.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A Lookahead runtime keeps a lane table, n-gram pool, prefix index, verifier result table, accepted-token ledger, and pool-eviction policy. Each pool entry carries a key prefix, candidate continuation, hit count, acceptance rate, age, and traffic segment.',
        'The n-gram pool is the practical memory of the method. If it fills with rare or stale candidates, the verifier does extra work for little gain. If it captures repetitive code, tool-call, or templated text, it can reduce serial target passes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Parallel lanes generate candidate n-grams from the current state. The runtime inserts promising n-grams into a pool. Later, when the current prefix matches a pool key, the target model verifies the continuation and accepts the longest valid prefix.',
        'The method trades extra parallel computation for fewer serial steps. It works best when the accelerator has spare parallel compute, the traffic contains repeated continuations, and verification is integrated with batching rather than bolted on afterward.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A coding agent emits many structured tool calls. The pool learns repeated fragments such as `tool call {` and JSON key patterns. When a new generation reaches the same prefix, Lookahead proposes the fragment, verifies it, emits multiple accepted tokens, and logs the pool hit.',
        'If the traffic shifts to creative prose, pool hits and accepted length fall. The runtime controller reduces n-gram length or disables Lookahead for that segment. The ledger makes that decision visible rather than ideological.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Lookahead can be slower than plain decoding when the pool hit rate is low, when generated n-grams are stale, when verification creates tail latency, or when the implementation fights continuous batching. A healthy rollout reports speedup by traffic segment, not one average.',
        'Do not confuse proposed n-grams with accepted output. The target verification path must own final text. The pool is a cache of guesses, not an authority.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lookahead Decoding at https://arxiv.org/abs/2402.02057 and https://github.com/hao-ai-lab/LookaheadDecoding, speculative decoding at https://arxiv.org/abs/2211.17192, vLLM speculative decoding at https://docs.vllm.ai/en/stable/features/speculative_decoding/, and vLLM suffix decoding at https://docs.vllm.ai/en/latest/features/speculative_decoding/suffix/.',
        'Study next: Medusa Tree Attention Candidate Mask Case Study, EAGLE Feature Draft Tree Case Study, Speculative Decoding Runtime Controller Case Study, Speculative Decoding Acceptance Ledger, Prefix Caching RadixAttention, and LLM Continuous Batching.',
      ],
    },
  ],
};
