// De Bruijn graph assembly: split reads into k-mers, connect overlapping
// k-mers, simplify errors, and walk contigs through the graph.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'de-bruijn-graph-genome-assembly-case-study',
  title: 'De Bruijn Graph Genome Assembly Case Study',
  category: 'Data Structures',
  summary: 'A genome assembly case study: k-mer nodes, (k-1)-overlap edges, coverage counts, tips, bubbles, repeat collapse, graph simplification, and contig walks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['kmer graph', 'graph cleanup'], defaultValue: 'kmer graph' },
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

function dbg(title) {
  return graphState({
    nodes: [
      { id: 'ATG', label: 'ATG', x: 1.0, y: 3.4, note: 'cov 8' },
      { id: 'TGA', label: 'TGA', x: 2.8, y: 3.4, note: 'cov 8' },
      { id: 'GAC', label: 'GAC', x: 4.6, y: 2.1, note: 'cov 7' },
      { id: 'GAT', label: 'GAT', x: 4.6, y: 5.0, note: 'cov 1' },
      { id: 'ACT', label: 'ACT', x: 6.4, y: 2.1, note: 'cov 7' },
      { id: 'CTT', label: 'CTT', x: 8.2, y: 2.1, note: 'cov 7' },
      { id: 'tip', label: 'tip', x: 6.4, y: 5.0, note: 'error' },
    ],
    edges: [
      { id: 'e-ATG-TGA', from: 'ATG', to: 'TGA', weight: 'TG' },
      { id: 'e-TGA-GAC', from: 'TGA', to: 'GAC', weight: 'GA' },
      { id: 'e-TGA-GAT', from: 'TGA', to: 'GAT', weight: 'GA' },
      { id: 'e-GAC-ACT', from: 'GAC', to: 'ACT', weight: 'AC' },
      { id: 'e-ACT-CTT', from: 'ACT', to: 'CTT', weight: 'CT' },
      { id: 'e-GAT-tip', from: 'GAT', to: 'tip', weight: 'AT' },
    ],
  }, { title });
}

function* kmerGraph() {
  yield {
    state: labelMatrix(
      'Reads to k-mers',
      [
        { id: 'r1', label: 'read1' },
        { id: 'r2', label: 'read2' },
        { id: 'r3', label: 'read3' },
        { id: 'r4', label: 'read4' },
      ],
      [
        { id: 'seq', label: 'seq' },
        { id: 'kmers', label: 'k=3' },
      ],
      [
        ['ATGACT', '4 main'],
        ['TGACTT', '4 main'],
        ['ATGACT', '4 main'],
        ['TGATTT', 'err path'],
      ],
    ),
    highlight: { active: ['r1:kmers', 'r2:kmers'], compare: ['r4:kmers'] },
    explanation: 'A de Bruijn assembler breaks reads into k-mers. Nodes are k-mers or (k-1)-mers depending on representation; edges connect overlaps.',
  };
  yield {
    state: dbg('Overlapping k-mers form a graph'),
    highlight: { active: ['ATG', 'TGA', 'GAC', 'ACT', 'CTT', 'e-ATG-TGA', 'e-TGA-GAC', 'e-GAC-ACT', 'e-ACT-CTT'], compare: ['GAT', 'tip'] },
    explanation: 'Consecutive k-mers overlap by k-1 bases. Walking the graph reconstructs contigs without storing every read as a separate path.',
    invariant: 'Graph topology depends on k and read errors.',
  };
  yield {
    state: labelMatrix(
      'Coverage',
      [
        { id: 'ATG', label: 'ATG' },
        { id: 'TGA', label: 'TGA' },
        { id: 'GAC', label: 'GAC' },
        { id: 'GAT', label: 'GAT' },
      ],
      [
        { id: 'cov', label: 'cov' },
        { id: 'action', label: 'action' },
      ],
      [
        ['8', 'keep'],
        ['8', 'keep'],
        ['7', 'keep'],
        ['1', 'suspect'],
      ],
    ),
    highlight: { found: ['ATG:action', 'GAC:action'], removed: ['GAT:action'] },
    explanation: 'Sequencing errors often create low-coverage tips and bubbles. Coverage is a statistical hint, not a perfect truth source.',
  };
  yield {
    state: dbg('A contig is a safe walk through simplified graph'),
    highlight: { active: ['ATG', 'TGA', 'GAC', 'ACT', 'CTT'], removed: ['GAT', 'tip', 'e-GAT-tip'], found: ['e-TGA-GAC', 'e-GAC-ACT'] },
    explanation: 'After cleanup, the assembler walks unambiguous paths into contigs. Repeats, heterozygosity, and low coverage create branching ambiguity.',
  };
}

function* graphCleanup() {
  yield {
    state: dbg('Tips are short dead-end branches'),
    highlight: { removed: ['GAT', 'tip', 'e-GAT-tip'], active: ['TGA'], compare: ['GAC'] },
    explanation: 'A low-coverage dead-end branch is often a sequencing error. Assemblers trim tips when length and coverage rules make the error hypothesis strong.',
  };
  yield {
    state: labelMatrix(
      'Cleanup rules',
      [
        { id: 'tip', label: 'tip' },
        { id: 'bubble', label: 'bubble' },
        { id: 'repeat', label: 'repeat' },
        { id: 'low', label: 'low cov' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dead end', 'trim real'],
        ['parallel', 'collapse var'],
        ['branch', 'misjoin'],
        ['rare', 'lose sample'],
      ],
    ),
    highlight: { active: ['tip:signal', 'bubble:signal'], compare: ['repeat:risk', 'low:risk'] },
    explanation: 'Cleanup is judgment. Removing errors too aggressively can erase true variation or produce misassemblies.',
  };
  yield {
    state: dbg('Repeats create graph ambiguity'),
    highlight: { active: ['TGA', 'GAC', 'GAT', 'e-TGA-GAC', 'e-TGA-GAT'], compare: ['ACT', 'tip'] },
    explanation: 'A repeat shorter than the read context can collapse into one node with multiple incoming or outgoing paths. Paired reads or long reads help resolve those branches.',
  };
  yield {
    state: labelMatrix(
      'Assembler outputs',
      [
        { id: 'contig', label: 'contig' },
        { id: 'graph', label: 'graph' },
        { id: 'cov', label: 'cov' },
        { id: 'qc', label: 'QC' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'need', label: 'need' },
      ],
      [
        ['sequence', 'FASTA'],
        ['branches', 'GFA'],
        ['depth', 'trust'],
        ['N50/errors', 'review'],
      ],
    ),
    highlight: { found: ['contig:need', 'graph:need', 'qc:need'] },
    explanation: 'A modern assembly pipeline should preserve graph and coverage evidence, not only emit a linear contig file.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'kmer graph') yield* kmerGraph();
  else if (view === 'graph cleanup') yield* graphCleanup();
  else throw new InputError('Pick a de Bruijn graph view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['A de Bruijn graph assembler reconstructs genomes by splitting sequencing reads into k-mers and connecting overlapping k-mers. It compresses many reads into graph structure.'] },
    { heading: 'How it works', paragraphs: ['Choose k, count k-mers, connect k-mers that overlap by k-1 bases, simplify likely errors, and walk unambiguous paths into contigs. Coverage and graph topology guide cleanup.'] },
    { heading: 'Case study', paragraphs: ['Reads from ATGACTT produce a main path ATG -> TGA -> GAC -> ACT -> CTT. A single erroneous read creates low-coverage GAT -> tip. Cleanup removes the tip and preserves the high-coverage contig.'] },
    { heading: 'Pitfalls', paragraphs: ['Small k collapses repeats. Large k fragments low-coverage data. Aggressive cleanup can erase true variants. Repeats and heterozygosity make linear contigs less truthful than the graph.'] },
    { heading: 'Why it matters', paragraphs: ['Genome assembly is graph construction under noise. It combines hash tables, graph traversal, coverage statistics, and domain-specific error models.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Velvet paper at https://pmc.ncbi.nlm.nih.gov/articles/PMC2336801/ and Galaxy de Bruijn tutorial at https://training.galaxyproject.org/topics/assembly/tutorials/debruijn-graph-assembly/tutorial.html. Study Graph BFS, Hash Table, Compressed Sparse Row Graph, and Pangenome Variation Graph next.'] },
  ],
};
