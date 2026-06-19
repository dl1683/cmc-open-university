// LLM red-team taxonomy queue: turn attack classes into runnable tests,
// severity labels, coverage gaps, and guardrail regression evidence.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-red-team-attack-taxonomy-queue-case-study',
  title: 'LLM Red-Team Attack Taxonomy Queue Case Study',
  category: 'AI & ML',
  summary: 'A safety-evaluation case study: map OWASP and MITRE-style attack classes into red-team queues, severity labels, coverage matrices, and release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['taxonomy queue', 'coverage matrix'], defaultValue: 'taxonomy queue' },
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

function redTeamGraph(title) {
  return graphState({
    nodes: [
      { id: 'tax', label: 'tax', x: 0.7, y: 3.4, note: 'risks' },
      { id: 'seed', label: 'seed', x: 2.2, y: 2.0, note: 'cases' },
      { id: 'queue', label: 'queue', x: 2.2, y: 4.8, note: 'work' },
      { id: 'run', label: 'run', x: 4.0, y: 3.4, note: 'eval' },
      { id: 'score', label: 'score', x: 5.7, y: 2.0, note: 'judge' },
      { id: 'sev', label: 'sev', x: 5.7, y: 4.8, note: 'risk' },
      { id: 'gate', label: 'gate', x: 7.4, y: 3.4, note: 'ship' },
      { id: 'fix', label: 'fix', x: 9.0, y: 2.0, note: 'ctrl' },
      { id: 'log', label: 'log', x: 9.0, y: 4.8, note: 'proof' },
    ],
    edges: [
      { id: 'e-tax-seed', from: 'tax', to: 'seed' },
      { id: 'e-tax-queue', from: 'tax', to: 'queue' },
      { id: 'e-seed-run', from: 'seed', to: 'run' },
      { id: 'e-queue-run', from: 'queue', to: 'run' },
      { id: 'e-run-score', from: 'run', to: 'score' },
      { id: 'e-run-sev', from: 'run', to: 'sev' },
      { id: 'e-score-gate', from: 'score', to: 'gate' },
      { id: 'e-sev-gate', from: 'sev', to: 'gate' },
      { id: 'e-gate-fix', from: 'gate', to: 'fix' },
      { id: 'e-gate-log', from: 'gate', to: 'log' },
    ],
  }, { title });
}

function* taxonomyQueue() {
  yield {
    state: redTeamGraph('Red-team taxonomy queue'),
    highlight: { active: ['tax', 'seed', 'queue', 'run', 'e-tax-seed', 'e-tax-queue', 'e-seed-run', 'e-queue-run'], found: ['gate'] },
    explanation: 'The graph starts from a taxonomy so prompts do not become loose anecdotes. Each risk class turns into runnable cases, queue priority, severity, and release evidence.',
    invariant: 'Unlabeled adversarial prompts are anecdotes; taxonomy-linked cases are test assets.',
  };

  yield {
    state: labelMatrix(
      'Attack class queue',
      [
        { id: 'inj', label: 'inject' },
        { id: 'leak', label: 'leak' },
        { id: 'tool', label: 'tool' },
        { id: 'rag', label: 'rag' },
        { id: 'poison', label: 'poison' },
      ],
      [
        { id: 'src', label: 'src' },
        { id: 'sev', label: 'sev' },
        { id: 'act', label: 'act' },
      ],
      [
        ['OWASP', 'high', 'run'],
        ['ATLAS', 'high', 'run'],
        ['OWASP', 'crit', 'run'],
        ['OWASP', 'med', 'add'],
        ['ATLAS', 'high', 'add'],
      ],
    ),
    highlight: { active: ['inj:act', 'leak:act', 'tool:act'], compare: ['rag:act', 'poison:act'], found: ['tool:sev'] },
    explanation: 'The queue row adds the metadata the prompt cannot carry: taxonomy source, severity, status, owner, and freshness. Tool misuse and prompt injection rise in priority because failure can cross from text into real authority.',
  };

  yield {
    state: redTeamGraph('Scoring turns failures into release gates'),
    highlight: { active: ['run', 'score', 'sev', 'gate', 'e-run-score', 'e-run-sev', 'e-score-gate', 'e-sev-gate'], found: ['fix', 'log'] },
    explanation: 'A failed case now reaches the gate instead of staying in a report. The release decision must deny, mitigate, escalate, or accept the risk with written rationale.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'coverage age, days', min: 0, max: 90 }, y: { label: 'open severe cases', min: 0, max: 20 } },
      series: [
        { id: 'base', label: 'baseline', points: [{ x: 0, y: 3 }, { x: 20, y: 4 }, { x: 45, y: 8 }, { x: 70, y: 13 }, { x: 90, y: 18 }] },
        { id: 'refresh', label: 'refresh queue', points: [{ x: 0, y: 3 }, { x: 20, y: 3 }, { x: 45, y: 4 }, { x: 70, y: 5 }, { x: 90, y: 7 }] },
      ],
      markers: [
        { id: 'stale', x: 45, y: 8, label: 'stale' },
      ],
    }),
    highlight: { active: ['refresh', 'stale'], compare: ['base'] },
    explanation: 'The plot shows coverage decay. Products gain tools, policies change, and attackers adapt, so stale cases undercount risk even when yesterday\'s report looked complete.',
  };
}

function* coverageMatrix() {
  yield {
    state: labelMatrix(
      'Coverage by risk and surface',
      [
        { id: 'chat', label: 'chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'tool', label: 'tool' },
        { id: 'code', label: 'code' },
        { id: 'admin', label: 'admin' },
      ],
      [
        { id: 'inj', label: 'inj' },
        { id: 'leak', label: 'leak' },
        { id: 'misuse', label: 'mis' },
        { id: 'drift', label: 'drift' },
      ],
      [
        ['pass', 'pass', 'gap', 'old'],
        ['fail', 'pass', 'gap', 'old'],
        ['fail', 'fail', 'gap', 'new'],
        ['pass', 'pass', 'pass', 'old'],
        ['fail', 'fail', 'fail', 'new'],
      ],
    ),
    highlight: { removed: ['rag:inj', 'tool:inj', 'tool:leak', 'admin:inj', 'admin:leak', 'admin:misuse'], compare: ['chat:misuse', 'rag:misuse', 'tool:misuse'], active: ['admin:drift'] },
    explanation: 'The matrix makes missing coverage visible by surface. Admin and tool rows need stricter gates than plain chat because a failed test can trigger real actions.',
  };

  yield {
    state: redTeamGraph('Coverage gaps generate new queue work'),
    highlight: { active: ['tax', 'queue', 'gate', 'fix', 'e-tax-queue', 'e-gate-fix'], compare: ['score'], found: ['log'] },
    explanation: 'A gap becomes work only when it enters the queue. The row records the missing risk class, affected surface, owner, due date, and proof required to close it.',
  };

  yield {
    state: labelMatrix(
      'Complete case: indirect prompt injection',
      [
        { id: 'doc', label: 'doc' },
        { id: 'rag', label: 'RAG' },
        { id: 'agent', label: 'agent' },
        { id: 'gate', label: 'gate' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'score', label: 'score' },
        { id: 'act', label: 'act' },
      ],
      [
        ['bad doc', 'fail', 'block'],
        ['cite', 'weak', 'fix'],
        ['tool', 'fail', 'least'],
        ['rerun', 'pass', 'ship'],
      ],
    ),
    highlight: { active: ['doc:act', 'rag:act', 'agent:act', 'gate:act'], removed: ['doc:score', 'agent:score'], found: ['gate:score'] },
    explanation: 'The indirect-injection row shows a boundary failure: untrusted retrieved text steers a privileged tool call. The fix needs source trust labels, least-privilege tooling, and a rerun proof, not just a better refusal phrase.',
  };

  yield {
    state: redTeamGraph('Taxonomy links into audit evidence'),
    highlight: { active: ['tax', 'gate', 'log', 'e-gate-log'], found: ['fix'], compare: ['seed', 'queue'] },
    explanation: 'The queue finally feeds audit evidence. A useful record says which risk class was tested, which surface failed, what changed, and which rerun proved the control worked.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'taxonomy queue') yield* taxonomyQueue();
  else if (view === 'coverage matrix') yield* coverageMatrix();
  else throw new InputError('Pick an LLM red-team queue view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for LLM Red-Team Attack Taxonomy Queue Case Study. A safety-evaluation case study: map OWASP and MITRE-style attack classes into red-team queues, severity labels, coverage matrices, and release gates..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why it exists',
      paragraphs: [
        'An LLM red-team attack taxonomy queue turns broad safety and security risks into work that can be run, scored, fixed, and audited. A product team does not only need a list of scary prompts. It needs to know which risk classes have been tested, which product surfaces were in scope, which failures are severe enough to block a release, and which mitigations have passed reruns.',
        'LLM systems make this harder than older input-validation work because the risky boundary is spread across prompts, retrieved documents, tool calls, memory, policies, user permissions, and model behavior. Prompt Injection Threat Model explains the confused-deputy risk. LLM Guardrail Policy Engine explains enforcement. This topic explains the evaluation queue that keeps those controls honest after the first launch.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The reasonable first attempt is a spreadsheet or folder of jailbreak prompts. That works for a demo because a human can run a few cases and show dramatic failures. It fails for release engineering because the prompt text does not say which taxonomy item it covers, which surface it attacks, how severe the failure is, who owns the fix, or whether the same case passed after the mitigation changed.',
        'The wall is coverage. A team can have thousands of prompts and still miss indirect prompt injection in RAG, tool misuse under a new permission model, sensitive-data leakage in a support flow, or policy drift after a system prompt update. Count of prompts is not count of risk. A stale red-team report can be worse than no report because it creates confidence while the product has gained new capabilities.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that an adversarial prompt is the payload, not the evidence. Evidence is the record around the payload: taxonomy id, attack surface, seed family, mutation strategy, target capability, severity, scorer, owner, due date, run history, fix link, and rerun proof. Without that record, a failure is an anecdote. With it, the same failure becomes a release gate and a regression test.',
        'The queue also separates two questions that are often mixed together. The first question is whether the model or system failed on this case. The second is whether the evaluation program covers the risk space well enough for the next release. The coverage matrix answers the second question by mapping risk classes to product surfaces and making gaps visible.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The graph view shows the control flow that a useful red-team program needs. Taxonomy creates seed cases and queue work. Runs produce scores and severity labels. Those labels reach a release gate instead of stopping in a report. The gate then produces either a fix, an explicit risk decision, or a proof log that can be inspected later.',
        'The matrix view shows the data shape behind that control flow. Rows are attack surfaces such as chat, RAG, tools, code, and admin actions. Columns are risk classes such as injection, leakage, misuse, and drift. A highlighted cell is not decorative state; it says this boundary was tested, failed, is stale, or has no coverage yet. That is what the animation proves: the system is measuring coverage by risk and surface, not by prompt volume.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'A practical queue starts from a taxonomy source such as OWASP LLM risks, MITRE ATLAS tactics, internal incident classes, customer commitments, and product-specific threat models. Each taxonomy item becomes one or more test families. A family stores seed prompts, mutation rules, target surfaces, expected unsafe behaviors, and criteria for pass, fail, or escalation.',
        'The runner executes cases against concrete product surfaces, not an abstract model in isolation. The same text can have different severity in plain chat, document retrieval, code generation, and tool execution. A tool-use failure can cross from bad text into real authority, so the row records the surface and permission context. Scores then become queue actions: block the release, assign a mitigation, add a missing case, accept the risk with rationale, or schedule a refresh.',
        'Refresh is part of the algorithm. New tools, new documents, new system prompts, new policies, new models, and new attack patterns all change the risk boundary. The queue should age cases, mark stale coverage, and re-run high-severity slices after relevant product changes. A passing result is only valid for the contract it tested.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant: every release decision should be traceable to current cases, current surfaces, severity labels, and rerun proof. The queue preserves that invariant by making a failed case impossible to close with only a note. Closure needs a reason: fixed and rerun, intentionally accepted, moved to a different owner, or blocked by missing evidence.',
        'The coverage matrix gives a second invariant. If a product surface exists and a taxonomy risk applies to it, there should be a cell with a status. Empty cells are not neutral. They are unknown risk. This does not prove the system is safe against every attack, but it prevents a common false proof: treating a pile of successful prompts as evidence that the untested surface is covered.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is maintenance. Taxonomies change, product surfaces change, and scorers drift. A serious queue needs ownership, freshness rules, replayable runs, threshold calibration, and human review for cases where automated judges are weak. It also needs careful severity rules so a broad chat failure does not hide a tool-use failure with higher blast radius.',
        'The tradeoff is between speed and confidence. Running every case on every build is expensive and noisy, so teams usually tier the queue: small smoke slices on every change, high-risk regression slices before release, broader scheduled sweeps, and manual campaigns after major capability changes. The queue should make that sampling policy visible instead of pretending that a small run proves full coverage.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A RAG agent ingests a hostile document that says the assistant should ignore developer instructions and call an admin export tool. The queue tags the case as indirect prompt injection, RAG surface, tool surface, high severity, and source-trust boundary. The first run fails because the retrieved text steers the tool call.',
        'The mitigation adds source trust labels, least-privilege tool scopes, an instruction-hierarchy guardrail, and a gate that requires trusted user intent before privileged actions. The rerun passes. The queue stores the failing run, the control change, the passing rerun, and the release decision. This is stronger than saying the model was jailbroken because it names the boundary that failed and the proof that the boundary was repaired.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits teams that ship LLM features with changing product surfaces: RAG assistants, tool-using agents, code assistants, admin copilots, customer-support bots, and model routes with policy or compliance obligations. It is especially useful when several teams own different parts of the risk boundary because the queue can assign work and preserve evidence across product, security, ML, and policy review.',
        'It also fits benchmark and guardrail development. The taxonomy queue tells guardrail engineers which failure families matter, tells eval owners where coverage is old, and tells release managers whether severe failures are open. The structure makes red-team work cumulative instead of episodic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A taxonomy queue can still fail by becoming paperwork. If cases are low quality, labels are vague, scorers are uncalibrated, or owners close rows without rerun proof, the queue only gives a cleaner illusion of safety. It can also fail by overfitting to known prompt forms while missing new attack strategies.',
        'Another failure is stale severity. A harmless chat failure can become severe after the same model gains tool access. Severity belongs to the deployed system, not only to the text output. The cost of skipping this distinction is a release gate that passes the wrong thing.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: OWASP LLM01 Prompt Injection at https://genai.owasp.org/llmrisk/llm01-prompt-injection/, OWASP Top 10 for LLM Applications at https://owasp.org/www-project-top-10-for-large-language-model-applications/, MITRE ATLAS at https://atlas.mitre.org/, NIST AI RMF Playbook at https://airc.nist.gov/airmf-resources/playbook/, and NCSC prompt injection guidance at https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection.',
        'Study next by role. For threat modeling, read Prompt Injection Threat Model and Jailbreak Mutation Search Graph Case Study. For enforcement, read LLM Guardrail Policy Engine. For measurement, read LLM Evaluation Harnesses: Golden Sets and Judges and LLM Judge Calibration Drift Monitor. For governance, read AI Safety Eval Slice Risk Register Case Study and AI Audit Evidence Packet Case Study.',
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
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
        'Use this topic as a checkpoint: if you can explain why LLM Red-Team Attack Taxonomy Queue Case Study moves from input to output in the animation and where it fails, you are ready for the next topic.',
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
