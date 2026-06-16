// Agent harness portability audit: perturb the interface and environment to
// distinguish real competence from harness-specific habits.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-harness-portability-audit',
  title: 'Agent Harness Portability Audit',
  category: 'AI & ML',
  summary: 'A test matrix for coding agents: change harnesses, tools, edit formats, shells, languages, and budgets to expose environment overfitting.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shift matrix', 'audit loop'], defaultValue: 'shift matrix' },
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

function auditGraph(title) {
  return graphState({
    nodes: [
      { id: 'baseline', label: 'baseline', x: 0.8, y: 3.6, note: 'native' },
      { id: 'perturb', label: 'perturb', x: 2.7, y: 2.0, note: 'shift' },
      { id: 'rerun', label: 'rerun', x: 4.5, y: 2.0, note: 'same tasks' },
      { id: 'trace', label: 'trace diff', x: 6.3, y: 3.6, note: 'where?' },
      { id: 'classify', label: 'classify', x: 8.0, y: 2.0, note: 'failure' },
      { id: 'fix', label: 'fix data', x: 8.0, y: 5.2, note: 'train/audit' },
      { id: 'report', label: 'report', x: 9.5, y: 3.6, note: 'slices' },
    ],
    edges: [
      { id: 'e-baseline-perturb', from: 'baseline', to: 'perturb' },
      { id: 'e-perturb-rerun', from: 'perturb', to: 'rerun' },
      { id: 'e-rerun-trace', from: 'rerun', to: 'trace' },
      { id: 'e-trace-classify', from: 'trace', to: 'classify' },
      { id: 'e-classify-fix', from: 'classify', to: 'fix' },
      { id: 'e-fix-perturb', from: 'fix', to: 'perturb', weight: 'repeat' },
      { id: 'e-classify-report', from: 'classify', to: 'report' },
    ],
  }, { title });
}

function* shiftMatrix() {
  yield {
    state: labelMatrix(
      'Portability perturbation matrix',
      [
        { id: 'harness', label: 'harness' },
        { id: 'tools', label: 'tools' },
        { id: 'edit', label: 'edit' },
        { id: 'shell', label: 'shell' },
        { id: 'lang', label: 'lang' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'shift', label: 'shift' },
        { id: 'symptom', label: 'symptom' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['runner', 'ritual', 'delta'],
        ['helper', 'panic', 'fallbk'],
        ['diff', 'patch', 'apply'],
        ['pwsh', 'cmd', 'ops'],
        ['Py/JS', 'sem', 'split'],
        ['retry-', 'crutch', 'curve'],
      ],
    ),
    highlight: { active: ['harness:shift', 'tools:shift', 'edit:shift', 'budget:shift'], found: ['harness:gate', 'edit:gate', 'budget:gate'] },
    explanation: 'A portability audit changes the agent environment while keeping the task family stable. If performance collapses, the model may have learned harness rituals rather than transferable operations.',
    invariant: 'Evaluate the model plus interface, then perturb the interface.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'audit condition', min: 0, max: 5 }, y: { label: 'resolved tasks, illustrative percent', min: 0, max: 75 } },
      series: [
        { id: 'pass-rate', label: 'pass rate', points: [
          { x: 0, y: 66 }, { x: 1, y: 50 }, { x: 2, y: 54 }, { x: 3, y: 43 }, { x: 4, y: 58 },
        ] },
      ],
      markers: [
        { id: 'base', x: 0, y: 66, label: 'native' },
        { id: 'harness', x: 1, y: 50, label: 'new harness' },
        { id: 'tools', x: 2, y: 54, label: 'fewer tools' },
        { id: 'scaffold', x: 3, y: 43, label: 'new scaffold' },
        { id: 'budget', x: 4, y: 58, label: 'lower budget' },
      ],
    }),
    highlight: { active: ['pass-rate'], found: ['harness', 'tools', 'scaffold'], compare: ['base'] },
    explanation: 'The exact numbers are task-specific, but the shape is the lesson: a strong native score can hide sharp drops under harness, tool, scaffold, or budget shifts.',
  };

  yield {
    state: labelMatrix(
      'Failure classification',
      [
        { id: 'plan', label: 'planning' },
        { id: 'bind', label: 'binding' },
        { id: 'sem', label: 'semantics' },
        { id: 'oracle', label: 'oracle' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'trace sign', label: 'trace sign' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['wrong file', 'better search'],
        ['right intent bad tool', 'op graph'],
        ['wrong behavior', 'more traces'],
        ['tests mislead', 'oracle audit'],
        ['runs out', 'budget policy'],
      ],
    ),
    highlight: { active: ['bind:trace sign', 'bind:fix'], compare: ['plan:fix', 'oracle:fix'] },
    explanation: 'Trace diffs tell you what failed. A binding failure means the agent had the right intent but used the local tool wrong. That needs different data than a planning or semantic failure.',
  };
}

function* auditLoop() {
  yield {
    state: auditGraph('Run the native harness, then perturb it'),
    highlight: { active: ['baseline', 'perturb', 'rerun', 'e-baseline-perturb', 'e-perturb-rerun'], compare: ['report'] },
    explanation: 'Start with the native score, then rerun the same task family under controlled shifts. The audit is comparative; a single pass rate cannot identify harness overfit.',
  };

  yield {
    state: auditGraph('Trace diffs locate the portability break'),
    highlight: { active: ['rerun', 'trace', 'classify', 'e-rerun-trace', 'e-trace-classify'], found: ['fix'] },
    explanation: 'Compare traces, not only final scores. Did the agent search different files, fail to apply patches, misread shell output, skip tests, or stop early?',
  };

  yield {
    state: auditGraph('Fix the data or interface, then repeat'),
    highlight: { active: ['classify', 'fix', 'perturb', 'e-classify-fix', 'e-fix-perturb'], found: ['report'] },
    explanation: 'The audit loop feeds back into training data, tool schemas, operation graphs, and eval slices. Portability is not a one-time claim; it is a regression suite.',
  };

  yield {
    state: labelMatrix(
      'Report slices',
      [
        { id: 'native', label: 'native' },
        { id: 'aci', label: 'new ACI' },
        { id: 'tools', label: 'less tools' },
        { id: 'lang', label: 'new lang' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'claim', label: 'claim allowed' },
      ],
      [
        ['high', 'native strength'],
        ['medium', 'interface sensitive'],
        ['medium', 'tool dependent'],
        ['low', 'semantic gap'],
        ['curve', 'cost aware'],
      ],
    ),
    highlight: { active: ['native:claim', 'aci:claim', 'tools:claim', 'lang:claim', 'budget:claim'] },
    explanation: 'A serious report names the slice. Native strength, interface sensitivity, tool dependence, language transfer, and budget curves are different claims.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shift matrix') yield* shiftMatrix();
  else if (view === 'audit loop') yield* auditLoop();
  else throw new InputError('Pick an agent portability view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An Agent Harness Portability Audit tests whether an agent learned transferable operations or only the quirks of one environment. It perturbs the harness, tool set, edit grammar, shell, language, timeout, and retry budget while holding the task family as steady as possible.',
        'This is the evaluation companion to Abstract Agent Operation Graph. If an agent works only when edit means one exact plugin and run means one exact shell, the benchmark is measuring a model-interface pair, not general coding competence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The audit starts with a baseline run in the native harness. Then it reruns matched tasks under controlled shifts: different agent-computer interface, fewer tools, diff versus whole-file edits, bash versus PowerShell, Python versus JavaScript or Rust, lower turn budget, or stricter hidden tests. The final score matters, but the trace diff matters more.',
        'Trace diffs classify failures. A planning failure chooses the wrong file. A binding failure has the right intent but fails to express it through the local tool. A semantic failure misunderstands program behavior. An oracle failure optimizes the wrong test. A budget failure depends on retries that are too expensive for production.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Portability audits cost more than one leaderboard run because they multiply environments. The payoff is sharper claims. A team can say where the agent is robust, where it is interface-sensitive, and where it needs more diverse training traces. That matters because CWM-style execution training can improve native behavior while still overfitting to the simulator ecosystem.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A coding-agent team reports 66 percent on its native SWE-style harness. The portability audit reruns a matched subset with a different ACI, with edit helpers removed, with a whole-file patch API, with lower retry budget, and with a JavaScript task split. The native score is no longer the product claim. The claim becomes a scorecard: native strength, interface sensitivity, tool dependence, language transfer, and budget sensitivity.',
        'The local Code World Models notes emphasize drops under harness changes, tool restrictions, and scaffold changes. SWE-agent makes the same point from a constructive angle: agent-computer interface design strongly affects performance. Therefore the interface is part of the experiment.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not average portability slices into one happy number. A product failure usually appears in a slice: Windows shell, monorepo search, flaky tests, unknown framework, low budget, private dependencies, or a different edit API. Do not treat a model score as independent of its harness. Do not tune on the portability audit until it becomes the next overfit target.',
        'Primary sources: SWE-agent at https://arxiv.org/abs/2405.15793, SWE-bench at https://arxiv.org/abs/2310.06770, SWE-bench Verified at https://www.swebench.com/verified.html, CWM at https://arxiv.org/abs/2510.02387, and OpenAI on SWE-bench Verified limitations at https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/. Study Abstract Agent Operation Graph, Verified Agent Trajectory Store, Execution Trace State Diff Case Study, Dynamic Scratchpad Execution Trace Case Study, Agent Trajectory Dedupe & Provenance Hash, Rust Borrow Checker Ownership Trace, LLM Evaluation Harnesses: Golden Sets and Judges, Data Leakage & Contamination, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
