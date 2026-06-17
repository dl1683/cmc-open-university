// Financial contract lifecycle events: define execution for contracts by
// turning terms, lifecycle events, obligations, and policy checks into a ledger.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'financial-contract-lifecycle-event-model-case-study',
  title: 'Financial Contract Lifecycle Event Model',
  category: 'Systems',
  summary: 'A vertical execution-grounding case study: model contracts as lifecycle events, obligation states, policy decisions, and audit ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['contract state machine', 'oracle and policy'], defaultValue: 'contract state machine' },
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

function lifecycleGraph(title) {
  return graphState({
    nodes: [
      { id: 'terms', label: 'terms', x: 0.8, y: 3.4, note: 'contract' },
      { id: 'party', label: 'parties', x: 2.2, y: 1.6, note: 'roles' },
      { id: 'trade', label: 'trade', x: 2.2, y: 5.2, note: 'event' },
      { id: 'state', label: 'state', x: 3.9, y: 3.4, note: 'position' },
      { id: 'schedule', label: 'schedule', x: 5.5, y: 1.6, note: 'dates' },
      { id: 'oblig', label: 'obligations', x: 5.5, y: 5.2, note: 'cash/asset' },
      { id: 'settle', label: 'settle', x: 7.1, y: 2.2, note: 'delivery' },
      { id: 'amend', label: 'amend', x: 7.1, y: 4.8, note: 'change' },
      { id: 'ledger', label: 'event log', x: 8.8, y: 3.4, note: 'audit' },
    ],
    edges: [
      { id: 'e-terms-party', from: 'terms', to: 'party' },
      { id: 'e-terms-trade', from: 'terms', to: 'trade' },
      { id: 'e-party-state', from: 'party', to: 'state' },
      { id: 'e-trade-state', from: 'trade', to: 'state' },
      { id: 'e-state-schedule', from: 'state', to: 'schedule' },
      { id: 'e-state-oblig', from: 'state', to: 'oblig' },
      { id: 'e-schedule-settle', from: 'schedule', to: 'settle' },
      { id: 'e-oblig-settle', from: 'oblig', to: 'settle' },
      { id: 'e-state-amend', from: 'state', to: 'amend' },
      { id: 'e-settle-ledger', from: 'settle', to: 'ledger' },
      { id: 'e-amend-ledger', from: 'amend', to: 'ledger' },
    ],
  }, { title });
}

function policyGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'event', x: 0.8, y: 3.4, note: 'proposed' },
      { id: 'facts', label: 'facts', x: 2.4, y: 1.8, note: 'state' },
      { id: 'rules', label: 'rules', x: 2.4, y: 5.0, note: 'policy' },
      { id: 'oracle', label: 'oracle', x: 4.3, y: 3.4, note: 'check' },
      { id: 'decision', label: 'decision', x: 6.0, y: 3.4, note: 'allow?' },
      { id: 'human', label: 'review', x: 7.6, y: 1.8, note: 'ambig' },
      { id: 'append', label: 'append', x: 7.6, y: 5.0, note: 'ledger' },
      { id: 'audit', label: 'audit', x: 9.1, y: 3.4, note: 'proof' },
    ],
    edges: [
      { id: 'e-input-facts', from: 'input', to: 'facts' },
      { id: 'e-input-rules', from: 'input', to: 'rules' },
      { id: 'e-facts-oracle', from: 'facts', to: 'oracle' },
      { id: 'e-rules-oracle', from: 'rules', to: 'oracle' },
      { id: 'e-oracle-decision', from: 'oracle', to: 'decision' },
      { id: 'e-decision-human', from: 'decision', to: 'human' },
      { id: 'e-decision-append', from: 'decision', to: 'append' },
      { id: 'e-human-audit', from: 'human', to: 'audit' },
      { id: 'e-append-audit', from: 'append', to: 'audit' },
    ],
  }, { title });
}

function* contractStateMachine() {
  yield {
    state: lifecycleGraph('A contract execution trace starts with defined state'),
    highlight: { active: ['terms', 'party', 'trade', 'state', 'e-terms-party', 'e-terms-trade', 'e-party-state', 'e-trade-state'], found: ['ledger'] },
    explanation: 'For contracts, "execution" is not automatic like Python. The system must define state: parties, product terms, trade event, schedules, obligations, permissions, and audit identity.',
  };

  yield {
    state: labelMatrix(
      'Lifecycle events as state transitions',
      [
        { id: 'exec', label: 'execute' },
        { id: 'confirm', label: 'confirm' },
        { id: 'coupon', label: 'coupon' },
        { id: 'amend', label: 'amend' },
        { id: 'close', label: 'closeout' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'state', label: 'state' },
        { id: 'check', label: 'check' },
      ],
      [
        ['terms', 'new trade', 'valid'],
        ['match', 'confirmed', 'party ok'],
        ['date', 'cash due', 'calendar'],
        ['change', 'new terms', 'consent'],
        ['default', 'net claim', 'legal'],
      ],
    ),
    highlight: { active: ['exec:state', 'confirm:check', 'coupon:state', 'amend:check'], found: ['close:state'] },
    explanation: 'A lifecycle event should declare what it consumes, what state it produces, and which verifier accepted it. That is the minimum structure needed for a model to learn process semantics.',
    invariant: 'No execution trace exists until the domain defines state and transition rules.',
  };

  yield {
    state: lifecycleGraph('Schedules generate obligations over time'),
    highlight: { active: ['state', 'schedule', 'oblig', 'settle', 'e-state-schedule', 'e-state-oblig', 'e-schedule-settle', 'e-oblig-settle'], compare: ['amend'] },
    explanation: 'A derivative, repo, loan, or subscription contract often creates future obligations. The event model must connect product terms to schedules, schedules to due obligations, and obligations to settlement events.',
  };

  yield {
    state: labelMatrix(
      'What the event model stores',
      [
        { id: 'terms', label: 'terms' },
        { id: 'party', label: 'party' },
        { id: 'event', label: 'event' },
        { id: 'oracle', label: 'oracle' },
        { id: 'proof', label: 'proof' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['product data', 'state'],
        ['roles', 'authority'],
        ['lifecycle', 'transition'],
        ['rules', 'validity'],
        ['source refs', 'audit'],
      ],
    ),
    highlight: { active: ['terms:field', 'event:field', 'oracle:field'], found: ['proof:why'] },
    explanation: 'The trace should keep product terms, party roles, lifecycle event type, verifier decision, and source references together. Separating these creates unauditable model training data.',
  };

  yield {
    state: lifecycleGraph('The event log becomes the training object'),
    highlight: { active: ['settle', 'amend', 'ledger', 'e-settle-ledger', 'e-amend-ledger'], found: ['terms', 'state', 'oblig'] },
    explanation: 'A contract event log is the analog of an execution trace. It shows how terms and external events changed obligations over time, and why each transition was accepted or routed to review.',
  };
}

function* oracleAndPolicy() {
  yield {
    state: policyGraph('Policy gates decide whether a lifecycle event is valid'),
    highlight: { active: ['input', 'facts', 'rules', 'oracle', 'decision', 'e-input-facts', 'e-input-rules', 'e-facts-oracle', 'e-rules-oracle', 'e-oracle-decision'], found: ['audit'] },
    explanation: 'A legal or financial workflow needs a policy layer. The event is proposed, current state and reference data become facts, rules evaluate the transition, and the decision is written with an audit trail.',
  };

  yield {
    state: labelMatrix(
      'Oracle layers',
      [
        { id: 'schema', label: 'schema' },
        { id: 'state', label: 'state' },
        { id: 'policy', label: 'policy' },
        { id: 'source', label: 'source' },
        { id: 'human', label: 'human' },
      ],
      [
        { id: 'checks', label: 'checks' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['shape', 'bad data'],
        ['precond', 'bad order'],
        ['rules', 'blocked'],
        ['refs', 'missing'],
        ['ambiguity', 'escalate'],
      ],
    ),
    highlight: { active: ['schema:checks', 'state:checks', 'policy:checks'], compare: ['human:failure'] },
    explanation: 'The oracle is layered. Some checks are mechanical, some depend on policy data, and some require human review because the contract text or external fact is ambiguous.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'domain ambiguity', min: 0, max: 10 }, y: { label: 'automation share', min: 0, max: 100 } },
      series: [
        { id: 'closed', label: 'closed rules', points: [{ x: 1, y: 95 }, { x: 3, y: 82 }, { x: 5, y: 65 }, { x: 7, y: 42 }, { x: 9, y: 20 }] },
        { id: 'review', label: 'with review', points: [{ x: 1, y: 95 }, { x: 3, y: 88 }, { x: 5, y: 78 }, { x: 7, y: 67 }, { x: 9, y: 55 }] },
      ],
      markers: [
        { id: 'handoff', x: 7, y: 67, label: 'review gate' },
      ],
    }),
    highlight: { active: ['closed', 'review', 'handoff'] },
    explanation: 'More ambiguity does not mean no automation. It means the trace needs a handoff state: accepted automatically, rejected automatically, or escalated with the evidence required for review.',
  };

  yield {
    state: policyGraph('Accepted events append; ambiguous events route to review'),
    highlight: { active: ['decision', 'append', 'human', 'audit', 'e-decision-append', 'e-decision-human', 'e-append-audit', 'e-human-audit'], compare: ['oracle'] },
    explanation: 'A domain trace should not hide uncertainty. The decision branch is part of the data: append to the lifecycle log, reject the event, or route to review with the policy explanation.',
  };

  yield {
    state: labelMatrix(
      'Complete case: coupon payment event',
      [
        { id: 'due', label: 'due date' },
        { id: 'rate', label: 'rate' },
        { id: 'amount', label: 'amount' },
        { id: 'settle', label: 'settle' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'verdict', label: 'verdict' },
      ],
      [
        ['schedule', 'payable'],
        ['index fix', 'valid'],
        ['formula', 'matched'],
        ['wire ok', 'closed'],
        ['refs', 'stored'],
      ],
    ),
    highlight: { active: ['due:verdict', 'rate:verdict', 'amount:verdict', 'settle:verdict'], found: ['audit:verdict'] },
    explanation: 'A payment event becomes trainable when the model sees schedule, rate fixing, formula, settlement evidence, and audit references. That is a verified trajectory for a contract domain.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'contract state machine') yield* contractStateMachine();
  else if (view === 'oracle and policy') yield* oracleAndPolicy();
  else throw new InputError('Pick a contract lifecycle view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Contracts do not execute like Python functions. They create obligations over time, depend on reference data, require consent, and sometimes need human judgment. If an AI system is going to reason over them, the domain first needs to define what a valid state transition is.',
        'A financial contract lifecycle event model exists to make that execution state explicit. It represents terms, parties, lifecycle events, obligations, schedules, settlement evidence, policy decisions, and audit records as one event-sourced state machine.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive approach is to summarize the contract and ask a model what should happen next. That produces plausible prose, but it does not create replayable state, proof, or a reliable training signal.',
        'Another naive approach is to store lifecycle events as loosely typed logs. Without pre-state, post-state, verifier, and source evidence, the log is hard to audit and hard to learn from.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ambiguity plus accountability. A coupon payment, amendment, closeout, or settlement can depend on product terms, calendars, rates, party consent, legal events, and external evidence. A model answer without those facts is not execution.',
        'The system also has to preserve review. Ambiguous events are not failures to hide. They are states that should route to a person with the evidence needed to decide.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make every lifecycle event a typed state transition. A proposed event consumes current state, applies rules and reference data, produces new state, and stores the verifier decision with source references.',
        'This is the contract-domain equivalent of an execution trace. It says what state existed, what event happened, which rules accepted it, and what source evidence supports the new obligation state.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the contract-state-machine view, read each node as a legally or operationally meaningful state, not as a generic workflow box. A transition is valid only if the event, current state, terms, party authority, and reference data all support the move.",
        "In the oracle-and-policy view, follow the evidence chain. The system should be able to say which source document, market fixing, party instruction, policy rule, or settlement record justified a decision. If that evidence is missing, the correct transition may be review rather than approval or rejection.",
        "The animation is teaching execution grounding. A model's prose answer is not enough. The useful artifact is a replayable lifecycle trace: pre-state, event, checks, evidence, post-state, and reviewer handoff when needed.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A floating-rate note reaches a coupon date. The proposed event says party A owes party B a coupon amount. A lifecycle engine reads the contract terms, notional, day-count convention, payment calendar, rate source, fixing date, spread, and settlement instructions. It computes the expected amount and compares that with the proposed event.',
        'If the fixing is missing, the event should not silently invent a rate. If the amount is off by a rounding tolerance, the event may need policy handling. If an amendment changed the spread but lacks party consent evidence, the transition should route to review. These outcomes are not model failures; they are explicit lifecycle states.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Execution creates a trade. Confirmation validates party agreement. Scheduled events create cash or asset obligations. Amendments change terms. Settlement closes obligations. Defaults and closeouts create claims. Every transition stores input, pre-state, post-state, oracle decision, and source references.',
        'The oracle is layered. Schema checks catch malformed events. State checks catch impossible ordering. Policy checks decide whether the event is allowed under rules and reference data. Source checks verify evidence. Human review handles ambiguity.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because many financial lifecycle events are structured enough to be replayed. If the terms, schedule, market fixings, party roles, and policy rules are explicit, the system can reconstruct why an obligation exists or why it closed.',
        'The event log becomes the training object. A model can learn process semantics from verified trajectories instead of ungrounded contract summaries.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is modeling discipline. A useful lifecycle model needs typed events, versioned terms, reliable reference data, party authority, policy rules, evidence links, review states, and audit trails.',
        'It also needs change control. Contract templates, policy rules, and market conventions evolve. If old events are replayed under new rules without versioning, the trace stops being trustworthy.',
      ],
    },
    {
      heading: 'Why it works for curriculum design',
      paragraphs: [
        'This is also a curriculum pattern. Instead of teaching contracts as static documents, teach them as state machines whose transitions require evidence. Students can start with simple obligations, then add schedules, amendments, external rates, settlement, default, closeout, and human review.',
        'That sequence builds from data structures to domain judgment. The learner first sees why a log needs typed events and replay. Then they see why finance adds authority, policy, market data, legal ambiguity, and audit. The result is not just "AI for contracts"; it is a concrete way to make a legal-financial process executable enough to inspect.',
      ],
    },
    {
      heading: 'Data model shape',
      paragraphs: [
        'A useful event record needs more than `type` and `description`. It should include event id, contract id, party ids, event time, effective time, actor, authority source, pre-state hash, post-state hash, rule version, evidence references, verifier result, reviewer status, and any generated obligations. Those fields make replay, audit, and model evaluation possible.',
        'The pre-state and post-state hashes matter because they make hidden mutation visible. The rule version matters because old events must remain explainable after policy changes. Evidence references matter because a financial lifecycle engine is not a creative writing system. It must connect each transition to contract terms, market data, settlement evidence, or human approval.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This model wins in domains where events are formal enough to validate but still require evidence: derivatives lifecycle, loans, subscriptions, insurance claims, settlement workflows, and regulated approval processes.',
        'It is especially useful for AI evaluation because it creates objective and semi-objective verifier targets: valid, invalid, needs review, missing evidence, or policy conflict.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when natural-language contract text is treated as already executable. It also fails when lifecycle summaries lack pre-state, post-state, verifier, and evidence.',
        'Do not hide human review as failure. Review is a valid transition in ambiguous domains. Do not use one horizontal verifier for every vertical domain.',
        'It also fails when teams confuse schema compliance with truth. A perfectly shaped event can still use the wrong rate, wrong party, wrong calendar, or wrong amendment version. The model must connect structure to authoritative evidence or it becomes a neat ledger of unsupported claims.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A rate-swap coupon payment is proposed. The lifecycle trace reads product terms, payment schedule, rate fixing, day-count convention, party roles, and settlement account. The oracle checks that the due date is active, the rate source is valid, the formula produces the claimed amount, and settlement evidence exists.',
        'If all checks pass, the event appends to the log and the obligation closes. If the rate source is missing or amendment consent is unclear, the event routes to review with evidence.',
        'The same pattern covers amendments. A proposed amendment consumes current terms, party authority, consent evidence, effective date, and policy rules. If accepted, future scheduled events use the new versioned terms. If rejected or routed to review, the old terms remain active. The engine never quietly edits history; it appends a transition that explains why the contract state changed.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: FINOS CDM at https://www.finos.org/common-domain-model, CDM event model at https://cdm.finos.org/docs/event-model/, ISDA CDM at https://www.isda.org/isda-solutions-infohub/cdm/, OPA docs at https://openpolicyagent.org/docs, and Temporal Workflow docs at https://docs.temporal.io/workflows.',
        'Study Code World Models Case Study, Execution Trace State Diff Case Study, Temporal Workflow Case Study, Saga Pattern, Claim Graph & Source Ledger, OPA Rego Policy Decision Graph, and Double-Entry Payment Ledger Execution Trace next.',
      ],
    },
  ],
};
