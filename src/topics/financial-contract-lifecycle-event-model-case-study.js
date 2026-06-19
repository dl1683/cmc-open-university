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
      heading: 'How to read the animation',
      paragraphs: [
        'The contract-state-machine view shows a directed graph where each node is a legally meaningful state: terms, parties, trade event, position state, schedule, obligations, settlement, amendment, and event log. Active (highlighted) nodes mark the current phase of the lifecycle. Found markers on the event log mean that transition has been durably recorded with audit evidence.',
        'The oracle-and-policy view shows the decision pipeline for a single proposed lifecycle event. Follow the path from event input through facts and rules into the oracle, then to decision, and finally to either append (accepted) or review (ambiguous). The audit node lights up when evidence is stored regardless of outcome.',
        'At each frame, ask: what state existed before this transition, what event triggered the move, and what evidence justifies it.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Contracts do not execute like Python functions. They create obligations over time, depend on reference data, require consent, and sometimes need human judgment. If an AI system is going to reason over them, the domain first needs to define what a valid state transition is.',
        'A financial contract lifecycle event model makes execution state explicit. It represents terms, parties, lifecycle events, obligations, schedules, settlement evidence, policy decisions, and audit records as one event-sourced state machine. The idea originates from the ISDA Common Domain Model (CDM), which standardized derivatives lifecycle events so that counterparties, clearinghouses, and regulators could share an unambiguous record of what happened and why.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive approach is to summarize the contract and ask a model what should happen next. That produces plausible prose, but it does not create replayable state, proof, or a reliable training signal.',
        'Another naive approach is to store lifecycle events as loosely typed logs -- a JSON blob with a timestamp and a description field. Without pre-state, post-state, verifier identity, and source evidence, the log cannot answer "why did this obligation exist on that date?" It is hard to audit and hard to learn from.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ambiguity plus accountability. A coupon payment depends on product terms, calendars, rates, party consent, and external evidence. An amendment depends on authority and legal events. A closeout depends on netting rules and default definitions. A model answer without those facts is not execution -- it is a guess that looks like execution.',
        'The system also has to preserve review as a first-class state. Ambiguous events are not failures to hide. They are transitions that should route to a person with the evidence needed to decide. A system that forces every event into accept/reject loses the most important category: "we need a human to look at this, and here is why."',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make every lifecycle event a typed state transition with mandatory evidence. A proposed event consumes current state, applies rules and reference data, produces new state, and stores the verifier decision with source references. The invariant is: no state change without a recorded justification.',
        'This is the contract-domain equivalent of an execution trace. It says what state existed, what event happened, which rules accepted it, and what source evidence supports the new obligation state. Replay the log forward from any checkpoint and you reconstruct the full contract position.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Execution creates a trade from terms and parties. Confirmation validates party agreement. Scheduled events (coupon dates, resets, maturities) create cash or asset obligations. Amendments change terms under consent. Settlement closes obligations against delivery evidence. Defaults and closeouts create net claims. Every transition stores input, pre-state, post-state, oracle decision, and source references.',
        'The oracle is layered into five tiers. Schema checks catch malformed events (wrong fields, bad types). State checks catch impossible ordering (settling an obligation that does not exist). Policy checks evaluate business rules against reference data (rate within tolerance, party authorized). Source checks verify that evidence documents exist and match. Human review handles cases where the rules are insufficient -- ambiguous contract language, disputed fixings, or missing consent.',
        "In the contract-state-machine view, each node is a legally or operationally meaningful state. A transition is valid only when the event, current state, terms, party authority, and reference data all support the move. In the oracle-and-policy view, follow the evidence chain: every decision must trace back to a source document, market fixing, party instruction, or settlement record.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on two properties. First, monotonic append: the event log only grows. No transition edits a previous event; amendments and corrections are new events that reference their predecessors. This makes the log safe to replicate and audit. Second, evidence closure: every transition carries enough context to re-derive the decision. If the terms, schedule, market fixings, party roles, and policy rules are explicit, the system can reconstruct why an obligation exists or why it closed.',
        'Together these properties mean the event log is replayable. Given the initial contract terms and the sequence of lifecycle events, any auditor or model can reproduce the current obligation state. The log becomes a verifiable training object -- a model can learn process semantics from verified trajectories instead of ungrounded contract summaries.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 5-year USD interest rate swap. Party A pays fixed 3.5%; Party B pays 3-month SOFR + 25bp. Notional: $10M. Quarterly payment dates.',
        'Step 1 -- Execution: the trade event creates the contract with terms, party roles, and schedule. The log records: event=EXECUTE, pre-state=NONE, post-state=ACTIVE, evidence=signed term sheet.',
        'Step 2 -- Confirmation: both parties confirm. Event=CONFIRM, pre-state=ACTIVE, post-state=CONFIRMED, evidence=matching confirmations from A and B.',
        'Step 3 -- First coupon (fixed leg): the schedule generates a payment obligation. The engine reads notional ($10M), rate (3.5%), day-count (30/360), and payment date. Fixed amount = $10M * 3.5% * (90/360) = $87,500. Event=COUPON, obligation=A owes $87,500, evidence=contract terms + calendar.',
        'Step 4 -- First coupon (floating leg): the engine reads the SOFR fixing for the reset date. Suppose SOFR = 4.1%. Floating amount = $10M * (4.1% + 0.25%) * (90/360) = $108,750. Event=COUPON, obligation=B owes $108,750, evidence=SOFR fixing from reference source + contract terms.',
        'Step 5 -- Net settlement: obligations net to $21,250 from B to A. Event=SETTLE, evidence=netting agreement + wire confirmation. Both obligations close.',
        'If the SOFR fixing is missing on the reset date, the floating coupon event cannot compute an amount. The correct transition is not to guess a rate -- it is to create a PENDING_FIXING state that routes to review once the rate publishes. The lifecycle engine waits for evidence rather than fabricating it.',
      ],
    },
    {
      heading: 'Data model shape',
      paragraphs: [
        'A useful event record needs more than type and description. Required fields: event id, contract id, party ids, event time, effective time, actor, authority source, pre-state hash, post-state hash, rule version, evidence references, verifier result, reviewer status, and any generated obligations.',
        'Pre-state and post-state hashes make hidden mutation visible -- if someone edits the database directly, the hash chain breaks. Rule version matters because old events must remain explainable after policy changes: "this was accepted under policy v2.3, which allowed a 5bp tolerance; current policy v3.1 would reject it." Evidence references connect each transition to contract terms, market data, settlement records, or human approval.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is modeling discipline, not computation. Each lifecycle event requires fetching current state, reference data, and policy rules, then running the oracle pipeline -- O(L) per event where L is the number of oracle layers (typically 5). Storage grows linearly with the number of lifecycle events per contract, typically hundreds over a multi-year instrument.',
        'The real cost is change control. Contract templates, policy rules, and market conventions evolve. If old events are replayed under new rules without versioning, the trace stops being trustworthy. Maintaining rule versions, reference data snapshots, and evidence archives is an operational workload that scales with the number of active contracts times the rate of rule changes.',
        'For a portfolio of 10,000 active contracts with quarterly events, the system processes roughly 40,000 lifecycle events per quarter. Each event needs 5 oracle checks, evidence lookup, and append. This is computationally trivial but operationally demanding: the hard part is keeping reference data fresh, policy versions consistent, and evidence archives accessible.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Derivatives lifecycle management at clearinghouses (LCH, CME, ICE) uses exactly this pattern: every trade, novation, compression, margin call, and settlement is a typed event with evidence. The ISDA CDM standardizes the event vocabulary so counterparties can reconcile without ambiguity.',
        'Loan servicing platforms track disbursement, repayment, rate reset, covenant breach, and restructuring as lifecycle events. Insurance claims processing follows the same arc: filing, investigation, assessment, approval/denial, payment, and appeal are state transitions with evidence requirements.',
        'The pattern is especially useful for AI evaluation because it creates objective verifier targets. A model producing lifecycle events can be scored against the oracle: valid, invalid, needs review, missing evidence, or policy conflict. That is a much sharper training signal than "does this contract summary sound right."',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when natural-language contract text is treated as already executable. Most contracts contain ambiguous clauses, cross-references, and jurisdictional variations that resist mechanical parsing. The lifecycle model works only for the subset of terms that have been formalized into typed fields.',
        'It fails when teams confuse schema compliance with truth. A perfectly shaped event record can still use the wrong rate, wrong party, wrong calendar, or wrong amendment version. Structure without authoritative evidence is a neat ledger of unsupported claims.',
        'It also over-engineers simple contracts. A month-to-month subscription with fixed pricing does not need a five-layer oracle pipeline. The lifecycle event model earns its keep on instruments with scheduled obligations, external reference data, multiple counterparties, and regulatory audit requirements. For a SaaS invoice, a simple state machine with three states (active, past-due, cancelled) is the right tool.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        'Invariant check: "Every lifecycle event in the log has a pre-state hash, post-state hash, oracle verdict, and at least one evidence reference." If any event lacks these, the log is incomplete and replay cannot be trusted.',
        'Transition check: a COUPON event for the floating leg has pre-state CONFIRMED with no outstanding obligations. The oracle reads the SOFR fixing (4.1%), computes $108,750, verifies it matches the proposed amount within tolerance. Post-state: new obligation B owes $108,750. Verdict: ACCEPTED. Evidence: SOFR fixing record + contract terms v1.0.',
        'Edge case: an AMEND event proposes changing the spread from 25bp to 30bp. Party A has signed; Party B has not. The oracle reaches the consent check and finds one signature missing. The correct verdict is PENDING_REVIEW, not REJECTED. The event enters the log with status=PENDING and evidence=partial consent. Future coupon events continue using the old spread until the amendment completes.',
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Trace a maturity event. The 5-year swap reaches its final payment date. Walk through: (1) the schedule generates the last coupon obligations for both legs, (2) the oracle checks rate fixings and computes amounts, (3) net settlement produces a single payment, (4) a MATURITY event closes the contract. What is the post-state? What evidence does the maturity event need? What happens if the final SOFR fixing is delayed?',
        'Now add a default. Party B fails to deliver the net settlement amount. A DEFAULT event fires. What state does it produce? What obligations does it create (close-out netting, replacement cost claim)? What evidence does it reference (failed wire confirmation, cure period expiry)? Walk the oracle pipeline for this event and identify which layer handles each check.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: FINOS CDM specification at https://cdm.finos.org/docs/event-model/ defines the canonical event types for derivatives. ISDA CDM overview at https://www.isda.org/isda-solutions-infohub/cdm/ covers the industry governance. Open Policy Agent at https://openpolicyagent.org/docs provides the policy-as-code pattern used in the oracle layer.',
        'Prerequisites: study Write-Ahead Log for the append-only durability pattern, and Saga Pattern for multi-step transaction coordination. Extensions: study Temporal Workflow Case Study for durable execution of long-running processes, and Double-Entry Payment Ledger Execution Trace for the settlement accounting layer. Alternatives: study Execution Trace State Diff Case Study for a lighter approach when full lifecycle formalism is unnecessary, and OPA Rego Policy Decision Graph for the policy engine in isolation.',
      ],
    },
  ],
};
