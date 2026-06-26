// Equality saturation and e-graphs: keep all equivalent rewrites at once,
// saturate the space with algebraic facts, then extract the cheapest program.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'equality-saturation',
  title: 'E-Graphs & Equality Saturation',
  category: 'Concepts',
  summary: 'Rewrite without committing too early: an e-graph stores many equivalent programs, then extracts the cheapest one.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rewrite saturation', 'cost extraction'], defaultValue: 'rewrite saturation' },
  ],
  run,
};

const NODES = [
  { id: 'start', label: '(x * 2) + 0', x: 1.1, y: 4.8, note: 'input program' },
  { id: 'drop0', label: 'x * 2', x: 3.2, y: 3.2, note: 'add-zero' },
  { id: 'add', label: 'x + x', x: 5.3, y: 4.6, note: 'strength reduce' },
  { id: 'shift', label: 'x << 1', x: 7.4, y: 3.0, note: 'machine rule' },
  { id: 'mulback', label: '2 * x', x: 5.2, y: 1.4, note: 'commute' },
  { id: 'dead', label: '((x * 2) + 0) + 0', x: 2.4, y: 7.0, note: 'also equal' },
];

const EDGES = [
  { id: 'e-start-drop0', from: 'start', to: 'drop0', weight: '+0 -> nothing' },
  { id: 'e-drop0-add', from: 'drop0', to: 'add', weight: 'x*2 -> x+x' },
  { id: 'e-add-shift', from: 'add', to: 'shift', weight: 'x+x -> x<<1' },
  { id: 'e-drop0-mulback', from: 'drop0', to: 'mulback', weight: 'commute *' },
  { id: 'e-start-dead', from: 'start', to: 'dead', weight: 'add +0' },
  { id: 'e-dead-drop0', from: 'dead', to: 'drop0', weight: 'drop both +0' },
];

function graph(upTo, title) {
  const nodeIds = new Set(upTo.nodes);
  return graphState({
    nodes: NODES.filter((n) => nodeIds.has(n.id)),
    edges: EDGES.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to) && upTo.edges.includes(e.id)),
  }, { title });
}

function* rewriteSaturation() {
  yield {
    state: graph({ nodes: ['start'], edges: [] }, 'one expression, one class'),
    highlight: { active: ['start'] },
    explanation: `Classic rewrite optimizers choose one path: apply a rule, replace the expression, hope you did not make tomorrow worse. Equality saturation refuses to choose early. It stores the input program in an e-graph, applies every sound rewrite it can find, and keeps all ${NODES.length} equivalent forms alive together.`,
  };

  yield {
    state: graph({ nodes: ['start', 'drop0', 'dead'], edges: ['e-start-drop0', 'e-start-dead', 'e-dead-drop0'] }, 'algebraic identities add alternatives'),
    highlight: { active: ['drop0'], compare: ['dead'], found: ['e-start-drop0'] },
    explanation: `The first rewrite drops "+ 0", producing x * 2. Another legal rewrite can even add a useless +0. That looks silly, but the e-graph is not a greedy optimizer; it is a database of equalities across ${EDGES.length} rewrite edges. Some rewrites look locally worse and later unlock a globally better form.`,
    invariant: `A rewrite adds an equality among the ${NODES.length} nodes. It does not delete the old expression.`,
  };

  yield {
    state: graph({ nodes: ['start', 'drop0', 'dead', 'add', 'mulback'], edges: ['e-start-drop0', 'e-start-dead', 'e-dead-drop0', 'e-drop0-add', 'e-drop0-mulback'] }, 'multiply, add, and commute live together'),
    highlight: { active: ['add'], compare: ['mulback'], visited: ['start'] },
    explanation: `Now x * 2 becomes x + x, and commutativity also records 2 * x. With ${5} nodes and ${5} edges visible, these are grouped into e-classes: sets of equivalent expressions. Congruence closure then propagates equality upward, so if a subexpression becomes equal, larger expressions that contain it can merge too. That propagation is the hard data-structure win.`,
  };

  yield {
    state: graph({ nodes: ['start', 'drop0', 'dead', 'add', 'mulback', 'shift'], edges: EDGES.map((e) => e.id) }, 'saturated enough to choose'),
    highlight: { found: ['shift', 'e-add-shift'], visited: ['start', 'drop0', 'add', 'mulback', 'dead'] },
    explanation: `A machine-specific rule now turns x + x into x << 1. With all ${NODES.length} nodes and ${EDGES.length} edges saturated, equality saturation stops when no more useful rewrites fire or when a time/node budget is hit. Only then does extraction choose an answer. This separation matters: exploration collects equivalent possibilities; extraction decides what "best" means for the target machine.`,
    invariant: `Saturate first, extract later: all ${NODES.length} equivalent forms persist — do not let local rewrite order decide the final program.`,
  };
}

function* costExtraction() {
  yield {
    state: matrixState({
      title: 'All equivalent, different costs',
      rows: [
        { id: 'start', label: '(x*2)+0' },
        { id: 'drop0', label: 'x*2' },
        { id: 'add', label: 'x+x' },
        { id: 'shift', label: 'x<<1' },
      ],
      columns: [
        { id: 'latency', label: 'latency' },
        { id: 'code', label: 'code size' },
        { id: 'portable', label: 'portable?' },
      ],
      values: [
        [4, 4, 11],
        [3, 2, 11],
        [2, 2, 11],
        [1, 1, 10],
      ],
      format: (v) => {
        if (v === 10) return 'target-specific';
        if (v === 11) return 'yes';
        return String(v);
      },
    }),
    highlight: { compare: ['shift:portable'], found: ['shift:latency', 'shift:code'] },
    explanation: `Extraction turns the saturated e-graph into an optimization problem. Comparing ${4} equivalent forms across ${3} cost dimensions, if the target CPU has a cheap shift instruction, x << 1 wins on latency and code size. If portability or overflow semantics forbid that rule, the extractor can choose x + x or x * 2 instead. The e-graph kept the choices alive long enough for a real cost model to decide.`,
  };

  yield {
    state: matrixState({
      title: 'Why greedy rewriting fails',
      rows: [
        { id: 'greedy', label: 'greedy pass' },
        { id: 'egraph', label: 'e-graph pass' },
        { id: 'learned', label: 'learned rules' },
      ],
      columns: [
        { id: 'keeps', label: 'keeps alternatives' },
        { id: 'risk', label: 'main risk' },
        { id: 'best', label: 'best for' },
      ],
      values: [
        [1, 4, 7],
        [2, 5, 8],
        [2, 6, 9],
      ],
      format: (v) => ['', 'no', 'yes', '', 'phase ordering', 'graph blowup', 'unsound rule', 'fast compiler passes', 'deep algebraic optimization', 'ML-guided program search'][v],
    }),
    highlight: { compare: ['greedy:risk'], active: ['egraph:keeps'], found: ['egraph:best'] },
    explanation: `Compiler engineers call the greedy problem phase ordering: comparing ${3} strategies across ${3} dimensions shows why. Run simplification before vectorization and you miss one optimization; run vectorization before simplification and you miss another. Equality saturation replaces phase order with a shared space of equal programs. The price is graph growth, so practical engines need budgets, rule scheduling, and extraction costs.`,
  };

  yield {
    state: graph({ nodes: ['start', 'drop0', 'add', 'shift'], edges: ['e-start-drop0', 'e-drop0-add', 'e-add-shift'] }, 'the selected proof path'),
    highlight: { found: ['start', 'drop0', 'add', 'shift'], active: ['e-start-drop0', 'e-drop0-add', 'e-add-shift'] },
    explanation: `The chosen program is not just a string. It comes with a proof path through ${4} nodes and ${3} equality edges: (x * 2) + 0 equals x * 2, equals x + x, equals x << 1 under the target rule set. That proof-object flavor is why e-graphs connect cleanly to theorem proving, program synthesis, tensor-graph optimization, and the verifier loops in Code World Models Case Study and AlphaEvolve Case Study.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rewrite saturation') yield* rewriteSaturation();
  else if (view === 'cost extraction') yield* costExtraction();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The rewrite-saturation view builds an e-graph node by node. Each step fires one rewrite rule and adds the result as a new node connected by an equality edge. Watch for the key difference from ordinary rewriting: the old expression stays. The extraction view then compares all surviving forms across cost dimensions and highlights the winner for a given target.',
        {type: 'image', src: './assets/gifs/equality-saturation.gif', alt: 'Animated walkthrough of the equality saturation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Green highlights mark the active rewrite target. Blue marks alternatives kept alive. The final frame of extraction shows which form the cost model selects. Toggle between views to see the two phases separately: saturation collects; extraction decides.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Compilers optimize programs by applying rewrite rules: replace x * 2 with x << 1, fold constants, eliminate dead code. Each rule is individually correct. The problem is that the rules interact. Simplifying an expression in pass 3 can destroy a pattern that pass 7 needed. Reassociating arithmetic can break floating-point contracts. Lowering a tensor operation too early can hide a fusion opportunity that saves 40% of memory bandwidth.',
        {
          type: 'callout',
          text: `Equality saturation separates discovery from choice: collect equivalent forms first, then let a cost model pick.`,
        },
        'This interaction problem has a name: phase ordering. The final program quality depends on the order in which rewrite passes run. Swapping two passes can turn a 3-cycle instruction into a 12-cycle one. Equality saturation exists to eliminate phase ordering by refusing to commit to any single rewrite path until all paths have been explored.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard design is a sequential pipeline. Run constant folding, then algebraic simplification, then canonicalization, then vectorization, then lowering, then cleanup. Each pass receives one program, applies every rule that matches, produces one program, and hands it to the next pass. GCC has over 200 such passes. LLVM has a similar count. The design is simple to build, simple to debug, and fast enough for most code.',
        'This works well when each pass is independent. Constant folding does not need to know about vectorization. Dead-code elimination does not care about register allocation. When passes interact weakly, ordering them reasonably is enough.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The pipeline breaks when a rewrite is only profitable in combination with a later rewrite. Consider the expression (x * 2) + 0. A simplification pass removes + 0, producing x * 2. A strength-reduction pass then converts x * 2 to x + x. A machine-lowering pass converts x + x to x << 1. That works. But now reverse the first two passes: strength reduction sees (x * 2) + 0, does not match any pattern, and does nothing. Simplification then removes + 0, producing x * 2, but strength reduction already ran. The shift instruction is never discovered.',
        'With 200 passes, the number of possible orderings is 200 factorial. No engineer can reason about that space. Heuristic ordering works most of the time, but every compiler ships with known phase-ordering bugs where rearranging passes would produce better code. The fundamental issue is that greedy rewriting forgets: once pass k replaces expression A with expression B, expression A is gone. If pass k+5 needed A\'s shape, it cannot recover it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of replacing A with B, record that A equals B and keep both. An e-graph (equivalence graph) is a data structure that stores many equivalent expressions simultaneously. It has two components. An e-node is an operator applied to children, like add(x, x). An e-class is a set of e-nodes that all compute the same value. The children of an e-node point to e-classes, not to individual expressions. This indirection is what makes the representation compact: one e-class with 5 members inside a parent e-node represents 5 programs without storing 5 separate trees.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg',
          alt: `Directed acyclic graph with shared structure between nodes`,
          caption: `A shared graph is the right mental model for compactly representing many related expressions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_acyclic_graph.svg`,
        },
        'When two e-classes merge, a procedure called congruence closure propagates the equality upward. If e-class A merges with e-class B, then every e-node that used A as a child is now congruent to the same e-node using B. Parents that become congruent merge automatically. This chain reaction is what makes the e-graph more powerful than a flat list of equivalences: structural sharing means one merge can trigger cascading merges through the entire graph.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algorithm has three phases. Phase 1: insert the input expression into an empty e-graph. Each subexpression gets an e-node, and each e-node lives in its own e-class. Phase 2: repeatedly search for rewrite-rule patterns in the e-graph, and for each match, add the rewritten form and merge the old and new e-classes. After each batch of merges, run a rebuild step that restores the congruence invariant by merging any parent e-classes that became congruent. Phase 3: once saturation is reached or a budget is exhausted, run extraction to select the cheapest concrete expression from the e-graph.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Abstract_syntax_tree_for_Euclidean_algorithm.svg',
          alt: `Abstract syntax tree for a small Euclidean algorithm program`,
          caption: `Rewrite systems search over syntax-tree patterns before merging equivalent expression classes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Abstract_syntax_tree_for_Euclidean_algorithm.svg`,
        },
        'Saturation means no rule produces a new equality. In practice, full saturation is rare. Rule sets with associativity and commutativity can generate unbounded equivalences. Production systems use node budgets (stop after 10,000 e-nodes), iteration limits (stop after 30 rounds), time limits, and rule schedules that prioritize cheap rules early and expensive rules later. The term "equality saturation" names the ideal; real systems approximate it.',
        'Extraction is itself an optimization problem. The simplest extractor does a bottom-up pass: for each e-class, pick the e-node with the lowest cost, where cost is defined recursively as the node\'s own cost plus the cost of the best children. This greedy extraction runs in time linear in the number of e-nodes. More sophisticated extractors use ILP (integer linear programming) to handle cost functions that depend on context, such as register pressure or instruction scheduling.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: every expression in an e-class is equivalent to every other expression in that e-class, under the semantics defined by the rewrite rules. Each rewrite rule is a proven algebraic identity (e.g., x + 0 = x for integers, or x * 2 = x << 1 for unsigned integers). Adding a rewritten form to an existing e-class is safe because the rule guarantees equivalence. Merging two e-classes is safe because the match that triggered the merge established equivalence.',
        'Congruence closure preserves the invariant inductively. If e-class A and e-class B merge, and e-node f(A) exists alongside e-node f(B) with the same operator f, then f(A) = f(B) by substitution. The rebuild step detects these cases and merges the parent e-classes. The chain terminates because each merge reduces the number of distinct e-classes by one, and the total number of e-classes is finite.',
        'Extraction is safe because it selects one representative from each relevant e-class. Since all members of an e-class are equivalent, any choice produces a program equivalent to the original input. The cost model can be arbitrarily wrong about performance and still produce a semantically correct program. Correctness breaks only if a rewrite rule is unsound for the actual language semantics.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is e-graph growth. Each rewrite rule application adds at most one e-node and one merge. But congruence closure can trigger cascading merges, and rules like associativity (a + (b + c) = (a + b) + c) and commutativity (a + b = b + a) can generate exponentially many equivalences. An expression tree with n nodes and k commutative operators can produce O(n * k!) equivalent forms before saturation.',
        'In concrete terms: the egg library (the reference Rust implementation) processes roughly 1,000 to 100,000 e-nodes per second on a single core, depending on rule complexity. A typical compiler optimization problem with 50 input nodes and 20 rewrite rules might saturate at 5,000 e-nodes in under a second. A tensor-graph optimization problem with 500 input nodes and 100 rules might hit a 100,000-node budget in 10 seconds and extract in another 2 seconds.',
        'When input size doubles, the e-graph can grow superlinearly because rules interact combinatorially. Pattern matching (finding where rules apply) costs O(e-nodes * patterns) per iteration in the worst case. Extraction with the greedy bottom-up method is O(e-nodes). ILP extraction is NP-hard in general but tractable for most real instances with a few thousand e-classes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Compiler optimization is the original and strongest use case. The Cranelift compiler (used in Wasmtime for WebAssembly) uses e-graphs for its mid-level IR optimization. The TASO system uses equality saturation to optimize deep-learning computation graphs, finding operator substitutions that reduce inference time by 10-60% on real models. The Herbie tool uses e-graphs to improve floating-point accuracy by rewriting mathematical expressions into numerically stable forms.',
        'Beyond compilers, equality saturation appears in hardware design (rewriting circuit descriptions), SQL query optimization (rewriting logical query plans), symbolic mathematics (simplifying algebraic expressions), and program synthesis (searching for programs equivalent to a specification). The common thread is that many equivalent forms exist, the best form depends on a target, and correctness must be preserved through the transformation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most dangerous failure is an unsound rewrite rule. x + 0 = x is safe for integers but floating-point addition has signed zero: +0.0 + (-0.0) = +0.0, not -0.0. x * 2 = x << 1 is safe for unsigned integers but not for signed integers on every platform due to overflow semantics. A single unsound rule poisons every e-class it touches, and the error propagates through congruence closure to corrupt distant parts of the graph.',
        'The second failure is graph explosion. Associativity alone on a chain of n additions produces O(Catalan(n)) equivalent trees. With n = 10 that is 16,796 trees. With n = 20 it is over 6 billion. Without aggressive budgets and rule scheduling, saturation never finishes and the system runs out of memory. A third failure is a bad cost model. The e-graph keeps all forms alive, but extraction can only pick the best form according to the cost function it is given. If that function misprices cache behavior, branch prediction, or SIMD utilization, the extracted program will be correct but slow.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with the expression (x * 2) + 0. The e-graph has 5 e-nodes: x, 2, mul(x, 2), 0, add(mul(x,2), 0). Each lives in its own e-class, labeled c1 through c5. The root is c5.',
        'Rule 1: a + 0 = a. This matches c5 = add(c3, c4) where c4 contains 0. The engine merges c5 and c3. Now the root e-class contains both add(mul(x,2), 0) and mul(x, 2). E-class count drops from 5 to 4.',
        'Rule 2: a * 2 = a + a. This matches c3 = mul(c1, c2) where c2 contains 2. The engine creates a new e-node add(c1, c1) and adds it to the e-class containing c3. That e-class now has three members: mul(x, 2), add(mul(x,2), 0), and add(x, x). No new merge, so e-class count stays at 4.',
        'Rule 3: a + a = a << 1. This matches the new add(c1, c1). The engine creates shift(c1, 1) and adds it to the same e-class. Members: mul(x, 2), add(mul(x,2), 0), add(x, x), shift(x, 1). E-class count: 4.',
        'Rule 4: a * b = b * a. This matches mul(c1, c2) and creates mul(c2, c1), i.e. 2 * x. Added to the root e-class. Final member count in the root e-class: 5 expressions. No more rules fire. Saturation reached with 4 e-classes and 8 e-nodes total.',
        'Extraction with cost = instruction latency on x86: shift costs 1 cycle, add costs 1 cycle, mul costs 3 cycles, the original add-then-mul costs 4 cycles. The extractor walks bottom-up. c1 (x) costs 0 (it is a variable). The root e-class has: mul(x,2) costs 0+3 = 3, add(x,x) costs 0+0+1 = 1, shift(x,1) costs 0+1 = 1, the original add(mul(x,2),0) costs 3+1 = 4. Minimum is 1, achieved by both add(x,x) and shift(x,1). The extractor picks shift(x,1) by tiebreaking on code size. Output: x << 1.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Tate et al., "Equality Saturation: A New Approach to Optimization" (2009). The practical reference implementation is the egg library: Willsey et al., "egg: Fast and Extensible Equality Saturation" (2021), available at https://arxiv.org/abs/2004.03082. For tensor-graph applications, see Jia et al., "TASO: Optimizing Deep Learning Computation with Automatic Generation of Graph Substitutions" (2019).',
        'Study Union-Find (Disjoint Sets) to understand the class-merging machinery. Study Pratt Parser Expression AST for how syntax trees represent expressions. For compiler context, study Control Flow Graph & Dominator Tree and Static Single Assignment & Phi Nodes. For the contrasting approach of searching without soundness guarantees, study Evolutionary Search.',
      ],
    },
  ],
};
