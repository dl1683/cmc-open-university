// SSA destruction: lower phi nodes into edge-specific parallel copies, then
// schedule those copies safely into ordinary non-SSA moves.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ssa-destruction-phi-elimination-parallel-copy',
  title: 'SSA Destruction Phi Elimination & Parallel Copy',
  category: 'Concepts',
  summary: 'Leave SSA form safely: convert phi nodes into predecessor-edge parallel copies, split critical edges, resolve cycles, and emit ordinary moves.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['phi to copies', 'cycle resolution'], defaultValue: 'phi to copies' },
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

function ssaOutGraph(title) {
  return graphState({
    nodes: [
      { id: 'p1', label: 'P1', x: 0.9, y: 2.5, note: 'x1' },
      { id: 'p2', label: 'P2', x: 0.9, y: 5.2, note: 'x2' },
      { id: 'edge1', label: 'copy', x: 2.8, y: 2.5, note: 'x=x1' },
      { id: 'edge2', label: 'copy', x: 2.8, y: 5.2, note: 'x=x2' },
      { id: 'join', label: 'join', x: 4.8, y: 3.8, note: 'phi' },
      { id: 'pcopy', label: 'pcopy', x: 6.5, y: 3.8, note: 'parallel' },
      { id: 'temp', label: 'tmp', x: 8.0, y: 2.5, note: 'cycle' },
      { id: 'moves', label: 'moves', x: 9.2, y: 3.8, note: 'emit' },
    ],
    edges: [
      { id: 'e-p1-edge1', from: 'p1', to: 'edge1' },
      { id: 'e-p2-edge2', from: 'p2', to: 'edge2' },
      { id: 'e-edge1-join', from: 'edge1', to: 'join' },
      { id: 'e-edge2-join', from: 'edge2', to: 'join' },
      { id: 'e-join-pcopy', from: 'join', to: 'pcopy' },
      { id: 'e-pcopy-temp', from: 'pcopy', to: 'temp' },
      { id: 'e-temp-moves', from: 'temp', to: 'moves' },
      { id: 'e-pcopy-moves', from: 'pcopy', to: 'moves' },
    ],
  }, { title });
}

function* phiToCopies() {
  yield {
    state: ssaOutGraph('A phi node becomes edge-specific copies'),
    highlight: { active: ['p1', 'p2', 'join', 'e-edge1-join', 'e-edge2-join'], compare: ['moves'] },
    explanation: 'A phi chooses a value based on the predecessor edge. To leave SSA, insert the corresponding copy on each incoming edge before control reaches the join.',
  };
  yield {
    state: labelMatrix(
      'Phi lowering',
      [
        { id: 'phi', label: 'x=phi(x1,x2)' },
        { id: 'p1', label: 'edge P1' },
        { id: 'p2', label: 'edge P2' },
        { id: 'join', label: 'join block' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['SSA choice', 'removed'],
        ['x1 live', 'x=x1'],
        ['x2 live', 'x=x2'],
        ['uses x', 'ordinary var'],
      ],
    ),
    highlight: { active: ['p1:after', 'p2:after'], found: ['phi:after'], compare: ['join:before'] },
    explanation: 'The copies must execute only on the path they belong to. Critical edges often need splitting so there is a safe place to put edge-specific code.',
    invariant: 'A phi assignment is conceptually parallel at block entry, not an ordered list of assignments.',
  };
  yield {
    state: ssaOutGraph('After phi elimination, later passes see ordinary moves'),
    highlight: { active: ['edge1', 'edge2', 'moves', 'e-p1-edge1', 'e-p2-edge2'], found: ['pcopy'] },
    explanation: 'Once phi nodes become moves, the backend can allocate registers, schedule instructions, and emit code using the normal machine model.',
  };
}

function* cycleResolution() {
  yield {
    state: ssaOutGraph('Parallel copies can contain cycles'),
    highlight: { active: ['pcopy', 'temp', 'e-pcopy-temp'], compare: ['moves'], found: ['join'] },
    explanation: 'A parallel copy such as (a,b) := (b,a) cannot be emitted as a naive ordered list. The first move would overwrite a value still needed by the second move.',
  };
  yield {
    state: labelMatrix(
      'Resolving (a,b) := (b,a)',
      [
        { id: 'm1', label: 'save' },
        { id: 'm2', label: 'move a' },
        { id: 'm3', label: 'move b' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'why', label: 'why' },
      ],
      [
        ['tmp=a', 'break cycle'],
        ['a=b', 'safe now'],
        ['b=tmp', 'restore'],
        ['no phi', 'non-SSA'],
      ],
    ),
    highlight: { active: ['m1:move', 'm2:move', 'm3:move'], found: ['done:why'] },
    explanation: 'Cycle resolution introduces a temporary location or uses a swap instruction when available. The algorithm must preserve the simultaneous meaning of the original parallel copy.',
  };
  yield {
    state: ssaOutGraph('SSA destruction is part of backend correctness'),
    highlight: { active: ['join', 'pcopy', 'moves', 'e-join-pcopy', 'e-pcopy-moves'], compare: ['temp'] },
    explanation: 'Incorrect phi elimination can silently compile the wrong program. This small pass is where elegant SSA semantics meet messy machine moves.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'phi to copies') yield* phiToCopies();
  else if (view === 'cycle resolution') yield* cycleResolution();
  else throw new InputError('Pick an SSA-destruction view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SSA form gives every definition a unique name and uses phi nodes to merge values at control-flow joins. Real machine code does not have phi instructions. SSA destruction is the backend step that compiles phi nodes into ordinary moves.',
        'The key idea is that a phi node at a join block becomes a parallel copy on each incoming edge. The copy selected depends on which predecessor executed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For x = phi [x1 from P1, x2 from P2], insert x = x1 on the edge from P1 and x = x2 on the edge from P2. If the edge is critical, meaning one predecessor branches to multiple successors and the join has multiple predecessors, the compiler may split the edge to create a safe block for the copy.',
        'Parallel copies must be scheduled carefully. The copy set (a,b) := (b,a) is a swap, not two independent assignments. A naive a=b; b=a loses the original a. The resolver must use a temporary, a swap instruction, or an equivalent sequence.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose an if statement assigns x1 in the then block and x2 in the else block. The join block uses x3 = phi(x1, x2). Before final code generation, the compiler inserts x3=x1 on the then edge and x3=x2 on the else edge. The join now reads an ordinary x3.',
        'Now suppose two phi nodes swap values at a loop header. The parallel copy says a receives b while b receives a. The pass must detect the cycle and introduce tmp=a; a=b; b=tmp, or use a target swap instruction. That is why phi elimination is a data-structure problem over copy graphs, not a text replacement.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'The hard part is placement. Copies belong to edges, not merely to predecessor or successor blocks. If a predecessor has multiple successors, placing the copy at the end of the predecessor can run it on the wrong branch. If a successor has multiple predecessors, placing all copies at the start of the successor can mix paths. Splitting critical edges creates an unambiguous home.',
        'Register coalescing interacts with this pass. If the phi destination and incoming value can share a physical register, the copy can disappear. If they cannot, the copy must remain, and the copy scheduler must still preserve parallel semantics.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'The common bug is treating phi nodes as sequential assignments at the top of the join block. That changes behavior when multiple predecessors exist. Another bug is resolving parallel-copy cycles without a temporary, which overwrites values before all destinations have received the old source values.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LLVM phi instruction reference at https://llvm.org/docs/LangRef.html#phi-instruction, LLVM code generator overview at https://llvm.org/docs/CodeGenerator.html, SSA elimination after register allocation at https://homepages.dcc.ufmg.br/~fernando/publications/papers/CC09.pdf, and verified SSA destruction paper at https://hal.science/hal-01378393/document. Study Iterated Register Coalescing, Interference Graph Register Allocation, Static Single Assignment & Phi Nodes, Instruction Selection DAG & GlobalISel, Linear Scan Register Allocation, and Deoptimization Stack Maps & Safepoints next.',
      ],
    },
  ],
};
