// RL experiment reproducibility ledger: seed sweeps, environment versions,
// reward-event logs, robustness stress tests, and release gates.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rl-experiment-reproducibility-ledger-case-study',
  title: 'RL Experiment Reproducibility Ledger',
  category: 'AI & ML',
  summary: 'A production RL case study: track seeds, environment versions, reward functions, rollout stores, variance, adversarial stress, and release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['seed ledger', 'reward audit', 'stress gate'], defaultValue: 'seed ledger' },
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

function experimentGraph(title) {
  return graphState({
    nodes: [
      { id: 'code', label: 'code sha', x: 0.7, y: 2.0, note: 'agent' },
      { id: 'env', label: 'env ver', x: 0.7, y: 5.0, note: 'world' },
      { id: 'seed', label: 'seed set', x: 2.6, y: 3.5, note: 'RNG' },
      { id: 'rollout', label: 'rollouts', x: 4.6, y: 3.5, note: 'episodes' },
      { id: 'reward', label: 'reward log', x: 6.4, y: 2.3, note: 'events' },
      { id: 'metrics', label: 'metrics', x: 6.4, y: 4.8, note: 'scores' },
      { id: 'stats', label: 'stats', x: 8.2, y: 3.5, note: 'CI' },
      { id: 'report', label: 'report', x: 9.6, y: 3.5, note: 'claim' },
    ],
    edges: [
      { id: 'e-code-seed', from: 'code', to: 'seed', weight: 'build' },
      { id: 'e-env-seed', from: 'env', to: 'seed', weight: 'snapshot' },
      { id: 'e-seed-rollout', from: 'seed', to: 'rollout', weight: 'run' },
      { id: 'e-rollout-reward', from: 'rollout', to: 'reward', weight: 'events' },
      { id: 'e-rollout-metrics', from: 'rollout', to: 'metrics', weight: 'scores' },
      { id: 'e-reward-stats', from: 'reward', to: 'stats', weight: 'audit' },
      { id: 'e-metrics-stats', from: 'metrics', to: 'stats', weight: 'spread' },
      { id: 'e-stats-report', from: 'stats', to: 'report', weight: 'claim' },
    ],
  }, { title });
}

function rewardGraph(title) {
  return graphState({
    nodes: [
      { id: 'state', label: 'state', x: 0.8, y: 3.5, note: 'obs' },
      { id: 'policy', label: 'policy', x: 2.6, y: 3.5, note: 'acts' },
      { id: 'env', label: 'env', x: 4.3, y: 3.5, note: 'next' },
      { id: 'reward', label: 'reward fn', x: 6.1, y: 2.0, note: 'proxy' },
      { id: 'events', label: 'event log', x: 6.1, y: 5.1, note: 'facts' },
      { id: 'audit', label: 'audit', x: 8.0, y: 3.5, note: 'drift' },
      { id: 'gate', label: 'gate', x: 9.4, y: 3.5, note: 'ship' },
    ],
    edges: [
      { id: 'e-state-policy', from: 'state', to: 'policy', weight: 'input' },
      { id: 'e-policy-env', from: 'policy', to: 'env', weight: 'action' },
      { id: 'e-env-state', from: 'env', to: 'state', weight: 'next obs' },
      { id: 'e-env-reward', from: 'env', to: 'reward', weight: 'features' },
      { id: 'e-env-events', from: 'env', to: 'events', weight: 'facts' },
      { id: 'e-reward-audit', from: 'reward', to: 'audit', weight: 'proxy' },
      { id: 'e-events-audit', from: 'events', to: 'audit', weight: 'truth' },
      { id: 'e-audit-gate', from: 'audit', to: 'gate', weight: 'decision' },
    ],
  }, { title });
}

function* seedLedger() {
  yield {
    state: experimentGraph('RL claims need a seed and environment ledger'),
    highlight: { active: ['code', 'env', 'seed', 'rollout'], found: ['stats', 'report'], compare: ['reward'] },
    explanation: 'A deep RL result is not one training run. The run must identify code, environment version, simulator assets, reward function, random seeds, rollout budget, and statistics before the score is meaningful.',
    invariant: 'A single lucky seed is an anecdote, not an RL result.',
  };

  yield {
    state: labelMatrix(
      'Run row schema',
      [
        { id: 'code', label: 'code' },
        { id: 'env', label: 'world' },
        { id: 'seed', label: 'seed' },
        { id: 'reward', label: 'rew fn' },
        { id: 'budget', label: 'budget' },
        { id: 'score', label: 'score' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['sha', 'replay'],
        ['ver', 'sem'],
        ['RNG', 'var'],
        ['ver', 'proxy'],
        ['steps', 'cmp'],
        ['eval', 'claim'],
      ],
    ),
    highlight: { active: ['seed:why', 'env:why', 'reward:why'], found: ['score:why'] },
    explanation: 'The row is intentionally boring. It records the information needed to rerun the result, explain variance, and decide whether two papers or checkpoints are even comparable.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seed id', min: 0, max: 8 }, y: { label: 'final score', min: 0, max: 100 } },
      series: [
        { id: 'ppo', label: 'PPO', points: [{ x: 1, y: 82 }, { x: 2, y: 37 }, { x: 3, y: 76 }, { x: 4, y: 51 }, { x: 5, y: 88 }, { x: 6, y: 44 }] },
        { id: 'base', label: 'baseline', points: [{ x: 1, y: 60 }, { x: 2, y: 55 }, { x: 3, y: 57 }, { x: 4, y: 61 }, { x: 5, y: 58 }, { x: 6, y: 54 }] },
      ],
      markers: [
        { id: 'lucky', x: 5, y: 88, label: 'lucky' },
        { id: 'bad', x: 2, y: 37, label: 'bad seed' },
      ],
    }),
    highlight: { active: ['ppo', 'lucky', 'bad'], compare: ['base'] },
    explanation: 'The plot is illustrative, but the point is real: high-variance RL methods can produce a champion and a failure under the same headline setup. Report distributions and confidence intervals, not only the best checkpoint.',
  };

  yield {
    state: labelMatrix(
      'Stat report',
      [
        { id: 'median', label: 'med' },
        { id: 'iqm', label: 'IQM' },
        { id: 'ci', label: 'CI' },
        { id: 'seeds', label: 'seeds' },
        { id: 'abl', label: 'ablate' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'failure', label: 'miss' },
      ],
      [
        ['center', 'best'],
        ['robust', 'outlier'],
        ['uncert', 'fake'],
        ['ids', 'replay'],
        ['cause', 'cult'],
      ],
    ),
    highlight: { active: ['median:use', 'iqm:use', 'ci:use', 'seeds:use'], compare: ['abl:failure'] },
    explanation: 'Deep RL that Matters argued for tighter experimental practice because nondeterminism and variance can make improvements hard to interpret. The ledger turns that warning into a required report shape.',
  };

  yield {
    state: experimentGraph('Replayable rollouts make failures debuggable'),
    highlight: { active: ['rollout', 'reward', 'metrics', 'stats', 'e-rollout-reward', 'e-rollout-metrics'], found: ['report'], compare: ['env'] },
    explanation: 'When a run regresses, the team should replay exact rollouts, inspect reward events, compare metrics by slice, and confirm the environment did not drift. Otherwise retraining becomes blind trial and error.',
  };
}

function* rewardAudit() {
  yield {
    state: rewardGraph('Reward functions are mutable production code'),
    highlight: { active: ['state', 'policy', 'env', 'reward', 'events'], found: ['audit'], compare: ['gate'] },
    explanation: 'The reward function is a proxy over environment events. Treat it like production code: version it, test it, log its input facts, and audit whether reward still matches the task.',
    invariant: 'RL optimizes the reward it receives, not the outcome you meant.',
  };

  yield {
    state: labelMatrix(
      'Reward channels',
      [
        { id: 'task', label: 'task' },
        { id: 'shape', label: 'shaping' },
        { id: 'kl', label: 'KL' },
        { id: 'safe', label: 'safety' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['goal', 'sparse'],
        ['guide', 'shortcut'],
        ['anchor', 'stifle'],
        ['block', 'over'],
        ['budget', 'cheap'],
      ],
    ),
    highlight: { active: ['task:job', 'shape:job', 'kl:job'], compare: ['shape:risk', 'safe:risk'] },
    explanation: 'Modern RL systems often mix task reward, shaping reward, KL terms, safety penalties, and cost penalties. Each channel needs an owner and audit rule because any channel can dominate behavior.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'time', min: 0, max: 10 }, y: { label: 'score', min: 0, max: 100 } },
      series: [
        { id: 'reward', label: 'proxy', points: [{ x: 1, y: 30 }, { x: 2, y: 45 }, { x: 3, y: 60 }, { x: 4, y: 76 }, { x: 5, y: 88 }, { x: 6, y: 94 }, { x: 7, y: 98 }] },
        { id: 'task', label: 'task eval', points: [{ x: 1, y: 31 }, { x: 2, y: 43 }, { x: 3, y: 55 }, { x: 4, y: 61 }, { x: 5, y: 59 }, { x: 6, y: 52 }, { x: 7, y: 45 }] },
      ],
      markers: [
        { id: 'diverge', x: 5, y: 59, label: 'diverge' },
      ],
    }),
    highlight: { active: ['reward'], found: ['diverge'], compare: ['task'] },
    explanation: 'Reward hacking looks like success if you watch only the proxy. The task evaluator, hidden tests, human review, or adversarial eval can reveal that the policy learned a shortcut.',
  };

  yield {
    state: labelMatrix(
      'Drift triggers',
      [
        { id: 'rules', label: 'rules' },
        { id: 'users', label: 'users' },
        { id: 'model', label: 'model' },
        { id: 'env', label: 'env' },
        { id: 'label', label: 'labels' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'move', label: 'move' },
      ],
      [
        ['policy', 'audit'],
        ['tasks', 'slice'],
        ['base', 'KL'],
        ['patch', 'sweep'],
        ['diff', 'rubric'],
      ],
    ),
    highlight: { active: ['rules:move', 'env:move', 'label:move'], compare: ['model:move'] },
    explanation: 'LLM preference landscapes and simulator environments both drift. A reward ledger names the triggers that force resweeps, relabeling, or release-blocking audits.',
  };

  yield {
    state: rewardGraph('Audit compares proxy reward against event facts'),
    highlight: { active: ['reward', 'events', 'audit', 'e-reward-audit', 'e-events-audit'], found: ['gate'], compare: ['policy'] },
    explanation: 'The audit should not trust the scalar alone. It compares reward components to raw events: task outcome, violations, costs, hidden checks, and downstream quality. The scalar reward is a derived view of those facts.',
  };
}

function* stressGate() {
  yield {
    state: graphState({
      nodes: [
        { id: 'demo', label: 'demos', x: 0.8, y: 1.8, note: 'priors' },
        { id: 'self', label: 'self-play', x: 0.8, y: 5.0, note: 'scale' },
        { id: 'league', label: 'league', x: 2.8, y: 3.5, note: 'diverse' },
        { id: 'past', label: 'past agents', x: 4.8, y: 1.8, note: 'anti-forget' },
        { id: 'exploit', label: 'exploiters', x: 4.8, y: 5.0, note: 'weak spots' },
        { id: 'stress', label: 'stress set', x: 7.0, y: 3.5, note: 'OOD' },
        { id: 'ship', label: 'ship gate', x: 9.0, y: 3.5, note: 'robust?' },
      ],
      edges: [
        { id: 'e-demo-league', from: 'demo', to: 'league', weight: 'init' },
        { id: 'e-self-league', from: 'self', to: 'league', weight: 'train' },
        { id: 'e-league-past', from: 'league', to: 'past', weight: 'freeze' },
        { id: 'e-league-exploit', from: 'league', to: 'exploit', weight: 'branch' },
        { id: 'e-past-stress', from: 'past', to: 'stress', weight: 'old strats' },
        { id: 'e-exploit-stress', from: 'exploit', to: 'stress', weight: 'attacks' },
        { id: 'e-stress-ship', from: 'stress', to: 'ship', weight: 'pass?' },
      ],
    }, { title: 'Large RL systems need league and stress gates' }),
    highlight: { active: ['league', 'past', 'exploit', 'stress'], found: ['ship'], compare: ['demo', 'self'] },
    explanation: 'Open-ended RL systems often need scaffolding: imitation, self-play, past opponents, exploiters, curricula, and stress tests. The gate asks whether the policy is robust, not only whether it beat the training distribution.',
  };

  yield {
    state: labelMatrix(
      'Stress tests',
      [
        { id: 'seed', label: 'seed' },
        { id: 'patch', label: 'env patch' },
        { id: 'ood', label: 'OOD obs' },
        { id: 'adv', label: 'adversary' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'fail', label: 'means' },
      ],
      [
        ['RNG', 'var'],
        ['rules', 'brittle'],
        ['rare', 'concept'],
        ['weird', 'exploit'],
        ['less sim', 'sample'],
      ],
    ),
    highlight: { active: ['patch:test', 'ood:test', 'adv:test'], compare: ['budget:fail'] },
    explanation: 'Adversarial-policy work shows that a strong self-play victim can fail against strange but legal opponent behavior. Stress tests should include unusual observations, adversaries, rule changes, lower budgets, and seed shifts.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sim years', min: 0, max: 220 }, y: { label: 'transfer', min: 0, max: 100 } },
      series: [
        { id: 'narrow', label: 'narrow env', points: [{ x: 10, y: 30 }, { x: 50, y: 70 }, { x: 100, y: 90 }, { x: 180, y: 96 }] },
        { id: 'shift', label: 'shifted env', points: [{ x: 10, y: 26 }, { x: 50, y: 37 }, { x: 100, y: 42 }, { x: 180, y: 45 }] },
      ],
      markers: [
        { id: 'gap', x: 180, y: 45, label: 'gap' },
      ],
    }),
    highlight: { active: ['narrow'], found: ['gap'], compare: ['shift'] },
    explanation: 'Massive simulation can solve the environment it sees while transfer remains weak. The release question is therefore not only sample efficiency; it is whether the learned skill survives the expected deployment shifts.',
  };

  yield {
    state: labelMatrix(
      'When RL fits',
      [
        { id: 'sim', label: 'cheap sim' },
        { id: 'reward', label: 'clear rew' },
        { id: 'stable', label: 'stable env' },
        { id: 'reset', label: 'safe reset' },
        { id: 'stress', label: 'stressable' },
      ],
      [
        { id: 'good', label: 'good sign' },
        { id: 'bad', label: 'risk' },
      ],
      [
        ['many', 'damage'],
        ['clear', 'vague'],
        ['fixed', 'drift'],
        ['cheap', 'once'],
        ['attack', 'unknown'],
      ],
    ),
    highlight: { found: ['sim:good', 'reward:good', 'stable:good', 'stress:good'], compare: ['reward:bad', 'stable:bad'] },
    explanation: 'RL is strongest when rollouts are cheap, rewards are clear, resets are safe, and the deployment environment is stable enough to test. It is weakest when the world drifts, rewards are vague, and failures are costly.',
  };

  yield {
    state: rewardGraph('Release requires replay, stress, and rollback'),
    highlight: { active: ['audit', 'gate', 'e-audit-gate'], found: ['events'], compare: ['policy'] },
    explanation: 'A production RL release should name the exact run, reward version, stress suite, rollback trigger, and owner. Otherwise a policy update is just a high-dimensional change with no debugging handle.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'seed ledger') yield* seedLedger();
  else if (view === 'reward audit') yield* rewardAudit();
  else if (view === 'stress gate') yield* stressGate();
  else throw new InputError('Pick an RL ledger view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Reinforcement-learning results are unusually easy to overstate. A single lucky seed, drifting environment, changed reward, hidden simulator patch, or weak stress test can make an impressive curve mean very little.',
        'An RL experiment reproducibility ledger exists to make those claims inspectable. It records code versions, environment versions, simulator assets, reward-function versions, random seeds, rollout budgets, raw reward events, evaluation slices, confidence intervals, stress tests, and release decisions.',
        {type:'callout', text:'An RL result is credible only when the score is tied to replayable rows for code, environment, reward, seeds, stress tests, and release decisions.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The naive approach is to report the best run or the last checkpoint. That is tempting because RL curves are noisy and compute is expensive.',
        'Another naive approach is to treat the scalar reward as ground truth. RL optimizes the reward it receives, not the outcome the team meant.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is variance plus proxy drift. Two seeds under the same headline setup can diverge sharply. A reward proxy can improve while real task quality falls. A policy can beat training opponents and fail against strange legal behavior.',
        'That means the experiment record has to include the setup, not only the score.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat an RL claim as a bundle of replayable rows. A run row names code, environment, reward, seed, hyperparameters, rollout budget, and evaluation protocol. A rollout row stores episode facts. A stats row reports spread and uncertainty. A release row records stress gates and rollback triggers.',
        'Reward auditing is separate from score reporting. The scalar reward should be derivable from raw events, and hidden task-quality checks should be visible enough to detect reward hacking.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the seed-ledger view, watch the claim widen from one run to a distribution. A single curve is not a result. The ledger ties each score to code, environment, reward, seed, budget, and evaluation protocol so variance can be inspected instead of hidden.",
        "In the reward-audit view, follow raw events before the scalar reward. The scalar is only a compressed signal. If the raw event stream shows that the agent found a loophole, the reward number has become evidence of reward hacking rather than progress.",
        "In the stress-gate view, the release decision is the state transition. A policy does not move forward because the best seed looked good; it moves forward because the ledger says the result survived variance, ablations, hidden checks, and deployment-like stress.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A navigation policy improves average reward by 12 percent in one seed. The ledger shows that five other seeds are flat, one seed collapses, and the improved seed exploited a simulator shortcut where bumping a wall gives a shaping reward without reaching the goal. Without the ledger, the team might ship a lucky exploit. With the ledger, the run becomes a reward-audit failure.',
        'A stronger experiment records the environment build, map set, reward-function hash, action-space version, sensor noise, rollout count, and evaluation slices. The release gate then compares median performance, tail failures, stress scenarios, and ablations. The decision is slower than reading one curve, but it produces a claim someone else can inspect.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each run appends rows to a ledger. A run row identifies the agent code, base model or policy checkpoint, simulator version, reward-function hash, seed id, hyperparameters, rollout count, training budget, and evaluation protocol.',
        'A rollout row records episode id, environment state snapshot, actions, reward components, terminal condition, hidden checks, and timing. A stats row reports seed spread, confidence intervals, median or interquartile mean, and ablations.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because most RL failures are not invisible once the right state is recorded. Seed variance, reward-channel exploitation, simulator drift, and stress-test gaps leave evidence if the ledger is built for them.',
        'It also makes comparisons fairer. Two checkpoints are comparable only when code, environment, reward, seeds, budget, and evaluation protocol are named.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The ledger costs compute and discipline. Seed sweeps, stress suites, hidden evals, rollouts, and replayable logs all take time and storage.',
        'The alternative is worse: a policy update with no debugging handle. Production RL releases should name the exact run, reward version, stress suite, rollback trigger, and owner.',
        'Storage cost can be controlled by tiering evidence. Keep compact run metadata for every experiment, sampled rollout traces for ordinary runs, full traces for release candidates, and raw failure traces for regressions. The point is not to store everything forever; it is to preserve enough evidence to reproduce the claim and debug the failure.',
      ],
    },
    {
      heading: 'What the ledger should contain',
      paragraphs: [
        'At minimum, record repository commit, dependency lockfile, base model or policy checkpoint, environment image, simulator assets, reward version, random seed, hyperparameters, training budget, evaluation budget, hardware class, and metric definitions. For agentic or robotic systems, also record tool permissions, reset conditions, sensor noise, and safety constraints.',
        'For every release candidate, store the decision packet: score distribution, confidence interval or bootstrap estimate, hidden-eval result, known failure cases, stress-test result, human review notes, rollback condition, and comparison to the previous shipped policy. That packet is what turns a training run into an engineering artifact.',
      ],
    },
    {
      heading: 'Reporting standard',
      paragraphs: [
        'A serious RL report should lead with distributions, not only peak curves. Show seed count, median or interquartile mean, uncertainty, compute budget, environment version, reward version, and the exact selection rule for the checkpoint being reported. If the best seed was selected after looking at outcomes, say so.',
        'For production, add release gates. A policy should not ship only because reward improved. It should pass regression slices, stress cases, safety constraints, rollout monitoring, and rollback criteria tied to the same ledger identity.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This ledger wins in simulator-heavy RL, RLHF, agent training, game self-play, robotic policies, recommender bandits, and any environment where seeds, reward functions, and deployment shifts can change the conclusion.',
        'It is also useful for research reading: it helps separate algorithmic progress from compute scale, environment scaffolding, and reporting choices.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails if teams record only scores and not raw reward events. It fails if stress tests are weaker than deployment. It fails if reward and environment versions are not pinned.',
        'It also fails culturally when one high-scoring run is treated as proof.',
        'It can also become ritual paperwork if nobody uses it to make decisions. The ledger should block release, trigger reward redesign, force environment pinning, or justify rollback. If it never changes behavior, it is just a dashboard with better nouns.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'OpenAI Five is the scale case. The official OpenAI writeup says the system played about 180 years of Dota games against itself each day and trained with a scaled-up PPO setup on 256 GPUs and 128,000 CPU cores. That is an impressive RL engineering result, but it also shows why the training environment, restrictions, reward design, self-play opponents, and compute budget are part of the claim.',
        'AlphaStar is the league case. DeepMind describes initial supervised learning from human games, then league training where competitors branch, older competitors freeze, matchmaking and objectives adapt, and the final agent is sampled from the Nash distribution of the league. That is scaffolded population training, not blank-slate reward magic.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Deep Reinforcement Learning that Matters at https://arxiv.org/abs/1709.06560, Adversarial Policies: Attacking Deep Reinforcement Learning at https://arxiv.org/abs/1905.10615 and https://adversarialpolicies.github.io/, OpenAI Five at https://openai.com/index/openai-five/, AlphaStar at https://deepmind.google/blog/alphastar-mastering-the-real-time-strategy-game-starcraft-ii/, PPO at https://arxiv.org/abs/1707.06347, and the local RL.pdf in the provided document corpus.',
        'Study Value Iteration, Policy Gradients, RLHF & Preference Optimization, DeepSeek-R1: GRPO and RLVR, Process Reward Models & Verifier Search, Verifier-Guided Inference Control Plane, Benchmark Variance & Model Selection, Data Leakage & Contamination, Contextual Bandit Logged Policy Evaluation, Feature Flags, Distributed Tracing, and Write-Ahead Log next.',
      ],
    },
  ],
};
