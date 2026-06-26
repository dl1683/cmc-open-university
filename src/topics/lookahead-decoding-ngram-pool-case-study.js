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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a decode loop with two kinds of state: committed target-model state and tentative candidate state. Active lanes are guesses, the pool is a cache of reusable token sequences, and found tokens are emitted only after target verification.',
        'A safe inference rule is strict: a proposed n-gram is not output. It becomes output only when the target model would have produced the same token under the active decoding rule.',
        {type:'callout', text:'Lookahead turns unused decode parallelism into exact speed only when every proposed token remains subordinate to target-model verification.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive decoding emits one token after another. Token t + 1 depends on token t, so a long response can become a serial chain of small GPU calls even when the hardware could do more parallel work.',
        'Lookahead decoding exists to find safe work around that serial chain. It proposes short continuations, stores reusable n-grams, and lets one verification step accept several tokens when the guesses match the target path.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is plain decode: run the target model, choose one token, update the KV cache, and repeat. This is simple and exact, but it may waste wall-clock time on structured output like code, JSON, and templates.',
        'Another obvious approach is speculative decoding with a smaller draft model. That can work, but it adds another model to host, tune, batch, and keep aligned with the target.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that speedups must not change the model output. If a proposed token slips into the committed sequence without exact verification, the method has become an approximation rather than a safe runtime optimization.',
        'The performance wall is overhead. Candidate generation, pool lookup, branch state, and verifier work can cost more than ordinary decoding if acceptance is low or if batching is disrupted.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat future tokens as cached guesses under a verifier. The n-gram pool stores continuations that have been useful before, but the target model remains the authority.',
        'This is similar to branch prediction in a CPU. A good guess saves time, a bad guess is discarded, and correctness comes from the commit rule rather than from the predictor being perfect.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The runtime runs lookahead lanes that produce short candidate continuations from the current context or nearby generated text. Useful continuations enter an n-gram pool keyed by prefix, suffix, route, or traffic segment.',
        'When a later decode state matches a key, the runtime retrieves one or more candidates and verifies them against the target model. It accepts the longest prefix that matches and falls back to ordinary target decode at the first mismatch.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the target-verification invariant. If accepted tokens are exactly the tokens the target path would have produced, then the final output is target-equivalent even though the runtime skipped some serial calls.',
        'The method works best when local text has repeated structure. Tool-call JSON, code syntax, log formats, and markdown boilerplate produce continuations that recur often enough for a bounded pool to earn its memory.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Plain decode costs one target step per emitted token. If a verifier call accepts four tokens at once, three serial target steps can be avoided; if it accepts zero tokens, the proposal path was pure overhead.',
        'The right cost metric is accepted target-equivalent tokens per unit of extra work. Pool memory, verifier latency, candidate branch cleanup, batch interference, and fallback rate all count because they change end-to-end tokens per second and tail latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lookahead fits outputs with local repetition: code completion, tool-call arguments, schema-constrained JSON, logs, report boilerplate, and narrow customer-support templates. The access pattern is many requests that revisit similar short continuations.',
        'It is attractive when a team wants draft-model-like speed without hosting a separate draft model. The pool is inspectable and can be segmented by route, which makes it easier to disable where it stops helping.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on highly novel or evidence-dependent prose where the next tokens are hard to reuse. A pool full of plausible continuations can create many verifier rejections and worse latency than plain decode.',
        'It also fails if branch state leaks. Candidate KV cache entries must stay separate from committed state until verification succeeds, or the runtime can corrupt the sequence while appearing to run faster.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a JSON tool-call route emits 10,000 tokens per minute under plain decode. The pool proposes 4-token continuations, and verification accepts an average of 2.5 tokens on 60 percent of attempts.',
        'Across 1,000 attempts, that is about 1,500 accepted tokens. If verifier overhead equals 300 ordinary token steps, the net saving is about 1,200 token steps. If acceptance falls to 0.2 tokens per attempt on an open-ended writing route, the same machinery becomes a latency tax.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lookahead Decoding at https://arxiv.org/abs/2402.02057 and https://github.com/hao-ai-lab/LookaheadDecoding.',
        'Study next: Multi-Token Decoding, Medusa Tree Attention Candidate Mask Case Study, EAGLE Feature Draft Tree Case Study, Speculative Decoding Runtime Controller Case Study, Speculative Decoding Acceptance Ledger, Prefix Caching RadixAttention, LLM Continuous Batching, KV Cache, and SLO-Aware LLM Request Router Case Study.',
      ],
    },
  ],
};