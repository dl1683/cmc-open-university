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
      heading: 'Why this exists',
      paragraphs: [
        'Long-read alignment starts with an ugly search problem. A read may be thousands of bases long, the reference may be billions of bases long, and the read can contain substitutions, insertions, deletions, and sequencing errors.',
        'Full dynamic-programming alignment against every reference position is the wrong first operation. The aligner first needs a cheap way to ask: which reference regions are even worth aligning?',
        'A minimizer index answers that question with a sparse sketch. It stores selected k-mers from the reference, looks up the same kind of selected k-mers from the read, and uses the shared hits as anchors for later alignment.',
        {type:'callout', text:'A minimizer index makes genome search tractable by preserving enough shared k-mer anchors to guide alignment while discarding most redundant seed lookups.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/57/Oxford_Nanopore_MinION_top_cropped.jpg', alt:'Hand holding an Oxford Nanopore MinION portable DNA sequencer.', caption:'Oxford Nanopore MinION top cropped.jpg by Cirosantilli2; CC BY-SA 4.0 via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The naive baseline',
      paragraphs: [
        'The simplest seed index stores every k-mer in the reference. For each read, compute every k-mer, look each one up, and extend from every matching position.',
        'That baseline is reasonable. Exact k-mer matches are easy to hash, and a true alignment usually preserves many short exact substrings even when the full read is noisy.',
        'The baseline breaks because it emits too many seeds. Long reads contain many k-mers, repetitive reference sequence creates huge hash buckets, and downstream chaining spends its time sorting and scoring anchors that were never informative.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hard part isn\'t finding any seed. It is finding enough useful seeds without drowning in redundant ones.',
        'Indexing every k-mer gives high sensitivity, but many adjacent k-mers carry the same location signal. A read that shares ACGTAC with the reference doesn\'t need every overlapping k-mer in that stretch to prove the same candidate region.',
        'Repetitive minimizers add another wall. A seed that occurs thousands of times doesn\'t narrow the search; it moves cost from the hash lookup into chaining and alignment.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'A minimizer index chooses one representative k-mer from each window of consecutive k-mers. The choice is deterministic: order the k-mers by a hash or lexical rule and keep the smallest one in the window.',
        'Adjacent windows often choose the same minimizer, so the sketch stores far fewer entries than the full k-mer set. With a random ordering, minimizer density is roughly proportional to 2 divided by the window length plus one, so larger windows reduce seed count directly.',
        'The selected k-mer isn\'t an alignment. It is an anchor candidate. The algorithm still needs filtering and chaining to decide whether the anchors describe one plausible read-to-reference path.',
        'The invariant is shared selection. If the read and reference contain the same stretch and no error destroys the selected k-mer for a window, both sides choose the same representative. That shared representative is enough to create a seed without storing every overlapping k-mer.',
      ],
    },
    {
      heading: 'Data model',
      paragraphs: [
        'The reference index is a hash table from minimizer value to reference positions. Each entry usually records the strand, coordinate, and enough metadata to recover the candidate location.',
        'The read is sketched the same way as the reference. The mapper computes read minimizers, fetches reference buckets, drops buckets that are too repetitive, and turns the remaining matches into seed hits.',
        'A seed hit has two coordinates: position on the read and position on the reference. Good hits from one alignment form a near-diagonal chain because both coordinates increase together.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Pick k and a window size. Generate consecutive k-mers from the reference, slide the window, select the minimum in each window, and insert that minimizer into the position bucket. Repeated selections of the same minimizer in neighboring windows can be compressed.',
        'For a read, repeat the sketching process. Each shared minimizer creates one or more candidate anchors. Buckets with too many positions are capped or downweighted because they usually come from repeats.',
        'Chaining scores anchors by collinearity. A later anchor should appear later on the read and later on the reference, and the gap between anchors should be plausible. The best chain defines a band for base-level alignment.',
      ],
    },
    {
      heading: 'Worked intuition',
      paragraphs: [
        'Take the k-mers ACG, CGA, GAT, ATT, TTA, and TAC with a window of three k-mers. The first window ACG/CGA/GAT chooses ACG. The next three windows all contain ATT, and ATT is the minimum under the chosen ordering.',
        'Six overlapping k-mers collapse to two selected minimizer values in this small example: ACG and ATT. The sketch is smaller, but it still places anchors across the sequence.',
        'If a sequencing error destroys one k-mer, the read can still share other minimizers nearby. If the window is too large, though, too many anchors disappear and sensitivity drops.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The minimizer-sketch view shows the pipeline as a narrowing funnel. A long read becomes all k-mers, all k-mers become selected minimizers, minimizers become hash-table lookups, and the resulting hits become anchors. Each arrow removes work before the expensive alignment step.',
        'The window table makes the compression concrete. Several neighboring windows can choose the same minimizer, so the index does not pay once per k-mer. That repeated choice is not a bug; it is the source of the density reduction.',
        'The seed-chaining plot moves from one-dimensional strings to two-dimensional evidence. A true alignment produces anchors that rise together in read and reference coordinates. Off-diagonal hits are not merely low-quality; they tell the chaining layer that the seed was probably repetitive, noisy, or from the wrong locus.',
      ],
    },
    {
      heading: 'Correctness and reliability',
      paragraphs: [
        'The deterministic part is simple: the same sequence window produces the same minimizer under the same ordering. If a read and reference region share an error-free window, they share that minimizer.',
        'The reliability argument is probabilistic. True homologous regions usually preserve many local seeds across a long read, while random noise produces scattered hits that fail the chaining test.',
        'Chaining is the guardrail. It rejects isolated seed matches that don\'t preserve order and spacing. The final alignment is still approximate because repeats, large variants, and sequencing errors can remove or duplicate the seed evidence.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Building the index is linear in the reference length plus the cost of storing selected minimizers. Larger windows reduce memory and lookup work. Smaller windows increase sensitivity and produce more anchors.',
        'Query cost is driven by read length, minimizer density, bucket size, and chaining. High-frequency buckets dominate runtime because one read minimizer can expand into thousands of reference hits.',
        'k controls specificity. Small k creates large buckets and many false anchors. Large k makes seeds more unique but easier to lose to errors. The best parameters depend on read length, error rate, and reference repetitiveness.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Minimizer indexes fit long-read mapping because long reads can tolerate sparse seeding. The read is long enough that many windows survive even when some k-mers are corrupted.',
        'They also work for fast approximate genomic search, overlap detection, and prefiltering before expensive alignment. The access pattern is exactly what a hash sketch is good at: cheap candidate generation followed by stricter validation.',
        'They are also practical engineering structures. The index is compact enough to keep hot buckets in memory, the lookup path is easy to parallelize across reads, and the sketch gives the mapper a simple way to tune throughput by changing k, window size, and frequency caps.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Choose k from the error profile and reference size. Larger k makes random matches rarer, which is good for specificity, but it also makes a seed easier to destroy with one sequencing error. High-error reads usually need shorter k or denser seeding than polished reads.',
        'Choose the window size from the speed and sensitivity budget. A larger window creates fewer minimizers and fewer lookups, but it also increases the chance that a true region has too few anchors. The right setting is not universal; it depends on read length, expected divergence, and how much downstream alignment cost the system can afford.',
        'Measure bucket frequency, not just total index size. A small number of extremely common minimizers can dominate runtime. Production mappers usually cap, mask, or downweight high-frequency seeds and then verify that the cap does not erase important repetitive biology for the workload.',
        'Keep the reference build reproducible. The same k, window size, ordering function, masking rules, strand handling, and versioned reference sequence must be used when indexing and querying. A silent parameter mismatch can look like poor biological sensitivity when it is really an index-contract bug.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The structure struggles in low-complexity and highly repetitive sequence because the same minimizer appears in too many places. Filtering those seeds speeds the mapper but can hide real alignments in repeats.',
        'It also fails when parameters don\'t match the data. Large k is brittle on high-error reads. Large windows miss short or weak homology. Small windows can make chaining the bottleneck.',
        'A minimizer index is only a seeding layer. It doesn\'t call variants, assemble genomes, or prove the final alignment by itself.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: minimap2 paper at https://academic.oup.com/bioinformatics/article/34/18/3094/4994778, minimap2 docs at https://lh3.github.io/minimap2/minimap2.html, and minimap2 source at https://github.com/lh3/minimap2.',
        'Study Rolling Hash for deterministic sketches, Hash Table for buckets, Edit Distance for base-level alignment, BWA FM-index Read Alignment for short-read seeding, De Bruijn Graph Genome Assembly for k-mer graph use, and Pangenome Variation Graph for references that aren\'t single strings.',
      ],
    },
  ],
};
