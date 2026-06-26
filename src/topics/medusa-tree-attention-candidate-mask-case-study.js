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
      heading: 'How to read the animation',
      paragraphs: [
        'The heads-to-tree view starts with a language model prefix, which is the text already generated. Medusa heads are small prediction heads attached to the main model; each head proposes tokens for a future position. Active nodes are candidate tokens being added to the tree, and found paths are continuations that remain eligible for verification.',
        {type:'callout', text:'Medusa speeds decoding only when the candidate tree preserves ancestry and the target model verifies the accepted prefix.'},
        'The mask view shows which candidate tokens may attend to which earlier tokens. Attention means reading information from another token representation. The safe rule is that a node may read the original prefix and its own ancestors, but not sibling branches.'
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive language models normally generate one token per expensive forward pass. Autoregressive means each new token depends on the earlier tokens. That makes decoding slow when the model is large and the answer is long.',
        'Medusa exists to reduce the number of target-model passes. It asks cheap extra heads to propose several future tokens, packs those proposals into a tree, and verifies them with the original model. The target model still decides what can be committed.'
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious speedup is to ask the model for several next tokens at once. Add a head for token plus one, another for token plus two, and keep the best token from each head. If all heads are accurate, one pass could emit several tokens.',
        'That approach is tempting because it treats future positions like independent columns. It also matches the shape of a table: offset 1 candidates, offset 2 candidates, and offset 3 candidates. The table looks efficient until the dependencies matter.'
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A future token is only meaningful after a particular earlier future token. The best offset-3 token after branch A may be wrong after branch B. A flat table mixes incompatible futures and can verify a sequence that no real autoregressive path would produce.',
        'The verifier also needs isolation between branches. If branch A can attend to a token from branch B, the packed computation leaks information across alternatives. The result would no longer match ordinary next-token decoding.'
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent proposals as a candidate tree. A candidate tree is a rooted structure where each path from the prefix root to a node is one possible continuation. The parent pointer records which earlier speculative token a candidate depends on.',
        'Then verify the tree with an attention mask that encodes ancestry. The mask lets one target-model pass evaluate many branches while preserving the rule that each branch sees only its own history. Speed comes from accepted prefix length, not from drawing a large tree.'
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At a decode step, the target model computes hidden state for the current prefix. Medusa heads read that state and propose top candidates for future offsets. The runtime combines those candidates into a tree with node ids, token ids, depth, parent id, and score.',
        'The verifier runs the target model over the packed tree using the tree-attention mask. It compares the target output against candidate tokens along each path. The runtime accepts the longest valid prefix and discards branches after the first mismatch.',
        'Accepted tokens are appended to the output and to the key-value cache, which stores attention state for reuse. If no useful token is accepted, the system falls back to ordinary one-token decoding. The next step starts from the verified prefix, not from the rejected tree.'
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on verification by the target model. The Medusa heads propose; they do not commit. A token becomes output only if the target model would accept it under the same prefix history.',
        'The mask preserves the autoregressive invariant. For every candidate path, each token sees the same earlier tokens it would have seen if that path were decoded separately. Because siblings cannot leak into each other, packed verification is equivalent to checking the branches one path at a time.'
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The extra heads are cheap compared with the target model, but they are not free. A tree with 40 candidate nodes increases verification work, mask construction, memory traffic, and key-value cache bookkeeping. If the target accepts only one token, the method may add latency.',
        'The useful metric is accepted tokens per target pass. If ordinary decoding emits 1 token per pass and Medusa averages 2.4 accepted tokens per pass, it can reduce target passes for a 120-token answer from 120 to about 50. If acceptance falls to 1.1, the saved passes may not cover the overhead.',
        'When the maximum tree depth doubles, the possible branch count can grow quickly if width is not capped. Real systems set budgets for depth, width, verification time, and fallback rate. The controller matters as much as the candidate generator.'
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Medusa-style decoding is useful for inference serving where output text has predictable local structure. Low-temperature chat, code completion, boilerplate generation, and constrained formats often accept short speculative prefixes. The access pattern is repeated decode steps where the same large model would otherwise be called once per token.',
        'It is also a clean teaching case for speculative execution. The system proposes multiple futures cheaply, represents their dependencies exactly, verifies with the authority, and logs whether the proposal path saved work. That same pattern appears in CPUs, databases, and distributed systems.'
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when local futures are hard to predict. High-temperature sampling, rare languages, tool-call boundaries, and prompts outside the head training distribution can reject at the first token. A wider tree then spends more verification work without adding accepted tokens.',
        'It can also fail through implementation details. A wrong mask silently changes semantics. Key-value cache updates become subtle when several tokens commit at once. Aggregate speedup can hide p95 latency regressions if wide trees hurt batching.'
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose ordinary decoding needs 12 forward passes to emit 12 tokens. A Medusa setup uses three future heads with two candidates at each step and builds a 10-node tree after pruning. Verification costs 1.35 times a normal pass because the packed tree is larger than one token.',
        'If the verifier accepts an average of 3 tokens per pass, the 12-token answer needs 4 target passes. The compute cost is about 4 times 1.35, or 5.4 normal-pass units, plus cheap head overhead. That is better than 12 normal passes.',
        'If acceptance drops to 1 token per pass, the same answer costs about 12 times 1.35, or 16.2 normal-pass units. The tree is then a tax, not a speedup. This is why production systems track acceptance by depth and disable the method on bad traffic slices.'
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads, https://arxiv.org/abs/2401.10774. Study speculative decoding, EAGLE, attention masks, key-value cache management, continuous batching, and transformer inference roofline analysis next.'
      ],
    },
  ],
};
