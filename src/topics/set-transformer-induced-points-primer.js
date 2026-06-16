// Set Transformer: attention over unordered sets, with trainable inducing
// points that reduce self-attention from quadratic to linear in set size.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'set-transformer-induced-points-primer',
  title: 'Set Transformer Inducing Points',
  category: 'Papers',
  summary: 'Permutation-aware attention for unordered sets: SAB models element interactions, ISAB uses inducing points, and PMA pools set summaries with seed queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['set symmetry', 'inducing points'], defaultValue: 'set symmetry' },
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

function sabGraph(title) {
  return graphState({
    nodes: [
      { id: 'set', label: 'set X', x: 0.8, y: 3.8, note: 'no order' },
      { id: 'embed', label: 'embed', x: 2.4, y: 3.8, note: 'rows' },
      { id: 'sab', label: 'SAB', x: 4.1, y: 3.8, note: 'self attn' },
      { id: 'ffn', label: 'FFN', x: 5.8, y: 3.8, note: 'per row' },
      { id: 'out', label: 'set Y', x: 7.5, y: 3.8, note: 'same N' },
      { id: 'perm', label: 'permute', x: 4.1, y: 5.7, note: 'same fn' },
    ],
    edges: [
      { id: 'e-set-embed', from: 'set', to: 'embed', weight: 'items' },
      { id: 'e-embed-sab', from: 'embed', to: 'sab', weight: 'Q,K,V' },
      { id: 'e-sab-ffn', from: 'sab', to: 'ffn', weight: 'mix' },
      { id: 'e-ffn-out', from: 'ffn', to: 'out', weight: 'rows' },
      { id: 'e-set-perm', from: 'set', to: 'perm', weight: 'shuffle' },
      { id: 'e-perm-out', from: 'perm', to: 'out', weight: 'reorder' },
    ],
  }, { title });
}

function isabGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'set X', x: 0.7, y: 3.8, note: 'N rows' },
      { id: 'i', label: 'I pts', x: 2.5, y: 2.4, note: 'm rows' },
      { id: 'read', label: 'read X', x: 4.2, y: 2.4, note: 'I as Q' },
      { id: 'h', label: 'H', x: 5.9, y: 2.4, note: 'm state' },
      { id: 'write', label: 'write X', x: 5.9, y: 5.1, note: 'X as Q' },
      { id: 'y', label: 'set Y', x: 8.1, y: 3.8, note: 'N rows' },
    ],
    edges: [
      { id: 'e-x-read', from: 'x', to: 'read', weight: 'K,V' },
      { id: 'e-i-read', from: 'i', to: 'read', weight: 'Q' },
      { id: 'e-read-h', from: 'read', to: 'h', weight: 'm x N' },
      { id: 'e-x-write', from: 'x', to: 'write', weight: 'Q' },
      { id: 'e-h-write', from: 'h', to: 'write', weight: 'K,V' },
      { id: 'e-write-y', from: 'write', to: 'y', weight: 'N x m' },
    ],
  }, { title });
}

function* setSymmetry() {
  yield {
    state: labelMatrix(
      'Set tasks do not care about row order',
      [
        { id: 'mil', label: 'MIL' },
        { id: 'points', label: '3D' },
        { id: 'fewshot', label: 'few' },
        { id: 'cluster', label: 'cluster' },
        { id: 'events', label: 'logs' },
      ],
      [
        { id: 'input', label: 'kind' },
        { id: 'need', label: 'goal' },
        { id: 'bad', label: 'trap' },
      ],
      [
        ['inst', 'label', 'order'],
        ['pts', 'shape', 'scan'],
        ['shots', 'class', 'order'],
        ['items', 'center', 'idx'],
        ['events', 'summary', 'time'],
      ],
    ),
    highlight: { active: ['mil:need', 'points:need', 'fewshot:need'], compare: ['mil:bad', 'points:bad'] },
    explanation: 'A set model should not change its answer just because the rows were shuffled. Set Transformer starts from that constraint: model interactions among elements without pretending the input order is meaningful.',
  };

  yield {
    state: sabGraph('Self-attention block is permutation equivariant'),
    highlight: { active: ['sab', 'e-embed-sab', 'e-sab-ffn'], found: ['out'], compare: ['perm'] },
    explanation: 'A Self-Attention Block applies multi-head attention to all elements and then a per-row feed-forward layer. If you shuffle the set, the output rows shuffle the same way, which is permutation equivariance.',
    invariant: 'Same elements plus a different row order should produce the same set of output rows.',
  };

  yield {
    state: labelMatrix(
      'Permutation behavior',
      [
        { id: 'orig', label: 'A,B,C' },
        { id: 'swap', label: 'C,A,B' },
        { id: 'bad', label: 'RNN' },
        { id: 'sab', label: 'SAB' },
      ],
      [
        { id: 'hidden', label: 'hidden' },
        { id: 'answer', label: 'answer' },
      ],
      [
        ['Y_A,Y_B,Y_C', 'same set'],
        ['Y_C,Y_A,Y_B', 'same set'],
        ['order path', 'can drift'],
        ['row-wise', 'stable'],
      ],
    ),
    highlight: { active: ['orig:answer', 'swap:answer', 'sab:answer'], compare: ['bad:answer'] },
    explanation: 'Equivariance means the representation follows the permutation. Invariance comes later when a pooling decoder turns the set of rows into a fixed answer.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'x', label: 'set Y', x: 0.8, y: 3.8, note: 'N rows' },
        { id: 'seed1', label: 'seed 1', x: 2.8, y: 2.7, note: 'query' },
        { id: 'seed2', label: 'seed 2', x: 2.8, y: 4.9, note: 'query' },
        { id: 'pma', label: 'PMA', x: 4.8, y: 3.8, note: 'pool' },
        { id: 'slot1', label: 'slot 1', x: 6.8, y: 2.7, note: 'summary' },
        { id: 'slot2', label: 'slot 2', x: 6.8, y: 4.9, note: 'summary' },
        { id: 'head', label: 'head', x: 8.8, y: 3.8, note: 'answer' },
      ],
      edges: [
        { id: 'e-x-pma', from: 'x', to: 'pma', weight: 'K,V' },
        { id: 'e-seed1-pma', from: 'seed1', to: 'pma', weight: 'Q' },
        { id: 'e-seed2-pma', from: 'seed2', to: 'pma', weight: 'Q' },
        { id: 'e-pma-slot1', from: 'pma', to: 'slot1', weight: 'out' },
        { id: 'e-pma-slot2', from: 'pma', to: 'slot2', weight: 'out' },
        { id: 'e-slot1-head', from: 'slot1', to: 'head', weight: 'read' },
        { id: 'e-slot2-head', from: 'slot2', to: 'head', weight: 'read' },
      ],
    }, { title: 'Pooling by multihead attention uses seed queries' }),
    highlight: { active: ['seed1', 'seed2', 'pma', 'slot1', 'slot2'], found: ['head'], compare: ['x'] },
    explanation: 'Pooling by Multihead Attention gives the decoder one or more learned seed queries. Those seeds attend to the encoded set and produce fixed output slots, making the final prediction permutation invariant.',
  };

  yield {
    state: labelMatrix(
      'Set Transformer blocks',
      [
        { id: 'mab', label: 'MAB' },
        { id: 'sab', label: 'SAB' },
        { id: 'isab', label: 'ISAB' },
        { id: 'pma', label: 'PMA' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['attn block', 'X,Y -> X'],
        ['self attn', 'N -> N'],
        ['induce', 'N -> N'],
        ['pool', 'N -> k'],
      ],
    ),
    highlight: { active: ['sab:role', 'pma:role'], found: ['isab:role'] },
    explanation: 'The architecture is built from a few reusable structures. MAB is the attention primitive, SAB models all pairwise set interactions, ISAB approximates those interactions through inducing points, and PMA pools to fixed slots.',
  };

  yield {
    state: labelMatrix(
      'Case-study uses',
      [
        { id: 'mil', label: 'MIL' },
        { id: 'cloud', label: '3D cloud' },
        { id: 'amort', label: 'amort inf' },
        { id: 'few', label: 'few-shot' },
        { id: 'cluster', label: 'cluster' },
      ],
      [
        { id: 'set', label: 'set item' },
        { id: 'output', label: 'output' },
      ],
      [
        ['instances', 'bag class'],
        ['points', 'object'],
        ['samples', 'params'],
        ['examples', 'class'],
        ['members', 'centers'],
      ],
    ),
    highlight: { active: ['mil:output', 'cloud:output', 'cluster:output'], compare: ['few:set'] },
    explanation: 'The paper evaluates the pattern on set-shaped tasks such as multiple-instance learning, point clouds, amortized clustering, and few-shot classification. The shared abstraction is a bag of elements plus an order-free answer.',
  };
}

function* inducingPoints() {
  yield {
    state: plotState({
      axes: { x: { label: 'set size N', min: 0, max: 100 }, y: { label: 'attention cost', min: 0, max: 105 } },
      series: [
        { id: 'sab', label: 'SAB N^2', points: [
          { x: 10, y: 1 }, { x: 25, y: 6 }, { x: 50, y: 25 }, { x: 75, y: 56 }, { x: 100, y: 100 },
        ] },
        { id: 'isab', label: 'ISAB Nm', points: [
          { x: 10, y: 8 }, { x: 25, y: 18 }, { x: 50, y: 36 }, { x: 75, y: 54 }, { x: 100, y: 72 },
        ] },
      ],
      markers: [
        { id: 'm', x: 62, y: 45, label: 'm fixed' },
      ],
    }),
    highlight: { active: ['isab', 'm'], compare: ['sab'] },
    explanation: 'A full self-attention block compares every set element with every other element. ISAB introduces m learned inducing points, reducing the attention pattern from N by N to two N by m passes when m is much smaller than N.',
  };

  yield {
    state: isabGraph('ISAB reads through inducing points'),
    highlight: { active: ['i', 'read', 'h', 'write'], found: ['y'], compare: ['x'] },
    explanation: 'ISAB is a two-stage bottleneck. First, inducing points query the input set and form m summary states. Then the original set elements query those summary states, letting each row receive global information without a full N by N matrix.',
    invariant: 'The inducing points are learned parameters, not input elements.',
  };

  yield {
    state: labelMatrix(
      'Two attention passes',
      [
        { id: 'pass1', label: 'pass 1' },
        { id: 'pass2', label: 'pass 2' },
        { id: 'total', label: 'total' },
      ],
      [
        { id: 'query', label: 'Q' },
        { id: 'keyval', label: 'K,V' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['I', 'X', 'mN'],
        ['X', 'H', 'Nm'],
        ['both', 'bottleneck', '2Nm'],
      ],
    ),
    highlight: { active: ['pass1:cost', 'pass2:cost', 'total:cost'], compare: ['total:keyval'] },
    explanation: 'The shape accounting is the data structure. Pass one uses inducing points as queries over the set. Pass two uses set rows as queries over the induced states. The full N by N table never materializes.',
  };

  yield {
    state: labelMatrix(
      'Choosing number of inducing points',
      [
        { id: 'tiny', label: 'tiny m' },
        { id: 'mid', label: 'medium m' },
        { id: 'large', label: 'large m' },
        { id: 'adapt', label: 'tuned m' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cheap', 'miss pairs'],
        ['balanced', 'task dep'],
        ['costly', 'near dense'],
        ['measured', 'overfit'],
      ],
    ),
    highlight: { active: ['mid:cost', 'adapt:cost'], compare: ['tiny:risk', 'large:risk'] },
    explanation: 'The inducing count m is a real capacity knob. Too few inducing points underfit interactions; too many recover dense-attention costs. Treat m like a memory budget and tune it against set size and task error.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'gp', label: 'sparse GP', x: 0.8, y: 2.1, note: 'induce' },
        { id: 'set', label: 'Set Xfmr', x: 2.9, y: 3.8, note: 'I pts' },
        { id: 'perc', label: 'Perceiver', x: 5.1, y: 2.1, note: 'latents' },
        { id: 'tape', label: 'AdaTape', x: 5.1, y: 5.5, note: 'tokens' },
        { id: 'rag', label: 'RAG', x: 7.4, y: 3.8, note: 'chunks' },
        { id: 'budget', label: 'budget', x: 9.0, y: 3.8, note: 'memory' },
      ],
      edges: [
        { id: 'e-gp-set', from: 'gp', to: 'set', weight: 'idea' },
        { id: 'e-set-perc', from: 'set', to: 'perc', weight: 'latent' },
        { id: 'e-set-tape', from: 'set', to: 'tape', weight: 'learned' },
        { id: 'e-perc-budget', from: 'perc', to: 'budget', weight: 'M slots' },
        { id: 'e-tape-budget', from: 'tape', to: 'budget', weight: 'tape k' },
        { id: 'e-rag-budget', from: 'rag', to: 'budget', weight: 'top k' },
      ],
    }, { title: 'Inducing points are learned memory slots' }),
    highlight: { active: ['set', 'perc', 'budget'], compare: ['tape', 'rag'], found: ['gp'] },
    explanation: 'Set Transformer borrowed the inducing-point intuition from sparse Gaussian processes. In modern transformer language, those inducing points are learned memory slots, closely related to Perceiver latents and tape tokens.',
  };

  yield {
    state: labelMatrix(
      'Implementation checklist',
      [
        { id: 'mask', label: 'set mask' },
        { id: 'perm', label: 'perm tests' },
        { id: 'm', label: 'm budget' },
        { id: 'seed', label: 'PMA seeds' },
        { id: 'stats', label: 'stats' },
      ],
      [
        { id: 'must', label: 'must track' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['valid rows', 'pad leak'],
        ['shuffle', 'order bug'],
        ['capacity', 'underfit'],
        ['out slots', 'mix slots'],
        ['N,m,cost', 'p99 spike'],
      ],
    ),
    highlight: { active: ['mask:must', 'perm:must', 'm:must'], found: ['stats:failure'] },
    explanation: 'A clean implementation needs masks for padded set elements, permutation tests, explicit m budgeting, stable PMA seed semantics, and telemetry over set size, inducing count, cost, and tail latency.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'set symmetry') yield* setSymmetry();
  else if (view === 'inducing points') yield* inducingPoints();
  else throw new InputError('Pick a Set Transformer view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Set Transformer is an attention architecture for inputs that are sets rather than sequences. The output should be equivariant or invariant to row order: shuffling the input elements should only shuffle elementwise outputs, or should not change a pooled answer at all.',
        'The model gives set data the interaction power of attention without adding false positional structure. A set can be a bag of image patches, instances in multiple-instance learning, 3D points, examples in a few-shot episode, particles, events, or candidates in an amortized inference problem.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The primitive is the Multihead Attention Block. SAB applies that primitive as self-attention over set rows. ISAB inserts m trainable inducing points so the model can approximate set interactions through a smaller learned memory. PMA uses learned seed queries to pool the set into one or more output slots.',
        'The important records are the set buffer, valid-row mask, inducing-point matrix, induced hidden states, PMA seed queries, and output slots. If the set is padded for batching, the mask is not optional: padded rows must not become fake evidence.',
      ],
    },
    {
      heading: 'Case study: Set Transformer',
      paragraphs: [
        'The ICML 2019 paper "Set Transformer: A Framework for Attention-based Permutation-Invariant Neural Networks" targets tasks where the answer should not depend on input permutation. The paper uses attention to model higher-order element interactions and introduces inducing points to reduce self-attention cost.',
        'The paper reports results across multiple-instance learning, 3D shape recognition, few-shot image classification, and amortized clustering. Those tasks differ in domain, but they share a data-structure contract: the model consumes a collection of elements and must not invent meaning from their row order.',
      ],
    },
    {
      heading: 'Why inducing points matter',
      paragraphs: [
        'Full set self-attention costs O(N^2) pairwise scores. ISAB replaces that with two attention passes through m inducing points: inducing points read the set, then set elements read the induced states. When m is fixed or much smaller than N, this is O(Nm).',
        'That makes inducing points a learned compression interface. They are not sampled input rows. They are parameters trained to ask useful global questions about the set, much like Perceiver latents later become a fixed working memory for huge multimodal inputs.',
      ],
    },
    {
      heading: 'How it connects',
      paragraphs: [
        'Set Transformer is a direct conceptual predecessor to Perceiver IO Latent Array Bottleneck and a close cousin of Vision Transformer Register Tokens. Set Transformer separates a set from learned inducing points. Perceiver separates huge inputs from latent memory. ViT registers separate image patches from scratch workspace.',
        'It also clarifies AdaTape and RAG. AdaTape appends selected tape tokens as extra input workspace. RAG retrieves document chunks from an external store. Set Transformer learns inducing points inside the model. All three are memory-selection designs with different ownership of the memory.',
      ],
    },
    {
      heading: 'Production pitfalls',
      paragraphs: [
        'The first mistake is accidentally adding order. Positional encodings, unstable sorting, or row-index features can make the model depend on arbitrary order. Use permutation checks: shuffle valid rows and verify the invariant answer stays stable.',
        'The second mistake is hiding capacity. The inducing count m controls both cost and representational power. Too small can miss rare pairwise interactions; too large can erase the benefit. Track set size, m, mask density, latency, and task error together.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Set Transformer arXiv at https://arxiv.org/abs/1810.00825, the ICML/PMLR paper page at https://proceedings.mlr.press/v97/lee19d.html, the PMLR PDF at https://proceedings.mlr.press/v97/lee19d/lee19d.pdf, and the official PyTorch implementation at https://github.com/juho-lee/set_transformer.',
        'Study Attention Mechanism, Multi-Head Attention, Softmax and Temperature, Embeddings and Similarity, Transformer Block, Perceiver IO Latent Array Bottleneck, Vision Transformer Register Tokens, AdaTape Adaptive Token Bank, RAG Pipeline, and Transformer Inference Roofline next.',
      ],
    },
  ],
};
