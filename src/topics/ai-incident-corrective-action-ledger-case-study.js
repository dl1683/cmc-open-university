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
    explanation: 'An AI incident ledger turns post-deployment harm or near harm into structured evidence: intake, severity, traces, causal link, reporting clock, corrective action, rerun proof, and audit packet.',
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
    explanation: 'The intake record should say who was affected, what harm occurred, which system version was involved, what evidence exists, and whether a reporting clock has started.',
  };

  yield {
    state: incidentGraph('Causal link starts response clocks'),
    highlight: { active: ['cause', 'clock', 'reg', 'e-cause-clock', 'e-clock-reg'], compare: ['fix'], found: ['audit'] },
    explanation: 'Some regimes care when the provider establishes a causal link or reasonable likelihood of one. The ledger should track awareness time, link time, severity, and notification status.',
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
    explanation: 'A ledger makes response clocks visible. It keeps corrective actions from drifting while teams debate whether the incident was really caused by the AI system.',
  };
}

function* correctiveLoop() {
  yield {
    state: incidentGraph('Corrective action loop'),
    highlight: { active: ['cause', 'fix', 'rerun', 'audit', 'e-cause-fix', 'e-fix-rerun', 'e-rerun-audit'], compare: ['reg'] },
    explanation: 'Corrective action should point to a root cause and a proof. Examples include guardrail changes, data removal, model rollback, human review, tool permission changes, or eval slice expansion.',
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
    explanation: 'Corrective actions need proof fields. A fix without rerun, trace diff, policy decision, or rollback evidence is not closed.',
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
    explanation: 'A tool-using agent takes an unsafe action. The root cause is excessive tool scope plus weak indirect-prompt handling. The fix narrows capability, reruns the incident prompt, and closes only after proof.',
  };

  yield {
    state: incidentGraph('Incidents expand future eval slices'),
    highlight: { active: ['audit', 'rerun', 'e-rerun-audit'], found: ['fix', 'cause'], compare: ['report'] },
    explanation: 'Closed incidents should feed future evals. The prompt, trace, policy gap, affected slice, and corrective proof become regression cases in the safety register.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'An AI incident corrective-action ledger is the post-deployment safety record that tracks harms, near harms, severity, causal evidence, reporting clocks, corrective actions, rerun proof, and audit packet closure.',
        'AI Audit Evidence Packet Case Study explains the broader governance packet. AI Safety Eval Slice Risk Register Case Study explains pre-release gates. This module closes the loop when real-world failures happen anyway.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The ledger stores incident id, reporter, affected users, harm type, severity, system version, feature flag state, trace ids, causal-link status, awareness time, reporting deadline, owner, root cause, corrective action, rerun evidence, and regression case id.',
        'Corrective actions need proof fields. Closing an incident should require policy decision logs, trace diffs, evaluation reruns, rollout state, data deletion evidence, or human-review records depending on the root cause.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Intake captures a report or monitor alert. Triage labels severity and affected surface. Trace reconstruction finds the system version and path. Root-cause analysis links the AI system to the incident or marks uncertainty. Reporting clocks and corrective actions are then tracked until rerun proof closes the case.',
        'The ledger should feed the risk register. Every closed incident should either become a regression case, update a policy, expand a slice, change monitoring, or document why no control change was needed.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A tool-using agent takes an unsafe action after reading an untrusted document. The incident is triaged as high severity. Traces show the document injection, tool call, and missing scope gate. The corrective action narrows tool authority, adds a source-trust check, reruns the incident trace, and adds the case to the red-team queue.',
        'The incident closes only when the rerun denies the tool action and the audit packet contains the trace, root cause, mitigation, owner approval, and future regression case.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not close incidents on narrative alone. A well-written postmortem without rerun evidence does not prove the system is safer. Do not let causal uncertainty stall obvious containment; rollback, disable tools, or add human review while evidence is gathered.',
        'Another failure is not learning from incidents. If the incident does not update eval slices, monitoring, or policy, it can recur under a new label.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AI Incident Database at https://incidentdatabase.ai/, Partnership on AI AI Incident Database at https://partnershiponai.org/workstream/ai-incidents-database/, OECD AI Incidents Monitor at https://oecd.ai/en/incidents, NIST AI RMF Manage playbook at https://airc.nist.gov/airmf-resources/playbook/manage/, and EU AI Act Article 73 service-desk text at https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-73.',
        'Study next: AI Safety Eval Slice Risk Register Case Study, LLM Red-Team Attack Taxonomy Queue Case Study, AI Audit Evidence Packet Case Study, GenAI Observability Trace Semantics Case Study, LLM Guardrail Policy Engine, and AIOps Incident Response.',
      ],
    },
  ],
};
