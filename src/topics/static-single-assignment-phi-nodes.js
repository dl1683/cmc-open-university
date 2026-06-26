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
  const cfg = ssaGraph('Mutable x becomes versioned SSA values');
  const cfgNodes = cfg.nodes;
  const cfgEdges = cfg.edges;
  const thenNode = cfgNodes.find(n => n.id === 'then');
  const elseNode = cfgNodes.find(n => n.id === 'else');
  const phiNode = cfgNodes.find(n => n.id === 'phi');
  const phiPredecessors = cfgEdges.filter(e => e.to === 'phi' && e.from !== 'join');
  yield {
    state: cfg,
    highlight: { active: ['then', 'else'], compare: ['phi'] },
    explanation: `In source code, x is assigned in both branches. In SSA, each assignment gets a new name: ${thenNode.note} in then, ${elseNode.note} in else. The join needs a value that depends on which of the ${cfgNodes.length} blocks actually executed.`,
  };
  yield {
    state: ssaGraph('A phi node merges predecessor-specific values'),
    highlight: { active: ['then', 'else', 'phi', 'e-then-phi', 'e-else-phi'], found: ['ret'] },
    explanation: `The phi node (${phiNode.note}) says: if control arrived from then, use ${thenNode.note}; if it arrived from else, use ${elseNode.note}. It merges ${phiPredecessors.length} predecessor values — it is not a runtime function call but an IR merge instruction tied to ${cfgEdges.length} CFG edges.`,
    invariant: `A phi chooses among ${phiPredecessors.length} incoming edges, not by recomputing the condition.`,
  };
  const matRows = [
    { id: 'assign', label: 'definitions' },
    { id: 'frontier', label: 'frontier' },
    { id: 'rename', label: 'rename' },
    { id: 'use', label: 'uses' },
  ];
  const matCols = [
    { id: 'job', label: 'job' },
    { id: 'structure', label: 'structure' },
  ];
  yield {
    state: labelMatrix(
      'Where phis come from',
      matRows,
      matCols,
      [
        ['find assigned vars', 'CFG blocks'],
        ['find join sites', 'dom frontier'],
        ['stack of versions', 'dom tree walk'],
        ['point to one def', 'use-def chain'],
      ],
    ),
    highlight: { active: ['frontier:structure', 'rename:structure'], found: ['use:structure'] },
    explanation: `Classic SSA construction has ${matRows.length} phases across ${matCols.length} dimensions: it places phis at dominance frontiers, then renames variables with stacks while walking the dominator tree.`,
  };
}

function* renameAndOptimize() {
  const udg = useDefGraph('SSA makes use-def chains direct');
  const udgNodes = udg.nodes;
  const udgEdges = udg.edges;
  const phiNode = udgNodes.find(n => n.note === 'phi');
  const chainNodes = udgNodes.filter(n => ['x2', 'y0', 'z0'].includes(n.id));
  yield {
    state: udg,
    highlight: { active: ['x2', 'y0', 'z0', 'e-x2-y0', 'e-y0-z0'], found: ['ret'] },
    explanation: `Once every value has one definition, a use can point directly to its definition. Across ${udgNodes.length} SSA values linked by ${udgEdges.length} edges, constant propagation, dead-code elimination, CSE, and sparse dataflow all become simpler.`,
  };
  const optRows = [
    { id: 'const', label: 'constant prop' },
    { id: 'dead', label: 'dead code' },
    { id: 'cse', label: 'CSE' },
    { id: 'alloc', label: 'reg alloc' },
  ];
  const optCols = [
    { id: 'ssa', label: 'SSA help' },
    { id: 'next', label: 'next structure' },
  ];
  yield {
    state: labelMatrix(
      'Optimization wins',
      optRows,
      optCols,
      [
        ['one def per use', 'value graph'],
        ['unused def obvious', 'liveness'],
        ['same operands visible', 'hashing'],
        ['live intervals', 'linear scan'],
      ],
    ),
    highlight: { active: ['const:ssa', 'dead:ssa', 'alloc:next'] },
    explanation: `SSA is not just a pretty naming convention. It enables ${optRows.length} major optimizations across ${optCols.length} structural dimensions by making def-use relationships sparse and explicit.`,
  };
  const ssaNames = udgNodes.filter(n => n.id.startsWith('x'));
  yield {
    state: useDefGraph('Register allocation eventually leaves SSA'),
    highlight: { active: ['x0', 'x1', 'x2'], compare: ['y0', 'z0'], found: ['ret'] },
    explanation: `Machine code has finite registers and memory slots, not infinite SSA names. The ${ssaNames.length} x-versions (${ssaNames.map(n => n.id).join(', ')}) must be mapped to physical registers — Linear Scan Register Allocation turns virtual SSA values into registers and spills.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each numbered name as one value, not as one storage slot. A definition is the instruction that creates a value, and a use is an instruction that reads it. The active block shows where control flow currently is, while the phi row shows which incoming edge supplies the value at a join.',
        'A phi node is an intermediate-representation merge, not a runtime function call. If the edge from the then block is taken, the phi selects the then value; if the edge from the else block is taken, it selects the else value. That edge-based selection is the safe inference the animation is making.',
        {type: 'image', src: './assets/gifs/static-single-assignment-phi-nodes.gif', alt: 'Animated walkthrough of the static single assignment phi nodes visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Compilers optimize programs by asking where each value came from and where it is used. Source variables are mutable names, so the same name can mean different runtime values after branches and loops. Static Single Assignment form, or SSA, gives each computed value exactly one definition.',
        {type: 'callout', text: `SSA makes value provenance local: each ordinary use names one definition, and each phi names the control-flow edge that selected it.`},
        'SSA exists because many optimizations become local once value identity is explicit. Constant propagation, dead-code elimination, common-subexpression elimination, and loop analysis can follow def-use edges instead of rediscovering broad reaching-definition facts. Phi nodes are the cost paid at control-flow joins where one name may come from several paths.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious compiler representation keeps source variables as mutable slots. An assignment to x overwrites the previous x, and a later read asks which assignment reaches that point. This is a reasonable design for an interpreter or a simple bytecode compiler.',
        'Data-flow analysis can still answer the question, but it has to carry sets of possible definitions through the control-flow graph. A control-flow graph is a directed graph of basic blocks, where each block is a straight-line sequence of instructions. At every branch and loop, those sets have to be merged and recomputed until they stop changing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ambiguity at joins. If the then branch assigns x = 2 and the else branch assigns x = 5, a later use of x is not allowed to pretend either assignment dominates the join. Dominance means every path from entry to the use must pass through the definition.',
        'Loops make the same problem recur. The value at a loop header may be the initial value on the first iteration and the updated value on later iterations. A mutable slot hides that distinction, so optimizers need extra analysis to avoid propagating the wrong value.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'SSA renames assignments instead of renaming variables by hand. Each assignment creates a fresh version such as x0 or x1, and each ordinary use names the one definition that dominates it. Where no single definition dominates, the compiler inserts a phi node with one incoming value per predecessor edge.',
        'The phi is the only special case. It says that the value after the join is selected by the edge that control used to enter the block. That keeps the value graph sparse while preserving the control-flow fact that different paths carry different values.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Classic SSA construction starts by computing dominators and dominance frontiers. A dominance frontier is a block where a definition from one region can meet control from outside that region. Those frontier blocks are where phi nodes may be needed.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'SSA construction starts from directed control flow: phi nodes are inserted only where predecessor paths can carry different definitions into the same block. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'After phi placement, the compiler walks the dominator tree and renames variables with a stack per source name. On assignment, it pushes a fresh SSA name; on use, it reads the top of the stack. When leaving a block, it pops names created there, so sibling branches cannot see each other values.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every ordinary use is dominated by its definition. Because every path to the use passes through that definition, the use cannot accidentally read a value from a different path. The rename stack enforces this while the dominator-tree walk enters and leaves scopes.',
        'Phi nodes cover the cases where the invariant cannot be satisfied by one ordinary definition. Each predecessor contributes the value that is current on that edge, and the phi result dominates later uses in the join block. Correctness comes from preserving both facts: one definition per SSA value and one incoming value per predecessor edge.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'SSA construction is usually near linear in the size of the control-flow graph plus the number of inserted phi operands. When the function doubles in blocks and edges, dominator and rename work roughly double. Poor phi placement can still bloat the intermediate representation and slow later passes.',
        'The behavior cost appears during maintenance. If a pass splits an edge, deletes a block, or clones a loop, phi incoming lists must be repaired. SSA also does not solve memory aliasing by itself, so compilers either promote simple stack variables into SSA or use separate memory-dependence structures.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Modern optimizing compilers use SSA or an SSA-like form for register values. LLVM IR, many JavaScript engines, JVM compilers, WebAssembly engines, and shader compilers use the form because value flow becomes explicit enough for sparse optimizations. The same idea also supports precise diagnostics in compiler debug views.',
        'The access pattern is what makes SSA useful. Optimizations ask for users of this value, the definition of that operand, and the phi choices at this join. SSA turns those into graph walks instead of whole-function data-flow recomputation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SSA fails as a mental model when phi nodes are treated like normal instructions. A phi belongs to incoming edges, so lowering it as a copy inside the join block can clobber values after the predecessor information is gone. Correct SSA destruction inserts edge copies or parallel copies before machine code.',
        'SSA also has limits around memory, exceptions, concurrency, and undefined behavior. Two pointer writes may refer to the same heap location even when their SSA value names differ. The form makes scalar value flow clear, but alias analysis and target lowering still have to do their own work.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider if cond then x = 2 else x = 5; y = x + 1. In SSA, the then block defines x0 = 2 and the else block defines x1 = 5. The join defines x2 = phi [x0, then], [x1, else], and y0 = x2 + 1.',
        'If control enters from then, x2 is 2 and y0 is 3. If control enters from else, x2 is 5 and y0 is 6. The optimizer may fold y0 only if it proves one edge is impossible or both incoming values agree.',
        'A loop uses the same rule. For i = 0; while i < 3; i = i + 1, the header phi is i1 = phi [0, entry], [i2, backedge]. The first iteration reads 0, the next reads 1, and the next reads 2, while every SSA name still has one definition.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Cytron et al., "Efficiently Computing Static Single Assignment Form and the Control Dependence Graph," ACM TOPLAS 1991, for the classic dominance-frontier construction. Then read LLVM documentation on SSA values and mem2reg to see the production version of the idea.',
        'Study control-flow graphs and dominator trees before implementing SSA. Afterward, study sparse conditional constant propagation, MemorySSA, phi elimination with parallel copies, and register allocation so the full lifetime of an SSA value is visible.',
      ],
    },
  ],
};