// Rust ownership traces: a non-Python execution-grounding case study where
// the important state is ownership, loans, lifetimes, moves, and drops.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rust-borrow-checker-ownership-trace-case-study',
  title: 'Rust Borrow Checker Ownership Trace',
  category: 'Systems',
  summary: 'A domain-trace case study for code world models: Rust requires ownership, borrow, lifetime, and drop transitions, not just variable values.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ownership state graph', 'borrow violation'], defaultValue: 'ownership state graph' },
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

function ownershipGraph(title) {
  return graphState({
    nodes: [
      { id: 'place', label: 'place', x: 0.7, y: 3.4, note: 'local' },
      { id: 'owner', label: 'owner', x: 2.0, y: 2.0, note: 'unique' },
      { id: 'value', label: 'value', x: 3.4, y: 2.0, note: 'heap' },
      { id: 'move', label: 'move', x: 2.0, y: 4.8, note: 'transfer' },
      { id: 'borrow', label: 'borrow', x: 4.8, y: 1.4, note: '&' },
      { id: 'mut', label: 'mut borrow', x: 4.8, y: 3.4, note: '&mut' },
      { id: 'life', label: 'lifetime', x: 4.8, y: 5.4, note: 'region' },
      { id: 'drop', label: 'drop', x: 6.6, y: 2.0, note: 'cleanup' },
      { id: 'checker', label: 'check', x: 8.2, y: 3.4, note: 'MIR' },
      { id: 'trace', label: 'ledger', x: 9.4, y: 4.8, note: 'trace' },
    ],
    edges: [
      { id: 'e-place-owner', from: 'place', to: 'owner' },
      { id: 'e-owner-value', from: 'owner', to: 'value' },
      { id: 'e-place-move', from: 'place', to: 'move' },
      { id: 'e-owner-borrow', from: 'owner', to: 'borrow' },
      { id: 'e-owner-mut', from: 'owner', to: 'mut' },
      { id: 'e-borrow-life', from: 'borrow', to: 'life' },
      { id: 'e-mut-life', from: 'mut', to: 'life' },
      { id: 'e-life-drop', from: 'life', to: 'drop' },
      { id: 'e-drop-checker', from: 'drop', to: 'checker' },
      { id: 'e-checker-trace', from: 'checker', to: 'trace' },
      { id: 'e-move-checker', from: 'move', to: 'checker' },
    ],
  }, { title });
}

function violationGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x', x: 0.8, y: 3.4, note: 'owner' },
      { id: 'r1', label: 'r1', x: 2.4, y: 2.0, note: '&x' },
      { id: 'r2', label: 'r2', x: 2.4, y: 4.8, note: '&x' },
      { id: 'req', label: 'want &mut', x: 4.1, y: 3.4, note: 'write' },
      { id: 'conflict', label: 'conflict', x: 5.7, y: 3.4, note: 'active loan' },
      { id: 'end', label: 'end borrows', x: 7.3, y: 2.0, note: 'region end' },
      { id: 'ok', label: 'ok &mut', x: 7.3, y: 4.8, note: 'unique' },
      { id: 'trace', label: 'trace', x: 9.0, y: 3.4, note: 'verdict' },
    ],
    edges: [
      { id: 'e-x-r1', from: 'x', to: 'r1' },
      { id: 'e-x-r2', from: 'x', to: 'r2' },
      { id: 'e-x-req', from: 'x', to: 'req' },
      { id: 'e-r1-conflict', from: 'r1', to: 'conflict' },
      { id: 'e-r2-conflict', from: 'r2', to: 'conflict' },
      { id: 'e-req-conflict', from: 'req', to: 'conflict' },
      { id: 'e-conflict-end', from: 'conflict', to: 'end' },
      { id: 'e-end-ok', from: 'end', to: 'ok' },
      { id: 'e-ok-trace', from: 'ok', to: 'trace' },
      { id: 'e-conflict-trace', from: 'conflict', to: 'trace' },
    ],
  }, { title });
}

function* ownershipStateGraph() {
  yield {
    state: ownershipGraph('Rust traces need ownership state, not only values'),
    highlight: { active: ['place', 'owner', 'value', 'checker', 'trace', 'e-place-owner', 'e-owner-value', 'e-drop-checker', 'e-checker-trace'], compare: ['borrow', 'mut'] },
    explanation: 'A Python-style variable-value trace misses the central Rust state: who owns a value, whether it moved, which loans are active, how long references live, and when drop runs.',
  };

  yield {
    state: labelMatrix(
      'Ownership transition log',
      [
        { id: 'bind', label: 'bind' },
        { id: 'move', label: 'move' },
        { id: 'share', label: 'share' },
        { id: 'mut', label: 'mut ref' },
        { id: 'drop', label: 'drop' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['let s', 'empty', 's owns'],
        ['t=s', 's owns', 't owns'],
        ['r=&t', 't owns', 'loan &'],
        ['m=&mut t', 'no loan', 'loan mut'],
        ['scope end', 't owns', 'drop t'],
      ],
    ),
    highlight: { active: ['move:before', 'move:after', 'share:after', 'mut:before', 'mut:after'], found: ['drop:after'] },
    explanation: 'The trace has to record ownership transitions as state changes. After a move, the old place is no longer usable. During a shared borrow, the owner still exists but mutation is restricted.',
    invariant: 'Rust execution grounding needs a loan ledger, not just a locals table.',
  };

  yield {
    state: ownershipGraph('Shared and mutable borrows are separate edge types'),
    highlight: { active: ['owner', 'borrow', 'mut', 'life', 'e-owner-borrow', 'e-owner-mut', 'e-borrow-life', 'e-mut-life'], compare: ['move'] },
    explanation: 'A shared borrow permits reads and more shared borrows. A mutable borrow requires exclusive access. The trace should encode these as different edge types with lifetime regions.',
  };

  yield {
    state: labelMatrix(
      'What the borrow trace records',
      [
        { id: 'place', label: 'place' },
        { id: 'loan', label: 'loan' },
        { id: 'region', label: 'region' },
        { id: 'access', label: 'access' },
        { id: 'drop', label: 'drop' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['local/path', 'identity'],
        ['shared/mut', 'rule'],
        ['start-end', 'validity'],
        ['read/write', 'conflict'],
        ['destructor', 'cleanup'],
      ],
    ),
    highlight: { active: ['loan:field', 'region:field', 'access:field'], found: ['drop:why'] },
    explanation: 'The useful trace schema names places, loans, regions, access kinds, and destructors. That is the state a verifier needs to explain why one edit compiles and another violates borrowing rules.',
  };

  yield {
    state: ownershipGraph('Domain-specific traces make CWM portable'),
    highlight: { active: ['checker', 'trace', 'e-checker-trace'], found: ['move', 'borrow', 'mut', 'drop'], compare: ['value'] },
    explanation: 'The source corpus argues that future code world models need domain traces. For Rust, that means borrow-checker and MIR-derived ownership transitions rather than only line-by-line runtime values.',
  };
}

function* borrowViolation() {
  yield {
    state: violationGraph('A mutable borrow conflicts with active shared loans'),
    highlight: { active: ['x', 'r1', 'r2', 'req', 'conflict', 'e-x-r1', 'e-x-r2', 'e-x-req', 'e-r1-conflict', 'e-r2-conflict', 'e-req-conflict'], removed: ['ok'] },
    explanation: 'This is the canonical borrow-checker shape: x has active shared references r1 and r2, so a request for &mut x conflicts until those shared loans end.',
  };

  yield {
    state: labelMatrix(
      'Borrow-checker verdict table',
      [
        { id: 'shared', label: 'shared ref' },
        { id: 'mut', label: 'mut ref' },
        { id: 'move', label: 'move' },
        { id: 'dangling', label: 'dangling' },
        { id: 'drop', label: 'drop' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'request', label: 'request' },
        { id: 'verdict', label: 'verdict' },
      ],
      [
        ['loan &', 'read', 'allow'],
        ['loan &', 'write', 'reject'],
        ['moved', 'read old', 'reject'],
        ['ref outlives', 'return', 'reject'],
        ['owner ends', 'cleanup', 'allow'],
      ],
    ),
    highlight: { active: ['shared:verdict', 'drop:verdict'], removed: ['mut:verdict', 'move:verdict', 'dangling:verdict'] },
    explanation: 'The trace turns compiler diagnostics into structured states. A learner can see the active loan set, the requested access, and the rule that produced allow or reject.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'trace fields captured', min: 0, max: 6 }, y: { label: 'bug classes explained', min: 0, max: 6 } },
      series: [
        { id: 'values', label: 'value trace', points: [{ x: 1, y: 1 }, { x: 2, y: 1.4 }, { x: 3, y: 1.8 }, { x: 4, y: 2.0 }] },
        { id: 'loans', label: 'ownership trace', points: [{ x: 1, y: 1 }, { x: 2, y: 2.4 }, { x: 3, y: 3.7 }, { x: 4, y: 4.7 }, { x: 5, y: 5.4 }] },
      ],
      markers: [
        { id: 'gap', x: 4, y: 4.7, label: 'loan gap' },
      ],
    }),
    highlight: { active: ['loans', 'gap'], compare: ['values'] },
    explanation: 'A value trace can explain some runtime behavior, but it cannot explain use-after-move, aliasing restrictions, or lifetime errors. Capturing loan state closes that gap.',
  };

  yield {
    state: violationGraph('Ending regions converts reject into allow'),
    highlight: { active: ['conflict', 'end', 'ok', 'trace', 'e-conflict-end', 'e-end-ok', 'e-ok-trace'], compare: ['r1', 'r2'], removed: ['e-conflict-trace'] },
    explanation: 'Non-lexical lifetimes mean the relevant end point is when the references are no longer used, not necessarily the end of the block. The trace should record the actual region end that makes the mutable borrow legal.',
    invariant: 'The verifier needs lifetime regions as edges in the graph.',
  };

  yield {
    state: labelMatrix(
      'Complete case: fix a borrow conflict',
      [
        { id: 'bug', label: 'bug' },
        { id: 'trace', label: 'trace' },
        { id: 'edit', label: 'edit' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['& then &mut', 'region gap'],
        ['shared active', 'loan ended'],
        ['move print up', 'compile ok'],
        ['reject path', 'allow path'],
      ],
    ),
    highlight: { removed: ['bug:before', 'trace:before'], active: ['trace:after', 'edit:after'], found: ['proof:after'] },
    explanation: 'A useful repair trajectory does not just say "satisfy the borrow checker." It records that the edit moved the last shared-reference use before the mutable borrow, shortening the region and changing the verifier path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ownership state graph') yield* ownershipStateGraph();
  else if (view === 'borrow violation') yield* borrowViolation();
  else throw new InputError('Pick a Rust ownership-trace view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Rust borrow-checker ownership trace is a domain-specific execution trace for Rust programs. Instead of recording only variable values, it records ownership, moves, shared borrows, mutable borrows, lifetime regions, access requests, drops, and borrow-checker verdicts. This is the Rust version of execution-grounded data for code world models.',
        'The local CWM source notes make this point directly: building world models for other domains is not a matter of rerunning the Python pipeline. For Rust, the trace needs ownership state transitions. Official Rust material gives the underlying rules: ownership manages memory without a garbage collector, references borrow owned data, and borrow expressions place memory locations into borrowed states for the reference lifetime: https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html and https://doc.rust-lang.org/reference/expressions/operator-expr.html.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The trace schema starts with places: locals, fields, dereferences, and paths. It records owner state, move transitions, active loans, loan kind, lifetime region, access kind, and drop point. A shared borrow allows reads and more shared borrows. A mutable borrow requires exclusive access until the borrow ends. A move transfers ownership and makes the old place unusable unless the type is Copy.',
        'The compiler-side substrate is MIR. The rustc development guide describes MIR as the representation used for flow-sensitive safety checks, notably the borrow checker, and explains MIR borrow checking as the phase that enforces initialization, move, and borrowing properties: https://rustc-dev-guide.rust-lang.org/mir/index.html and https://rustc-dev-guide.rust-lang.org/borrow_check.html.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider code that takes a shared reference to a String, prints through that reference, then asks for a mutable reference to the same String. If the shared reference is still live, the mutable borrow is rejected. The ownership trace records x owns object 42, r1 is a shared loan over x, the write request asks for an exclusive loan, and the active loan set conflicts. If an edit moves the last use of r1 earlier, the region ends before the mutable borrow, and the verifier path changes from reject to allow.',
        'A plain runtime trace can show that the String value is "hello" before and after. It cannot explain why the edit compiled. The ownership trace can, because it names the loan graph and the region boundary. That is why Rust needs its own trace vocabulary for world-model training, verifier search, and agentic repair data.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is compiler integration and schema discipline. A useful trace must map source spans to MIR places and regions, then store diagnostics in a replayable way. It must handle non-lexical lifetimes, reborrows, deref coercions, closure captures, interior mutability, unsafe boundaries, and drop order. If the trace simplifies these away, it teaches a model a false version of Rust.',
        'The payoff is strong supervision for repair agents. Instead of learning that a patch "made the compiler happy," the agent can learn that an edit shortened a lifetime, avoided a move, split a mutable access, or introduced ownership transfer. That is a much cleaner training target than compiler stderr alone.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not represent Rust as Python with braces. Ownership is semantic state. Do not collapse shared and mutable borrows into one "reference" label. Do not treat lifetimes as syntax only; most are inferred regions. Do not train on compiler errors without the corresponding place, loan, region, and access facts.',
        'Primary sources: The Rust Book on ownership at https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html, Rust Book references and borrowing at https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html, Rust Reference borrow expressions at https://doc.rust-lang.org/reference/expressions/operator-expr.html, rustc dev guide MIR at https://rustc-dev-guide.rust-lang.org/mir/index.html, and rustc dev guide borrow check at https://rustc-dev-guide.rust-lang.org/borrow_check.html. Study Code World Models Case Study, Execution Trace State Diff Case Study, JVM Happens-Before Execution Trace, Financial Contract Lifecycle Event Model, Static Single Assignment & Phi Nodes, Abstract Interpretation Interval Domain, Hazard Pointers & Epoch Reclamation, WebAssembly Linear Memory Case Study, and Software Supply Chain Provenance Graph next.',
      ],
    },
  ],
};
