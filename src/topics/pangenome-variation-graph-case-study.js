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
    { heading: 'What it is', paragraphs: ['A pangenome variation graph represents many genomes as paths through one graph. Nodes carry DNA sequence, edges connect possible adjacencies, and paths represent references, haplotypes, or assembled genomes.'] },
    { heading: 'How it works', paragraphs: ['Variants become branches, insertions become alternate walks, and haplotypes thread through the graph. Read mappers seed into the graph, cluster hits, use haplotype/path indexes, and align reads to graph paths.'] },
    { heading: 'Case study', paragraphs: ['A read containing an alternate allele may align poorly to a single linear reference. In a variation graph, the alternate allele is a branch, so the read can map through a path that actually exists in the population.'] },
    { heading: 'Pitfalls', paragraphs: ['Graph references reduce reference bias but can introduce graph-construction bias. High-degree tangles, duplicated sequence, missing haplotypes, and weak coordinate systems can make mapping difficult.'] },
    { heading: 'Why it matters', paragraphs: ['Pangenome graphs connect graph data structures, string indexes, minimizers, haplotype paths, and reproducible scientific provenance. They show why one linear reference is often not enough.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: vg toolkit paper at https://pmc.ncbi.nlm.nih.gov/articles/PMC6126949/, vg repository at https://github.com/vgteam/vg, Giraffe paper at https://pmc.ncbi.nlm.nih.gov/articles/PMC9365333/, and ODGI paper at https://academic.oup.com/bioinformatics/article/38/13/3319/6585331. Study Minimizer Index, de Bruijn Graph Assembly, FM-index BWT, and Graph BFS next.'] },
  ],
};
