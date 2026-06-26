// Execution traces as data structures: line-level state diffs, aliases,
// checkpoints, and compression rules for world-model training data.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'execution-trace-state-diff-case-study',
  title: 'Execution Trace State Diff Case Study',
  category: 'AI & ML',
  summary: 'A code-world-model primer on recording before/action/after state diffs instead of storing code transcripts as loose text.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['state diff log', 'trace compression'], defaultValue: 'state diff log' },
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

function traceGraph(title) {
  return graphState({
    nodes: [
      { id: 'code', label: 'code', x: 0.8, y: 3.4, note: 'source' },
      { id: 'line', label: 'line', x: 2.2, y: 3.4, note: 'pc' },
      { id: 'frame', label: 'frame', x: 3.7, y: 2.0, note: 'locals' },
      { id: 'stack', label: 'stack', x: 3.7, y: 4.8, note: 'calls' },
      { id: 'heap', label: 'heap', x: 5.3, y: 2.0, note: 'objects' },
      { id: 'alias', label: 'alias', x: 5.3, y: 4.8, note: 'refs' },
      { id: 'except', label: 'except', x: 6.9, y: 1.4, note: 'edge' },
      { id: 'return', label: 'return', x: 6.9, y: 5.4, note: 'value' },
      { id: 'ledger', label: 'trace log', x: 8.6, y: 3.4, note: 'append' },
    ],
    edges: [
      { id: 'e-code-line', from: 'code', to: 'line' },
      { id: 'e-line-frame', from: 'line', to: 'frame' },
      { id: 'e-line-stack', from: 'line', to: 'stack' },
      { id: 'e-frame-heap', from: 'frame', to: 'heap' },
      { id: 'e-frame-alias', from: 'frame', to: 'alias' },
      { id: 'e-line-except', from: 'line', to: 'except' },
      { id: 'e-line-return', from: 'line', to: 'return' },
      { id: 'e-heap-ledger', from: 'heap', to: 'ledger' },
      { id: 'e-alias-ledger', from: 'alias', to: 'ledger' },
      { id: 'e-except-ledger', from: 'except', to: 'ledger' },
      { id: 'e-return-ledger', from: 'return', to: 'ledger' },
    ],
  }, { title });
}

function compressionGraph(title) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'raw trace', x: 0.8, y: 3.4, note: 'events' },
      { id: 'norm', label: 'normalize', x: 2.2, y: 3.4, note: 'schema' },
      { id: 'diff', label: 'delta', x: 3.7, y: 2.0, note: 'changes' },
      { id: 'hash', label: 'hash', x: 3.7, y: 4.8, note: 'identity' },
      { id: 'chk', label: 'checkpoint', x: 5.3, y: 2.0, note: 'replay' },
      { id: 'sem', label: 'semantic', x: 5.3, y: 4.8, note: 'notes' },
      { id: 'sample', label: 'sample', x: 6.9, y: 3.4, note: 'budget' },
      { id: 'verify', label: 'verify', x: 8.3, y: 3.4, note: 'oracle' },
      { id: 'train', label: 'train set', x: 9.5, y: 3.4, note: 'clean' },
    ],
    edges: [
      { id: 'e-raw-norm', from: 'raw', to: 'norm' },
      { id: 'e-norm-diff', from: 'norm', to: 'diff' },
      { id: 'e-norm-hash', from: 'norm', to: 'hash' },
      { id: 'e-diff-chk', from: 'diff', to: 'chk' },
      { id: 'e-hash-sem', from: 'hash', to: 'sem' },
      { id: 'e-chk-sample', from: 'chk', to: 'sample' },
      { id: 'e-sem-sample', from: 'sem', to: 'sample' },
      { id: 'e-sample-verify', from: 'sample', to: 'verify' },
      { id: 'e-verify-train', from: 'verify', to: 'train' },
    ],
  }, { title });
}

function* stateDiffLog() {
  yield {
    state: traceGraph('An execution trace is a typed state-diff log'),
    highlight: { active: ['code', 'line', 'frame', 'stack', 'heap', 'ledger', 'e-code-line', 'e-line-frame', 'e-line-stack', 'e-frame-heap', 'e-heap-ledger'], compare: ['except', 'return'] },
    explanation: 'A useful execution trace is not a transcript of lines that ran. It is a sequence of program-counter events plus the state each event changed: stack frames, locals, heap objects, alias edges, exceptions, returns, and timestamps written into a replayable log.',
  };

  yield {
    state: labelMatrix(
      'Before/action/after state diffs',
      [
        { id: 'l1', label: 'line 1' },
        { id: 'l2', label: 'line 2' },
        { id: 'l3', label: 'line 3' },
        { id: 'l4', label: 'line 4' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'action', label: 'action' },
        { id: 'after', label: 'after' },
      ],
      [
        ['{}', 'bind xs', 'xs=[]'],
        ['xs=[]', 'append', 'xs=[1]'],
        ['xs=[1]', 'alias ys', 'ys->xs'],
        ['ys->xs', 'append', 'xs=[1,2]'],
      ],
    ),
    highlight: { active: ['l2:action', 'l2:after', 'l4:action', 'l4:after'], found: ['l3:after'] },
    explanation: 'The row key is the source location. The columns are the minimal semantic transition. Aliasing is a first-class transition because a later mutation through ys changes the same object that xs names.',
    invariant: 'The trace has to name object identity, not only variable text.',
  };

  yield {
    state: traceGraph('Aliases and heap object ids make mutation visible'),
    highlight: { active: ['frame', 'heap', 'alias', 'ledger', 'e-frame-heap', 'e-frame-alias', 'e-alias-ledger'], compare: ['return'] },
    explanation: 'A locals-only trace says xs changed and ys changed, but it cannot explain why. Object ids and alias edges show that both names point at the same heap object, so one append is enough to change what both variables later observe.',
  };

  yield {
    state: labelMatrix(
      'Control-flow events also mutate trace state',
      [
        { id: 'call', label: 'call' },
        { id: 'loop', label: 'loop' },
        { id: 'raise', label: 'raise' },
        { id: 'catch', label: 'catch' },
        { id: 'ret', label: 'return' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['enter', 'new frame', 'pc id'],
        ['iterate', 'index', 'edge'],
        ['throw', 'exc obj', 'type'],
        ['handle', 'stack pop', 'target'],
        ['emit', 'value', 'caller'],
      ],
    ),
    highlight: { active: ['raise:event', 'raise:state', 'catch:state'], found: ['ret:proof'] },
    explanation: 'A line trace that ignores exceptions, loop edges, and returns is incomplete. Control flow changes the active frame and the next program counter, so it belongs in the same state-diff ledger.',
  };

  yield {
    state: traceGraph('The trace ledger joins local semantics to training data'),
    highlight: { active: ['ledger', 'return', 'except', 'heap', 'alias', 'e-return-ledger', 'e-except-ledger', 'e-heap-ledger', 'e-alias-ledger'], found: ['code'] },
    explanation: 'Code World Model style data works because the learner sees the machine state, not just the answer. The ledger turns execution into supervised examples: predict the next state, explain a failure, or verify that a repair changes the expected path.',
  };
}

function* traceCompression() {
  yield {
    state: plotState({
      axes: { x: { label: 'trace events', min: 0, max: 1000 }, y: { label: 'stored units', min: 0, max: 1000 } },
      series: [
        { id: 'full', label: 'full snapshots', points: [{ x: 50, y: 50 }, { x: 200, y: 200 }, { x: 500, y: 500 }, { x: 1000, y: 1000 }] },
        { id: 'delta', label: 'state deltas', points: [{ x: 50, y: 20 }, { x: 200, y: 62 }, { x: 500, y: 145 }, { x: 1000, y: 270 }] },
        { id: 'check', label: 'deltas + checks', points: [{ x: 50, y: 28 }, { x: 200, y: 84 }, { x: 500, y: 205 }, { x: 1000, y: 395 }] },
      ],
      markers: [
        { id: 'knee', x: 500, y: 205, label: 'replay knee' },
      ],
    }),
    highlight: { active: ['delta', 'check', 'knee'], compare: ['full'] },
    explanation: 'Full snapshots are easy to train on but expensive. Deltas are compact but need periodic checkpoints so replay and verification do not require reconstructing thousands of tiny events from the beginning.',
  };

  yield {
    state: labelMatrix(
      'Compression choices',
      [
        { id: 'snap', label: 'snapshot' },
        { id: 'delta', label: 'delta' },
        { id: 'chk', label: 'checkpoint' },
        { id: 'sem', label: 'semantic' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'replay', label: 'replay' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['all state', 'cheap', 'large'],
        ['changes', 'scan', 'lost ctx'],
        ['anchor', 'bounded', 'stale'],
        ['why note', 'helpful', 'biased'],
      ],
    ),
    highlight: { active: ['delta:stores', 'chk:replay', 'sem:stores'], compare: ['snap:risk'] },
    explanation: 'A trace store usually mixes representations. Deltas carry most events, checkpoints bound replay cost, and semantic annotations explain why a change matters without replacing the ground-truth state transition.',
    invariant: 'Compression is safe only when the verifier can reconstruct the same state.',
  };

  yield {
    state: compressionGraph('A safe trace compressor keeps replay and proof paths'),
    highlight: { active: ['raw', 'norm', 'diff', 'chk', 'verify', 'train', 'e-raw-norm', 'e-norm-diff', 'e-diff-chk', 'e-sample-verify', 'e-verify-train'], found: ['hash'] },
    explanation: 'The compressor should normalize event schemas, compute deltas, keep content hashes, insert checkpoints, sample within budget, and then verify that the compressed trace still replays to the same observable result. Compression is allowed to remove bytes, not facts needed for proof.',
  };

  yield {
    state: labelMatrix(
      'Fields that are dangerous to drop',
      [
        { id: 'alias', label: 'alias' },
        { id: 'except', label: 'exception' },
        { id: 'io', label: 'IO' },
        { id: 'time', label: 'time' },
        { id: 'seed', label: 'seed' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'keep', label: 'keep as' },
      ],
      [
        ['mutation', 'object id'],
        ['branch', 'edge'],
        ['side effect', 'event'],
        ['race', 'clock'],
        ['replay', 'metadata'],
      ],
    ),
    highlight: { active: ['alias:keep', 'except:keep', 'seed:keep'], removed: ['time:why'] },
    explanation: 'Dropping high-entropy fields can look harmless in aggregate metrics while corrupting the examples that matter most: aliasing bugs, exception paths, IO side effects, timing-sensitive code, and seeded randomness.',
  };

  yield {
    state: compressionGraph('Neural summaries need symbolic guardrails'),
    highlight: { active: ['sem', 'verify', 'train', 'e-sem-sample', 'e-sample-verify', 'e-verify-train'], compare: ['diff', 'chk'], found: ['raw'] },
    explanation: 'A neural model can summarize or skip uninteresting trace spans, but a symbolic verifier still has to prove the compressed form preserves the important state. That hybrid line is the real design pattern behind execution-grounded training.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'state diff log') yield* stateDiffLog();
  else if (view === 'trace compression') yield* traceCompression();
  else throw new InputError('Pick an execution-trace view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each frame as before, action, and after. Before is the local variables, stack frame, heap object identities, and program counter before one operation. Action is the executed step, and after is the smallest state change that step caused.',
        'Object ids are the important visual detail. If xs and ys point to heap object 17, a mutation through ys must change what xs later sees. The safe inference rule is that a trace explains a later value only when the alias edge and the mutation both appear.',
        {type:'callout', text:'A useful code trace records before/action/after state with object identity, so runtime behavior can be replayed instead of merely described.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A model can read code text and still miss what the code does at runtime. Mutation, aliases, exceptions, loop edges, returns, and IO are state changes, not just words in a file. An execution trace state diff records those changes one step at a time.',
        'This matters for teaching and for code-world-model data. A transcript that says line 8 ran is weak when the lesson is that a shared list changed through another name. A state diff can show the causal edge that a value-only log hides.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to print variable values after each line. That is enough for straight-line arithmetic because the reader can infer the missing state. It is also easy to store and easy to display.',
        'The next approach is a line-by-line transcript with comments. That helps a human, but it still confuses location with semantics. A program can visit the same line many times and produce different state because the heap, stack, or control-flow edge changed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears with aliases and nonlocal control flow. If xs and ys reference the same list, printing only values can make the later return look surprising. If an exception jumps to a handler, a plain line list hides why the next program counter changed.',
        'The wall also appears with scale. Full snapshots after every step are simple, but a 10,000-step trace with 1 MB snapshots would store about 10 GB. Delta records and checkpoints are needed so the trace remains inspectable and replayable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The stable unit is a state transition, not a visited line. A transition names the program counter, stack frame, relevant heap ids, pre-state, operation, post-state, and proof context. Later state should be reconstructible from earlier state plus the recorded operation.',
        'The trace is a semantic ledger for execution. It records the facts needed to replay behavior before adding prose summaries or model-facing compression. That order matters because a summary can be useful only if the underlying state change is still checkable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A basic event stores the source location, operation kind, frame id, locals, heap object ids, aliases, control-flow edge, exception or return value, and before/action/after diff. Names point to object ids rather than independent copies of values. A mutation changes the object, and all aliases see that same object later.',
        'The event log also records control flow. Calls create frames, returns transfer values to callers, loops update the next program counter, and exceptions move through handlers. Periodic checkpoints bound replay time, while deltas keep storage smaller than full snapshots.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local reconstruction. For each event, a verifier starts from the before-state, applies the recorded operation semantics, and checks that it obtains the after-state. If every event checks and control-flow edges connect, the whole trace replays.',
        'The alias invariant is the key. Every name that refers to the same mutable object must carry the same heap id until an assignment changes that reference. That invariant lets the trace explain value changes that a print log makes mysterious.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full snapshots cost O(steps times state size). Delta traces cost closer to O(changed state) per step, plus checkpoint storage. If a 10,000-step run changes 2 KB per step and checkpoints 1 MB every 500 steps, the trace is about 40 MB instead of 10 GB.',
        'The engineering cost is runtime-specific modeling. Python, Rust, JVM, GPU kernels, databases, and distributed workflows expose different state. A good format must name what it does not model, because IO, clocks, seeds, shared memory, and network events can break replay.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'State-diff traces are useful for debugger education, model training on next-state prediction, repair debugging, verified agent trajectory stores, and interpreters that need explainable execution. They teach mutation and control flow better than plain code text. They also give a verifier something concrete to replay.',
        'They are especially useful in curricula that move from arithmetic to heap mutation, function frames, exceptions, generators, IO, and concurrency. Each added feature can be taught as one more kind of state transition. The learner sees why a program changed, not only where it was.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the trace omits the state that caused the behavior. A trace without object identity cannot teach aliasing, and a trace without exception objects cannot teach handler flow. A trace without IO, seeds, or clock values may replay the toy example but fail on the real bug.',
        'It can also be too heavy for simple lessons. A short pure function may need only an expression tree and final value. The trace format should scale down to the concept being taught instead of forcing every topic to carry a full runtime dump.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a Python function that sets xs = [1], sets ys = xs, calls ys.append(2), and returns xs. A value transcript says xs is [1], append happened, return is [1, 2]. The missing fact is that xs and ys shared heap object 17.',
        'The state-diff trace records xs -> 17 and ys -> 17 before append. The append event changes object 17 from [1] to [1, 2]. The return event reads xs -> 17, so the returned value follows from the alias invariant instead of from a memorized pattern.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Code World Models, dynamic program tracing, Python interpreter semantics, write-ahead logs, distributed tracing, record-replay debugging, and debugger data models. Then study Verified Agent Trajectory Store, Dynamic Scratchpad Execution Trace Case Study, Abstract Agent Operation Graph, Rust Borrow Checker Ownership Trace, JVM Happens-Before Execution Trace, and Interpreter Dispatch Table and Threaded Code.',
        'The next exercise is to trace one aliasing example and one exception example. For each event, write the before-state, action, after-state, and the invariant that makes the transition checkable. If the trace cannot reconstruct the output, it is still a caption rather than evidence.',
      ],
    },
  ],
};