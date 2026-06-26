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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as DNA stored in pieces. Active nodes and edges are the allele path currently being explained, found nodes are paths the graph can preserve, and compare nodes are the linear-reference alternative that would force every sample through one sequence.',
        'A path is an ordered walk through sequence-labeled nodes that spells a genome or haplotype. The safe inference rule is that a read can align through an alternate branch only if the graph contains that branch and the index can find it.',
        {type:'callout', text:'A pangenome graph removes reference privilege by storing shared sequence once and representing real genomes as paths through variant branches.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b4/VariationGraph.png', alt:'Variation graph showing aligned DNA sequences converted into branch paths.', caption:'Variation graph illustration, by Alsa74, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A linear reference genome is one sequence chosen as the coordinate backbone. That is convenient, but it makes every other genome look like edits against that one path, even when a population carries sequence the reference does not contain.',
        'The failure is called reference bias. If a 150-base read contains a 20-base insertion absent from the reference, a linear mapper may soft-clip those bases, lower the mapping quality, or miss the placement before variant calling begins.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a reference FASTA plus a variant file. Reads align to the reference, differences are called, and alternate alleles are reported by chromosome coordinate.',
        'That approach is practical and widely supported. It works well when samples are close to the reference and when the variation is small enough that a linear coordinate still describes the evidence cleanly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears before variant calling. The mapper must first find seeds and alignments against a path that may not contain the true allele, so the later variant record cannot rescue reads that failed to map.',
        'The second wall is haplotype structure. A list of local variants does not say which variants occur together on real chromosomes, so naive combination can create paths no sampled genome carried.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent many genomes as paths through one graph. Shared sequence is stored once, single-nucleotide variants become bubbles, insertions become alternate walks with extra sequence, and deletions become walks that skip sequence.',
        'The key invariant is path preservation. If the graph claims to contain a haplotype, walking its named path must spell that haplotype after graph normalization and compaction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A builder splits sequence at variation boundaries, creates nodes for shared and alternate sequence, adds edges for legal adjacency, and threads references or sample haplotypes through the result as named paths. The graph then needs indexes for seeds, topology, distances, and haplotype paths.',
        'A read mapper finds short seeds in the graph, clusters seed hits by graph distance, aligns candidate walks, scores the alignments, and reports either graph coordinates or a projection back to a reference path. Haplotype indexes restrict search toward observed paths instead of every topological walk.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the search space contains alleles before scoring starts. A read that truly follows A-G-T can match a graph branch labeled G instead of paying a mismatch penalty against a reference C.',
        'The correctness argument is conservative representation. If path spellings are preserved and the mapper only reports walks supported by the graph and scoring model, then an alternate allele can be found without pretending it is damage to the reference path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is index and graph complexity. A 3-billion-base reference is already large; adding many assemblies and haplotypes can multiply nodes, paths, and metadata even when shared sequence is compressed.',
        'When samples double, storage does not necessarily double because shared sequence is reused, but path metadata and haplotype indexes grow. Mapping also becomes harder in repeats and tangles because more candidate walks survive the seed stage.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pangenome graphs fit diverse cohorts, structural-variant analysis, clinical variant detection, population genetics, metagenomics, and studies where the chosen reference changes read mapping. The access pattern is search over many plausible alleles, not lookup against one coordinate string.',
        'They also fit fairness-sensitive genomics. If one population is closer to the old reference, graph references can reduce bias caused by using one group-specific path as the default substrate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the graph is noisy, tangled, or missing real paths. False assemblies, weak phasing, high-degree repeat regions, and poor normalization can make mapping more ambiguous than the linear baseline.',
        'It also fails operationally when downstream systems require simple linear coordinates. Projection back to a reference can be ambiguous when a read maps equally well to repeated or alternate paths.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the reference path is A-C-T-C and a common haplotype is A-G-T-C. A linear mapper sees a read A-G-T-C as one mismatch at the second base, while the graph stores A, then a C/G bubble, then T-C.',
        'Now add a 2-base insertion after T for another haplotype: A-G-T-AA-C. The graph adds an alternate walk through node AA before C, so a read containing AA can seed and align without soft clipping those two bases.',
        'If two nearby bubbles each have two alleles, topology allows 4 local combinations. If the haplotype path index says only 2 were observed, the mapper can prefer those 2 and avoid spending equal effort on unsupported allele combinations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the vg toolkit paper and project at https://github.com/vgteam/vg, Giraffe graph mapping work, ODGI graph operations at https://github.com/pangenome/odgi, and current human pangenome reference publications. Read them for representation, path preservation, and the indexes that make graph mapping practical.',
        'Next, study Genome k-mer Minimizer Index, De Bruijn Graph Genome Assembly, BWA FM-index Read Alignment, FM-index, Burrows-Wheeler Transform, Graph BFS and DFS, and Suffix Array. These topics supply the sequence search and graph traversal machinery behind pangenome tools.',
      ],
    },
  ],
};