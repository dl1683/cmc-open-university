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
  const graphNodes = ['input', 'branch', 'true', 'false', 'pc', 'solver', 'test', 'bug'];
  const paths = ['path A', 'path B', 'path C', 'path D'];

  yield {
    state: symbolicGraph('Symbolic input turns one run into a tree of paths'),
    highlight: { active: ['input', 'branch', 'true', 'false', 'e-input-branch', 'e-branch-true', 'e-branch-false'], compare: ['solver'] },
    explanation: `Symbolic execution treats an input as a symbol instead of one concrete value. The ${graphNodes.length}-node graph shows how a single branch forks execution states and records the condition needed for each path.`,
  };

  const satCount = 2;
  const unsatCount = 1;
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
    explanation: `The ${paths.length} path conditions are conjunctions of branch constraints. The solver finds concrete inputs for ${satCount} satisfiable paths and prunes ${unsatCount} impossible path.`,
    invariant: `Each generated test should satisfy the exact path condition it claims to cover.`,
  };

  yield {
    state: symbolicGraph('The hard problem is path explosion'),
    highlight: { active: ['true', 'false', 'pc'], compare: ['solver'], found: ['test'] },
    explanation: `Every symbolic branch can double the number of execution states. With ${paths.length} paths already from one branch, real engines need search heuristics, state merging, timeouts, environment models, and summaries to stay useful.`,
  };
}

function* testGeneration() {
  const engineStateFields = ['program counter', 'stack', 'address space', 'path condition'];

  yield {
    state: symbolicGraph('KLEE-style engines solve paths into tests'),
    highlight: { active: ['pc', 'solver', 'test', 'e-pc-solver', 'e-solver-test'], compare: ['bug'] },
    explanation: `When a path reaches normal exit, the engine can solve its path condition and emit a concrete test case. When a path reaches an error, the solution becomes a reproducing input.`,
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
    explanation: `A symbolic executor tracks ${engineStateFields.length} state fields (${engineStateFields.join(', ')}). It is an interpreter plus a constraint store. Memory models and solver queries usually dominate engineering complexity.`,
  };

  yield {
    state: symbolicGraph('Static analysis and symbolic execution complement each other'),
    highlight: { active: ['input', 'pc', 'solver', 'bug'], visited: ['branch'], found: ['test'] },
    explanation: `Abstract Interpretation & Interval Domain can cheaply find suspicious regions. Symbolic execution can then spend solver time across the ${engineStateFields.length} state fields on a narrower path and produce concrete evidence.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the input node as a symbolic value, meaning an unknown variable that stands for many possible concrete inputs. Each branch creates a new execution state with its own path condition.',
        'A path condition is the conjunction of branch facts required to reach the current program point. The solver node turns that formula into either a concrete test input or a proof that the path is impossible.',
        {
          type: 'image',
          src: './assets/gifs/symbolic-execution-path-constraints.gif',
          alt: 'Animated walkthrough of the symbolic execution path constraints visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'callout',
          text: 'Symbolic execution converts branch history into a formula, then asks a solver for the input that makes the path real.',
        },
        'Testing with concrete inputs only explores the paths those inputs happen to take. Bugs often hide behind narrow checks, such as magic bytes, length fields, checksums, or combinations of flags.',
        'Symbolic execution exists to make the branch conditions themselves drive input generation. Instead of guessing x, it records constraints on x and asks a solver for a value that satisfies them.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write more unit tests or run a fuzzer longer. That is often the correct first move because concrete execution is fast and simple.',
        'The approach breaks down when valid inputs must satisfy precise relationships. A fuzzer may mutate toward a branch and then destroy an earlier checksum or length constraint that was required to reach it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is path specificity. Some paths are guarded by formulas, not just by broad input shapes, and random mutation may almost never satisfy the formula.',
        'A second wall is coverage evidence. A test can show one path was taken, but it does not explain which nearby paths are impossible and which only need a different input.',
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
        'Run the program over expressions rather than only values. At if x > 0, the true state records x > 0 and the false state records x <= 0.',
        'The accumulated formula describes exactly what must be true for that path. A satisfiability solver can then produce a concrete input, such as x = 7, or report that the constraints contradict each other.',
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
        'A symbolic executor is an interpreter with extra state: program counter, stack, memory model, and path condition. Assignments build symbolic expressions, and branches fork states with different constraints.',
        'At important points, the engine asks an SMT solver whether a formula is satisfiable. SMT means satisfiability modulo theories, a solver that understands arithmetic, arrays, bit-vectors, and other structured domains.',
        'Concolic execution mixes concrete and symbolic execution. It runs one real input, records symbolic constraints on that path, then negates one branch condition to generate the next input.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is path equivalence. If the engine models each operation correctly, then any concrete input satisfying the path condition will follow the same branch sequence in the real program.',
        'Unsatisfiable constraints can be removed safely because no input can take that path. Satisfiable error paths produce replayable witnesses, so a crash is not just reported but accompanied by the input that triggers it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is path explosion. Each independent branch can double the number of states, so 30 binary branches can imply over one billion possible paths.',
        'Solver calls are also expensive. Bit-vector arithmetic, symbolic memory addresses, loops, strings, system calls, and floating point can turn a small program into a hard solver workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Security tools use symbolic execution to generate exploit witnesses and reach parser states that fuzzing misses. Compiler and VM teams use it to validate instruction semantics and corner-case arithmetic.',
        'It also helps test generation. A generated input for each feasible branch can become a regression suite that documents which code paths the engine proved reachable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the environment model is wrong. Files, clocks, network calls, threads, undefined behavior, and library functions can all make the symbolic path diverge from real execution.',
        'It also fails when the search space is too large. Engines need heuristics, summaries, state merging, and timeouts, and those choices can miss paths.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider code with if x > 0, then y = x + 2, then if y == 7 crash. The crash path condition is x > 0 and x + 2 == 7.',
        'The solver simplifies x + 2 == 7 to x = 5, and x = 5 also satisfies x > 0. The generated test input x = 5 reaches the crash; the alternate path x > 0 and x + 2 != 7 is also satisfiable, while x > 0 and x < 0 would be pruned.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study King 1976 for symbolic execution, Cadar et al. on KLEE, and SMT solver documentation such as Z3. Next study control-flow graphs, abstract interpretation, fuzzing, SAT solving, and compiler intermediate representations.',
      ],
    },
  ],
};
