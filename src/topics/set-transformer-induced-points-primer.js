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
    explanation: `A set model should not change its answer just because the ${5} rows were shuffled. Set Transformer starts from that constraint: model interactions among elements (${['MIL', '3D', 'few', 'cluster', 'logs'].join(', ')}) without pretending the input order is meaningful. The active goals (${['mil:need', 'points:need', 'fewshot:need'].length} highlighted) matter; the traps (${['mil:bad', 'points:bad'].length} compared) are what happen when order leaks in.`,
  };

  yield {
    state: sabGraph('Self-attention block is permutation equivariant'),
    highlight: { active: ['sab', 'e-embed-sab', 'e-sab-ffn'], found: ['out'], compare: ['perm'] },
    explanation: `A Self-Attention Block applies multi-head attention to all elements and then a per-row feed-forward layer. The active path (${'sab'} -> ${'e-sab-ffn'}) highlights ${'SAB'} doing the mixing, while ${'out'} (${'set Y'}) is the found result and ${'perm'} (${'permute'}) is the comparison. If you shuffle the set, the output rows shuffle the same way, which is permutation equivariance.`,
    invariant: `Same elements plus a different row order should produce the same set of ${'set Y'} output rows.`,
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
    explanation: `Equivariance means the representation follows the permutation. Row ${'A,B,C'} produces ${'Y_A,Y_B,Y_C'}; row ${'C,A,B'} produces ${'Y_C,Y_A,Y_B'} — same set, reordered. The active cells (${['orig:answer', 'swap:answer', 'sab:answer'].length} highlighted) all say "${'same set'}" or "${'stable'}," while ${'RNN'} (${'bad:answer'}) shows "${'can drift'}." Invariance comes later when a pooling decoder turns the set of ${4} rows into a fixed answer.`,
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
    explanation: `Pooling by Multihead Attention gives the decoder learned seed queries (${'seed 1'} and ${'seed 2'}, active with ${'PMA'} and output slots ${'slot 1'}/${'slot 2'}). Those ${2} seeds attend to the encoded ${'set Y'} (compared) and produce fixed output slots, feeding the ${'head'} (found) for the final prediction, making it permutation invariant.`,
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
    explanation: `The architecture is built from ${4} reusable structures across ${'role'} and ${'shape'} columns. ${'MAB'} is the ${'attn block'} (${'X,Y -> X'}), ${'SAB'} is ${'self attn'} (${'N -> N'}), ${'ISAB'} ${'induce'}s (${'N -> N'} via inducing points, found), and ${'PMA'} ${'pool'}s (${'N -> k'}) to fixed slots. Active: ${['sab:role', 'pma:role'].length} cells; found: ${'isab:role'}.`,
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
    explanation: `The paper evaluates the pattern on ${5} set-shaped tasks: ${'MIL'} (${'instances'} -> ${'bag class'}), ${'3D cloud'} (${'points'} -> ${'object'}), ${'amort inf'} (${'samples'} -> ${'params'}), ${'few-shot'} (${'examples'} -> ${'class'}), and ${'cluster'} (${'members'} -> ${'centers'}). Active outputs: ${['mil:output', 'cloud:output', 'cluster:output'].length} highlighted; compared: ${'few:set'}. The shared abstraction is a bag of ${'set item'}s plus an order-free ${'output'}.`,
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
    explanation: `A full self-attention block (${'SAB N^2'}, compared) compares every set element with every other element across ${'set size N'} up to ${100}. ${'ISAB Nm'} (active) introduces ${'m fixed'} learned inducing points at x=${62}, reducing the attention pattern from N by N to two N by m passes. At N=${100}, SAB costs ${100} while ISAB costs ${72} on the ${'attention cost'} axis.`,
  };

  yield {
    state: isabGraph('ISAB reads through inducing points'),
    highlight: { active: ['i', 'read', 'h', 'write'], found: ['y'], compare: ['x'] },
    explanation: `ISAB is a two-stage bottleneck with ${6} nodes. First, ${'I pts'} (${'m rows'}) query ${'set X'} (${'N rows'}) via ${'read X'} (${'I as Q'}, weight ${'K,V'}) and form ${'m state'} summary ${'H'}. Then ${'set X'} queries ${'H'} via ${'write X'} (${'X as Q'}, weight ${'K,V'}), producing ${'set Y'} (${'N rows'}, found). Each row receives global information without a full N by N matrix.`,
    invariant: `The ${'I pts'} (${'m rows'}) are learned parameters, not ${'set X'} input elements.`,
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
    explanation: `The shape accounting is the data structure across ${3} rows and ${3} columns (${'Q'}, ${'K,V'}, ${'cost'}). ${'pass 1'}: Q=${'I'}, K,V=${'X'}, cost=${'mN'}. ${'pass 2'}: Q=${'X'}, K,V=${'H'}, cost=${'Nm'}. ${'total'}: ${'bottleneck'} cost=${'2Nm'}. Active: ${['pass1:cost', 'pass2:cost', 'total:cost'].length} cost cells highlighted; compared: ${'total:keyval'}. The full N by N table never materializes.`,
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
    explanation: `The inducing count m is a real capacity knob across ${4} regimes (${'tiny m'}, ${'medium m'}, ${'large m'}, ${'tuned m'}) with columns ${'cost'} and ${'risk'}. ${'tiny m'} is ${'cheap'} but risks ${'miss pairs'}; ${'large m'} is ${'costly'} and ${'near dense'}; ${'medium m'} is ${'balanced'} (${'task dep'}); ${'tuned m'} is ${'measured'} but risks ${'overfit'}. Active: ${['mid:cost', 'adapt:cost'].length} cost cells; compared: ${['tiny:risk', 'large:risk'].length} risk cells. Treat m like a memory budget and tune it against set size and task error.`,
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
    explanation: `Set Transformer (${'Set Xfmr'}, active) borrowed the inducing-point intuition from ${'sparse GP'} (${'induce'}, found, linked by ${'idea'}). The graph shows ${6} nodes: ${'sparse GP'}, ${'Set Xfmr'}, ${'Perceiver'} (${'latents'}, active), ${'AdaTape'} (${'tokens'}, compared), ${'RAG'} (${'chunks'}, compared), and ${'budget'} (${'memory'}, active). In modern transformer language, those inducing points are learned memory slots feeding into ${'budget'} via ${'M slots'}, ${'tape k'}, and ${'top k'}.`,
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
    explanation: `A clean implementation needs ${5} checklist items across ${'must track'} and ${'failure'} columns: ${'set mask'} (${'valid rows'} / ${'pad leak'}), ${'perm tests'} (${'shuffle'} / ${'order bug'}), ${'m budget'} (${'capacity'} / ${'underfit'}), ${'PMA seeds'} (${'out slots'} / ${'mix slots'}), and ${'stats'} (${'N,m,cost'} / ${'p99 spike'}, found as failure). Active must-track: ${['mask:must', 'perm:must', 'm:must'].length} cells highlighted.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a model for sets, where a set means a collection whose meaning does not depend on row order. If the input rows are shuffled, row-level outputs should shuffle the same way, and pooled outputs should stay unchanged.',
        {type: 'image', src: './assets/gifs/set-transformer-induced-points-primer.gif', alt: 'Animated walkthrough of the set transformer induced points primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The active rows are the elements being attended to. The learned inducing points are memory slots, not data points; they collect information from the whole set and send a compressed summary back.',
        'The safe inference rule is permutation symmetry. A row index is not evidence, so any operation that depends on storage order rather than content is a bug for this topic.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many machine-learning inputs are collections rather than sequences. A point cloud, a bag of image patches, a few-shot support set, or a group of particles has rows, but the row order is usually just storage order.',
        {
          type: 'callout',
          text: 'Set Transformer preserves set symmetry while using attention to model relationships that a plain pooled Deep Sets baseline can miss.',
        },
        'The model should see which elements are present and how they relate, not where the loader placed them. Set Transformer exists to model interactions inside a set while preserving that order-free contract.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious first model is Deep Sets. Apply the same neural network to each element, sum or average the embeddings, and send the pooled vector to a prediction head.',
        'That baseline is not naive. It is simple, fast, and invariant because addition and averaging do not care which row arrived first.',
        'Another tempting approach is to sort the rows and use a sequence model. That only works when the sort key is a real property of the problem, not an accident of a database query or sensor packet.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Independent row encoding followed by one sum can miss relationships. In clustering, a point matters because of nearby points and possible centers, not only because of its own coordinates.',
        'Full self-attention fixes interaction by comparing every element with every other element. The cost wall is the N by N attention table, where N is the number of set elements.',
        'If N doubles from 1000 to 2000, dense attention scores grow from 1,000,000 to 4,000,000 for one head. Large sets need interaction without paying every pair explicitly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use attention without positional meaning, then add learned inducing points when all-pairs attention is too expensive. A Self-Attention Block, or SAB, lets rows interact directly while preserving permutation equivariance.',
        'An Induced Set Attention Block, or ISAB, inserts m learned memory slots. The inducing points first read the N elements, then the N elements read the m induced states.',
        'This replaces one N by N table with two N by m tables. The model still passes global information to each row, but through a bottleneck whose size is chosen by the designer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The basic attention primitive is a Multihead Attention Block, or MAB. SAB applies that block with the set attending to itself, so N input rows produce N output rows.',
        'ISAB performs two MAB passes. First, m inducing points query the N encoded elements and produce m induced states; second, the original rows query those m states and receive global context.',
        'Pooling by Multihead Attention, or PMA, uses learned seed queries to produce a fixed number k of output slots from a variable-size set. The seeds have roles; the input rows do not.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness here means symmetry, not exact optimization. Shared parameters process every row in the same way, and attention uses content-derived queries, keys, and values rather than row numbers.',
        'If the input rows are permuted, the same computations are permuted with them. That gives equivariance for row-level outputs, meaning the output row attached to an element moves with that element.',
        'Pooled outputs become invariant when the final pooling ignores row order. PMA does this by letting fixed seed queries attend over the encoded set, so the answer depends on contents and relations, not storage order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'SAB costs O(N^2) attention scores per layer. With N = 1000 and 4 heads, the model forms about 4,000,000 scores before value mixing.',
        {
          type: 'image',
          src: 'https://ar5iv.labs.arxiv.org/html/1810.00825/assets/figs/runtime.png',
          alt: 'Runtime plot comparing SAB and ISAB as set size grows',
          caption: 'The Set Transformer supplementary runtime plot shows why inducing points matter for large sets. Source: ar5iv rendering of the Set Transformer supplementary material https://ar5iv.labs.arxiv.org/html/1810.00825.',
        },
        'ISAB costs O(Nm) for each of two passes. With N = 1000 and m = 32, the attention table sizes are about 32,000 plus 32,000 per head, far below 1,000,000.',
        'The price is capacity. A small m can compress away rare pairwise evidence; a large m moves back toward dense attention cost.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Set Transformer fits point clouds, multiple-instance learning, few-shot learning, particle sets, and amortized clustering. These tasks need relationships among elements while refusing to treat input order as a feature.',
        'It also fits learned pooling when the output has fixed slots. A clustering model can use several PMA seeds to produce several center candidates from a variable-size set.',
        'The workload fit is interaction under symmetry. If the problem has no meaningful order but does have element-to-element evidence, Set Transformer is a natural candidate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when order is real. Text, event streams, trajectories, and protocols often encode meaning in before and after, so removing order removes signal.',
        'It can fail when rare exact pairwise interactions must not pass through a small bottleneck. In that case full attention, graph neural networks, nearest-neighbor attention, or a hand-built sparse graph may fit better.',
        'It also fails when padding masks are wrong. A padded row is storage, not an element; if the model attends to it, batch shape leaks into the prediction.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a set has N = 6 points and each point has a 16-dimensional embedding. Dense SAB compares all 6 points with all 6 points, so one head forms 36 attention scores.',
        'Now choose m = 2 inducing points. The first pass forms 2 by 6 = 12 scores as the inducing points read the set, and the second pass forms 6 by 2 = 12 scores as set rows read the induced states.',
        'The ISAB version uses 24 scores instead of 36 in this small example. At N = 1000 with the same m = 32, the contrast is 64,000 scores for the two induced passes versus 1,000,000 scores for dense self-attention.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lee et al., "Set Transformer" at https://arxiv.org/abs/1810.00825, the ICML/PMLR page at https://proceedings.mlr.press/v97/lee19d.html, the PMLR PDF at https://proceedings.mlr.press/v97/lee19d/lee19d.pdf, and the official implementation at https://github.com/juho-lee/set_transformer.',
        'Study Deep Sets for the pooled baseline, attention and multi-head attention for the MAB primitive, softmax temperature for attention weights, Perceiver-style latent arrays for a related bottleneck, and graph neural networks for cases where the interaction pattern is known.',
      ],
    },
  ],
};
