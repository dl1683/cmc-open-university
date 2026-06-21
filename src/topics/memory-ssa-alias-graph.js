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
      heading: 'Why this exists',
      paragraphs: [
        'Ordinary SSA gives each register-like value a clear definition. Memory is harder: a load from `*p` may depend on a store through `*p`, a store through an alias, a call that writes unknown memory, or a path-specific write from another block.',
        'Optimizers still need direct answers. Can this load reuse an earlier value? Is this store dead? Can this memory operation move out of a loop? MemorySSA exists so those questions start from a sparse graph of memory accesses instead of a new search through raw control flow every time.',
        {type: 'callout', text: 'MemorySSA makes memory effects searchable by naming every may-reaching write before alias analysis decides which one can actually matter.'},
      ],
    },
    {
      heading: 'The naive baseline and its wall',
      paragraphs: [
        'The naive baseline is a backward scan from each load. Walk previous instructions, then predecessor blocks, until a store or call that might affect the loaded address appears. In a straight-line toy program, that is easy to explain and easy to implement.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Some_types_of_control_flow_graphs.svg/250px-Some_types_of_control_flow_graphs.svg.png', alt: 'Several control-flow graph shapes showing branches and loops', caption: 'Branches and loops are why a raw backward memory scan keeps revisiting the same control-flow structure. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Some_types_of_control_flow_graphs.svg.'},
        'The wall is repeated dense work. Branches create joins, loops create backedges, calls may write broad memory, and pointers may alias. A pass that scans the CFG for every load can rediscover the same candidate writes again and again. Worse, every pass has to encode its own version of the same memory walk.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'MemorySSA names memory state the way SSA names values. Stores and write-like calls become `MemoryDef` nodes. Loads and read-like calls become `MemoryUse` nodes. Control-flow joins that merge possible memory states get `MemoryPhi` nodes. Memory that existed before the function is represented by `liveOnEntry`.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'MemorySSA is a directed access graph over memory state, not a rescan of source order. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'The key split is structure versus precision. MemorySSA tells a query where to start walking and which memory definitions may reach it. Alias analysis answers whether a candidate definition can actually clobber the queried address. A `MemoryPhi` is a may-reach merge, not proof that every incoming write aliases the later load.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'In the def/use/phi view, read the graph as memory state rather than ordinary value flow. `EntryM` is memory before the function. `Def P` and `Def Q` are writes. `Phi` says that either write may reach the join. `Load P` is the read that wants a clobbering definition. The alias node is a separate query, because MemorySSA alone is intentionally conservative.',
        'In the clobber-walk case study, follow the newest candidate first. The load asks about `*p`. The walker checks the recent store through `q`; if alias analysis says `NoAlias(q,p)`, that store is removed from consideration and the walk continues. If the answer is `MayAlias`, the optimizer must stop with an unknown value. If it reaches a must-alias store to `p`, the load can become an ordinary SSA value fact.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Construction starts from the control-flow graph and dominance information. Memory-affecting instructions are mapped to access nodes, and blocks that need to merge different incoming memory states receive `MemoryPhi` nodes. The result is not a full memory version for every variable; it is a sparse access graph for operations that can read or write memory.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Control_flow_graph.svg', alt: 'Control-flow graph with basic blocks connected by directed edges', caption: 'Memory access nodes are placed on top of CFG and dominance structure; the graph controls which memory states can reach a load. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Control_flow_graph.svg.'},
        'A clobber query starts from the defining memory access of a load or read-like operation. The walker moves backward through candidate `MemoryDef` and `MemoryPhi` nodes. `NoAlias` candidates are skipped because they cannot affect the queried address. `MustAlias` candidates stop the walk with a precise clobber. `MayAlias` candidates stop conservatively unless a more expensive walker can refine the answer.',
        'Calls fit the same model. A call that may write memory is a broad `MemoryDef`; a readonly call can be modeled as a `MemoryUse`. The precision depends on side-effect summaries and alias information, but the graph shape still gives the optimizer one place to start.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'The safety rule is that a candidate write may be skipped only when alias analysis proves it cannot affect the queried location. If the answer is uncertain, the analysis returns a conservative clobber instead of inventing a value fact. Conservative loss of optimization is acceptable; folding a load past a possible write is a correctness bug.',
        'Ordering also matters. The walker begins from the newest memory definition visible to the load, so the first non-skippable clobber is the write that blocks replacement, movement, or deletion. `MemoryPhi` nodes preserve path uncertainty at joins until alias analysis and control-flow facts can remove it.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'For `*p = 7; *q = 9; x = *p`, the optimizer wants to replace the load with `7`. MemorySSA gives the candidate chain: the load sees the most recent memory state, which includes the store through `q`, and before that the store through `p`.',
        'If alias analysis proves `q` and `p` do not overlap, `Def Q` cannot clobber the load and the walker continues to `Def P`. Since `Def P` must alias the load of `*p`, the load result is `7`. If alias analysis only says `MayAlias(q,p)`, the optimizer keeps the load because `*q = 9` might have overwritten the same memory.',
        'The same reasoning powers dead-store elimination, redundant-load elimination, loop-invariant code motion, and GVN-style memory reasoning. MemorySSA does not optimize by itself; it gives those passes a reliable clobber vocabulary.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The build cost includes finding memory accesses, placing memory phis, linking definitions, and maintaining dominance relationships. Query cost depends on how many candidate accesses the clobber walker inspects before alias analysis proves `NoAlias` or finds a stopping clobber.',
        'The maintenance cost is real. CFG edits, moved instructions, deleted stores, split blocks, new calls, and loop transformations must update MemorySSA or invalidate it. The payoff comes when several passes reuse the same sparse structure instead of each pass scanning CFG regions independently.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'MemorySSA wins in scalar optimizers that need memory precision while staying sparse: dead-store elimination, redundant-load elimination, LICM, GVN, store-to-load forwarding, and transformations that need fast invalidation after local edits.',
        'It fails to deliver precision when alias analysis is weak, side-effect summaries are broad, or memory effects are intentionally opaque. It is also the wrong abstraction for reasoning about high-level ownership, data races, or whole-program object lifetimes unless other analyses provide those facts.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'MemorySSA can only be as precise as the alias and side-effect facts attached to it. If every pointer may alias every other pointer, the clobber walk becomes conservative quickly and many optimizations disappear.',
        'Incorrect maintenance is another failure mode. If a transform moves a store, splits a block, or deletes a call without updating MemorySSA, later passes may reason from a stale memory graph. Optimizers usually treat stale analysis as a correctness risk, not just a missed optimization.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Cache clobber queries carefully, but invalidate them when the CFG or memory accesses change. The useful speedup comes from reusing the sparse graph without making old answers survive transformations that invalidate them.',
        'Expose conservative answers in diagnostics. When a load cannot be folded because a call or pointer write may clobber it, showing the stopping MemoryDef helps compiler engineers improve alias summaries rather than guessing why an optimization failed.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A loop repeatedly loads a field after a call. The optimizer wants to hoist the load, but only if the call cannot write the same field. MemorySSA gives the load a starting memory definition and makes the call visible as a candidate clobber.',
        'If function attributes and alias analysis prove the call is readonly for that memory, the walker skips it and finds the earlier stable definition. If the call may write unknown memory, the transform stops. That is the practical value: the optimizer gets a fast answer and a conservative reason when it cannot move the load.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: LLVM MemorySSA documentation at https://llvm.org/docs/MemorySSA.html, LLVM MemorySSA implementation at https://github.com/llvm/llvm-project/blob/main/llvm/lib/Analysis/MemorySSA.cpp, and MemorySSA header reference at https://llvm.org/doxygen/MemorySSA_8h_source.html.',
        'Study Static Single Assignment & Phi Nodes for value SSA, Dominance Frontier SSA Construction for phi placement, Data-Flow Worklist Analysis for the dense baseline, Sparse Conditional Constant Propagation for sparse reasoning, Alias Analysis for the precision provider, and Loop-Invariant Code Motion for a pass that benefits from fast memory clobber answers.',
      ],
    },
  ],
};
