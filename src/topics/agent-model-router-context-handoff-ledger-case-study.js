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
      heading: 'Why this exists',
      paragraphs: [
        'An agent model router is the control plane that decides which model, specialist agent, deterministic workflow, or human reviewer owns the next step. It is not only a cost optimizer. In a serious product it also decides which context crosses the boundary, which tools are available, which permissions are attenuated, which evaluator runs afterward, and which trace proves the route was justified.',
        'This fills the gap between Agentic AI Patterns and Multi-Agent Orchestration Topologies. The generic agent loop explains planning, tools, memory, and evaluation. The router answers a narrower production question: when a workflow can use small models, deep models, code agents, research agents, domain specialists, or normal service code, how does the system switch without losing task state?',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The visual is not showing a chat feature with extra steps. It is showing a control plane. In the route-matrix view, the important movement is from one undifferentiated user request into a scored decision: task class, capability fit, policy constraint, context size, tool need, budget, and evaluator. A good router makes those inputs explicit before it gives work to a small model, a deeper model, a tool-using agent, a domain specialist, or a human reviewer.',
        'In the context-handoff view, the key idea is that delegation is a state transition, not a summary paragraph. The receiving agent should get a capsule with task intent, current progress, evidence IDs, files or tool handles, remaining budget, permissions, unresolved questions, and the stop condition. The failure-audit view then asks whether the route was reversible and explainable. If the answer got worse, the ledger should show whether the problem was the wrong owner, missing context, stripped permissions, stale evidence, a weak evaluator, or an unsafe fallback.',
        'This matters because routing errors are often misdiagnosed as model errors. A small model may look weak because it received no evidence. A large model may look wasteful because the router sent it routine work. A specialist may hallucinate because the handoff removed source IDs. The ledger turns those failures into inspectable causes so the team can repair the route, not just rewrite the prompt.',
      ],
    },
    {
      heading: 'Core data structures',
      paragraphs: [
        'The first data structure is a capability matrix. Rows describe work classes such as lookup, code, legal analysis, drafting, judging, and final synthesis. Columns record model skill, tool requirements, context window, latency, cost, safety risk, and required evaluator. The route scorer turns that matrix plus request features into a chosen owner. The route ledger stores the request class, scores, policy checks, chosen owner, fallback reason, and trace IDs.',
        'The second data structure is the context capsule. A capsule is smaller than the transcript and stricter than a summary. It should carry the task intent, current progress, unresolved decisions, evidence or claim IDs, tool handles, authorization scope, budget, stop condition, and pointers back to the raw trace. Agent Memory & Context Engineering explains how to store and pack that state; this case study explains how to move it across a route boundary.',
      ],
    },
    {
      heading: 'How routing works',
      paragraphs: [
        'A typical request enters a classifier that estimates task type, risk, difficulty, context size, tool needs, and whether the result is externally visible. A low-risk lookup might go to a small cheap model with search. A code repair might go to a sandboxed coding agent with tests. A legal or financial conclusion might go to a stronger model plus a claim ledger and human review. A final answer might require a judge or citation checker even if earlier steps used cheaper workers.',
        'Anthropic names routing as a workflow pattern where inputs are classified and directed to specialized follow-up tasks, including routing easy/common questions to cheaper models and harder/unusual questions to more capable ones: https://www.anthropic.com/engineering/building-effective-agents. The local deep-research corpus makes the same point from the user side: workflow reliability fails when a product cannot preserve context, switch model tiers, handle files, or continue long multi-turn work without forcing the user to restart.',
      ],
    },
    {
      heading: 'Context handoff',
      paragraphs: [
        'A handoff should be a typed operation. OpenAI Agents SDK describes handoffs as a way for one agent to delegate to another specialist, represented as tools to the LLM, with optional input schemas, input filters, callbacks, dynamic enablement, and handoff history controls: https://openai.github.io/openai-agents-python/handoffs/. The systems lesson is broader than one SDK: delegation needs an explicit contract or the next owner inherits a muddy transcript.',
        'OpenAI also frames agents as applications that plan, call tools, collaborate across specialists, and keep enough state to complete multi-step work: https://developers.openai.com/api/docs/guides/agents. That "enough state" is the hard part. The capsule should be checkable against the trace, not trusted because it sounds coherent. If the receiver cannot cite the evidence, explain the current plan, respect the remaining budget, and name pending decisions, the handoff lost information.',
      ],
    },
    {
      heading: 'Complete case study: deep research workspace',
      paragraphs: [
        'Imagine a professional deep-research workspace. The user uploads a 70-page filing, asks for market analysis, then asks follow-up coding questions to reproduce a chart. The router sends source discovery to a search specialist, long-document extraction to a file reader, numerical checks to a sandboxed code agent, synthesis to a stronger reasoning model, and final review to a judge calibrated on a golden set. Each handoff carries a capsule: goal, source ledger IDs, current outline, unresolved contradictions, code artifact paths, budget, and reviewer criteria.',
        'Without the router ledger, failures are invisible. A weak answer could be caused by the wrong model, missing file access, stale memory, lost citations, a usage cap, or a policy gate that stripped the needed context. With the ledger, the product can inspect route scores, compare shadow routes, rerun only the failed segment, and train future routing rules from accepted-answer quality rather than raw thumbs-up ratings.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A router works when it turns invisible judgment into a logged control-plane decision. The request features, capability scores, cost envelope, policy checks, tool requirements, selected owner, capsule fields, and evaluator result are all inspectable. That makes routing errors debuggable instead of mystical.',
        'Typed handoffs work because they preserve just enough state for continuity while keeping provenance outside the summary. The receiver can follow trace links back to evidence, verify permissions, and continue from a known stop condition. That is what prevents a multi-agent workflow from becoming a chain of fresh starts.',
      ],
    },
    {
      heading: 'Operations and reliability',
      paragraphs: [
        'LangGraph persistence separates thread-scoped checkpoints from longer-term stores, which is exactly the distinction a router needs: current run state must survive interruption, while reusable user facts and preferences live outside the graph state: https://docs.langchain.com/oss/python/langgraph/persistence. Temporal describes durable execution as maintaining workflow state and progress through failures using event history, letting work resume from the last recorded event: https://docs.temporal.io/temporal. Those ideas apply directly to long agent workflows because route decisions and handoffs are state transitions.',
        'Tracing closes the loop. OpenAI Agents SDK tracing records LLM generations, tool calls, handoffs, guardrails, and custom events; traces contain spans with parent-child relationships and metadata: https://openai.github.io/openai-agents-python/tracing/. A production router should emit spans for classification, score calculation, policy decision, selected owner, capsule fields, evaluator result, fallback reason, and final acceptance.',
      ],
    },
    {
      heading: 'Limits, pitfalls, and study next',
      paragraphs: [
        'Do not let the router become hidden prompt magic. If route rules are not versioned, evaluated, and logged, the product will silently drift toward cheap-but-wrong answers or expensive-but-unnecessary escalation. Do not treat a handoff summary as evidence. Do not let a receiver inherit broad tool scope just because the sender had it. Do not optimize only for latency or cost if the expensive failures happen on a high-risk slice.',
        'Primary and official sources: Anthropic Building Effective Agents at https://www.anthropic.com/engineering/building-effective-agents, OpenAI Agents SDK overview at https://developers.openai.com/api/docs/guides/agents, OpenAI handoffs at https://openai.github.io/openai-agents-python/handoffs/, OpenAI tracing at https://openai.github.io/openai-agents-python/tracing/, LangGraph persistence at https://docs.langchain.com/oss/python/langgraph/persistence, and Temporal durable execution overview at https://docs.temporal.io/temporal. Study Agentic AI Patterns, Multi-Agent Orchestration Topologies, Agent2Agent Protocol Task State Case Study, Model Context Protocol Case Study, Agent Memory & Context Engineering Case Study, Deep Research Agent Architecture Case Study, LLM Unit Economics Ledger Case Study, Feature Flag Control Plane, Distributed Tracing, LLM Judge Calibration & Drift Monitor, AI Audit Evidence Packet Case Study, Prompt Injection Threat Model, Zanzibar Authorization Case Study, and Temporal Workflow Case Study next.',
      ],
    },
  ],
};
