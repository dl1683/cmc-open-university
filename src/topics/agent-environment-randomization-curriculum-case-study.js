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
    explanation: 'Instead of training every trajectory in one native harness, the curriculum samples controlled environment variants: tool surface, shell, repository shape, language, test runner, and budget. The point is to make valid interface shifts part of training, not a surprise at evaluation time.',
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
    explanation: 'Randomization is useful only if the verifier reports slices. A pass rate without the sampled environment vector cannot tell whether robustness improved or the sampler simply avoided the hard variants.',
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
    explanation: 'A team trains mostly on bash. The curriculum adds PowerShell and cmd variants only after the agent can solve the native task. The holdout reports whether command intent survives a Windows shell while keeping the exact holdout seeds out of training.',
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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'callout', text:'Environment randomization treats the runtime interface as part of the training distribution. The goal is not noise for its own sake — it is to teach the agent the stable operation behind many valid wrappers: inspect, edit, run, interpret failure, revise, stop. An agent that only knows one shell is not a coding agent; it is a shell macro.'},
        'Read the randomization-schedule view as a sampler around a task family. A task family is a set of related problems, such as Python bug fixes or documentation edits. The sampler changes valid environment features while the underlying task goal stays comparable.',
        'Active nodes are the environment axes being sampled: tool set, shell, repository shape, and budget. The safe inference is that each rollout must carry its environment vector into the verifier report. Without that vector, a pass rate cannot prove generalization.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A coding agent can look strong because it has learned one harness too well. A harness is the runtime wrapper around a task: shell, tools, edit grammar, filesystem, test command, timeout, and scoring rule. Change the shell from bash to PowerShell or the edit interface from patch to structured replace, and a brittle agent may fail before it reaches the software problem.',
        'Environment randomization exists to teach stable operations behind different wrappers. The stable loop is inspect, edit, run, interpret failure, revise, and stop. The curriculum makes valid interface shifts part of training instead of a surprise at evaluation time.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is native-only training. Pick one clean environment, generate many verified trajectories, and optimize the agent inside that world. This is efficient because every rollout shares the same tools, paths, shell, test runner, and failure format.',
        'That baseline is useful because the agent first has to learn the task loop. A chaotic environment on day one makes failure analysis impossible. The mistake is treating native performance as evidence that the agent can operate across real user environments.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is valid shift. A Windows shell, a missing grep command, a monorepo layout, or a different package manager can break an agent even when the repair idea is simple. The failure does not prove the model cannot reason about the bug; it may prove it cannot bind intent to the new interface.',
        'The measurement wall is worse. A single average pass rate hides whether the agent improved on unseen shells, low budgets, unfamiliar languages, or easier sampled tasks. Without slice metrics, portability claims are not auditable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the environment a first-class variable in the training record. Store shell, OS, tools, edit format, language, package manager, test command, repository shape, network policy, timeouts, token budget, turn budget, and seed. A seed is the recorded random choice that lets the same variant be reproduced.',
        'Then train by phases. First learn the native loop. Next introduce one shift at a time. Then mix shifts. Finally reserve unseen seeds and sometimes unseen combinations for the portability claim.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The sampler receives a task family and draws an environment vector. One rollout may use bash, pytest, and a small repo. Another may use PowerShell, npm test, and a nested monorepo. The verifier records pass or fail plus the sampled vector and failure class.',
        'The curriculum gates progress. Phase 0 teaches the basic loop in the native environment. Phase 1 changes one axis, such as edit grammar. Phase 2 mixes several axes. Phase 3 evaluates on protected holdout seeds that were never used for training.',
        'Failures route to different fixes. Bad path search needs repository-navigation data. Bad shell binding needs command-portability traces. Weak tests need better oracles. Late stopping needs budget policy training.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the stable operation should predict success better than the wrapper. If the same repair pattern appears through several shells, test runners, edit APIs, and repo shapes, memorizing one interface becomes less useful. The model has to learn the operation behind the surface.',
        'The holdout invariant protects the claim. Training may see the same kind of variation, but not the exact seeds used to report portability. Otherwise randomization creates a new leakage channel instead of a generalization test.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Randomization spends rollout budget. If one native task costs 5 minutes, running it across six environment variants can cost 30 minutes before extra flake handling. It also slows early learning because capacity is spent on interface robustness instead of native specialization.',
        'The cost is behavioral. Native-only training may climb from 30 percent to 60 percent native pass rate quickly while staying at 20 percent on shifted environments. A randomized curriculum may reach only 52 percent native at the same point but 45 percent on shifted holdouts, which matters more for a product that runs in user repos.',
        'Bookkeeping also grows. Every rollout needs an environment vector, seed, split assignment, verifier slice, failure class, and leakage check. Without that ledger, the team cannot tell whether randomization helped or merely changed the sample mix.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This is useful for coding agents deployed into customer repositories. Those agents see different shells, package managers, languages, path layouts, test commands, file sizes, and budgets. A benchmark container is only one member of that deployment distribution.',
        'It also helps research honesty. Slice-aware reports can separate software-repair skill from interface familiarity. A model that solves Linux bash tasks but fails equivalent PowerShell tasks should not be described as generally robust.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when randomization becomes noise. If language, shell, dependencies, repository shape, oracle, and budget all change at once, the team cannot identify the cause of failure. A curriculum should change enough to teach portability but not enough to destroy diagnosis.',
        'It also fails when variants are unrealistic or leaked. Training on exact holdout seeds, benchmark tasks, or synthetic variants with hidden shortcuts creates false robustness. The split ledger must be treated as a product artifact, not as notebook metadata.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 1,000 Python bug-fix tasks run in a Linux bash harness. Native-only training solves 620 of them and solves 210 of 1,000 Windows PowerShell holdout tasks. The gap says the model learned something about the native interface that did not transfer.',
        'A phased curriculum spends 40 percent of rollouts on native tasks, 20 percent on edit-grammar variation, 20 percent on shell variation, and 20 percent on low-budget variants. After the same 10,000 rollout budget, native pass rate is 590 instead of 620, but PowerShell holdout pass rate rises to 470. The product accepts the native loss because user environments are not native-only.',
        'The failure report shows 180 remaining Windows failures: 80 command-binding errors, 45 path quoting errors, 25 package-script errors, 20 timeout errors, and 10 true code-reasoning errors. That breakdown tells the next data collection step; a single pass rate would not.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World at https://arxiv.org/abs/1703.06907, Procgen generalization at https://arxiv.org/abs/1912.01588, SWE-agent at https://arxiv.org/abs/2405.15793, SWE-bench at https://github.com/swe-bench/SWE-bench, and Terminal-Bench at https://www.tbench.ai/. Then study Coding Agent Edit Grammar Adapter, Verified Agent Trajectory Store, Data Leakage and Contamination, Process Reward Models, and Curriculum Learning.',
      ],
    },
  ],
};
