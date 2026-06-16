// Agent environment randomization: train coding agents across controlled
// harness shifts so the real environment is not a surprise at eval time.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-environment-randomization-curriculum-case-study',
  title: 'Agent Environment Randomization Curriculum Case Study',
  category: 'AI & ML',
  summary: 'A training-data curriculum for coding agents: randomize tools, shells, edit grammars, languages, repo shapes, and budgets to reduce harness overfitting.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['randomization schedule', 'generalization gates'], defaultValue: 'randomization schedule' },
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

function curriculumGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.7, y: 3.4, note: 'family' },
      { id: 'sampler', label: 'sampler', x: 2.2, y: 3.4, note: 'seed' },
      { id: 'tools', label: 'tools', x: 4.0, y: 1.1, note: 'ACI' },
      { id: 'shell', label: 'shell', x: 4.0, y: 2.6, note: 'env' },
      { id: 'repo', label: 'repo', x: 4.0, y: 4.2, note: 'shape' },
      { id: 'budget', label: 'budget', x: 4.0, y: 5.8, note: 'turns' },
      { id: 'rollout', label: 'rollout', x: 6.0, y: 3.4, note: 'agent' },
      { id: 'verify', label: 'verify', x: 7.8, y: 3.4, note: 'oracle' },
      { id: 'slices', label: 'slices', x: 9.3, y: 3.4, note: 'report' },
    ],
    edges: [
      { id: 'e-task-sampler', from: 'task', to: 'sampler' },
      { id: 'e-sampler-tools', from: 'sampler', to: 'tools' },
      { id: 'e-sampler-shell', from: 'sampler', to: 'shell' },
      { id: 'e-sampler-repo', from: 'sampler', to: 'repo' },
      { id: 'e-sampler-budget', from: 'sampler', to: 'budget' },
      { id: 'e-tools-rollout', from: 'tools', to: 'rollout' },
      { id: 'e-shell-rollout', from: 'shell', to: 'rollout' },
      { id: 'e-repo-rollout', from: 'repo', to: 'rollout' },
      { id: 'e-budget-rollout', from: 'budget', to: 'rollout' },
      { id: 'e-rollout-verify', from: 'rollout', to: 'verify' },
      { id: 'e-verify-slices', from: 'verify', to: 'slices' },
    ],
  }, { title });
}

function* randomizationSchedule() {
  yield {
    state: curriculumGraph('Environment randomization for coding agents'),
    highlight: { active: ['task', 'sampler', 'tools', 'shell', 'repo', 'budget', 'e-task-sampler', 'e-sampler-tools', 'e-sampler-shell', 'e-sampler-repo', 'e-sampler-budget'], found: ['rollout'] },
    explanation: 'Instead of training every trajectory in one native harness, the curriculum samples controlled environment variants: tool surface, shell, repository shape, language, test runner, and budget.',
    invariant: 'Harness diversity is a training variable, not only an eval surprise.',
  };

  yield {
    state: labelMatrix(
      'Randomization axes',
      [
        { id: 'tool', label: '' },
        { id: 'edit', label: '' },
        { id: 'sh', label: '' },
        { id: 'lang', label: '' },
        { id: 'repo', label: '' },
        { id: 'bud', label: '' },
      ],
      [
        { id: 'axis', label: 'axis' },
        { id: 'learn', label: 'learn' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['tool', 'caps', 'cover'],
        ['edit', 'intent', 'round'],
        ['shell', 'cmd', 'exit'],
        ['lang', 'sem', 'split'],
        ['repo', 'search', 'slice'],
        ['budget', 'frugal', 'curve'],
      ],
    ),
    highlight: { active: ['tool:axis', 'edit:axis', 'sh:axis', 'lang:axis', 'bud:axis'], found: ['edit:gate', 'lang:gate'], compare: ['repo:learn'] },
    explanation: 'Each axis teaches a different invariant. Tool randomization teaches capability discovery, edit randomization teaches intent, shell randomization teaches portable execution, and budget randomization teaches cost-aware stopping.',
  };

  yield {
    state: labelMatrix(
      'Curriculum phases',
      [
        { id: 'p0', label: 'P0' },
        { id: 'p1', label: 'P1' },
        { id: 'p2', label: 'P2' },
        { id: 'p3', label: 'P3' },
      ],
      [
        { id: 'mix', label: 'mix' },
        { id: 'goal', label: 'goal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['native', 'learn loop', 'overfit'],
        ['one shift', 'bind ops', 'brittle'],
        ['many shifts', 'robust', 'noise'],
        ['holdout', 'claim', 'leak'],
      ],
    ),
    highlight: { active: ['p0:goal', 'p1:goal', 'p2:goal'], found: ['p3:goal'], removed: ['p3:risk'] },
    explanation: 'The schedule should not start with chaos. First learn the task loop, then one perturbation at a time, then mixed perturbations, then holdout harnesses that training never sees.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'training phase', min: 0, max: 4 }, y: { label: 'shifted eval resolve rate, illustrative percent', min: 0, max: 80 } },
      series: [
        { id: 'native', label: 'native-only train', points: [{ x: 0, y: 25 }, { x: 1, y: 34 }, { x: 2, y: 37 }, { x: 3, y: 38 }, { x: 4, y: 38 }] },
        { id: 'rand', label: 'randomized curriculum', points: [{ x: 0, y: 22 }, { x: 1, y: 31 }, { x: 2, y: 46 }, { x: 3, y: 57 }, { x: 4, y: 62 }] },
      ],
      markers: [
        { id: 'mix', x: 2.2, y: 48, label: 'mix' },
        { id: 'holdout', x: 3.6, y: 59, label: 'holdout' },
      ],
    }),
    highlight: { active: ['rand', 'mix', 'holdout'], compare: ['native'] },
    explanation: 'The expected shape is slower native progress but better shifted-eval generalization. The metric that matters is not comfort in the training harness; it is robustness under unseen but valid environments.',
  };
}

function* generalizationGates() {
  yield {
    state: curriculumGraph('Verifier slices close the loop'),
    highlight: { active: ['rollout', 'verify', 'slices', 'e-rollout-verify', 'e-verify-slices'], compare: ['tools', 'shell', 'repo', 'budget'] },
    explanation: 'Randomization is useful only if the verifier reports slices. A pass rate without the sampled environment vector cannot tell whether robustness improved.',
  };

  yield {
    state: labelMatrix(
      'Generalization gate ledger',
      [
        { id: 'seen', label: 'seen' },
        { id: 'hold', label: 'hold' },
        { id: 'fail', label: 'fail' },
        { id: 'cost', label: 'cost' },
        { id: 'leak', label: 'leak' },
      ],
      [
        { id: 'ask', label: 'ask' },
        { id: 'pass', label: 'pass' },
        { id: 'act', label: 'act' },
      ],
      [
        ['native ok?', 'yes', 'track'],
        ['unseen ok?', 'gate', 'claim'],
        ['why break?', 'class', 'data'],
        ['too pricey?', 'curve', 'policy'],
        ['seen seed?', 'block', 'split'],
      ],
    ),
    highlight: { active: ['hold:pass', 'hold:act', 'fail:act', 'cost:act'], found: ['leak:act'], compare: ['seen:pass'] },
    explanation: 'A mature curriculum has gates for seen performance, unseen performance, failure class, cost curve, and leakage. The holdout seed list is a product artifact, not a notebook detail.',
    invariant: 'Never train on the exact randomization seeds used for the portability claim.',
  };

  yield {
    state: labelMatrix(
      'Failure classes after randomization',
      [
        { id: 'plan', label: 'plan' },
        { id: 'bind', label: 'bind' },
        { id: 'sem', label: 'sem' },
        { id: 'test', label: 'test' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'trace', label: 'trace' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['bad path', 'search data'],
        ['bad tool', 'adapter'],
        ['bad model', 'domain trace'],
        ['weak oracle', 'tests'],
        ['late stop', 'budget RL'],
      ],
    ),
    highlight: { active: ['bind:fix', 'sem:fix', 'test:fix', 'stop:fix'], compare: ['plan:fix'] },
    explanation: 'Randomization does not magically fix every failure. The trace ledger routes each failure to a different remedy: search training, edit adapters, domain traces, stronger oracles, or budget policy.',
  };

  yield {
    state: curriculumGraph('Complete case: Windows shell holdout'),
    highlight: { active: ['task', 'sampler', 'shell', 'rollout', 'verify', 'slices', 'e-sampler-shell', 'e-shell-rollout', 'e-rollout-verify', 'e-verify-slices'], found: ['tools'], compare: ['budget'] },
    explanation: 'A team trains mostly on bash. The curriculum adds PowerShell and cmd variants only after the agent can solve the native task. The holdout reports whether command intent survives a Windows shell, not whether the model memorized Unix one-liners.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'randomization schedule') yield* randomizationSchedule();
  else if (view === 'generalization gates') yield* generalizationGates();
  else throw new InputError('Pick an environment-randomization view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Agent environment randomization is the coding-agent version of domain randomization. Instead of letting an agent see only one harness, the data factory samples tool surfaces, edit grammars, shells, languages, repository layouts, dependency states, test runners, timeout rules, and retry budgets. The goal is to make the production environment look like another valid variation instead of a distribution shock.',
        'This builds on Agent Harness Portability Audit. The audit detects environment overfit after the fact; the curriculum tries to prevent it during training and data generation.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core structures are an environment vector, randomization seed ledger, capability manifest, edit grammar adapter table, shell portability profile, repository-shape descriptor, budget policy, verifier slice table, holdout-seed registry, and failure-class ledger.',
        'The environment vector should be stored with every rollout: tool set, shell, OS, edit format, language, package manager, test command, network policy, file-size profile, monorepo depth, hidden-test policy, turn budget, and token budget. Without that vector, the team cannot distinguish generalization from lucky sampling.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A schedule starts with native tasks, adds one controlled shift at a time, mixes shifts once the agent is stable, and reserves unseen seeds for claims. The sampler should not randomize everything at once at the beginning; that can turn a clean learning problem into noise. Curriculum structure matters.',
        'Generalization gates compare native, shifted, and holdout performance. A failure under PowerShell may be a command-binding problem. A failure under JavaScript may be a semantic trace problem. A failure under lower budget may be a stopping-policy problem. Each class changes what data should be generated next.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A CWM-style trajectory factory starts with Python bug-fix tasks in a native Docker harness. Phase 1 adds alternate edit grammars. Phase 2 adds bash versus PowerShell, pytest versus package scripts, and monorepo search depth. Phase 3 adds JavaScript and Rust tasks. The holdout never reuses the same environment seeds.',
        'The product claim changes from one benchmark score to a robustness table: native score, unseen edit grammar score, Windows shell score, non-Python score, low-budget score, and cost per solved task. That is a stronger educational artifact and a more honest production metric.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not randomize away the task signal. If every rollout changes language, shell, tools, dependencies, and tests at once, failure analysis becomes muddy. Do not leak holdout seeds into training. Do not average away a slice that users actually care about. Do not call a benchmark robust if it only works in the native harness.',
        'Primary sources: CWM at https://arxiv.org/abs/2510.02387, SWE-agent at https://arxiv.org/abs/2405.15793, Terminal-Bench at https://arxiv.org/abs/2601.11868 and https://www.tbench.ai/, Domain Randomization at https://arxiv.org/abs/1703.06907, and Procgen generalization at https://arxiv.org/abs/1912.01588. Study Agent Harness Portability Audit, Coding Agent Edit Grammar Adapter Case Study, Verified Agent Trajectory Store, Benchmark Variance & Model Selection, Data Leakage & Contamination, and Process Reward Models & Verifier Search next.',
      ],
    },
  ],
};
