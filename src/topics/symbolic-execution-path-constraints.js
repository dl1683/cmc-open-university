// Symbolic execution: fork program paths, collect path constraints, and ask a
// solver for concrete inputs that exercise each feasible path.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'symbolic-execution-path-constraints',
  title: 'Symbolic Execution Path Constraints',
  category: 'Concepts',
  summary: 'Explore code paths with symbolic inputs: fork branches, accumulate constraints, solve feasible paths, and generate concrete tests or bug witnesses.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['path forking', 'test generation'], defaultValue: 'path forking' },
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

function symbolicGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'x', x: 0.9, y: 3.8, note: 'symbolic' },
      { id: 'branch', label: 'if', x: 2.5, y: 3.8, note: 'x > 0' },
      { id: 'true', label: 'T', x: 4.2, y: 2.3, note: 'x>0' },
      { id: 'false', label: 'F', x: 4.2, y: 5.4, note: 'x<=0' },
      { id: 'pc', label: 'PC', x: 5.9, y: 3.8, note: 'constraints' },
      { id: 'solver', label: 'SMT', x: 7.4, y: 3.8, note: 'solver' },
      { id: 'test', label: 'test', x: 9.0, y: 2.3, note: 'x=7' },
      { id: 'bug', label: 'bug', x: 9.0, y: 5.4, note: 'witness' },
    ],
    edges: [
      { id: 'e-input-branch', from: 'input', to: 'branch' },
      { id: 'e-branch-true', from: 'branch', to: 'true' },
      { id: 'e-branch-false', from: 'branch', to: 'false' },
      { id: 'e-true-pc', from: 'true', to: 'pc' },
      { id: 'e-false-pc', from: 'false', to: 'pc' },
      { id: 'e-pc-solver', from: 'pc', to: 'solver' },
      { id: 'e-solver-test', from: 'solver', to: 'test' },
      { id: 'e-solver-bug', from: 'solver', to: 'bug' },
    ],
  }, { title });
}

function* pathForking() {
  yield {
    state: symbolicGraph('Symbolic input turns one run into a tree of paths'),
    highlight: { active: ['input', 'branch', 'true', 'false', 'e-input-branch', 'e-branch-true', 'e-branch-false'], compare: ['solver'] },
    explanation: 'Symbolic execution treats an input as a symbol instead of one concrete value. At a branch, it forks execution states and records the condition needed for each path.',
  };
  yield {
    state: labelMatrix(
      'Path constraints',
      [
        { id: 'p1', label: 'path A' },
        { id: 'p2', label: 'path B' },
        { id: 'p3', label: 'path C' },
        { id: 'p4', label: 'path D' },
      ],
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'solver', label: 'solver result' },
      ],
      [
        ['x > 0 && x < 10', 'SAT x=7'],
        ['x <= 0 && x == -1', 'SAT x=-1'],
        ['x > 0 && x < 0', 'UNSAT'],
        ['len(buf) > n', 'bug witness'],
      ],
    ),
    highlight: { active: ['p1:solver', 'p2:solver'], removed: ['p3:solver'], found: ['p4:solver'] },
    explanation: 'The path condition is a conjunction of branch constraints. A solver finds concrete inputs for satisfiable paths and prunes impossible paths.',
    invariant: 'Each generated test should satisfy the exact path condition it claims to cover.',
  };
  yield {
    state: symbolicGraph('The hard problem is path explosion'),
    highlight: { active: ['true', 'false', 'pc'], compare: ['solver'], found: ['test'] },
    explanation: 'Every symbolic branch can double the number of execution states. Real engines need search heuristics, state merging, timeouts, environment models, and summaries to stay useful.',
  };
}

function* testGeneration() {
  yield {
    state: symbolicGraph('KLEE-style engines solve paths into tests'),
    highlight: { active: ['pc', 'solver', 'test', 'e-pc-solver', 'e-solver-test'], compare: ['bug'] },
    explanation: 'When a path reaches normal exit, the engine can solve its path condition and emit a concrete test case. When a path reaches an error, the solution becomes a reproducing input.',
  };
  yield {
    state: labelMatrix(
      'Symbolic engine state',
      [
        { id: 'pc', label: 'program counter' },
        { id: 'stack', label: 'stack' },
        { id: 'memory', label: 'address space' },
        { id: 'constraints', label: 'path condition' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['next instruction', 'forks often'],
        ['call frames', 'recursion depth'],
        ['symbolic bytes', 'aliasing'],
        ['branch facts', 'solver cost'],
      ],
    ),
    highlight: { active: ['constraints:stores', 'memory:stores'], compare: ['constraints:risk'], found: ['pc:stores'] },
    explanation: 'A symbolic executor is an interpreter plus a constraint store. Memory models and solver queries usually dominate engineering complexity.',
  };
  yield {
    state: symbolicGraph('Static analysis and symbolic execution complement each other'),
    highlight: { active: ['input', 'pc', 'solver', 'bug'], visited: ['branch'], found: ['test'] },
    explanation: 'Abstract Interpretation & Interval Domain can cheaply find suspicious regions. Symbolic execution can then spend solver time on a narrower path and produce concrete evidence.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'path forking') yield* pathForking();
  else if (view === 'test generation') yield* testGeneration();
  else throw new InputError('Pick a symbolic-execution view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        { type: 'callout', text: 'Symbolic execution converts branch history into a formula, then asks a solver for the input that makes the path real.' },
        'Ordinary tests answer a narrow question: what happened for these inputs? That is useful, but many important bugs live behind conditions a tester did not guess. A parser may require a magic byte, a matching length field, and a checksum before it reaches the vulnerable code. Random inputs almost never satisfy that chain.',
        'Symbolic execution exists for the moments when guessing inputs is the wrong job. It runs the program with symbols in place of concrete bytes, records the conditions needed to reach each branch, and asks a solver to produce real inputs for the paths that matter.',
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        'The obvious approach is to write more tests or run a fuzzer longer. That is often the right starting point. Fuzzers are fast, easy to parallelize, and excellent at finding shallow crashes in input-handling code.',
        'The wall appears when a branch is guarded by a precise relationship instead of a broad shape. If the program checks `len == payload.length + 4`, then `kind == 7`, then `checksum(payload) == header.sum`, a mutational fuzzer may spend most of its time breaking earlier checks. A human can reverse engineer the format, but symbolic execution tries to make the path condition itself do that work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Some_types_of_control_flow_graphs.svg',
          alt: 'Several control-flow graph shapes including if-then-else and loop examples.',
          caption: 'Control-flow graphs make path forking concrete: each branch edge becomes a constraint choice for symbolic execution. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Some_types_of_control_flow_graphs.svg.',
        },
        'Treat each input byte or variable as an unknown, not as a value chosen in advance. When execution reaches `if (x > 0)`, create two states. The true state carries the constraint `x > 0`; the false state carries `x <= 0`.',
        'After several branches, the path condition is a formula for reaching one exact path. A satisfiability solver can then answer the question that testing was only guessing at: is there any concrete input that satisfies all of these constraints? If yes, the solver returns a test. If no, the path was never real.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the path-forking view, read each split as a new execution state with its own path condition. The important object is not the branch alone; it is the growing conjunction of branch facts that explains why that state exists.',
        'In the test-generation view, the solver is the bridge from reasoning to evidence. A satisfiable path becomes a concrete input you can replay. An unsatisfiable path is removed because its constraints contradict each other. A path that reaches an assertion, unsafe memory access, or crash site becomes a bug witness only if the solver can produce input for it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Rust_MIR_CFG.svg',
          alt: 'Rust MIR control-flow graph with blocks and branch edges.',
          caption: 'A compiler IR control-flow graph is close to what a symbolic executor walks: basic blocks, branch edges, and state at each program point. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Rust_MIR_CFG.svg.',
        },
        'A symbolic executor is an interpreter with extra state. Each execution state stores the program counter, call stack, memory model, symbolic input objects, and the path condition collected so far. Assignments transform symbolic expressions. Branches fork states. Assertions and memory checks ask whether a bad condition is reachable.',
        'The solver is usually queried at pressure points: should this fork be explored, can this assertion fail, can this pointer alias that object, can this path produce a test case? If a later constraint contradicts an earlier one, the state is pruned. If a path reaches normal exit, the path condition can be solved into a regression test. If it reaches an error, the model becomes a reproducer.',
        'Most practical engines mix symbolic and concrete execution. Concolic execution runs the program on a concrete input while collecting symbolic constraints along the taken path, then negates one branch condition to generate the next input. This keeps execution grounded in real behavior while still using the solver to cross narrow gates.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The reasoning is local and checkable. If the engine models a branch correctly, then every concrete input satisfying the true-state condition will take the true branch, and every input satisfying the false-state condition will take the false branch. Repeating that logic across the path turns the path condition into an executable explanation.',
        'A generated test is trustworthy because it can be replayed. If the solver says `x = 7` satisfies the collected constraints, the real program should take the same path until the executor reaches something it did not model correctly.',
        'That last caveat matters. Symbolic execution is only as sound as its models of arithmetic, memory, libraries, system calls, undefined behavior, threads, files, clocks, and the language runtime. The mathematical idea is clean; the engineering boundary is where mistakes enter.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a toy handler: read an unsigned byte `n`; require `n < len`; require `n == 7`; then copy `n + 8` bytes into an eight-byte buffer. A normal test might try `n = 0`, `n = 1`, or random bytes and never reach the dangerous copy.',
        'A symbolic run starts with `n` and `len` unknown. The interesting path collects `n < len` and `n == 7`. At the copy, the bug condition is `n + 8 > 8`. The full query is `n < len && n == 7 && n + 8 > 8`, which is satisfiable. The solver can return `n = 7, len = 8`, giving a concrete crashing input.',
        'A different path might collect `n < 0` for the same unsigned byte. That query is unsatisfiable under the byte model, so the engine can discard it. The key difference from fuzzing is that both decisions are explained by constraints, not luck.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is path explosion. Every symbolic branch can double the number of states, and loops can generate an unbounded family of path conditions. Even when the number of paths is manageable, each solver query can become expensive if it contains nonlinear arithmetic, arrays, bit-vector tricks, or symbolic memory.',
        'Search strategy changes the tool you get. Depth-first search reaches deep states quickly but can starve siblings. Breadth-first search improves coverage but stores more states. Coverage-guided search, random-path search, state merging, function summaries, constraint caching, and timeouts are practical compromises.',
        'Precision is also a cost. Model every library call precisely and the analysis may drown. Stub too aggressively and the engine may miss bugs or report impossible ones. A useful symbolic executor usually has a carefully chosen target, not a heroic model of the whole machine.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'It wins on narrow, branch-heavy interfaces: parsers, protocol handlers, codecs, arithmetic validators, file-format checks, smart-contract functions, and security-sensitive input validation. The output is especially useful because it is concrete. A failing input can be saved as a regression test.',
        'It struggles on large applications with uncontrolled I/O, huge libraries, clocks, network calls, concurrency, opaque native dependencies, floating-point-heavy code, cryptographic hashes, or solver-hostile arithmetic. These are not moral failures of the technique. They are places where the path formula stops being a compact guide.',
        'It is strongest as part of a workflow. Abstract Interpretation & Interval Domain can cheaply point at suspicious regions. Taint Analysis Source-to-Sink Case Study can identify dangerous sinks. Fuzzing can cover broad shallow input space. Symbolic execution can then spend solver time where a concrete witness is worth the price.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: KLEE intrinsics docs at https://klee-se.org/docs/intrinsics/, KLEE USENIX paper page at https://www.usenix.org/legacyurl/klee-unassisted-and-automatic-generation-high-coverage-tests-complex-systems-programs-0, KLEE 2019 overview at https://link.springer.com/article/10.1007/s10009-020-00570-3, and Imperial KLEE symbolic-execution slides at https://srg.doc.ic.ac.uk/files/slides/symex-tarot-18.pdf.',
        'Study Tree Traversals and Recursion for path explosion intuition, Control Flow Graph & Dominator Tree for program paths, Abstract Interpretation & Interval Domain for sound over-approximation, Taint Analysis Source-to-Sink Case Study for target selection, and Data-Flow Worklist Analysis for static-analysis contrast.',
      ],
    },
  ],
};
