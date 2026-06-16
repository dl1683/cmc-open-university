// Minimizer index: pick representative k-mers from sliding windows so long
// reads can seed approximate alignments with fewer index lookups.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'genome-kmer-minimizer-index-case-study',
  title: 'Genome k-mer Minimizer Index Case Study',
  category: 'Data Structures',
  summary: 'A genomics indexing case study: k-mers, sliding windows, minimizers, hash buckets, repetitive-seed filtering, seed chaining, and long-read alignment tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['minimizer sketch', 'seed chaining'], defaultValue: 'minimizer sketch' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function seedGraph(title) {
  return graphState({
    nodes: [
      { id: 'read', label: 'read', x: 0.8, y: 3.4, note: 'long' },
      { id: 'kmers', label: 'k-mers', x: 2.5, y: 3.4, note: 'all' },
      { id: 'mins', label: 'mins', x: 4.3, y: 2.0, note: 'sketch' },
      { id: 'hash', label: 'hash', x: 4.3, y: 4.8, note: 'index' },
      { id: 'hits', label: 'hits', x: 6.5, y: 3.4, note: 'anchors' },
      { id: 'chain', label: 'chain', x: 8.4, y: 3.4, note: 'align' },
    ],
    edges: [
      { id: 'e-read-kmers', from: 'read', to: 'kmers' },
      { id: 'e-kmers-mins', from: 'kmers', to: 'mins' },
      { id: 'e-mins-hash', from: 'mins', to: 'hash' },
      { id: 'e-hash-hits', from: 'hash', to: 'hits' },
      { id: 'e-hits-chain', from: 'hits', to: 'chain' },
    ],
  }, { title });
}

function* minimizerSketch() {
  yield {
    state: seedGraph('Long reads are sketched before alignment'),
    highlight: { active: ['read', 'kmers', 'mins', 'e-read-kmers', 'e-kmers-mins'], compare: ['chain'] },
    explanation: 'Long-read mappers do not index every possible alignment directly. They sketch reads into representative k-mers called minimizers, then use those as seeds.',
  };
  yield {
    state: labelMatrix(
      'Window minima',
      [
        { id: 'w1', label: 'win1' },
        { id: 'w2', label: 'win2' },
        { id: 'w3', label: 'win3' },
        { id: 'w4', label: 'win4' },
      ],
      [
        { id: 'kmers', label: 'k-mers' },
        { id: 'min', label: 'min' },
      ],
      [
        ['ACG,CGA,GAT', 'ACG'],
        ['CGA,GAT,ATT', 'ATT'],
        ['GAT,ATT,TTA', 'ATT'],
        ['ATT,TTA,TAC', 'ATT'],
      ],
    ),
    highlight: { found: ['w1:min', 'w2:min', 'w3:min', 'w4:min'] },
    explanation: 'Slide a fixed-size window over k-mers and keep the smallest k-mer by an ordering. Adjacent windows often choose the same minimizer, so the sketch is much smaller than the full k-mer set.',
    invariant: 'A minimizer index trades sensitivity for fewer seeds.',
  };
  yield {
    state: seedGraph('Hash buckets map minimizers to reference positions'),
    highlight: { active: ['mins', 'hash', 'hits', 'e-mins-hash', 'e-hash-hits'], found: ['read'] },
    explanation: 'The reference index maps each minimizer to positions where it occurs. Highly repetitive minimizers are often capped or downweighted because they create too many candidate hits.',
  };
  yield {
    state: labelMatrix(
      'Seed filter',
      [
        { id: 'rare', label: 'rare' },
        { id: 'mid', label: 'mid' },
        { id: 'repeat', label: 'repeat' },
        { id: 'bad', label: 'bad' },
      ],
      [
        { id: 'bucket', label: 'bucket' },
        { id: 'action', label: 'action' },
      ],
      [
        ['3 hits', 'keep'],
        ['40 hits', 'keep'],
        ['9000 hits', 'drop'],
        ['low qual', 'drop'],
      ],
    ),
    highlight: { active: ['rare:action', 'mid:action'], removed: ['repeat:action', 'bad:action'] },
    explanation: 'A good seed index carries filtering policy. Repeats and low-quality seeds waste chaining time and can dominate memory traffic.',
  };
}

function* seedChaining() {
  yield {
    state: plotState({
      axes: { x: { label: 'read pos', min: 0, max: 100 }, y: { label: 'ref pos', min: 0, max: 100 } },
      markers: [
        { id: 's1', x: 10, y: 12, label: 's1' },
        { id: 's2', x: 30, y: 32, label: 's2' },
        { id: 's3', x: 54, y: 57, label: 's3' },
        { id: 'noise', x: 64, y: 20, label: 'noise' },
        { id: 's4', x: 82, y: 84, label: 's4' },
      ],
      series: [
        { id: 'chainline', label: 'chain', points: [{ x: 10, y: 12 }, { x: 30, y: 32 }, { x: 54, y: 57 }, { x: 82, y: 84 }] },
      ],
    }),
    highlight: { active: ['s1', 's2', 's3', 's4', 'chainline'], removed: ['noise'] },
    explanation: 'Seed hits become anchors in read/reference coordinate space. Chaining keeps a collinear sequence of anchors and rejects off-diagonal noise.',
  };
  yield {
    state: labelMatrix(
      'Chain DP',
      [
        { id: 's1', label: 's1' },
        { id: 's2', label: 's2' },
        { id: 's3', label: 's3' },
        { id: 'n', label: 'noise' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'prev', label: 'prev' },
      ],
      [
        ['10', '-'],
        ['21', 's1'],
        ['33', 's2'],
        ['4', '-'],
      ],
    ),
    highlight: { found: ['s2:prev', 's3:prev'], compare: ['n:score'] },
    explanation: 'The chain score rewards consistent spacing between read and reference positions. This is a dynamic-programming layer over the hash-table seed hits.',
  };
  yield {
    state: seedGraph('Best chain narrows the expensive alignment band'),
    highlight: { active: ['hits', 'chain', 'e-hits-chain'], found: ['hash'], compare: ['kmers'] },
    explanation: 'After chaining, the aligner runs a more expensive base-level alignment only around promising regions. The seed index keeps the search from touching the whole genome.',
  };
  yield {
    state: labelMatrix(
      'Tuning knobs',
      [
        { id: 'k', label: 'k' },
        { id: 'w', label: 'w' },
        { id: 'cap', label: 'cap' },
        { id: 'chain', label: 'chain' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['specific', 'miss error'],
        ['fewer seed', 'less sens'],
        ['drop reps', 'miss repeat'],
        ['long anchors', 'split read'],
      ],
    ),
    highlight: { active: ['k:effect', 'w:effect', 'cap:effect'], compare: ['chain:risk'] },
    explanation: 'Minimizer parameters control the speed/sensitivity frontier. They must match read length, error rate, and reference repetitiveness.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'minimizer sketch') yield* minimizerSketch();
  else if (view === 'seed chaining') yield* seedChaining();
  else throw new InputError('Pick a minimizer-index view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['A minimizer index stores representative k-mers from a reference genome so reads can quickly find candidate alignment positions. It is the seeding layer used by aligners such as minimap2.'] },
    { heading: 'How it works', paragraphs: ['Slide a window over k-mers and choose a minimizer from each window. Store minimizer to reference-position buckets in a hash table. At query time, find shared minimizers between read and reference, filter repetitive seeds, and chain collinear hits.'] },
    { heading: 'Case study', paragraphs: ['A noisy long read shares many minimizers with the correct reference locus. Chaining turns scattered seed hits into a diagonal anchor path, then a local aligner refines the final base-level alignment.'] },
    { heading: 'Pitfalls', paragraphs: ['Too small k creates repetitive buckets. Too large k misses noisy reads. Too large a window loses sensitivity. Keeping every repetitive minimizer can make the index slow and memory heavy.'] },
    { heading: 'Why it matters', paragraphs: ['Minimizers connect hash tables, rolling string hashes, dynamic programming, and biological error models. They make whole-genome long-read mapping feasible.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: minimap2 paper at https://academic.oup.com/bioinformatics/article/34/18/3094/4994778, minimap2 docs at https://lh3.github.io/minimap2/minimap2.html, and minimap2 source at https://github.com/lh3/minimap2. Study Rolling Hash, Hash Table, FM-index BWT, and Edit Distance next.'] },
  ],
};
