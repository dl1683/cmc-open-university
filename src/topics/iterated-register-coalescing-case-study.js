// Iterated register coalescing: remove copy moves by merging non-interfering
// values without destroying the allocator's ability to color the graph.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'iterated-register-coalescing-case-study',
  title: 'Iterated Register Coalescing',
  category: 'Concepts',
  summary: 'Eliminate register-to-register moves by safely merging copy-related live ranges while simplify, freeze, spill, and select phases preserve colorability.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['move coalescing', 'iterated allocator'], defaultValue: 'move coalescing' },
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

function coalesceGraph(title, merged = false) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 1.0, y: 2.3, note: 'R1' },
      { id: 'b', label: 'B', x: 1.0, y: 5.7, note: 'R2' },
      { id: 'x', label: merged ? 'XY' : 'X', x: 3.3, y: 4.0, note: merged ? 'merged' : 'copy src' },
      { id: 'y', label: 'Y', x: 5.6, y: 4.0, note: 'copy dst' },
      { id: 'c', label: 'C', x: 7.6, y: 2.6, note: 'R1' },
      { id: 'd', label: 'D', x: 7.6, y: 5.4, note: 'R2' },
    ],
    edges: merged ? [
      { id: 'i-a-x', from: 'a', to: 'x' },
      { id: 'i-b-x', from: 'b', to: 'x' },
      { id: 'i-x-c', from: 'x', to: 'c' },
      { id: 'i-x-d', from: 'x', to: 'd' },
      { id: 'i-c-d', from: 'c', to: 'd' },
    ] : [
      { id: 'i-a-x', from: 'a', to: 'x' },
      { id: 'i-b-x', from: 'b', to: 'x' },
      { id: 'm-x-y', from: 'x', to: 'y', weight: 'move' },
      { id: 'i-y-c', from: 'y', to: 'c' },
      { id: 'i-y-d', from: 'y', to: 'd' },
      { id: 'i-c-d', from: 'c', to: 'd' },
    ],
  }, { title });
}

function allocatorGraph(title) {
  return graphState({
    nodes: [
      { id: 'moves', label: 'moves', x: 0.8, y: 4.0, note: 'copies' },
      { id: 'simp', label: 'simplify', x: 2.6, y: 2.2, note: 'low deg' },
      { id: 'coal', label: 'coalesce', x: 2.6, y: 5.8, note: 'safe merge' },
      { id: 'freeze', label: 'freeze', x: 4.8, y: 5.8, note: 'give up' },
      { id: 'spill', label: 'spill', x: 4.8, y: 2.2, note: 'high deg' },
      { id: 'select', label: 'select', x: 7.0, y: 4.0, note: 'color' },
      { id: 'rewrite', label: 'rewrite', x: 8.8, y: 4.0, note: 'if spill' },
    ],
    edges: [
      { id: 'e-moves-simp', from: 'moves', to: 'simp' },
      { id: 'e-moves-coal', from: 'moves', to: 'coal' },
      { id: 'e-coal-simp', from: 'coal', to: 'simp' },
      { id: 'e-coal-freeze', from: 'coal', to: 'freeze' },
      { id: 'e-freeze-simp', from: 'freeze', to: 'simp' },
      { id: 'e-simp-select', from: 'simp', to: 'select' },
      { id: 'e-spill-select', from: 'spill', to: 'select' },
      { id: 'e-select-rewrite', from: 'select', to: 'rewrite' },
      { id: 'e-rewrite-spill', from: 'rewrite', to: 'spill' },
    ],
  }, { title });
}

function* moveCoalescing() {
  yield {
    state: coalesceGraph('A copy creates a move-related pair'),
    highlight: { active: ['x', 'y', 'm-x-y'], compare: ['a', 'b', 'c', 'd'] },
    explanation: 'If machine code contains Y = X, the allocator would like X and Y to use the same physical register. Then the move can disappear.',
  };

  yield {
    state: labelMatrix(
      'Coalescing checks',
      [
        { id: 'same', label: 'same node' },
        { id: 'edge', label: 'interfere' },
        { id: 'briggs', label: 'Briggs' },
        { id: 'george', label: 'George' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'result', label: 'result' },
      ],
      [
        ['already one', 'done'],
        ['has edge', 'cannot'],
        ['few hi deg', 'safe'],
        ['ok neigh', 'safe'],
      ],
    ),
    highlight: { active: ['briggs:test', 'george:test'], compare: ['edge:result'] },
    explanation: 'Coalescing is safe only when merging the pair will not make the graph harder than the register budget can color. Briggs and George give conservative tests for that decision.',
    invariant: 'A move pair can merge only if the merged live range can still receive one legal color.',
  };

  yield {
    state: coalesceGraph('After a safe merge, one node replaces the copy pair', true),
    highlight: { active: ['x', 'i-a-x', 'i-b-x', 'i-x-c', 'i-x-d'], removed: ['y'], found: ['c', 'd'] },
    explanation: 'The merged node inherits neighbors from both old nodes. If it can still be colored, X and Y share a register and the copy instruction is removed.',
  };

  yield {
    state: labelMatrix(
      'When not to merge',
      [
        { id: 'degree', label: 'high deg' },
        { id: 'pre', label: 'precolor' },
        { id: 'class', label: 'reg class' },
        { id: 'debug', label: 'debug val' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'action', label: 'action' },
      ],
      [
        ['uncolorable', 'freeze'],
        ['fixed reg', 'George'],
        ['bad class', 'split'],
        ['lost loc', 'track'],
      ],
    ),
    highlight: { active: ['degree:action', 'pre:action'], compare: ['class:action'] },
    explanation: 'A copy can be real for target reasons. Precolored nodes, register classes, calling conventions, and debug-value tracking can all block or limit coalescing.',
  };

  yield {
    state: allocatorGraph('Coalescing is part of allocation, not a cleanup pass'),
    highlight: { active: ['moves', 'coal', 'simp', 'select', 'e-moves-coal', 'e-coal-simp', 'e-simp-select'], compare: ['freeze', 'spill'] },
    explanation: 'If coalescing happens too aggressively before coloring, it can introduce spills. Iterated coalescing interleaves safe merges with simplification so the allocator keeps making progress.',
  };
}

function* iteratedAllocator() {
  yield {
    state: allocatorGraph('Iterated coalescing cycles through worklists'),
    highlight: { active: ['moves', 'simp', 'coal', 'freeze'], compare: ['spill', 'rewrite'] },
    explanation: 'The allocator keeps separate worklists: simplifiable nodes, move-related nodes, freeze candidates, spill candidates, and selected stack entries. Moving a node can unlock another phase.',
  };

  yield {
    state: labelMatrix(
      'Worklist moves',
      [
        { id: 'low', label: 'low deg' },
        { id: 'move', label: 'move rel' },
        { id: 'freeze', label: 'freeze' },
        { id: 'spill', label: 'spill cand' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'why', label: 'why' },
      ],
      [
        ['simplify', 'easy color'],
        ['coalesce', 'maybe merge'],
        ['simplify', 'drop move'],
        ['spill', 'too dense'],
      ],
    ),
    highlight: { active: ['low:where', 'move:where', 'freeze:where'], compare: ['spill:where'] },
    explanation: 'Freeze is the compromise between preserving a possible copy elimination and making progress. If a move cannot safely coalesce, freezing lets the node simplify later.',
  };

  yield {
    state: labelMatrix(
      'Briggs vs George',
      [
        { id: 'briggs', label: 'Briggs' },
        { id: 'george', label: 'George' },
        { id: 'pre', label: 'precolor' },
        { id: 'iter', label: 'iterated' },
      ],
      [
        { id: 'checks', label: 'checks' },
        { id: 'good', label: 'good for' },
      ],
      [
        ['merged deg', 'plain pair'],
        ['neighbors', 'precolor'],
        ['fixed color', 'ABI regs'],
        ['repeat', 'more moves'],
      ],
    ),
    highlight: { active: ['briggs:checks', 'george:checks'], found: ['iter:good'] },
    explanation: 'George and Appel interleave simplification with conservative coalescing. The interleaving matters because simplifying the graph can make more coalesces safe later.',
  };

  yield {
    state: coalesceGraph('A colored result removes the move if colors match', true),
    highlight: { active: ['x', 'a', 'b', 'c', 'd'], found: ['i-a-x', 'i-x-c'], removed: ['y'] },
    explanation: 'Successful coalescing reduces move count and can reduce register pressure around the copy. Failed coalescing still leaves a colorable graph if the conservative tests did their job.',
  };

  yield {
    state: labelMatrix(
      'Production lesson',
      [
        { id: 'moves', label: 'moves' },
        { id: 'spills', label: 'spills' },
        { id: 'abi', label: 'ABI' },
        { id: 'debug', label: 'debug' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['remove', 'color risk'],
        ['avoid', 'memory ops'],
        ['obey', 'fixed regs'],
        ['preserve', 'location'],
      ],
    ),
    highlight: { active: ['moves:goal', 'spills:goal', 'abi:goal'], compare: ['debug:cost'] },
    explanation: 'Coalescing sits at a real backend tradeoff: fewer moves can be faster, but a bad merge can cause spills, violate target constraints, or make generated debug locations harder to preserve.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'move coalescing') yield* moveCoalescing();
  else if (view === 'iterated allocator') yield* iteratedAllocator();
  else throw new InputError('Pick a coalescing view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        'A compiler wants to keep values in a small number of physical registers. Before allocation, the compiler often has many virtual registers, each representing a live range. Some live ranges overlap in time and cannot share a register. Others are connected by copy instructions such as Y = X, where using the same register for X and Y would make the copy unnecessary.',
        'Register coalescing is the attempt to remove those copies by assigning copy-related live ranges to the same physical register. Iterated register coalescing does this inside a graph-coloring allocator instead of as a separate cleanup pass. That placement matters because the allocator can still see interference, register pressure, fixed-register constraints, and possible spills.',
        {type:'callout', text:'Coalescing is safe only when copy removal is negotiated with interference and register pressure, not bolted on after allocation.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/90/Petersen_graph_3-coloring.svg', alt:'A Petersen graph whose adjacent vertices have different colors.', caption:'Petersen graph 3-coloring, Chris-martin, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Where copies come from',
      paragraphs: [
        'Copies are not always signs of careless code generation. SSA phi elimination creates parallel copies at control-flow joins. Calling conventions force arguments and return values through particular registers. Two-address instructions may require an input and output to occupy the same physical register. Instruction selection and lowering also introduce temporary moves when target instructions are less flexible than the intermediate representation.',
        'Some copies are harmless and disappear naturally. If allocation already gives both operands the same register, a post-pass can delete the move. The problem is that a passive cleanup pass cannot influence allocation. It cannot ask the allocator to choose the same register when doing so would be legal and profitable.',
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        'The first naive approach is to allocate registers first and remove identity moves afterward. This is safe, but weak. It only benefits when the allocator accidentally chooses matching colors. Many avoidable moves remain because no part of allocation tried to align the source and destination.',
        'The second naive approach is to merge every non-interfering copy pair before coloring. That sounds better, but it can be disastrous. Merging two nodes creates one larger live range that inherits all neighbors from both old nodes. A graph that was easy to color can become too constrained, causing spill loads and stores that cost far more than the original move.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is colorability under K physical registers. An interference graph is colorable when every live range can receive a register color different from all interfering neighbors. A move edge is only a preference; an interference edge is a hard prohibition. Coalescing turns a preference into one combined node, and that combined node may have a degree or constraint set that no register can satisfy.',
        'Real machines add more walls. Some nodes are precolored to fixed registers. Some values need a particular register class. Subregisters and vector lanes can interfere in target-specific ways. Calling conventions may reserve registers at call sites. Debug information needs values to remain traceable. A good coalescer has to remove moves without pretending the graph is an abstract classroom problem.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight of iterated register coalescing is to be conservative and incremental. Do not merge every possible pair up front. Instead, interleave simplification, safe coalescing, freezing, spill selection, and coloring. Simplifying the graph can lower degrees, which can make a later coalescing decision safe. Freezing an unhelpful move can unblock simplification.',
        'This turns coalescing from a one-shot transformation into a worklist process. Nodes move between sets as their degree changes and as move edges are resolved. The allocator keeps making progress even when a desired merge is not safe. It removes many copies while preserving the ability to color the graph or make a controlled spill decision.',
      ],
    },
    {
      heading: 'Interference graph',
      paragraphs: [
        'The allocator begins with liveness information. If two live ranges are simultaneously live, they interfere and receive an interference edge. If there are K registers and a node has fewer than K significant neighbors, that node is easier to simplify: remove it temporarily, push it on a select stack, and color it later after the rest of the graph has been handled.',
        'Move-related pairs are tracked separately. A move edge between X and Y means the allocator would like X and Y to share a color, but only if there is no interference edge between them and only if the combined node remains safe enough. The interference graph says what is forbidden. The move set says what would be profitable.',
      ],
    },
    {
      heading: 'Safe coalescing tests',
      paragraphs: [
        'Briggs-style coalescing asks whether the merged node would have too many high-degree neighbors. If the number of dangerous neighbors stays below the register budget, the merge is considered conservative. The test is not omniscient. It chooses merges that should preserve colorability under the simplification logic.',
        'George-style coalescing is especially useful with precolored nodes. It asks whether the neighbors of one node are already safe with respect to the other node or are low-degree enough to tolerate the merge. Precolored machine registers cannot be removed from the graph during simplification in the same way ordinary virtual registers can, so the merge test has to protect them explicitly.',
      ],
    },
    {
      heading: 'Iterated allocator',
      paragraphs: [
        'A typical iterated allocator maintains worklists for simplifiable nodes, move-related nodes, freeze candidates, spill candidates, coalesced nodes, colored nodes, and selected stack entries. It repeatedly chooses an action. Simplify removes a low-degree non-move-related node. Coalesce tries to merge a safe move pair. Freeze gives up on move-relatedness for a node so it can simplify. Select spill chooses a high-cost or high-pressure node when no safer progress remains.',
        'After the graph is reduced, select assigns colors while popping nodes from the stack. If a node cannot receive any legal register, the compiler rewrites the program with spill code, recomputes liveness, and allocates again. Coalescing is therefore tied to spill management. The allocator is not optimizing moves in isolation; it is balancing moves, spills, and target constraints.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the program contains a move Y = X. X interferes with A and B. Y interferes with C and D. If X and Y do not interfere with each other, merging them creates a node XY that interferes with A, B, C, and D. With many registers this may be fine. With only two registers, the merge may make XY impossible to color if its neighbors already require the available colors.',
        'A conservative test accepts the merge only when the combined neighborhood is safe. If accepted, XY receives one register during coloring and the move disappears. If rejected, the allocator may freeze the move, simplify other nodes, and later discover that degrees fell enough to make a merge safe. That delayed opportunity is why the algorithm is iterated rather than a single pre-pass.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The key invariant is that a coalescing step should not destroy an obvious path to coloring. Conservative tests approximate that property. They allow profitable merges when the merged node still has enough coloring flexibility and reject or delay risky merges when the graph is already under pressure.',
        'Simplification and coalescing help each other. Simplification removes low-degree nodes, which can turn high-degree neighbors into low-degree neighbors. That can make a previously unsafe move safe. Coalescing removes move edges and can reduce generated instructions. Freezing prevents the allocator from stalling on a move that is not worth the risk.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The move coalescing view shows the difference between a move edge and an interference edge. A move edge is a request for sameness. An interference edge is a reason two nodes must differ. When the view merges X and Y into XY, the important detail is that the merged node inherits every neighbor. That inheritance is where spill risk enters.',
        'The iterated allocator view shows why coalescing belongs inside allocation. Simplify, coalesce, freeze, spill, select, and rewrite are not independent cleanups. They are phases of one pressure-management loop. The useful question at each frame is whether the allocator is preserving progress while improving the final machine code.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The algorithm needs several data structures: interference adjacency sets, degree counts, move sets, aliases for coalesced nodes, worklists, spill costs, and a select stack. Those structures are local to one function, but large functions with many live ranges can still make allocation expensive.',
        'Compile time depends heavily on live-range overlap, not just instruction count. A long function with short non-overlapping ranges may allocate easily. A smaller function with many values live across calls and loops can create a dense graph. Dense graphs reduce safe coalescing opportunities and push the allocator toward spilling.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Iterated coalescing is a strong fit for optimizing compilers and high-tier JITs that already pay for graph-coloring allocation. It is especially useful after SSA destruction, where phi nodes become parallel copies and many move-related live ranges can be merged safely.',
        'It also helps targets with tight register files, expensive moves, or many fixed-register constraints. A separate move cleanup pass cannot reason about those constraints deeply. Integrated coalescing can remove copies while still respecting the target register model and spill costs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It can be too expensive for a very fast compiler tier. Linear scan allocation often compiles much faster and may be the better engineering choice for short-lived JIT code, even if it emits more moves. Compiler design is not only about peak code quality; latency and predictability matter.',
        'The clean theory also becomes messy on real targets. Register classes, precolored nodes, rematerialization, live-range splitting, subregister interference, two-address instructions, exception edges, safepoints, and debug locations all complicate the basic graph story. A production allocator may combine coalescing with many target-specific rules.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The classic failure mode is over-coalescing. Removing one move creates a larger live range, increases pressure, and forces a spill. The machine code becomes slower even though the move count went down. Another failure is under-coalescing, where conservative tests are too timid and leave many avoidable copies.',
        'Other failures are semantic. Merging values from incompatible register classes is illegal. Ignoring precolored constraints can violate the ABI. Losing precise value-location information can harm debugging, stack maps, deoptimization, or garbage collector root tracking. The allocator must preserve program meaning before it chases fewer moves.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study graph coloring register allocation first if interference graphs and select stacks are not yet familiar. Then study SSA destruction and parallel copy resolution to see why so many move edges appear. Linear scan allocation is the useful contrast: faster allocation, less global reasoning, and different coalescing opportunities.',
        'Primary references are George and Appel on iterated register coalescing, Briggs on optimistic coalescing, compiler lecture notes on register allocation, and LLVM code generator documentation. A good exercise is to draw a six-node interference graph with one move edge, try an unsafe merge by hand, then apply a conservative test and compare the spill outcome.',
      ],
    },
  ],
};
