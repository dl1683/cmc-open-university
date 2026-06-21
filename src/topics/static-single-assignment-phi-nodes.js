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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/static-single-assignment-phi-nodes.gif', alt: 'Animated walkthrough of the static single assignment phi nodes visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Compiler optimizations need to answer one basic question over and over: where did this value come from? In straight-line code, the answer is usually nearby. Across branches, loops, early returns, and repeated assignments, the same source variable name can refer to different runtime values depending on the path taken through the program.`,
        {type: 'callout', text: `SSA makes value provenance local: each ordinary use names one definition, and each phi names the control-flow edge that selected it.`},
        `Mutable variables hide value flow. A source program may assign x in a then branch, assign x again in an else branch, update x in a loop, and read x after the join. The compiler cannot optimize that read safely unless it knows which definitions can reach it. Recomputing broad reaching-definition facts for every optimization is expensive and error-prone.`,
        `Static Single Assignment form exists to make the value graph explicit. Every SSA value has one definition. Every use points to a specific definition, except at control-flow joins where several path-specific definitions meet. Phi nodes represent those joins. They are the price paid for turning mutation into a graph of values.`,
      ],
    },
    {
      heading: 'The naive approach and why it fails',
      paragraphs: [
        `The naive compiler keeps source variables as mutable slots. It can still run data-flow analyses: reaching definitions, live variables, available expressions, and constant propagation all work without SSA in principle. This is a reasonable first design, especially for an interpreter or simple bytecode compiler.`,
        `The problem is that each analysis must rediscover value flow through the control-flow graph. If x is assigned in several blocks, a use of x may depend on any assignment whose path reaches that use without being overwritten. Loops add backedge definitions. Branches add mutually exclusive definitions. The optimizer spends effort scanning and merging sets when it really wants direct use-def edges.`,
        `The naive approach also invites mistakes. A constant from one branch can be propagated into a join where the other branch supplies a different value. A dead assignment can be removed even though it is still needed on a rare path. A loop induction variable can be treated as one changing slot instead of a sequence of related values. SSA does not make optimization automatic, but it removes much of this ambiguity.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core move is to rename assignments, not variables. Each assignment to a source name creates a new SSA value. A later use reads the current version for the path being considered. If one definition reaches all paths to a use, that use names the definition directly. If different definitions reach a join from different predecessors, the compiler inserts a phi node.`,
        `For an if statement, source code may say: if cond then x = G else x = H; return x. SSA says: then defines x0, else defines x1, and the join defines x2 = phi [x0, then], [x1, else]. The return uses x2. The phi does not recompute cond. It chooses the value associated with the predecessor edge that control actually used.`,
        `The result is a sparse value graph. Optimizations can follow def-use and use-def chains instead of repeatedly solving broad data-flow equations. The control-flow graph still matters, but value identity is now explicit in the IR.`,
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        `Classic SSA construction starts with the control-flow graph and dominator tree. A block dominates another block if every path from entry to the second block passes through the first. Dominance tells the compiler where a definition is guaranteed to be seen. Dominance frontiers identify the join points where a definition from one region can meet control flow from outside that region.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'SSA construction starts from directed control flow: phi nodes are inserted only where predecessor paths can carry different definitions into the same block. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        `For each variable assigned in multiple places, the compiler places phi nodes at appropriate dominance-frontier blocks. Then it renames variables by walking the dominator tree. For each source variable, the renamer keeps a stack of current SSA names. When it sees an assignment, it creates a fresh name and pushes it. When it sees a use, it reads the name on top of the stack. When it processes successor phi nodes, it fills in the incoming value for the current block. When it leaves the block, it pops names created in that block.`,
        `That stack discipline is what prevents sibling paths from seeing each other values. A name defined in the then branch is current while visiting blocks dominated by the then branch. It is popped before visiting the else branch. The join receives both names through phi incoming edges instead of pretending either branch definition dominates the other.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The phi-at-joins view proves that a merged value is not a guess. The then block and else block each define their own SSA value. The join block cannot use either one directly because neither definition is guaranteed to dominate the join on all paths. The phi records the path-specific choice at the exact place where control-flow paths meet.`,
        `The rename view proves that SSA names are values, not storage locations. x0, x1, and x2 are not three memory slots that must exist at runtime. They are IR names with one definition each. Later backend passes may coalesce them into one register, spill them to memory, or eliminate them entirely. During optimization, their purpose is to make data dependencies precise.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is dominance plus explicit merging. If a normal SSA value is used, its definition dominates the use, so every path to the use has passed through the definition. If no single definition dominates, the phi lists one incoming value per predecessor. The selected incoming value is determined by the edge taken into the block.`,
        `This shape prevents a class of optimizer bugs. Constant propagation can follow the incoming values of a phi and only fold when all reachable choices agree or when control flow proves one choice impossible. Dead-code elimination can remove definitions with no uses while preserving values that feed live phis. Loop optimizers can represent induction variables with header phis that merge the initial value and the backedge value.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `SSA adds IR objects and maintenance rules. Phi nodes must have one incoming value for each predecessor. If a pass splits an edge, deletes a block, duplicates a loop, or redirects control flow, it must update affected phis. Broken phi lists are correctness bugs, not cosmetic damage.`,
        `Memory complicates the story. Pure SSA works cleanly for register-like scalar values. Heap locations, aliases, volatile operations, and address-taken variables need additional structure. Many compilers promote simple stack variables into SSA with a mem2reg pass, but leave complicated memory operations in memory form or use MemorySSA to model memory dependencies sparsely. SSA for values does not automatically solve alias analysis.`,
        `There is also a lowering cost. Real machines do not execute phi nodes. Before final machine code, phis must become edge copies or parallel copies, and those copies must be scheduled without clobbering source values. Register allocation may remove many copies by coalescing, but it can also create spills if live ranges grow too large.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `SSA is the normal internal form for modern optimizing compilers. LLVM IR uses SSA values for registers. JavaScript engines, JVM compilers, WebAssembly engines, shader compilers, and many ahead-of-time native compilers use SSA or SSA-like forms because optimizations become easier to express and verify.`,
        `Sparse conditional constant propagation uses SSA edges to propagate facts only where they matter. Global value numbering and common-subexpression elimination compare operations by operands and definitions. Dead-code elimination follows use lists. Loop optimizers understand induction variables through loop-header phis. Register allocators use SSA liveness to build intervals or interference. Even when frontends start from mutable variables, optimizers often promote eligible values into SSA because the form pays for itself.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `Phi misunderstanding is the most common conceptual failure. A phi is not a runtime function call and not a branch inserted at the top of a block. It is an IR merge tied to predecessor edges. Moving it like a normal instruction can change meaning. Lowering it inside the join block is wrong because the join no longer knows which predecessor supplied the value.`,
        `Construction can fail by placing too few phis, placing too many phis without pruning, or renaming with the wrong stack scope. Too few phis lose values. Too many phis bloat IR and slow passes, though later cleanup can remove useless ones. Bad renaming lets a definition from one path leak into another. CFG updates after construction can also break SSA if passes do not repair phi incoming lists.`,
        `SSA is also not a replacement for all analyses. It makes value flow explicit, but aliasing, concurrency, exceptions, undefined behavior, and target-specific lowering still need separate reasoning. SSA is a foundation for optimization, not the whole compiler.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Control Flow Graph & Dominator Tree before implementing SSA construction. Then study Dominance Frontier SSA Construction for phi placement, Sparse Conditional Constant Propagation for a classic SSA optimization, MemorySSA Alias Graph for memory dependence, and SSA Destruction Phi Elimination & Parallel Copy for leaving SSA. Continue into Linear Scan Register Allocation, Interference Graph Register Allocation, Instruction Selection DAG & GlobalISel, and Calling Convention & Stack Frame Layout to see how SSA values become executable machine code.`,
      ],
    },
  ],
};
