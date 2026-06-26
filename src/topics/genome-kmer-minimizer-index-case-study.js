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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a narrowing search pipeline. A genome is a long string over A, C, G, and T, a k-mer is a substring of length k, and a minimizer is the chosen representative k-mer from a sliding window. Active windows are being sketched, visited minimizers have entered the index, and found anchors are shared minimizers between read and reference.',
        'The safe inference rule is shared deterministic choice. If the read and reference contain the same error-free window and use the same ordering rule, they choose the same minimizer, so the index can create an anchor without storing every k-mer.',
        {type:'callout', text:'A minimizer index makes genome search tractable by preserving enough shared k-mer anchors to guide alignment while discarding most redundant seed lookups.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/57/Oxford_Nanopore_MinION_top_cropped.jpg', alt:'Hand holding an Oxford Nanopore MinION portable DNA sequencer.', caption:'Oxford Nanopore MinION top cropped.jpg by Cirosantilli2; CC BY-SA 4.0 via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Genome alignment asks where a read came from in a much larger reference. A read may be thousands of bases long, the reference may have billions of bases, and sequencing errors can insert, delete, or substitute bases.',
        'Running full dynamic programming alignment at every reference position is far too expensive. The aligner first needs a cheap candidate generator that finds likely regions before exact alignment work begins.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to index every k-mer in the reference. For each read, compute every k-mer, look up matching reference positions, and extend from those hits.',
        'This is reasonable because exact short matches are easy to hash and real alignments usually preserve many exact substrings. It also gives high sensitivity when errors are not too dense.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is seed explosion. Adjacent k-mers often say the same thing about location, so indexing all of them produces redundant hits that overload chaining and alignment.',
        'Repetitive sequence creates another wall. A common k-mer may appear thousands of times in the reference, so one lookup can produce a huge bucket that does not narrow the search.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A minimizer index stores a sparse sketch instead of the full k-mer set. For each window of consecutive k-mers, it keeps the smallest k-mer under a fixed ordering such as a hash order.',
        'Overlapping windows often keep the same minimizer, so density drops while the sketch still leaves anchors across long shared regions. The index trades some sensitivity for a large reduction in candidate hits.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During reference indexing, the builder slides a window across the reference, chooses the minimizer for each window, and stores the minimizer value with its reference coordinate and strand. Repeated adjacent selections can be compressed because they point to nearly the same region.',
        'During query, the read is sketched with the same k, window size, and ordering rule. Each read minimizer looks up a bucket of reference positions, and high-frequency buckets can be capped or downweighted.',
        'The aligner then chains hits by coordinate order. True anchors from one alignment form a near-diagonal pattern because read position and reference position increase together.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The deterministic guarantee is local. The same sequence window produces the same minimizer under the same parameters, so an error-free shared window creates a shared seed.',
        'The reliability argument is statistical. Long reads contain many windows, so losing some seeds to errors can still leave enough anchors for chaining. Random or repetitive hits tend to scatter and fail the ordered-chain test.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Index construction is linear in reference length plus storage for selected minimizers. With a random ordering, expected minimizer density is roughly 2 divided by w plus 1, where w is the window length in k-mers.',
        'If w = 9, density is about 2/10, so a 3 billion base reference stores on the order of 600 million minimizer positions before compression and filtering. Doubling w roughly lowers lookup work but also increases the chance that true regions have too few anchors.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Minimizer indexes are central in long-read mappers such as minimap2. They fit long noisy reads because the read is long enough to preserve many anchors even when individual bases are wrong.',
        'The same sketching idea appears in overlap detection, approximate genomic search, metagenomic prefilters, and other systems that need candidates before expensive edit-distance or alignment computation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The structure struggles in low-complexity and repetitive DNA because selected minimizers may occur too often. Filtering common seeds speeds the mapper but can hide real alignments inside biologically important repeats.',
        'It also fails when parameters do not match data. Large k is brittle under high error rates, large windows can miss short homology, and small windows can make chaining the bottleneck.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take sequence ACGATTAC with k = 3, giving k-mers ACG, CGA, GAT, ATT, TTA, and TAC. With window size w = 3 and lexical ordering, the first window ACG/CGA/GAT chooses ACG.',
        'The second window CGA/GAT/ATT chooses ATT, the third GAT/ATT/TTA also chooses ATT, and the fourth ATT/TTA/TAC chooses ATT. Six k-mers produce two minimizer values, ACG and ATT, so the read keeps location evidence while skipping redundant lookups.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the minimap2 paper, minimap2 manual, and minimap2 source code for the practical implementation of minimizer seeding and chaining. Study hash tables, rolling hashes, edit distance, dynamic programming alignment, and compressed suffix or FM indexes next.',
        'Then compare minimizers with syncmers and other sketching schemes. The useful question is always the same: how many candidate anchors are enough before exact alignment becomes cheaper than more indexing.',
      ],
    },
  ],
};
