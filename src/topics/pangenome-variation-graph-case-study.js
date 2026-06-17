// Pangenome variation graphs: represent many genomes as paths through one graph
// so reads can align to alleles absent from a single linear reference.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'pangenome-variation-graph-case-study',
  title: 'Pangenome Variation Graph Case Study',
  category: 'Data Structures',
  summary: 'A pangenomics case study: sequence-labeled graph nodes, haplotype paths, variants as bubbles, graph indexes, minimizer seeds, GBWT-style path indexes, and reference-bias reduction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['variation graph', 'graph mapping'], defaultValue: 'variation graph' },
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

function vg(title) {
  return graphState({
    nodes: [
      { id: 'n1', label: 'A', x: 0.8, y: 3.4, note: 'seq' },
      { id: 'ref', label: 'C', x: 2.7, y: 2.0, note: 'ref' },
      { id: 'alt', label: 'G', x: 2.7, y: 4.8, note: 'alt' },
      { id: 'n3', label: 'T', x: 4.7, y: 3.4, note: 'seq' },
      { id: 'ins', label: 'AA', x: 6.4, y: 2.0, note: 'ins' },
      { id: 'n4', label: 'C', x: 8.0, y: 3.4, note: 'seq' },
      { id: 'path', label: 'paths', x: 6.2, y: 5.5, note: 'haps' },
    ],
    edges: [
      { id: 'e-n1-ref', from: 'n1', to: 'ref' },
      { id: 'e-n1-alt', from: 'n1', to: 'alt' },
      { id: 'e-ref-n3', from: 'ref', to: 'n3' },
      { id: 'e-alt-n3', from: 'alt', to: 'n3' },
      { id: 'e-n3-ins', from: 'n3', to: 'ins' },
      { id: 'e-ins-n4', from: 'ins', to: 'n4' },
      { id: 'e-n3-n4', from: 'n3', to: 'n4' },
      { id: 'e-path-ref', from: 'path', to: 'ref' },
      { id: 'e-path-alt', from: 'path', to: 'alt' },
    ],
  }, { title });
}

function* variationGraph() {
  yield {
    state: vg('Variants become bubbles in a sequence graph'),
    highlight: { active: ['n1', 'ref', 'alt', 'n3', 'e-n1-ref', 'e-n1-alt', 'e-ref-n3', 'e-alt-n3'], compare: ['ins'] },
    explanation: 'A variation graph represents multiple genomes as paths through sequence-labeled nodes. A SNP or small variant appears as a bubble with alternative branches.',
  };
  yield {
    state: labelMatrix(
      'Graph objects',
      [
        { id: 'node', label: 'node' },
        { id: 'edge', label: 'edge' },
        { id: 'path', label: 'path' },
        { id: 'index', label: 'index' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'role', label: 'role' },
      ],
      [
        ['DNA seq', 'bases'],
        ['adjacent', 'walks'],
        ['haplotype', 'sample'],
        ['seeds', 'mapping'],
      ],
    ),
    highlight: { active: ['node:stores', 'edge:stores', 'path:stores'], found: ['index:role'] },
    explanation: 'The graph is not only topology. It also stores embedded haplotype paths and indexes that make read mapping practical.',
    invariant: 'A pangenome graph should preserve paths, not only variant sites.',
  };
  yield {
    state: vg('Insertions and deletions are alternate walks'),
    highlight: { active: ['n3', 'ins', 'n4', 'e-n3-ins', 'e-ins-n4'], compare: ['e-n3-n4'] },
    explanation: 'Insertions, deletions, inversions, and structural variants can be encoded as alternative walks. The graph avoids forcing all samples through one linear reference allele.',
  };
  yield {
    state: labelMatrix(
      'Bias reduction',
      [
        { id: 'linear', label: 'linear' },
        { id: 'graph', label: 'graph' },
        { id: 'hap', label: 'haps' },
        { id: 'complex', label: 'complex' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['simple coord', 'ref bias'],
        ['many alleles', 'hard index'],
        ['real paths', 'storage'],
        ['SVs', 'topology'],
      ],
    ),
    highlight: { active: ['graph:benefit', 'hap:benefit'], compare: ['graph:cost', 'complex:cost'] },
    explanation: 'Graph references can reduce reference bias, but they add indexing, coordinate, visualization, and validation complexity.',
  };
}

function* graphMapping() {
  yield {
    state: vg('Reads map to paths, not one coordinate line'),
    highlight: { active: ['path', 'ref', 'alt', 'e-path-ref', 'e-path-alt'], found: ['n1', 'n3'] },
    explanation: 'A read mapper can seed against graph paths, cluster hits by graph distance, and align through alleles that are not present in a single reference genome.',
  };
  yield {
    state: labelMatrix(
      'Graph mapping indexes',
      [
        { id: 'min', label: 'minimizer' },
        { id: 'dist', label: 'dist idx' },
        { id: 'gbwt', label: 'GBWT' },
        { id: 'xg', label: 'graph idx' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['seed hits', 'repeat'],
        ['cluster', 'complex'],
        ['hap paths', 'memory'],
        ['topology', 'updates'],
      ],
    ),
    highlight: { active: ['min:role', 'dist:role', 'gbwt:role'], compare: ['xg:risk'] },
    explanation: 'Practical pangenome mappers combine minimizer indexes, graph-distance indexes, haplotype path indexes, and topology indexes.',
  };
  yield {
    state: labelMatrix(
      'Build checks',
      [
        { id: 'dup', label: 'dup seq' },
        { id: 'degree', label: 'degree' },
        { id: 'path', label: 'paths' },
        { id: 'coord', label: 'coord' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['bloat', 'compact'],
        ['hard map', 'normalize'],
        ['lost haps', 'restore'],
        ['lift fail', 'anchor'],
      ],
    ),
    highlight: { found: ['dup:fix', 'degree:fix', 'path:fix', 'coord:fix'] },
    explanation: 'Graph construction quality matters. Duplicated sequence, high-degree tangles, missing paths, and weak coordinate anchors make downstream mapping worse.',
  };
  yield {
    state: vg('Graph outputs need replayable provenance'),
    highlight: { active: ['path', 'n1', 'ref', 'alt', 'n3'], found: ['ins'], compare: ['n4'] },
    explanation: 'A pangenome graph should carry build inputs, sample paths, graph normalization steps, indexes, and reference-coordinate mappings so results can be replayed.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'variation graph') yield* variationGraph();
  else if (view === 'graph mapping') yield* graphMapping();
  else throw new InputError('Pick a pangenome graph view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'A linear reference genome is a powerful coordinate system, but it is only one path through the variation present in a population. It stores one sequence as the main text and describes other alleles as edits against that text. That is convenient for tools and reports, but it gives the reference allele a privileged position.',
        'The privilege shows up as reference bias. A read carrying an alternate allele, insertion, deletion, or population-specific sequence can map poorly because the aligner searches a path that does not contain the true sequence. The read may receive lower mapping quality, appear as mismatches, become soft-clipped, or fail to seed in the first place.',
        'A pangenome variation graph exists to make multiple genome paths first-class. Shared sequence is represented once, variants become branches, and known haplotypes or assemblies are stored as paths through the same graph. The mapper can then search the variation space directly instead of treating every sample as a damaged copy of one reference.',
      ],
    },
    {
      heading: 'Why The Linear Baseline Fails',
      paragraphs: [
        'The obvious baseline is a reference FASTA plus variant records. Reads map to the reference, differences are called, and variants are stored by chromosome and coordinate. This works well when samples are close to the reference, variants are small, and downstream tools need familiar linear positions.',
        'The baseline fails when the reference path is the wrong substrate for search. A variant file can annotate alternate alleles, but the mapper still has to find a seed and alignment against the one reference path. If important sequence is absent from that path, the read may never reach the stage where the variant annotation helps.',
        'Large cohorts add another problem: co-occurrence. A list of variants does not automatically say which alleles appear together on real haplotypes. A pangenome graph can store named paths, so it can distinguish observed genome walks from arbitrary combinations of local branches.',
      ],
    },
    {
      heading: 'Core Data Model',
      paragraphs: [
        'A variation graph uses sequence-labeled nodes and directed edges. A walk through nodes spells DNA. A named path records a reference chromosome, sample haplotype, assembly contig, transcript, or other biologically meaningful sequence. The graph is not just topology; it is sequence plus paths plus metadata plus indexes.',
        'A single-nucleotide variant becomes a bubble: the graph enters a shared context, splits into alternate branches, and rejoins. An insertion is an alternate walk that includes extra sequence. A deletion is a walk that skips a segment. More complex structural variation can become larger alternate walks, inversions, or tangles depending on the representation.',
        'The important invariant is path preservation. If the graph claims to contain a haplotype, walking that path should spell the haplotype sequence. Graph normalization, compaction, sorting, or simplification must preserve path spellings or record how coordinates changed.',
      ],
    },
    {
      heading: 'Graph Construction',
      paragraphs: [
        'A graph can be built from a reference plus VCF variants, from multiple assemblies, from local haplotypes, or from a combination. Construction usually identifies shared sequence, splits sequence at variation boundaries, creates edges for alternate walks, and threads known genomes through the result as named paths.',
        'Construction quality matters because graph mistakes become mapping mistakes. Duplicated sequence can inflate memory and create ambiguous seeds. Missing paths can remove true alleles. High-degree tangles can make search expensive. Weak reference-coordinate anchors can make downstream projection confusing. A graph build should therefore store inputs, normalization steps, path sources, and coordinate maps.',
        'There is no free conversion from all variation into a perfect graph. The builder must choose granularity, phasing assumptions, sample inclusion, repeat handling, and normalization rules. Those choices determine whether the graph is a clean search structure or an impressive but hard-to-map knot.',
      ],
    },
    {
      heading: 'Graph Mapping',
      paragraphs: [
        'Read mapping against a graph is still a search problem. The mapper finds seeds, clusters plausible hits, aligns the read through graph walks, scores candidate alignments, and reports a placement. The difference is that candidate placements may cross alternate branches instead of staying on one coordinate line.',
        'Practical mappers need specialized indexes. Minimizer indexes find short seed hits quickly. Distance indexes help decide whether hits can belong to the same read alignment. Haplotype path indexes such as GBWT-style structures constrain search toward observed or likely paths. Topology indexes answer navigation questions over nodes, edges, and paths.',
        'After mapping, many pipelines still need linear coordinates. The result may be projected onto a reference path, reported as graph coordinates, or carried forward in graph-native form. Projection is useful for interoperability, but it can be ambiguous when a read aligns equally well to repeated or alternate paths.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The method works because it changes the search space before scoring. If the true allele is present as a graph branch, a read can seed and align through that branch. The mapper no longer has to explain the alternate allele as a mismatch, clipping event, or local edit against a path that lacks the sequence.',
        'Path indexes make the larger search space tractable. A graph that contains every local allele combination can explode into many possible walks. Haplotype paths add biological structure by saying which combinations were observed or chosen. The mapper can prefer walks supported by real paths instead of exploring every topologically possible route equally.',
        'The graph also reduces duplicate representation. Shared sequence can remain shared across many genomes, while variation is stored as branching structure. That gives the system a way to represent diversity without copying a full genome for every sample.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Suppose one reference path spells A-C-T, while a common alternate haplotype spells A-G-T. A linear mapper sees a read with G as a mismatch against the C position. A variation graph stores A, then a bubble with C and G branches, then T. Both A-C-T and A-G-T are valid paths.',
        'A read containing A-G-T can seed on A, traverse the G branch, and continue to T. The score reflects a clean match to a represented allele instead of a mismatch against the reference allele. The same idea extends to an insertion: one path goes directly from left context to right context, while another path includes inserted sequence in between.',
        'Now add phasing. If nearby bubbles are present, the graph could allow four topological combinations, but only two may be real haplotypes. A path index can tell the mapper which combinations were observed. That prevents the graph from turning local variation into biologically unsupported walks.',
      ],
    },
    {
      heading: 'Where It Matters',
      paragraphs: [
        'Pangenome graphs matter in diverse cohorts, population genetics, clinical variant detection, structural-variant analysis, metagenomics, and any workflow where the chosen reference sequence changes mapping behavior. They are especially valuable when the study population contains alleles underrepresented or absent from the old reference.',
        'They also matter for fairness in genomic analysis. If one population is closer to the linear reference, its reads may map more easily than reads from another population. A pangenome graph cannot solve every sampling problem, but it can reduce bias caused by pretending one path is a universal substrate.',
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        'The graph can fail biologically when it contains false paths, missing haplotypes, untrusted assemblies, or poorly phased variation. A graph is only as good as the sequences and paths it represents. Adding more samples can improve coverage, but it can also add noise and complexity.',
        'It can fail computationally when repeats and structural variation create tangles that defeat seeding, distance estimation, or path constraints. A graph that is too tangled may reduce reference bias but increase ambiguous mapping. More alleles are not automatically better if the mapper cannot distinguish them efficiently.',
        'It can fail operationally when downstream tools require linear coordinates and projection is lossy. A graph-native result may be biologically clearer, but a clinical or production pipeline may still need chromosome positions, VCF records, or compatibility with existing annotation systems.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Treat graph builds as reproducible artifacts. Record input references, assemblies, variant sets, sample identifiers, phasing sources, normalization commands, tool versions, graph format, path names, coordinate mappings, and index parameters. Without provenance, a mapping difference between two builds is hard to interpret.',
        'Validate path preservation after every transformation. Sample paths should still spell the expected sequences. Reference paths should remain projectable. Coordinate liftover should be tested on known anchors. Indexes should be versioned with the graph because a minimizer index, distance index, and haplotype index are part of the effective search structure.',
        'Choose graph scope deliberately. A small graph around a locus may be easier to validate and explain. A whole-genome pangenome can reduce bias more broadly but demands stronger indexing, storage, monitoring, and interoperability work. The right scope depends on the scientific question and pipeline constraints.',
      ],
    },
    {
      heading: 'Implementation Notes',
      paragraphs: [
        'A useful implementation separates graph topology, sequence storage, path storage, metadata, and indexes. Node identifiers should remain stable enough for debugging, but transformations may split or merge nodes. Path records should be treated as first-class data, not comments, because they carry the biological meaning that makes the graph more than a collection of bubbles.',
        'Mapping performance depends on seed length, minimizer density, repeat handling, graph-distance clustering, haplotype constraints, and alignment scoring. The implementation should expose counters for seed hits, ambiguous clusters, candidate walks, alignment time, projection failures, and memory used by each index. These counters explain whether a region is hard because of biology or because of graph construction.',
      ],
    },
    {
      heading: 'Sources And Study Next',
      paragraphs: [
        'Primary sources to compare include the vg toolkit paper, the vg project, Giraffe graph mapping work, ODGI graph operations, and pangenome reference discussions from the genomics community. Read them around two questions: how are paths represented, and what indexes make mapping feasible?',
        'Inside this curriculum, study Genome k-mer Minimizer Index for graph seeding, De Bruijn Graph Genome Assembly for graph construction from reads, BWA FM-index Read Alignment for the linear-reference contrast, FM-index and Burrows-Wheeler Transform for compressed search, Graph BFS and DFS for traversal basics, and Suffix Array or FM-index topics for sequence search foundations.',
      ],
    },
  ],
};
