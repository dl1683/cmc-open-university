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
  const g1 = ssaOutGraph('A phi node becomes edge-specific copies');
  const p1Node = g1.nodes.find(n => n.id === 'p1');
  const p2Node = g1.nodes.find(n => n.id === 'p2');
  const joinNode = g1.nodes.find(n => n.id === 'join');
  yield {
    state: g1,
    highlight: { active: ['p1', 'p2', 'join', 'e-edge1-join', 'e-edge2-join'], compare: ['moves'] },
    explanation: `A ${joinNode.note} chooses a value based on the predecessor edge. To leave SSA, insert the corresponding copy on each of the ${g1.edges.length} edges before control reaches the join.`,
  };
  const matRows = [
    { id: 'phi', label: 'x=phi(x1,x2)' },
    { id: 'p1', label: 'edge P1' },
    { id: 'p2', label: 'edge P2' },
    { id: 'join', label: 'join block' },
  ];
  const matCols = [
    { id: 'before', label: 'before' },
    { id: 'after', label: 'after' },
  ];
  const m1 = labelMatrix(
    'Phi lowering',
    matRows,
    matCols,
    [
      ['SSA choice', 'removed'],
      ['x1 live', 'x=x1'],
      ['x2 live', 'x=x2'],
      ['uses x', 'ordinary var'],
    ],
  );
  yield {
    state: m1,
    highlight: { active: ['p1:after', 'p2:after'], found: ['phi:after'], compare: ['join:before'] },
    explanation: `The copies must execute only on the path they belong to. With ${matRows.length} rows tracking predecessors ${p1Node.note} and ${p2Node.note}, critical edges often need splitting so there is a safe place to put edge-specific code.`,
    invariant: `A ${joinNode.note} assignment is conceptually parallel at block entry across ${matCols.length} phases (before/after), not an ordered list of assignments.`,
  };
  const g2 = ssaOutGraph('After phi elimination, later passes see ordinary moves');
  const pcopyNode = g2.nodes.find(n => n.id === 'pcopy');
  const movesNode = g2.nodes.find(n => n.id === 'moves');
  yield {
    state: g2,
    highlight: { active: ['edge1', 'edge2', 'moves', 'e-p1-edge1', 'e-p2-edge2'], found: ['pcopy'] },
    explanation: `Once ${joinNode.note} nodes become moves, the backend can allocate registers across ${g2.nodes.length} nodes, schedule instructions, and ${movesNode.note} code using the normal machine model.`,
  };
}

function* cycleResolution() {
  const g1 = ssaOutGraph('Parallel copies can contain cycles');
  const pcopyNode = g1.nodes.find(n => n.id === 'pcopy');
  const tempNode = g1.nodes.find(n => n.id === 'temp');
  const joinNode = g1.nodes.find(n => n.id === 'join');
  yield {
    state: g1,
    highlight: { active: ['pcopy', 'temp', 'e-pcopy-temp'], compare: ['moves'], found: ['join'] },
    explanation: `A ${pcopyNode.note} copy such as (a,b) := (b,a) cannot be emitted as a naive ordered list. The first move would overwrite a value still needed by the second move.`,
  };
  const resRows = [
    { id: 'm1', label: 'save' },
    { id: 'm2', label: 'move a' },
    { id: 'm3', label: 'move b' },
    { id: 'done', label: 'done' },
  ];
  const resCols = [
    { id: 'move', label: 'move' },
    { id: 'why', label: 'why' },
  ];
  const m1 = labelMatrix(
    'Resolving (a,b) := (b,a)',
    resRows,
    resCols,
    [
      ['tmp=a', 'break cycle'],
      ['a=b', 'safe now'],
      ['b=tmp', 'restore'],
      ['no phi', 'non-SSA'],
    ],
  );
  yield {
    state: m1,
    highlight: { active: ['m1:move', 'm2:move', 'm3:move'], found: ['done:why'] },
    explanation: `${tempNode.note} resolution introduces a temporary location across ${resRows.length} steps and ${resCols.length} columns. The algorithm must preserve the simultaneous meaning of the original ${pcopyNode.note} copy.`,
  };
  const g2 = ssaOutGraph('SSA destruction is part of backend correctness');
  yield {
    state: g2,
    highlight: { active: ['join', 'pcopy', 'moves', 'e-join-pcopy', 'e-pcopy-moves'], compare: ['temp'] },
    explanation: `Incorrect ${joinNode.note} elimination can silently compile the wrong program. This small pass across ${g2.nodes.length} nodes is where elegant SSA semantics meet messy machine moves.`,
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
    { heading: 'How to read the animation', paragraphs: ['Active nodes show the phi or copy currently being lowered. Found markers show edge copies that are safely placed, and compare markers show the final sequential move order.', {type: 'callout', text: 'SSA destruction is correct only when edge placement and parallel-copy semantics both survive lowering.'}, {type: 'image', src: './assets/gifs/ssa-destruction-phi-elimination-parallel-copy.gif', alt: 'Animated walkthrough of the ssa destruction phi elimination parallel copy visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['Static single assignment gives each value one definition, which helps optimization. Real machines do not execute phi nodes, so the compiler must lower them into moves.'], },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach puts phi copies at the top of the join block. That is wrong because the join runs after every predecessor and would execute copies for paths not taken.'], },
    { heading: 'The wall', paragraphs: ['Copies belong to control-flow edges, not just blocks. Multiple phi copies on one edge are also simultaneous, so a naive sequence can overwrite a source before it is read.'], },
    { heading: 'The core insight', paragraphs: ['Treat every incoming edge as a parallel-copy bundle. Split a critical edge when there is no safe place for edge-only code, then serialize the bundle without losing old source values.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Rust_MIR_CFG.svg/250px-Rust_MIR_CFG.svg.png', alt: 'Rust compiler MIR control-flow graph with basic blocks and branch edges', caption: 'Real compiler IR exposes the same edge-sensitive problem: phi copies must land on control-flow edges, not merely inside successor blocks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Rust_MIR_CFG.svg.'}], },
    { heading: 'How it works', paragraphs: ['For x = phi(a from P, b from Q), put x := a on edge P to the join and x := b on edge Q to the join. If a parallel copy has a cycle such as a := b and b := a, save one value in a temporary.'], },
    { heading: 'Why it works', paragraphs: ['Edge placement preserves the phi selection rule because only the taken predecessor copy executes. Temporary-based sequentialization preserves parallel-copy meaning because every destination receives the old source value.'], },
    { heading: 'Cost and complexity', paragraphs: ['Placement is linear in total phi arguments, and critical-edge splitting is linear in control-flow edges. Sequentializing a copy bundle is linear in the number of copies plus one temporary move per cycle.'], },
    { heading: 'Real-world uses', paragraphs: ['Every SSA-based compiler needs this pass or an equivalent allocator-integrated lowering. It matters most in loops and branch-heavy code where phi nodes carry path-specific values.'], },
    { heading: 'Where it fails', paragraphs: ['Wrong lowering causes silent miscompilation. Critical-edge splitting can add blocks, and aggressive copy coalescing can increase live ranges enough to create spills.'], },
    { heading: 'Worked example', paragraphs: ['For x3 = phi(x1 from P, x2 from Q), edge P gets x3 := x1 and edge Q gets x3 := x2. For (a, b) := (b, a), the safe sequence is tmp := a; a := b; b := tmp.'], },
    { heading: 'Sources and study next', paragraphs: ['Study Cytron et al. on SSA, Briggs et al. on lost copies and swaps, Sreedhar et al. on translating out of SSA, and Rideau et al. on verified parallel moves. Then study CFGs, critical edges, register allocation, and copy coalescing.'], },
  ],
};
