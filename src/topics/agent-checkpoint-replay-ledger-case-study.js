// Agent checkpoint replay ledger: persist graph state, event history, replay
// points, forks, and recovery decisions for long-running agent runs.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-checkpoint-replay-ledger-case-study',
  title: 'Agent Checkpoint Replay Ledger Case Study',
  category: 'AI & ML',
  summary: 'A durable-agent runtime case study: graph-state checkpoints, event histories, replay points, time-travel forks, stores, idempotent side effects, and resume policy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['checkpoint state', 'replay forks'], defaultValue: 'checkpoint state' },
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

function checkpointGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.7, y: 3.5, note: 'thread' },
      { id: 'node', label: 'node', x: 2.2, y: 3.5, note: 'step' },
      { id: 'state', label: 'state', x: 3.8, y: 2.0, note: 'graph' },
      { id: 'event', label: 'event', x: 3.8, y: 5.0, note: 'log' },
      { id: 'ckpt', label: 'ckpt', x: 5.4, y: 3.5, note: 'save' },
      { id: 'store', label: 'store', x: 6.9, y: 2.0, note: 'facts' },
      { id: 'resume', label: 'resume', x: 6.9, y: 5.0, note: 'next' },
      { id: 'run', label: 'run', x: 8.3, y: 3.5, note: 'continue' },
      { id: 'trace', label: 'trace', x: 9.5, y: 3.5, note: 'why' },
    ],
    edges: [
      { id: 'e-input-node', from: 'input', to: 'node' },
      { id: 'e-node-state', from: 'node', to: 'state' },
      { id: 'e-node-event', from: 'node', to: 'event' },
      { id: 'e-state-ckpt', from: 'state', to: 'ckpt' },
      { id: 'e-event-ckpt', from: 'event', to: 'ckpt' },
      { id: 'e-ckpt-store', from: 'ckpt', to: 'store' },
      { id: 'e-ckpt-resume', from: 'ckpt', to: 'resume' },
      { id: 'e-resume-run', from: 'resume', to: 'run' },
      { id: 'e-run-trace', from: 'run', to: 'trace' },
    ],
  }, { title });
}

function forkGraph(title) {
  return graphState({
    nodes: [
      { id: 'hist', label: 'hist', x: 0.8, y: 3.5, note: 'states' },
      { id: 'point', label: 'point', x: 2.2, y: 3.5, note: 'before node' },
      { id: 'replay', label: 'rpl', x: 3.8, y: 2.0, note: '=' },
      { id: 'fork', label: 'fork', x: 3.8, y: 5.0, note: 'edit' },
      { id: 'interrupt', label: 'pause', x: 5.4, y: 3.5, note: 'human' },
      { id: 'cmd', label: 'cmd', x: 6.9, y: 3.5, note: 'resume' },
      { id: 'compare', label: 'diff', x: 8.2, y: 3.5, note: 'outcome' },
      { id: 'merge', label: 'merge', x: 9.5, y: 3.5, note: 'keep' },
    ],
    edges: [
      { id: 'e-hist-point', from: 'hist', to: 'point' },
      { id: 'e-point-replay', from: 'point', to: 'replay' },
      { id: 'e-point-fork', from: 'point', to: 'fork' },
      { id: 'e-replay-interrupt', from: 'replay', to: 'interrupt' },
      { id: 'e-fork-interrupt', from: 'fork', to: 'interrupt' },
      { id: 'e-interrupt-cmd', from: 'interrupt', to: 'cmd' },
      { id: 'e-cmd-compare', from: 'cmd', to: 'compare' },
      { id: 'e-compare-merge', from: 'compare', to: 'merge' },
    ],
  }, { title });
}

function replayPlot() {
  return plotState({
    axes: {
      x: { label: 'checkpoint interval', min: 1, max: 20 },
      y: { label: 'recovery work', min: 0, max: 10 },
    },
    series: [
      { id: 'work', label: 'redo', points: [{ x: 1, y: 1.0 }, { x: 3, y: 2.0 }, { x: 6, y: 3.8 }, { x: 12, y: 6.6 }, { x: 17, y: 9.0 }] },
      { id: 'cost', label: 'write', points: [{ x: 1, y: 8.5 }, { x: 3, y: 5.0 }, { x: 6, y: 3.0 }, { x: 12, y: 1.8 }, { x: 17, y: 1.2 }] },
    ],
    markers: [
      { id: 'knee', x: 6, y: 3.8, label: 'balance' },
    ],
  });
}

function* checkpointState() {
  yield {
    state: checkpointGraph('A checkpoint is the run state boundary'),
    highlight: { active: ['input', 'node', 'state', 'event', 'ckpt', 'e-input-node', 'e-node-state', 'e-node-event', 'e-state-ckpt', 'e-event-ckpt'], found: ['resume'] },
    explanation: 'A durable agent run needs a persisted boundary after meaningful steps. The checkpoint stores graph state, next node, pending interrupts, tool-call ids, budget used, and enough event history to explain recovery.',
    invariant: 'The process can die; the run state must not.',
  };

  yield {
    state: labelMatrix(
      'Ckpt',
      [
        { id: 'thread', label: 'thread' },
        { id: 'node', label: 'node' },
        { id: 'state', label: 'state' },
        { id: 'events', label: 'events' },
        { id: 'store', label: 'mem' },
        { id: 'next', label: 'next' },
      ],
      [
        { id: 'has', label: 'has' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['id', 'mixup'],
        ['step id', 'lost pos'],
        ['graph vals', 'stale'],
        ['append log', 'bloat'],
        ['facts', 'privacy'],
        ['pending', 'double run'],
      ],
    ),
    highlight: { active: ['thread:has', 'node:has', 'state:has', 'next:has'], compare: ['events:risk'] },
    explanation: 'LangGraph separates checkpointers from stores: checkpointers persist thread-scoped graph state, while stores persist application-defined cross-thread memory. Agent systems need both, but they answer different questions.',
  };

  yield {
    state: replayPlot(),
    highlight: { active: ['work', 'knee'], compare: ['cost'] },
    explanation: 'Checkpoint too often and persistence overhead dominates. Checkpoint too rarely and crashes force expensive replay. The right interval follows side-effect boundaries, user-visible waits, approval points, and expensive tool calls.',
  };

  yield {
    state: checkpointGraph('Resume policy joins state and trace'),
    highlight: { active: ['ckpt', 'store', 'resume', 'run', 'trace', 'e-ckpt-store', 'e-ckpt-resume', 'e-resume-run', 'e-run-trace'], compare: ['event'] },
    explanation: 'A resume should know whether the next node is safe to replay, needs an idempotency key, waits for approval, or must call a compensating action. The trace records that decision.',
  };
}

function* replayForks() {
  yield {
    state: forkGraph('Replay and fork are different operations'),
    highlight: { active: ['hist', 'point', 'replay', 'fork', 'e-hist-point', 'e-point-replay', 'e-point-fork'], found: ['compare'] },
    explanation: 'Replay re-executes from a historical point with the same state. Forking edits the state at that point and explores an alternate branch. Time travel debugging is useful only when those two operations are explicit.',
  };

  yield {
    state: labelMatrix(
      'Replay',
      [
        { id: 'pure', label: 'pure' },
        { id: 'tool', label: 'tool' },
        { id: 'side', label: 'side fx' },
        { id: 'human', label: 'human' },
        { id: 'model', label: 'model' },
      ],
      [
        { id: 'replay', label: 'replay' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['yes', 'same input'],
        ['maybe', 'cache hit'],
        ['no', 'idempotent'],
        ['pause', 'ask again'],
        ['maybe', 'version pin'],
      ],
    ),
    highlight: { active: ['pure:replay', 'tool:rule', 'side:rule', 'human:replay'], compare: ['model:rule'] },
    explanation: 'Not every step is safe to replay blindly. Pure code can replay. Tool calls need cache or idempotency. Side effects need recorded results or compensation. Human interrupts usually re-trigger when replayed or forked.',
  };

  yield {
    state: forkGraph('Interrupts re-enter the human boundary'),
    highlight: { active: ['replay', 'fork', 'interrupt', 'cmd', 'e-replay-interrupt', 'e-fork-interrupt', 'e-interrupt-cmd'], compare: ['merge'] },
    explanation: 'LangGraph time travel docs note that interrupt nodes re-trigger during time travel. That is the right default: a forked state should not silently reuse a human decision made under different facts.',
  };

  yield {
    state: forkGraph('Forks need outcome diffs before merge'),
    highlight: { active: ['cmd', 'compare', 'merge', 'e-cmd-compare', 'e-compare-merge'], compare: ['point'] },
    explanation: 'A fork is useful only if the system can compare outcomes: value, cost, risk, citations, errors, and user-visible changes. The replay ledger should keep both branches until a merge or discard decision is recorded.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'checkpoint state') yield* checkpointState();
  else if (view === 'replay forks') yield* replayForks();
  else throw new InputError('Pick an agent checkpoint replay view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An agent checkpoint replay ledger is the durable state layer for long-running agent workflows. It records graph state, event history, pending nodes, model/tool outputs, approvals, stores, budgets, and trace ids so a run can resume after crash, pause, deployment, or human decision.',
        'Temporal Workflow Case Study explains event-history replay for durable execution. LangGraph persistence brings the same design pressure into agent graphs: checkpointers persist thread-scoped graph state, while stores persist long-term application memory across threads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each meaningful node writes a checkpoint: thread id, graph values, current node, next nodes, pending interrupts, model version, tool-call ids, budget used, and trace span. Tool results and side effects should be recorded as events so replay can avoid repeating expensive or irreversible work.',
        'The ledger also supports history inspection. Replay asks what would happen from an old checkpoint under the same state. Forking asks what would happen after editing that state. Those operations need clear lineage so a developer can compare branches without corrupting the original run.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Checkpointing is not free. Persist too often and every token or minor state change becomes storage overhead. Persist too rarely and recovery redoes expensive tool calls or loses user-visible progress. A practical system checkpoints after side effects, before human waits, after expensive tool calls, at handoff boundaries, and at bounded intervals for long loops.',
        'Replay also has semantic cost. Model outputs can change with version, temperature, provider, or prompt. A replay ledger should pin versions when reproducibility matters and mark best-effort replay when it does not.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'LangGraph persistence docs explain that checkpointers persist a thread graph state as checkpoints for conversation continuity, human-in-the-loop workflows, time travel, and fault tolerance, while stores persist cross-thread memory: https://docs.langchain.com/oss/python/langgraph/persistence. LangGraph time-travel docs show replay and fork behavior around interrupts: https://docs.langchain.com/oss/python/langgraph/use-time-travel.',
        'Temporal event history docs describe an append-only log durably persisted by the Temporal service for crash recovery and debugging, including limits and continue-as-new guidance: https://docs.temporal.io/workflow-execution/event. Temporal also announced an OpenAI Agents SDK integration that maps agent invocations into durable workflow activities: https://temporal.io/blog/announcing-openai-agents-sdk-integration.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A support agent can pause for a refund approval, survive a worker restart, and resume from the same pending tool call. A research agent can fork before a source-selection step and compare two evidence paths. A coding agent can checkpoint before running a patch and keep the failed execution trace for repair.',
        'The ledger also improves evaluation. You can replay a historical run under a new prompt, compare checkpoints, and see whether a model upgrade changed the state path or only the final wording.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse memory with checkpoints. Long-term user facts are not the same as runtime graph state. Do not replay side effects without idempotency keys or recorded results. Do not reuse human decisions across forks unless the facts and approval scope are still valid.',
        'Do not treat a transcript as a checkpoint. A transcript can help reconstruct state, but a durable runtime needs typed fields: next node, pending approvals, tool results, output contracts, and budget.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LangGraph persistence at https://docs.langchain.com/oss/python/langgraph/persistence, LangGraph time travel at https://docs.langchain.com/oss/python/langgraph/use-time-travel, Temporal event history at https://docs.temporal.io/workflow-execution/event, Temporal workflow execution at https://docs.temporal.io/workflow-execution, and Temporal OpenAI Agents integration at https://temporal.io/blog/announcing-openai-agents-sdk-integration. Study Agent Workflow DAG Compiler Case Study, Human Approval Interrupt Queue Case Study, Agent Run Trace Span Tree Case Study, Temporal Workflow Case Study, Idempotency & Exactly-Once Delivery, and Distributed Tracing next.',
      ],
    },
  ],
};
