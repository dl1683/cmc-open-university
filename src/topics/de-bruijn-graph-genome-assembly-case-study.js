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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a compression of sequencing reads into local overlap structure. A read is a string of DNA bases produced by a sequencer, and a k-mer is a substring of length k. Active nodes are k-mers being counted or connected, found paths are supported contig candidates, and compare branches are places where errors, repeats, or variants compete.',
        'The safe inference rule is local. Consecutive k-mers from one read overlap by k - 1 bases, so they form a directed adjacency. A non-branching high-coverage path can be compacted, but a branch is evidence that local data no longer gives one safe answer.',
        {type:'callout', text:'A de Bruijn assembler compresses redundant reads into k-mer topology so ambiguity, errors, repeats, and coverage become graph features instead of hidden read-pair chaos.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9d/DeBruijn-as-line-digraph.svg', alt:'Binary de Bruijn graphs shown as successive line digraph constructions.', caption:'De Bruijn graphs as line digraphs. Source: Wikimedia Commons, David Eppstein, public domain.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Genome assembly starts with fragments, not chromosomes. A sequencer returns many short or long reads sampled from unknown positions, with errors, uneven coverage, adapters, repeats, and sometimes mixed biological sources. The assembler has to infer longer sequence from local evidence.',
        'A de Bruijn graph exists because short-read data is highly redundant. Thousands of reads may contain the same local substring. The graph merges identical k-mers, counts their support, and records their k - 1 overlaps as directed edges.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is overlap-layout-consensus. Compare reads to reads, find suffix-prefix overlaps, lay out the reads, and compute a consensus sequence. This works well when reads are long enough that overlaps carry distinctive context.',
        'For short reads at high coverage, pairwise overlap becomes expensive. If there are 10 million reads, the naive pair count is about 50 trillion pairs. Filters reduce that number, but the assembler still spends effort rediscovering the same local evidence many times.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is duplicated local evidence. If 10,000 reads contain the same internal 31-mer, a read-overlap graph can represent that fact through many read-to-read edges. The assembler should merge identical local evidence early and keep the count as coverage.',
        'The second wall is ambiguity. Sequencing errors create rare branches, repeats create true branches shared by different genome locations, and heterozygosity creates alternate paths. Whole-read overlaps hide these cases inside many pairwise decisions, while a graph exposes them as topology.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Change the unit of assembly from reads to k-mers. A k-mer-node graph stores each distinct k-mer once and connects it to k-mers that overlap by k - 1 bases. Coverage turns repeated observations into weights rather than duplicate structures.',
        'There is an equivalent edge view where (k - 1)-mers are nodes and k-mers are edges. Both encode the same local constraint. The important idea is that sequence reconstruction becomes graph traversal over compressed local overlaps.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The assembler chooses k and counts k-mers from the reads. Very low-count k-mers may be removed or marked suspicious because random errors often appear only once. The remaining k-mers become nodes or edges, and observed k - 1 overlaps create directed adjacency.',
        'The graph is then simplified. A non-branching path, where internal nodes have one predecessor and one successor, can be compacted into a contig candidate. A short dead-end branch is a tip, and parallel paths that diverge and rejoin are bubbles.',
        'Finally, the assembler emits safe contigs and preserves uncertainty where the graph is ambiguous. Pair reads, long reads, coverage, base quality, and expected ploidy can help resolve branches. A modern pipeline should retain graph evidence because a single FASTA output can hide unresolved choices.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The deterministic part is the overlap rule. Adjacent k-mers from a true read overlap by exactly k - 1 bases, so each read contributes a path through the graph. If a genomic region is covered many times and sequenced accurately, the same nodes and edges receive repeated support.',
        'The statistical part is error separation. A random wrong base usually creates several rare k-mers, because the exact same error at the exact same position is unlikely to recur. Those rare k-mers tend to form low-coverage tips or bubbles that can be removed when the coverage model supports that decision.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main memory cost is the distinct k-mer table. Reads are input streams, but the graph stores unique k-mers, counts, and adjacency. Errors, high heterozygosity, contamination, and metagenomic diversity increase the number of distinct k-mers and can inflate memory sharply.',
        'Runtime is shaped by k-mer counting, graph construction, cleanup passes, and traversal. Counting touches nearly every base because each read contributes overlapping k-mers. Cleanup may require repeated passes because trimming one tip can expose another simplification.',
        'The value of k is the central tuning knob. Smaller k connects low-coverage regions but collapses more repeats. Larger k separates repeats better when coverage supports it, but one sequencing error corrupts more distinct k-mers and can fragment the graph.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'De Bruijn graphs are central to short-read genome assembly because the data has high local redundancy. Assemblers such as Velvet helped establish the model for high-throughput short reads. The access pattern is count many overlapping substrings, merge identical evidence, then spend attention at branches.',
        'The representation also teaches uncertainty. A high-coverage straight path says the local sequence is well supported. A low-coverage tip suggests an error or weak branch, while a bubble suggests a small variant, sequencing error, or repeat structure.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The major failure is repeat collapse. If two genome locations share the same k-mer path and reads do not extend far enough to anchor each copy, the local graph cannot separate them. The assembler may collapse multiple copies into one path with high coverage and branchy ends.',
        'Coverage can also mislead. PCR bias, GC bias, copy-number variation, contamination, mixed samples, and uneven sequencing can make true sequence look weak or erroneous sequence look strong. Cleanup settings that work on a clean haploid sample can damage a metagenomic or heterozygous sample.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the true sequence ATGACTT with k = 3. Its k-mers are ATG, TGA, GAC, ACT, and CTT. The graph path is ATG -> TGA -> GAC -> ACT -> CTT, and five reads covering the region raise the coverage on those nodes and edges to about 5.',
        'Add one erroneous read TGATTT. It shares TGA, then creates GAT, ATT, and TTT as a low-coverage side branch. If the main path has coverage 5 and the error path has coverage 1, a tip-trimming rule can remove the unsupported tail.',
        'Now change the case to a real repeat. If another genome location also contains TGA followed by GAC, that shared path may have high coverage rather than low coverage. The assembler cannot delete it as an error; it needs longer context or must report ambiguity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Velvet at https://pmc.ncbi.nlm.nih.gov/articles/PMC2336801/ and the Galaxy de Bruijn graph assembly tutorial at https://training.galaxyproject.org/topics/assembly/tutorials/debruijn-graph-assembly/tutorial.html. Then study hash tables for k-mer counting, graph traversal, compressed sparse row graphs, Bloom filters, minimizer indexes, FM-index read alignment, pangenome variation graphs, and union-find for connected components.',
      ],
    },
  ],
};
