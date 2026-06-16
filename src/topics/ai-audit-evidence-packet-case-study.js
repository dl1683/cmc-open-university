// AI audit evidence packets: risk registers, technical files, eval proof,
// monitoring signals, incident records, and corrective-action loops.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-audit-evidence-packet-case-study',
  title: 'AI Audit Evidence Packet Case Study',
  category: 'Systems',
  summary: 'Turn AI governance into a data structure: risk register, technical file, eval proofs, monitoring, incidents, and corrective actions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['evidence packet', 'monitoring loop', 'third-party audit'], defaultValue: 'evidence packet' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function packetGraph(title) {
  return graphState({
    nodes: [
      { id: 'use', label: 'use', x: 0.8, y: 3.7, note: 'purpose' },
      { id: 'risk', label: 'risk', x: 2.4, y: 2.2, note: 'register' },
      { id: 'data', label: 'data', x: 2.4, y: 5.2, note: 'lineage' },
      { id: 'model', label: 'model', x: 4.1, y: 2.2, note: 'version' },
      { id: 'eval', label: 'eval', x: 4.1, y: 5.2, note: 'proofs' },
      { id: 'ctrl', label: 'ctrl', x: 5.8, y: 3.7, note: 'guards' },
      { id: 'file', label: 'file', x: 7.4, y: 2.2, note: 'tech doc' },
      { id: 'log', label: 'log', x: 7.4, y: 5.2, note: 'events' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.7, note: 'sample' },
    ],
    edges: [
      { id: 'e-use-risk', from: 'use', to: 'risk' },
      { id: 'e-use-data', from: 'use', to: 'data' },
      { id: 'e-risk-model', from: 'risk', to: 'model' },
      { id: 'e-data-eval', from: 'data', to: 'eval' },
      { id: 'e-model-ctrl', from: 'model', to: 'ctrl' },
      { id: 'e-eval-ctrl', from: 'eval', to: 'ctrl' },
      { id: 'e-ctrl-file', from: 'ctrl', to: 'file' },
      { id: 'e-ctrl-log', from: 'ctrl', to: 'log' },
      { id: 'e-file-audit', from: 'file', to: 'audit' },
      { id: 'e-log-audit', from: 'log', to: 'audit' },
    ],
  }, { title });
}

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'ship', label: 'ship', x: 0.8, y: 3.8, note: 'release' },
      { id: 'mon', label: 'mon', x: 2.4, y: 2.2, note: 'live' },
      { id: 'slice', label: 'slice', x: 2.4, y: 5.4, note: 'cohorts' },
      { id: 'triage', label: 'triage', x: 4.2, y: 3.8, note: 'rank' },
      { id: 'risk', label: 'risk', x: 5.9, y: 2.2, note: 'update' },
      { id: 'fix', label: 'fix', x: 5.9, y: 5.4, note: 'CAPA' },
      { id: 'gate', label: 'gate', x: 7.6, y: 3.8, note: 'review' },
      { id: 'docs', label: 'docs', x: 9.2, y: 3.8, note: 'packet' },
    ],
    edges: [
      { id: 'e-ship-mon', from: 'ship', to: 'mon' },
      { id: 'e-ship-slice', from: 'ship', to: 'slice' },
      { id: 'e-mon-triage', from: 'mon', to: 'triage' },
      { id: 'e-slice-triage', from: 'slice', to: 'triage' },
      { id: 'e-triage-risk', from: 'triage', to: 'risk' },
      { id: 'e-triage-fix', from: 'triage', to: 'fix' },
      { id: 'e-risk-gate', from: 'risk', to: 'gate' },
      { id: 'e-fix-gate', from: 'fix', to: 'gate' },
      { id: 'e-gate-docs', from: 'gate', to: 'docs' },
    ],
  }, { title });
}

function* evidencePacket() {
  yield {
    state: packetGraph('An AI audit packet is an evidence graph'),
    highlight: { active: ['use', 'risk', 'data', 'model', 'eval', 'ctrl', 'e-use-risk', 'e-use-data', 'e-risk-model', 'e-data-eval'], found: ['file'] },
    explanation: 'The audit artifact is a versioned graph linking intended use, risk register, data lineage, model version, eval proofs, controls, logs, and technical documentation.',
    invariant: 'Auditable means traceable from claim to evidence.',
  };

  yield {
    state: labelMatrix(
      'Evidence packet index',
      [
        { id: 'use', label: 'use' },
        { id: 'data', label: 'data' },
        { id: 'model', label: 'model' },
        { id: 'eval', label: 'eval' },
        { id: 'risk', label: 'risk' },
        { id: 'ctrl', label: 'ctrl' },
        { id: 'mon', label: 'mon' },
        { id: 'inc', label: 'inc' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['purpose', 'scope'],
        ['lineage', 'source'],
        ['version', 'hash'],
        ['scorecard', 'slices'],
        ['register', 'owner'],
        ['guards', 'logs'],
        ['live SLO', 'drift'],
        ['ticket', 'CAPA'],
      ],
    ),
    highlight: { active: ['use:artifact', 'data:artifact', 'eval:artifact', 'risk:artifact'], found: ['inc:proof'] },
    explanation: 'A useful packet is an index over evidence. Each row has an owner, version, source pointer, and freshness date so reviewers can sample instead of reading folklore.',
  };

  yield {
    state: labelMatrix(
      'Risk register row',
      [
        { id: 'harm', label: 'harm' },
        { id: 'cause', label: 'cause' },
        { id: 'ctrl', label: 'ctrl' },
        { id: 'metric', label: 'metric' },
        { id: 'owner', label: 'owner' },
        { id: 'state', label: 'state' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['bias', 'slice eval'],
        ['bad data', 'lineage'],
        ['human gate', 'policy log'],
        ['gap < 3%', 'scorecard'],
        ['PM+ML', 'signoff'],
        ['open', 'due date'],
      ],
    ),
    highlight: { active: ['harm:value', 'ctrl:value', 'metric:value', 'state:value'], compare: ['cause:evidence'] },
    explanation: 'A risk register is a table with teeth. It links a harm to a cause, control, metric, owner, status, review date, and evidence pointer.',
  };

  yield {
    state: packetGraph('Third parties sample evidence, not vibes'),
    highlight: { active: ['file', 'log', 'audit', 'e-file-audit', 'e-log-audit'], compare: ['model'], found: ['ctrl'] },
    explanation: 'A third-party audit should be able to pick a claim, ask for the proof object, inspect the version, and trace it back to the system that produced it.',
  };
}

function* monitoringLoop() {
  yield {
    state: loopGraph('Post-release monitoring keeps the packet alive'),
    highlight: { active: ['ship', 'mon', 'slice', 'triage', 'e-ship-mon', 'e-ship-slice', 'e-mon-triage', 'e-slice-triage'], found: ['docs'] },
    explanation: 'After release, live telemetry, user reports, drift checks, slice metrics, and guardrail logs feed back into the same evidence packet.',
    invariant: 'A pre-release audit is stale the day usage changes.',
  };

  yield {
    state: labelMatrix(
      'Monitoring sources',
      [
        { id: 'slo', label: 'SLO' },
        { id: 'eval', label: 'eval' },
        { id: 'drift', label: 'drift' },
        { id: 'human', label: 'human' },
        { id: 'abuse', label: 'abuse' },
        { id: 'inc', label: 'inc' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'route', label: 'route' },
      ],
      [
        ['p99 fail', 'pager'],
        ['slice fail', 'block'],
        ['shift', 'review'],
        ['complaint', 'triage'],
        ['probe', 'red team'],
        ['harm', 'report'],
      ],
    ),
    highlight: { active: ['slo:route', 'eval:route', 'inc:route'], compare: ['human:signal'] },
    explanation: 'Monitoring is not only latency dashboards. It includes eval drift, human complaints, abuse patterns, incidents, and signals from downstream deployers.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'weeks live', min: 0, max: 8 }, y: { label: 'risk count', min: 0, max: 12 } },
      series: [
        { id: 'open', label: 'open', points: [{ x: 0, y: 3 }, { x: 2, y: 5 }, { x: 4, y: 9 }, { x: 6, y: 7 }, { x: 8, y: 4 }] },
        { id: 'closed', label: 'closed', points: [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 3 }, { x: 6, y: 6 }, { x: 8, y: 9 }] },
      ],
      markers: [
        { id: 'spike', x: 4, y: 9, label: 'drift' },
        { id: 'fixes', x: 6, y: 6, label: 'fixes' },
      ],
    }),
    highlight: { active: ['open', 'spike'], found: ['closed', 'fixes'] },
    explanation: 'A healthy monitoring loop can show risk discovery and closure over time. If open risks only accumulate, the packet documents liability rather than control.',
  };

  yield {
    state: loopGraph('Corrective action updates the next release gate'),
    highlight: { active: ['triage', 'risk', 'fix', 'gate', 'docs', 'e-triage-risk', 'e-triage-fix', 'e-risk-gate', 'e-fix-gate', 'e-gate-docs'], compare: ['ship'] },
    explanation: 'Corrective and preventive action should update eval cases, policy gates, model cards, monitoring thresholds, and the release checklist before the next rollout.',
  };
}

function* thirdPartyAudit() {
  yield {
    state: packetGraph('A reviewer starts from use and risk'),
    highlight: { active: ['use', 'risk', 'file', 'audit', 'e-use-risk', 'e-file-audit'], compare: ['data'], found: ['eval'] },
    explanation: 'A useful audit begins with intended use and harm model, then samples whether the technical file, evals, logs, and controls actually support the product claim.',
  };

  yield {
    state: labelMatrix(
      'Sensitive-system sample',
      [
        { id: 'domain', label: 'domain' },
        { id: 'input', label: 'input' },
        { id: 'decision', label: 'decision' },
        { id: 'human', label: 'human' },
        { id: 'appeal', label: 'appeal' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hiring', 'rights'],
        ['resume', 'bias'],
        ['rank', 'impact'],
        ['review', 'rubber'],
        ['record', 'none'],
      ],
    ),
    highlight: { active: ['domain:risk', 'decision:risk', 'human:evidence'], removed: ['appeal:risk'] },
    explanation: 'Case study: a hiring-rank assistant needs evidence for intended use, data representativeness, bias slices, human oversight, appeal paths, and live monitoring.',
  };

  yield {
    state: labelMatrix(
      'Audit sample plan',
      [
        { id: 'docs', label: 'docs' },
        { id: 'data', label: 'data' },
        { id: 'eval', label: 'eval' },
        { id: 'logs', label: 'logs' },
        { id: 'inc', label: 'inc' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'sample', label: 'sample' },
        { id: 'test', label: 'test' },
      ],
      [
        ['version', 'current?'],
        ['lineage', 'consent?'],
        ['slices', 'pass?'],
        ['random', 'replay?'],
        ['sev-1', 'timely?'],
        ['CAPA', 'closed?'],
      ],
    ),
    highlight: { active: ['eval:test', 'logs:test', 'inc:test', 'fix:test'], compare: ['docs:sample'] },
    explanation: 'Third-party review is sampling plus traceability. The reviewer should not trust the dashboard until a sampled event can be replayed back to evidence.',
  };

  yield {
    state: labelMatrix(
      'Reviewer verdicts',
      [
        { id: 'ok', label: 'ok' },
        { id: 'minor', label: 'minor' },
        { id: 'major', label: 'major' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'next', label: 'next' },
      ],
      [
        ['supported', 'ship'],
        ['gap small', 'fix date'],
        ['proof gap', 'block'],
        ['harm live', 'pause'],
      ],
    ),
    highlight: { found: ['ok:next', 'minor:next'], removed: ['major:next', 'stop:next'] },
    explanation: 'The best audit output is operational: supported, minor gap, major proof gap, or live harm. Each state has a concrete next action.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'evidence packet') yield* evidencePacket();
  else if (view === 'monitoring loop') yield* monitoringLoop();
  else if (view === 'third-party audit') yield* thirdPartyAudit();
  else throw new InputError('Pick an AI audit view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An AI audit evidence packet is a versioned data structure for reviewing an AI system. It links intended use, risk register, data lineage, model version, evaluation proof, guardrail decisions, monitoring signals, incident records, corrective actions, and technical documentation.',
        'This is engineering guidance, not legal advice. The local regulation notes in the provided corpus argue for process-specific third-party audits rather than abstract debates about AI safety. The practical version is an evidence graph: every claim about safety, fairness, robustness, privacy, or human oversight should point to a reproducible artifact.',
      ],
    },
    {
      heading: 'Core structures',
      paragraphs: [
        'The risk register stores harm, cause, affected group, likelihood, severity, control, metric, owner, status, due date, and evidence id. The technical file stores purpose, architecture, model versions, data sources, deployment form, interface, dependencies, performance metrics, change history, and monitoring plan. The eval ledger stores cases, slices, scorers, scorecards, seeds, prompt versions, retrieval index versions, and human-audit samples.',
        'NIST AI RMF frames AI risk management around trustworthiness across design, development, use, and evaluation: https://www.nist.gov/itl/ai-risk-management-framework. NIST AI 600-1 adapts the AI RMF to generative AI and emphasizes governance, content provenance, testing, and incident disclosure: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf. ISO/IEC 42001 describes an AI management system for establishing, implementing, maintaining, and continually improving AI governance: https://www.iso.org/standard/42001.',
      ],
    },
    {
      heading: 'Regulatory shape',
      paragraphs: [
        'The EU AI Act is useful as a concrete evidence model even outside Europe. The European Commission AI Act Service Desk summarizes Article 11 as requiring high-risk AI systems to have up-to-date technical documentation before market release, with elements specified in Annex IV: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-11. Article 72 describes post-market monitoring for high-risk systems: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-72. Article 73 covers reporting serious incidents: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-73.',
        'The engineering lesson is stable across frameworks: do not make governance a meeting. Make it a queryable packet with owners, versions, evidence pointers, sampling rules, monitoring hooks, and corrective-action state.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A hiring-rank assistant scores resumes for recruiter review. The packet records intended use, prohibited uses, training data lineage, protected-slice evals, score thresholds, human-review workflow, appeal process, monitoring slices, model card, incident queue, and corrective-action log. A reviewer samples a rejected candidate, traces the score to model version and data slice, inspects whether human review happened, and checks whether any related incident changed the next release gate.',
        'The same structure applies to credit, medical triage, education, public benefits, legal research, and enterprise agents. The domain changes the risks and controls, but the data structure stays recognizable: risk register plus evidence ledger plus live monitoring loop.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not mistake a model card for the whole audit. Do not report only average eval scores when protected or high-impact slices can regress. Do not handpick logs for review. Do not close findings with promises instead of evidence. Do not let incidents live outside the risk register. Do not freeze the packet after launch; post-release monitoring is part of the system.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study LLM Evaluation Harnesses, Human Evaluation Labeling Queue, LLM Judge Calibration & Drift Monitor, LLM Guardrail Policy Engine, Prompt Injection Threat Model, AI Engineering Stack: Five Parts Primer, Training-Serving Skew Replay Diff, Benchmark Variance & Model Selection, Data Leakage & Contamination, PII Redaction Token Span Pipeline, Claim Graph Source Ledger, Distributed Tracing, Feature Flag Control Plane, SLO Error Budget Burn Rate Alert, OPA Rego Policy Decision Graph, Software Supply Chain Provenance Graph, and AIOps Incident Response next.',
      ],
    },
  ],
};
