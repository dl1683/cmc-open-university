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
      heading: 'Why This Exists',
      paragraphs: [
        'Many machine-learning inputs are collections, not sequences. A bag of image patches, a point cloud, a few-shot support set, a group of particles, a candidate list, or a cluster of log events has rows, but the row order is often just storage order. If the data loader shuffles the rows, the meaning of the collection should not change.',
        {
          type: 'callout',
          text: 'Set Transformer preserves set symmetry while using attention to model relationships that a plain pooled Deep Sets baseline can miss.',
        },
        'Set Transformer exists for that contract. It lets elements interact through attention while refusing to treat row index as a signal. Elementwise outputs should move with the input permutation. Pooled outputs should stay the same. The model is built around that distinction: equivariance before pooling, invariance after pooling.',
      ],
    },
    {
      heading: 'Baseline Approach',
      paragraphs: [
        'A good first model is Deep Sets: apply the same network to each element, sum or average the element embeddings, then pass the pooled vector to a prediction head. It is simple and correct about order because addition and averaging do not care which row arrived first.',
        'Another baseline is to sort the rows and use a sequence model. That works only when there is a real canonical order. It is a bad fit when order came from a database query, a file layout, a sensor packet, or a batching routine. In those cases the model can learn the sorting artifact instead of the set structure.',
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        'Deep Sets can miss relationships that depend on several elements at once. In clustering, a point only makes sense relative to nearby points and possible centers. In multiple-instance learning, one instance can change the interpretation of another. Independent row encoding followed by one sum can be too thin for that kind of relational evidence.',
        'Full self-attention fixes the interaction problem but hits a cost wall. A Self-Attention Block compares every element with every other element, so the attention table is N by N. Doubling the set size roughly quadruples the attention scores and memory for that layer. Large sets need a cheaper path.',
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        'The core insight is to use attention without sequence position, then add learned memory slots when dense pairwise attention is too expensive. A Self-Attention Block, or SAB, models all pairwise interactions among set elements while preserving permutation equivariance. Shuffle the valid rows and the output rows shuffle the same way.',
        'The Induced Set Attention Block, or ISAB, inserts m learned inducing points. First, those inducing points query the full set and build m induced states. Then the original set rows query the induced states. The model still passes global information back to every row, but the full N by N table is replaced by two N by m attention passes.',
      ],
    },
    {
      heading: 'How the Visual Model Teaches It',
      paragraphs: [
        'The set-symmetry view shows the contract first. The input is a collection of rows. The SAB block mixes those rows without adding a timeline. The output remains a collection of rows. The permutation node is there to show that changing storage order should only reorder row-level representations, not change the represented set.',
        'The inducing-points view shows the bottleneck. The learned points read the set, forming a small memory H. The set rows then read that memory. The diagram is useful because it makes the missing N by N table visible by absence: rows do not all directly compare with all rows in ISAB.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Set Transformer is built from a few reusable blocks. MAB is the attention primitive. SAB applies MAB with the set attending to itself. ISAB applies two MAB-style passes through inducing points. PMA, or Pooling by Multihead Attention, uses learned seed queries to produce a fixed number of output slots from a variable-size encoded set.',
        'The shape accounting is the data structure. SAB maps N rows to N rows and costs N by N attention. ISAB maps N rows to N rows through m induced states and costs roughly two N by m attention passes. PMA maps N rows to k output slots, where k is the number of learned seed queries.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'The symmetry argument is straightforward. Each valid input row is processed with shared parameters. Attention uses row content as queries, keys, and values, not a special row number. If a permutation reorders the rows, the same computations are reordered with them. That gives equivariance for row-level outputs.',
        'Pooled predictions become invariant when the final pooling operation is itself order-insensitive. PMA does this with learned seed queries that attend over the encoded set. The seeds have fixed roles, but the input rows do not. The answer can depend on which elements are present and how they relate, not on where the rows happened to sit in memory.',
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        'SAB costs O(N^2) attention scores per layer. ISAB costs O(Nm) for each of two attention passes when m is the number of inducing points. If m is fixed and N doubles, the ISAB attention work grows close to linearly rather than quadratically. That is the main reason the inducing-point version exists.',
        {
          type: 'image',
          src: 'https://ar5iv.labs.arxiv.org/html/1810.00825/assets/figs/runtime.png',
          alt: 'Runtime plot comparing SAB and ISAB as set size grows',
          caption: 'The Set Transformer supplementary runtime plot shows why inducing points matter for large sets. Source: ar5iv rendering of the Set Transformer supplementary material https://ar5iv.labs.arxiv.org/html/1810.00825.',
        },
        'The price is capacity. A small m forces many elements to share a narrow memory bottleneck and can miss rare pairwise relationships. A large m approaches dense-attention cost. Treat m as a memory and latency budget. It should be chosen against set size, task error, tail latency, and the amount of interaction the task actually needs.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Set Transformer fits tasks where order-free interactions matter. Multiple-instance learning can compare instances inside a bag. Point-cloud classification can model relationships among points. Few-shot classification can compare support examples without treating dataloader order as evidence.',
        'It also fits amortized inference and clustering. The input is a dataset or sample set, and the output is a summary, label, parameter estimate, or group of centers. PMA gives the model fixed output slots while the encoder still reads a variable-size set.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'Set Transformer is the wrong tool when order is real. Text, event streams with causal time, trajectories, and protocols often need sequence structure. Removing order from those inputs can remove the signal. A model that is invariant to event order cannot explain a process where before and after matter.',
        'ISAB can also fail when the task depends on rare exact pairwise interactions and m is too small. Full attention, graph neural networks, nearest-neighbor structures, or sparse attention may be better when the interaction pattern is known and should not pass through a learned global bottleneck.',
      ],
    },
    {
      heading: 'Concrete Examples',
      paragraphs: [
        'For a point cloud, each input row is a 3D point with features. The object label should not change because the points were loaded in a different order. SAB lets every point compare itself with every other point. ISAB lets the set communicate through learned inducing points when the cloud is too large for dense attention.',
        'For amortized clustering, PMA can use several seed queries to produce several cluster-center slots. The slots have learned roles, but the input points do not. That is the data-structure distinction: fixed output memory, unordered input rows. The same idea appears in few-shot learning, where support examples form a set and the class answer should not depend on support order.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Always carry a valid-row mask. Padding rows are storage, not set elements. If the mask leaks, the model can attend to fake elements and learn patterns from batch shape. Test the model by shuffling valid rows and checking that invariant outputs stay stable and equivariant outputs reorder predictably.',
        'Log N, m, k, attention memory, and tail latency. Tune m with the same seriousness as hidden size or number of heads. If performance drops on large sets, inspect whether the inducing points are too few. If latency spikes, inspect whether m or PMA slots have grown into dense-attention behavior.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: Set Transformer arXiv at https://arxiv.org/abs/1810.00825, the ICML/PMLR page at https://proceedings.mlr.press/v97/lee19d.html, the PMLR PDF at https://proceedings.mlr.press/v97/lee19d/lee19d.pdf, and the official PyTorch implementation at https://github.com/juho-lee/set_transformer.',
        'Study the attention stack first: Attention Mechanism, Multi-Head Attention, Softmax Temperature, Embeddings and Similarity, and Transformer Block. Then compare learned memory designs: Perceiver IO Latent Array Bottleneck, Vision Transformer Register Tokens, AdaTape Adaptive Token Bank, RAG Pipeline, and Transformer Inference Roofline.',
      ],
    },
  ],
};
