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
        "Read the animation as the execution trace for BWA FM-index Read Alignment Case Study. A short-read alignment case study: reference BWT, FM-index occurrence counts, backward search intervals, seed extension, mismatches, mapping quality, and SAM output..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Short-read alignment asks where millions or billions of sequenced fragments came from in a known reference genome. Each read is small, but the reference is large and the batch is enormous.',
        'A mapper can\'t scan the whole genome for every read. It has to preprocess the reference into a search structure, then reuse that structure across all reads.',
        'BWA-style alignment uses the FM-index for that job. The index stores the reference in a compressed form while still supporting exact seed lookup through backward search.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest mapper tries each read at each reference position and scores the alignment. That is easy to trust but unusable at genome scale.',
        'A better baseline is a suffix array. Sort every suffix of the reference, binary-search read seeds, and locate candidate positions. That makes exact matching fast, but a full suffix array over a large genome uses a lot of memory.',
        'The FM-index keeps the suffix-array search behavior without storing the entire suffix array densely. It trades some locate work for much lower memory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The exact wall is repeated indexed search. A human genome reference is large, and a sequencing run asks the same reference-search question millions of times.',
        'The mapper needs exact seed lookup, compact storage, and a way to recover coordinates after the search. It also needs to survive repeats, because an exact seed can match many loci.',
        'The FM-index solves the exact-search and storage part. It doesn\'t solve the whole biological alignment problem. Mismatches, gaps, paired-end constraints, and mapping quality are later layers.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The index starts from the Burrows-Wheeler Transform of the reference plus a sentinel character. The BWT stores the character that precedes each suffix in suffix-array order.',
        'The C table stores where each character block begins in the sorted first column. The Occ table answers rank queries: how many times a character appears in the BWT before a given row.',
        'Sampled suffix-array positions let the mapper convert final interval rows back into reference coordinates without storing every suffix-array value.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Backward search consumes the seed from right to left. After reading a suffix of the seed, the algorithm maintains a suffix-array interval containing exactly the reference suffixes that start with that consumed suffix.',
        'To add the next character c, the mapper uses C and Occ to keep only rows whose preceding character is c. The interval shrinks without scanning the reference text.',
        'When the seed is consumed, the interval contains all exact matches for that seed. The mapper locates candidate positions, extends or scores them, and emits SAM/BAM fields such as position, CIGAR, flags, tags, and mapping quality.',
      ],
    },
    {
      heading: 'Worked intuition',
      paragraphs: [
        'For the seed ACGT, backward search starts with T. The interval contains suffixes that begin with T. Adding G keeps only suffixes beginning with GT. Adding C keeps CGT. Adding A keeps ACGT.',
        'Each step asks a narrow question: among suffixes already matching the suffix I have, which ones have this next character immediately before them?',
        'If the interval becomes empty, the exact seed is absent. If it remains large, the seed is repetitive and later scoring must decide whether any candidate is useful.',
      ],
    },
    {
      heading: 'From seeds to alignments',
      paragraphs: [
        'The FM-index usually finds exact seeds, not the whole biological answer. A seed is a short substring of the read that is likely to survive sequencing error and real variation. The mapper uses it to find candidate loci quickly, then spends heavier scoring work only on those loci.',
        'Extension compares the read against the reference around each candidate. Mismatches may represent sequencing error, a SNP, contamination, or a bad candidate. Gaps may represent insertions, deletions, or alignment artifacts. The CIGAR string is the compact record of that chosen edit path.',
        'Paired-end reads add another constraint. If two reads came from opposite ends of the same fragment, their orientations and distance should be plausible. A weak seed can become credible when its mate lands in the expected neighborhood, and a good exact seed can lose confidence when its mate contradicts it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The backward-search invariant gives the correctness argument. After each character is added, the interval contains exactly the suffix-array rows whose suffixes start with the consumed pattern suffix.',
        'C and Occ preserve that invariant because the BWT records preceding characters in suffix-array order. LF-mapping moves from a range of matched suffixes to the range that also has the next required character before it.',
        'The seed search is exact. The final read alignment isn\'t a formal proof of origin; it is a scored choice under read errors, repeats, variants, quality values, and mapper heuristics.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The index is built once per reference and reused. Build cost is paid upfront. Query cost for an exact seed is proportional to seed length times the cost of rank queries, plus the cost of locating candidate positions.',
        'The expensive cases are repetitive seeds and extension. A repetitive seed can leave a large interval, so the mapper may need to cap hits, choose longer seeds, use paired-end evidence, or lower confidence.',
        'Suffix-array sampling controls a direct tradeoff. Denser samples locate positions faster and use more memory. Sparser samples save memory and require more LF steps to recover coordinates.',
      ],
    },
    {
      heading: 'Mapping quality as uncertainty',
      paragraphs: [
        'Mapping quality is not base quality. Base quality estimates the chance that a sequenced base is wrong. Mapping quality estimates confidence in the chosen placement of the read. A read can have high base quality and low mapping quality if it matches several repeat copies equally well.',
        'A high MAPQ value usually means the best alignment is much better than the alternatives under the mapper model. A low value means downstream tools should treat the coordinate carefully. Variant callers, duplicate marking, coverage estimates, and structural-variant tools all inherit this uncertainty.',
        'This is why the FM-index interval size matters beyond speed. A large interval is evidence that the seed is not specific. The mapper may extend several hits, cap the candidate count, use the mate, or report secondary and supplementary alignments.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Pin the reference build. Coordinates only mean something relative to a specific reference FASTA, decoy set, alt-contig policy, and index build. A pipeline that mixes references can produce valid-looking SAM records that are biologically meaningless.',
        'Choose seed length and hit caps from the workload. Short seeds are sensitive but repetitive. Long seeds are specific but break under errors and variants. Good mappers tune these choices with read length, error profile, genome repetitiveness, and expected variant distance in mind.',
        'Store enough index metadata to make loading boring. The mapper needs the BWT, C table, rank data, suffix-array sampling policy, contig dictionary, and reference names in agreement. Serialization bugs here look like alignment bugs later.',
        'Keep exact search and scoring conceptually separate in tests. Unit examples should prove that backward search returns the right suffix-array interval. Alignment fixtures should separately test CIGAR construction, clipping, paired-end rescue, MAPQ behavior, and reporting of multiple hits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'FM-index alignment fits high-volume short-read mapping against a known reference. The reference is static, the read set is huge, and exact seeds are a cheap way to find candidate loci.',
        'It is also a clean example of compressed indexing. BWT, rank queries, suffix-array intervals, and sampled locate data cooperate to make a large text searchable without keeping the plain suffix array in memory.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The method struggles when the correct sequence is absent from the reference. The index can only search the reference it was built from.',
        'It also struggles in highly repetitive regions, structural variation, contamination, and reads whose errors destroy useful seeds. Mapping quality exists because exact hits can still be ambiguous.',
        'It isn\'t de novo assembly. It places reads onto a reference coordinate system; it doesn\'t reconstruct a genome from scratch.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: BWA paper at https://pubmed.ncbi.nlm.nih.gov/19451168/, BWA docs at https://bio-bwa.sourceforge.net/bwa.shtml, and BWA source at https://github.com/lh3/bwa.',
        'Study FM-index BWT for the index mechanics, Suffix Array for the sorted-suffix view, Wavelet Tree for rank support, Edit Distance for approximate alignment, Genome k-mer Minimizer Index for long-read seeding, De Bruijn Graph Genome Assembly for assembly, and Pangenome Variation Graph for reference-bias reduction.',
      ],
    },
      {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for bwa-fm-index-read-alignment-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

