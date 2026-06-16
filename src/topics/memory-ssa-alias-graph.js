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
  yield {
    state: memoryGraph('MemorySSA gives memory its own SSA-like graph'),
    highlight: { active: ['loe', 'defP', 'defQ', 'phi', 'useP'], compare: ['entry'] },
    explanation: 'Ordinary SSA names register-like values. MemorySSA names memory accesses: stores and write-like calls become MemoryDefs, loads become MemoryUses, and joins get MemoryPhis.',
    invariant: 'Every MemoryUse has a defining memory access to start a clobber walk from.',
  };

  yield {
    state: memoryGraph('MemoryPhi merges may-reach memory definitions', { phi: 'may reach' }),
    highlight: { active: ['defP', 'defQ', 'phi', 'e-defP-phi', 'e-defQ-phi'], found: ['useP'] },
    explanation: 'At a CFG join, two different writes may reach the following load. Unlike normal SSA phi nodes, a MemoryPhi usually represents may-reach memory until alias analysis disambiguates it.',
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
    explanation: 'The data structure is intentionally small: map instructions to MemoryUse or MemoryDef nodes, map blocks to MemoryPhi nodes, and keep links to defining accesses.',
  };

  yield {
    state: memoryGraph('Alias analysis decides whether a candidate def matters', { aa: 'p vs q' }),
    highlight: { active: ['aa', 'defP', 'defQ', 'useP', 'e-aa-defP', 'e-aa-defQ'], found: ['value'] },
    explanation: 'MemorySSA alone is conservative. The clobber walker asks alias analysis whether a candidate write can affect the load address. NoAlias writes can be skipped; MayAlias or MustAlias writes stop the walk.',
  };
}

function* clobberWalkCaseStudy() {
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
    explanation: 'The optimizer wants to know whether the load of *p can be replaced with 7. The answer depends on whether the intervening store to *q may clobber *p.',
  };

  yield {
    state: memoryGraph('Start the clobber walk at the load defining access', { defP: 'store p=7', defQ: 'store q=9', useP: 'load p', aa: 'q vs p' }),
    highlight: { active: ['useP', 'phi', 'defQ', 'aa', 'e-use-aa', 'e-aa-defQ'], compare: ['defP'] },
    explanation: 'The walker starts from the defining memory access for the load and walks backward through candidate writes. The newest candidate is checked first because it would dominate any older answer.',
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
    explanation: 'If q and p are proven disjoint, Def Q is irrelevant and the walker continues to Def P. If q may alias p, the optimizer must stop and keep the load.',
  };

  yield {
    state: memoryGraph('A precise clobber turns a memory question into a value fact', { defP: 'p=7', defQ: 'NoAlias', useP: 'load p', aa: 'skip q', value: 'x=7' }),
    highlight: { active: ['defP', 'useP', 'value', 'e-use-value'], removed: ['defQ'], found: ['aa'] },
    explanation: 'Once the walker proves Def P is the clobbering write for load *p, ordinary SSA optimizations can use the result. MemorySSA is a bridge from messy memory effects back to sparse value reasoning.',
    invariant: 'Wrong alias answers are correctness bugs, so conservative MayAlias beats unsafe folding.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'MemorySSA is an analysis data structure for memory operations. Ordinary SSA gives names to register-like values. MemorySSA gives an SSA-like graph to loads, stores, calls, and joins so optimizers can ask focused questions about memory clobbers.',
        'LLVM MemorySSA uses MemoryDef for write-like operations, MemoryUse for read-like operations, MemoryPhi for CFG joins, and a special liveOnEntry definition for memory that existed before the function began.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each memory access points to a defining access. A load can start from that access and walk backward through MemoryDefs and MemoryPhis. At each candidate write, alias analysis decides whether the write can affect the load address.',
        'This does not make memory purely single-assignment. MemoryPhi nodes merge may-reach definitions, and alias analysis determines precision. The value is that the optimizer walks a sparse memory graph instead of rediscovering all possible stores from raw CFG structure every time.',
      ],
    },
    {
      heading: 'Case study: folding a load',
      paragraphs: [
        'For *p = 7; *q = 9; x = *p, the load can be folded to 7 only when the store through q cannot clobber p. MemorySSA gives the walker the candidate chain. Alias analysis supplies the answer: NoAlias lets the walker skip Def Q; MayAlias forces it to stop; MustAlias with Def P lets the optimizer use 7.',
        'This same pattern helps dead-store elimination, load redundancy elimination, loop optimizations, and LICM. The pass needs a precise explanation of which memory access clobbers which read or write.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'MemorySSA is not a replacement for alias analysis. It is an access graph and update framework. If alias analysis cannot prove disjointness, the optimizer must stay conservative. The engineering challenge is keeping MemorySSA valid while passes edit CFG edges, split blocks, delete stores, or move instructions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM MemorySSA documentation at https://llvm.org/docs/MemorySSA.html, LLVM MemorySSA implementation at https://github.com/llvm/llvm-project/blob/main/llvm/lib/Analysis/MemorySSA.cpp, and MemorySSA header reference at https://llvm.org/doxygen/MemorySSA_8h_source.html. Study Dominance Frontier SSA Construction, Static Single Assignment & Phi Nodes, Data-Flow Worklist Analysis, Sparse Conditional Constant Propagation, Alias-sensitive Union-Find patterns in Unification, and Instruction Selection DAG & GlobalISel next.',
      ],
    },
  ],
};
