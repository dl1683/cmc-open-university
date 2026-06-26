// Abstract interpretation: compute sound approximations over abstract values
// such as intervals, using joins and widening to converge.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'abstract-interpretation-interval-domain',
  title: 'Abstract Interpretation & Interval Domain',
  category: 'Concepts',
  summary: 'Approximate all executions with a sound abstract domain: intervals, joins, widening, narrowing, and alarms when a proof cannot rule out a bug.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['interval loop', 'widen and narrow'], defaultValue: 'interval loop' },
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

function aiGraph(title) {
  return graphState({
    nodes: [
      { id: 'program', label: 'program', x: 0.9, y: 3.8, note: 'many runs' },
      { id: 'concrete', label: 'states', x: 2.5, y: 2.2, note: 'huge' },
      { id: 'abstract', label: 'domain', x: 2.5, y: 5.3, note: 'compact' },
      { id: 'interval', label: 'interval', x: 4.5, y: 5.3, note: '[lo,hi]' },
      { id: 'transfer', label: 'transfer', x: 5.2, y: 2.5, note: 'sound' },
      { id: 'join', label: 'join', x: 7.0, y: 3.8, note: 'merge' },
      { id: 'widen', label: 'widen', x: 8.7, y: 2.3, note: 'force stop' },
      { id: 'alarm', label: 'alarm', x: 8.7, y: 5.3, note: 'unknown' },
    ],
    edges: [
      { id: 'e-program-concrete', from: 'program', to: 'concrete' },
      { id: 'e-program-abstract', from: 'program', to: 'abstract' },
      { id: 'e-abstract-interval', from: 'abstract', to: 'interval' },
      { id: 'e-concrete-transfer', from: 'concrete', to: 'transfer' },
      { id: 'e-interval-transfer', from: 'interval', to: 'transfer' },
      { id: 'e-transfer-join', from: 'transfer', to: 'join' },
      { id: 'e-join-widen', from: 'join', to: 'widen' },
      { id: 'e-join-alarm', from: 'join', to: 'alarm' },
    ],
  }, { title });
}

function* intervalLoop() {
  const graph = aiGraph('Abstract interpretation tracks sets of states compactly');
  const graphNodeCount = graph.nodes.length;
  const graphEdgeCount = graph.edges.length;
  const intervalNode = graph.nodes.find(n => n.id === 'interval');
  const concreteNode = graph.nodes.find(n => n.id === 'concrete');

  yield {
    state: graph,
    highlight: { active: ['program', 'abstract', 'interval', 'e-program-abstract', 'e-abstract-interval'], compare: ['concrete'] },
    explanation: `A concrete run has exact values (node "${concreteNode.label}", note: ${concreteNode.note}). Abstract interpretation replaces many concrete states with one abstract value across ${graphNodeCount} nodes and ${graphEdgeCount} edges. The interval domain represents every possible value of x as ${intervalNode.note}.`,
  };

  const loopRows = [
    { id: 'entry', label: 'x = 1' },
    { id: 'head1', label: 'loop head 1' },
    { id: 'body', label: 'x = x + 1' },
    { id: 'head2', label: 'loop head 2' },
  ];
  const loopCols = [
    { id: 'interval', label: 'x interval' },
    { id: 'meaning', label: 'meaning' },
  ];
  const loopData = [
    ['[1,1]', 'exact init'],
    ['[1,1]', 'first visit'],
    ['[2,2]', 'after body'],
    ['[1,2]', 'join paths'],
  ];

  yield {
    state: labelMatrix('Interval loop', loopRows, loopCols, loopData),
    highlight: { active: ['entry:interval', 'body:interval'], found: ['head2:interval'], compare: ['head1:interval'] },
    explanation: `The loop head sees two paths across ${loopRows.length} rows: the initial entry path and the backedge path. Joining ${loopData[0][0]} and ${loopData[2][0]} gives ${loopData[3][0]}. Repeating this process keeps expanding the interval.`,
    invariant: `A sound interval like ${loopData[3][0]} must contain every real value that can arrive at "${loopRows[3].label}".`,
  };

  const alarmNode = graph.nodes.find(n => n.id === 'alarm');

  yield {
    state: aiGraph('A warning means not proven safe, not automatically unsafe'),
    highlight: { active: ['interval', 'transfer', 'join', 'alarm'], found: ['e-join-alarm'], compare: ['widen'] },
    explanation: `If an interval for i is [0, 20] and the array length is 10, the analyzer cannot prove the access safe. That creates an ${alarmNode.label} (${alarmNode.note}) even if some concrete paths would never hit the bad index.`,
  };
}

function* widenAndNarrow() {
  const wnRows = [
    { id: 'slow', label: 'plain join' },
    { id: 'wide', label: 'widen' },
    { id: 'narrow', label: 'narrow' },
    { id: 'alarm', label: 'alarm' },
  ];
  const wnCols = [
    { id: 'result', label: 'result' },
    { id: 'tradeoff', label: 'tradeoff' },
  ];
  const wnData = [
    ['[1,2],[1,3]...', 'may take long'],
    ['[1,+inf]', 'terminates fast'],
    ['[1,9999]', 'recovers precision'],
    ['possible bug', 'needs triage'],
  ];

  yield {
    state: labelMatrix('Widening and narrowing', wnRows, wnCols, wnData),
    highlight: { active: ['wide:result', 'narrow:result'], compare: ['slow:tradeoff'], found: ['alarm:result'] },
    explanation: `Widening deliberately loses precision to force convergence: ${wnRows[0].label} gives ${wnData[0][0]}, but ${wnRows[1].label} jumps to ${wnData[1][0]}. Narrowing then recovers to ${wnData[2][0]} after the widening point stabilizes. The ${wnRows.length}-row matrix shows ${wnCols.length} columns: ${wnCols.map(c => c.label).join(' and ')}.`,
  };

  const domainGraph = aiGraph('The abstract domain is a design choice');
  const widenNode = domainGraph.nodes.find(n => n.id === 'widen');
  const domainNode = domainGraph.nodes.find(n => n.id === 'abstract');

  yield {
    state: domainGraph,
    highlight: { active: ['abstract', 'interval', 'transfer', 'join'], found: ['widen'], compare: ['alarm'] },
    explanation: `Intervals are easy to visualize, but the "${domainNode.label}" node (${domainNode.note}) can represent other domains that track signs, nullness, shapes, ownership, string constraints, or relational facts. The "${widenNode.label}" node (${widenNode.note}) reduces false positives but better domains cost more.`,
  };

  const fullGraph = aiGraph('Abstract interpretation sits under many analyzers');
  const fullNodeCount = fullGraph.nodes.length;
  const programNode = fullGraph.nodes.find(n => n.id === 'program');
  const alarmNode = fullGraph.nodes.find(n => n.id === 'alarm');

  yield {
    state: fullGraph,
    highlight: { active: ['program', 'abstract', 'transfer', 'alarm'], visited: ['join', 'widen'], found: ['interval'] },
    explanation: `Static analyzers use abstract interpretation to scale beyond tests. Starting from "${programNode.label}" (${programNode.note}), the ${fullNodeCount}-node graph over-approximates behavior, proves what it can, and routes uncertain paths to "${alarmNode.label}" (${alarmNode.note}) for humans or deeper tools.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'interval loop') yield* intervalLoop();
  else if (view === 'widen and narrow') yield* widenAndNarrow();
  else throw new InputError(`Pick an abstract-interpretation view, not "${view}".`);
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The interval-loop view shows how an analyzer propagates interval facts through a simple loop: each row is a program point, each column shows the interval and its meaning, and highlights mark where facts change. Active (green) nodes hold the current abstract state. Found (blue) marks the join result. Compare (orange) shows what the previous iteration held so you can see the interval grow.',
        'The widen-and-narrow view shows the three-phase convergence strategy: plain joining, widening to force termination, and narrowing to recover precision. An alarm node lights up when the domain cannot prove a property safe.',
        {type: 'image', src: './assets/gifs/abstract-interpretation-interval-domain.gif', alt: 'Animated walkthrough of the abstract interpretation interval domain visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Testing checks what happened on the inputs you ran. A compiler warning or safety certification needs a different answer: can this array index ever go out of bounds, can this integer ever overflow, does this lock always get released? These are universal claims about all possible executions, not reports from a few runs.',
        'Abstract interpretation exists to make universal claims decidable. Patrick and Radhia Cousot introduced it in 1977 as a formal framework for computing sound approximations of program behavior. Instead of enumerating concrete states, the analyzer replaces exact values with compact summaries drawn from an abstract domain and propagates those summaries through the control-flow graph.',
        {type: 'callout', text: 'Abstract interpretation wins by proving over a safe summary of all states, accepting false alarms instead of missing real executions.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is exhaustive execution: try every input, follow every branch, record every value a variable takes at every point. For a function that adds two single-digit numbers, this is 100 pairs and finishes instantly. It gives exact answers because it literally runs every case.',
        'Symbolic execution is a smarter variant. Instead of feeding concrete inputs, it carries symbolic constraints (e.g., x > 0, y = x + 1) down each path and asks an SMT solver whether a bad state is reachable. When it works, it produces an actual crashing input, not just a warning.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Exhaustive execution breaks on infinite or large input domains. A 32-bit integer function has 2^32 possible inputs per argument. Two arguments: 2^64 pairs. Add a loop that runs up to 10,000 iterations and the state space is unbounded. No machine can enumerate it.',
        'Symbolic execution hits a different wall: path explosion. Every branch doubles the number of paths. A loop with n iterations generates n distinct paths, and the solver queries grow with constraint complexity. Real programs with nested loops, recursion, and pointer aliasing can stall a symbolic engine indefinitely. Both approaches produce exact answers but only when they finish, and for many real programs they never finish.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace the set of all possible values with a single abstract value that is guaranteed to contain them. In the interval domain, the concrete set {1, 3, 7} becomes the interval [1, 7]. The analyzer loses the knowledge that 2, 4, 5, and 6 are impossible, but it gains a representation that is constant-size no matter how many concrete values exist.',
        'The contract is soundness: the abstract value must contain every concrete value that could really occur. It may contain extras. Those extras can trigger false alarms, warnings about bugs that cannot actually happen. But it will never miss a real bug. This is the fundamental bargain: completeness (no false negatives) in exchange for precision (some false positives).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The analyzer builds a control-flow graph (CFG) where each node is a program point and each edge is an instruction or branch. Every node gets an abstract state, initially bottom (no information). A worklist algorithm picks a node, applies a transfer function to compute the new abstract state after the instruction, and propagates the result to successors.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Directed edges help show how abstract facts move through program points until a fixed point is reached. Source: Wikimedia Commons, David W., public domain.'},
        'Transfer functions model instructions in the abstract domain. For intervals: assignment x = 5 produces [5,5]. Addition x + 1 on [1,4] produces [2,5]. A branch guard x < 10 intersects the current interval with [-inf, 9] on the true edge and [10, +inf] on the false edge. When two edges meet at a node, the join operator merges their intervals: [1,3] join [8,12] = [1,12], the smallest interval containing both.',
        'Loops create a problem: the join keeps growing. The loop head sees [1,1], then [1,2], then [1,3], climbing one step per iteration. Widening forces convergence by jumping to a stable value. If the old interval is [1,2] and the new is [1,3], widening notices the upper bound is rising and jumps to [1, +inf]. After the widened state stabilizes, narrowing runs a few extra passes that use branch guards and transfer functions to shrink the interval back toward a tighter bound.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two local obligations. First, every transfer function must over-approximate its concrete counterpart: if concrete addition can produce 7, the abstract transfer on the input interval must include 7 in the output interval. Second, every join must contain all values from all incoming edges. If both local obligations hold, then the fixed-point state at every node over-approximates every concrete state that could reach that node across all executions. This is a standard induction over the worklist iterations.',
        'Widening preserves soundness because it only adds values, never removes them. Jumping from [1,3] to [1, +inf] introduces impossible values (like 999999) but does not drop any real value. Since the fixed point only needs to contain all reachable concrete values, widening cannot break the proof. It can only make the proof less precise.',
        'The fixed-point theorem underlying this is Tarski\'s: a monotone function on a complete lattice has a least fixed point. The abstract domain forms a lattice (bottom = no info, top = any value, join = least upper bound). Transfer functions are monotone (bigger input produces bigger or equal output). Widening accelerates the ascent to a post-fixed point, which is above or at the least fixed point, so it is still sound.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For the interval domain, each variable costs two numbers (lower bound, upper bound). Transfer functions are arithmetic on those two numbers: O(1) per instruction per variable. Join is a min/max on the bounds: O(1). The total cost of the fixed-point computation is O(V * N * H), where V is the number of variables, N is the number of CFG nodes, and H is the height of the lattice. Widening bounds H to a small constant (typically 2-3 iterations per loop), so in practice the analyzer is nearly linear in program size.',
        'Doubling the program size roughly doubles the analysis time, assuming similar loop nesting. Compare this to symbolic execution, where doubling the number of branches can square the path count. Intervals are the cheapest numeric domain in common use.',
        'The hidden cost is precision. Each false alarm must be triaged by a human or a more expensive downstream tool. A fast analyzer that produces 10,000 false alarms on a million-line codebase is not cheap; the cost has shifted from compute to engineering time. The practical metric is alarms per kloc (thousand lines of code), and production analyzers aim for single digits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Airbus uses Astree, an abstract-interpretation-based analyzer, to prove absence of runtime errors in flight control software. The domain includes intervals, octagons, and specialized floating-point abstractions. The analyzer certifies that no division by zero, no overflow, and no out-of-bounds access can occur in the deployed binary.',
        'The Linux kernel\'s eBPF verifier uses an interval-like abstract state to check that BPF programs cannot read uninitialized memory, access out-of-bounds map entries, or loop forever. Every BPF program loaded into the kernel passes through this abstract interpreter before it is allowed to run.',
        'Compilers use interval analysis for optimization. If the analyzer proves x is in [0, 255], the backend can use a single byte instead of a word. If it proves an array index is always in bounds, it can remove the bounds check. LLVM\'s scalar evolution and range analysis passes are lightweight interval analyses.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Intervals forget relationships. If x and y are always equal, their separate intervals [0, 100] and [0, 100] do not record that fact. A check like x < y will produce a false alarm because the domain thinks x could be 100 while y is 0. Relational domains (octagons track constraints like x - y <= 5; polyhedra track arbitrary linear inequalities) solve this but cost O(n^2) or O(n^3) per operation for n variables.',
        'Pointer aliasing defeats interval analysis entirely. If p and q might point to the same memory, an assignment through p can change the value read through q. The interval domain for the integer value is meaningless if the analyzer does not know which variable the pointer is modifying. Handling aliasing requires a separate pointer analysis, which is itself an abstract interpretation problem.',
        'Path sensitivity is another gap. The interval domain merges all paths at a join point. If one path guarantees x > 0 and another guarantees x < 0, the join produces an interval containing zero even if every concrete path excludes it. Trace partitioning and disjunctive domains can recover path sensitivity at higher cost.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider: x = 1; while (x < 10000) { x = x + 1; } return x. The CFG has four points: entry, loop head, loop body, and exit. At entry, x is [1,1]. The transfer for x = x + 1 on [1,1] produces [2,2]. At the loop head, join([1,1], [2,2]) = [1,2]. Next iteration: transfer on [1,2] gives [2,3], join with [1,1] gives [1,3]. Each pass adds one to the upper bound.',
        'Apply widening at the loop head. The old state is [1,2], the new state after join is [1,3]. The upper bound rose from 2 to 3, so widening pushes it to +inf: [1, +inf]. Now the loop head is stable because join([1,1], [2, +inf]) = [1, +inf], and transfer on [1, +inf] gives [2, +inf], and join([1,1], [2, +inf]) = [1, +inf]. Fixed point reached in one widening step.',
        'Narrowing pass: the loop guard x < 10000 intersects [1, +inf] with [-inf, 9999], giving [1, 9999] inside the loop body. On the exit edge, the guard is false: x >= 10000 intersects [1, +inf] with [10000, +inf], giving [10000, +inf]. A precise transfer for the assignment x = x + 1 starting from [1, 9999] gives [2, 10000]; joining with [1,1] and re-narrowing can tighten the loop-head interval to [1, 10000].',
        'Now add arr[x - 1] inside the loop body, where arr has length 10000. The body interval for x is [1, 9999], so x - 1 is [0, 9998], which is within [0, 9999]. The access is proven safe. If widening had not been followed by narrowing, the body interval would remain [1, +inf], x - 1 would be [0, +inf], and the analyzer would emit an alarm: possible out-of-bounds access. The alarm is not a bug; it is a precision gap that narrowing closes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cousot and Cousot, "Abstract Interpretation: A Unified Lattice Model for Static Analysis of Programs by Construction or Approximation of Fixpoints" (POPL 1977), the founding paper. Cousot MIT abstract interpretation course at https://web.mit.edu/16.399/www/lecture_01-intro/Cousot_MIT_2005_Course_01_4-1.pdf covers the lattice-theoretic foundations. Bruno Blanchet\'s notes at https://bblanche.gitlabpages.inria.fr/absint.pdf give a compact modern treatment. Clang data-flow analysis introduction at https://clang.llvm.org/docs/DataFlowAnalysisIntro.html shows how these ideas appear in a production compiler.',
        'For the fixed-point engine underlying all abstract interpreters, study Data-Flow Worklist Analysis. For a production system that uses interval-like abstract states, see the eBPF Verifier Register State Case Study. Taint Analysis Source-to-Sink Case Study applies abstract interpretation to a security property instead of numeric ranges. Symbolic Execution Path Constraints is the complementary technique that trades scalability for precision. Linear Scan Register Allocation uses interval representations in a different context, showing how the same data structure appears across compiler problems.',
      ],
    },
  ],
};
