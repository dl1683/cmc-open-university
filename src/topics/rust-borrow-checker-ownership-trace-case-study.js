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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a ledger of ownership events. A place is a named storage location such as variable x, ownership means responsibility for dropping a value, and a loan is a temporary borrow of that value.',
        'The active event changes the ledger: bind, move, borrow, access, or drop. The verdict is computed from initialized state plus active loans, not from the text of the source line alone.',
        {type:'callout', text:'A Rust trace must track ownership and active loans because the compiler verdict depends on state that never appears in a value table.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Systems programs need memory safety without a garbage collector. Memory safety means no use-after-free, no double free, and no data race through shared mutable state.',
        'Rust solves that by making ownership and borrowing part of the type system. The borrow checker exists to reject programs whose references could outlive values or whose aliases could conflict with mutation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is manual memory management. A programmer allocates memory, passes pointers around, and remembers to free the memory when no one needs it.',
        'That approach is fast and flexible, which is why C and C++ have been used for operating systems, databases, browsers, and embedded software. The problem is that the compiler cannot always see whether a pointer is still valid.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is aliasing plus mutation. If two pointers can reach the same object and one mutates or frees it while the other still reads it, the program can read invalid memory or observe a torn update.',
        'Runtime techniques can help, but they have taxes. Garbage collection adds runtime work, reference counting adds increments and decrements, and locks add contention and deadlock risk.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Rust uses a static ownership rule: each non-Copy value has one owner at a time, and the owner drops the value when it goes out of scope. Moving a value transfers ownership and makes the old place unusable.',
        'Borrowing adds the aliasing rule. A value may have many shared references for reading or one mutable reference for reading and writing, but not both at the same time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler lowers code into an intermediate form and tracks places, moves, loans, regions, and drops. A region is the part of the program where a reference can still be used.',
        'At each access, the checker asks whether the place is initialized and whether the requested access conflicts with any active loan. Reads are allowed through shared loans, but mutation or movement of the borrowed place is rejected while shared loans remain active.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The first invariant is single ownership for values that need destruction. Because exactly one owner is responsible for each such value, safe code cannot double free it or use the moved-from owner as if it still held the value.',
        'The second invariant is aliasing XOR mutation. If shared references exist, the referent is read-only through safe code; if a mutable reference exists, it is exclusive, so no other safe reference can observe conflicting mutation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Runtime cost is zero for the borrow checks because they happen at compile time. The compiled program does not carry a general borrow-checking engine for ordinary references.',
        'Compile-time and human cost are real. The compiler must analyze loans over the function body, and the programmer must design APIs around ownership transfer, shared borrowing, mutable borrowing, and lifetime boundaries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Rust ownership is used in operating-system components, browser engines, cloud infrastructure, command-line tools, embedded systems, and high-performance services. These are domains where memory safety matters and garbage collection pauses can be unacceptable.',
        'The same model also shapes concurrency. Marker traits such as Send and Sync let the compiler enforce which values may move across threads and which may be shared by reference.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The checker is conservative, so it rejects some programs that are safe but hard to prove. Self-referential structures, graph mutation, async borrows across await points, and complex conditional references often need restructuring.',
        'The model also has escape hatches. Unsafe code, raw pointers, RefCell, Mutex, and foreign functions move some proof burden from the compiler to the programmer or to runtime checks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let mut x be a String, then create r1 = &x and r2 = &x. If the last use of r1 and r2 is a println at line 4, a mutation x.push_str at line 5 is allowed because the shared loan regions ended before the mutation.',
        'Move that println to line 6 and the same push_str at line 5 is rejected. At line 5 the ledger contains two active shared loans, so a mutable access would violate aliasing XOR mutation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: The Rust Programming Language ownership chapter at https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html, the rustc MIR borrow check guide at https://rustc-dev-guide.rust-lang.org/borrow_check.html, and RustBelt at https://plv.mpi-sws.org/rustbelt/. Study stack versus heap, move semantics, lifetimes, interior mutability, and data-race freedom next.',
      ],
    },
  ],
};
