// Multi-token decoding: reduce autoregressive latency by proposing several
// future tokens per model step, then verify candidates without changing output.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-token-decoding',
  title: 'Multi-Token Decoding',
  category: 'AI & ML',
  summary: 'Medusa heads, tree attention, and Lookahead-style n-gram verification for reducing LLM decode steps.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['medusa heads', 'lookahead decoding'], defaultValue: 'medusa heads' },
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

function medusaGraph(title) {
  return graphState({
    nodes: [
      { id: 'backbone', label: 'backbone LLM', x: 1.0, y: 3.8, note: 'frozen or tuned' },
      { id: 'h1', label: 'head +1', x: 3.2, y: 1.4, note: 'next token' },
      { id: 'h2', label: 'head +2', x: 3.2, y: 3.2, note: 'two ahead' },
      { id: 'h3', label: 'head +3', x: 3.2, y: 5.0, note: 'three ahead' },
      { id: 'tree', label: 'candidate tree', x: 5.7, y: 3.2, note: 'parallel branches' },
      { id: 'verify', label: 'tree attention', x: 7.7, y: 3.2, note: 'one pass check' },
      { id: 'emit', label: 'accepted prefix', x: 9.0, y: 3.2, note: 'advance output' },
    ],
    edges: [
      { id: 'e-b-h1', from: 'backbone', to: 'h1', weight: 'hidden state' },
      { id: 'e-b-h2', from: 'backbone', to: 'h2', weight: 'hidden state' },
      { id: 'e-b-h3', from: 'backbone', to: 'h3', weight: 'hidden state' },
      { id: 'e-h1-tree', from: 'h1', to: 'tree', weight: 'top tokens' },
      { id: 'e-h2-tree', from: 'h2', to: 'tree', weight: 'top tokens' },
      { id: 'e-h3-tree', from: 'h3', to: 'tree', weight: 'top tokens' },
      { id: 'e-tree-verify', from: 'tree', to: 'verify', weight: 'tree mask' },
      { id: 'e-verify-emit', from: 'verify', to: 'emit', weight: 'longest accepted' },
    ],
  }, { title });
}

function lookaheadGraph(title) {
  return graphState({
    nodes: [
      { id: 'state', label: 'current state', x: 0.8, y: 3.8, note: 'prefix' },
      { id: 'ngram1', label: 'n-gram lane A', x: 3.0, y: 1.8, note: 'parallel guess' },
      { id: 'ngram2', label: 'n-gram lane B', x: 3.0, y: 3.8, note: 'parallel guess' },
      { id: 'ngram3', label: 'n-gram lane C', x: 3.0, y: 5.8, note: 'parallel guess' },
      { id: 'verify', label: 'verify', x: 5.8, y: 3.8, note: 'standard LLM logits' },
      { id: 'accept', label: 'accept prefix', x: 8.2, y: 3.8, note: 'exact output' },
    ],
    edges: [
      { id: 'e-s-a', from: 'state', to: 'ngram1', weight: 'Jacobi-style step' },
      { id: 'e-s-b', from: 'state', to: 'ngram2', weight: 'Jacobi-style step' },
      { id: 'e-s-c', from: 'state', to: 'ngram3', weight: 'Jacobi-style step' },
      { id: 'e-a-v', from: 'ngram1', to: 'verify', weight: 'candidates' },
      { id: 'e-b-v', from: 'ngram2', to: 'verify', weight: 'candidates' },
      { id: 'e-c-v', from: 'ngram3', to: 'verify', weight: 'candidates' },
      { id: 'e-v-accept', from: 'verify', to: 'accept', weight: 'matching prefix' },
    ],
  }, { title });
}

function* medusaHeads() {
  yield {
    state: labelMatrix(
      'Autoregressive decoding pays one big pass per token',
      [
        { id: 't1', label: 'token 1' },
        { id: 't2', label: 'token 2' },
        { id: 't3', label: 'token 3' },
        { id: 't4', label: 'token 4' },
      ],
      [
        { id: 'dependency', label: 'dependency' },
        { id: 'bigpass', label: 'big-model pass' },
      ],
      [
        ['needs prompt', 'pass 1'],
        ['needs token 1', 'pass 2'],
        ['needs token 2', 'pass 3'],
        ['needs token 3', 'pass 4'],
      ],
    ),
    highlight: { active: ['t1:bigpass', 't2:bigpass', 't3:bigpass', 't4:bigpass'] },
    explanation: 'Plain LLM decoding is sequential. Each next token depends on the previous token, so the system reads model weights and KV cache again and again. Speculative Decoding uses a draft model. Multi-token decoding asks whether the main model can help predict several future positions itself.',
  };

  yield {
    state: medusaGraph('Medusa attaches extra decoding heads to the backbone'),
    highlight: { active: ['h1', 'h2', 'h3', 'e-b-h1', 'e-b-h2', 'e-b-h3'], compare: ['backbone'] },
    explanation: 'Medusa adds lightweight heads on top of the model hidden state. Each head predicts tokens at a future offset. The backbone can be frozen for a lossless acceleration path, or tuned with the heads for larger speedups at higher training complexity.',
  };

  yield {
    state: medusaGraph('Candidate continuations are verified with tree attention'),
    highlight: { active: ['tree', 'verify', 'e-tree-verify'], found: ['emit'], compare: ['h1', 'h2', 'h3'] },
    explanation: 'The heads produce a small tree of candidate continuations. Tree attention lets the model verify many branches in one pass. The runtime accepts the longest prefix that matches the model distribution under the acceptance rule.',
    invariant: 'The acceleration target is fewer decode iterations, not a different answer.',
  };

  yield {
    state: labelMatrix(
      'Medusa compared with draft-model speculation',
      [
        { id: 'spec', label: 'speculative decoding' },
        { id: 'medusa1', label: 'Medusa-1' },
        { id: 'medusa2', label: 'Medusa-2' },
        { id: 'ops', label: 'operational concern' },
      ],
      [
        { id: 'extra', label: 'extra component' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['separate draft model', 'memory and maintenance'],
        ['heads on frozen LLM', 'simpler deployment'],
        ['heads plus backbone tuning', 'more speed, more risk'],
        ['tree verification', 'scheduler and kernel complexity'],
      ],
    ),
    highlight: { found: ['medusa1:tradeoff'], compare: ['spec:tradeoff', 'medusa2:tradeoff'] },
    explanation: 'Medusa is attractive because it removes the need to maintain a separate draft model. The cost shifts into head training, tree candidate management, and verification kernels.',
  };
}

function* lookaheadDecoding() {
  yield {
    state: lookaheadGraph('Lookahead generates candidate n-grams in parallel'),
    highlight: { active: ['ngram1', 'ngram2', 'ngram3', 'e-s-a', 'e-s-b', 'e-s-c'], compare: ['verify'] },
    explanation: 'Lookahead decoding attacks the same sequential bottleneck without a draft model or extra Medusa heads. It uses parallel candidate n-gram generation, then checks which prefix agrees with standard autoregressive decoding.',
  };

  yield {
    state: labelMatrix(
      'Parallel lanes propose future text',
      [
        { id: 'laneA', label: 'lane A' },
        { id: 'laneB', label: 'lane B' },
        { id: 'laneC', label: 'lane C' },
        { id: 'verify', label: 'verification' },
      ],
      [
        { id: 'proposal', label: 'proposal' },
        { id: 'status', label: 'status' },
      ],
      [
        ['the model can', 'matches 2 tokens'],
        ['the model will', 'matches 1 token'],
        ['the answer is', 'mismatch early'],
        ['standard logits', 'choose longest valid prefix'],
      ],
    ),
    highlight: { active: ['laneA:proposal', 'laneB:proposal', 'laneC:proposal'], found: ['verify:status'] },
    explanation: 'The proposals are useful only when they agree with what the model would have produced token by token. Verification protects exactness. Bad lanes cost compute but do not change the output.',
    invariant: 'Accepted tokens must be consistent with ordinary autoregressive decoding.',
  };

  yield {
    state: lookaheadGraph('Verification collapses many guesses into one advance'),
    highlight: { active: ['verify', 'e-a-v', 'e-b-v', 'e-c-v'], found: ['accept', 'e-v-accept'] },
    explanation: 'The win comes from trading more parallel work inside a step for fewer total decode steps. That fits modern accelerators when autoregressive generation is memory-bandwidth bound and underuses parallel compute.',
  };

  yield {
    state: labelMatrix(
      'Choosing a multi-token decoding strategy',
      [
        { id: 'draft', label: 'draft-model speculation' },
        { id: 'medusa', label: 'Medusa' },
        { id: 'lookahead', label: 'Lookahead' },
        { id: 'none', label: 'plain decode' },
      ],
      [
        { id: 'bestwhen', label: 'best when' },
        { id: 'pain', label: 'pain point' },
      ],
      [
        ['small draft agrees often', 'extra model memory'],
        ['can train heads', 'tree verification'],
        ['want no aux model', 'more per-step FLOPs'],
        ['latency less important', 'wastes parallelism'],
      ],
    ),
    highlight: { found: ['draft:bestwhen', 'medusa:bestwhen', 'lookahead:bestwhen'], compare: ['none:pain'] },
    explanation: 'All of these methods are serving optimizations around the same bottleneck. The right choice depends on model family, latency target, memory headroom, traffic shape, and how much training or kernel work the team can support.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'medusa heads') yield* medusaHeads();
  else if (view === 'lookahead decoding') yield* lookaheadDecoding();
  else throw new InputError('Pick a multi-token decoding view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Multi-token decoding is a family of LLM inference techniques that try to accept more than one output token per expensive decode iteration. Speculative Decoding does this with a separate draft model. Speculative Decoding Acceptance Ledger shows the production data structure behind acceptance, rejection, and rollback. Medusa does it with extra future-token heads attached to the main model. Lookahead decoding does it with parallel n-gram candidates and verification. Early-Exit Transformer Layer Skipping shows the related self-speculative path where shallow layers draft and deeper layers verify.',
        'The motivation is the same as KV Cache and Transformer Inference Roofline: decode is often memory-bandwidth bound and sequential. Modern GPUs have parallel compute available, but the next-token dependency prevents ordinary decoding from using it fully.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Medusa attaches multiple lightweight decoding heads to the last hidden state of the LLM. The heads predict future token positions. Candidate tokens are arranged into a tree and verified with tree attention, so one model pass can check many candidate continuations. The system accepts the longest valid prefix and then repeats.',
        'Lookahead decoding does not require a separate draft model or new heads. It generates candidate n-grams in parallel and verifies them against the model. It trades extra per-step computation for fewer sequential steps. The acceleration is useful when the added parallel work is cheaper than another full decode iteration.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The complexity shifts from the model equation into the serving runtime. Medusa needs head training, candidate-tree construction, tree attention masks, acceptance logic, and careful integration with batching. Lookahead needs parallel candidate generation, verification logic, and enough accelerator headroom to make the extra work worthwhile.',
        'These methods do not replace PagedAttention, Continuous Batching, quantization, or kernel optimization. They compose with them. A production stack still has to manage KV memory, tail latency, batch admission, prefix reuse, and fallback paths when acceptance rates are low.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Multi-token decoding is relevant for chat APIs, coding agents, autocomplete, tool-using agents, and any user-facing generation product where time per output token dominates perceived latency. It is especially interesting for long responses, code completion, and workloads where the model often emits predictable continuations.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'More heads or more candidate lanes do not automatically mean faster generation. If acceptance is low, the runtime burns compute on rejected candidates. If candidate verification is poorly integrated, it can fight continuous batching or increase tail latency. The right metric is not candidates proposed; it is accepted tokens per expensive model pass at the target latency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Medusa at https://arxiv.org/abs/2401.10774, Lookahead Decoding at https://arxiv.org/abs/2402.02057, and Speculative Decoding at https://arxiv.org/abs/2211.17192. Study Speculative Decoding, Speculative Decoding Acceptance Ledger, Early-Exit Transformer Layer Skipping, KV Cache, LLM Continuous Batching, LLM Serving: PagedAttention, Beam Search vs Greedy, Transformer Inference Roofline, and LLM Inference Scaling Playbook next.',
      ],
    },
  ],
};
