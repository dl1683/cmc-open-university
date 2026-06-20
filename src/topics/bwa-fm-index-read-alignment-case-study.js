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
        'The "backward search" view traces the FM-index query path: reference genome to BWT, BWT to Occ and C tables, tables to suffix-array interval, interval to alignment output. Active (green) nodes mark the current phase. Found (blue) marks the structure whose job is complete. The matrix frame shows the interval narrowing character by character from right to left.',
        'The "alignment output" view shows what the mapper emits after search: SAM fields, mapping-quality decisions, mismatch/gap classification, and pipeline guardrails. Active items are the decision under consideration; compare (orange) marks the risk or ambiguity that downstream tools must handle.',
        {
          type: 'note',
          text: 'Matrix cells use short descriptors. "role" columns describe what an index piece does; "cost" columns name the resource it trades. In the alignment view, "action" is what the mapper does; "risk" is what can go wrong with that choice.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The BWA FM-index turns genome alignment from scanning billions of bases into repeatedly narrowing a compressed suffix-array interval.'},
        'A single Illumina sequencing run produces hundreds of millions of short reads, each 100-300 bases long. Every read must be placed onto a reference genome that is 3.2 billion bases for human. The mapper answers the same question for each read: where in the reference did this fragment come from?',
        {
          type: 'quote',
          text: 'We implemented a new read alignment package, BWA, which is based on backward search with the Burrows-Wheeler Transform (BWT), to efficiently align short sequencing reads against a large reference sequence such as the human genome.',
          attribution: 'Li & Durbin, "Fast and accurate short read alignment with Burrows-Wheeler transform" (Bioinformatics 25:1754, 2009)',
        },
        'Scanning the reference for each read is quadratic in aggregate. The mapper must build a search index once, then reuse it across all reads. BWA chose the FM-index: a compressed full-text index that supports exact pattern matching without storing the suffix array in full.',
        {
          type: 'table',
          headers: ['Quantity', 'Human genome scale'],
          rows: [
            ['Reference length', '~3.2 billion bases (GRCh38)'],
            ['Reads per run', '100M-4B (depending on instrument)'],
            ['Read length', '100-300 bp (Illumina short-read)'],
            ['Seed queries per read', '2-10 (depending on seeding strategy)'],
            ['Total seed lookups', 'Hundreds of millions to billions per run'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a suffix array over the reference. Sort all 3.2 billion suffixes lexicographically, then binary-search each read seed in O(m log n) time where m is seed length and n is reference length. This works and is correct.',
        'A suffix array over GRCh38 stores one 64-bit integer per base position: 3.2 billion entries at 8 bytes each, roughly 25 GB for the array alone. Add the reference text and the binary-search access pattern is cache-hostile because each comparison jumps to a random suffix location.',
        {
          type: 'table',
          headers: ['Index structure', 'Memory (human genome)', 'Exact seed query', 'Locate cost'],
          rows: [
            ['Full suffix array', '~25 GB (array) + 3.2 GB (text)', 'O(m log n) binary search', 'O(1) direct lookup'],
            ['FM-index (BWA-style)', '~2.5-5 GB total', 'O(m) backward search', 'O(k) via SA sampling, k = sample gap'],
            ['Hash table (k-mer)', '~12-50 GB depending on k', 'O(1) per k-mer', 'O(1) but fixed k only'],
          ],
        },
        'A hash table on fixed-length k-mers avoids the sorted-suffix overhead but cannot handle variable-length seeds, and memory grows with the alphabet of distinct k-mers. The FM-index compresses the suffix array into a structure that fits in a few gigabytes and answers exact queries in time proportional to seed length, independent of reference length.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is memory. A production aligner runs on shared cluster nodes or clinical workstations with 8-64 GB of RAM. A 25 GB suffix array plus reference text leaves little room for alignment scoring, paired-end buffers, and operating system overhead. Scaling to larger references (pangenomes, metagenomic databases) makes it worse.',
        {
          type: 'bullets',
          items: [
            'A full suffix array over GRCh38 needs ~28 GB. Add scoring buffers, the read batch, and OS overhead, and the mapper needs 40+ GB.',
            'Metagenomic references can exceed 100 GB of sequence. A full suffix array is out of reach on commodity hardware.',
            'Binary search over suffix-array entries causes random memory access per comparison. Cache misses dominate wall-clock time even when the array fits in RAM.',
            'The mapper must also recover reference coordinates from suffix-array positions, but storing all SA values defeats the compression goal.',
          ],
        },
        'The mapper needs the search power of a suffix array without the memory cost of storing it explicitly. It also needs a way to recover reference coordinates from search results, paying locate cost only for the positions that survive seed filtering.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The Burrows-Wheeler Transform rearranges the reference text so that repeated substrings cluster together, making the transformed text highly compressible. But the BWT is not just a compression trick. Combined with two auxiliary tables, it supports exact pattern search without ever consulting the original suffix array.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/c/ca/Bwt.jpg', alt:'Burrows-Wheeler transform table showing cyclic rotations and the final BWT column', caption:'The Burrows-Wheeler Transform groups cyclic rotations so the final column can support compressed search; BWA builds its FM-index on this transformation. Source: Wikimedia Commons, Msaberi, CC BY-SA 4.0.'},
        {
          type: 'diagram',
          label: 'FM-index components',
          text: 'Reference text T (e.g., ACGTACGT$)\n  |\n  v\nBWT construction (sort all rotations, take last column)\n  |\n  +---> BWT[i]   = character preceding the i-th suffix in sorted order\n  +---> C[c]     = number of characters in T lexicographically smaller than c\n  +---> Occ(c,i) = count of character c in BWT[0..i-1]\n  +---> SA samples: every k-th suffix-array value stored explicitly\n\nBackward search formula:\n  lo\' = C[c] + Occ(c, lo)\n  hi\' = C[c] + Occ(c, hi)\n\nIf lo\' < hi\', the pattern suffix has (hi\' - lo\') exact matches.',
        },
        'C[c] tells you where suffixes starting with character c begin in the sorted order. Occ(c, i) tells you how many times c appears in the BWT up to position i. Together, one step of backward search narrows a suffix-array interval in O(1) time per character (with constant-time rank support via precomputed checkpoint blocks).',
        {
          type: 'note',
          text: 'The BWT and the suffix array encode the same information in different forms. The FM-index exploits the fact that you rarely need arbitrary SA lookups during search -- you only need interval boundaries. Storing just the BWT plus rank structures gives you the search, and a sparse sample of SA values gives you the locate step when you actually need coordinates.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'BWA builds the FM-index once per reference genome. The index files (.amb, .ann, .bwt, .pac, .sa) are serialized to disk and reloaded for every alignment run. Build cost is O(n) with suffix-array construction; query cost per seed is O(m) where m is seed length.',
        {
          type: 'code',
          language: 'text',
          text: 'Backward search for seed "ACGT" (read right to left):\n\nStep 1: c = T\n  lo = C[T]                   = 4\n  hi = C[T] + count(T in BWT) = 8\n  Interval [4, 8) -> 4 suffixes start with T\n\nStep 2: c = G\n  lo\' = C[G] + Occ(G, 4)  = 6\n  hi\' = C[G] + Occ(G, 8)  = 8\n  Interval [6, 8) -> 2 suffixes start with GT\n\nStep 3: c = C\n  lo\' = C[C] + Occ(C, 6)  = 6\n  hi\' = C[C] + Occ(C, 8)  = 7\n  Interval [6, 7) -> 1 suffix starts with CGT\n\nStep 4: c = A\n  lo\' = C[A] + Occ(A, 6)  = 6\n  hi\' = C[A] + Occ(A, 7)  = 7\n  Interval [6, 7) -> 1 exact match for ACGT',
        },
        'Each step applies the same formula: lo\' = C[c] + Occ(c, lo), hi\' = C[c] + Occ(c, hi). If lo\' >= hi\' at any point, the seed has no exact match and the mapper must try a shorter seed, allow mismatches, or skip the seed.',
        'After backward search finds a nonempty interval, the mapper must convert suffix-array rows to reference coordinates. BWA stores every k-th SA value (typically k=32). For rows not at a sampled position, the mapper walks backward through the BWT using LF-mapping until it hits a sampled row, then adds the walk distance to the sampled value.',
        {
          type: 'note',
          text: 'BWA-MEM (the successor algorithm for longer reads) does not run pure backward search to completion. It extends seeds maximally in both directions using a SMEM (super-maximal exact match) strategy, finding the longest exact matches that cannot be extended without losing all hits. This is still built on the same FM-index and the same LF-mapping operation.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the backward-search invariant: after consuming k characters from the right end of the seed, the interval [lo, hi) contains exactly the suffix-array rows whose corresponding suffixes begin with those k characters.',
        {
          type: 'bullets',
          items: [
            'Base case: before any character is consumed, the interval is [0, n), covering all suffixes.',
            'Inductive step: if [lo, hi) contains exactly the rows starting with pattern P, then applying the formula with character c keeps exactly the rows starting with cP. This follows from the LF-mapping property: the BWT records the character preceding each sorted suffix, and C + Occ counts precisely how many such predecessors equal c.',
            'Termination: after m characters, the interval contains the exact matches for the full seed. An empty interval is a correct "no match" answer.',
          ],
        },
        'The LF-mapping property is the structural guarantee that makes this work. Row i in the suffix array has BWT[i] as its preceding character. The C table and Occ table together perform a stable sort of those preceding characters, mapping each row in the current interval to the correct row in the interval for the extended pattern.',
        {
          type: 'quote',
          text: 'The key observation is that if T[SA[i]-1] = c, then the suffix T[SA[i]-1..] is the (Occ(c,i)+1)-th suffix that starts with character c. This is because BWT preserves the relative order of suffixes beginning with the same character.',
          attribution: 'Ferragina & Manzini, "Opportunistic data structures with applications" (FOCS 2000)',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time', 'Space', 'Notes'],
          rows: [
            ['Index build', 'O(n)', '~5n bytes on disk', 'One-time cost; BWA index of GRCh38 is ~5 GB'],
            ['Exact seed search', 'O(m)', 'Index in RAM', 'm = seed length; independent of reference size'],
            ['Locate one hit', 'O(k) average', 'SA sample every k rows', 'k = sampling gap (BWA default 32); walk LF-mapping until hitting a sample'],
            ['Extend/score', 'O(m * d)', 'Scoring matrix', 'd = number of candidate positions; Smith-Waterman or banded DP'],
            ['Full read mapping', 'O(m + h*k + scoring)', '--', 'h = number of hits; scoring dominates for repetitive seeds'],
          ],
        },
        'When the reference doubles in length, index build time and disk storage roughly double, but seed query time stays the same because backward search depends on seed length, not reference length. This is why FM-index mappers scale to large genomes and metagenomic databases without query-time regression.',
        'The practical bottleneck is not seed search but extension and scoring. For a unique seed with one hit, the mapper does a short banded alignment and emits the result. For a repetitive seed with thousands of hits, the mapper either caps the candidate count (BWA uses -c flag), extends only the top candidates, or lowers the mapping quality to signal ambiguity.',
        {
          type: 'note',
          text: 'BWA loads the full FM-index into RAM at startup. For GRCh38, this is roughly 3-5 GB depending on SA sampling density. Once loaded, the index is shared across threads. Memory per thread is small (scoring buffers, read batch). This is why BWA runs well on machines with 8+ GB RAM even with 16 threads.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Map a 12-base read ACGTACGTNNNN to a toy reference ACGTACGT$ using BWA-style backward search with a seed of the first 8 exact bases.',
        {
          type: 'table',
          headers: ['Step', 'Action', 'State', 'Result'],
          rows: [
            ['1', 'Build BWT of ACGTACGT$', 'Sort all 9 rotations, take last column', 'BWT = T$TACACGG (example encoding)'],
            ['2', 'Build C table', 'Count chars < each character', 'C[$]=0, C[A]=1, C[C]=3, C[G]=5, C[T]=7'],
            ['3', 'Build Occ table', 'Cumulative char counts in BWT', 'Occ[c][i] for each c in {$,A,C,G,T}'],
            ['4', 'Seed selection', 'Take first 8 bases as seed: ACGTACGT', 'Ignore trailing NNNN (ambiguous bases)'],
            ['5', 'Backward search: T', 'lo=C[T]=7, hi=C[T]+count(T)=9', 'Interval [7,9): 2 suffixes start with T'],
            ['6', 'Backward search: GT', 'lo\'=C[G]+Occ(G,7), hi\'=C[G]+Occ(G,9)', 'Interval narrows to GT-prefixed suffixes'],
            ['7', 'Continue: ...ACGTACGT', 'Repeat for C,A,T,G,C,A', 'Final interval has 1 hit (exact match)'],
            ['8', 'Locate', 'SA sample lookup + LF walk', 'Reference position 0'],
            ['9', 'Score and emit', 'Banded alignment around pos 0', 'SAM: chr1, pos=1, CIGAR=8M4S, MAPQ=60'],
          ],
        },
        'The CIGAR 8M4S means 8 bases matched and 4 bases were soft-clipped (the NNNN tail). MAPQ 60 indicates high confidence because only one locus matched the 8-base seed exactly. If the reference contained a second copy of ACGTACGT, the mapper would find interval size 2, extend both candidates, and lower MAPQ to reflect the ambiguity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Why FM-index alignment fits', 'Scale'],
          rows: [
            ['Whole-genome sequencing (WGS)', 'Billions of 150 bp reads against one reference; seed search must be sublinear', '30-60x coverage, ~900M reads'],
            ['Exome sequencing', 'Same mapper, smaller target; FM-index is the same, read volume is lower', '~100M reads'],
            ['RNA-seq (with splice-aware wrapper)', 'STAR/HISAT2 use FM-index internals for splice-junction discovery', '~50-200M reads'],
            ['Metagenomics', 'Reference databases can exceed 100 GB; FM-index compression is essential', 'Thousands of genomes in one index'],
            ['Clinical variant calling', 'GATK best practices start with BWA-MEM alignment; regulatory pipelines depend on it', 'Per-patient, time-sensitive'],
          ],
        },
        'BWA-MEM is the default short-read aligner in the Broad Institute GATK best-practices pipeline, the most widely used clinical and research variant-calling workflow. The FM-index is also the backbone of Bowtie2 (educational and research use) and HISAT2 (splice-aware RNA-seq alignment using a hierarchical FM-index).',
        'Beyond genomics, FM-index backward search appears in compressed text indexing for natural-language corpora, pan-genome indexing (where the "reference" is a collection of genomes), and any domain where the text is large, static, and queried millions of times.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Reference bias. The FM-index can only find sequences present in the reference it was built from. Reads carrying novel insertions, structural variants, or sequences from organisms absent in the reference will fail seed search or align incorrectly. Pangenome graphs address this by indexing population variation, not a single linear reference.',
            'Highly repetitive regions. Centromeres, telomeres, segmental duplications, and Alu elements produce seeds that match thousands of loci. The mapper must cap candidates or report low MAPQ, and downstream tools lose power in these regions.',
            'Long reads. PacBio and Oxford Nanopore reads are thousands to millions of bases with higher error rates. Pure backward search is too brittle for high-error seeds. BWA-MEM uses SMEMs and re-seeding, but dedicated long-read mappers (minimap2) use minimizer-based indexing instead of FM-index.',
            'Dynamic references. The FM-index is static: adding a contig requires rebuilding the entire index. For databases that grow (e.g., NCBI nt), this rebuild cost is nontrivial.',
            'De novo assembly. FM-index alignment places reads onto an existing coordinate system. It does not reconstruct a genome from scratch. Assembly uses overlap graphs or de Bruijn graphs, not reference-based seed search.',
          ],
        },
        {
          type: 'note',
          text: 'Mapping quality is the mapper admitting uncertainty, not a bug. A MAPQ of 0 means "I placed this read somewhere but I have no confidence it belongs there." Downstream tools that ignore MAPQ inherit false positives. The FM-index gives you fast search; it does not give you biological truth.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Li & Durbin, "Fast and accurate short read alignment with Burrows-Wheeler transform" (Bioinformatics 25:1754-1760, 2009): https://pubmed.ncbi.nlm.nih.gov/19451168/ -- the original BWA paper describing backward search, inexact matching via bounded-depth tree traversal, and the seed-and-extend strategy.',
            'Ferragina & Manzini, "Opportunistic data structures with applications" (FOCS 2000): the theoretical foundation for FM-index, proving O(m) search time in O(n * H_k) compressed space where H_k is the k-th order empirical entropy.',
            'BWA source code: https://github.com/lh3/bwa -- C implementation; bwt.c contains the core backward-search loop and LF-mapping; bwase.c and bwape.c handle single-end and paired-end alignment logic.',
            'SAM/BAM format specification: https://samtools.github.io/hts-specs/SAMv1.pdf -- defines the output format that all FM-index aligners produce.',
          ],
        },
        'Prerequisite: study Suffix Array for the sorted-suffix foundation that the FM-index compresses, and Burrows-Wheeler Transform for the rotation-sort construction that produces the BWT column.',
        'Extensions: Wavelet Tree for how Occ rank queries can be answered in O(1) time over large alphabets. Edit Distance for the scoring model that turns exact seeds into approximate alignments. Genome k-mer Minimizer Index for the alternative seeding strategy used by minimap2 for long reads.',
        'Contrast: De Bruijn Graph Genome Assembly solves the reconstruction problem (assembly) rather than the placement problem (alignment). Pangenome Variation Graph indexes population-level variation to reduce the reference bias that a single linear FM-index cannot avoid.',
      ],
    },
  ],
};

