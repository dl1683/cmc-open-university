// BWA-style short-read alignment: build an FM-index over the reference, run
// backward search for seeds, then handle mismatches and gaps.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'bwa-fm-index-read-alignment-case-study',
  title: 'BWA FM-index Read Alignment Case Study',
  category: 'Data Structures',
  summary: 'A short-read alignment case study: reference BWT, FM-index occurrence counts, backward search intervals, seed extension, mismatches, mapping quality, and SAM output.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['backward search', 'alignment output'], defaultValue: 'backward search' },
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

function fmGraph(title) {
  return graphState({
    nodes: [
      { id: 'ref', label: 'ref', x: 0.8, y: 3.5, note: 'genome' },
      { id: 'bwt', label: 'BWT', x: 2.6, y: 3.5, note: 'text' },
      { id: 'occ', label: 'Occ', x: 4.4, y: 2.0, note: 'rank' },
      { id: 'c', label: 'C', x: 4.4, y: 5.0, note: 'starts' },
      { id: 'range', label: 'range', x: 6.4, y: 3.5, note: 'SA int' },
      { id: 'align', label: 'align', x: 8.4, y: 3.5, note: 'SAM' },
    ],
    edges: [
      { id: 'e-ref-bwt', from: 'ref', to: 'bwt' },
      { id: 'e-bwt-occ', from: 'bwt', to: 'occ' },
      { id: 'e-bwt-c', from: 'bwt', to: 'c' },
      { id: 'e-occ-range', from: 'occ', to: 'range' },
      { id: 'e-c-range', from: 'c', to: 'range' },
      { id: 'e-range-align', from: 'range', to: 'align' },
    ],
  }, { title });
}

function* backwardSearch() {
  yield {
    state: fmGraph('Build FM-index over the reference'),
    highlight: { active: ['ref', 'bwt', 'occ', 'c', 'e-ref-bwt', 'e-bwt-occ', 'e-bwt-c'], compare: ['align'] },
    explanation: 'BWA-style short-read alignment starts by building an FM-index over the reference genome. The BWT plus rank/count tables support compressed exact matching.',
  };
  yield {
    state: labelMatrix(
      'Backward search',
      [
        { id: 'T', label: 'add T' },
        { id: 'GT', label: 'add G' },
        { id: 'CGT', label: 'add C' },
        { id: 'ACGT', label: 'add A' },
      ],
      [
        { id: 'range', label: 'SA range' },
        { id: 'hits', label: 'hits' },
      ],
      [
        ['[4,8)', '4'],
        ['[6,8)', '2'],
        ['[6,7)', '1'],
        ['[6,7)', '1'],
      ],
    ),
    highlight: { active: ['T:range', 'GT:range', 'CGT:range', 'ACGT:range'], found: ['ACGT:hits'] },
    explanation: 'Backward search consumes the read from right to left. Each character narrows the suffix-array interval using C and Occ tables.',
    invariant: 'An empty interval means no exact match for that suffix.',
  };
  yield {
    state: fmGraph('Candidate interval maps to reference positions'),
    highlight: { active: ['occ', 'c', 'range', 'align', 'e-occ-range', 'e-c-range', 'e-range-align'], found: ['bwt'] },
    explanation: 'The final interval identifies suffix-array rows, which map to reference positions. Aligners then extend, score, and handle mismatches, gaps, and paired-end constraints.',
  };
  yield {
    state: labelMatrix(
      'Index pieces',
      [
        { id: 'bwt', label: 'BWT' },
        { id: 'occ', label: 'Occ' },
        { id: 'C', label: 'C' },
        { id: 'SA', label: 'SA samp' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['compressed text', 'memory'],
        ['rank query', 'speed'],
        ['char starts', 'small'],
        ['locate pos', 'sample gap'],
      ],
    ),
    highlight: { found: ['bwt:role', 'occ:role', 'C:role', 'SA:role'] },
    explanation: 'The FM-index is compact because it stores compressed text and sampled location data. More sampling speeds locate queries but increases memory.',
  };
}

function* alignmentOutput() {
  yield {
    state: labelMatrix(
      'Alignment packet',
      [
        { id: 'read', label: 'read' },
        { id: 'pos', label: 'pos' },
        { id: 'cigar', label: 'CIGAR' },
        { id: 'mapq', label: 'MAPQ' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['ACGT', 'query'],
        ['chr1:42', 'best hit'],
        ['4M', 'match ops'],
        ['60', 'conf'],
      ],
    ),
    highlight: { found: ['pos:value', 'cigar:value', 'mapq:value'] },
    explanation: 'The user sees an alignment record, not the FM-index internals. SAM/BAM fields summarize position, CIGAR operations, mapping quality, flags, and tags.',
  };
  yield {
    state: fmGraph('Ambiguous hits lower mapping quality'),
    highlight: { active: ['range', 'align', 'e-range-align'], compare: ['ref'], found: ['occ'] },
    explanation: 'If a read matches multiple loci, the mapper may report a lower mapping quality. Repetitive genomes make exact hits less informative.',
  };
  yield {
    state: labelMatrix(
      'Read alignment decisions',
      [
        { id: 'exact', label: 'exact' },
        { id: 'mm', label: 'mismatch' },
        { id: 'gap', label: 'gap' },
        { id: 'multi', label: 'multi' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['accept', 'repeat?'],
        ['score', 'error/SNP'],
        ['extend', 'indel'],
        ['MAPQ down', 'ambig'],
      ],
    ),
    highlight: { active: ['exact:action', 'mm:action', 'gap:action'], compare: ['multi:risk'] },
    explanation: 'Real read mapping is approximate. Exact FM-index seeds are a fast search primitive; scoring and alignment heuristics decide the final record.',
  };
  yield {
    state: labelMatrix(
      'Pipeline guardrails',
      [
        { id: 'ref', label: 'ref ver' },
        { id: 'rg', label: 'read grp' },
        { id: 'dup', label: 'dup' },
        { id: 'qual', label: 'qual' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['coordinate', 'pin'],
        ['sample id', 'keep'],
        ['PCR', 'mark'],
        ['base err', 'filter'],
      ],
    ),
    highlight: { found: ['ref:gate', 'rg:gate', 'dup:gate', 'qual:gate'] },
    explanation: 'Alignment is only one stage. Reproducible genomics also needs reference version, read groups, duplicate marking, base qualities, and downstream variant-calling assumptions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'backward search') yield* backwardSearch();
  else if (view === 'alignment output') yield* alignmentOutput();
  else throw new InputError('Pick a BWA/FM-index view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'The BWA FM-index turns genome alignment from scanning billions of bases into repeatedly narrowing a compressed suffix-array interval.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/ca/Bwt.jpg', alt:'Burrows-Wheeler transform table showing cyclic rotations and the final BWT column', caption:'The Burrows-Wheeler Transform groups cyclic rotations so the final column can support compressed search; BWA builds its FM-index on this transformation. Source: Wikimedia Commons, Msaberi, CC BY-SA 4.0.'},
        'Read the backward-search view from right to left. A read is a short DNA string from a sequencer, a reference genome is the long known DNA text, and a suffix-array interval is a contiguous range of sorted suffixes that still match the seed. Active cells show the interval after each added character; an empty interval means that exact suffix is impossible.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Short-read alignment exists because sequencers produce many small DNA fragments, but analysis needs reference coordinates. A human reference is about 3.2 billion bases, and a run can contain hundreds of millions of reads. The reference is fixed, so building an index once is cheaper than scanning billions of bases for every read.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious exact-search structure is a suffix array. Store every suffix of the reference in sorted order, then binary-search each seed. It is correct, but a full suffix array for 3.2 billion positions uses about 25.6 GB with 64-bit positions before storing the reference or alignment buffers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is memory and locality. A large suffix array may fit on a server, but it leaves less room for threads, scoring buffers, and operating system cache. Binary search also jumps to random suffix positions, so cache misses become part of query cost.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The Burrows-Wheeler Transform, or BWT, lets the index search suffix-array intervals through rank counts instead of storing every suffix position. The FM-index stores the BWT plus C and Occ tables. C[c] counts characters smaller than c, and Occ(c, i) counts c in the BWT prefix ending at i.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Backward search consumes a seed from right to left. For character c and current interval [lo, hi), it computes lo2 = C[c] + Occ(c, lo) and hi2 = C[c] + Occ(c, hi). If lo2 < hi2, the new interval contains every suffix beginning with c plus the pattern already consumed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is exact interval meaning. After k consumed characters, [lo, hi) contains exactly the suffix-array rows whose suffixes begin with those k characters. The LF-mapping property of the BWT preserves the relative order of suffixes with the same preceding character, so C plus Occ maps the old interval to the correct extended interval.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exact seed search costs O(m) rank queries for seed length m, independent of reference length after the index is built. Locating a hit costs extra LF-mapping steps until a sampled suffix-array coordinate is reached. When the reference doubles, index space and build time roughly double, but a 20-base seed still takes about 20 interval updates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'BWA-style FM-index alignment fits whole-genome and exome pipelines where many short reads are mapped to one reference. Exact seeds produce candidate locations, then scoring handles sequencing errors, variants, gaps, and paired-end constraints. The same compressed-index idea appears in Bowtie-style aligners and compressed text search systems.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the reference lacks the sequence being searched, such as novel insertions, contamination, or organisms missing from a database. It also struggles in repeats because an interval with 10,000 hits creates too many candidate alignments. High-error long reads often use minimizer indexes because exact backward-search seeds are less stable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use toy reference ACGTACGT$ and seed ACGT. Adding T might give interval [7, 9), adding G narrows to suffixes beginning GT, adding C narrows to CGT, and adding A leaves one row for ACGT. Mapping read ACGTNNNN can emit a record like 4M4S: four matched bases and four soft-clipped ambiguous bases.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Li and Durbin, "Fast and accurate short read alignment with Burrows-Wheeler transform," at https://pubmed.ncbi.nlm.nih.gov/19451168/; Ferragina and Manzini, "Opportunistic data structures with applications"; BWA source at https://github.com/lh3/bwa; and SAM/BAM specification at https://samtools.github.io/hts-specs/SAMv1.pdf.',
        'Study Suffix Array, Burrows-Wheeler Transform, Wavelet Tree rank support, Edit Distance, Genome k-mer Minimizer Index, and De Bruijn Graph Genome Assembly next.',
      ],
    },
  ],
};
