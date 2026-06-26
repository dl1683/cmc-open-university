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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the checkpoint-state view as the write path for a long-running agent. A checkpoint is a durable record of execution state at a known boundary. Active nodes show the state being captured; found nodes show the resume point that becomes safe after the checkpoint commit.',
        'Read the replay-forks view as a branch history. Replay means re-execute from an old state. Fork means copy an old state, edit it, and continue on a new branch. The safe inference is that replay and fork must be separate operations because they mean different things for human approvals and side effects.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The fundamental gap: a short LLM call is stateless, but a long-running agent builds state across dozens of graph nodes over minutes. If the worker dies mid-run, the agent must resume from a known-good checkpoint — not guess what happened by re-reading the conversation. This is the same problem databases solve with write-ahead logs, adapted for non-deterministic model calls and human-in-the-loop interrupts.'},
        'A short model call is stateless: request in, response out. A long-running agent is different. It calls tools, waits for approvals, stores intermediate decisions, spends budget, and may run across several worker processes.',
        'A checkpoint replay ledger exists because process memory can disappear while the user-visible run must continue. The ledger records graph state, event history, side-effect identities, pending interrupts, and the next node to run. Without it, a crashed agent has to infer execution state from conversation text, which is not a recovery contract.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is transcript replay. Persist the messages, restart the model with the same conversation, and ask it to continue. For a pure chat assistant, this is often enough.',
        'Transcript replay is attractive because it uses data the product already has. It preserves user wording and the visible conversation. It fails when the agent has committed external work that must not be repeated.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the side-effect boundary. A message transcript does not prove whether a refund API call reached the processor, whether a human approval was scoped to a later fork, or which graph reducer state was current. Reconstructing those facts from prose is guesswork.',
        'Non-determinism makes the wall higher. A model call replayed after a crash can produce different output because model versions, prompts, randomness, tools, or retrieved context changed. Checkpoint replay stores the state directly instead of relying on re-creating the computation that produced it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate execution state from conversation history. Execution state is the machine-readable record needed to resume: thread id, checkpoint id, parent id, channel values, pending nodes, interrupt queue, reducer versions, model metadata, budget, and trace span ids. Conversation history is only one input to that state.',
        'The ledger is append-only. Each committed step writes state plus events: node start, model output, tool result, approval decision, error, idempotency key, and cost. Parent ids turn checkpoints into a history, and forks create new children without mutating the old path.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The runtime loop has four phases: load, execute, record, commit. Load reads the latest checkpoint for a thread. Execute runs the selected node. Record builds events and idempotency records. Commit atomically writes the new checkpoint and its events.',
        'If the process dies before commit, the runtime restarts from the previous checkpoint and re-executes the node. If it dies after commit, the runtime loads the new checkpoint and moves forward. This gives a clean boundary between work that may need replay and work that is already durable.',
        'External side effects need idempotency keys. An idempotency key is a stable identifier that lets a system recognize a retry of the same action. On resume, a committed key means reuse the recorded result; a pending key means query the external system; a missing key means the side effect has not started.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The recovery invariant is that after every committed step, checkpoint plus events describe exactly one runtime state. A crash destroys process memory, but it cannot destroy the last committed boundary. The scheduler always knows what node is pending next.',
        'The idempotency invariant is that replay never assumes side effects are safe to repeat. The ledger records destination, payload hash, key, and status for external actions. That is why the same resume can skip a committed refund but retry a pure computation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Checkpoint frequency controls behavior. Checkpoint every node and recovery work is low, but writes are frequent. Checkpoint only at the end and writes are cheap, but a crash redoes the whole run. Most agent systems checkpoint at side-effect boundaries, approval pauses, expensive tool calls, and long waits.',
        'Suppose an agent has 60 nodes, each node takes 10 seconds, and a checkpoint write takes 100 milliseconds. Checkpointing every node adds 6 seconds of write overhead but loses at most 10 seconds after a crash. Checkpointing every 10 nodes adds 0.6 seconds of write overhead but can lose almost 100 seconds of work.',
        'Storage grows with runs and events. A 2 KB checkpoint plus 4 KB of events per node costs about 360 KB for a 60-node run. At one million such runs, the raw ledger is hundreds of gigabytes, so compaction, retention, and redaction become product requirements.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Coding agents use checkpoints before applying patches, after running tests, and before risky filesystem operations. A replay can return to the pre-patch state and try a different fix without losing the original failure evidence. A fork can compare two repair paths under the same starting state.',
        'Support agents use checkpoints around refunds, cancellations, approvals, and customer messages. Research agents use them around long retrieval and synthesis runs. Human-in-the-loop workflows need them because approval state is part of execution, not just part of the transcript.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams confuse long-term memory with checkpoints. A store of user preferences can help future tasks, but it does not say which node is pending or which side effect already committed. Checkpoint state and cross-thread memory need separate lifecycles.',
        'It also fails when idempotency is added after the external call. A crash between the call and the idempotency write leaves no record, so resume can duplicate the action. The key must be part of the side-effect boundary, not a cleanup step.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A refund agent has four nodes: classify, lookup order, approve, execute refund. Classify costs 2 seconds, lookup costs 4 seconds, approval waits for a human, and execute calls the payment processor. At checkpoint 3, the state says order 4821, amount 47 USD, eligible true, pending interrupt approval.',
        'The worker crashes while waiting. On restart, the runtime loads checkpoint 3, sees the approval interrupt, and waits instead of re-running classify and lookup. The human approves, checkpoint 4 records approval granted, execute writes idempotency key refund-4821-execute before calling the processor, and checkpoint 5 records committed status.',
        'If another crash happens after the processor accepts the refund but before the final user message, resume loads checkpoint 5. The ledger says refund-4821-execute is committed, so the agent does not issue a second refund. It only resumes the next pending node: notify the user.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study LangGraph persistence at https://langchain-ai.github.io/langgraph/concepts/persistence/, LangGraph time travel at https://langchain-ai.github.io/langgraph/concepts/time-travel/, Temporal workflow execution at https://docs.temporal.io/workflow-execution, and Temporal plus OpenAI Agents SDK integration at https://temporal.io/blog/announcing-openai-agents-sdk-integration. Next study Agent Workflow DAG Compiler, Human Approval Interrupt Queue, Agent Run Trace Span Tree, and Idempotency and Exactly-Once Delivery.',
      ],
    },
  ],
};
