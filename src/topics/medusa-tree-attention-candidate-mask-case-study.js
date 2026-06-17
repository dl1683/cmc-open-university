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
        'Medusa is a multi-token decoding method for large language models. It attaches several lightweight heads to a target model so one forward pass can propose tokens for future positions. Those proposals are arranged into a candidate tree and verified with a tree-attention mask. The goal is to emit more than one token per expensive target iteration while preserving the target model contract through verification.',
        'The method is important because it shows that speculative decoding does not always require a separate draft model. Medusa keeps the backbone and adds future-token heads. That makes the data structures especially clear: head output tables, top-k candidate pools, parent-linked trees, ancestry masks, accepted-prefix ledgers, and fallback controls. A curriculum should teach it as a systems mechanism, not as a magic speedup label.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach to faster decoding is to ask the model for several future tokens at once. A normal language model head predicts the next token, so one might add heads that predict token plus one, token plus two, and token plus three. If these heads are good, the system can skip several ordinary iterations. The wall is that future-token predictions are conditional on previous future tokens. A token at offset three is only meaningful for a specific path through offsets one and two.',
        'If the runtime treats the head outputs as independent columns, it mixes incompatible futures. The top token for offset three may only make sense after one offset-one token, while another branch needs a different offset-three token. A flat table cannot represent this ancestry. The serving system needs a tree of candidate continuations and a verifier that can test those continuations without letting sibling branches leak information into each other.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to turn multi-head future predictions into a tree and verify the tree in one target-model operation. Each path through the tree is a possible continuation of the current prefix. A candidate token may attend to the prefix and its own ancestors, but not to tokens from sibling branches. The tree-attention mask encodes that rule as a data structure the model can use during verification.',
        'The other insight is that speedup comes from accepted prefix length, not from the number of candidates drawn. A large tree that rejects at the first token is worse than a small tree that reliably accepts two or three tokens. Medusa should therefore be evaluated as a proposal-and-verification control loop. Head quality, tree shape, mask correctness, and acceptance logging all matter.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The first data structure is the head output table. For each future offset, the runtime stores top-k token ids, probabilities or logits, and sometimes filters for duplicate or invalid tokens. The second is the candidate tree. Each node stores token id, depth, parent id, score, source head, and pruning reason. The root is the current prefix. A path from root to a node is a proposed continuation.',
        'The tree-attention mask is the correctness-critical structure. In matrix form, a node may attend to the original prefix and the nodes on its own ancestor path. It may not attend to tokens from sibling branches or cousin branches. The accepted-prefix ledger is the operational structure. It records tree width, maximum depth, accepted length, rejected node, target verification time, committed KV range, and fallback reason.',
      ],
    },
    {
      heading: 'Mechanism step by step',
      paragraphs: [
        'At a decode step, the target backbone computes hidden state for the current prefix. Medusa heads attached to that state produce distributions for several future offsets. The runtime takes a small top-k set from those heads and combines the candidates into a tree. It may prune low-probability branches, remove duplicates, or cap depth and width to fit a latency budget.',
        'The verifier then runs with the tree-attention mask. Each proposed token is evaluated as if it belonged to its own valid continuation. After verification, the runtime accepts the longest prefix that agrees with the target rule and discards the rest. Accepted tokens are appended to the output and target KV state. If no useful prefix is accepted, the system falls back to ordinary decoding for that step. The next step repeats from the verified state, not from the speculative tree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Medusa works when the added heads are good enough to predict short future continuations and the verifier can check a compact tree faster than several separate target iterations. The backbone has already built a rich representation of the prefix. Future-token heads exploit that representation cheaply. The tree lets the runtime keep several plausible futures alive until the target chooses which one survives.',
        'The mask makes the trick valid. Without it, tokens from different branches would share information and the verifier would no longer be evaluating real continuations. With the mask, branch A and branch B can be packed into one computation while remaining semantically separate. This is a classic data-structure lesson: the ancestry relation is not decoration. It is the invariant that makes batching possible.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Medusa is useful for decode-heavy serving where many requests produce predictable local continuations. Code completion, structured text, repetitive assistant phrasing, low-temperature chat, and boilerplate generation can benefit because short futures often have high agreement. It can also be easier to operate than a separate draft model because the future heads are attached to the target model family.',
        'It is a strong teaching case for systems builders because every part has a measurable role. Head training affects proposal quality. Tree construction affects candidate coverage. The mask preserves correctness. The ledger exposes whether the method is saving target iterations or only adding work. The fallback path keeps the serving system stable when a slice of traffic rejects too often.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Medusa fails when candidate quality is low or traffic is too uncertain. High-temperature sampling, open-ended creative text, tool-call boundaries, rare languages, and domains not covered by head training can all reduce accepted length. Wider trees do not automatically solve this. They can increase verification cost, memory use, and scheduling pressure while accepting the same short prefix.',
        'It can also fail through systems details. Tree verification may interfere with batching. Mask construction bugs can invalidate verification. KV updates can become subtle when several tokens are accepted at once. Average accepted tokens per pass can look healthy while p95 latency worsens. Medusa-2 style joint tuning may improve speed but increases release risk because the backbone itself changes.',
      ],
    },
    {
      heading: 'Operational and evaluation signals',
      paragraphs: [
        'Track accepted prefix length, acceptance by depth, tree width, maximum depth, verifier latency, head computation overhead, target iterations saved, fallback rate, mask build time, KV append errors, p50 and p95 latency, throughput under batching, and memory overhead. Slice the results by temperature, language, task type, output length, and model version. A single aggregate hides the traffic where Medusa should be disabled.',
        'A good acceptance ledger lets engineers answer concrete questions. Which heads produce useful tokens? Which depths are mostly rejected? Which branch shapes waste verification? Which prompt classes trigger fallback? Did a new model checkpoint shift acceptance? Did a mask optimization change outputs? This ledger is also the bridge to curriculum topics such as speculative decoding acceptance, calibration, tree masks, and inference rooflines.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study the Medusa paper and implementation, then compare it with classic speculative decoding, EAGLE, lookahead decoding, and multi-token prediction. For systems context, study KV cache management, continuous batching, attention masks, tensor shapes, and transformer inference roofline analysis. Serving documentation from vLLM and Triton is useful because it shows how speculative methods interact with real runtime constraints.',
        'For data structures, focus on trees, matrices, masks, append-only ledgers, rank tables, and controller thresholds. Medusa is a compact example of a broader pattern: propose many possible futures cheaply, represent their dependencies exactly, verify them with the authoritative model, and keep the measurements needed to decide when the trick is worth using.',
      ],
    },
  ],
};
