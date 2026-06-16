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
    { heading: 'What it is', paragraphs: ['BWA-style aligners use an FM-index over a reference genome to map short reads efficiently. The FM-index is built on the Burrows-Wheeler Transform and supports fast backward search over compressed text.'] },
    { heading: 'How it works', paragraphs: ['Build BWT, occurrence/rank tables, character-start counts, and sampled suffix-array positions. Backward search narrows the suffix-array interval for a read seed. Candidate positions are then extended and scored.'] },
    { heading: 'Case study', paragraphs: ['A read seed ACGT is consumed from right to left. Each character shrinks the interval. The final interval locates candidate reference positions, which are scored into SAM records with position, CIGAR, and mapping quality.'] },
    { heading: 'Pitfalls', paragraphs: ['Exact seed hits are not final alignments. Repeats create many candidate positions. Different reference versions produce different coordinates. Low-quality bases and duplicates can distort downstream variant calls.'] },
    { heading: 'Why it matters', paragraphs: ['FM-index alignment is a canonical real-world use of suffix arrays, BWT, rank/select, and approximate string matching at genome scale.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: BWA paper at https://pubmed.ncbi.nlm.nih.gov/19451168/, BWA docs at https://bio-bwa.sourceforge.net/bwa.shtml, and BWA source at https://github.com/lh3/bwa. Study FM-index BWT, Suffix Array, Wavelet Tree, Edit Distance, and Minimizer Index next.'] },
  ],
};
