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
    explanation: 'A red-team program starts with a taxonomy, not a bag of prompts. Each risk class becomes runnable tests, queue priority, severity labels, and evidence for release gates.',
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
    explanation: 'Queue rows track source taxonomy, severity, status, owner, and test freshness. Tool misuse and prompt injection usually deserve higher priority because they can cross from text into real authority.',
  };

  yield {
    state: redTeamGraph('Scoring turns failures into release gates'),
    highlight: { active: ['run', 'score', 'sev', 'gate', 'e-run-score', 'e-run-sev', 'e-score-gate', 'e-sev-gate'], found: ['fix', 'log'] },
    explanation: 'A failed red-team case should create a gate decision and a fix path: deny release, add a control, escalate to human review, or accept risk with documented rationale.',
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
    explanation: 'Red-team coverage decays as products, tools, policies, and attacker techniques change. A queue with stale-case alerts is better than a one-time report.',
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
    explanation: 'A coverage matrix exposes where the test program is thin. Admin and tool surfaces usually need stronger checks than plain chat because a failure can act on real systems.',
  };

  yield {
    state: redTeamGraph('Coverage gaps generate new queue work'),
    highlight: { active: ['tax', 'queue', 'gate', 'fix', 'e-tax-queue', 'e-gate-fix'], compare: ['score'], found: ['log'] },
    explanation: 'Coverage gaps should become queued work, not footnotes. The queue records the missing risk class, affected surface, owner, due date, and required evidence.',
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
    explanation: 'A malicious retrieved document tells the agent to ignore instructions and call a tool. The fix is not only a classifier; it includes source trust labels, tool least privilege, and a rerun proof.',
  };

  yield {
    state: redTeamGraph('Taxonomy links into audit evidence'),
    highlight: { active: ['tax', 'gate', 'log', 'e-gate-log'], found: ['fix'], compare: ['seed', 'queue'] },
    explanation: 'The final artifact is audit evidence: which risk class was tested, which product surface failed, what changed, and which rerun proved the control worked.',
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
      heading: 'What it is',
      paragraphs: [
        'An LLM red-team attack taxonomy queue converts security and safety taxonomies into a living evaluation program. Attack classes become test cases, severities, owners, gates, fixes, and audit evidence.',
        'Prompt Injection Threat Model explains the confused-deputy risk. LLM Guardrail Policy Engine explains enforcement. This module explains the test queue that keeps those controls honest as products and attacks change.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The queue stores taxonomy id, attack surface, seed prompt, mutation family, target capability, severity, scorer, owner, due date, run history, fix link, and rerun proof. A coverage matrix maps risk classes to product surfaces.',
        'A good queue separates prompt text from metadata. The prompt is the payload; the metadata is what makes the payload useful for release gates, regression tests, and audits.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start from sources such as OWASP LLM risks and MITRE ATLAS tactics. Convert each risk into test families. Run them against product surfaces, score failures, attach severity, and route failed cases into mitigation or explicit risk acceptance.',
        'The queue must be refreshed. A red-team report from last quarter can miss new tools, new RAG sources, new policies, and new attacker techniques. Staleness is a coverage attribute.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A RAG agent ingests a hostile document that instructs it to call an admin tool. The red-team queue tags this as indirect prompt injection, RAG surface, tool surface, high severity. The first run fails. The mitigation adds source trust labels, tool scope checks, and a guardrail gate. The rerun passes and the queue stores the proof.',
        'This is stronger than saying the model was jailbroken. It says which control boundary failed, which product surface was affected, and which evidence shows the fix worked.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not treat red-team prompts as a pile of scary strings. Without taxonomy ids, severity, product surface, and rerun history, the organization cannot measure coverage or regression. Do not let one broad safety score hide a critical tool-use failure.',
        'Another failure is stale severity. A harmless chat failure can become severe after the same model gains tool access. Severity belongs to the deployed system, not only the text output.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OWASP LLM01 Prompt Injection at https://genai.owasp.org/llmrisk/llm01-prompt-injection/, OWASP Top 10 for LLM Applications at https://owasp.org/www-project-top-10-for-large-language-model-applications/, MITRE ATLAS at https://atlas.mitre.org/, NIST AI RMF Playbook at https://airc.nist.gov/airmf-resources/playbook/, and NCSC prompt injection guidance at https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection.',
        'Study next: Jailbreak Mutation Search Graph Case Study, AI Safety Eval Slice Risk Register Case Study, LLM Guardrail Policy Engine, Prompt Injection Threat Model, LLM Evaluation Harnesses: Golden Sets and Judges, and AI Audit Evidence Packet Case Study.',
      ],
    },
  ],
};
