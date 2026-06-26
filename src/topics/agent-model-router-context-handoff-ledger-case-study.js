// Agent model routing and context handoff: route each step to the right
// model or specialist without losing provenance, permissions, or state.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-model-router-context-handoff-ledger-case-study',
  title: 'Agent Model Router & Context Handoff Ledger',
  category: 'AI & ML',
  summary: 'A production agent case study: capability matrices, route scoring, context capsules, handoff schemas, trace spans, and failure audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['route matrix', 'context handoff', 'failure audit'], defaultValue: 'route matrix' },
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

function routerGraph(title) {
  return graphState({
    nodes: [
      { id: 'ask', label: 'ask', x: 0.7, y: 3.6, note: 'goal' },
      { id: 'router', label: 'router', x: 2.4, y: 3.6, note: 'classify' },
      { id: 'caps', label: 'caps', x: 4.1, y: 1.5, note: 'skills' },
      { id: 'policy', label: 'policy', x: 4.1, y: 3.6, note: 'rules' },
      { id: 'budget', label: 'budget', x: 4.1, y: 5.6, note: 'cost' },
      { id: 'small', label: 'small', x: 6.1, y: 1.4, note: 'cheap' },
      { id: 'large', label: 'deep', x: 6.1, y: 3.6, note: 'hard' },
      { id: 'expert', label: 'expert', x: 6.1, y: 5.7, note: 'domain' },
      { id: 'tools', label: 'tools', x: 7.7, y: 2.2, note: 'MCP/API' },
      { id: 'handoff', label: 'handoff', x: 7.7, y: 4.8, note: 'schema' },
      { id: 'judge', label: 'judge', x: 8.9, y: 3.6, note: 'check' },
      { id: 'ledger', label: 'ledger', x: 9.6, y: 1.3, note: 'trace' },
    ],
    edges: [
      { id: 'e-ask-router', from: 'ask', to: 'router' },
      { id: 'e-router-caps', from: 'router', to: 'caps' },
      { id: 'e-router-policy', from: 'router', to: 'policy' },
      { id: 'e-router-budget', from: 'router', to: 'budget' },
      { id: 'e-caps-small', from: 'caps', to: 'small' },
      { id: 'e-caps-large', from: 'caps', to: 'large' },
      { id: 'e-policy-expert', from: 'policy', to: 'expert' },
      { id: 'e-budget-small', from: 'budget', to: 'small' },
      { id: 'e-small-tools', from: 'small', to: 'tools' },
      { id: 'e-large-tools', from: 'large', to: 'tools' },
      { id: 'e-expert-handoff', from: 'expert', to: 'handoff' },
      { id: 'e-tools-handoff', from: 'tools', to: 'handoff' },
      { id: 'e-handoff-judge', from: 'handoff', to: 'judge' },
      { id: 'e-judge-router', from: 'judge', to: 'router' },
      { id: 'e-judge-ledger', from: 'judge', to: 'ledger' },
    ],
  }, { title });
}

function handoffGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.6, y: 3.5, note: 'intent' },
      { id: 'trace', label: 'trace', x: 2.0, y: 1.2, note: 'events' },
      { id: 'facts', label: 'facts', x: 2.0, y: 3.5, note: 'claims' },
      { id: 'tools', label: 'tools', x: 2.0, y: 5.7, note: 'state' },
      { id: 'pack', label: 'capsule', x: 3.9, y: 3.5, note: 'handoff' },
      { id: 'from', label: 'agent A', x: 5.4, y: 1.9, note: 'owner' },
      { id: 'to', label: 'agent B', x: 5.4, y: 5.1, note: 'next' },
      { id: 'schema', label: 'schema', x: 7.0, y: 3.5, note: 'fields' },
      { id: 'auth', label: 'auth', x: 8.4, y: 1.6, note: 'scope' },
      { id: 'eval', label: 'eval', x: 8.4, y: 5.3, note: 'loss?' },
      { id: 'audit', label: 'audit', x: 9.4, y: 3.5, note: 'proof' },
    ],
    edges: [
      { id: 'e-task-pack', from: 'task', to: 'pack' },
      { id: 'e-trace-pack', from: 'trace', to: 'pack' },
      { id: 'e-facts-pack', from: 'facts', to: 'pack' },
      { id: 'e-tools-pack', from: 'tools', to: 'pack' },
      { id: 'e-from-pack', from: 'from', to: 'pack' },
      { id: 'e-pack-schema', from: 'pack', to: 'schema' },
      { id: 'e-schema-to', from: 'schema', to: 'to' },
      { id: 'e-schema-auth', from: 'schema', to: 'auth' },
      { id: 'e-to-eval', from: 'to', to: 'eval' },
      { id: 'e-auth-audit', from: 'auth', to: 'audit' },
      { id: 'e-eval-audit', from: 'eval', to: 'audit' },
      { id: 'e-audit-trace', from: 'audit', to: 'trace' },
    ],
  }, { title });
}

function* routeMatrix() {
  yield {
    state: routerGraph('A router is a control plane for agent work'),
    highlight: { active: ['ask', 'router', 'caps', 'policy', 'budget', 'e-ask-router', 'e-router-caps', 'e-router-policy', 'e-router-budget'], compare: ['small', 'large', 'expert'] },
    explanation: 'The router should not be a vibe check. It reads task type, capability requirements, policy constraints, budget, context size, and tool needs before choosing a model or specialist.',
  };

  yield {
    state: labelMatrix(
      'Capability table',
      [
        { id: 'lookup', label: 'lookup' },
        { id: 'code', label: 'code' },
        { id: 'legal', label: 'legal' },
        { id: 'draft', label: 'draft' },
        { id: 'judge', label: 'judge' },
        { id: 'final', label: 'final' },
      ],
      [
        { id: 'cheap', label: 'cheap' },
        { id: 'deep', label: 'deep' },
        { id: 'tools', label: 'tools' },
        { id: 'ctx', label: 'ctx' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['yes', 'no', 'search', 'small', 'low'],
        ['no', 'yes', 'exec', 'med', 'med'],
        ['no', 'yes', 'files', 'large', 'high'],
        ['yes', 'maybe', 'none', 'med', 'low'],
        ['maybe', 'yes', 'rubric', 'small', 'med'],
        ['no', 'yes', 'cite', 'med', 'high'],
      ],
    ),
    highlight: { active: ['lookup:cheap', 'draft:cheap', 'code:deep', 'legal:deep', 'final:risk'], found: ['judge:tools'] },
    explanation: 'A capability table is the simple data structure behind model routing. It maps each work class to model strength, tool access, context needs, and risk so the route decision can be inspected later.',
    invariant: 'Route choice must be explainable from stored inputs.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'task risk', min: 0, max: 10 }, y: { label: 'route score', min: 0, max: 10 } },
      series: [
        { id: 'cheap', label: 'cheap', points: [{ x: 0, y: 8.8 }, { x: 2, y: 8.2 }, { x: 4, y: 6.2 }, { x: 6, y: 3.6 }, { x: 10, y: 1.4 }] },
        { id: 'deep', label: 'deep', points: [{ x: 0, y: 4.1 }, { x: 2, y: 5.6 }, { x: 4, y: 7.2 }, { x: 6, y: 8.4 }, { x: 10, y: 9.1 }] },
        { id: 'hybrid', label: 'hybrid', points: [{ x: 0, y: 6.5 }, { x: 2, y: 7.2 }, { x: 4, y: 8.3 }, { x: 6, y: 8.1 }, { x: 10, y: 7.2 }] },
      ],
      markers: [
        { id: 'cut', x: 4.2, y: 8.0, label: 'route cut' },
      ],
    }),
    highlight: { active: ['hybrid', 'cut'], compare: ['cheap', 'deep'] },
    explanation: 'Routing is a tradeoff curve. Cheap models win common low-risk work, stronger models win high-risk synthesis, and hybrid routes can use small models for setup while preserving escalation for hard steps.',
  };

  yield {
    state: routerGraph('Tools and policy can override raw model choice'),
    highlight: { active: ['policy', 'expert', 'tools', 'handoff', 'e-policy-expert', 'e-expert-handoff', 'e-tools-handoff'], compare: ['small', 'large'], found: ['ledger'] },
    explanation: 'The best model is not always the right owner. A task that needs private files, shell access, payment authority, or legal scope should route through tool permissions and domain policy before capability scoring.',
  };

  yield {
    state: labelMatrix(
      'Route record fields',
      [
        { id: 'class', label: 'kind' },
        { id: 'inputs', label: 'in' },
        { id: 'score', label: 'score' },
        { id: 'choice', label: 'pick' },
        { id: 'gate', label: 'gate' },
        { id: 'span', label: 'span' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['type', 'slice'],
        ['r/c', 'replay'],
        ['scores', 'drift'],
        ['owner', 'spend'],
        ['policy', 'block'],
        ['trace', 'join'],
      ],
    ),
    highlight: { active: ['class:stores', 'inputs:stores', 'score:stores', 'choice:stores', 'span:stores'], found: ['gate:why'] },
    explanation: 'The route ledger is the audit trail. It stores why a request moved to a smaller model, stronger model, specialist agent, human reviewer, or deterministic workflow.',
  };
}

function* contextHandoff() {
  yield {
    state: handoffGraph('A handoff is a typed context transfer'),
    highlight: { active: ['task', 'trace', 'facts', 'tools', 'pack', 'e-task-pack', 'e-trace-pack', 'e-facts-pack', 'e-tools-pack'], compare: ['from', 'to'] },
    explanation: 'Switching models or agents is only safe if the next owner receives the right state. The handoff capsule should include task intent, unresolved decisions, evidence pointers, tool state, permissions, and stop criteria.',
  };

  yield {
    state: labelMatrix(
      'Context capsule schema',
      [
        { id: 'goal', label: 'goal' },
        { id: 'state', label: 'state' },
        { id: 'facts', label: 'facts' },
        { id: 'tools', label: 'tools' },
        { id: 'limits', label: 'limits' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'check', label: 'check' },
      ],
      [
        ['intent', 'same task'],
        ['progress', 'no reset'],
        ['claim ids', 'cite proof'],
        ['handles', 'scope ok'],
        ['budget', 'no overrun'],
        ['stop test', 'clear end'],
      ],
    ),
    highlight: { active: ['goal:field', 'state:field', 'facts:field', 'tools:field'], found: ['limits:check', 'done:check'] },
    explanation: 'A capsule is deliberately smaller than the transcript. It carries the decision-critical state and pointers back to the trace so the receiver can continue without inheriting every stale token.',
    invariant: 'Never replace provenance with a summary alone.',
  };

  yield {
    state: handoffGraph('The sender, receiver, and schema all matter'),
    highlight: { active: ['from', 'pack', 'schema', 'to', 'e-from-pack', 'e-pack-schema', 'e-schema-to'], compare: ['auth', 'eval'] },
    explanation: 'OpenAI Agents SDK handoffs are represented as tools, and handoff inputs can be schema controlled. That is the key systems lesson: delegation should be a typed operation, not an implicit transcript continuation.',
  };

  yield {
    state: handoffGraph('Authorization travels with the handoff'),
    highlight: { active: ['schema', 'auth', 'audit', 'e-schema-auth', 'e-auth-audit'], compare: ['tools'], removed: ['e-schema-to'] },
    explanation: 'The receiver should not inherit every capability the sender had. Tool scope, data roots, user identity, approvals, and redaction policy need to be recalculated or attenuated at the boundary.',
  };

  yield {
    state: handoffGraph('Evaluation checks for context loss'),
    highlight: { active: ['to', 'eval', 'audit', 'trace', 'e-to-eval', 'e-eval-audit', 'e-audit-trace'], found: ['facts'], compare: ['pack'] },
    explanation: 'After the handoff, an evaluator can test whether the new owner preserved constraints, citations, budget, and pending decisions. Failing that check should reopen the capsule or return to the router.',
  };
}

function* failureAudit() {
  yield {
    state: labelMatrix(
      'Handoff failure audit',
      [
        { id: 'cite', label: 'cite' },
        { id: 'state', label: 'state' },
        { id: 'scope', label: 'scope' },
        { id: 'tool', label: 'tool' },
        { id: 'cap', label: 'cap' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'gate', label: 'gate' },
        { id: 'record', label: 'record' },
      ],
      [
        ['no src', 'cite', 'claim'],
        ['repeat', 'diff', 'capsule'],
        ['leak', 'auth', 'scope'],
        ['no tool', 'tool ck', 'map'],
        ['stop', 'quota', 'budget'],
        ['weak', 'slice', 'scores'],
      ],
    ),
    highlight: { active: ['cite:gate', 'state:gate', 'scope:gate', 'route:gate'], compare: ['cap:signal', 'tool:signal'] },
    explanation: 'Most router bugs are ordinary state bugs: the route lost a citation, dropped a constraint, leaked authority, picked a model without a needed tool, hit a cap, or sent hard work to the wrong owner.',
  };

  yield {
    state: routerGraph('A failing route should create a repair loop'),
    highlight: { active: ['judge', 'router', 'ledger', 'e-judge-router', 'e-judge-ledger'], compare: ['small', 'large', 'expert'], found: ['policy'] },
    explanation: 'When evaluation fails, the system should not simply apologize. It should write the failure to the ledger, update the route signal, and either escalate, repack context, ask for human review, or stop.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'handoffs', min: 0, max: 8 }, y: { label: 'failure risk', min: 0, max: 1 } },
      series: [
        { id: 'loose', label: 'loose', points: [{ x: 0, y: 0.05 }, { x: 1, y: 0.13 }, { x: 2, y: 0.24 }, { x: 4, y: 0.48 }, { x: 8, y: 0.86 }] },
        { id: 'typed', label: 'typed', points: [{ x: 0, y: 0.04 }, { x: 1, y: 0.08 }, { x: 2, y: 0.12 }, { x: 4, y: 0.2 }, { x: 8, y: 0.36 }] },
      ],
      markers: [
        { id: 'review', x: 4.5, y: 0.28, label: 'review' },
      ],
    }),
    highlight: { active: ['typed', 'review'], compare: ['loose'] },
    explanation: 'Every handoff adds coordination risk. Typed capsules, trace links, and handoff-specific evals flatten the risk curve by making each transfer checkable.',
  };

  yield {
    state: labelMatrix(
      'Rollout controls',
      [
        { id: 'shadow', label: 'shadow' },
        { id: 'canary', label: 'canary' },
        { id: 'slice', label: 'slice' },
        { id: 'human', label: 'human' },
        { id: 'kill', label: 'kill' },
      ],
      [
        { id: 'what', label: 'what' },
        { id: 'metric', label: 'metric' },
      ],
      [
        ['log only', 'route diff'],
        ['small pct', 'accept rate'],
        ['risky set', 'fail rate'],
        ['review', 'overturns'],
        ['disable', 'spend cap'],
      ],
    ),
    highlight: { active: ['shadow:what', 'canary:metric', 'slice:metric', 'kill:what'], found: ['human:metric'] },
    explanation: 'A router is production infrastructure. New routing rules should ship behind shadow mode, canaries, slice metrics, human-review samples, and a kill switch that can disable expensive or unsafe paths.',
  };

  yield {
    state: handoffGraph('Durable execution makes handoffs restartable'),
    highlight: { active: ['trace', 'pack', 'schema', 'audit', 'e-trace-pack', 'e-pack-schema', 'e-audit-trace'], compare: ['from', 'to'] },
    explanation: 'Durable workflow history and trace spans let the system resume after crashes, explain why a model was chosen, and verify which capsule crossed the boundary. Without that history, the product depends on one fragile conversation state.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'route matrix') yield* routeMatrix();
  else if (view === 'context handoff') yield* contextHandoff();
  else if (view === 'failure audit') yield* failureAudit();
  else throw new InputError('Pick an agent model router view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Osi_model_7_layers.png/400px-Osi_model_7_layers.png', alt:'OSI seven-layer network model showing how protocols route data through abstraction layers', caption:'The OSI model routes data through protocol layers — each layer with its own contract and handoff. An agent model router does the same for intelligence: it decides which model, agent, or human owns the next step, what context crosses the boundary, and what evaluator checks the result. Source: Wikimedia Commons, Public domain'},
        {type:'callout', text:'An agent model router is not a cost optimizer. In production it is a control plane: it decides which context crosses model boundaries, which tools are available, which permissions are attenuated, which evaluator runs afterward, and which trace proves the route was justified. Routing is a correctness gate, not a billing feature.'},
        'Read the route-matrix view as a control plane. A router is the component that chooses which model, specialist agent, workflow, tool set, or human reviewer owns the next step. Active nodes show the signals used for that choice: capability, policy, budget, tool access, context size, and risk.',
        'Read the handoff view as a typed state transfer. A context capsule is a compact record of goal, progress, evidence, permissions, budget, and stop condition. The safe inference is that switching owners is not safe unless the receiving owner gets enough state and not too much authority.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Agent products rarely have one best model for every step. A cheap model may classify intent well, a stronger model may synthesize risky conclusions, a code agent may need shell access, and a human may need to approve an external action. Routing exists because different steps need different owners.',
        'The hard part is continuity. If the system switches from one model or agent to another, it can lose citations, permissions, unresolved questions, tool handles, or budget state. The router and handoff ledger make the switch inspectable instead of relying on a long transcript.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send everything to the strongest model. That is simple and often works on small volumes. It reduces routing errors because there is no route decision to make.',
        'The other obvious approach is cost routing: send short easy tasks to a cheap model and long hard tasks to an expensive model. That saves money, but it still treats routing mostly as billing. Production routing also has to consider tools, permissions, evidence, policy, latency, and required evaluation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is state loss at the boundary. A model can answer poorly because the router stripped the evidence it needed, because the handoff summary dropped an unresolved constraint, or because the receiving agent did not inherit the required tool permission. The failure looks like weak reasoning, but the root cause is a bad transfer.',
        'The second wall is over-authority. A receiver should not inherit every tool or data root the sender had. Tool scope, user identity, redaction policy, and approval state must be recalculated or attenuated when work crosses the boundary.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Routing is a logged control-plane decision. The route record should store task class, required capabilities, context size, risk score, budget, policy gates, tool requirements, chosen owner, fallback reason, evaluator, and trace id. If the answer fails, the team can inspect the decision instead of guessing.',
        'Handoff is a schema, not a summary. The capsule carries decision-critical state and pointers back to raw evidence. It should be small enough for the receiver to use and structured enough for an evaluator to detect context loss.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A request first enters a classifier. The classifier estimates task type, difficulty, risk, required tools, context size, external side effects, and whether the result is user-visible or compliance-sensitive. The router scores candidate owners against those features.',
        'A low-risk lookup can route to a small model with search. A code repair can route to a sandboxed coding agent with tests. A legal or financial conclusion can route to a stronger model plus source ledger and human review. A final answer may require a judge even if earlier steps used cheaper workers.',
        'When the owner changes, the system builds a capsule. It includes task intent, current state, evidence ids, tool handles, authorization scope, budget remaining, unresolved decisions, and stop criteria. The trace stores what crossed the boundary and why.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is that each route can be explained from stored inputs. If a task needed shell access and the chosen owner had shell access, that part of the route is justified. If the task was high risk and the route attached a judge or human reviewer, the gate is visible.',
        'Typed capsules work because they preserve continuity without pretending a summary is evidence. The receiver can follow evidence ids back to sources, respect narrowed permissions, and continue from a known stop condition. That prevents a multi-agent workflow from becoming a chain of fresh starts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost is behavior, not only model price. A cheap model that drops a citation can force a stronger retry, a human review, or a customer-support escalation. A stronger model used everywhere can waste budget on routine steps and hide which slices actually need it.',
        'Suppose 10,000 daily requests split into 7,000 lookups, 2,000 coding tasks, and 1,000 high-risk summaries. Sending all work to a 10-cent model costs $1,000 per day. Routing lookups to a 1-cent model, coding to a 6-cent agent path, and high-risk summaries to the 10-cent model costs $70 + $120 + $100, or $290 per day, before evaluator cost.',
        'The complexity cost is measurement. The router needs capability tables, route rules, policy gates, trace spans, shadow mode, canaries, and slice metrics. Without those controls, it can silently drift toward cheap wrong answers or expensive unnecessary escalation.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Deep research workspaces use routing to split source discovery, long-document extraction, calculation, synthesis, and final review. Coding agents use it to decide when to use search, shell execution, static analysis, a repair loop, or human approval. Customer-support agents use it to route low-risk questions, refund decisions, and escalations differently.',
        'The pattern is strongest where tasks have mixed risk and mixed tool needs. It is weaker when every request is short, low-risk, and uses the same data source. In that case, a router may add more moving parts than value.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the route rule is hidden prompt magic. If scores, policies, versions, and fallback reasons are not logged, the team cannot debug bad routing. The product will only show that the answer was bad, not whether the wrong owner or wrong context caused it.',
        'It also fails when the capsule replaces provenance. A coherent handoff summary can omit the source that justified a claim. The receiver must get evidence pointers, not just prose that sounds like evidence.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A user uploads a 70-page filing and asks for a market-risk memo with a reproduced chart. The router classifies the task as high context, source-heavy, calculation-required, and externally visible. It routes extraction to a document specialist, chart reproduction to a sandboxed code agent, synthesis to a stronger reasoning model, and final review to a judge with citation checks.',
        'The capsule to the synthesis model contains 18 extracted claims, 12 source ids, 2 unresolved contradictions, the chart artifact path, a $2 remaining budget, and a stop condition: every market claim must cite a source id. The final judge rejects the first answer because 3 claims lack source ids. The ledger shows the failure is a missing-citation handoff issue, not a general model failure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Anthropic Building Effective Agents at https://www.anthropic.com/engineering/building-effective-agents, OpenAI Agents SDK overview at https://developers.openai.com/api/docs/guides/agents, OpenAI handoffs at https://openai.github.io/openai-agents-python/handoffs/, OpenAI tracing at https://openai.github.io/openai-agents-python/tracing/, LangGraph persistence at https://docs.langchain.com/oss/python/langgraph/persistence, and Temporal durable execution at https://docs.temporal.io/temporal. Next study Agent Workflow DAG Compiler, Agent Memory and Context Engineering, Distributed Tracing, LLM Judge Calibration, Prompt Injection Threat Model, and Zanzibar Authorization.',
      ],
    },
  ],
};
