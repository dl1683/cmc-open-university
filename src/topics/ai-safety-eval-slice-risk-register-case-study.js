// AI safety eval slice risk register: map risk classes and deployment slices
// to eval cases, thresholds, owners, mitigations, and release decisions.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-safety-eval-slice-risk-register-case-study',
  title: 'AI Safety Eval Slice Risk Register Case Study',
  category: 'AI & ML',
  summary: 'A governance-to-evaluation case study: risk register rows, eval slices, thresholds, human labels, judge calibration, mitigation owners, and release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['risk register', 'slice gates'], defaultValue: 'risk register' },
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

function riskGraph(title) {
  return graphState({
    nodes: [
      { id: 'risk', label: 'risk', x: 0.7, y: 3.4, note: 'row' },
      { id: 'slice', label: 'slice', x: 2.3, y: 2.0, note: 'traffic' },
      { id: 'eval', label: 'eval', x: 2.3, y: 4.8, note: 'cases' },
      { id: 'human', label: 'hum', x: 4.0, y: 2.0, note: 'labels' },
      { id: 'judge', label: 'judge', x: 4.0, y: 4.8, note: 'score' },
      { id: 'thresh', label: 'thr', x: 5.8, y: 3.4, note: 'gate' },
      { id: 'mit', label: 'mit', x: 7.4, y: 2.0, note: 'owner' },
      { id: 'ship', label: 'ship', x: 7.4, y: 4.8, note: 'decide' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.4, note: 'packet' },
    ],
    edges: [
      { id: 'e-risk-slice', from: 'risk', to: 'slice' },
      { id: 'e-risk-eval', from: 'risk', to: 'eval' },
      { id: 'e-slice-human', from: 'slice', to: 'human' },
      { id: 'e-eval-judge', from: 'eval', to: 'judge' },
      { id: 'e-human-thresh', from: 'human', to: 'thresh' },
      { id: 'e-judge-thresh', from: 'judge', to: 'thresh' },
      { id: 'e-thresh-mit', from: 'thresh', to: 'mit' },
      { id: 'e-thresh-ship', from: 'thresh', to: 'ship' },
      { id: 'e-mit-audit', from: 'mit', to: 'audit' },
      { id: 'e-ship-audit', from: 'ship', to: 'audit' },
    ],
  }, { title });
}

function* riskRegister() {
  yield {
    state: riskGraph('Safety eval slice risk register'),
    highlight: { active: ['risk', 'slice', 'eval', 'human', 'judge', 'e-risk-slice', 'e-risk-eval', 'e-slice-human', 'e-eval-judge'], found: ['thresh'] },
    explanation: 'The graph turns a safety score into a release-control path. Each risk must connect to a traffic slice, eval cases, human anchors, judge scores, thresholds, owners, and a decision.',
    invariant: 'A safety score without a slice and risk owner is not a control.',
  };

  yield {
    state: labelMatrix(
      'Risk register rows',
      [
        { id: 'inj', label: 'inject' },
        { id: 'harm', label: 'harm' },
        { id: 'bias', label: 'bias' },
        { id: 'priv', label: 'priv' },
        { id: 'auto', label: 'agency' },
      ],
      [
        { id: 'slice', label: 'slice' },
        { id: 'thr', label: 'thr' },
        { id: 'owner', label: 'own' },
      ],
      [
        ['tool', '0', 'sec'],
        ['chat', 'low', 'safe'],
        ['hire', 'gap', 'ml'],
        ['RAG', '0', 'sec'],
        ['agent', 'low', 'prod'],
      ],
    ),
    highlight: { active: ['inj:thr', 'priv:thr', 'auto:thr'], compare: ['bias:thr'], found: ['inj:owner', 'priv:owner'] },
    explanation: 'The threshold column is slice-specific. A tool-injection failure may have zero tolerance, while a low-severity chat miss can route to monitoring or human review.',
  };

  yield {
    state: riskGraph('Human anchors calibrate judge gates'),
    highlight: { active: ['human', 'judge', 'thresh', 'e-human-thresh', 'e-judge-thresh'], compare: ['eval'], found: ['ship'] },
    explanation: 'The human and judge nodes meet at the gate. LLM judges are useful only when the register stores human agreement, judge version, slice thresholds, and drift checks.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'release week', min: 0, max: 8 }, y: { label: 'open high-risk gaps', min: 0, max: 12 } },
      series: [
        { id: 'raw', label: 'without register', points: [{ x: 0, y: 2 }, { x: 2, y: 5 }, { x: 4, y: 8 }, { x: 6, y: 10 }, { x: 8, y: 11 }] },
        { id: 'owned', label: 'owned register', points: [{ x: 0, y: 2 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 6, y: 2 }, { x: 8, y: 1 }] },
      ],
      markers: [
        { id: 'gate', x: 4, y: 3, label: 'gate' },
      ],
    }),
    highlight: { active: ['owned', 'gate'], compare: ['raw'] },
    explanation: 'The plot shows the cost of missing ownership. Aggregate scores can look stable while high-risk gaps accumulate; owned rows turn failures into scheduled work.',
  };
}

function* sliceGates() {
  yield {
    state: labelMatrix(
      'Release gate by slice',
      [
        { id: 'chat', label: 'chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'tool', label: 'tool' },
        { id: 'admin', label: 'admin' },
        { id: 'minor', label: 'minor' },
      ],
      [
        { id: 'eval', label: 'eval' },
        { id: 'hum', label: 'hum' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['pass', 'ok', 'ship'],
        ['pass', 'ok', 'ship'],
        ['fail', 'bad', 'hold'],
        ['fail', 'bad', 'hold'],
        ['gap', 'need', 'hold'],
      ],
    ),
    highlight: { active: ['chat:gate', 'rag:gate'], removed: ['tool:gate', 'admin:gate', 'minor:gate'], compare: ['minor:eval'] },
    explanation: 'The gate matrix blocks by critical slice, not average score. Admin, minor-user, and tool-use slices can hold a release even when broad chat tests pass.',
  };

  yield {
    state: riskGraph('Mitigation owners close slice gaps'),
    highlight: { active: ['thresh', 'mit', 'audit', 'e-thresh-mit', 'e-mit-audit'], compare: ['ship'], found: ['risk', 'slice'] },
    explanation: 'A failed gate moves to mitigation instead of becoming a footnote. The row names an owner and a concrete move: policy change, prompt boundary, tool scope, retrieval trust, labeling refresh, or rollback.',
  };

  yield {
    state: labelMatrix(
      'Complete case: hiring assistant',
      [
        { id: 'base', label: 'base' },
        { id: 'slice', label: 'slice' },
        { id: 'fix', label: 'fix' },
        { id: 'rerun', label: 'rerun' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'score', label: 'score' },
        { id: 'act', label: 'act' },
      ],
      [
        ['bias', 'fail', 'hold'],
        ['disab', 'fail', 'own'],
        ['rubric', 'pass', 'rerun'],
        ['slice', 'pass', 'ship'],
      ],
    ),
    highlight: { removed: ['base:act', 'slice:act'], active: ['fix:act', 'rerun:act'], found: ['rerun:score'] },
    explanation: 'The hiring case shows why averages are unsafe. General quality passes, but the disability-related slice fails, so the register blocks release, assigns mitigation, reruns that slice, and stores the proof.',
  };

  yield {
    state: riskGraph('Release decisions feed the audit packet'),
    highlight: { active: ['ship', 'audit', 'e-ship-audit'], found: ['thresh', 'mit'], compare: ['judge'] },
    explanation: 'The release edge writes into the audit packet. A reviewer should see why the release shipped, which slices were tested, which thresholds applied, which failures were fixed, and which residual risks were accepted.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'risk register') yield* riskRegister();
  else if (view === 'slice gates') yield* sliceGates();
  else throw new InputError('Pick an AI safety eval-slice view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for AI Safety Eval Slice Risk Register Case Study. A governance-to-evaluation case study: risk register rows, eval slices, thresholds, human labels, judge calibration, mitigation owners, and release gates..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An AI safety eval slice risk register exists because model risk is not evenly distributed across a product. A model can look acceptable on broad helpfulness tests while failing on tool use, medical advice, hiring, minors, privacy-sensitive retrieval, prompt injection, multilingual abuse, or administrative actions. One blended score hides the exact places where deployment can hurt users or create operational risk. The register is the data structure that connects risk governance to runnable evaluation. Each row names a risk, the deployment slice where it matters, the eval cases that measure it, the human labels that anchor judgment, the automated judge or metric version, the threshold, the mitigation owner, the release decision, and the evidence packet that explains the decision later. It turns safety from a slogan into a control surface.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is to run a standard eval suite and report an average pass rate. That is not foolish. A single score is easy to compare across model versions, easy to chart, and useful for catching obvious regressions. The wall appears when the product has uneven stakes. A 98 percent pass rate can still include every prompt injection case for an agent with payment access. A hiring assistant can pass general answer quality while failing prompts about disability accommodation. A customer-support model can pass English safety tests while failing a smaller language slice. The average is not a release control because it does not say which failure is allowed, who owns it, what threshold applies, or whether the failed slice can block launch.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that safety evaluation needs slice-level gates, not only model-level scores. A slice is a product-relevant subset of traffic or use: a user group, language, tool surface, domain, capability level, data source, or deployment mode. A gate is a rule that decides whether that slice can ship. The invariant is simple: no high-risk slice is green without an explicit threshold, evidence, owner, and residual-risk rationale. The register row is the unit of accountability. It links the abstract risk name to the concrete eval cases and the concrete deployment decision. That link is what governance frameworks need in practice. Without it, teams can have risk taxonomies, red-team reports, and dashboards while still lacking a release mechanism.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with a risk taxonomy that is specific enough to act on: prompt injection, harmful advice, privacy leakage, discrimination, unauthorized tool action, sycophancy, jailbreak success, child-safety failure, or domain-specific legal and medical overreach. Map each risk to product slices where it can occur. Attach eval cases that exercise the failure mode, and label a representative set with humans so automated judges have a calibration target. Store the judge prompt, judge model, metric version, label agreement, threshold, and date because judges drift and labels change as policy changes. Run the gate before release. If a row fails, assign a mitigation owner and an action: policy edit, retrieval filter, tool permission change, refusal rubric change, training data fix, UX guardrail, or rollback.',
        'The register should connect to the rest of the release system. Feature flags should know which slices are blocked. Canary monitoring should report back into the same risk rows. Incident review should reference the row that failed or the missing row that should have existed. Audit packets should record the model version, eval version, slice definition, threshold, failure examples, mitigation, rerun result, and residual risk accepted by the release owner. The register can live in a database, spreadsheet, YAML file, or governance tool, but it must behave like structured state. Free-form notes are not enough because the release process needs stable fields for blocking, reporting, ownership, and review.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is not mathematical correctness in the way binary search has a sorted-array proof. It is control correctness. The register works when every deployment decision can be traced backward from ship or hold to slice result, threshold, evidence, owner, and accepted residual risk. That trace prevents the two common governance failures: unlabeled gaps and ownerless failures. If a slice has no cases, the row cannot be green. If a judge score has no human anchor, the confidence is limited. If a failure has no owner, it cannot silently age into accepted risk. If an owner accepts residual risk, that decision is visible. The register does not guarantee a safe model. It guarantees that the release process cannot honestly claim ignorance about known measured gaps.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The graph view shows the path from a risk row to a release decision. Risk names alone do not control anything; they become operational only after they connect to slices, eval cases, human anchors, judge scores, thresholds, mitigation owners, and audit evidence. The matrix view shows why the gate is slice-specific. Broad chat may pass while tool-use, admin, minor-user, or hiring slices hold the release. The plot shows the failure mode of score-only governance: open high-risk gaps can accumulate while a blended score looks stable. The hiring example makes the lesson concrete. General quality passes, but the disability-related slice fails, so the register blocks release, assigns a mitigation, reruns that slice, and stores the proof.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is maintenance. Slices multiply quickly, and each slice needs enough cases to mean something. Human labels are expensive. Judge calibration has to be rerun when the judge model, rubric, product, or user population changes. Thresholds require judgment because zero tolerance is right for some risks and wasteful or impossible for others. A register can also create false precision. A green row means the defined tests passed under the defined threshold; it does not mean the risk is gone. The practical design is to keep the register small enough to operate and explicit enough to block real failures. High-stakes slices need tight gates. Lower-risk slices may use monitoring, canaries, or human review instead of hard launch blocks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This structure fits products where model behavior changes release risk by context. AI agents with tools need slices for permissions, state-changing actions, prompt injection, and authorization boundaries. Retrieval systems need slices for sensitive documents, stale sources, private data, and citation support. Hiring, lending, education, healthcare, and child-facing products need user-group and domain slices because harms are concentrated. Frontier-model labs need capability categories, thresholds, safeguards, and escalation rules. Enterprise teams need the audit trail because customers, regulators, and internal review boards ask why a release shipped. The access pattern is repeated decision-making under changing model versions. A register lets the team compare version A and version B by risk row instead of arguing over one aggregate score.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The register fails when it becomes theater. Stale slices, vague owners, inherited thresholds, missing label quality, unversioned judge prompts, and residual-risk approvals without rationale all weaken the control. It also fails when teams treat missing data as a pass. Unknown means unknown; the row should say gap, not green. Another failure is overfitting to the eval set. A model can learn the known cases while still failing the real product. The register must be paired with red-team discovery, incident intake, production monitoring, and periodic slice refresh. It is also the wrong tool for deciding product values by itself. It can record the threshold and owner, but humans still choose what risk appetite is acceptable.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references are the NIST AI Risk Management Framework at https://www.nist.gov/itl/ai-risk-management-framework, OpenAI Preparedness Framework version 2 at https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf, Anthropic Responsible Scaling Policy updates at https://www.anthropic.com/responsible-scaling-policy, and Google SAIF at https://saif.google/ with risks and controls at https://saif.google/secure-ai-framework/risks and https://saif.google/secure-ai-framework/controls. Study LLM judge calibration, human evaluation labeling queues, red-team attack taxonomies, jailbreak mutation search, incident corrective-action ledgers, AI audit evidence packets, prompt injection threat models, and release engineering with feature flags next. The most useful mental model is that evaluation cases measure behavior, slices localize risk, and the register decides what the organization is allowed to ship.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
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
        'Use this topic as a checkpoint: if you can explain why AI Safety Eval Slice Risk Register Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

