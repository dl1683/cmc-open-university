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
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'A corrective action is not done because someone wrote that it is done. It is done when the system has replayable evidence: the incident prompt re-run against the fixed system, the trace diff showing what changed, and the regression case added to the safety register. Without falsifiable closure, corrective actions become administrative fiction.'},
        'An AI incident corrective-action ledger exists because post-deployment failures need more than a postmortem. A serious incident can involve a user report, trace logs, model version, prompt, retrieved context, tool call, policy decision, severity judgment, reporting deadline, mitigation, rerun evidence, and audit packet. If those pieces live in separate documents, the organization cannot prove what happened or what changed.',
        'AI systems also change quickly. A fix that worked on Friday may disappear after a model upgrade, prompt edit, tool-policy change, index rebuild, or data refresh. The ledger makes the incident replayable so the same failure can become a regression case instead of a one-time story.',
        'The purpose is not bureaucracy for its own sake. The ledger protects users and teams by making closure falsifiable. A corrective action is not done because someone wrote that it is done. It is done when the system has evidence that the cause was addressed and the incident case now passes or is otherwise contained.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a postmortem document plus a ticket. That can be useful for narrative learning, but it often fails as an operational control. The ticket may say "fixed" without linking the trace, model version, policy change, rerun, and future regression test.',
        'Another shortcut is to close the incident when the immediate harm stops. Containment is important, but containment is not corrective action. Disabling a feature, rolling back a model, or adding human review may reduce risk while the root cause remains unresolved.',
        'A third shortcut is to argue about causality until all work stalls. The ledger should separate containment, causal confidence, reporting obligations, corrective actions, and proof. Teams can take safe containment steps while the root-cause record is still being completed.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that incident response is a state machine with evidence requirements. Intake, triage, causal link, reporting clock, containment, corrective action, rerun, notification, and audit closure are different states. Each state has fields that must be filled before the incident can move safely.',
        'The ledger stores incident id, reporter, affected users, harm type, severity, system version, feature flag state, trace ids, causal-link status, awareness time, reporting deadline, owner, root cause, corrective action, rerun evidence, and regression case id. Those fields keep the operational, legal, and engineering views joined.',
        'The invariant is closure requires proof. A fix without rerun evidence, trace diff, policy decision, rollback evidence, data-change proof, or owner approval remains open. The ledger makes that visible before memory and urgency fade.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Intake captures a report, monitor alert, red-team finding, customer complaint, or internal escalation. Triage labels severity, affected surface, user impact, and whether containment is needed. Trace reconstruction finds the model version, prompt, retrieved context, tool calls, policy decisions, feature flags, and logs.',
        'Root-cause analysis links the AI system to the incident or records uncertainty. That causal-link state matters because it may start reporting clocks and assign corrective-action ownership. The ledger should distinguish awareness time, evidence time, causal-link time, notification decision, and closure time.',
        'Corrective action then starts from the cause. Possible actions include rollback, guardrail update, tool-scope reduction, data removal, prompt change, eval-slice expansion, monitoring change, human-review gate, or policy update. Each action needs a proof field: rerun pass, diff, approval, denial trace, or production monitor evidence.',
        'Finally, the incident feeds future prevention. Every closed case should either become a regression case, update a risk register, expand an evaluation slice, change monitoring, or explicitly document why no control change was needed.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The incident graph proves that intake, triage, traces, cause, clocks, fixes, reruns, notifications, and audit packets must stay connected. If the trace is separated from the action, the team cannot prove the right failure was fixed.',
        'The incident-fields matrix proves that facts should be captured before the story hardens. Who was affected, what harm occurred, which version ran, what evidence exists, and whether a reporting clock started are all different fields.',
        'The corrective-action table proves that closure has a proof type. A guardrail change needs rerun evidence. A data removal needs a diff. A tool-scope fix needs a denied-call trace. A rollback needs feature-flag or deployment evidence.',
        'The burn-down plot proves why ledgers matter operationally. Open corrective actions can accumulate while teams debate causality or ownership. A visible ledger keeps response clocks and owners from disappearing into meeting notes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The ledger works because it converts memory into replayable evidence. Incidents are stressful, cross-functional, and time-sensitive. Without a structured record, important facts vanish or become ambiguous after the system changes.',
        'It also works because it separates states that teams often collapse. Containment can happen before full root cause. Reporting-clock review can happen while fixes are being built. Rerun proof can close a corrective action even if the postmortem is still being polished.',
        'Most importantly, it turns incidents into future gates. A real-world failure should strengthen evals, monitoring, policies, runbooks, or guardrails. Otherwise the organization pays the cost of the incident without turning it into prevention.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is operational discipline. Teams must collect traces, preserve model and prompt versions, record owners, update statuses, rerun cases, and keep audit packets current. That can feel heavy during a fast-moving incident.',
        'There is also a judgment tradeoff. Too little structure produces vague closure. Too much structure slows response and encourages checkbox behavior. The right ledger is strict about evidence fields but practical about urgent containment.',
        'A third tradeoff is transparency. Incident ledgers may contain sensitive user data, security details, or proprietary model behavior. They need access controls, retention rules, redaction, and clear ownership.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern is strongest for deployed AI systems that use tools, retrieval, automated decisions, moderation, recommendations, code execution, or customer-facing actions. Those systems can produce harms that require traceable corrective action.',
        'It is useful for safety teams, product teams, legal or compliance review, incident command, model governance, and post-release evaluation. It also connects pre-release risk registers to real-world evidence after launch.',
        'A complete case: a tool-using agent takes an unsafe action after reading an untrusted document. The incident is triaged as high severity. Traces show document injection, tool call, and missing scope gate. The corrective action narrows tool authority, adds source-trust checks, reruns the incident trace, and adds the case to the red-team queue.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not close incidents on narrative alone. A well-written postmortem without rerun evidence does not prove the system is safer. Do not let causal uncertainty stall obvious containment; rollback, disable tools, or add human review while evidence is gathered.',
        'Another failure is not learning from incidents. If the incident does not update eval slices, monitoring, or policy, it can recur under a new label. The ledger costs operational discipline, but it prevents incidents from becoming isolated stories that never harden into controls.',
        'A third failure is losing version context. If the ledger cannot say which model, prompt, index, policy, and tool configuration ran, it cannot support a reliable rerun. Version capture is not optional in AI incident response.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: AI Incident Database at https://incidentdatabase.ai/, Partnership on AI AI Incident Database at https://partnershiponai.org/workstream/ai-incidents-database/, OECD AI Incidents Monitor at https://oecd.ai/en/incidents, NIST AI RMF Manage playbook at https://airc.nist.gov/airmf-resources/playbook/manage/, and EU AI Act Article 73 service-desk text at https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-73. Study AI Safety Eval Slice Risk Register Case Study, LLM Red-Team Attack Taxonomy Queue Case Study, AI Audit Evidence Packet Case Study, GenAI Observability Trace Semantics Case Study, LLM Guardrail Policy Engine, and AIOps Incident Response next.',
      ],
    },
  ],
};
