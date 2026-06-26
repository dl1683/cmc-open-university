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
    explanation: 'The graph starts with the product claim and follows every edge to a proof object. If a reviewer cannot trace intended use through risk, data, model, eval, and control evidence, the packet is only paperwork.',
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
    explanation: 'The matrix turns audit prose into lookup keys. Each row needs an owner, version, source pointer, and freshness date so a reviewer can sample evidence instead of trusting a narrative.',
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
    explanation: 'The register row is the control invariant: harm, cause, control, metric, owner, status, and evidence must travel together. A harm without an owner or metric cannot block a release.',
  };

  yield {
    state: packetGraph('Third parties sample evidence, not vibes'),
    highlight: { active: ['file', 'log', 'audit', 'e-file-audit', 'e-log-audit'], compare: ['model'], found: ['ctrl'] },
    explanation: 'The audit node samples the packet instead of trusting the dashboard. A claim is supported only when the sampled proof has the right version and can be traced back to the system that produced it.',
  };
}

function* monitoringLoop() {
  yield {
    state: loopGraph('Post-release monitoring keeps the packet alive'),
    highlight: { active: ['ship', 'mon', 'slice', 'triage', 'e-ship-mon', 'e-ship-slice', 'e-mon-triage', 'e-slice-triage'], found: ['docs'] },
    explanation: 'Release is not the end of the graph. Live telemetry, complaints, drift checks, slice metrics, and guardrail logs feed back into the same packet so new evidence can change old risk decisions.',
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
    explanation: 'The monitoring matrix separates signals by route. Latency pages are not enough; eval drift, complaints, abuse probes, incidents, and downstream reports all need a path into triage.',
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
    explanation: 'The plot compares discovery with closure. Rising open risk without matching fixes means the packet is documenting exposure, not controlling it.',
  };

  yield {
    state: loopGraph('Corrective action updates the next release gate'),
    highlight: { active: ['triage', 'risk', 'fix', 'gate', 'docs', 'e-triage-risk', 'e-triage-fix', 'e-risk-gate', 'e-fix-gate', 'e-gate-docs'], compare: ['ship'] },
    explanation: 'Corrective action flows back into gates and docs. A fix is not durable until eval cases, policy gates, model cards, monitoring thresholds, and release checklists inherit the lesson.',
  };
}

function* thirdPartyAudit() {
  yield {
    state: packetGraph('A reviewer starts from use and risk'),
    highlight: { active: ['use', 'risk', 'file', 'audit', 'e-use-risk', 'e-file-audit'], compare: ['data'], found: ['eval'] },
    explanation: 'The reviewer begins at intended use because every later proof depends on scope. The audit then samples whether the technical file, evals, logs, and controls support that claim.',
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
    explanation: 'The hiring sample shows why high-impact domains need linked evidence. Data representativeness, bias slices, human oversight, appeal records, and live monitoring are separate rows because each can fail alone.',
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
    explanation: 'The sample plan turns review into replay. A dashboard is credible only when a sampled eval, log, incident, or corrective action can be followed back to its source artifact.',
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
    explanation: 'The verdict table keeps audit output operational. Supported claims can ship, minor gaps need dated fixes, proof gaps block, and live harm pauses the system.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as an evidence graph. A graph is a set of nodes and edges: nodes are records such as a risk row or eval result, and edges are the proof links that say one record supports another.',
        'Active nodes are the records currently being checked, found nodes are records with a usable version and owner, and compare nodes are older or competing records. In the monitoring view, the safe inference is that a risk is controlled only when the open-risk path reaches a closed corrective action with fresh evidence.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'AI audit work exists because model behavior is hard to inspect after the fact. A reviewer needs to know which model version, data snapshot, eval suite, guardrail, incident, and approval were true at the moment a release decision was made.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b0/European_Parliament_Strasbourg_Hemicycle_-_Diliff.jpg', alt:'European Parliament hemicycle in Strasbourg where the EU AI Act was debated and adopted', caption:'The European Parliament chamber where the EU AI Act was adopted. Article 11 requires high-risk AI systems to carry technical documentation kept up to date — the audit evidence packet is the data structure that makes that requirement operational. Source: Wikimedia Commons, Diliff, CC BY-SA 3.0'},
        {type:'callout', text:'An audit evidence packet is not paperwork — it is a queryable graph that connects a product claim to every proof object a reviewer would sample. If a regulator asks "why was model v23 approved for hiring on May 14, and what protected-group failures were still open?" the packet must answer with traceable evidence, not a narrative.'},
        'The packet is a data structure for that answer. It joins intended use, risk register rows, data lineage, model hashes, eval scorecards, controls, monitoring signals, incident records, and corrective actions into one versioned object.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a folder with one model card, one eval spreadsheet, one data sheet, one risk register, and one incident tracker. Each file is useful because it captures a local part of the release story.',
        'The weakness is that the folder has no enforced joins. A model card can describe model v23, while the eval sheet refers to scorer v4, the risk register was last edited under v22, and the incident tracker holds new evidence from production.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is versioned accountability. The important question is not whether the company has documents; it is whether a specific claim can be traced to the exact evidence that existed at a specific decision time.',
        'A hiring model can pass an aggregate eval on May 1 and still fail a protected-group slice found on May 20. If the release gate cannot say which result controlled the May 14 approval, the audit trail is a narrative instead of evidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat every audit claim as a typed edge in a graph. A typed edge has a defined meaning, such as risk R-12 is controlled by eval ES-47 for model hash abc1234 under threshold 0.03.',
        'The invariant is proof-path completeness. Every release claim must lead through edges to records with a version, owner, source, date, and freshness rule, or the claim remains unsupported.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with the intended-use record because scope decides which risks matter. A resume-ranking assistant, a medical triage model, and a marketing-copy assistant can share model technology while needing different evidence paths.',
        'Attach each risk row to control evidence. A row for gender bias might link to data lineage DL-09, model MV-23, eval scorecard ES-47, human-review policy HR-05, and monitoring slice MS-12.',
        'After launch, incidents and monitoring signals feed back into the same graph. A complaint or drift signal either confirms an existing row, changes its severity, or creates a new row with its own corrective action.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is process correctness. If every claim has a complete proof path and every proof path is versioned, a reviewer can sample a claim and replay the decision that used it.',
        'This does not prove the model is safe. It proves that release, monitoring, and corrective-action decisions are grounded in named evidence rather than memory, dashboards, or after-the-fact summaries.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is evidence maintenance. If a high-risk model takes 20 engineer-weeks to build, the packet may add 2 to 4 engineer-weeks across eval upkeep, trace tagging, risk ownership, and audit review.',
        'Cost behaves like a freshness tax. Adding one more model version is cheap when evidence is content-addressed and tests run automatically, but expensive when owners must reconstruct lineage from chat threads and stale spreadsheets.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits hiring, credit, insurance, health, education, content moderation, and enterprise agents. These systems need proof that the release team knew which risks were tested, which gaps remained, and who accepted the residual risk.',
        'It also helps internal platform teams. When one data source or guardrail changes, the graph can answer which releases, evals, and risk rows depended on that component.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The packet fails when teams treat it as compliance storage. A static technical file created at launch cannot explain a new production incident, a changed user population, or a model upgrade.',
        'It also fails when ownership is outside the engineering loop. If the team shipping the model does not maintain the risk rows and eval evidence, the graph becomes a delayed report about work happening elsewhere.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A resume model uses 50,000 historical applications and ranks 10,000 new candidates per month. Risk R-12 says gender parity gap must stay below 3 percent, and eval ES-47 reports 1.8 percent on model v23, so the row can support release.',
        'Four weeks later, 120 complaints mention non-English names, and a new slice ES-52 shows a 6.4 percent name-origin gap. The graph creates incident IR-03, opens risk R-19, blocks the next release, and closes only after model v24 reruns ES-52 at 1.9 percent with monitoring added.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the NIST AI Risk Management Framework, the EU AI Act technical documentation and post-market monitoring requirements, ISO/IEC 42001, Model Cards for Model Reporting, and Datasheets for Datasets. Read them as evidence-schema sources, not as prose templates.',
        'Next study directed graphs, content-addressed storage, release gates, incident corrective-action ledgers, model evaluation harnesses, and distributed tracing. Those topics explain how proof paths are represented, refreshed, and replayed.',
      ],
    },
  ],
};
