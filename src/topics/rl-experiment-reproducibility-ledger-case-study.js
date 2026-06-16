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
      heading: 'What it is',
      paragraphs: [
        'An RL experiment reproducibility ledger is the data structure that makes reinforcement-learning claims inspectable. It records code versions, environment versions, simulator assets, reward-function versions, random seeds, rollout budgets, raw reward events, evaluation slices, confidence intervals, stress tests, and release decisions.',
        'This module fills the operational gap between Value Iteration, Policy Gradients, RLHF, GRPO, and Benchmark Variance. The algorithm can be mathematically correct and the experiment can still be misleading if it reports a lucky seed, hides environment drift, or optimizes a reward proxy that no longer matches the task.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each run appends rows to a ledger. A run row identifies the agent code, base model or policy checkpoint, simulator version, reward-function hash, seed id, hyperparameters, rollout count, training budget, and evaluation protocol. A rollout row records episode id, environment state snapshot, actions, reward components, terminal condition, hidden checks, and timing. A stats row reports seed spread, confidence intervals, median or interquartile mean, and ablations.',
        'Reward auditing is separate from score reporting. The scalar reward should be derivable from logged facts. If a policy improves reward while hidden task quality falls, the ledger should show which reward channel was exploited. If a new safety rubric, simulator patch, tool API, or user distribution changes the landscape, the ledger should trigger a resweep instead of trusting old checkpoints.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'OpenAI Five is the scale case. The official OpenAI writeup says the system played about 180 years of Dota games against itself each day and trained with a scaled-up PPO setup on 256 GPUs and 128,000 CPU cores. That is an impressive RL engineering result, but it also shows why a ledger matters: the training environment, restrictions, reward design, self-play opponents, and compute budget are part of the claim.',
        'AlphaStar is the league case. DeepMind describes initial supervised learning from human games, then league training where competitors branch, older competitors freeze, matchmaking and objectives adapt, and the final agent is sampled from the Nash distribution of the league. That is not blank-slate reward magic. It is a scaffolded population system with memory of past opponents, diversity pressure, and stress from exploiters.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first trap is seed theater: one high-scoring run presented as an algorithmic improvement. Deep Reinforcement Learning that Matters argued that nondeterminism and method variance make results hard to interpret without significance metrics and standardized reporting. The second trap is reward theater: optimizing the proxy until it diverges from the intended task. The third trap is robustness theater: beating the training environment while failing under legal but unusual deployment behavior.',
        'Adversarial Policies is the clean warning. It showed that self-play-trained victim agents in simulated games could be defeated by adversarial opponent policies that behaved strangely, including a humanoid opponent that never stood up but won often. For production RL, that means success against normal opponents is not enough. The stress gate must include weird legal behavior, rule patches, observation shifts, lower budgets, and held-out users.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Deep Reinforcement Learning that Matters at https://arxiv.org/abs/1709.06560, Adversarial Policies: Attacking Deep Reinforcement Learning at https://arxiv.org/abs/1905.10615 and https://adversarialpolicies.github.io/, OpenAI Five at https://openai.com/index/openai-five/, AlphaStar at https://deepmind.google/blog/alphastar-mastering-the-real-time-strategy-game-starcraft-ii/, PPO at https://arxiv.org/abs/1707.06347, and the local RL.pdf in the provided document corpus.',
        'Study Value Iteration, Policy Gradients, RLHF & Preference Optimization, DeepSeek-R1: GRPO and RLVR, Process Reward Models & Verifier Search, Verifier-Guided Inference Control Plane, Benchmark Variance & Model Selection, Data Leakage & Contamination, Contextual Bandit Logged Policy Evaluation, Feature Flags, Distributed Tracing, and Write-Ahead Log next.',
      ],
    },
  ],
};
