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
        'The "checkpoint state" view traces the write path from an incoming thread through node execution, state capture, event logging, checkpoint commit, store persistence, resume decision, and trace emission. Active (green) items are the current phase of the checkpoint lifecycle. Found (blue) marks the resume point that becomes reachable once the checkpoint commits.',
        'The "replay forks" view shows how a historical checkpoint can branch into two operations: replay (same state, re-execute) or fork (edited state, new branch). Active items are the branching decision; compare (orange) marks the outcome diff that determines which branch to keep.',
        {
          type: 'note',
          text: 'The matrix frames use a label encoding where each cell is a short descriptor. "has" columns show what the checkpoint stores; "risk" columns show the failure mode if that field is lost or stale. The plot frame shows the tradeoff between checkpoint frequency and recovery cost.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A short LLM call is stateless: request in, response out, nothing to recover. A long-running agent is not. It calls tools over minutes, waits for human approvals, accumulates budget, and builds state across dozens of graph nodes. If the worker dies mid-run, the agent must resume from a known-good boundary -- not guess what happened by re-reading the conversation.',
        {
          type: 'quote',
          text: 'The fundamental difference between a workflow and a function call is that a workflow can be interrupted at any point and resumed later, possibly on a different machine.',
          attribution: 'Temporal documentation, "What is a Workflow Execution?"',
        },
        'This is an old problem in distributed systems. Temporal solves it for deterministic workflows with event sourcing. Database systems solve it with write-ahead logs. Agent runtimes solve it with checkpoint replay ledgers -- a hybrid that must handle non-deterministic model calls, expensive tool invocations, human-in-the-loop interrupts, and mutable graph state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is transcript replay: persist the full message history and re-feed it to the model on restart. This is what most chat applications already do, and it requires zero new infrastructure. The model receives the same context window and, in theory, picks up where it left off.',
        'Transcript replay works for conversational agents that have no side effects. A chatbot that crashed mid-generation can re-prompt with the same messages and get a usable continuation.',
        {
          type: 'table',
          headers: ['Scenario', 'Transcript replay', 'Checkpoint replay'],
          rows: [
            ['Stateless chat', 'Works', 'Unnecessary overhead'],
            ['Tool call already committed (e.g., refund issued)', 'Re-issues the refund', 'Sees idempotency record, skips'],
            ['Human approval consumed', 'Silently reuses stale decision', 'Re-triggers interrupt for current state'],
            ['Model version changed between crash and restart', 'Different generation, no record', 'Pins version; flags mismatch'],
            ['Budget tracking', 'Lost; restarts from zero', 'Restored from checkpoint'],
            ['10-minute multi-tool run', 'Replays all tool calls from scratch', 'Resumes from last committed node'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Transcript replay fails at the side-effect boundary. A message log does not record which tool calls committed externally, which human approvals are scoped to a specific branch, which reducer state the graph held, or which node the scheduler should execute next. Reconstructing those fields from conversation text is a parser heuristic, not a recovery contract.',
        {
          type: 'bullets',
          items: [
            'A refund API returns 200 on the first call and 409-duplicate on the second. Without an idempotency record, the runtime cannot distinguish "already done" from "failed."',
            'A human approved a $50 refund at checkpoint 12. The agent forked at checkpoint 10 and now proposes a $200 refund. Transcript replay silently reuses the $50 approval.',
            'The model was upgraded between crash and restart. Transcript replay produces a different continuation with no record that the reasoning diverged.',
            'An agent loop ran 40 iterations spending $3.20 in API calls. Transcript replay re-runs all 40, doubling cost and latency.',
          ],
        },
        'The wall is not performance. It is semantic safety. The question is not "can we regenerate an answer" but "can we distinguish work already committed from work that still needs to happen."',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate execution state from conversation history. A checkpoint is a serialized snapshot of the graph at a committed boundary: thread id, checkpoint id, parent checkpoint id, channel values, pending node set, interrupt queue, reducer versions, and budget consumed. An event record is the append-only log of facts that justify the state: node starts, model outputs, tool results, idempotency keys, approval decisions, and errors.',
        {
          type: 'diagram',
          label: 'Checkpoint record structure',
          text: 'checkpoint\n  |-- thread_id          (which conversation)\n  |-- checkpoint_id      (content-addressed or monotonic)\n  |-- parent_id          (forms a linked list; forks create branches)\n  |-- channel_values     (graph state: messages, tool results, scratchpad)\n  |-- pending_nodes      (what the scheduler should run next)\n  |-- pending_interrupts (human-in-the-loop queue)\n  |-- metadata\n  |     |-- reducer_versions\n  |     |-- model_version\n  |     |-- prompt_hash\n  |     |-- budget_used\n  |     +-- trace_span_id\n  +-- events[]           (append-only facts for this step)',
        },
        {
          type: 'note',
          text: 'LangGraph draws a deliberate line between checkpointers and stores. A checkpointer persists thread-scoped execution state (the graph at a point in time). A store persists cross-thread application memory (user preferences, learned facts, extracted entities). A user preference can outlive any single thread. A checkpoint is the execution boundary for exactly one thread.',
        },
        'Forks extend the checkpoint chain. Replay loads an old checkpoint and re-executes subsequent nodes with the same state. A fork copies the old checkpoint, edits the state, writes a new child checkpoint, and resumes from there. The parent chain is never mutated, so the original run remains inspectable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The runtime loop has four phases per node: load, execute, record, commit.',
        {
          type: 'code',
          language: 'python',
          text: '# Simplified LangGraph-style checkpoint loop\ncheckpoint = store.get_latest(thread_id)\nwhile checkpoint.pending_nodes:\n    node = scheduler.pick(checkpoint.pending_nodes)\n    # LOAD: read graph state from checkpoint\n    state = checkpoint.channel_values\n    # EXECUTE: run the node (model call, tool call, or code)\n    result, events = node.execute(state)\n    # RECORD: build idempotency entries for side effects\n    for effect in result.side_effects:\n        events.append(IdempotencyRecord(\n            key=effect.key,\n            destination=effect.target,\n            payload_hash=hash(effect.payload),\n            status="committed"\n        ))\n    # COMMIT: atomically write new checkpoint + events\n    checkpoint = store.commit(\n        parent_id=checkpoint.id,\n        channel_values=reducer.apply(state, result),\n        pending_nodes=scheduler.next(node, result),\n        events=events\n    )',
        },
        'The commit is the durable boundary. If the process dies before commit, the runtime restarts from the previous checkpoint and re-executes the node. If the process dies after commit, the runtime loads the new checkpoint and moves to the next node. No intermediate state is observable.',
        'External side effects need special handling. The idempotency record must be created before the external call, not after. On resume, the runtime checks the record:',
        {
          type: 'table',
          headers: ['Record status', 'Resume action', 'Rationale'],
          rows: [
            ['committed', 'Skip; use recorded result', 'Effect already reached the external system'],
            ['pending', 'Query external system for outcome', 'Call may or may not have arrived'],
            ['failed', 'Retry or escalate', 'External system rejected; safe to retry'],
            ['not found', 'Execute normally', 'Node has not attempted this effect yet'],
          ],
        },
        'Time travel reuses the same machinery. To replay from checkpoint N, the runtime loads checkpoint N and re-executes nodes N+1, N+2, and so on. To fork, it first writes checkpoint N-prime as a child of N with edited channel values, then resumes from N-prime. Interrupt nodes re-trigger during time travel because the human must approve the branch they are actually looking at, not a decision from a different execution path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two invariants.',
        {
          type: 'bullets',
          items: [
            'Recovery invariant: after every committed step, the checkpoint plus its event history describes exactly one recoverable runtime state. A crash destroys process memory but cannot destroy the last committed boundary. The runtime always has a well-defined place to resume.',
            'Idempotency invariant: the ledger never assumes a side effect is safe to repeat because the node is being replayed. It records enough identity (key, payload hash, destination, status) to distinguish a retry of committed work from a genuinely new action.',
          ],
        },
        'Together these invariants turn replay from "run everything again and hope" into controlled recovery. The first guarantees a resume point exists. The second guarantees that resuming does not duplicate external effects.',
        'Append-only history adds a third property: auditability. A failed branch remains visible with its inputs, decisions, costs, and errors. A later fork improves the run without erasing evidence that the original path existed. This matters for compliance, debugging, and evaluation.',
        {
          type: 'note',
          text: 'Temporal achieves the same properties for deterministic code through event sourcing: the workflow replays its own history and determinism guarantees identical state. Agent runtimes cannot rely on determinism because model calls are non-deterministic. The checkpoint approach sidesteps this by snapshotting state directly rather than replaying the computation that produced it.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Checkpoint frequency', 'Storage cost', 'Recovery cost', 'When to use'],
          rows: [
            ['Every node', 'High (one write per step)', 'Minimal (resume from last node)', 'Short graphs, expensive nodes, side-effect-heavy flows'],
            ['Side-effect boundaries only', 'Medium', 'Replays pure nodes between boundaries', 'Most production agents'],
            ['Human interrupts only', 'Low', 'Replays all tool/model calls since last interrupt', 'Approval-gated workflows with cheap tools'],
            ['End of run only', 'Minimal', 'Full replay on any crash', 'Only acceptable for idempotent, cheap runs'],
          ],
        },
        'Event histories grow without bound unless the runtime compacts them. Temporal uses a continue-as-new pattern: when history exceeds a threshold (default 50,000 events or 50 MB), the workflow starts a fresh execution carrying forward only the current state. Agent ledgers need the same pressure relief. Without it, checkpoint load time grows linearly with run length, and a 10,000-step agent run becomes its own availability risk.',
        'Reproducibility is conditional. A checkpoint can pin model version, prompt hash, temperature, provider, and tool contract versions. If those are not pinned, replaying from an old checkpoint produces a new execution from old state -- useful for evaluation, but not proof that the original result will reappear.',
        {
          type: 'code',
          language: 'python',
          text: '# Versioning metadata stored per checkpoint\nmetadata = {\n    "model": "gpt-4o-2024-08-06",\n    "prompt_hash": "sha256:a1b2c3...",\n    "temperature": 0.0,\n    "tool_versions": {\n        "search_api": "v3",\n        "refund_api": "v2.1"\n    },\n    "reducer_schema": "v4",\n    "budget_used_usd": 0.42\n}',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support agent processes a refund request. The graph has four nodes: classify, lookup, approve, execute.',
        {
          type: 'table',
          headers: ['Step', 'Node', 'Checkpoint state (key fields)', 'Events recorded'],
          rows: [
            ['1', 'classify', 'intent=refund, policy=standard, pending=[lookup]', 'model_output: intent classification'],
            ['2', 'lookup', 'order=#4821, amount=$47, eligible=true, pending=[approve]', 'tool_result: order API response, idempotency_key: lookup-4821'],
            ['3', 'approve', 'approval=pending, pending=[approve] (interrupt)', 'interrupt: human_approval_requested'],
            ['--', 'CRASH', 'Worker dies. Process memory lost.', '--'],
            ['4', 'resume', 'Loads checkpoint 3. Sees pending interrupt. Waits.', 'resume: loaded checkpoint 3, pending_interrupt=approve'],
            ['5', 'approve', 'approval=granted, pending=[execute]', 'human_input: approved by agent@support'],
            ['6', 'execute', 'refund_status=submitted, pending=[]', 'idempotency: refund-4821-execute, status=committed'],
          ],
        },
        'If the worker crashes again after step 6, the runtime loads checkpoint 6, sees an empty pending set, and terminates cleanly. The idempotency record for refund-4821-execute prevents a second refund submission even if a retry reaches the execute node.',
        {
          type: 'note',
          text: 'The lookup at step 2 also carries an idempotency key. If the crash had happened between the API call and the checkpoint commit, the runtime would query the order API with the same key on resume. A 409-duplicate response confirms the lookup already succeeded; the runtime reuses the cached result instead of treating it as a failure.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'Checkpoint mechanism', 'Key design choice'],
          rows: [
            ['LangGraph', 'Checkpointer interface (Postgres, SQLite, in-memory)', 'Separates checkpointers (thread state) from stores (cross-thread memory)'],
            ['Temporal', 'Event sourcing with deterministic replay', 'Relies on workflow determinism; non-deterministic calls must be wrapped as activities'],
            ['Inngest', 'Step-level memoization', 'Each step function call is cached; replay skips completed steps'],
            ['CrewAI', 'Task-level state persistence', 'Checkpoints between crew tasks, not within a single agent node'],
            ['Restate', 'Journal-based durable execution', 'Journals record side effects; replay consults the journal before re-executing'],
          ],
        },
        'A coding agent checkpoints before applying a patch. If tests fail, the trace shows exactly which state the patch was applied to, which test output was produced, and what the graph values were. The agent can fork from the pre-patch checkpoint with an edited fix strategy instead of starting the entire run over.',
        'The same ledger enables A/B evaluation. Replay a historical run with a new prompt version, checkpoint at the same boundaries, and diff the state paths. The comparison shows whether the upgrade changed tool selections, cost, intermediate reasoning, or only the final output wording.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Confusing memory with checkpoints. A store of user preferences helps the agent answer future requests. It does not tell the runtime which node is pending, which side effects committed, or which approval scope is valid. These are different persistence concerns with different lifecycles.',
            'Idempotency keys generated after the external call. If the key is created post-call, a crash between the call and the key write leaves no record. Resume re-executes the call with no deduplication.',
            'Unversioned prompts. A checkpoint pins graph state but not the prompt template that produced it. If the prompt changes between crash and restart, the resumed node generates output under a different instruction set with no record of the mismatch.',
            'Forks reusing stale human approvals. A fork from checkpoint 10 should not silently carry forward an approval granted at checkpoint 12 under different state. Interrupt nodes must re-trigger on forked branches.',
            'Checkpoints that include private payloads. PII, credentials, or raw API responses serialized into checkpoint state may violate retention policies. Checkpoint schemas should separate opaque references from sensitive content.',
          ],
        },
        'A subtler failure: a ledger can create false confidence. If the trace records a bad policy decision with perfect fidelity, replay preserves the mistake. Durable execution makes failures inspectable and recoverable. It does not make the agent correct.',
        {
          type: 'quote',
          text: 'Durability is not correctness. A perfectly checkpointed run that chose the wrong tool at step 3 will reliably resume and complete the wrong action at step 4.',
          attribution: 'Common pitfall in durable agent design',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'LangGraph persistence documentation: https://langchain-ai.github.io/langgraph/concepts/persistence/ -- covers checkpointers, stores, the checkpoint tuple structure, and the distinction between thread-scoped and cross-thread state.',
            'LangGraph time travel documentation: https://langchain-ai.github.io/langgraph/concepts/time-travel/ -- explains replay vs. fork, interrupt re-triggering during time travel, and the update_state API for forking.',
            'Temporal workflow execution model: https://docs.temporal.io/workflow-execution -- event history, deterministic replay, continue-as-new, and the activity/side-effect boundary that agent checkpointing generalizes.',
            'Temporal + OpenAI Agents SDK integration: https://temporal.io/blog/announcing-openai-agents-sdk-integration -- production example of wrapping non-deterministic agent calls in durable execution primitives.',
          ],
        },
        'Prerequisite: study Agent Workflow DAG Compiler Case Study for graph execution structure. The checkpoint ledger assumes a node-based execution graph; understanding the DAG compiler clarifies what "pending node" and "reducer" mean in checkpoint context.',
        'Extensions: Human Approval Interrupt Queue Case Study covers the interrupt mechanism that checkpoints must preserve. Agent Run Trace Span Tree Case Study covers the observability layer that consumes checkpoint events. Idempotency and Exactly-Once Delivery covers the side-effect safety model that checkpoint replay depends on.',
        'Contrast: Temporal Workflow Case Study uses deterministic replay (re-execute the same code, get the same result). Agent checkpoint replay uses state snapshots (skip the code, restore the result) because model calls are inherently non-deterministic. The tradeoff is storage cost vs. determinism requirements.',
      ],
    },
  ],
};

