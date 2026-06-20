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
        'The animation traces the evidence graph that connects a product claim to the proof objects an auditor would sample. Three views show three phases of the same lifecycle.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the artifacts currently under inspection: the intended-use record, a risk register row, or a monitoring signal being triaged.',
            'Found nodes are evidence objects whose version and source have been confirmed: a scorecard that passed slice thresholds, a corrective action with a closed ticket.',
            'Compare nodes show the alternative under measurement: the previous model version, the pre-fix guardrail, or the risk row before a new incident changed its severity.',
          ],
        },
        'In the evidence-packet view, follow edges from the "use" node outward. If any edge leads to a node without a version, owner, or freshness date, the packet has a gap. In the monitoring-loop view, watch whether open-risk count converges toward closed-risk count over time. Divergence means the packet is documenting exposure, not controlling it.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'AI systems make consequential decisions -- ranking resumes, triaging medical symptoms, scoring credit applications, moderating content -- but the artifacts that justify those decisions are scattered across teams, tools, and time. A model card lives in one repository. Evaluation results sit in a spreadsheet. The data lineage is tribal knowledge. Incident reports land in a ticket queue that nobody cross-references with the risk register. When a regulator, customer auditor, or internal reviewer asks "why was model version 23 approved for hiring on May 14, and what protected-group failures were still open at that time?" no single system can answer.',
        {
          type: 'quote',
          text: 'A high-risk AI system shall be accompanied by technical documentation drawn up before that system is placed on the market or put into service and which shall be kept up to date.',
          attribution: 'EU AI Act, Article 11(1) -- technical documentation requirement for high-risk AI systems',
        },
        'An audit evidence packet is the data structure that makes that question answerable. It links intended use, risk register rows, data lineage records, model version hashes, evaluation scorecards, guardrail configurations, monitoring signals, incident reports, and corrective-action records into a single, versioned, queryable graph. The packet does not make a system safe. It makes the safety claim inspectable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a folder: one model card, one eval spreadsheet, one data sheet, one risk register, one monitoring dashboard, and one incident tracker. Each document is genuinely useful. The model card explains purpose and limitations. The eval report shows aggregate accuracy. The data sheet describes training sources. The risk register lists known harms. The dashboard shows latency and error rates. The incident tracker logs bugs.',
        {
          type: 'table',
          headers: ['Artifact', 'What it captures', 'What it misses'],
          rows: [
            ['Model card', 'Purpose, architecture, known limitations', 'Which version was live when, which risks it was assessed against'],
            ['Eval spreadsheet', 'Aggregate accuracy, F1, BLEU', 'Per-slice failures, scorer versions, seed sensitivity'],
            ['Data sheet', 'Source descriptions, collection method', 'Consent status at row level, drift since collection'],
            ['Risk register', 'Identified harms, severity ratings', 'Which eval evidence supports each control, ownership over time'],
            ['Monitoring dashboard', 'Latency p99, error rate', 'Distribution shift, complaints, abuse probes, downstream harm'],
            ['Incident tracker', 'Bug reports, resolution dates', 'Link back to risk row, effect on next release gate'],
          ],
        },
        'Each artifact is a column in an implicit table, but nobody maintains the join. When someone asks a release-specific, cross-cutting question -- which data version trained the model that the risk register assessed with the eval suite that monitoring later contradicted -- the folder has fragments, not an answer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The folder approach fails at two specific joints. First, it cannot answer versioned questions. Model card v3 might describe risks that were identified against eval suite v1, but by release day the eval suite is on v4 and two of the original risks were reclassified. The folder stores the latest version of each document; it does not store which combination of versions was live at a decision point. Reconstructing that combination requires archaeology across git histories, Confluence pages, Jira timelines, and Slack threads.',
        'Second, it cannot close the post-release loop. A monitoring signal fires six weeks after launch: the model is underperforming on a demographic slice that the pre-release eval did not cover. The incident goes into the tracker. But does it update the risk register? Does it add a new eval slice? Does it change the threshold for the next release gate? In a folder system, each of those updates is a manual, unlinked action. The corrective action exists in the incident tracker, the risk update exists in the spreadsheet, and the eval update exists in the test suite -- but nothing ties them together as a causal chain from harm to fix.',
        {
          type: 'note',
          text: 'The wall is not that folders are disorganized. It is that folders lack referential integrity. Each document is well-structured internally, but the cross-document references -- "this risk is controlled by this eval, which ran on this data, and was invalidated by this incident" -- are prose pointers that rot, not enforced foreign keys.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat audit evidence as a typed, versioned graph rather than a narrative. Every node in the graph has a schema: an intended-use record, a risk-register row, a data-lineage entry, a model-version record, an eval scorecard, a guardrail configuration, a monitoring signal, an incident report, or a corrective-action ticket. Every edge is a foreign key: this risk row references this eval scorecard, which was produced by this scorer version running on this data snapshot for this model checkpoint.',
        {
          type: 'diagram',
          text: 'Evidence packet graph:\n\n  [use] ---> [risk] ---> [model] ---> [ctrl] ---> [file] ---> [audit]\n    |                       |            |\n    +------> [data] ---> [eval] --------+------> [log] ----+\n\n  use:   intended purpose, prohibited uses, affected population\n  risk:  harm + cause + control + metric + owner + status\n  data:  source + consent + version + drift-check date\n  model: architecture + checkpoint hash + prompt version\n  eval:  cases + slices + scorers + seeds + thresholds\n  ctrl:  guardrails + human review rules + fallback paths\n  file:  assembled technical documentation snapshot\n  log:   runtime events, monitoring signals, complaints\n  audit: sampled evidence, reviewer verdict, finding status',
          label: 'Each node has a schema; each edge is a foreign key that an auditor can follow',
        },
        'The graph enforces a simple invariant: every claim must have a proof path. "The model is fair" is not a node. "Eval scorecard ES-47, slice: gender, scorer: demographic_parity, threshold: 0.03, result: 0.018, date: 2026-05-20, model: v23-abc1234" is a node. The auditor follows the edge from risk row R-12 to scorecard ES-47 and checks whether the version, date, and threshold match the release decision. If any edge is broken -- missing version, stale date, wrong model hash -- the proof path fails and the claim is unsupported.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The packet assembles in three phases: scope, evidence attachment, and post-release feedback.',
        {
          type: 'note',
          text: 'Phase 1 must happen before development begins. Phase 2 runs continuously during development. Phase 3 starts at launch and never ends. Teams that treat the packet as a pre-release checkbox skip Phase 3 and lose the most valuable evidence: what actually happened.',
        },
        'Phase 1: Scope. The intended-use record declares what the system does, what it must never be used for, who is affected, and what decision it influences. This record is the root of the evidence graph. A chatbot that drafts marketing copy, a medical triage model, and a resume-ranking assistant need completely different risk registers even though all three use the same underlying technology. The scope record prevents risk-row reuse across systems with different harm profiles.',
        'Phase 2: Evidence attachment. Each risk row gets linked to the artifacts that control it.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Simplified risk-register row schema\nconst riskRow = {\n  id: "R-12",\n  harm: "Gender bias in resume ranking",\n  cause: "Training data skew toward male-dominated job titles",\n  control: "Demographic parity threshold on gender slice",\n  metric: "demographic_parity_gap < 0.03",\n  evidence: {\n    eval: "ES-47",         // scorecard foreign key\n    data: "DL-09",         // data lineage foreign key\n    model: "MV-23-abc1234", // model version foreign key\n    guardrail: "GR-05",   // guardrail config foreign key\n  },\n  owner: "ml-fairness-team",\n  status: "open",\n  due: "2026-06-01",\n  lastReviewed: "2026-05-20",\n};',
        },
        'Data lineage records name each source (training corpus, eval set, retrieval index, feedback loop), its version, consent status, known gaps, and last-refreshed date. The model record stores architecture name, checkpoint hash, prompt or policy version, dependency versions, and the release hash that ties everything together. The eval ledger stores individual scorecards: which cases, which slices, which scorers, which seeds, which thresholds, which human-audit samples, and whether the result passed or failed. Controls record guardrail rules, human-review triggers, fallback paths, and release-approval signoffs.',
        'Phase 3: Post-release feedback. Monitoring signals -- SLO violations, distribution drift, user complaints, abuse probes, near-miss reports, serious incidents, downstream harm reports -- feed back into the packet. Each signal either confirms an existing risk row ("R-12 is still controlled") or creates a new one ("new harm H-19 discovered in production"). Corrective actions update eval suites, guardrail thresholds, model cards, release checklists, and monitoring alert rules. The packet is alive: the next release gate inherits the lessons from the last failure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The packet preserves three invariants that make audit review reducible to sampling and replay rather than trust in a slide deck.',
        {
          type: 'table',
          headers: ['Invariant', 'What it guarantees', 'How to test it'],
          rows: [
            ['Proof-path completeness', 'Every high-level claim (fair, safe, monitored) has a chain of edges leading to versioned evidence', 'Pick any claim node. Walk edges to leaves. Every leaf must have a version, owner, and date.'],
            ['Replay sufficiency', 'Every proof path is versioned enough to reconstruct the decision that used it', 'Pick any release decision. Retrieve the exact model hash, eval scorecard, data snapshot, and risk-row status that were current at decision time.'],
            ['Feedback closure', 'Post-release evidence can change future gates', 'Pick any production incident. Trace it to a risk-row update, an eval-suite addition, a guardrail change, or a documented accept-the-risk decision.'],
          ],
        },
        'Correctness here is process correctness, not model correctness. The packet does not prove the model is fair. It proves that the decision to release the model was made with specific evidence, that the evidence had a specific version, and that later signals either confirmed or invalidated that evidence. A finding is closed only when the corrective action has its own evidence node -- not when a meeting note says someone will handle it.',
        {
          type: 'quote',
          text: 'Organizations should treat AI risks like other critical risks and integrate them into broader enterprise risk management strategies.',
          attribution: 'NIST AI Risk Management Framework (AI RMF 1.0), Section 1, 2023',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A company deploys a resume-ranking model for initial hiring screens. Walk the packet from scope to post-release incident.',
        {
          type: 'table',
          headers: ['Step', 'Action', 'Packet state change'],
          rows: [
            ['1. Scope', 'Declare intended use: rank resumes for software-engineering roles. Prohibited use: final hiring decision without human review.', 'use node U-1 created, linked to risk register template'],
            ['2. Risk identification', 'Identify R-12 (gender bias), R-13 (age proxy via graduation year), R-14 (disability keyword penalty).', 'Three risk rows created, each with harm, cause, placeholder control fields'],
            ['3. Data lineage', 'Training data DL-09: 50K resumes, source = internal ATS, consent = employment agreement, known gap = 80% male applicants in historical data.', 'DL-09 node created, linked from R-12 cause field'],
            ['4. Model version', 'MV-23-abc1234: fine-tuned encoder, checkpoint hash abc1234, prompt version p-7.', 'MV-23 node created, linked from all three risk rows'],
            ['5. Evaluation', 'ES-47: demographic_parity on gender slice = 0.018 (threshold 0.03, PASS). ES-48: age-proxy check on graduation_year feature = 0.12 correlation (threshold 0.10, FAIL).', 'ES-47 linked to R-12 (supports control). ES-48 linked to R-13 (blocks release).'],
            ['6. Remediation', 'Remove graduation_year feature. Retrain as MV-24-def5678. Re-run ES-48: correlation drops to 0.04 (PASS).', 'MV-24 replaces MV-23 in risk rows. ES-48 v2 linked. R-13 status changes to controlled.'],
            ['7. Release gate', 'All three risk rows have passing eval evidence, assigned owners, and guardrail configs. Release approved.', 'Gate node created with approval timestamp, signoff list, and snapshot of all linked evidence versions.'],
            ['8. Post-release incident', 'Week 4: complaints from candidates with non-English names. Investigation reveals tokenizer bias not covered by gender or age slices.', 'New risk row R-19 created. Incident report IR-03 linked. New eval slice ES-52 (name-origin parity) added.'],
            ['9. Corrective action', 'Retrain tokenizer. Add name-origin slice to standard eval suite. Update monitoring to alert on name-origin parity drift.', 'CAPA-07 node links IR-03 to R-19 to ES-52 to new guardrail GR-08. Next release gate inherits all updates.'],
          ],
        },
        'At step 8, an auditor can ask: "Was name-origin bias a known risk at release time?" The packet answers precisely: no. R-19 did not exist at the step 7 gate. The auditor can then ask: "Was corrective action taken?" CAPA-07 traces the full chain from complaint to fix. Without the packet, those questions require archaeology.',
      ],
    },
    {
      heading: 'Standards and regulatory shape',
      paragraphs: [
        'Multiple frameworks converge on the same engineering pattern: typed evidence, versioned artifacts, monitoring hooks, and corrective-action loops.',
        {
          type: 'table',
          headers: ['Framework', 'Key requirement', 'Packet component it maps to'],
          rows: [
            ['EU AI Act, Article 11', 'Technical documentation before market placement, kept up to date', 'Technical file node assembled from use, risk, data, model, eval, and control nodes'],
            ['EU AI Act, Article 72', 'Post-market monitoring plan proportionate to risk', 'Monitoring-loop subgraph: SLO, drift, complaints, abuse probes, incidents'],
            ['EU AI Act, Article 73', 'Serious incident reporting to authorities within defined timelines', 'Incident node with severity, timeline, root-cause link, corrective-action link'],
            ['NIST AI RMF 1.0', 'Govern, Map, Measure, Manage across the AI lifecycle', 'Packet phases map 1:1: scope=Map, evidence=Measure, monitoring=Manage, governance=Govern'],
            ['NIST AI 600-1', 'Generative AI extensions: content provenance, testing, disclosure', 'Eval scorecards for generative quality, provenance metadata on training data'],
            ['ISO/IEC 42001', 'AI management system: establish, implement, maintain, improve', 'Packet lifecycle: Phase 1 (establish), Phase 2 (implement), Phase 3 (maintain + improve)'],
          ],
        },
        {
          type: 'note',
          text: 'This page is engineering guidance, not legal advice. The regulatory references show where the evidence-packet pattern appears in public frameworks. Compliance requires legal review specific to your jurisdiction and system risk level.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of an evidence packet is maintenance, not construction. Building the initial graph takes a few days of engineering work per system. Keeping it alive across model updates, data refreshes, eval-suite changes, team reorganizations, and incident responses is the ongoing tax.',
        {
          type: 'table',
          headers: ['Cost driver', 'What rots', 'Mitigation'],
          rows: [
            ['Evidence pointer staleness', 'Links to eval scorecards, data snapshots, and model checkpoints break when storage is reorganized', 'Content-addressed storage: reference by hash, not by path'],
            ['Owner turnover', 'Risk-row owners leave teams; nobody inherits accountability', 'Ownership tied to team alias, not individual; ownership audit in release gate'],
            ['Eval drift', 'Eval suite no longer reflects real usage patterns', 'Periodic eval-refresh reviews triggered by usage telemetry changes'],
            ['Monitoring noise', 'Too many signals, too few triage resources', 'Tiered alert routing: SLO to pager, drift to weekly review, complaints to triage queue'],
            ['Gate friction', 'Heavy gates cause teams to route around the process', 'Risk-proportionate gates: lightweight for low-risk experiments, full packet for high-risk releases'],
          ],
        },
        'A well-maintained packet for a high-risk system costs roughly 10-15% of the engineering effort spent on the model itself. Most of that cost comes from eval-suite maintenance and incident-to-risk-row linkage. Teams that automate eval runs, version evidence by hash, and integrate incident reports into the risk register during normal engineering workflows absorb most of the cost without dedicated "compliance sprints."',
        'The product tradeoff is gate weight. If the gate demands 47 sign-offs and a 200-page technical file for every prompt-template change, teams will circumvent it. If the gate accepts aggregate metrics and undated prose, it will approve systems on promises. Risk-proportionate gates -- lightweight for low-risk experiments, full packet for high-risk releases -- keep the process honest without making it adversarial.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Why the packet matters', 'Key evidence nodes'],
          rows: [
            ['Hiring / resume ranking', 'Legal liability under employment discrimination law; adverse impact must be documented and tested', 'Demographic-parity evals per protected group, human-review override rates, appeal records'],
            ['Credit scoring', 'Fair lending regulations require explainability and disparate-impact testing', 'Feature-importance logs, slice-level approval rates, adverse-action reason codes'],
            ['Medical triage / clinical decision support', 'Patient safety; FDA/CE marking for software as medical device', 'Clinical validation studies, sensitivity/specificity per subpopulation, post-market surveillance signals'],
            ['Content moderation', 'Platform liability, user rights, transparency reporting obligations', 'False-positive rates by language/region, appeal overturn rates, escalation-to-human rates'],
            ['Enterprise agents with tool use', 'Agents act across sensitive data; blast radius of a bad action is large', 'Tool-call audit logs, permission-boundary configs, rollback evidence for misfire incidents'],
          ],
        },
        'Evidence packets also serve internal platform teams. When a shared ML platform serves dozens of product teams, each model release, guardrail change, eval regression, and feature flag becomes part of one operational record. The platform team can answer "which models were affected by data source X being deprecated?" without polling every consumer team.',
        'The packet is most valuable when third parties sample evidence. A vendor review, regulator, security auditor, procurement team, or enterprise customer should not need tribal knowledge to inspect a claim. They pick a claim, sample a proof node, check its version and date, and verify whether subsequent monitoring changed the risk decision. If that workflow takes days of back-and-forth emails, the packet is not a packet -- it is a folder with a nice name.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A packet cannot create competence after the fact. It can expose missing evidence, stale controls, weak evals, and unowned risks, but it cannot fix them. Common failure modes:',
        {
          type: 'bullets',
          items: [
            'Treating the model card as the entire audit. A model card is one node in the graph. It is not the graph.',
            'Hiding slice failures behind aggregate metrics. An eval scorecard that reports 94% accuracy overall but does not break out performance on protected groups has a missing edge, not a passing result.',
            'Handpicking logs for the technical file. If the auditor cannot request a random sample from the production log stream, the evidence is curated testimony, not proof.',
            'Closing findings with promises. A corrective-action node must link to its own evidence: the retrained model hash, the new eval scorecard, the updated guardrail rule. "We will address this in Q3" is not a closed finding.',
            'Keeping incidents outside the risk register. If the incident tracker and the risk register are in different systems with no foreign keys, post-release evidence cannot update pre-release assumptions.',
            'Freezing the packet after launch. A pre-release audit is stale the day usage patterns change, data distributions shift, or a new harm category emerges.',
          ],
        },
        'The packet also fails when risk taxonomies are copy-pasted across systems. A resume-ranking assistant, a code-generation tool, and a clinical summarizer need different harms, different eval slices, different human-review rules, and different monitoring signals. The graph schema can be shared; the nodes and edges must be specific to the system.',
        {
          type: 'note',
          text: 'The deepest failure is organizational, not technical. If the team that owns the model does not own the packet, evidence maintenance becomes someone else\'s problem. The packet works when the same engineers who train the model also maintain the risk rows, run the evals, review the monitoring signals, and close the incidents. Separating "the AI team" from "the compliance team" is how packets become paperwork.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['NIST AI RMF 1.0 (2023) -- nist.gov/itl/ai-risk-management-framework', 'Four-function framework (Govern, Map, Measure, Manage) for AI risk management'],
            ['NIST AI 600-1 (2024) -- nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf', 'Generative AI profile extending AI RMF with content provenance, testing, and disclosure'],
            ['EU AI Act, Articles 11, 72, 73 -- ai-act-service-desk.ec.europa.eu', 'Technical documentation, post-market monitoring, and serious-incident reporting requirements'],
            ['ISO/IEC 42001:2023 -- iso.org/standard/42001', 'AI management system standard for establishing, implementing, and improving AI governance'],
            ['Mitchell et al., "Model Cards for Model Reporting" (FAT* 2019)', 'Structured documentation format for trained ML models -- one node in the evidence graph'],
            ['Gebru et al., "Datasheets for Datasets" (CACM 2021)', 'Structured documentation for datasets -- another node in the evidence graph'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Directed Acyclic Graphs and topological ordering to understand why the evidence graph must be acyclic (no circular proof dependencies).',
            'Extension: study LLM Evaluation Harnesses for reproducible eval scorecards, LLM Guardrail Policy Engine for control evidence, and LLM Judge Calibration and Drift Monitor for score reliability over time.',
            'Operational: study SLO Error Budget Burn Rate Alert for live monitoring patterns, AIOps Incident Response for corrective-action loops, and Distributed Tracing for runtime evidence collection.',
            'Governance: study OPA Rego Policy Decision Graph for machine-readable policy checks, Feature Flag Control Plane for gated releases, and Software Supply Chain Provenance Graph for dependency evidence.',
            'Privacy: study PII Redaction Token Span Pipeline for privacy controls within the evidence chain.',
          ],
        },
      ],
    },
  ],
};

