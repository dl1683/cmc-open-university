// LOUDS succinct trie: encode tree topology level-by-level as unary degrees,
// then navigate with rank/select and compact label arrays instead of pointers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'louds-succinct-trie',
  title: 'LOUDS Succinct Trie',
  category: 'Data Structures',
  summary: 'A compact trie layout: store level-order unary degree bits plus labels, then use rank/select to navigate children without pointer-heavy nodes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['encode topology', 'navigate labels'], defaultValue: 'encode topology' },
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

function* encodeTopology() {
  const pipelineNodes = [
    { id: 'trie', label: 'trie', x: 0.8, y: 4.0, note: 'nodes' },
    { id: 'level', label: 'level order', x: 2.7, y: 4.0, note: 'BFS' },
    { id: 'degree', label: 'degrees', x: 4.6, y: 4.0, note: 'unary' },
    { id: 'bits', label: 'bits', x: 6.5, y: 4.0, note: '11010...' },
    { id: 'rank', label: 'rank/select', x: 8.4, y: 4.0, note: 'navigate' },
  ];
  const pipelineEdges = [
    { id: 'e-trie-level', from: 'trie', to: 'level' },
    { id: 'e-level-degree', from: 'level', to: 'degree' },
    { id: 'e-degree-bits', from: 'degree', to: 'bits' },
    { id: 'e-bits-rank', from: 'bits', to: 'rank' },
  ];
  const rankNode = pipelineNodes.find(n => n.id === 'rank');
  const bitsNode = pipelineNodes.find(n => n.id === 'bits');

  yield {
    state: graphState({ nodes: pipelineNodes, edges: pipelineEdges }, { title: 'LOUDS turns tree shape into a navigable bitvector' }),
    highlight: { active: ['level', 'degree', 'bits'], found: ['rank'] },
    explanation: `${topic.title} means level-order unary degree sequence. Visit the ${pipelineNodes.length} pipeline stages breadth-first; for each node, write one 1 bit per child, then a 0. The "${rankNode.label}" stage (${rankNode.note}) makes those bits behave like tree pointers.`,
    invariant: `The bitvector (${bitsNode.note}) is static bits plus small navigation directories, not object pointers.`,
  };

  const degreeRows = [
    { id: 'root', label: 'root' },
    { id: 'a', label: 'node a' },
    { id: 'b', label: 'node b' },
    { id: 'c', label: 'node c' },
  ];
  const degreeCols = [
    { id: 'children', label: 'children' },
    { id: 'code', label: 'LOUDS code' },
  ];
  const degreeData = [
    ['2', '110'],
    ['1', '10'],
    ['0', '0'],
    ['2', '110'],
  ];

  yield {
    state: labelMatrix('Unary degree encoding', degreeRows, degreeCols, degreeData),
    highlight: { active: ['root:code', 'a:code', 'c:code'], compare: ['b:code'] },
    explanation: `A node with ${degreeData[0][0]} children contributes ${degreeData[0][1]}. A leaf (${degreeRows[2].label}) contributes ${degreeData[2][1]}. Concatenating these ${degreeRows.length} codes in level order gives a bitstring from which child ranges can be recovered.`,
  };

  const arrayRows = [
    { id: 'louds', label: 'LOUDS bits' },
    { id: 'labels', label: 'edge labels' },
    { id: 'terminal', label: 'terminal bits' },
    { id: 'values', label: 'values' },
  ];
  const arrayCols = [
    { id: 'stores', label: 'stores' },
    { id: 'queryUse', label: 'query use' },
  ];
  const arrayData = [
    ['tree topology', 'parent/child'],
    ['bytes or chars', 'match path'],
    ['word ends?', 'membership'],
    ['optional payload', 'map lookup'],
  ];

  yield {
    state: labelMatrix('Compact trie arrays', arrayRows, arrayCols, arrayData),
    highlight: { found: ['louds:queryUse', 'labels:queryUse'], active: ['terminal:stores'] },
    explanation: `A ${topic.title} stores ${arrayRows.length} parallel arrays: the bitvector says where children are (${arrayData[0][0]}); the label array (${arrayRows[1].label}) says which edge byte each child represents.`,
  };

  const pointerSeries = { id: 'pointer', label: 'pointer trie', points: [{ x: 5, y: 28 }, { x: 50, y: 72 }, { x: 100, y: 96 }] };
  const loudsSeries = { id: 'louds', label: 'LOUDS trie', points: [{ x: 5, y: 14 }, { x: 50, y: 22 }, { x: 100, y: 30 }] };

  yield {
    state: plotState({
      axes: { x: { label: 'keys stored', min: 0, max: 100 }, y: { label: 'pointer overhead', min: 0, max: 100 } },
      series: [pointerSeries, loudsSeries],
    }),
    highlight: { found: ['louds'], compare: ['pointer'] },
    explanation: `The chart compares a ${pointerSeries.label} (overhead ${pointerSeries.points[2].y}% at ${pointerSeries.points[2].x} keys) against a ${loudsSeries.label} (only ${loudsSeries.points[2].y}%). LOUDS matters when pointer overhead dominates: dictionaries, autocomplete tables, static key maps, and range filters.`,
  };
}

function* navigateLabels() {
  const lookupRows = [
    { id: 'root', label: 'root' },
    { id: 'c', label: 'edge c' },
    { id: 'a', label: 'edge a' },
    { id: 't', label: 'edge t' },
    { id: 'done', label: 'terminal' },
  ];
  const lookupCols = [
    { id: 'childRange', label: 'child range' },
    { id: 'labelSearch', label: 'label search' },
  ];
  const lookupData = [
    ['rank/select range', 'find c'],
    ['rank/select range', 'find a'],
    ['rank/select range', 'find t'],
    ['no children', 'stop'],
    ['terminal bit', 'key exists'],
  ];
  const edgeSteps = lookupRows.filter(r => r.label.startsWith('edge'));

  yield {
    state: labelMatrix('Lookup cat', lookupRows, lookupCols, lookupData),
    highlight: { active: ['root:childRange', 'c:labelSearch', 'a:labelSearch', 't:labelSearch'], found: ['done:labelSearch'] },
    explanation: `To follow a key through ${lookupRows.length} steps, compute the current node ${lookupCols[0].label} from LOUDS bits, search labels inside that range (${edgeSteps.length} edge transitions: ${edgeSteps.map(r => r.label).join(', ')}), then check "${lookupData[4][1]}" at the ${lookupRows[4].label} row.`,
    invariant: `Trie lookup is still prefix navigation across ${edgeSteps.length} edges; only the representation changed from pointers to ${lookupData[0][0]}.`,
  };

  const navRows = [
    { id: 'firstChild', label: 'first child' },
    { id: 'nextSibling', label: 'next sibling' },
    { id: 'parent', label: 'parent' },
    { id: 'degree', label: 'degree' },
  ];
  const navCols = [
    { id: 'uses', label: 'uses' },
    { id: 'cost', label: 'typical cost' },
  ];
  const navData = [
    ['select/rank', 'constant-ish'],
    ['next 1 in range', 'local'],
    ['rank/select inverse', 'constant-ish'],
    ['child run length', 'local'],
  ];

  yield {
    state: labelMatrix('Navigation operations', navRows, navCols, navData),
    highlight: { found: ['firstChild:uses', 'parent:uses'], compare: ['degree:cost'] },
    explanation: `${topic.title} exposes ${navRows.length} navigation operations (${navRows.map(r => r.label).join(', ')}). The pattern is stable: rank counts earlier structure, select jumps to the k-th structural marker, each at ${navData[0][1]} cost.`,
  };

  const splitRows = [
    { id: 'upper', label: 'upper trie' },
    { id: 'lower', label: 'lower trie' },
    { id: 'suffix', label: 'suffix bits' },
    { id: 'payload', label: 'payloads' },
  ];
  const splitCols = [
    { id: 'layout', label: 'layout' },
    { id: 'reason', label: 'reason' },
  ];
  const splitData = [
    ['fast bitmap', 'hot levels'],
    ['LOUDS sparse', 'many nodes'],
    ['optional', 'false positives'],
    ['separate array', 'values'],
  ];

  yield {
    state: labelMatrix('Dense top, sparse bottom', splitRows, splitCols, splitData),
    highlight: { active: ['upper:reason', 'lower:reason'], found: ['suffix:layout'] },
    explanation: `Fast Succinct Trie designs split the ${splitRows.length} layers: the ${splitRows[0].label} gets a ${splitData[0][0]} layout because every lookup touches ${splitData[0][1]}; the ${splitRows[1].label} gets ${splitData[1][0]} because it contains ${splitData[1][1]}.`,
  };

  const fitRows = [
    { id: 'staticDict', label: 'static dictionary' },
    { id: 'autocomplete', label: 'autocomplete' },
    { id: 'rangeFilter', label: 'range filter' },
    { id: 'hotWrites', label: 'frequent writes' },
  ];
  const fitCols = [
    { id: 'fit', label: 'fit' },
    { id: 'reason', label: 'reason' },
  ];
  const fitData = [
    ['strong', 'compact keys'],
    ['strong', 'prefix path'],
    ['strong', 'ordered trie'],
    ['weak', 'static bits'],
  ];
  const strongFits = fitRows.filter((_, i) => fitData[i][0] === 'strong');
  const weakFits = fitRows.filter((_, i) => fitData[i][0] === 'weak');

  yield {
    state: labelMatrix('When LOUDS is a fit', fitRows, fitCols, fitData),
    highlight: { found: ['staticDict:fit', 'autocomplete:fit', 'rangeFilter:fit'], compare: ['hotWrites:reason'] },
    explanation: `${topic.title} is a ${fitData[0][0]} fit for ${strongFits.length} use cases (${strongFits.map(r => r.label).join(', ')}) but ${fitData[3][0]} for ${weakFits[0].label} because the bitvector is ${fitData[3][1]}.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'encode topology') yield* encodeTopology();
  else if (view === 'navigate labels') yield* navigateLabels();
  else throw new InputError('Pick a LOUDS view.');
}

export const article = {
  sections: [
    {heading: 'How to read the animation', paragraphs: ['Read the first view as a breadth-first encoding pass over a trie. Each node writes one 1 bit per child, then one 0 bit to end its child run.', {type: 'callout', text: 'LOUDS keeps trie semantics but replaces pointers with bit positions, counts, and jumps.'}, 'Read the second view as lookup over the finished structure. Rank counts bits up to a position, select jumps to the position of a chosen bit, and together they recover parent-child movement without pointers.', {type: 'image', src: './assets/gifs/louds-succinct-trie.gif', alt: 'Animated walkthrough of the louds succinct trie visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A trie stores strings by sharing prefixes, one edge label at a time. Pointer tries are easy to update, but millions of small nodes can spend more memory on object headers, maps, and pointers than on characters.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Radix_tree.svg', alt: 'Radix tree diagram showing prefix branches from a root', caption: 'A trie shares common prefixes; LOUDS keeps that prefix tree while changing the storage layout. Source: Wikimedia Commons, Cmglee, CC BY-SA 4.0.'}, 'Level-Order Unary Degree Sequence, or LOUDS, stores the tree shape as bits. It keeps prefix lookup semantics while making the topology close to two bits per node.']},
    {heading: 'The obvious approach', paragraphs: ['Use a normal pointer trie. Each node has a map from label to child pointer, a terminal flag, and maybe a payload.', 'That works well for mutable dictionaries. It wastes space when the trie is built once, queried often, and has millions of nodes with small fanout.']},
    {heading: 'The wall', paragraphs: ['Compression alone is not enough. Lookup still needs first child, next sibling, parent, degree, label match, and terminal checks.', 'The wall is navigation without pointers. A compact encoding must answer pointer-like questions quickly enough that arithmetic overhead does not erase the memory win.']},
    {heading: 'The core insight', paragraphs: ['LOUDS writes nodes in level order, so child entries and future node numbers line up. A run of 1 bits records children, and the following 0 bit marks the end of that node.', 'Rank and select turn that bit layout into addresses. The bitvector is not just compressed storage; it is an indexable coordinate system for the tree.']},
    {heading: 'How it works', paragraphs: ['Visit nodes breadth-first. A node with two children emits 110, a node with one child emits 10, and a leaf emits 0.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Rank and select recover parent-child movement from ordered markers rather than from stored pointers. Source: Wikimedia Commons, David W., public domain.'}, 'Store labels in the same order as the child 1 bits. Lookup computes the child range for the current node, scans those labels for the next character, moves to the matched child, and checks a terminal bit after the last character.']},
    {heading: 'Why it works', paragraphs: ['Each node contributes exactly one 0 bit, and each edge contributes exactly one 1 bit. Because a tree with n nodes has n - 1 edges, the topology is represented by about 2n bits plus the sentinel convention.', 'The invariant is alignment. The j-th child marker, j-th label, and j-th child node refer to the same edge, so following labels reconstructs the same path as a pointer trie.']},
    {heading: 'Cost and complexity', paragraphs: ['Topology costs about two bits per node plus rank/select directories. Labels cost one byte per edge in byte alphabets, and terminal flags cost one bit per node.', 'Lookup is O(k) for a key of length k when rank/select are O(1). Updates are usually O(n) rebuilds because inserting a node shifts later bits and labels.']},
    {heading: 'Real-world uses', paragraphs: ['LOUDS wins for static dictionaries, autocomplete indexes, compact lexicons, and prefix-heavy filters. It is strongest when the structure is built in batches and queried many times.', 'SuRF uses LOUDS-style tries for range filters in LSM-tree storage. The trie supports ordered range questions that Bloom filters cannot answer.']},
    {heading: 'Where it fails', paragraphs: ['LOUDS is a poor fit for frequent insertions and deletions. Pointer tries, adaptive radix trees, or periodic snapshot designs handle mutation more naturally.', 'It is also not automatically better than a hash table. If the workload only needs exact membership and no prefix or range behavior, a hash table or compact filter may be simpler and faster.']},
    {heading: 'Worked example', paragraphs: ['Suppose the trie stores "cat" and "dog". The root has children c and d, so it emits 110; c emits 10 for a, d emits 10 for o, a emits 10 for t, o emits 10 for g, and both leaves emit 0.', 'The label array stores c, d, a, o, t, g in child-entry order. Looking up "cat" follows the root child labeled c, then a, then t, and the terminal bit at t proves that the prefix is a stored key.']},
    {heading: 'Sources and study next', paragraphs: ['Read Jacobson 1989 for succinct trees and rank/select, then read the SuRF paper for a production range-filter use case. Study tries first, then rank/select bitvectors, adaptive radix trees, Bloom filters, and FM-indexes.']},
  ],
};
