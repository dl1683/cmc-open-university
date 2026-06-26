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
    { heading: 'How to read the animation', paragraphs: [
        'The contract-state-machine view shows a directed graph where each node is a legally meaningful state: terms, parties, trade event, position state, schedule, obligations, settlement, amendment, and event log. Active (highlighted) nodes mark the current phase of the lifecycle. Found markers on the event log mean that transition has been durably recorded with audit evidence.',
        'The oracle-and-policy view shows the decision pipeline for a single proposed lifecycle event. Follow the path from event input through facts and rules into the oracle, then to decision, and finally to either append (accepted) or review (ambiguous). The audit node lights up when evidence is stored regardless of outcome.',
        'At each frame, ask: what state existed before this transition, what event triggered the move, and what evidence justifies it.',
        {type:'callout', text:'A contract lifecycle engine is useful only when every state transition carries the evidence that makes it replayable.'},
      ] },
    { heading: 'Why this exists', paragraphs: [
        'A financial contract is not finished when it is signed. It creates obligations over time: confirmations, rate resets, coupons, settlements, amendments, defaults, and closeouts. A lifecycle event model exists so each change has typed state, rule evidence, and a replayable audit trail.',
      ] },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to summarize the contract and ask what should happen next. Another is to store loose JSON events with timestamps and descriptions. Both can look useful, but neither proves why an obligation existed on a date.',
      ] },
    { heading: 'The wall', paragraphs: [
        'The wall is accountability under ambiguity. A coupon may depend on rate fixings, day count, calendars, amendment history, and party authority. If any fact is missing, execution cannot safely pretend the answer is known.',
      ] },
    { heading: 'The core insight', paragraphs: [
        'Make every lifecycle event a typed state transition with mandatory evidence. The invariant is: no state change without a recorded justification. Review is also a state, so ambiguity is preserved instead of hidden.',
      ] },
    { heading: 'How it works', paragraphs: [
        'The engine reads current state, event type, contract terms, reference data, party authority, and evidence. Schema checks catch malformed events, state checks catch impossible ordering, policy checks apply rules, source checks verify documents, and human review handles cases rules cannot decide.',
      ] },
    { heading: 'Why it works', paragraphs: [
        'Correctness comes from append-only replay and evidence closure. Old events are not edited; amendments and corrections are new events that reference prior state. Given initial terms and the event sequence, replay reconstructs the current obligation state or exposes the first unsupported transition.',
      ] },
    { heading: 'Cost and complexity', paragraphs: [
        'The compute cost per event is small: fetch state, run the oracle layers, and append. If 10,000 active contracts emit 4 scheduled events per year and the oracle has 5 layers, the system performs about 200,000 layer checks per year before evidence lookup. The real cost is maintaining rule versions, reference snapshots, calendars, and evidence archives.',
      ] },
    { heading: 'Real-world uses', paragraphs: [
        'Derivatives processing is the natural use: execution, confirmation, novation, compression, margin, settlement, default, and closeout are typed events. The same pattern fits loan servicing, insurance claims, payroll, regulated workflow, and AI evaluation where valid, invalid, missing-evidence, and needs-review are precise labels.',
      ] },
    { heading: 'Where it fails', paragraphs: [
        'It fails when natural-language contract text is treated as already executable. Many clauses require interpretation, local law, side letters, or human judgment. It also fails when a well-shaped event uses the wrong rate, wrong party, wrong calendar, or wrong amendment version.',
      ] },
    { heading: 'Worked example', paragraphs: [
        'Consider a 5-year USD swap. Party A pays fixed 3.5 percent on $10,000,000, and Party B pays 3-month SOFR plus 25 basis points. For a 90-day quarter, the fixed payment is $10,000,000 times 0.035 times 90 divided by 360, or $87,500. If SOFR is 4.1 percent, the floating payment is $10,000,000 times 0.0435 times 90 divided by 360, or $108,750. Net settlement is $21,250 from B to A, backed by the fixing source, terms, netting rule, and wire evidence.',
      ] },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: FINOS CDM event model at https://cdm.finos.org/docs/event-model/, ISDA CDM overview at https://www.isda.org/isda-solutions-infohub/cdm/, and Open Policy Agent documentation at https://openpolicyagent.org/docs.',
        'Study Write-Ahead Log, Saga Pattern, Temporal Workflow Case Study, Double-Entry Payment Ledger Execution Trace, Execution Trace State Diff Case Study, and OPA Rego Policy Decision Graph next.',
      ] },
  ],
};
