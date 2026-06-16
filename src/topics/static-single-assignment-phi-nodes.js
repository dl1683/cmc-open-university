// SSA: rename each assignment into a new value and use phi nodes at control
// flow joins so dataflow becomes explicit.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'static-single-assignment-phi-nodes',
  title: 'Static Single Assignment & Phi Nodes',
  category: 'Concepts',
  summary: 'Convert mutable variables into SSA values: versioned definitions, dominance frontiers, phi nodes, use-def chains, and optimization-friendly IR.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['phi at joins', 'rename and optimize'], defaultValue: 'phi at joins' },
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

function ssaGraph(title) {
  return graphState({
    nodes: [
      { id: 'entry', label: 'entry', x: 0.8, y: 4.0, note: 'cond' },
      { id: 'then', label: 'then', x: 2.8, y: 2.5, note: 'x0=G' },
      { id: 'else', label: 'else', x: 2.8, y: 5.5, note: 'x1=H' },
      { id: 'join', label: 'join', x: 5.0, y: 4.0, note: 'merge' },
      { id: 'phi', label: 'phi', x: 6.7, y: 4.0, note: 'x2' },
      { id: 'ret', label: 'ret', x: 8.4, y: 4.0, note: 'use x2' },
    ],
    edges: [
      { id: 'e-entry-then', from: 'entry', to: 'then' },
      { id: 'e-entry-else', from: 'entry', to: 'else' },
      { id: 'e-then-join', from: 'then', to: 'join' },
      { id: 'e-else-join', from: 'else', to: 'join' },
      { id: 'e-join-phi', from: 'join', to: 'phi' },
      { id: 'e-phi-ret', from: 'phi', to: 'ret' },
      { id: 'e-then-phi', from: 'then', to: 'phi' },
      { id: 'e-else-phi', from: 'else', to: 'phi' },
    ],
  }, { title });
}

function useDefGraph(title) {
  return graphState({
    nodes: [
      { id: 'x0', label: 'x0', x: 1.0, y: 2.4, note: 'G' },
      { id: 'x1', label: 'x1', x: 1.0, y: 5.6, note: 'H' },
      { id: 'x2', label: 'x2', x: 3.2, y: 4.0, note: 'phi' },
      { id: 'y0', label: 'y0', x: 5.3, y: 4.0, note: 'x2+1' },
      { id: 'z0', label: 'z0', x: 7.3, y: 4.0, note: 'y0*2' },
      { id: 'ret', label: 'ret', x: 9.0, y: 4.0, note: 'z0' },
    ],
    edges: [
      { id: 'e-x0-x2', from: 'x0', to: 'x2' },
      { id: 'e-x1-x2', from: 'x1', to: 'x2' },
      { id: 'e-x2-y0', from: 'x2', to: 'y0' },
      { id: 'e-y0-z0', from: 'y0', to: 'z0' },
      { id: 'e-z0-ret', from: 'z0', to: 'ret' },
    ],
  }, { title });
}

function* phiAtJoins() {
  yield {
    state: ssaGraph('Mutable x becomes versioned SSA values'),
    highlight: { active: ['then', 'else'], compare: ['phi'] },
    explanation: 'In source code, x is assigned in both branches. In SSA, each assignment gets a new name: x0 in then, x1 in else. The join needs a value that depends on which predecessor executed.',
  };
  yield {
    state: ssaGraph('A phi node merges predecessor-specific values'),
    highlight: { active: ['then', 'else', 'phi', 'e-then-phi', 'e-else-phi'], found: ['ret'] },
    explanation: 'The phi node says: if control arrived from then, use x0; if it arrived from else, use x1. It is not a runtime function call; it is an IR merge instruction tied to CFG predecessors.',
    invariant: 'A phi chooses by incoming edge, not by recomputing the condition.',
  };
  yield {
    state: labelMatrix(
      'Where phis come from',
      [
        { id: 'assign', label: 'definitions' },
        { id: 'frontier', label: 'frontier' },
        { id: 'rename', label: 'rename' },
        { id: 'use', label: 'uses' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'structure', label: 'structure' },
      ],
      [
        ['find assigned vars', 'CFG blocks'],
        ['find join sites', 'dom frontier'],
        ['stack of versions', 'dom tree walk'],
        ['point to one def', 'use-def chain'],
      ],
    ),
    highlight: { active: ['frontier:structure', 'rename:structure'], found: ['use:structure'] },
    explanation: 'Classic SSA construction places phis at dominance frontiers, then renames variables with stacks while walking the dominator tree.',
  };
}

function* renameAndOptimize() {
  yield {
    state: useDefGraph('SSA makes use-def chains direct'),
    highlight: { active: ['x2', 'y0', 'z0', 'e-x2-y0', 'e-y0-z0'], found: ['ret'] },
    explanation: 'Once every value has one definition, a use can point directly to its definition. This makes constant propagation, dead-code elimination, common subexpression elimination, and sparse dataflow much simpler.',
  };
  yield {
    state: labelMatrix(
      'Optimization wins',
      [
        { id: 'const', label: 'constant prop' },
        { id: 'dead', label: 'dead code' },
        { id: 'cse', label: 'CSE' },
        { id: 'alloc', label: 'reg alloc' },
      ],
      [
        { id: 'ssa', label: 'SSA help' },
        { id: 'next', label: 'next structure' },
      ],
      [
        ['one def per use', 'value graph'],
        ['unused def obvious', 'liveness'],
        ['same operands visible', 'hashing'],
        ['live intervals', 'linear scan'],
      ],
    ),
    highlight: { active: ['const:ssa', 'dead:ssa', 'alloc:next'] },
    explanation: 'SSA is not just a pretty naming convention. It changes the complexity of program analysis by making def-use relationships sparse and explicit.',
  };
  yield {
    state: useDefGraph('Register allocation eventually leaves SSA'),
    highlight: { active: ['x0', 'x1', 'x2'], compare: ['y0', 'z0'], found: ['ret'] },
    explanation: 'Machine code has finite registers and memory slots, not infinite SSA names. Linear Scan Register Allocation turns virtual SSA values into physical registers and spills.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'phi at joins') yield* phiAtJoins();
  else if (view === 'rename and optimize') yield* renameAndOptimize();
  else throw new InputError('Pick an SSA view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Static Single Assignment form is an intermediate representation discipline where each value name is assigned exactly once. Mutable source variables become versioned SSA values, and phi nodes merge values at control-flow joins.',
        'SSA is one of the central data structures of modern optimizing compilers because it turns variable mutation into explicit value flow. Instead of asking which assignment might reach this use through many paths, a compiler can often follow direct use-def edges.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SSA construction starts from a Control Flow Graph & Dominator Tree. For each source variable with multiple definitions, the compiler places phi nodes at relevant dominance frontiers. It then renames variables by walking the dominator tree with one stack of current names per variable.',
        'LLVM IR is SSA-based for register values. The LLVM Kaleidoscope tutorial shows a branch where two loads feed a phi at the merge block. LLVM also commonly uses memory plus mem2reg promotion so frontends can emit allocas for mutable variables and let LLVM build SSA.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For if (cond) x = G; else x = H; return x, SSA creates x0 = G in the then block, x1 = H in the else block, and x2 = phi [x0, then], [x1, else] in the join block. The return uses x2. The old name x no longer has ambiguous reaching definitions.',
        'For a loop, phi nodes also carry values from the preheader and the backedge. A loop counter might start as i0 from entry, then become i2 = phi [i0, entry], [i1, loop], where i1 is the incremented value from the previous iteration.',
      ],
    },
    {
      heading: 'Optimization notes',
      paragraphs: [
        'SSA is powerful because many analyses become sparse. Constant propagation can push facts along use-def edges. Dead-code elimination can remove definitions with no useful users. Common-subexpression elimination can hash operations by opcode and operands. Loop optimizers can reason about induction variables through loop-header phis.',
        'The price is that CFG edits and phi nodes must stay consistent. If a pass removes a predecessor edge, every phi in the destination block must remove the corresponding incoming value. If a pass splits an edge, it may need to update phi predecessor labels.',
      ],
    },
    {
      heading: 'Lowering notes',
      paragraphs: [
        'Real machines do not execute phi nodes directly. Later compiler stages lower phis into moves along predecessor edges or resolve them during register allocation. This can create parallel-copy problems: multiple values may need to swap locations at a block boundary without clobbering each other.',
        'LLVM frontends often avoid hand-placing every phi by emitting stack slots for mutable locals and relying on promotion passes. That is an engineering shortcut, not a conceptual escape: the optimizer still wants SSA-shaped value flow before serious transformations run.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM Language Reference at https://llvm.org/docs/LangRef.html#phi-instruction, LLVM Kaleidoscope mutable variables and SSA at https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/LangImpl07.html, and Cytron et al. SSA construction at https://www.cs.utexas.edu/~pingali/CS380C/2010/papers/ssaCytron.pdf. Study Dominance Frontier SSA Construction, Control Flow Graph & Dominator Tree, MemorySSA Alias Graph, Sparse Conditional Constant Propagation, E-Graphs & Equality Saturation, Linear Scan Register Allocation, Interference Graph Register Allocation, Data-Flow Worklist Analysis, Instruction Selection DAG & GlobalISel, and SSA Destruction Phi Elimination & Parallel Copy next.',
      ],
    },
  ],
};
