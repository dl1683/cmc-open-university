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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "phi to copies" view shows a phi node being lowered into edge-specific copies. Active nodes are the current transformation step. Found markers show completed copy placement. Compare markers show the final emitted moves that replace the abstract phi.',
        {type: 'callout', text: 'SSA destruction is correct only when edge placement and parallel-copy semantics both survive lowering.'},
        'The "cycle resolution" view shows a parallel copy with a dependency cycle. Active nodes trace the cycle-breaking process. The temporary node lights up when the algorithm saves a value to break the cycle. Compare markers show the final sequential move list.',
        'At each frame, check: does this copy run only on the correct edge? Does this move sequence preserve every source value until its destination is written? If you can answer both, you understand the pass.',
      
        {type: 'image', src: './assets/gifs/ssa-destruction-phi-elimination-parallel-copy.gif', alt: 'Animated walkthrough of the ssa destruction phi elimination parallel copy visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Static single assignment gives every computed value a unique name. That rule makes optimization clean: constant propagation traces definitions without aliasing, dead-code elimination counts uses, value numbering compares definitions directly. The price is the phi node. At a control-flow join where a value might come from different predecessors, SSA inserts a phi: x3 = phi(x1 from left, x2 from right). The phi is an abstract selector -- it picks whichever value matches the edge actually taken.',
        'Real processors have no phi instruction. A machine has registers, stack slots, move instructions, and branches that land at labels. Before the compiler emits machine code, every phi must become ordinary data movement. SSA destruction is the pass that replaces phi nodes with concrete copies without changing program meaning. Get it wrong and the compiler silently produces incorrect code.',
        {
          type: 'note',
          text: 'SSA destruction sits at the boundary between elegant IR semantics and messy machine reality. It is small in code but critical in correctness -- most compiler miscompilation bugs traced to phi elimination are silent: no crash, just wrong output.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to place copies at the top of the join block. For x3 = phi(x1, x2), emit both x3 = x1 and x3 = x2 inside the join. This is wrong, not just slow. The join block runs regardless of which predecessor was taken, so both assignments execute. One of them writes a value from the wrong path.',
        'The second instinct is to place copies at the end of each predecessor block. This is closer but still broken. If a predecessor branches to multiple successors, a copy meant only for one successor runs before every branch. The copy belongs to the edge, not to the block.',
        'The third instinct is to place copies on edges (correct placement) but emit them in arbitrary sequential order. This fails because phi assignments are conceptually simultaneous. If two phis in the same block swap values -- a2 = phi(b1), b2 = phi(a1) -- the naive sequence a2 = b1; b2 = a1 overwrites a1 before the second copy reads it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Two specific problems block naive phi elimination. The lost-copy problem arises when a copy is inserted into a predecessor block and a later optimization (like coalescing) removes a related copy, causing a value to never arrive at its destination. Briggs et al. (1998) showed that the original Cytron et al. algorithm could lose copies this way during register coalescing.',
        'The swap problem arises when two or more phi nodes in the same block create a dependency cycle among their copies. The parallel copy (a, b) := (b, a) cannot be serialized without a temporary. A three-way rotation (a, b, c) := (c, a, b) has the same structure. Any naive serialization overwrites a source value before all consumers have read it.',
        {
          type: 'diagram',
          text: 'LOST-COPY PROBLEM:\n\n  Block P:          Block Q:          Join:\n  x1 = ...          x2 = ...          x3 = phi(x1, x2)\n  copy: x3=x1       copy: x3=x2       use x3\n       \\                /\n        v              v\n  If coalescing merges x1 and x3 into one register,\n  the copy x3=x1 is deleted. But if P also modifies\n  x1 after the phi-copy point, x3 gets the wrong value.\n\nSWAP PROBLEM:\n\n  Join: a2 = phi(b1, ...), b2 = phi(a1, ...)\n  Edge copies: (a2, b2) := (b1, a1)   -- parallel\n  Naive serial: a2=b1; b2=a1           -- WRONG: a1 is gone\n  Correct:      tmp=a1; a2=b1; b2=tmp  -- break cycle',
          label: 'The two walls: lost copies and swap cycles',
        },
        'These are not edge cases. Loops with carried state routinely produce swap-pattern phis. The lost-copy problem appears whenever the allocator tries to coalesce phi-related values. A correct SSA destruction pass must handle both.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SSA destruction proceeds in three stages: copy placement, critical-edge splitting, and parallel-copy sequentialization.',
        'Stage 1: For each phi x = phi(a from P, b from Q, ...) in a join block J, create a parallel copy on every incoming edge. Edge P->J gets the assignment x = a; edge Q->J gets x = b. Multiple phis in the same block produce multiple entries in the same edge parallel copy.',
        'Stage 2: If an edge P->J is critical (P has multiple successors, J has multiple predecessors), there is no existing block where edge-specific code can live. The compiler splits the edge by inserting a new empty block S on the edge: P branches to S, S falls through to J. The copies land in S.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Rust_MIR_CFG.svg/250px-Rust_MIR_CFG.svg.png', alt: 'Rust compiler MIR control-flow graph with basic blocks and branch edges', caption: 'Real compiler IR exposes the same edge-sensitive problem: phi copies must land on control-flow edges, not merely inside successor blocks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Rust_MIR_CFG.svg.'},
        {
          type: 'diagram',
          text: 'CRITICAL EDGE SPLITTING:\n\n  Before:                    After:\n\n  P --+--> J (critical)      P --+--> S --> J\n      |                          |\n      +--> K                     +--> K\n\n  S is an empty block that exists solely to hold\n  the copies for the P->J edge.',
          label: 'Splitting a critical edge to create a safe copy location',
        },
        'Stage 3: Each parallel copy is sequentialized into a legal list of machine moves. Build a dependency graph where an edge from copy (src -> dst) to copy (src2 -> dst2) exists if dst = src2. Acyclic copies are scheduled by topological order: emit a copy whose destination is not any other copy source. Cycles are broken by saving one value into a temporary, then completing the rotation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties. First, placement matches the phi selection rule: on edge P->J, the copy writes exactly the value the phi would select when control arrives from P. Because the copy executes only on that edge, the destination holds the correct value at J entry. Second, sequentialization preserves parallel-copy semantics: every destination receives the old source value, not a value overwritten by an earlier move in the sequence.',
        'The dependency graph makes the second property precise. If no copy destination is another copy source, any order works. If the graph is a DAG, topological order ensures every source is read before its location is overwritten. If the graph has a cycle, one source must be saved to a temporary before the cycle is entered, reducing the cycle to a DAG. Because every parallel copy has a finite dependency graph, this process always terminates.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Parallel copy sequentialization (Rideau et al. 2008)\nfunction sequentialize(parallelCopy) {\n  // parallelCopy: array of { src, dst }\n  const moves = [];\n  const loc = new Map();   // current location of each value\n  const pred = new Map();  // inverse: who needs to read from dst?\n\n  for (const { src, dst } of parallelCopy) {\n    loc.set(src, src);\n    pred.set(dst, src);\n  }\n\n  // Process destinations not used as a source (leaf nodes)\n  const ready = [];\n  for (const { src, dst } of parallelCopy) {\n    if (!pred.has(src)) ready.push(dst);\n  }\n\n  while (ready.length > 0 || pred.size > 0) {\n    while (ready.length > 0) {\n      const dst = ready.pop();\n      const src = pred.get(dst);\n      if (src === undefined) continue;\n      moves.push({ src: loc.get(src), dst });\n      pred.delete(dst);\n      if (pred.has(src)) ready.push(src);\n    }\n    // Remaining entries form cycles -- break with a temp\n    if (pred.size > 0) {\n      const [dst, src] = pred.entries().next().value;\n      const tmp = freshTemp();\n      moves.push({ src: loc.get(src), dst: tmp });\n      loc.set(src, tmp);\n      ready.push(dst);\n    }\n  }\n  return moves;\n}',
        },
        'The algorithm emits at most n moves for n copies plus one extra move per cycle to save into a temporary. Typical phi sets produce few cycles, so the overhead is small.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Phi elimination itself is linear in the number of phi arguments across all blocks. For a function with P total phi arguments and E edges in the CFG, copy placement visits each phi argument once: O(P). Critical-edge splitting visits each edge at most once: O(E). Parallel-copy sequentialization processes each copy once plus one extra step per dependency cycle.',
        {
          type: 'bullets',
          items: [
            'Naive copy insertion (Cytron 1991): not lost-copy safe, not swap safe, no critical-edge split, broken for cycles, O(P).',
            'Briggs method (1998): lost-copy safe, swap safe, uses critical-edge splitting, adds one temp per cycle, O(P + E).',
            'Sreedhar Method III (1999): lost-copy safe, swap safe, avoids critical-edge splitting through renaming, adds one temp per cycle, O(P).',
            'LLVM-style phi elimination: lost-copy safe, swap safe, uses critical-edge splitting when needed, adds one temp per cycle, O(P + E).',
          ],
        },
        'The Sreedhar Method III avoids critical-edge splitting entirely by renaming phi destinations. Instead of inserting copies on edges, it renames the phi target to a fresh variable and inserts copies at predecessor block ends and at the join block entry. This avoids creating new basic blocks but introduces more variable names for the register allocator to handle.',
        'In practice, the number of extra moves from cycle breaking is small. Most phi sets in real programs are acyclic or have short cycles (swaps). The dominant cost is not the phi elimination itself but the downstream effect on register allocation: each inserted copy is a potential move instruction the allocator must coalesce or spill around.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Every SSA-based compiler must destroy SSA before emitting machine code, so this pass is universal. LLVM lowers phis in its PHIElimination pass, inserting copies on predecessor edges after critical-edge splitting. GCC eliminates phis during its expand pass when lowering GIMPLE (SSA-based IR) to RTL (register transfer language). The Java HotSpot C2 compiler, the Go compiler, and the Graal JIT all include analogous passes.',
        'The pass is most valuable in code with complex control flow: loops with multiple induction variables, exception handling with phi nodes at landing pads, and SSA-based optimizations that introduce many new phi nodes (like GVN and LICM). In straight-line code with few joins, phi elimination is trivial -- there are few phis to lower.',
        {
          type: 'bullets',
          items: [
            'Loop-carried state: phis at loop headers become back-edge copies, placing the induction variable update exactly where the latch transfers control.',
            'Branch-heavy code (interpreters, state machines): many join points mean many phis, and critical-edge splitting keeps each copy on the correct path.',
            'SSA-based register allocation (Hack et al. 2006): phi elimination is integrated into the allocator rather than run as a separate pre-pass, enabling better coalescing decisions.',
            'JIT compilers: fast SSA destruction matters because compilation time is user-visible latency. Linear-time methods like Sreedhar III are preferred over methods that create many new blocks.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most dangerous failure mode is silent miscompilation. A lost copy produces code that usually works but returns wrong results on specific control-flow paths. A broken swap produces code that works until two particular phi arguments happen to need the same register. These bugs are path-sensitive and often survive test suites that do not exercise the right branch combinations.',
        'Critical-edge splitting can bloat the CFG in code with many conditional branches. Each split edge creates a new basic block, and those blocks can interfere with branch prediction heuristics, code layout, and instruction cache locality. Some backends (like LLVM) try to minimize splitting or defer it, but the semantic obligation remains: if the edge needs a copy and there is no safe place for it, a block must be created.',
        'Aggressive coalescing after phi elimination can create long live ranges that increase register pressure and cause spills. The allocator may undo the coalescing or split live ranges, re-introducing the copies the coalescer removed. This tension between copy elimination and spill pressure is a fundamental tradeoff, not a bug in the algorithm.',
        {
          type: 'note',
          text: 'Debugging phi elimination bugs: run the compiler verifier after the pass to confirm no phi nodes remain and every use is dominated by its definition. Differential testing (compare optimized vs. unoptimized output on randomized programs) catches silent miscompiles that unit tests miss.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Cytron et al., "Efficiently Computing Static Single Assignment Form and the Control Dependence Graph" (1991) -- the original SSA construction paper that introduced phi nodes and naive destruction.',
            'Briggs et al., "Practical Improvements to the Construction and Destruction of Static Single Assignment Form" (1998) -- identified the lost-copy and swap problems, proposed fixes with critical-edge splitting.',
            'Sreedhar et al., "Translating Out of Static Single Assignment Form" (1999) -- three methods for phi elimination without critical-edge splitting, Method III being the most practical.',
            'Rideau et al., "Tilting at Windmills with Coq: Formal Verification of a Compilation Algorithm for Parallel Moves" (2008) -- formally verified parallel-copy sequentialization algorithm.',
            'Hack, Grund, and Goos, "Register Allocation for Programs in SSA Form" (2006) -- SSA-based register allocation that integrates phi elimination with coalescing.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: SSA construction and phi node placement through dominance frontiers.',
            'Prerequisite: control-flow graphs, basic blocks, and critical edges.',
            'Companion: interference graphs and register coalescing.',
            'Extension: SSA-based register allocation, including Hack et al.',
            'Extension: linear scan register allocation.',
            'Contrast: functional SSA or continuation-passing style, which avoids phi nodes entirely.',
          ],
        },
        'A good exercise: take a CFG with two interacting phis at a join block, lower them to a parallel copy by hand, build the dependency graph, identify any cycles, and emit the sequentialized move list. Verify that every destination receives its original source value.',
      ],
    },
  ],
};
