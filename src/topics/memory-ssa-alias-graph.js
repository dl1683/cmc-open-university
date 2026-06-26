// MemorySSA: make memory effects sparse by naming MemoryDef, MemoryUse, and
// MemoryPhi nodes, then let alias analysis answer which writes may clobber a read.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'memory-ssa-alias-graph',
  title: 'MemorySSA Alias Graph',
  category: 'Concepts',
  summary: 'MemorySSA gives loads, stores, calls, and joins explicit memory-access nodes so optimizers can walk possible clobbers without rescanning whole CFG regions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['def/use/phi graph', 'clobber walk case study'], defaultValue: 'def/use/phi graph' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function memoryGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'entry', label: 'entry', x: 0.9, y: 4.0, note: 'CFG' },
      { id: 'loe', label: 'EntryM', x: 2.6, y: 1.3, note: notes.loe ?? 'M0' },
      { id: 'defP', label: 'Def P', x: 3.0, y: 3.0, note: notes.defP ?? 'store *p' },
      { id: 'defQ', label: 'Def Q', x: 3.0, y: 5.2, note: notes.defQ ?? 'store *q' },
      { id: 'phi', label: 'Phi', x: 5.1, y: 4.1, note: notes.phi ?? 'join' },
      { id: 'useP', label: 'Load P', x: 7.2, y: 4.1, note: notes.useP ?? 'load *p' },
      { id: 'aa', label: 'Alias?', x: 7.2, y: 1.6, note: notes.aa ?? 'query' },
      { id: 'value', label: 'Result', x: 9.1, y: 4.1, note: notes.value ?? 'known?' },
    ],
    edges: [
      { id: 'e-entry-defP', from: 'entry', to: 'defP', weight: 'then' },
      { id: 'e-entry-defQ', from: 'entry', to: 'defQ', weight: 'else' },
      { id: 'e-loe-defP', from: 'loe', to: 'defP', weight: 'prev' },
      { id: 'e-loe-defQ', from: 'loe', to: 'defQ', weight: 'prev' },
      { id: 'e-defP-phi', from: 'defP', to: 'phi', weight: 'in' },
      { id: 'e-defQ-phi', from: 'defQ', to: 'phi', weight: 'in' },
      { id: 'e-phi-useP', from: 'phi', to: 'useP', weight: 'def' },
      { id: 'e-use-aa', from: 'useP', to: 'aa', weight: 'ask' },
      { id: 'e-aa-defP', from: 'aa', to: 'defP', weight: 'P' },
      { id: 'e-aa-defQ', from: 'aa', to: 'defQ', weight: 'Q' },
      { id: 'e-use-value', from: 'useP', to: 'value', weight: '' },
    ],
  }, { title });
}

function* defUsePhiGraph() {
  const accessNodeTypes = 4; // liveOnEntry, MemoryDef, MemoryUse, MemoryPhi
  const graphNodeCount = 8;
  const graphEdgeCount = 11;

  yield {
    state: memoryGraph('MemorySSA gives memory its own SSA-like graph'),
    highlight: { active: ['loe', 'defP', 'defQ', 'phi', 'useP'], compare: ['entry'] },
    explanation: `Ordinary SSA names register-like values. MemorySSA names memory accesses across ${graphNodeCount} nodes and ${graphEdgeCount} edges: stores and write-like calls become MemoryDefs, loads become MemoryUses, and joins get MemoryPhis.`,
    invariant: `Every MemoryUse has a defining memory access to start a clobber walk from — ${accessNodeTypes} access-node types cover all memory operations.`,
  };

  yield {
    state: memoryGraph('MemoryPhi merges may-reach memory definitions', { phi: 'may reach' }),
    highlight: { active: ['defP', 'defQ', 'phi', 'e-defP-phi', 'e-defQ-phi'], found: ['useP'] },
    explanation: `At a CFG join, two different writes may reach the following load. Unlike normal SSA phi nodes, a MemoryPhi usually represents may-reach memory until alias analysis disambiguates it across the ${graphEdgeCount}-edge graph.`,
  };

  yield {
    state: labelMatrix(
      'Access node roles',
      [
        { id: 'entry', label: 'liveOnEntry' },
        { id: 'def', label: 'MemoryDef' },
        { id: 'use', label: 'MemoryUse' },
        { id: 'phi', label: 'MemoryPhi' },
      ],
      [
        { id: 'represents', label: 'represents' },
        { id: 'example', label: 'example' },
        { id: 'optimizer', label: 'optimizer use' },
      ],
      [
        ['memory before function', 'argument memory', 'top of walk'],
        ['writes memory', 'store/call', 'possible clobber'],
        ['reads memory', 'load/readonly call', 'needs clobber'],
        ['join of defs', 'if/loop merge', 'path merge'],
      ],
    ),
    highlight: { active: ['def:represents', 'use:optimizer', 'phi:example'], compare: ['entry:optimizer'] },
    explanation: `The data structure is intentionally small: ${accessNodeTypes} access-node types map instructions to MemoryUse or MemoryDef nodes, map blocks to MemoryPhi nodes, and keep links to defining accesses.`,
  };

  yield {
    state: memoryGraph('Alias analysis decides whether a candidate def matters', { aa: 'p vs q' }),
    highlight: { active: ['aa', 'defP', 'defQ', 'useP', 'e-aa-defP', 'e-aa-defQ'], found: ['value'] },
    explanation: `MemorySSA alone is conservative. The clobber walker queries alias analysis across ${graphNodeCount} nodes to decide whether a candidate write can affect the load address. NoAlias writes can be skipped; MayAlias or MustAlias writes stop the walk.`,
  };
}

function* clobberWalkCaseStudy() {
  const programLines = 4;
  const aliasOutcomes = 3; // NoAlias, MayAlias, MustAlias

  yield {
    state: labelMatrix(
      'Tiny program',
      [
        { id: 'i1', label: '1' },
        { id: 'i2', label: '2' },
        { id: 'i3', label: '3' },
        { id: 'i4', label: '4' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'memssa', label: 'MemorySSA' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['*p = 7', 'Def P', 'write p'],
        ['*q = 9', 'Def Q', 'write q'],
        ['x = *p', 'Use P', 'read p'],
        ['return x', 'ordinary use', 'value user'],
      ],
    ),
    highlight: { active: ['i1:memssa', 'i2:memssa', 'i3:memssa'], found: ['i4:meaning'] },
    explanation: `The optimizer wants to know whether the load of *p can be replaced with 7. Across ${programLines} instructions, the answer depends on whether the intervening store to *q may clobber *p.`,
  };

  yield {
    state: memoryGraph('Start the clobber walk at the load defining access', { defP: 'store p=7', defQ: 'store q=9', useP: 'load p', aa: 'q vs p' }),
    highlight: { active: ['useP', 'phi', 'defQ', 'aa', 'e-use-aa', 'e-aa-defQ'], compare: ['defP'] },
    explanation: `The walker starts from the defining memory access for the load and walks backward through candidate writes. The newest candidate among ${programLines} instructions is checked first because it would dominate any older answer.`,
  };

  yield {
    state: labelMatrix(
      'Alias answers drive precision',
      [
        { id: 'noalias', label: 'NoAlias(q,p)' },
        { id: 'mayalias', label: 'MayAlias(q,p)' },
        { id: 'mustalias', label: 'MustAlias(p,p)' },
      ],
      [
        { id: 'walker', label: 'walker action' },
        { id: 'result', label: 'load result' },
      ],
      [
        ['skip Def Q', 'keep walking'],
        ['stop at Def Q', 'unknown'],
        ['stop at Def P', 'constant 7'],
      ],
    ),
    highlight: { active: ['noalias:walker', 'mustalias:result'], compare: ['mayalias:result'] },
    explanation: `Each of ${aliasOutcomes} alias outcomes drives a different action: if q and p are proven disjoint (NoAlias), Def Q is irrelevant and the walker continues to Def P. If q may alias p (MayAlias), the optimizer must stop and keep the load.`,
  };

  yield {
    state: memoryGraph('A precise clobber turns a memory question into a value fact', { defP: 'p=7', defQ: 'NoAlias', useP: 'load p', aa: 'skip q', value: 'x=7' }),
    highlight: { active: ['defP', 'useP', 'value', 'e-use-value'], removed: ['defQ'], found: ['aa'] },
    explanation: `Once the walker proves Def P is the clobbering write for load *p, ordinary SSA optimizations can use the result. MemorySSA bridges ${programLines} lines of messy memory effects back to sparse value reasoning.`,
    invariant: `Wrong alias answers are correctness bugs — with ${aliasOutcomes} possible outcomes, conservative MayAlias beats unsafe folding.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'def/use/phi graph') yield* defUsePhiGraph();
  else if (view === 'clobber walk case study') yield* clobberWalkCaseStudy();
  else throw new InputError('Pick a MemorySSA view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'MemorySSA gives memory its own SSA-like graph. A MemoryDef is a write, a MemoryUse is a read, and a MemoryPhi merges memory states at control-flow joins. Active nodes are candidate clobbers, while removed nodes are skipped only when alias analysis proves they cannot affect the address.',
        {type: 'image', src: './assets/gifs/memory-ssa-alias-graph.gif', alt: 'Animated walkthrough of the memory ssa alias graph visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ], },
    { heading: 'Why this exists', paragraphs: [
        'Ordinary SSA gives each register-like value a clear definition. Memory is harder because a load through p may depend on a store through p, an alias, a call, or a path-specific write. MemorySSA exists so optimizers can ask memory questions through a sparse graph instead of rescanning control flow.',
        {type: 'callout', text: 'MemorySSA makes memory effects searchable by naming every may-reaching write before alias analysis decides which one can actually matter.'},
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a backward scan from each load. Walk earlier instructions and predecessor blocks until a possible write appears. This works in straight-line code but repeats dense work across branches, loops, and many optimization passes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Some_types_of_control_flow_graphs.svg/250px-Some_types_of_control_flow_graphs.svg.png', alt: 'Several control-flow graph shapes showing branches and loops', caption: 'Branches and loops are why a raw backward memory scan keeps revisiting the same control-flow structure. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Some_types_of_control_flow_graphs.svg.'},
      ], },
    { heading: 'The wall', paragraphs: [
        'Branches create joins, loops create backedges, and calls may write unknown memory. Most candidate writes are irrelevant, but a scan has to inspect them to prove that. The compiler needs a reusable index over may-reaching memory effects.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Name memory accesses explicitly. Stores and write-like calls become MemoryDef nodes, loads become MemoryUse nodes, and joins can receive MemoryPhi nodes. MemorySSA supplies the may-reach structure, while alias analysis supplies address precision.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'MemorySSA is a directed access graph over memory state, not a rescan of source order. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
      ], },
    { heading: 'How it works', paragraphs: [
        'Construction uses the control-flow graph and dominance information. Memory-affecting instructions receive access nodes, and merge blocks may receive MemoryPhi nodes. A clobber walk starts from the load\'s defining memory access and walks backward through candidate defs and phis.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Control_flow_graph.svg', alt: 'Control-flow graph with basic blocks connected by directed edges', caption: 'Memory access nodes are placed on top of CFG and dominance structure; the graph controls which memory states can reach a load. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Control_flow_graph.svg.'},
      ], },
    { heading: 'Why it works', paragraphs: [
        'Safety comes from conservative skipping. A candidate write is ignored only when alias analysis proves NoAlias for the queried address. If the answer is MayAlias, the optimizer stops rather than inventing a value that might be wrong.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Build cost depends on memory accesses, CFG shape, phi placement, and dominance maintenance. Query cost depends on how many candidate defs the walker checks before finding a clobber or proving NoAlias. The payoff is that many passes reuse the same sparse memory graph.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'MemorySSA helps dead-store elimination, redundant-load elimination, loop-invariant code motion, store-to-load forwarding, and value numbering. It also explains missed optimizations by pointing to the MemoryDef or call that conservatively stops a query.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'MemorySSA cannot be more precise than alias and side-effect information. If every pointer may alias every other pointer, walks stop early and optimizations disappear. Stale MemorySSA after CFG edits is worse: it can become a correctness bug.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'For *p = 7; *q = 9; x = *p, the load asks whether x can become 7. The newest candidate write is *q = 9. If alias analysis proves NoAlias(q, p), the walker skips it and reaches *p = 7, so x can fold to 7; if it returns MayAlias, the load must stay.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Start with LLVM MemorySSA documentation and implementation notes. Study SSA, dominance frontiers, data-flow worklists, alias analysis, loop-invariant code motion, global value numbering, and dead-store elimination next.',
      ], },
  ],
};
