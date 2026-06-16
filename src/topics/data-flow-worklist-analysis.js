// Data-flow analysis: propagate facts over a control-flow graph until the
// worklist reaches a fixpoint.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'data-flow-worklist-analysis',
  title: 'Data-Flow Worklist Analysis',
  category: 'Concepts',
  summary: 'A static-analysis engine: keep facts per CFG block, push changed facts through transfer functions, and stop when the worklist reaches a fixpoint.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reaching definitions', 'liveness fixpoint'], defaultValue: 'reaching definitions' },
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

function worklistGraph(title) {
  return graphState({
    nodes: [
      { id: 'cfg', label: 'CFG', x: 1.0, y: 3.8, note: 'blocks' },
      { id: 'facts', label: 'facts', x: 2.7, y: 2.2, note: 'in/out' },
      { id: 'worklist', label: 'queue', x: 2.9, y: 5.4, note: 'changed' },
      { id: 'transfer', label: 'transfer', x: 4.8, y: 3.8, note: 'gen/kill' },
      { id: 'join', label: 'join', x: 6.8, y: 2.4, note: 'meet' },
      { id: 'loop', label: 'loop', x: 6.8, y: 5.3, note: 'repeat' },
      { id: 'fixpoint', label: 'fixed', x: 8.8, y: 3.8, note: 'stable' },
    ],
    edges: [
      { id: 'e-cfg-facts', from: 'cfg', to: 'facts' },
      { id: 'e-cfg-worklist', from: 'cfg', to: 'worklist' },
      { id: 'e-facts-transfer', from: 'facts', to: 'transfer' },
      { id: 'e-worklist-transfer', from: 'worklist', to: 'transfer' },
      { id: 'e-transfer-join', from: 'transfer', to: 'join' },
      { id: 'e-join-loop', from: 'join', to: 'loop' },
      { id: 'e-loop-worklist', from: 'loop', to: 'worklist' },
      { id: 'e-join-fixpoint', from: 'join', to: 'fixpoint' },
    ],
  }, { title });
}

function* reachingDefinitions() {
  yield {
    state: worklistGraph('A worklist propagates facts through the CFG'),
    highlight: { active: ['cfg', 'facts', 'worklist', 'e-cfg-facts', 'e-cfg-worklist'], compare: ['fixpoint'] },
    explanation: 'Data-flow analysis starts with a control-flow graph and a fact set for each block. The worklist holds blocks whose input facts changed and therefore need their output recomputed.',
  };
  yield {
    state: labelMatrix(
      'Reaching definitions',
      [
        { id: 'entry', label: 'entry' },
        { id: 'then', label: 'then x=G' },
        { id: 'else', label: 'else x=H' },
        { id: 'join', label: 'join use x' },
      ],
      [
        { id: 'in', label: 'in facts' },
        { id: 'gen', label: 'gen' },
        { id: 'out', label: 'out facts' },
      ],
      [
        ['{}', '{}', '{}'],
        ['{}', 'x0', 'x0'],
        ['{}', 'x1', 'x1'],
        ['x0,x1', '{}', 'x0,x1'],
      ],
    ),
    highlight: { active: ['then:gen', 'else:gen'], found: ['join:in'], compare: ['entry:out'] },
    explanation: 'A forward analysis pushes definitions from predecessors to successors. At a join, facts from both branches meet, so the use of x can be reached by both x0 and x1.',
    invariant: 'When a block output changes, every successor may need another visit.',
  };
  yield {
    state: worklistGraph('The fixpoint means no fact set changes anymore'),
    highlight: { active: ['transfer', 'join', 'fixpoint', 'e-transfer-join', 'e-join-fixpoint'], visited: ['loop', 'worklist'] },
    explanation: 'The algorithm stops at a fixpoint: running every transfer function again would produce the same in/out facts. That stable answer becomes input to optimizers, linters, and security scanners.',
  };
}

function* livenessFixpoint() {
  yield {
    state: worklistGraph('Liveness runs backward from uses to definitions'),
    highlight: { active: ['cfg', 'transfer', 'worklist'], compare: ['join'], found: ['loop'] },
    explanation: 'Some analyses flow backward. Liveness asks which values may be used in the future, so facts travel from successors back to predecessors.',
  };
  yield {
    state: labelMatrix(
      'Backward liveness',
      [
        { id: 'ret', label: 'return x' },
        { id: 'join', label: 'join' },
        { id: 'then', label: 'then x=G' },
        { id: 'else', label: 'else x=H' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'def', label: 'def' },
        { id: 'liveIn', label: 'live in' },
      ],
      [
        ['x', '{}', 'x'],
        ['{}', '{}', 'x'],
        ['{}', 'x', '{}'],
        ['{}', 'x', '{}'],
      ],
    ),
    highlight: { active: ['ret:use', 'join:liveIn'], found: ['then:def', 'else:def'] },
    explanation: 'A use makes a value live. A definition kills liveness for the old value on that path. This is the analysis that feeds Linear Scan Register Allocation.',
  };
  yield {
    state: worklistGraph('Static analysis is a reusable engine'),
    highlight: { active: ['cfg', 'facts', 'transfer', 'join'], found: ['fixpoint'], compare: ['worklist'] },
    explanation: 'Constant propagation, reaching definitions, nullness, liveness, taint tracking, and interval range analysis all reuse the same skeleton: facts, transfer functions, joins, and a worklist.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reaching definitions') yield* reachingDefinitions();
  else if (view === 'liveness fixpoint') yield* livenessFixpoint();
  else throw new InputError('Pick a data-flow view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Data-flow analysis computes facts about a program without running it. The program is represented as a Control Flow Graph & Dominator Tree, and each block has incoming and outgoing facts. A worklist repeatedly revisits blocks whose facts changed until the whole graph stabilizes.',
        'The useful part is the separation of concerns. The framework knows how to schedule blocks, join predecessor facts, and detect convergence. The analysis author supplies the fact domain and the transfer function for each instruction or block.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A forward analysis, such as reaching definitions or constant propagation, pushes facts from predecessors to successors. A backward analysis, such as liveness, pulls facts from successors to predecessors. In both cases the worklist contains blocks that may produce new information.',
        'The join operation combines paths. For may analyses, join usually means union: this definition may reach here. For must analyses, join often means intersection: this property must hold on all incoming paths. The answer is useful only after a fixpoint is reached, because loops can send information around the graph multiple times.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider if (cond) x = G; else x = H; return x. Reaching definitions starts with no facts at entry. The then block generates x0. The else block generates x1. At the join, the incoming facts are x0 and x1, so a later use of x must account for either branch.',
        'Now flip the direction for liveness. return x makes x live before the return. That liveness flows backward through the join. When it reaches either branch assignment, the definition of x satisfies the future use, so x is no longer live before the assignment. This exact information becomes the live interval input for register allocation.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'A practical implementation stores a CFG adjacency list, predecessor lists, per-block in and out fact sets, a queue or deque worklist, and fast equality checks to detect whether a fact set changed. Bitsets are common when facts can be assigned dense integer ids.',
        'Performance depends on representation. Sparse facts are often better as hash sets. Dense facts are often better as bit vectors. Loops make scheduling matter: pushing a block only when input changes avoids a lot of wasted transfer-function work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Clang data-flow analysis intro at https://clang.llvm.org/docs/DataFlowAnalysisIntro.html, CodeQL overview at https://codeql.github.com/docs/writing-codeql-queries/about-data-flow-analysis/, CodeQL JavaScript/TypeScript data-flow guide at https://codeql.github.com/docs/codeql-language-guides/analyzing-data-flow-in-javascript-and-typescript/, and Harvard CS153 data-flow lecture at https://groups.seas.harvard.edu/courses/cs153/2019fa/lectures/Lec20-Dataflow-analysis.pdf. Study Interference Graph Register Allocation, Dominance Frontier SSA Construction, Control Flow Graph & Dominator Tree, Static Single Assignment & Phi Nodes, MemorySSA Alias Graph, Sparse Conditional Constant Propagation, Abstract Interpretation & Interval Domain, eBPF Verifier Register State Case Study, Taint Analysis Source-to-Sink Case Study, and Symbolic Execution Path Constraints next.',
      ],
    },
  ],
};
