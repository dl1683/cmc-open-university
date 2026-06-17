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
      heading: 'Why this exists',
      paragraphs: [
        "Long-running agents don't behave like a single request. They call tools, wait for people, spend budget over minutes or hours, and may be interrupted by deploys, crashes, rate limits, or user edits. A durable runtime needs a way to continue the same run without guessing what already happened.",
        "The reasonable first attempt is to keep a transcript and rerun the agent from the beginning. That works for a short chat. It breaks when the run contains side effects: a refund submitted twice, a ticket updated twice, a browser action repeated under changed page state, or a human approval reused after the facts changed.",
        "The checkpoint replay ledger exists because the runtime state is not the same thing as the conversation text. It records the graph state, event history, pending node, side-effect decisions, model and tool versions, budgets, stores, and trace ids needed to resume or inspect the run.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "A transcript cannot tell the scheduler which node is safe to run next. It doesn't preserve reducer state, pending interrupts, idempotency keys, cached tool results, model settings, or whether an external API call already committed. Reconstructing those fields from text is a best-effort parser, not a recovery mechanism.",
        "The wall is semantic replay. Pure code can run again. A model call may return a different answer. A tool call may be expensive. A side effect may be irreversible. A human approval may have been correct only for the branch that produced it. The ledger has to classify those cases before it resumes.",
      ],
    },
    {
      heading: 'Core state model',
      paragraphs: [
        "The core record is a thread-scoped checkpoint. It stores a thread id, checkpoint id, parent checkpoint id, graph values, current node, next node set, pending interrupts, reducer versions, model and prompt versions, tool-call ids, budget used, and trace span.",
        "The event history stores the facts that make replay safe: node starts and finishes, model outputs, tool results, external request ids, idempotency keys, approval decisions, errors, retries, and compensation actions. Long-term memory lives in a separate store. A user preference or learned fact can outlive a thread; a checkpoint is the execution boundary for one thread.",
        "Forks add lineage. Replay resumes from an old checkpoint under the same state. A fork writes a new child checkpoint after editing state. Keeping those operations separate prevents a debugging branch from rewriting the original run.",
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "Before a node runs, the runtime loads the latest committed checkpoint for the thread. The node reads graph values, calls models or tools, emits events, and proposes a state update. The checkpoint write commits the new state and the event facts together, or the runtime treats the node as incomplete.",
        "External side effects need a ledger entry before they run. The entry carries an idempotency key, destination, payload hash, and replay rule. On resume, the runtime can reuse the recorded result, query the external system, call a compensating action, or stop for a human decision.",
        "Time travel uses the same machinery. Replaying from a checkpoint re-executes later nodes. Forking first writes an edited state at that checkpoint, then resumes from the fork. Interrupts should usually re-trigger because the human is approving the branch in front of them, not a different branch from yesterday.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The reliability argument is an invariant: after every committed step, the checkpoint plus event history describes exactly one recoverable runtime state. A crash can delete process memory, but it cannot delete the last committed boundary.",
        "Idempotency is the second invariant. The ledger never assumes an effect is safe to repeat just because the node is being replayed. It records enough identity to distinguish a retry from a new action. That is what turns replay from duplicate work into controlled recovery.",
        "Append-only history also makes debugging honest. A failed branch remains visible with its inputs, decisions, and costs. A later fork can improve the run without pretending the original path never happened.",
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        "Checkpointing trades runtime work for storage and write latency. Checkpoint after every token and persistence dominates. Checkpoint only at the end and a crash can lose tool outputs, approvals, and expensive model calls. Practical runtimes checkpoint at side-effect boundaries, human waits, handoffs, expensive tool calls, and bounded intervals in long loops.",
        "Event histories grow. Temporal-style systems need history limits and continue-as-new patterns because unbounded replay becomes its own outage. Agent ledgers need the same pressure relief: compact old state, summarize safe history, and keep raw private payloads out of general-purpose traces.",
        "Reproducibility is conditional. A checkpoint can pin model, prompt, provider, temperature, and tool versions. If those are not pinned, replay is a new execution from an old state, not proof that the old result will reappear.",
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        "A support agent can pause at a refund approval, survive a worker restart, and resume at the same pending decision. A research agent can fork before source selection and compare two evidence paths. A coding agent can checkpoint before applying a patch, keep the failed test trace, and repair from the same state instead of starting over.",
        "A concrete run might look like this: checkpoint 41 stores the user request and selected policy. Checkpoint 42 records a tool lookup. Checkpoint 43 pauses for approval. The worker crashes. On restart, the runtime loads checkpoint 43, sees a pending human interrupt, and waits for a resume command instead of issuing another lookup or submitting the refund.",
        "The same ledger improves evaluation. A team can replay a historical run with a new prompt, compare checkpoints, and see whether the upgrade changed the state path, tool choices, cost, or only the final wording.",
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "The common mistake is treating memory as a checkpoint. Long-term facts help the agent answer future requests. They do not tell the runtime which node is pending, which side effects have committed, or which approval scope is valid.",
        "Other failures are quieter: unversioned prompts, tool results stored only in logs, forks that reuse stale human approvals, idempotency keys generated after the external call, and checkpoints that include private payloads nobody meant to retain.",
        "A ledger can also create false confidence. If the trace records a bad policy decision with perfect fidelity, replay will preserve the mistake. Durable execution makes failures inspectable and recoverable; it does not make the agent correct.",
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        "Commit checkpoint state and event facts in one transaction or one atomic write path. If the node result is durable but the event is missing, replay cannot explain why the state changed. If the event is durable but the state is missing, resume may repeat work that already affected the outside world.",
        "Create the idempotency record before calling an external service, not after. Store payload hashes, provider request ids, replay rules, and compensation options. Version graph schemas, reducers, prompts, and tool contracts so old checkpoints can be migrated or rejected deliberately instead of failing halfway through resume.",
        "Test by killing the worker at every boundary: before a model call, after a model call, before a tool call, after an external commit, during a human interrupt, and after a fork. A ledger that has not survived forced crashes is still a design sketch.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LangGraph persistence at https://docs.langchain.com/oss/python/langgraph/persistence, LangGraph time travel at https://docs.langchain.com/oss/python/langgraph/use-time-travel, Temporal event history at https://docs.temporal.io/workflow-execution/event, Temporal workflow execution at https://docs.temporal.io/workflow-execution, and Temporal OpenAI Agents SDK integration at https://temporal.io/blog/announcing-openai-agents-sdk-integration.',
        'Study Agent Workflow DAG Compiler Case Study for graph structure, Human Approval Interrupt Queue Case Study for pause and resume boundaries, Agent Run Trace Span Tree Case Study for observability, Temporal Workflow Case Study for durable execution, Idempotency & Exactly-Once Delivery for side effects, and Distributed Tracing for cross-service debugging.',
      ],
    },
  ],
};
