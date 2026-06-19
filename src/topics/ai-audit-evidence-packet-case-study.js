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
        "Read the animation as the execution trace for AI Audit Evidence Packet Case Study. Turn AI governance into a data structure: risk register, technical file, eval proofs, monitoring, incidents, and corrective actions..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An AI audit evidence packet exists because AI risk is easy to describe and hard to inspect. A team can say that a model is fair, safe, monitored, and human-reviewed, but a reviewer needs to know which release, which data, which eval suite, which slices, which controls, which incident queue, and which owner support that claim. Without that trail, governance becomes memory plus meetings.',
        'The packet is a versioned data structure for that trail. It links intended use, risk register rows, data lineage, model versions, evaluation results, guardrail decisions, monitoring signals, incident records, corrective actions, and technical documentation. This page is engineering guidance, not legal advice. The durable software lesson is that auditability comes from traceable evidence, not from a nicer dashboard.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The reasonable first attempt is a folder of governance artifacts: a model card, an eval spreadsheet, a data sheet, a risk register, a monitoring dashboard, and an incident tracker. Each document has value. A model card can explain purpose. An eval report can show measurements. A dashboard can expose drift. A ticket queue can track fixes.',
        'The wall appears when someone asks a release-specific question. Why was model version 23 allowed into hiring triage on May 14? Which protected-slice failures were still open? Which data source changed? Which complaints later proved the assumption wrong? Separate documents answer fragments. They do not preserve the join between claim, artifact, owner, version, decision, and live outcome.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat audit evidence as a graph with typed rows, not as a narrative. Each claim points to proof. Each proof has a source, owner, timestamp, version, and freshness rule. Each risk row keeps harm, cause, control, metric, owner, status, due date, and evidence id together. If any of those fields are missing, the row cannot safely block or approve a release.',
        'This changes the review question from "does the team sound prepared?" to "can this sampled claim be replayed?" A useful packet lets an auditor start from intended use, follow edges through risk and data, inspect the model and eval evidence, check the deployed controls, and verify whether later incidents changed the next gate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with scope. The intended-use record says what the system is for, what it must not be used for, who depends on it, and what decision it influences. That scope feeds the risk register. A chatbot that drafts marketing copy, a medical triage model, and a resume-ranking assistant should not share the same risk rows just because all three use machine learning.',
        'Next attach evidence to every risk. Data lineage says where training, evaluation, retrieval, and feedback data came from. The model record names the architecture, checkpoint, prompt or policy version, retrieval index, dependency versions, and release hash. The eval ledger stores cases, slices, scorers, scorecards, seeds, thresholds, and human-audit samples. Controls record guardrails, human review, fallback paths, policy checks, and release approvals.',
        'After launch, the packet stays alive. Monitoring adds live SLO failures, drift checks, complaints, abuse probes, near misses, serious incidents, and downstream reports. Triage updates risk rows. Corrective action updates eval cases, guardrail rules, release checklists, model cards, and monitoring thresholds. The point is not to collect more paperwork; the point is to keep the next decision tied to the last failure.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The graph view shows the main invariant: auditable means traceable from claim to evidence. The use node is not decoration. It determines which risks matter. The risk, data, model, eval, and control nodes are not independent documents. Their edges show whether a reviewer can move from a product claim to the artifacts that would prove or weaken it.',
        'The matrix views show why an audit packet needs indexes. A reviewer cannot sample vague prose. They need rows with artifact names, proof pointers, owners, versions, source systems, and freshness dates. The plot adds the operational test: if open risks rise while fixes lag, the packet is documenting exposure rather than controlling it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The packet works when it preserves three invariants. First, every high-level claim has a proof path. Second, every proof path is versioned enough to replay the decision that used it. Third, post-release evidence can change future gates. If those invariants hold, audit review becomes sampling and replay instead of trust in a slide deck.',
        'Correctness here is not mathematical correctness of the AI model. It is process correctness. A release decision is inspectable when the inputs to that decision are still available, tied to the right system version, and connected to the risk they were meant to control. A finding is closed only when the corrective action has evidence, not when a meeting note says someone will handle it.',
      ],
    },
    {
      heading: 'Standards and regulatory shape',
      paragraphs: [
        'NIST AI RMF frames AI risk management around trustworthiness across design, development, use, and evaluation: https://www.nist.gov/itl/ai-risk-management-framework. NIST AI 600-1 adapts the AI RMF to generative AI and emphasizes governance, content provenance, testing, and incident disclosure: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf. ISO/IEC 42001 describes an AI management system for establishing, implementing, maintaining, and continually improving AI governance: https://www.iso.org/standard/42001.',
        'The EU AI Act is useful as a concrete evidence model even outside Europe. The European Commission AI Act Service Desk summarizes Article 11 as requiring technical documentation for high-risk AI systems before market release and keeping it up to date: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-11. Article 72 covers post-market monitoring plans: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-72. Article 73 covers serious-incident reporting: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-73. The engineering pattern is stable: owners, versions, evidence pointers, monitoring hooks, and corrective-action state belong in one queryable packet.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is maintenance. Evidence pointers rot, owners change teams, eval suites drift away from real use, and monitoring can collect more data than anyone reviews. A good packet needs schema discipline, access control, retention rules, tamper-evident logs, privacy boundaries, and enough automation that updates happen during normal engineering work.',
        'There is also a product tradeoff. If the gate is too heavy, teams route around it. If it is too light, it approves systems on averages and promises. The packet should focus on decisions with real risk: release approval, model replacement, data refresh, threshold change, incident closure, and vendor acceptance. Low-risk experiments can use a lighter version of the same structure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Evidence packets are useful for high-impact domains such as hiring, credit, medical triage, education, public benefits, legal research, safety tooling, and enterprise agents that act across sensitive data. They also help internal platform teams because model releases, guardrail changes, eval regressions, feature flags, and incidents all become part of one operational record.',
        'They are especially useful when third parties sample evidence. A vendor review, regulator, security team, procurement team, or customer auditor should not need private tribal knowledge. They should be able to pick a claim, sample a proof, check its version, and see whether later monitoring changed the risk decision.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A packet does not make a bad system safe. It can expose missing evidence, stale controls, weak evals, or unowned risks, but it cannot create competence after the fact. Common failures include treating a model card as the whole audit, hiding slice failures behind averages, handpicking logs, closing findings with promises, keeping incidents outside the risk register, and freezing the packet after launch.',
        'It also fails when the risk taxonomy is copied from another domain. A resume-ranking assistant, a code-generation tool, and a clinical summarizer need different harms, thresholds, human review rules, and monitoring signals. The packet structure can be shared; the risk content must match the system.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study LLM Evaluation Harnesses for reproducible eval ledgers, Human Evaluation Labeling Queue for reviewer workflows, LLM Judge Calibration and Drift Monitor for score reliability, LLM Guardrail Policy Engine for control evidence, Prompt Injection Threat Model for adversarial risk, Training-Serving Skew Replay Diff for release replay, Benchmark Variance and Model Selection for uncertainty, Data Leakage and Contamination for data evidence, PII Redaction Token Span Pipeline for privacy controls, Claim Graph Source Ledger for provenance, Distributed Tracing for runtime evidence, Feature Flag Control Plane for gated releases, SLO Error Budget Burn Rate Alert for live monitoring, OPA Rego Policy Decision Graph for policy checks, Software Supply Chain Provenance Graph for dependency evidence, and AIOps Incident Response for corrective-action loops.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why AI Audit Evidence Packet Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

