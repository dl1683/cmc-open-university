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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/equality-saturation.gif', alt: 'Animated walkthrough of the equality saturation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Optimizers are full of choices that look local but are not. Simplify an expression now and you may erase the shape a later vectorizer needed. Reassociate floating-point math and you may break a numerical contract. Lower a tensor operation too early and you may hide a fusion opportunity. The name for this pain is phase ordering: the result depends on which rewrite pass happened to run first.`,
        {
          type: 'callout',
          text: `Equality saturation separates discovery from choice: collect equivalent forms first, then let a cost model pick.`,
        },
        `Equality saturation exists to stop early choices from destroying later options. Instead of rewriting expression A into expression B and forgetting A, an e-graph records that A and B are equivalent. It keeps many forms alive at once, runs more rewrites over the shared space, and delays the final decision until a cost model extracts the best representative for the target.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first design is a pipeline. Run constant folding, then algebraic simplification, then canonicalization, then vectorization, then lowering, then cleanup. Each pass sees one program, applies rules that look helpful, and hands one program to the next pass. This design is understandable, debuggable, and fast enough for many compilers.`,
        `The wall appears when a rewrite is only helpful in combination with another rewrite. Turning x * 2 into x + x may look worse until a target rule turns x + x into x << 1. Adding a redundant + 0 looks useless until it exposes a pattern required by another rule. A greedy pipeline has no memory of abandoned forms. Once it commits, the old route is gone.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core move is to store equivalence directly. An e-node is an operator applied to children, such as add(a, b). An e-class is a set of e-nodes known to compute the same value. The children of an e-node are not single expressions; they are e-classes. That means one compact graph can represent a huge family of equivalent expressions.`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg',
          alt: `Directed acyclic graph with shared structure between nodes`,
          caption: `A shared graph is the right mental model for compactly representing many related expressions. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_acyclic_graph.svg`,
        },
        `When two e-classes merge, equality propagates upward through congruence closure. If a equals b, then f(a) and f(b) are also equal under the same operator and equal surrounding structure. This is the data-structure advantage over a plain rewrite log. The e-graph is not just collecting strings. It is maintaining a shared quotient of the expression space where equivalent subexpressions collapse together.`,
      ],
    },
    {
      heading: 'Mechanism and algorithm',
      paragraphs: [
        `Equality saturation starts by inserting the input expression into the e-graph. Rewrite rules then search for matching patterns. When a rule matches, the engine adds the rewritten form to the graph and records the equality instead of replacing the old form. After many rules fire, the rebuild step repairs congruence information so equivalent parents can merge.`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Abstract_syntax_tree_for_Euclidean_algorithm.svg',
          alt: `Abstract syntax tree for a small Euclidean algorithm program`,
          caption: `Rewrite systems search over syntax-tree patterns before merging equivalent expression classes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Abstract_syntax_tree_for_Euclidean_algorithm.svg`,
        },
        `Saturation does not have to mean mathematical completion. Practical systems stop when no useful rules fire, when a node limit is reached, when a time budget expires, or when the rule schedule says enough evidence has been collected. Extraction then solves a cost problem over the e-graph. The extractor chooses one representative expression from each relevant e-class according to latency, code size, energy, numerical safety, portability, or another target-specific objective.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The rewrite-saturation view proves that a new node is an alternative, not a replacement. The starting expression, the simplified expression, the commuted expression, the deliberately worse expression, and the machine-shaped expression can coexist. The important event is not the appearance of a prettier string. The important event is that all of those forms remain connected by equalities.`,
        `The extraction view proves that "best" is a later decision. x << 1 may win for a target where shift is cheap and semantics allow it. x + x may win if the target rule is unavailable. x * 2 may win if the cost model values portability or if overflow rules differ. The animation is not saying every rewrite is profitable. It is showing why keeping unprofitable-looking intermediate forms can expose a better final choice.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is plain: every expression in an e-class must be equivalent under the trusted rules and analyses. A rewrite rule is allowed to add a new form only when the rule is sound for the language semantics in use. A merge is allowed only when equality has been established. Congruence closure then preserves equality through surrounding operators.`,
        `Extraction is safe because it selects from an equivalence class rather than inventing an unrelated program. If the root e-class represents the original program, any extracted representative from that class is equal to the original under the chosen semantics. The cost model can be wrong about speed and still produce a correct program. It only becomes a correctness risk if it is allowed to choose across classes that are not actually equivalent.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The tax is growth. Associativity, commutativity, distributivity, inverse rules, and expansion rules can create enormous e-graphs. A naive rule runner can spend all its time rediscovering variants that extraction will never choose. This is why practical equality saturation uses rule schedules, node limits, timeouts, memoization, analysis data, and sometimes learned or manually tuned rule ordering.`,
        `Union-Find intuition helps because merging equivalence classes is central, but an e-graph is richer than disjoint sets. It stores operator structure, parent links, pattern indexes, analysis values, and pending rebuild work. The expensive operations are not only union and find. Matching many rules over many classes, maintaining congruence, and extracting a minimum-cost expression can dominate runtime.`,
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        `Equality saturation is strongest when many equivalent forms exist and the best form depends on a target. Compiler algebra is the usual example, but the same pattern appears in DSP rewrites, hardware design, SQL optimization, tensor graph optimization, symbolic algebra, theorem proving, and program synthesis. The method is especially attractive when correctness matters enough that arbitrary mutation is too risky.`,
        `This separates it from black-box evolutionary search. Evolutionary search can try anything and let a fitness function decide. Equality saturation explores through sound rewrites, so retained candidates stay inside the equivalence class. That makes it a natural fit for verifier-centered systems: generate or discover rewrite rules, prove or test their soundness, add them to the e-graph, then extract the cheapest verified result.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most dangerous failure is an unsound rewrite. Algebraic identities depend on semantics. x + 0 = x is safe in many settings, but floating-point reassociation can change rounding, NaN behavior, infinities, signed zero, and exception behavior. Integer overflow, undefined behavior, pointer aliasing, memory effects, and concurrency can all make a familiar math rule illegal in a real compiler IR.`,
        `A second failure is pretending saturation always finishes. It often does not. Production systems are usually "saturated enough" systems. They choose budgets and accept that some opportunities will be missed. A third failure is trusting the wrong cost model. An expression that is fast on one CPU, GPU, vector width, compiler flag, or numerical contract may be slower or invalid on another.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Union-Find (Disjoint Sets) for the class-merging intuition, then Graph BFS for search instincts and Finite State Machines plus Pratt Parser Expression AST for pattern matching over syntax. For compiler context, study Control Flow Graph & Dominator Tree, Static Single Assignment & Phi Nodes, and Linear Scan Register Allocation. For contrast, study Evolutionary Search and Code World Models Case Study.`,
        `Primary source: "egg: Fast and Extensible Equality Saturation" at https://arxiv.org/abs/2004.03082. As you read it, keep the article's three questions in mind: what equalities are trusted, what stops the graph from exploding, and what cost model gets to decide the extracted program.`,
      ],
    },
  ],
};
