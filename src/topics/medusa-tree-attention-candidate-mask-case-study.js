// Medusa decoding: attach future-token heads, build a candidate tree, and
// verify branches with a tree-attention mask.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'medusa-tree-attention-candidate-mask-case-study',
  title: 'Medusa Tree Attention Candidate Mask Case Study',
  category: 'AI & ML',
  summary: 'A deep Medusa decoding case study: future-token heads, candidate trees, tree-attention masks, longest-prefix acceptance, and serving metrics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['heads to tree', 'tree attention mask'], defaultValue: 'heads to tree' },
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
      { id: 'lm', label: 'LM', x: 0.7, y: 3.4, note: 'backbone' },
      { id: 'h1', label: '+1', x: 2.4, y: 1.5, note: 'head' },
      { id: 'h2', label: '+2', x: 2.4, y: 3.4, note: 'head' },
      { id: 'h3', label: '+3', x: 2.4, y: 5.3, note: 'head' },
      { id: 'top', label: 'top', x: 4.0, y: 3.4, note: 'tokens' },
      { id: 'tree', label: 'tree', x: 5.5, y: 3.4, note: 'paths' },
      { id: 'mask', label: 'mask', x: 7.0, y: 2.1, note: 'attn' },
      { id: 'ver', label: 'ver', x: 7.0, y: 4.8, note: 'target' },
      { id: 'out', label: 'out', x: 8.7, y: 3.4, note: 'prefix' },
      { id: 'log', label: 'log', x: 9.8, y: 3.4, note: 'acc' },
    ],
    edges: [
      { id: 'e-lm-h1', from: 'lm', to: 'h1' },
      { id: 'e-lm-h2', from: 'lm', to: 'h2' },
      { id: 'e-lm-h3', from: 'lm', to: 'h3' },
      { id: 'e-h1-top', from: 'h1', to: 'top' },
      { id: 'e-h2-top', from: 'h2', to: 'top' },
      { id: 'e-h3-top', from: 'h3', to: 'top' },
      { id: 'e-top-tree', from: 'top', to: 'tree' },
      { id: 'e-tree-mask', from: 'tree', to: 'mask' },
      { id: 'e-tree-ver', from: 'tree', to: 'ver' },
      { id: 'e-mask-ver', from: 'mask', to: 'ver' },
      { id: 'e-ver-out', from: 'ver', to: 'out' },
      { id: 'e-out-log', from: 'out', to: 'log' },
    ],
  }, { title });
}

function* headsToTree() {
  yield {
    state: medusaGraph('Future-token heads create cheap proposals'),
    highlight: { active: ['lm', 'h1', 'h2', 'h3', 'e-lm-h1', 'e-lm-h2', 'e-lm-h3'], found: ['top'] },
    explanation: 'Medusa keeps the target backbone and adds lightweight heads that predict future offsets. The heads turn one hidden state into several candidate next-token distributions.',
    invariant: 'Medusa accelerates by reducing target iterations, not by trusting unverified heads.',
  };

  yield {
    state: labelMatrix(
      'Head output table',
      [
        { id: 'h1', label: '+1' },
        { id: 'h2', label: '+2' },
        { id: 'h3', label: '+3' },
        { id: 'h4', label: '+4' },
      ],
      [
        { id: 'a', label: 'top1' },
        { id: 'b', label: 'top2' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['the', 'a', 'yes'],
        ['next', 'same', 'yes'],
        ['word', 'token', 'some'],
        ['.', ',', 'gate'],
      ],
    ),
    highlight: { active: ['h1:keep', 'h2:keep', 'h3:keep'], compare: ['h4:keep'] },
    explanation: 'Each head contributes a small top-k set. The tree builder combines those sets into candidate continuations, while pruning unlikely or duplicate branches before target verification.',
  };

  yield {
    state: medusaGraph('Candidate tree is verified in one target pass'),
    highlight: { active: ['top', 'tree', 'mask', 'ver', 'e-top-tree', 'e-tree-mask', 'e-tree-ver', 'e-mask-ver'], found: ['out'] },
    explanation: 'Tree attention lets the target model verify several branch paths at once. The acceptance rule chooses the longest valid prefix, then writes accepted-token metrics into the ledger.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'tree width', min: 1, max: 8 }, y: { label: 'accepted tokens per pass', min: 0, max: 4 } },
      series: [
        { id: 'small', label: 'low temp', points: [{ x: 1, y: 1.0 }, { x: 2, y: 1.7 }, { x: 4, y: 2.6 }, { x: 6, y: 3.0 }, { x: 8, y: 3.1 }] },
        { id: 'hot', label: 'high temp', points: [{ x: 1, y: 1.0 }, { x: 2, y: 1.3 }, { x: 4, y: 1.6 }, { x: 6, y: 1.7 }, { x: 8, y: 1.6 }] },
      ],
      markers: [
        { id: 'knee', x: 4.2, y: 2.6, label: 'knee' },
      ],
    }),
    highlight: { active: ['small', 'knee'], compare: ['hot'] },
    explanation: 'Wider trees help only while the extra branches keep getting accepted. Low-temperature or repetitive traffic often benefits; high-temperature traffic rejects earlier and wastes tree work.',
  };
}

function* treeAttentionMask() {
  yield {
    state: medusaGraph('Tree attention mask preserves ancestry'),
    highlight: { active: ['tree', 'mask', 'ver', 'e-tree-mask', 'e-mask-ver'], compare: ['h1', 'h2', 'h3'], found: ['out'] },
    explanation: 'A tree mask allows each proposed token to attend to its ancestors, not to tokens from sibling branches. That makes a batch of branches behave like many valid continuations checked together.',
  };

  yield {
    state: labelMatrix(
      'Tree mask sketch',
      [
        { id: 'r0', label: 'root' },
        { id: 'a1', label: 'a1' },
        { id: 'a2', label: 'a2' },
        { id: 'b1', label: 'b1' },
        { id: 'b2', label: 'b2' },
      ],
      [
        { id: 'root', label: 'root' },
        { id: 'a1', label: 'a1' },
        { id: 'a2', label: 'a2' },
        { id: 'b1', label: 'b1' },
        { id: 'b2', label: 'b2' },
      ],
      [
        ['yes', '', '', '', ''],
        ['yes', 'yes', '', '', ''],
        ['yes', 'yes', 'yes', '', ''],
        ['yes', '', '', 'yes', ''],
        ['yes', '', '', 'yes', 'yes'],
      ],
    ),
    highlight: { active: ['a2:root', 'a2:a1', 'a2:a2', 'b2:root', 'b2:b1', 'b2:b2'], compare: ['a2:b1', 'b2:a1'] },
    explanation: 'The mask is a small ancestry matrix. A token on branch A can see root and earlier A tokens, but not branch B. Without this structure, branches contaminate each other.',
  };

  yield {
    state: labelMatrix(
      'Complete case: code boilerplate',
      [
        { id: 'a', label: 'step1' },
        { id: 'b', label: 'step2' },
        { id: 'c', label: 'step3' },
        { id: 'd', label: 'ship' },
      ],
      [
        { id: 'prop', label: 'prop' },
        { id: 'ver', label: 'ver' },
        { id: 'act', label: 'act' },
      ],
      [
        ['def', 'ok', 'keep'],
        ['name', 'ok', 'keep'],
        ['(:', 'bad', 'stop'],
        ['defn', 'pass', 'emit'],
      ],
    ),
    highlight: { active: ['a:act', 'b:act', 'd:act'], removed: ['c:act'], found: ['d:ver'] },
    explanation: 'In a predictable code-completion prefix, Medusa may accept several boilerplate tokens, then stop when punctuation diverges. The ledger records accepted length and the stopped branch.',
  };

  yield {
    state: medusaGraph('Serving ledger owns rollback and fallback'),
    highlight: { active: ['ver', 'out', 'log', 'e-ver-out', 'e-out-log'], found: ['lm'], compare: ['tree'] },
    explanation: 'Production Medusa needs a fallback path. If acceptance drops, tree verification slows, or masks fail, the serving controller should return to ordinary decoding and keep the acceptance history for routing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'heads to tree') yield* headsToTree();
  else if (view === 'tree attention mask') yield* treeAttentionMask();
  else throw new InputError('Pick a Medusa tree-attention view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Medusa is a multi-token decoding method that attaches future-token heads to an existing target model, builds a candidate tree from those heads, and verifies candidate branches with tree attention. It avoids maintaining a separate draft model, but it adds head training and runtime tree logic.',
        'The overview page Multi-Token Decoding introduces Medusa. This module zooms into the data structures: head output tables, candidate trees, ancestry masks, accepted-prefix ledgers, and fallback gates.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The runtime stores one row per Medusa head: offset, top-k tokens, probabilities, branch id, parent id, and pruning reason. The tree builder turns those rows into candidate paths. The tree-attention mask is an ancestry matrix that prevents sibling branches from attending to each other.',
        'The serving ledger stores tree width, accepted prefix length, target verification time, rejected branch id, KV append range, and fallback reason. Those metrics decide whether Medusa stays enabled for a traffic segment.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each decode step, the backbone computes a hidden state. Medusa heads predict future offsets from that state. Candidate tokens are combined into a small tree. A tree mask lets the target verify multiple possible continuations in one pass, then the runtime accepts the longest valid prefix.',
        'Medusa-1 keeps the backbone frozen and trains only the heads, which is operationally simpler. Medusa-2 tunes the backbone and heads together for higher speedup, but carries more model-risk and release-complexity.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A code assistant often emits predictable function boilerplate. Medusa heads propose `def`, a function name, punctuation, and indentation. Tree verification accepts the first two tokens but rejects a punctuation branch. The system emits the accepted prefix, discards the sibling branches, and continues ordinary or Medusa decoding from the verified state.',
        'The useful artifact is not just the emitted text. The ledger shows tree width, branch shape, accepted length, rejected token, verification latency, and fallback status. That is what lets a serving team tune the method without guessing.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Medusa can lose if the candidate tree is too wide, if traffic is high-temperature, if tree verification fights batching, or if head quality is poor. It can also hide tail latency if teams report only average accepted tokens per pass.',
        'The tree mask is correctness-critical. If branch tokens can attend to siblings, the verifier no longer checks valid continuations. Treat mask construction like a core data structure, not a rendering detail.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Medusa at https://arxiv.org/abs/2401.10774 and https://github.com/FasterDecoding/Medusa, speculative decoding at https://arxiv.org/abs/2211.17192, vLLM speculative decoding at https://docs.vllm.ai/en/stable/features/speculative_decoding/, and NVIDIA Triton speculative decoding at https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/tutorials/Feature_Guide/Speculative_Decoding/README.html.',
        'Study next: Speculative Decoding Acceptance Ledger, Multi-Token Decoding, Lookahead Decoding N-Gram Pool Case Study, EAGLE Feature Draft Tree Case Study, LLM Continuous Batching, and Transformer Inference Roofline.',
      ],
    },
  ],
};
