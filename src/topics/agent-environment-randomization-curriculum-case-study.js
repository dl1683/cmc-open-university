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
      heading: 'Why this exists',
      paragraphs: [
        `A coding agent can look competent because it learned one runtime too well. It may know the exact shell, edit command, test convention, path layout, retry budget, and error format used during training. Move the same agent to PowerShell, a different patch grammar, a monorepo, a package-manager mismatch, or a tighter budget, and the apparent coding skill can collapse into interface confusion.`,
        `Environment randomization tries to prevent that failure before evaluation. It treats the runtime interface as part of the training distribution. The goal is not to make tasks noisy for their own sake. The goal is to teach the agent the stable operation behind many valid wrappers: inspect, edit, run, interpret failure, revise, and stop.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is native-only training. Pick one clean benchmark environment, generate many verified trajectories, and optimize the agent inside that world. This is efficient because every rollout shares the same tools, filesystem assumptions, test runner, failure format, and scoring code.`,
        `That approach is not foolish. A stable training environment is the right place to teach the basic loop. The problem is that the environment becomes a hidden teacher. If every successful trajectory uses the same edit API, the agent may learn that API as part of the task rather than as one possible interface to the task.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Native-only training breaks when an evaluation shift is valid but unfamiliar. The agent must solve the software task and decode the new environment at the same time. A failure under a new shell may not mean the model cannot reason about the bug. It may mean it cannot translate command intent into that shell.`,
        `The deeper wall is measurement. A single average pass rate cannot show whether the agent improved across environment shifts or simply saw easier samples. Without the sampled environment vector attached to each rollout, the team cannot separate real portability from lucky sampling.`,
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        `Make environment variation a scheduled training variable. Store an environment vector with every rollout: tool set, shell, OS, edit format, language, package manager, test command, network policy, file-size profile, monorepo depth, hidden-test policy, turn budget, token budget, and randomization seed.`,
        `Then train in phases. First teach the task loop in the native runtime. Next introduce one controlled shift at a time. Then mix shifts. Finally reserve unseen seeds and sometimes unseen combinations for portability claims. The curriculum is a data structure: sampler, seed ledger, adapters, verifier slices, and failure ledger.`,
      ],
    },
    {
      heading: 'What to randomize',
      paragraphs: [
        `Randomize interface details that are valid in real deployments: shell, path separators, available tools, edit grammar, test command, dependency state, package manager, language, repo layout, hidden-test policy, timeouts, retry limits, and token budget. Each axis should have a reason. Shell variation teaches command portability. Edit variation teaches intent instead of one patch syntax. Budget variation teaches stopping discipline.`,
        `Do not randomize away the task signal. If language, shell, tools, repo shape, dependencies, tests, and budget all change from the first batch, failure analysis becomes mud. A curriculum should add shifts only after the agent can solve enough native examples to show that the task loop itself is learnable.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The curriculum works by making the invariant more predictive than the wrapper. If the agent sees the same repair pattern through several shells, edit APIs, test runners, and repo shapes, the stable operation becomes a better strategy than memorizing one interface.`,
        `The holdout-seed invariant protects the claim. Training may see the same type of variation, but it must not see the exact seeds or exact held-out environments used for the portability report. Otherwise the curriculum just creates a new leakage channel.`,
      ],
    },
    {
      heading: 'How to use the visualization',
      paragraphs: [
        `In the randomization-schedule view, follow the sampler. The task family stays fixed while the sampler chooses controlled environment axes. The important state is the vector that travels with the rollout. If that vector is missing from the verifier report, the curve cannot support a generalization claim.`,
        `The phase table shows the main curriculum rule: native first, one shift next, mixed shifts later, holdouts last. The plotted curve is illustrative, but the desired shape is real: native-only training can improve quickly on native tasks while flattening on shifted tasks; randomized training may learn slower at first but should improve on valid unseen environments.`,
        `In the generalization-gates view, the failure ledger is the teaching object. A PowerShell failure, a missing-tool failure, a language-semantics failure, a weak-test failure, and a budget failure need different data. Averaging them together hides the next action.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a team trains mostly on Python bug-fix tasks in a Linux Docker environment. Phase 0 teaches the loop: inspect files, edit code, run pytest, repair failure, submit. Phase 1 adds alternate edit grammars while keeping the shell and language fixed. Phase 2 adds PowerShell and package-script test commands. Phase 3 adds JavaScript and Rust repos, deeper monorepos, and lower budgets.`,
        `The report should not collapse this into one score. It should show native score, unseen edit-grammar score, Windows-shell score, non-Python score, monorepo-search score, low-budget score, failure-class distribution, and cost per solved task. That table tells the team what the agent learned and what environment still breaks it.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Randomization costs rollout budget. More variants mean more environment setup, more flakes, more verifier work, and more labeled failure classes. It also costs learning speed: early native progress may be slower because some training capacity is spent learning portability.`,
        `The tradeoff is worth it only when shifted environments matter. If the product will always run in one locked-down runtime, native specialization may be the right choice. If users bring arbitrary repos, shells, tools, and budgets, native-only training is an optimistic benchmark, not a deployment plan.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `This curriculum wins for coding agents that must work across shells, languages, repo layouts, package managers, edit APIs, and budgets. It is especially useful when the same product ships into customer repositories rather than one benchmark container.`,
        `It also wins for research honesty. A slice-aware verifier can tell whether an agent is good at software repair, good at a particular interface, or only good when the budget is generous. That distinction matters more than one leaderboard number.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `It fails when randomization becomes noise. If the task, interface, dependencies, oracle, and budget all move at once, the data factory cannot tell what to fix. It also fails when randomization creates unrealistic variants that teach habits users will never need.`,
        `It fails as evidence when holdout seeds leak, when training data includes benchmark tasks, when the verifier reports only averages, or when a team chooses slices after seeing results. A portability claim needs predeclared slices and protected holdouts.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Leakage is the most dangerous failure. The model can memorize exact seeds, tasks, repository layouts, or benchmark canaries while appearing robust. Keep seed ledgers, split manifests, and benchmark data controls as first-class artifacts.`,
        `Another failure is adapter overfitting. If the agent sees many edit grammars but every grammar has the same hidden affordance, it may learn the hidden affordance rather than edit intent. Randomization axes should be audited the same way datasets are audited: what invariant should this axis teach, and what shortcut could it accidentally provide?`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World at https://arxiv.org/abs/1703.06907, Procgen generalization at https://arxiv.org/abs/1912.01588, SWE-agent at https://arxiv.org/abs/2405.15793, SWE-bench at https://github.com/swe-bench/SWE-bench, Terminal-Bench at https://arxiv.org/abs/2601.11868 and https://www.tbench.ai/, and CWM at https://arxiv.org/abs/2510.02387.`,
        `Study the agent-portability audit module, Coding Agent Edit Grammar Adapter Case Study, Verified Agent Trajectory Store, Benchmark Variance and Model Selection, Data Leakage and Contamination, Process Reward Models and Verifier Search, and Curriculum Learning next.`,
      ],
    },
  ],
};
