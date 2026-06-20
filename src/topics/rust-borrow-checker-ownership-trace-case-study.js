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
        'The animation has two views. "Ownership state graph" traces the full lifecycle of a Rust value -- binding, moving, borrowing, lifetime tracking, drop, and checker verdict. "Borrow violation" shows the canonical conflict: active shared loans block a mutable borrow request until the shared regions end.',
        {type:'callout', text:'A Rust trace must track ownership and active loans because the compiler verdict depends on state that never appears in a value table.'},
        {type: 'bullets', items: [
          'Active (highlighted): the current ownership event or checker decision -- a place being bound, a loan being created, or a conflict being evaluated.',
          'Found (green): a fact the checker has committed to -- a drop event scheduled, a verdict rendered, a region boundary established.',
          'Compare (blue): a contrasting state that clarifies the active decision -- shared vs. mutable borrow kinds, or references whose regions have ended vs. those still live.',
          'Removed (red): a rejected path -- a mutable borrow blocked by active shared loans, or a use-after-move that the checker refuses.',
        ]},
        {type: 'note', text: 'The key contrast between the two views: the ownership-state view shows how the trace records state transitions (bind, move, borrow, drop). The borrow-violation view shows how the checker uses that recorded state to produce allow/reject verdicts. The trace is the data. The checker is the decision function over that data.'},
        'At each frame, ask: what is the current ownership state of every place, which loans are active, and would the next access request be allowed or rejected given that state?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'C and C++ give programmers manual control over memory. The result is a class of bugs -- use-after-free, double-free, dangling pointers, data races -- that accounts for roughly 70% of critical security vulnerabilities in large C/C++ codebases. Microsoft, Google, and Mozilla have independently reported this figure across Windows, Chrome, Android, and Firefox.',
        {type: 'quote', text: 'We find that ~70% of the vulnerabilities addressed through a security update each year continue to be memory safety issues.', attribution: 'Matt Miller, Microsoft Security Response Center (BlueHat 2019)'},
        'Garbage-collected languages (Java, Python, Go) eliminate these bugs by removing manual deallocation. The cost is runtime overhead: GC pauses, unpredictable latency, and memory bloat from deferred collection. Systems programming -- operating systems, browsers, game engines, embedded firmware -- often cannot afford that cost.',
        'Rust eliminates memory-safety bugs without a garbage collector by making ownership, borrowing, and lifetimes part of the type system. The borrow checker enforces these rules at compile time: zero runtime cost, zero GC pauses, and a guarantee that safe Rust code cannot produce use-after-free, data races, or dangling references. The trade-off is that the programmer must satisfy the checker, and understanding the checker requires understanding ownership state -- not just variable values.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct when teaching or debugging Rust is to use the same trace format as Python or JavaScript: a table of variable names and their current values, updated line by line. Debuggers, visualizers, and REPL tools typically present execution this way.',
        {type: 'table', headers: ['Line', 'Variable', 'Value', 'What the table shows', 'What it misses'], rows: [
          ['1', 's', '"hello"', 's holds a String', 's owns a heap-allocated buffer via (ptr, len, cap)'],
          ['2', 't', '"hello"', 't holds the same String', 's is now uninitialized -- ownership moved to t'],
          ['3', 'r', '&"hello"', 'r points at t', 'A shared loan is active; t cannot be mutated while r lives'],
          ['4', 'm', '&mut "hello"', 'm points at t', 'Rejected if r is still live -- exclusivity violation'],
          ['5', '(end)', '---', 'Variables go out of scope', 'Drop order: m then t then s (but s is already moved)'],
        ]},
        'The value table says s and t hold the same string. It cannot explain why reading s on line 3 would be a compile error, why requesting &mut t on line 4 depends on whether r is still used later, or why the drop order matters. The important state -- ownership, loans, regions, move flags -- is invisible.',
        'Compiler error messages help, but they are diagnostic summaries, not traces. A message says "cannot borrow t as mutable because it is also borrowed as immutable." The learner still needs to know: which place, which loan, when the loan started, when it ends, and what access triggered the conflict. Without that causal chain, the fix is guesswork.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that borrow-checker errors are compile-time rejections, not runtime crashes. The program never executes. A runtime trace has nothing to observe because rustc refused to produce a binary. The error exists entirely in the compiler\'s static analysis of ownership state.',
        {type: 'code', language: 'rust', text: 'fn main() {\n    let mut x = String::from("hello");\n    let r1 = &x;          // shared borrow of x begins\n    let r2 = &x;          // second shared borrow -- OK, shared loans coexist\n    x.push_str(", world"); // ERROR: cannot borrow x as mutable\n                           // because it is also borrowed as immutable\n    println!("{} {}", r1, r2); // r1 and r2 are used here, so their\n                               // regions extend past the push_str call\n}'},
        'This code never runs. No debugger can step through it. No value table can show what went wrong. The failure is a conflict between the active shared loans (r1, r2) and the mutable access requested by push_str. The trace must record loan state at each program point, not runtime values.',
        {type: 'note', text: 'The second wall is non-lexical lifetimes (NLL). Before Rust 2018 edition, borrows lived until the end of their enclosing block. Since NLL (stabilized in rustc 1.31, December 2018), the compiler infers that a borrow ends at its last use. Moving a println! from after a mutable borrow to before it can change the program from rejected to accepted. A useful trace must show exactly where each region ends and why.'},
        'A trace built from surface syntax alone will also miss reborrows (temporarily lending through an existing &mut), autoderef chains, closure captures (which borrow or move depending on usage), and drop order (which determines when owned values are freed and in what sequence). These are compiler-internal facts that affect the verdict.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Trace Rust as a system of places and loans, not variables and values. A place is any path that can hold or refer to a value: a local variable, a struct field (x.name), a dereference (*r), an index (v[0]), or a composite path (self.buffer[i].data). Ownership state says whether a place currently owns an initialized value, has been moved from, or has been partially moved.',
        {type: 'diagram', text: '  Source Code          Ownership Trace (Loan Ledger)\n  -----------          -----------------------------\n  let s = String::new() --> Place s: initialized, owner\n  let t = s             --> Place s: moved (unusable)\n                            Place t: initialized, owner\n  let r = &t            --> Loan: shared, place t, region [L3..L5]\n  let m = &mut t        --> CHECK: t has active shared loan?\n                            If r is still live: REJECT (conflict)\n                            If r\'s region ended: ALLOW (exclusive OK)\n  drop(t)               --> Place t: drop runs, destructor called\n                            All loans on t must have ended first', label: 'The trace records ownership transitions, not value snapshots'},
        'A loan records four facts: the borrowed place, the borrow kind (shared or mutable), the region (from the borrow point to the last use), and the access rights it grants and restricts. The checker is a function that takes the current ledger and a new access request, then returns allow or reject.',
        {type: 'note', text: 'This framing turns the borrow checker from a mysterious oracle into a traceable state machine. The state is the set of active loans and the initialization status of each place. The transitions are bind, move, borrow, access, and drop. The output is a verdict at each access point. Every verdict has a causal explanation in the ledger.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ownership trace records five kinds of events, each with structured fields.',
        {type: 'table', headers: ['Event', 'Fields recorded', 'State change'], rows: [
          ['Bind', 'place, type, Copy/non-Copy', 'Place becomes initialized, owns the value'],
          ['Move', 'source place, target place', 'Source becomes uninitialized; target becomes owner'],
          ['Borrow', 'place, kind (shared/mut), region start', 'A loan is added to the active loan set'],
          ['Access', 'place, kind (read/write/move/borrow)', 'Checked against active loans; verdict: allow or reject'],
          ['Drop', 'place, drop order position', 'Value is destroyed; all loans on this place must have ended'],
        ]},
        'Binding: when code executes let s = String::from("hello"), the trace records that place s owns a heap-allocated String and is initialized. The String itself is a struct of three fields on the stack: a pointer to the heap buffer, a length, and a capacity. The trace cares about ownership of the whole value, not the individual bytes.',
        'Moving: when code executes let t = s, ownership transfers. The heap buffer is not copied. The pointer, length, and capacity are copied into place t on the stack, and place s is marked as moved. Unless the type implements the Copy trait (integers, booleans, &T references), the old place is no longer usable. This is why Rust can deallocate without a GC -- at any point, exactly one place owns each value, so exactly one place is responsible for dropping it.',
        {type: 'code', language: 'rust', text: '// Move semantics: ownership transfer, not copy\nlet s = String::from("hello"); // s owns the heap buffer\nlet t = s;                      // ownership moves to t\n// println!("{}", s);           // COMPILE ERROR: s was moved\nprintln!("{}", t);              // OK: t is the owner\n\n// Copy semantics: value is duplicated\nlet a: i32 = 42;               // a owns a stack value\nlet b = a;                      // b gets a copy (i32 is Copy)\nprintln!("{} {}", a, b);        // OK: both a and b are initialized'},
        'Borrowing: a shared borrow &t creates a shared loan. The region starts at the borrow expression and ends at the last use of the resulting reference (under NLL). During this region, reads through &t are allowed, additional shared borrows of t are allowed, but writes to t or mutable borrows of t are rejected. A mutable borrow &mut t creates an exclusive loan: the borrower may read and write, but all other access to t is blocked for the duration of the region.',
        'Access checking: at each program point where a place is accessed, the checker scans the active loan set. The rules are:',
        {type: 'bullets', items: [
          'Read through a place with only shared loans active: allowed.',
          'Read through a place with an active mutable loan held by someone else: rejected.',
          'Write or mutate through a place with any active loan (shared or mutable) held by someone else: rejected.',
          'Move from a place with any active loan: rejected (the referent would vanish under the borrower).',
          'Drop a place while loans are still active: rejected (the destructor would invalidate live references).',
        ]},
        'Drop: when a place goes out of scope, Rust runs the destructor (the Drop trait implementation, if any) and frees the owned memory. Drop order within a scope is reverse declaration order. The trace must record drop order because it affects which borrows must have ended before which destructor runs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The borrow checker enforces two invariants that together eliminate memory-safety bugs without runtime cost.',
        {type: 'bullets', items: [
          'Aliasing XOR Mutation: at any point, a value is either referenced by any number of shared (&T) borrows (aliased, read-only) or by exactly one mutable (&mut T) borrow (exclusive, read-write). Never both. This eliminates data races, iterator invalidation, and aliasing-based undefined behavior.',
          'Lifetime soundness: every reference must be valid for its entire region. A reference cannot outlive the value it points to. This eliminates use-after-free, dangling pointers, and returning references to stack-local values.',
        ]},
        {type: 'quote', text: 'The key property of the Rust type system is that it enforces the discipline of ownership and borrowing, and as a consequence, well-typed programs do not have data races and do not exhibit use-after-free bugs.', attribution: 'Ralf Jung et al., "RustBelt: Securing the Foundations of the Rust Programming Language" (POPL 2018)'},
        'The formal foundation is RustBelt, which proves that safe Rust\'s type system (including ownership, borrowing, and lifetimes) is sound: well-typed programs cannot exhibit undefined behavior. The proof uses a technique called semantic typing in the Iris framework, modeling ownership as fractional permissions and lifetimes as logical regions.',
        'The trace works as a teaching tool because the rules are finite, enumerable, and local. Each access request is checked against a small set of facts: is the place initialized? What loans are active? Is the requested access compatible with those loans? Does the region cover the access point? A learner who can read the ledger can predict the verdict before the compiler produces it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Two versions of the same function. Version A compiles. Version B does not. The only difference is the position of one line.',
        {type: 'code', language: 'rust', text: '// Version A: compiles under NLL\nfn main() {\n    let mut x = String::from("hello");\n    let r1 = &x;                         // shared borrow begins\n    let r2 = &x;                         // second shared borrow -- OK\n    println!("{} and {}", r1, r2);        // last use of r1 and r2\n    // -- NLL: shared loans end here --\n    x.push_str(", world");               // mutable access: no active loans, OK\n    println!("{}", x);\n}\n\n// Version B: rejected\nfn main() {\n    let mut x = String::from("hello");\n    let r1 = &x;\n    let r2 = &x;\n    x.push_str(", world");               // ERROR: shared loans still active\n    println!("{} and {}", r1, r2);        // r1, r2 used after push_str\n}'},
        'The loan ledger for each version:',
        {type: 'table', headers: ['Event', 'Version A ledger', 'Version B ledger'], rows: [
          ['let mut x = ...', 'Place x: initialized, owner', 'Place x: initialized, owner'],
          ['let r1 = &x', 'Loan: shared, x, region [L3..]', 'Loan: shared, x, region [L3..]'],
          ['let r2 = &x', 'Loan: shared, x, region [L4..]', 'Loan: shared, x, region [L4..]'],
          ['println!(r1, r2)', 'Last use of r1, r2 -> regions end', '(occurs later, after push_str)'],
          ['x.push_str()', 'Access: mut write to x. Active loans: none. ALLOW', 'Access: mut write to x. Active loans: r1 shared, r2 shared. REJECT'],
          ['println!(r1, r2)', '(already consumed above)', 'Last use of r1, r2 -> regions end (too late)'],
        ]},
        {type: 'note', text: 'The fix is not "satisfy the borrow checker." The fix is: the last shared-reference use must occur before the mutable access. Moving the println! up shortens the shared-loan regions so they no longer overlap with the push_str call. The trace makes this causal: the same code with one line moved changes which loans are active at the access point.'},
        'Five common repair patterns, each described by the ledger change they produce:',
        {type: 'bullets', items: [
          'Reorder uses: move the last shared-reference use before the mutable borrow. The shared loan region shrinks; the conflict disappears.',
          'Clone: replace &x with x.clone(). A new independent value is created; no loan on x, so mutation is unrestricted. Cost: heap allocation and copy.',
          'Scope narrowing: introduce a block { let r = &x; use(r); } so the borrow ends at the block boundary. The mutable borrow outside the block sees no active loans.',
          'Disjoint borrows: borrow &self.name and &mut self.age instead of &self and &mut self. The compiler can prove the fields do not overlap (available since Rust 2021 edition closures, and for direct field access since NLL).',
          'Ownership transfer: return an owned String instead of &str when the reference would outlive the referent. The caller receives ownership, not a borrow.',
        ]},
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The ownership-state view walks through the full lifecycle. The first frame shows the graph of places, owners, values, moves, borrows, lifetimes, drops, the checker, and the trace ledger. The transition-log matrix then gives the minimum event vocabulary: bind, move, share, mut ref, and drop -- five events that cover every ownership state change.',
        'The shared-versus-mutable frame separates the two borrow kinds as distinct edge types with different aliasing rules. The trace-schema table names the five fields a verifier needs: place (identity), loan (rule), region (validity), access (conflict check), and drop (cleanup). The final frame connects this to domain-specific traces: different languages need different state variables.',
        'The borrow-violation view shows the canonical conflict shape. x has active shared loans r1 and r2. A request for &mut x arrives. The conflict node represents the checker scanning the active loan set. Later frames show that ending shared regions (NLL) converts the reject into an allow. The verdict is a function of the ledger at the access point, not a compiler mood.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'table', headers: ['Dimension', 'Cost', 'What drives it'], rows: [
          ['Compile time', 'Borrow checking is O(n * L) per function', 'n = MIR statements, L = active loans. Polonius (next-gen checker) uses Datalog to scale better on complex functions.'],
          ['Runtime cost', 'Zero', 'All checks happen at compile time. No GC, no reference counting, no runtime tags.'],
          ['Developer time', 'High for beginners, moderate for experienced', 'Learning the ownership model takes ~2-4 weeks. After that, most patterns become idiomatic.'],
          ['Trace storage', 'O(events * fields) per function', 'A teaching trace records bind, move, borrow, access, and drop events with 4-6 fields each.'],
          ['MIR extraction', 'Requires compiler integration', 'Surface syntax misses NLL regions, reborrows, autoderef, closure captures, and drop elaboration.'],
        ]},
        'The real cost is not the checker itself -- it runs in milliseconds per function. The cost is the programmer\'s mental model. A Rust developer must think about ownership at every function boundary: does this function take ownership, borrow immutably, or borrow mutably? The reward is that the resulting code is memory-safe without runtime overhead, and the ownership annotations serve as machine-checked documentation of the data flow.',
        {type: 'note', text: 'Polonius, the next-generation borrow checker (in development), reformulates the analysis as a Datalog program over MIR facts. It handles some patterns NLL rejects (notably, conditional returns of references) and produces better error diagnostics. The loan-ledger model described here maps cleanly to Polonius facts: loan origins, loan invalidations, and subset relations between regions.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'table', headers: ['Domain', 'System', 'Why ownership matters'], rows: [
          ['Operating systems', 'Linux kernel Rust modules (since 6.1)', 'Kernel code cannot use a GC. Ownership ensures drivers and file systems free memory exactly once without use-after-free.'],
          ['Browsers', 'Servo (Mozilla), Stylo (in Firefox)', 'Parallel CSS computation requires data-race freedom. Ownership enforces thread-safe access patterns at compile time.'],
          ['Cloud infrastructure', 'Firecracker (AWS Lambda microVM)', 'MicroVMs must be memory-safe with microsecond startup. Zero-cost ownership eliminates GC pauses in the hot path.'],
          ['Embedded systems', 'Embassy async framework', 'No heap, no allocator, no GC. Ownership tracks hardware peripheral access: only one task can own a UART at a time.'],
          ['Databases', 'TiKV (distributed KV store under TiDB)', 'Concurrent storage engine needs safe memory management under high throughput without GC stop-the-world pauses.'],
          ['CLI and dev tools', 'ripgrep, fd, bat, exa', 'Ownership enables fearless parallelism: split work across threads with compile-time guarantees against data races.'],
        ]},
        'The common thread: these are systems where memory safety is critical, GC is unacceptable, and concurrency bugs are catastrophic. Ownership provides the same safety guarantees as a GC with the same performance profile as manual C memory management.',
        {type: 'note', text: 'The ownership model extends beyond memory. The same borrow rules enforce thread safety: Send and Sync marker traits use the type system to prevent data races. A type that is not Sync cannot be shared across threads via &T. A type that is not Send cannot be moved to another thread. These are ownership rules applied to concurrency, not a separate system.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The borrow checker is a conservative static analysis. It rejects some programs that are actually safe because it cannot prove they are safe. Failure modes:',
        {type: 'table', headers: ['Pattern', 'Why the checker rejects it', 'Common workaround'], rows: [
          ['Self-referential structs', 'A struct cannot hold a reference to its own field -- moving the struct would invalidate the reference', 'Pin<Box<T>>, or restructure with indices instead of references'],
          ['Graph and doubly-linked structures', 'Multiple mutable references to the same node violate exclusivity', 'Rc<RefCell<T>> (single-threaded), Arc<Mutex<T>> (multi-threaded), or arena allocation with indices'],
          ['Conditional borrows', 'The checker may not see that two branches never create overlapping loans', 'Polonius handles some cases; otherwise restructure the control flow'],
          ['Async + borrowing across .await', 'A reference held across an await point must live as long as the future, complicating lifetimes', 'Clone data into the future, use owned types, or restructure to avoid cross-await borrows'],
          ['Interior mutability', 'Sometimes mutation through a shared reference is needed (caches, counters)', 'Cell<T> (Copy types), RefCell<T> (runtime borrow checks), Mutex<T> (thread-safe)'],
        ]},
        {type: 'diagram', text: '  Safe Rust programs (all correct programs)\n  +---------------------------------------------+\n  |                                             |\n  | Programs the borrow checker accepts         |\n  | +---------------------------------------+   |\n  | |                                       |   |\n  | | (all accepted programs are safe)      |   |\n  | |                                       |   |\n  | +---------------------------------------+   |\n  |                                             |\n  | Programs the checker rejects but are safe   |\n  | (self-referential, complex graphs, etc.)    |\n  | --> use unsafe or restructure               |\n  |                                             |\n  +---------------------------------------------+\n  Unsound programs (use-after-free, data races)\n  --> always rejected by the checker', label: 'The borrow checker is sound (no false accepts) but incomplete (some false rejects)'},
        'The trace also fails if it ignores unsafe blocks. Unsafe code can create raw pointers, dereference them, call foreign functions, and bypass borrow rules. The borrow checker trusts unsafe blocks -- the programmer bears the proof burden. A trace that pretends unsafe does not exist teaches a false model. It should mark unsafe regions explicitly and show which invariants the programmer is manually guaranteeing.',
        'Interior mutability (Cell, RefCell, Mutex, RwLock) moves some borrow checks from compile time to runtime. RefCell::borrow_mut() will panic if a shared borrow is already active. The ownership model still applies, but the enforcement point shifts. A trace should show this distinction: compile-time reject vs. runtime panic for the same logical violation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'bullets', items: [
          'Klabnik and Nichols, "The Rust Programming Language" (2023 edition), chapters 4 (Ownership), 10 (Lifetimes), 15 (Smart Pointers). The canonical introduction to ownership, borrowing, and lifetimes. https://doc.rust-lang.org/book/',
          'Ralf Jung et al., "RustBelt: Securing the Foundations of the Rust Programming Language," POPL 2018. Formal soundness proof of Rust\'s type system using the Iris framework. https://plv.mpi-sws.org/rustbelt/',
          'Matsakis, "An alias-based formulation of the borrow checker" (2018). The Polonius project: reformulating borrow checking as Datalog over MIR facts. https://smallcultfollowing.com/babysteps/blog/2018/04/27/an-alias-based-formulation-of-the-borrow-checker/',
          'The rustc dev guide, "MIR borrow check" chapter. Internal documentation of how the compiler represents places, loans, and regions in MIR. https://rustc-dev-guide.rust-lang.org/borrow_check.html',
          'Matt Miller, "Trends, Challenges, and Strategic Shifts in the Software Vulnerability Landscape," BlueHat 2019. The 70% memory-safety figure for Microsoft CVEs.',
        ]},
        'Study next by role:',
        {type: 'bullets', items: [
          'Prerequisite: Stack and Heap Memory Layout (understand where owned values physically live), Smart Pointers (Box, Rc, Arc as ownership wrappers that extend the model).',
          'Companion traces: Execution Trace State Diff Case Study (value-level traces for comparison), JVM Happens-Before Execution Trace (memory-model traces for Java), Code World Models Case Study (the broader CWM framework this case study extends).',
          'Extensions: Hazard Pointers and Epoch Reclamation (how C++ solves the same problem at runtime), WebAssembly Linear Memory Case Study (ownership in a different systems context), Static Single Assignment and Phi Nodes (another compiler IR where variable identity matters).',
          'Deeper Rust: Abstract Interpretation Interval Domain (static analysis foundations), Software Supply Chain Provenance Graph (tracking trust through a build system, analogous to tracking ownership through a program).',
        ]},
      ],
    },
  ],
};
