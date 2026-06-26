// AI incident corrective-action ledger: intake, triage, severity, root cause,
// controls, reporting clocks, mitigations, reruns, and post-incident evidence.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-incident-corrective-action-ledger-case-study',
  title: 'AI Incident Corrective Action Ledger Case Study',
  category: 'Systems',
  summary: 'A post-deployment safety case study: incident intake, severity triage, causal links, reporting clocks, corrective actions, rerun evidence, and audit packets.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['incident ledger', 'corrective loop'], defaultValue: 'incident ledger' },
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

function incidentGraph(title) {
  return graphState({
    nodes: [
      { id: 'report', label: 'rep', x: 0.7, y: 3.4, note: 'intake' },
      { id: 'triage', label: 'tri', x: 2.2, y: 2.0, note: 'sev' },
      { id: 'trace', label: 'trace', x: 2.2, y: 4.8, note: 'logs' },
      { id: 'cause', label: 'cause', x: 4.0, y: 3.4, note: 'link' },
      { id: 'clock', label: 'time', x: 5.7, y: 2.0, note: 'report' },
      { id: 'fix', label: 'fix', x: 5.7, y: 4.8, note: 'CAPA' },
      { id: 'rerun', label: 'run', x: 7.4, y: 3.4, note: 'proof' },
      { id: 'reg', label: 'reg', x: 9.0, y: 2.0, note: 'notify' },
      { id: 'audit', label: 'audit', x: 9.0, y: 4.8, note: 'packet' },
    ],
    edges: [
      { id: 'e-report-triage', from: 'report', to: 'triage' },
      { id: 'e-report-trace', from: 'report', to: 'trace' },
      { id: 'e-triage-cause', from: 'triage', to: 'cause' },
      { id: 'e-trace-cause', from: 'trace', to: 'cause' },
      { id: 'e-cause-clock', from: 'cause', to: 'clock' },
      { id: 'e-cause-fix', from: 'cause', to: 'fix' },
      { id: 'e-fix-rerun', from: 'fix', to: 'rerun' },
      { id: 'e-clock-reg', from: 'clock', to: 'reg' },
      { id: 'e-rerun-audit', from: 'rerun', to: 'audit' },
      { id: 'e-reg-audit', from: 'reg', to: 'audit' },
    ],
  }, { title });
}

function* incidentLedger() {
  yield {
    state: incidentGraph('AI incident corrective-action ledger'),
    highlight: { active: ['report', 'triage', 'trace', 'cause', 'e-report-triage', 'e-report-trace', 'e-triage-cause', 'e-trace-cause'], found: ['fix'] },
    explanation: 'The ledger turns a real-world harm or near harm into replayable evidence. Intake, severity, traces, causal link, reporting clock, corrective action, rerun proof, and audit packet all have to stay connected.',
    invariant: 'A postmortem is not enough; corrective action needs replayable evidence.',
  };

  yield {
    state: labelMatrix(
      'Incident fields',
      [
        { id: 'who', label: 'who' },
        { id: 'harm', label: 'harm' },
        { id: 'sys', label: 'sys' },
        { id: 'cause', label: 'cause' },
        { id: 'clock', label: 'clock' },
      ],
      [
        { id: 'val', label: 'val' },
        { id: 'need', label: 'need' },
      ],
      [
        ['user', 'id'],
        ['type', 'sev'],
        ['ver', 'trace'],
        ['link', 'root'],
        ['days', 'timer'],
      ],
    ),
    highlight: { active: ['harm:need', 'sys:need', 'cause:need', 'clock:need'], found: ['who:need'] },
    explanation: 'The intake matrix captures facts before the story hardens. It records who was affected, what harm occurred, which system version ran, what evidence exists, and whether a reporting clock has started.',
  };

  yield {
    state: incidentGraph('Causal link starts response clocks'),
    highlight: { active: ['cause', 'clock', 'reg', 'e-cause-clock', 'e-clock-reg'], compare: ['fix'], found: ['audit'] },
    explanation: 'The causal-link node starts time-sensitive decisions. The ledger separates awareness time, link time, severity, and notification status so response clocks are inspectable.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'days since awareness', min: 0, max: 20 }, y: { label: 'open corrective actions', min: 0, max: 12 } },
      series: [
        { id: 'slow', label: 'ad hoc', points: [{ x: 0, y: 2 }, { x: 5, y: 5 }, { x: 10, y: 8 }, { x: 15, y: 10 }, { x: 20, y: 11 }] },
        { id: 'ledger', label: 'ledger', points: [{ x: 0, y: 2 }, { x: 5, y: 3 }, { x: 10, y: 3 }, { x: 15, y: 2 }, { x: 20, y: 1 }] },
      ],
      markers: [
        { id: 'due', x: 15, y: 2, label: 'clock' },
      ],
    }),
    highlight: { active: ['ledger', 'due'], compare: ['slow'] },
    explanation: 'The plot shows drift versus control. A ledger keeps response clocks visible so corrective actions do not stall while teams debate causality.',
  };
}

function* correctiveLoop() {
  yield {
    state: incidentGraph('Corrective action loop'),
    highlight: { active: ['cause', 'fix', 'rerun', 'audit', 'e-cause-fix', 'e-fix-rerun', 'e-rerun-audit'], compare: ['reg'] },
    explanation: 'Corrective action starts at root cause and ends at proof. Guardrail changes, data removal, rollback, human review, tool permission changes, and eval expansion are not closed until the rerun says so.',
  };

  yield {
    state: labelMatrix(
      'Corrective action table',
      [
        { id: 'guard', label: 'guard' },
        { id: 'data', label: 'data' },
        { id: 'tool', label: 'tool' },
        { id: 'eval', label: 'eval' },
        { id: 'roll', label: 'roll' },
      ],
      [
        { id: 'fix', label: 'fix' },
        { id: 'proof', label: 'proof' },
        { id: 'act', label: 'act' },
      ],
      [
        ['rule', 'rerun', 'done'],
        ['remove', 'diff', 'done'],
        ['scope', 'deny', 'done'],
        ['slice', 'pass', 'done'],
        ['flag', 'off', 'hold'],
      ],
    ),
    highlight: { active: ['guard:act', 'data:act', 'tool:act', 'eval:act'], compare: ['roll:act'], found: ['tool:proof'] },
    explanation: 'The table makes closure falsifiable. A fix without rerun, trace diff, policy decision, rollback evidence, or data-change proof remains open.',
  };

  yield {
    state: labelMatrix(
      'Complete case: unsafe tool action',
      [
        { id: 'inc', label: 'inc' },
        { id: 'root', label: 'root' },
        { id: 'fix', label: 'fix' },
        { id: 'rerun', label: 'rerun' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
        { id: 'act', label: 'act' },
      ],
      [
        ['open', 'trace', 'sev'],
        ['tool', 'scope', 'own'],
        ['deny', 'policy', 'run'],
        ['closed', 'pass', 'audit'],
      ],
    ),
    highlight: { active: ['inc:act', 'root:act', 'fix:act', 'rerun:act'], found: ['rerun:proof'], compare: ['inc:state'] },
    explanation: 'The complete case ties action to cause. Excessive tool scope and weak indirect-prompt handling caused the unsafe action; the fix narrows authority and closes only after the incident prompt is rerun.',
  };

  yield {
    state: incidentGraph('Incidents expand future eval slices'),
    highlight: { active: ['audit', 'rerun', 'e-rerun-audit'], found: ['fix', 'cause'], compare: ['report'] },
    explanation: 'The final edge prevents repeat incidents. The prompt, trace, policy gap, affected slice, and corrective proof become regression cases in the safety register.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'incident ledger') yield* incidentLedger();
  else if (view === 'corrective loop') yield* correctiveLoop();
  else throw new InputError('Pick an AI incident ledger view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the incident-ledger view as a state machine. A state machine moves records through named states only when required evidence is present.',
      'Active nodes show the state being filled, found nodes show closure evidence, and compare nodes show related work that is not yet sufficient. A corrective action is closed only after rerun proof or equivalent evidence exists.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      {type:'callout', text:'A corrective action is not done because someone wrote that it is done. It is done when the system has replayable evidence: the incident prompt re-run against the fixed system, the trace diff showing what changed, and the regression case added to the safety register. Without falsifiable closure, corrective actions become administrative fiction.'},
      'AI incidents involve model versions, prompts, retrieved context, tool calls, policy decisions, user harm, reporting clocks, and mitigations. If those facts live in separate documents, the team cannot prove what happened or what changed.',
      'The ledger turns a one-time failure into a replayable control. It keeps intake, severity, traces, cause, clocks, corrective action, rerun evidence, and audit closure in one joined record.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is a postmortem and a ticket. A narrative helps teams remember the event, and a ticket gives someone work to close.',
      'The approach fails when the ticket says fixed without linking the trace, system version, root cause, mitigation, rerun, and regression case. Closure becomes a status field instead of evidence.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is replay. AI systems change through model updates, prompt edits, index rebuilds, tool-policy changes, and data refreshes, so a written explanation can become stale immediately.',
      'If the team cannot rerun the incident prompt or reconstruct the trace under the fixed configuration, it cannot prove the corrective action targeted the real failure. The incident is documented, not controlled.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat incident response as an evidence ledger with state transitions. Intake, triage, causal link, containment, reporting review, corrective action, rerun proof, notification, and audit closure each require different fields.',
      'The invariant is falsifiable closure. A fix remains open until the ledger contains proof such as a rerun pass, trace diff, denied tool call, rollback record, data deletion diff, monitoring evidence, or explicit risk acceptance.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Intake captures the report, affected users, harm type, system version, feature flags, trace IDs, prompt, retrieved context, tool calls, and initial severity. Triage decides containment before perfect causality exists.',
      'Root-cause work links the incident to model behavior, a policy gap, data issue, retrieval failure, tool permission, or human workflow. That link can start reporting clocks and assign corrective-action ownership.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is traceability across state changes. If every transition records required evidence and owner, the incident cannot silently jump from reported to closed.',
      'The ledger also separates urgent containment from durable correction. A rollback may stop harm today while the corrective action remains open until the root cause is fixed and replayed.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is response discipline under pressure. Teams must preserve traces, versions, prompts, policy states, owners, clocks, and rerun artifacts while users may still be affected.',
      'Cost behaves like evidence latency. Capturing trace IDs during the incident may take seconds, but reconstructing them days later can take hours or become impossible after logs expire.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'The ledger fits tool-using agents, retrieval systems, automated decisions, moderation systems, code execution products, and any AI feature with user impact after launch. These systems need evidence that a known failure becomes a future guard.',
      'It is useful for legal, compliance, safety, product, and incident-command teams because each team sees the same state. The audit packet can sample the incident without interviewing everyone involved.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when teams close on narrative. A clear postmortem without rerun evidence does not prove the system will handle the case differently next time.',
      'It also fails when sensitive records are not governed. Incident ledgers may hold user data, exploit prompts, security details, or proprietary model behavior, so access control and retention are part of the design.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A document agent receives an untrusted PDF and executes a payment update after a hidden instruction in the text. The trace shows model v18, prompt p7, tool policy TP-04, document ID D-441, and a tool call that should have required higher trust.',
      'The corrective action narrows payment scope, adds source-trust checks, reruns 50 malicious-document cases, and blocks release until all 50 are denied. The incident closes only when the original trace replays as denied and the case enters the regression suite.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study AI incident databases, OECD incident tracking, NIST AI RMF Manage guidance, serious-incident reporting rules, and established post-incident review practice. Read them as sources for state, evidence, timing, and closure requirements.',
      'Next study safety eval slice registers, audit evidence packets, red-team attack queues, distributed tracing, feature flags, and AIOps incident response. Those topics supply the evidence rows this ledger consumes.',
    ] },
  ],
};
