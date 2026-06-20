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
      heading: 'Why this exists',
      paragraphs: [
        'A model can read code text and still miss what the code does at runtime. Mutation, aliases, exceptions, loop edges, and returns are state changes, not just words in a file. An execution trace state diff records those changes one step at a time.',
        'Each event stores a source location, stack frame, locals, heap object ids, aliases, control-flow edge, exception or return value, and the before/action/after diff. This is the data-structure version of the Code World Models idea: teach models what code does by showing machine state transitions.',
        {type:'callout', text:'A useful code trace records before/action/after state with object identity, so runtime behavior can be replayed instead of merely described.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious teaching data is a transcript: show the code, print variable values after each line, and save the final answer. That is enough for straight-line arithmetic and short examples because the reader can infer the missing state.',
        'The wall appears with real programs. If xs and ys point to the same list, printing only variable values hides the alias. If an exception jumps to a handler, a line list hides the control-flow edge. If a loop repeats the same line, a transcript can show where the program was but not why the next state is different.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The trace must describe state transitions, not line visits. The stable unit is a before/action/after diff keyed by program counter and object identity. A later event should be explainable from the previous state plus the action that ran.',
        'The CWM paper reports mid-training on observation-action trajectories from Python interpreter and agentic Docker environments, with step-by-step Python execution simulation as a central research target: https://arxiv.org/abs/2510.02387. The local Code World Models Breakdown notes sharpen the same point: the value lies less in code text than in verified execution and verification factories.',
      ],
    },
    {
      heading: 'How to inspect a trace',
      paragraphs: [
        'Inspect a trace as a chain of state transitions. Each event should answer four questions: where was execution, what action ran, what state existed before, and what changed afterward. A line number alone is not enough. The trace must preserve frames, heap identity, aliases, control-flow edges, and exceptional exits.',
        'The best trace is replayable. Starting from a checkpoint, a verifier should be able to apply the recorded events and reconstruct later state. If the trace is only prose, it may be useful for a human explanation but weak as training data or as evidence for a model repair.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A basic trace event has a program counter, operation kind, pre-state, post-state, and proof context. Pre-state and post-state name object identity, not just printed values. If xs and ys both point to the same list, a mutation through ys updates the same heap object that xs later reads. Without alias information, the model sees a surprising value change with no causal edge.',
        'The same event log also records control flow. Function calls create frames, loops update the next program counter, exceptions move through handlers, and returns transfer values back to callers. That makes the trace close to a write-ahead log for program semantics: append the raw event first, derive summaries later, and keep enough information to replay the result.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local reconstruction. For each event, the verifier should be able to start from the before-state, apply the recorded action semantics, and obtain the after-state. If this holds for every event and the control-flow edges connect in order, the whole trace replays.',
        'Aliases are the main reason object identity matters. The invariant is that every name referring to the same mutable object must point to the same heap id. A mutation changes the object, not each variable separately. That invariant lets the trace explain changes that value-only logs make mysterious.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Full snapshots are simple but expensive. Delta traces are smaller but require periodic checkpoints so replay remains bounded. Semantic annotations can explain why a span matters, but they are not a substitute for state. A safe compressor keeps hashes, checkpoints, and verifier hooks so the compressed trace can be checked against the original execution.',
        'The important design line is symbolic plus neural. A symbolic interpreter can produce exact state. A neural model can learn summaries, skip boring spans, and inject semantic context. The production structure should let the neural side compress or predict while the symbolic side verifies reconstruction, especially around aliasing, exceptions, IO, and nondeterminism.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'State-diff traces win when the learning target is execution behavior: predicting the next state, explaining a wrong output, debugging a repair, or training a model to reason about mutation and control flow. They also give a trajectory store a verifiable input instead of a loose natural-language explanation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'This structure is heavy for simple examples and incomplete when the runtime state is not well defined. Python, Rust, JVM, GPU kernels, databases, and distributed workflows need different state models. A trace that omits IO, clocks, seeds, or shared memory can replay cleanly in the small example and still fail on the real bug.',
      ],
    },
    {
      heading: 'Evaluation signals',
      paragraphs: [
        'Evaluate a trace format by replay success, alias preservation, exception-path coverage, heap-object identity accuracy, checkpoint size, compression ratio, and whether a model trained on it improves next-state prediction rather than only final-answer prediction. The target is not a pretty transcript; it is a verified sequence of semantic changes.',
        'A strong corpus includes boring straight-line examples and hard cases: mutation through aliases, closures, recursion, exceptions, generators, IO, nondeterminism, and concurrency. The trace should make the hidden state visible enough that a learner can explain why the next value changed.',
      ],
    },
    {
      heading: 'Compression and curriculum',
      paragraphs: [
        'Trace compression should be staged. Early lessons can keep full state snapshots because the point is clarity. Larger corpora need deltas, checkpoints, hashes, and summary spans. The compression must never erase the very state transition the learner is supposed to understand. If aliasing is the lesson, object identity must survive. If exception control flow is the lesson, the thrown object and handler edge must survive.',
        'A good curriculum builds from small traces to real runtimes. Start with local variables and arithmetic. Add heap objects and aliases. Add function frames. Add exceptions. Add IO and nondeterminism. Add concurrency only after students can explain why single-threaded state changes are represented as before/action/after diffs.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'An execution trace state diff is a semantic ledger for code. It records before/action/after state, not just visited lines. That makes it useful for code world models, verified agent trajectories, repair debugging, and teaching mutation-heavy programs.',
        'The deep lesson is that code understanding needs runtime evidence. Source text says what might happen. A replayable trace says what did happen and why the state changed.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Take a Python function that creates a list, assigns a second variable to that same list, appends through the second variable, and returns the first. A text transcript says "append happened." A state-diff trace records xs -> object 17, ys -> object 17, object 17 changed from [1] to [1, 2], and return read object 17. That is the data needed for a model to learn mutation semantics rather than memorize a surface pattern.',
        'In a trajectory store, this trace becomes a training example, a debugging artifact, and a verifier input. The model can be asked to predict the next state, explain why an output changed, or decide whether a proposed patch changes the failing path. The same structure links naturally to Verified Agent Trajectory Store, Distributed Tracing, Write-Ahead Log, and Interpreter Dispatch Table & Threaded Code.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Do not store trace prose when the learner needs state. Do not drop alias edges, exception objects, IO events, seeds, or timing metadata just because they are rare. Do not train on traces that cannot be replayed.',
        'Primary sources: CWM at https://arxiv.org/abs/2510.02387 and the Meta research page at https://ai.meta.com/research/publications/cwm-an-open-weights-llm-for-research-on-code-generation-with-world-models/. Study Code World Models Case Study, Verified Agent Trajectory Store, Dynamic Scratchpad Execution Trace Case Study, Abstract Agent Operation Graph, Rust Borrow Checker Ownership Trace, JVM Happens-Before Execution Trace, Financial Contract Lifecycle Event Model, Double-Entry Payment Ledger Execution Trace, Distributed Tracing, Write-Ahead Log, Interpreter Dispatch Table & Threaded Code, Parser Design Patterns Primer, and Execution-as-a-Service Verifier Economy Case Study next.',
      ],
    },
  ],
};
