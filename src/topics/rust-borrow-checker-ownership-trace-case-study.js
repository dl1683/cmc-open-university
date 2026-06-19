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
        "Read the animation as the execution trace for Rust Borrow Checker Ownership Trace. A domain-trace case study for code world models: Rust requires ownership, borrow, lifetime, and drop transitions, not just variable values..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Problem',
      paragraphs: [
        `A normal program trace records variable values, function calls, branches, and outputs. That is useful for many languages, but it is not enough for Rust. The central fact in a Rust program is often not the current text inside a String or the integer inside a vector. It is who owns the value, whether ownership has moved, which references are active, which access is being requested, where lifetimes end, and when destructors run.`,
        `A Rust borrow-checker ownership trace exists to make that compiler state explicit. The goal is not to reprint the source code or store compiler stderr as plain text. The goal is to record a structured ledger of ownership transitions, shared loans, mutable loans, lifetime regions, move events, access requests, drop points, and verifier verdicts. That is the state a learner or repair agent needs in order to understand why one edit compiles and a visually similar edit fails.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The naive approach is to reuse a dynamic-language trace. Show that s contains "hello", show that v contains three elements, show that a function was called, and show the returned value. This feels natural because debuggers and teaching tools often present execution as a changing table of locals. For Python or JavaScript examples, that table may explain most beginner mistakes.`,
        `Rust needs another layer. After let t = s, the old place s may no longer be usable because ownership moved to t, even if the heap value itself still exists. During let r = &t, the owner t still exists, but mutation through t may be restricted while the shared loan is active. During let m = &mut t, other reads and writes may be restricted because the mutable borrow requires exclusivity. A value table alone cannot explain these rules.`,
        `Compiler diagnostics help, but stderr is still not a trace. A message may say that a mutable borrow conflicts with an immutable borrow, yet the learner needs to know which place was borrowed, where the loan started, where it ended, and which later access triggered the conflict. Without those facts, a repair system learns symptoms rather than rules.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is that many important Rust failures are verifier-state failures, not runtime failures. The program may never execute. The compiler rejects it because it can prove that a use-after-move, aliasing conflict, dangling reference, uninitialized use, or invalid drop order would be possible. A runtime-only trace has no event to observe because the rejected program never ran.`,
        `The second wall is that Rust uses inferred regions. A beginner may think a borrow lives until the end of a block, but non-lexical lifetimes often end a borrow at the last use. Moving a println! can shorten a region enough to allow a later mutable borrow. A useful trace must show that the last use moved, the shared loan ended earlier, and the mutable loan request changed from conflict to allowed. The difference is semantic, not cosmetic.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to trace Rust as a system of places and loans. A place is a local, field, dereference, index, or path that can hold or refer to a value. Ownership state says which place owns a value or whether that place has been moved from. A loan records that a place has been borrowed, whether the loan is shared or mutable, and which region describes how long the loan remains relevant. An access request records a read, write, move, or borrow attempt.`,
        `The result is a loan ledger. When the program asks for &mut x, the ledger can say whether x has active shared loans. When the program reads s after moving it into t, the ledger can say that s is moved and no longer initialized for use. When a reference would outlive its referent, the ledger can show the region mismatch. When a destructor runs, the ledger can show which value is being dropped and which borrows must have ended first.`,
        `This article frames the borrow checker as a traceable state machine rather than a mysterious compiler mood. The rules are still strict, but they become inspectable: places, loans, regions, accesses, moves, and drops change over time according to structured transitions.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A useful ownership trace starts with binding. When code creates let s = String::from("hi"), the trace records that place s owns a heap value and is initialized. When code executes let t = s, the trace records a move from s to t. The heap allocation did not need to be copied, but the owner place changed. Unless the type implements Copy, the old place s is now unusable for ordinary reads.`,
        `Borrowing adds loans. A shared borrow &t creates a shared loan from place t with a region beginning at the borrow expression and ending at the last use inferred by the compiler. During that region, reads through shared references are allowed, and more shared borrows may be allowed, but mutation through t is restricted. A mutable borrow &mut t creates an exclusive loan. During that region, the borrower may mutate, but other conflicting access to t is rejected.`,
        `Access checking compares a request with the active ledger. A read request asks whether the place is initialized and whether any active mutable loan forbids reading through that path. A write request asks whether the place is initialized and whether active shared or mutable loans conflict. A move request asks whether the place may be moved and whether loans prevent moving. A drop point asks whether it is legal to destroy the value and run destructors.`,
        `The compiler implementation uses MIR, Rust\'s mid-level intermediate representation, for flow-sensitive checks. A teaching trace does not need to expose every compiler detail, but it should preserve the same kinds of facts: places, initialization, moves, borrow kinds, regions, access kinds, and drop order. That is the minimal state needed to explain borrow-checker behavior faithfully.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The trace works because Rust\'s safety rules are structured around a small set of state transitions. Binding initializes a place. Moving transfers ownership and may deinitialize the old place. Shared borrowing adds a read-only loan over a region. Mutable borrowing adds an exclusive loan over a region. Access requests are allowed or rejected by comparing the request with the current owner and loan state. Scope exits and explicit drops run cleanup when ownership permits it.`,
        `The central invariant is that mutation requires exclusivity and references must not outlive the values they point to. Shared aliases may coexist when they only read. A mutable reference requires that no conflicting shared or mutable loan is active. A moved-from place cannot be read as if it still owned the value. A reference cannot be returned if its region would extend beyond the referent. The ledger turns each of those principles into data.`,
        `This is valuable for code world models because it gives repairs a causal target. A patch is not merely labeled "accepted by rustc." It can be labeled as shortening a shared-loan region, removing a move, borrowing a field instead of the whole struct, cloning intentionally, using reborrowing correctly, or moving a destructor boundary. Those are reusable program concepts.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Consider a small function with a String named x. The code creates r1 = &x and r2 = &x, then prints both references. After that, it asks for m = &mut x and pushes more text. With non-lexical lifetimes, this can be legal if the last uses of r1 and r2 occur before the mutable borrow. The shared loans end at their last use, so the mutable loan request sees no active shared conflict.`,
        `Now move the println! that uses r1 after the mutable borrow. The value table still says x is the same String, but the loan ledger changes. r1\'s shared loan remains active when the program requests &mut x. The checker sees an exclusive mutable request while a shared loan is live, so it rejects the program. The trace explains the exact conflict: place x, active loan kind shared, requested access mutable borrow, verdict reject.`,
        `A repair can be represented precisely. Move the last shared-reference use before the mutable borrow, clone a value when ownership transfer is intended, create a narrower inner scope, borrow disjoint fields when the language can prove they are separate, or change a function signature so it returns owned data instead of a dangling reference. Each repair changes a specific ledger entry rather than just silencing an error.`,
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        `The ownership-state view starts with places, owners, values, moves, borrows, lifetimes, drops, the checker, and the trace ledger. The first frame emphasizes that a Python-style table of variable values is missing the real Rust state. The transition-log matrix then gives the minimum event vocabulary: bind, move, shared borrow, mutable borrow, and drop. Those are the state changes a trace must record.`,
        `The shared-versus-mutable frame separates edge types. A shared borrow and a mutable borrow are not the same label with a different spelling. They have different aliasing rules and different conflict behavior. The trace-schema table names the fields a verifier needs: place, loan, region, access, and drop. The final frame links this to domain-specific traces for code world models. Different languages and domains need different state variables.`,
        `The borrow-violation view shows the canonical conflict. x has active shared loans r1 and r2. A new request asks for &mut x. The conflict node represents the checker comparing active loans with the requested access. Later frames show that ending regions can convert rejection into allowance. That is the key lesson: the compiler verdict follows from the active ledger at the access point.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The cost is compiler integration. A faithful trace needs to map source spans to MIR places, inferred regions, borrow kinds, move paths, and diagnostics. That information exists in the compiler pipeline, but exposing it in a stable teaching or benchmark format is work. If a trace is built from surface syntax alone, it will miss non-lexical lifetime behavior, reborrows, autoderef, closure captures, and drop order.`,
        `The schema also has to choose the right level of detail. Too little detail collapses shared and mutable references into a vague "reference" label and teaches the wrong model. Too much internal compiler detail can overwhelm learners and make benchmark artifacts brittle. The useful middle layer names the semantic facts that affect the verdict while hiding compiler implementation noise that is not needed for the lesson.`,
        `There are performance and storage costs if traces are collected at scale. A corpus for repair agents may contain many candidate programs, compiler runs, source spans, MIR-derived facts, and before/after patches. The payoff is that the data becomes much more useful: it can distinguish a principled repair from a coincidental edit.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Ownership traces win in compiler education. They let a learner see why moving a line changes a lifetime, why a borrow of one field may be allowed while a borrow of the whole struct is not, and why a value can be unavailable after a move. The explanation becomes a state transition, not an incantation.`,
        `They also win in automated repair and benchmark analysis. If an agent proposes a patch for a borrow-checker error, the evaluation can ask what changed in the ledger. Did the patch shorten a region, remove a conflicting access, add an intentional clone, use ownership transfer, or hide the problem behind unsafe code? That makes the benchmark more honest than checking whether the final compiler command returned success.`,
        `The broader win is methodological. A code model should trace the state that matters in the domain. Rust needs ownership and loans. A memory-model topic needs happens-before edges. A database transaction topic needs locks, versions, and commit timestamps. A financial contract topic needs obligations and lifecycle events. The right trace schema is part of the problem.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The trace fails if it treats Rust as Python with stricter syntax. Values alone are not enough. A trace that says x is a String and r is a reference does not explain whether x was moved, whether r is shared or mutable, whether the reference is still live, or whether a later write conflicts. Ownership is semantic state, not a display decoration.`,
        `It also fails if it ignores difficult cases. Interior mutability changes where checks happen by moving some aliasing rules to runtime types such as RefCell. Unsafe code can create obligations the borrow checker does not verify directly. Reborrows can temporarily lend through an existing mutable reference. Deref coercions can make the accessed place less obvious. Destructors can observe order and ownership. A useful educational trace can simplify, but it must say what it is simplifying.`,
        `Finally, it fails if it stops at "the compiler rejected this." The point is to expose the path to the verdict. A learner should be able to see the active loans, the requested access, the relevant region endpoints, and the rule that produced allow or reject.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources include The Rust Book chapters on ownership and references, the Rust Reference sections on borrow expressions and places, and the rustc dev guide material on MIR and borrow checking. Read them with the trace fields in mind: place, owner state, move, loan kind, region, access, drop, and verdict.`,
        `Study Code World Models Case Study, Execution Trace State Diff Case Study, JVM Happens-Before Execution Trace, Financial Contract Lifecycle Event Model, Static Single Assignment & Phi Nodes, Abstract Interpretation Interval Domain, Hazard Pointers & Epoch Reclamation, WebAssembly Linear Memory Case Study, and Software Supply Chain Provenance Graph next. The follow-up exercise is to take one borrow-checker diagnostic and rewrite it as a ledger: before state, requested access, active conflicts, and after state if repaired.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for rust-borrow-checker-ownership-trace-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
