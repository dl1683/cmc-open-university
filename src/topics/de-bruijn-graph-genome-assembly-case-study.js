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
      heading: 'Why this exists',
      paragraphs: [
        `Genome assembly starts with fragments. A sequencer does not hand the assembler a chromosome with coordinates and annotations. It hands over many reads: short or long strings of bases sampled from unknown positions, with coverage variation, errors, adapters, repeats, and sometimes mixed biological sources. The assembler has to infer longer sequence from local evidence.`,
        `A de Bruijn graph exists because the direct evidence is highly redundant. If a genome region is covered many times, thousands of reads may contain the same short substrings. Comparing all reads to all other reads repeats that evidence again and again. The graph changes the unit of work from whole reads to k-mers, which are length-k substrings. Identical k-mers are merged, their counts become coverage evidence, and their overlaps form a directed graph.`,
        `This representation is especially important for high-throughput short-read assembly. Short reads provide enormous coverage but limited long-range context. A de Bruijn graph compresses shared local context while preserving branch points where the data is ambiguous. It does not magically solve repeats or errors. It gives the assembler a structure where those problems become explicit nodes, edges, coverage counts, tips, bubbles, and unresolved branches.`,
      ],
    },
    {
      heading: 'Why the obvious approach fails',
      paragraphs: [
        `The obvious approach is overlap-layout-consensus. Compare reads to other reads, find suffix-prefix overlaps, arrange the reads into a layout, and compute a consensus sequence. That is a natural model because reads are the raw observations. It is also powerful when reads are long enough that overlaps carry distinctive context.`,
        `For large short-read datasets, the pairwise version runs into scale. If there are millions or billions of reads, the number of possible read pairs is enormous. Indexes and filters help, but the assembler still spends effort deciding which whole-read overlaps matter. Sequencing errors create near-overlaps that look plausible enough to inspect. Repeats create true overlaps between reads from different genomic locations.`,
        `The deeper problem is duplicated local evidence. If ten thousand reads contain the same internal k-mer, an overlap graph may represent that fact many times through many read-to-read edges. The assembler needs to merge identical local evidence early. A de Bruijn graph does that by counting k-mers and connecting them by exact k-1 overlap, turning repeated observations into coverage instead of repeated pairwise records.`,
      ],
    },
    {
      heading: 'Core data model',
      paragraphs: [
        `A k-mer is a substring of length k. For the read ATGACT and k=3, the k-mers are ATG, TGA, GAC, and ACT. Consecutive k-mers overlap by k-1 bases: ATG and TGA share TG, TGA and GAC share GA, and so on. The de Bruijn graph stores those local adjacency facts.`,
        `There are two common but equivalent views. In one view, k-mers are nodes and directed edges connect k-mers that overlap by k-1 bases. In another view, (k-1)-mers are nodes and observed k-mers are edges. Both encode the same idea: sequence reconstruction becomes graph traversal over local overlaps. This file uses the k-mer-node view for the visual case study because it makes coverage and error branches easy to see.`,
        `Coverage is not an afterthought. Each node or edge can carry how many times it was observed. High coverage suggests a true genomic path, while a single observation may be a sequencing error, contamination, or a real low-frequency sequence. The graph therefore stores both topology and statistical support. Assembly decisions depend on both.`,
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        `The assembler first chooses k and counts k-mers from the read set. Very low-count k-mers may be discarded or marked as suspicious before graph construction, depending on the pipeline and expected coverage. The remaining k-mers become graph nodes or edges, and observed k-1 overlaps define adjacency. This step compresses the reads into distinct local contexts plus counts.`,
        `Next, the graph is simplified. A non-branching path can be compacted because each internal node has one predecessor and one successor. That path becomes a contig candidate. Branching regions require caution. A short dead-end branch is called a tip and often comes from a sequencing error near the end of a read. Parallel paths that diverge and rejoin are bubbles, which can come from errors, heterozygosity, small variants, or repeated sequence. Repeats can collapse different genomic locations into the same graph path, producing branches that cannot be resolved locally.`,
        `Finally, the assembler walks safe paths and emits contigs, scaffolds, and often graph evidence. Safe means the path is supported enough and unambiguous enough under the assembler rules. A modern pipeline should preserve coverage and graph structure where possible because a single FASTA contig file can hide the uncertainty that the graph exposed.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The deterministic part is the overlap rule. Consecutive k-mers from a read overlap by exactly k-1 bases, so they create a directed local path. If a genomic region is covered many times and sequenced accurately, its k-mers and adjacencies appear repeatedly. The graph therefore turns repeated local observations into reinforced nodes and edges.`,
        `The statistical part is error separation. Random sequencing errors tend to create rare k-mers because the exact same wrong base at the exact same position is unlikely to be repeated many times. Those rare k-mers often appear as low-coverage tips or small bubbles. Coverage lets the assembler prefer the strongly supported path without doing all pairwise read comparisons.`,
        `The compression part is what gives the structure its power. A million reads covering the same simple region can collapse into one path with high coverage annotations. That path can be traversed once to produce a contig segment. The assembler spends attention where the graph branches, because branch points are where repeats, variants, errors, or insufficient context make the answer nontrivial.`,
      ],
    },
    {
      heading: 'Worked intuition',
      paragraphs: [
        `Take the small sequence ATGACTT and set k=3. Reads that cover this region produce the path ATG -> TGA -> GAC -> ACT -> CTT. If several reads cover the same region, the nodes and edges on that path accumulate coverage. The assembler does not need a separate path for every read; it can keep one graph path with counts.`,
        `Now add one erroneous read, TGATTT. It shares TGA with the main path, then branches through GAT and continues into a short unsupported tail. In the graph, that looks like a low-coverage branch leaving a high-coverage node. If no other evidence supports the branch, a tip-trimming rule can remove it and leave the main contig path intact.`,
        `The same example also shows why assembly is not just mechanical deletion. A low-coverage branch might be a sequencing error, but it might also be a real rare allele, a contaminant, an unevenly covered region, or the edge of an unresolved repeat. The assembler uses coverage, branch length, base quality, read-pair evidence, long reads, and expected ploidy to decide how aggressive cleanup should be.`,
      ],
    },
    {
      heading: 'Correctness and reliability',
      paragraphs: [
        `Correctness is local before it is global. If a read truly contains two adjacent k-mers, the graph can represent that adjacency. But a whole genome is not determined by local adjacency alone. Repeats can create the same local path in multiple genomic locations. If the repeat is longer than the available context, the graph cannot know which copy a read belongs to without extra evidence.`,
        `Reliability therefore depends on the match between k, read length, coverage, error profile, and genome structure. A smaller k increases connectivity and can rescue low-coverage regions, but it also merges more repeats. A larger k separates repeats better when coverage supports it, but it creates more distinct k-mers, fragments low-coverage regions, and makes errors more damaging because one wrong base corrupts multiple k-mers.`,
        `The honest output may be a graph, not a single clean string. If two paths are genuinely ambiguous, forcing one contig can create a misassembly. Reporting a branch, coverage depth, quality warnings, or graph format such as GFA can be more truthful than pretending the assembler resolved information that the data did not contain.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The main memory cost is the k-mer table. Reads are long input streams, but the graph is built from distinct k-mers and their counts. A dataset with many errors, high heterozygosity, contamination, or very high diversity can create many distinct k-mers and inflate memory use. Efficient assemblers use compact encodings, minimizers, Bloom filters, disk-backed counting, partitioning, or succinct graph structures to keep this stage manageable.`,
        `Runtime is shaped by k-mer counting, graph construction, simplification passes, and traversal. Counting touches nearly every base because each read contributes overlapping k-mers. Cleanup can require repeated graph passes because removing one tip or collapsing one bubble can expose another simplification. Traversal is usually cheaper once the graph has been simplified, but branch resolution can still require extra evidence.`,
        `The choice of k is the central tuning knob. A single k may not work equally well across the genome, which is why some assemblers use multiple k values or staged strategies. The practical question is not which k is mathematically elegant. It is which k preserves true adjacency, separates repeats enough, tolerates the coverage distribution, and does not explode memory.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `De Bruijn graphs win when local redundancy is high. Short-read sequencing produces many overlapping fragments from the same genomic regions. Counting k-mers and merging identical local evidence scales better than explicitly reasoning about every read pair. That is why the model became central to short-read assembly systems such as Velvet and many later assemblers.`,
        `They also win as an explanatory structure. A high-coverage straight path says the data strongly supports one local sequence. A low-coverage tip suggests an error or weakly supported branch. A bubble suggests a small variant, sequencing error, or repeat structure. A tangled region warns that the available reads do not provide enough context. The graph preserves uncertainty that a linear output would hide.`,
        `The same idea appears outside genome assembly. Any domain with many overlapping substrings or local transitions can use a de Bruijn-like representation to merge repeated context. The genome case is the canonical teaching example because the alphabet is small, the overlaps are exact or nearly exact, and the tension between compression and ambiguity is easy to see.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The most important failure is repeat collapse. If two locations share the same k-mer path and the reads do not extend far enough to anchor each copy uniquely, local graph structure cannot separate them. The graph may collapse multiple genomic copies into one path with high coverage and multiple branches at the ends. Walking through that region incorrectly can produce a misjoin.`,
        `A second failure is misleading coverage. Coverage is statistical evidence, not truth. PCR bias, GC bias, copy-number variation, contamination, mixed samples, metagenomic diversity, and uneven sequencing can make real sequence look weak or erroneous sequence look strong. Cleanup rules that work on one dataset can be too aggressive on another.`,
        `A third failure is overconfident output. A de Bruijn graph gives a powerful representation, but it does not guarantee a chromosome-scale assembly. Long repeats, structural variation, low coverage, and heterozygosity may require paired-end information, mate pairs, long reads, optical maps, Hi-C, a reference, or manual review. The right implementation exposes these limits through graph evidence and quality metrics.`,
      ],
    },
    {
      heading: 'Operational and implementation guidance',
      paragraphs: [
        `Start with data profiling. Estimate read length, quality distribution, coverage, duplication, adapter contamination, and expected genome size. Those measurements inform k, abundance thresholds, and cleanup aggressiveness. A pipeline that chooses defaults without looking at the data may overfit to a clean textbook dataset and fail on real sequencing output.`,
        `Keep intermediate evidence. K-mer histograms reveal error peaks and coverage peaks. Graph statistics reveal branching, tips, bubbles, and component structure. Assembly metrics such as N50 are useful but incomplete; a high N50 can hide misassemblies. Pair contig metrics with read-back alignment, coverage plots, variant checks, and graph review.`,
        `Implement the graph with memory pressure in mind. Store encoded bases compactly, canonicalize reverse complements when appropriate, avoid storing redundant strings on every edge, and use streaming or partitioned counting for large datasets. Separate algorithmic decisions from biological assumptions: haploid, diploid, metagenomic, and transcriptomic assemblies need different interpretations of bubbles and coverage.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Velvet at https://pmc.ncbi.nlm.nih.gov/articles/PMC2336801/ and the Galaxy de Bruijn graph assembly tutorial at https://training.galaxyproject.org/topics/assembly/tutorials/debruijn-graph-assembly/tutorial.html. Read them with three questions in mind: how k-mers are counted, how graph simplification distinguishes errors from real variation, and how the assembler reports unresolved ambiguity.`,
        `Study Hash Table for k-mer counting, Graph BFS for traversal, Compressed Sparse Row Graph for large graph storage, Bloom Filter for approximate membership, Genome k-mer Minimizer Index for read seeding, BWA FM-index Read Alignment for reference mapping, Pangenome Variation Graph for variation-aware graph representations, and Union-Find if you want another view of connected components and graph simplification.`,
      ],
    },
  ],
};
