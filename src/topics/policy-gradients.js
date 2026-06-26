// Policy gradients: when you can't backprop through the world, score it.
// REINFORCE\'s trick, its variance problem, the baseline that fixes it, and
// PPO\'s clipped ratio ó the ten lines of code that train RLHF\'d LLMs.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'policy-gradients',
  title: 'Policy Gradients: REINFORCE to PPO',
  category: 'AI & ML',
  summary: 'The score-function trick that differentiates through sampling, the variance it pays, the baseline that rescues it, and the PPO clip running modern RLHF.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['REINFORCE & the variance tax', 'trust regions & PPO'], defaultValue: 'REINFORCE & the variance tax' },
  ],
  run,
};

// A two-action world: softmax policy over logits ?, action 0 pays +1,
// action 1 pays +3 ó each plus zero-mean noise of ±2, because real worlds
// never pay the same twice. Small enough that the TRUE gradient has a
// closed form, so the sampled estimator can be checked against truth, live.
const REWARD = [1, 3];
const NOISE = 2;
const softmax = ([a, b]) => {
  const m = Math.max(a, b);
  const ea = Math.exp(a - m);
  const eb = Math.exp(b - m);
  return [ea / (ea + eb), eb / (ea + eb)];
};
// ‚àá? log œÄ(a): for a softmax, it\'s (1{a=i} ‚àí œÄ(i)) per logit i.
const scoreVec = (pi, a) => [a === 0 ? 1 - pi[0] : -pi[0], a === 1 ? 1 - pi[1] : -pi[1]];
// True gradient of E[R]: S_a œÄ(a)¬∑R(a)¬∑‚àálog œÄ(a).
function trueGrad(theta) {
  const pi = softmax(theta);
  const g = [0, 0];
  for (const a of [0, 1]) {
    const s = scoreVec(pi, a);
    g[0] += pi[a] * REWARD[a] * s[0];
    g[1] += pi[a] * REWARD[a] * s[1];
  }
  return g;
}
function* lcg(seed) {
  let s = seed;
  while (true) {
    s = (s * 1103515245 + 12345) % 2147483648;
    yield s / 2147483648;
  }
}
// Sample N episodes at ? = (0, 0) and estimate the ?‚ÇÅ-gradient with and
// without a baseline; report mean and variance of the per-episode estimates.
function estimate(n, baseline) {
  const theta = [0, 0];
  const pi = softmax(theta);
  const rand = lcg(98765);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const a = rand.next().value < pi[0] ? 0 : 1;
    const r = REWARD[a] + NOISE * (2 * rand.next().value - 1);
    const s = scoreVec(pi, a);
    samples.push((r - baseline) * s[1]);
  }
  const mean = samples.reduce((x, y) => x + y, 0) / n;
  const variance = samples.reduce((x, y) => x + (y - mean) ** 2, 0) / n;
  return { mean, variance };
}
const N_EP = 400;
const RAW = estimate(N_EP, 0);
const BASE = estimate(N_EP, 2); // baseline = E[R] at the uniform policy
const TRUE_G1 = trueGrad([0, 0])[1];

// REINFORCE training runs, 60 updates of 8 episodes each, same seed ó
// identical luck, the only difference is the baseline.
function train(useBaseline, seed) {
  const rand = lcg(seed);
  const theta = [0, 0];
  const curve = [];
  for (let u = 0; u <= 60; u++) {
    const pi = softmax(theta);
    curve.push({ x: u, y: pi[1] });
    let g0 = 0;
    let g1 = 0;
    let rewards = 0;
    const acts = [];
    for (let e = 0; e < 8; e++) {
      const a = rand.next().value < pi[0] ? 0 : 1;
      const r = REWARD[a] + NOISE * (2 * rand.next().value - 1);
      acts.push([a, r]);
      rewards += r;
    }
    const b = useBaseline ? rewards / 8 : 0;
    for (const [a, r] of acts) {
      const s = scoreVec(pi, a);
      g0 += (r - b) * s[0] / 8;
      g1 += (r - b) * s[1] / 8;
    }
    theta[0] += 0.3 * g0;
    theta[1] += 0.3 * g1;
  }
  return curve;
}
const CURVE_RAW = train(false, 4242);
const CURVE_BASE = train(true, 4242);

// The PPO clipped objective as a function of the importance ratio r,
// for advantage +1 and ‚àí1, e = 0.2 ó the famous pair of curves.
const EPS = 0.2;
const clipObj = (r, A) => Math.min(r * A, Math.max(Math.min(r, 1 + EPS), 1 - EPS) * A);
const rGrid = [];
for (let r = 0; r <= 2.0001; r += 0.025) rGrid.push(r);
const PPO_POS = { id: 'apos', label: 'advantage +1 (good action)', points: rGrid.map((r) => ({ x: r, y: clipObj(r, 1) })) };
const PPO_NEG = { id: 'aneg', label: 'advantage ‚àí1 (bad action)', points: rGrid.map((r) => ({ x: r, y: clipObj(r, -1) })) };

function table(title, rowDefs, colDefs, cellText) {
  let k = 0;
  const flat = [''];
  const values = rowDefs.map((_, r) => colDefs.map((__, c) => { flat.push(cellText[r][c]); k++; return k; }));
  return matrixState({
    title,
    rows: rowDefs.map(([id, label]) => ({ id, label })),
    columns: colDefs.map(([id, label]) => ({ id, label })),
    values,
    format: (v) => flat[v],
  });
}

function* reinforce() {
  yield {
    state: table('The problem: reward arrives AFTER a dice roll', [
      ['env', 'the environment'],
      ['wall', 'why backprop dies'],
      ['trick', 'the score-function trick'],
      ['name', 'what it buys'],
    ], [['detail', '']], [
      ['policy œÄ(a|?) = softmax(?) picks an action; the world pays R ó here action 0 pays +1, action 1 pays +3'],
      ['sampling an action is a discrete jump, and the reward comes from outside the program: no chain rule through either'],
      ['‚àá? E[R] = E[ R ¬∑ ‚àá? log œÄ(a) ] ó differentiate the PROBABILITY of what you did, weight it by what you got'],
      ['a gradient estimated purely from (action, reward) pairs: no model of the world, no derivative of the reward'],
    ]),
    highlight: { active: ['trick:detail'] },
    explanation: 'Everything else on this site trains by backpropagating THROUGH the computation. Reinforcement learning can\'t: the environment is not differentiable (you cannot take the derivative of a chess opponent) and the action was SAMPLED ó a discrete lottery with no gradient. The score-function identity (REINFORCE, Williams 1992) routes around both walls with one move: instead of differentiating the reward, differentiate the log-probability of the action you took and scale it by the reward you received. Good outcome ‚Üí push that action\'s probability up; bad outcome ‚Üí push it down ó exactly the law a Multi-Armed Bandits learner follows by instinct, now written as a gradient any optimizer can consume.',
    invariant: '‚àáE[R] = E[R ¬∑ ‚àálog œÄ]: an unbiased gradient from samples alone ó no differentiable world required.',
  };

  yield {
    state: table(`${N_EP} sampled episodes at the uniform policy, estimating the same true gradient (${TRUE_G1.toFixed(2)})`, [
      ['truth', 'exact gradient (closed form)'],
      ['raw', 'REINFORCE estimate'],
      ['base', 'with baseline b = 2'],
      ['ratio', 'variance ratio'],
    ], [['mean', 'mean'], ['variance', 'per-episode variance']], [
      [TRUE_G1.toFixed(3), 'ó (no sampling, no variance)'],
      [RAW.mean.toFixed(3), RAW.variance.toFixed(2)],
      [BASE.mean.toFixed(3), BASE.variance.toFixed(2)],
      ['both estimators aim at the same target', `${(RAW.variance / BASE.variance).toFixed(1)}√ó ó the baseline pays for itself`],
    ]),
    highlight: { compare: ['raw:variance', 'base:variance'], found: ['ratio:variance'] },
    explanation: `The trick is unbiased ó and noisy. This tiny world has a closed-form true gradient (${TRUE_G1.toFixed(2)} on the good action\'s logit), so the estimator can be audited live: ${N_EP} sampled episodes average to ${RAW.mean.toFixed(2)}, on target. But the per-episode variance is ${RAW.variance.toFixed(2)}, because rewards of +1 and +3 BOTH push their action\'s probability up ó every single episode shouts "do that again!", and learning happens only through the small difference in how loudly. Subtract a BASELINE first (b = 2, the average reward): now R ‚àí b is ‚àí1 or +1, below-average actions get pushed DOWN, and the variance drops ${(RAW.variance / BASE.variance).toFixed(1)}√ó while the mean stays put (${BASE.mean.toFixed(2)}). Subtracting a constant can\'t bias the estimate ó E[b¬∑‚àálog œÄ] = 0 because probabilities always sum to one ó so the baseline is variance reduction with no fine print. "Reward minus baseline" has a name you\'ve seen: the ADVANTAGE.`,
    invariant: 'A baseline shifts nothing and saves much: E[(R‚àíb)¬∑‚àálog œÄ] = E[R¬∑‚àálog œÄ] for any constant b, with far less variance.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'update', min: 0, max: 60 }, y: { label: 'œÄ(best action)', min: 0.3, max: 1 } },
      series: [
        { id: 'raw', label: 'REINFORCE, no baseline', points: CURVE_RAW },
        { id: 'base', label: 'with baseline (advantage)', points: CURVE_BASE },
      ],
    }),
    highlight: { found: ['base'], visited: ['raw'] },
    explanation: `Both estimators, trained live: 60 updates, 8 episodes each, identical random seed ó every difference you see is the variance, nothing else. Both runs learn (the bias is zero either way) and both reach ${(CURVE_BASE.at(-1).y * 100).toFixed(0)}%-ish preference for the +3 action eventually. But watch the no-baseline curve lurch: updates where eight lucky samples of the worse action all shouted "more!" visibly drag the policy the wrong way before the average rescues it. The baseline curve climbs steadily because each update only has to encode WHICH actions beat the batch average ó a far smaller fact than the raw reward. In deep RL this gap is not cosmetic: the baseline becomes a learned value function (the "critic" in actor-critic), and without it REINFORCE on a real problem mostly measures noise.`,
    invariant: 'Same seed, same bias, different variance: the baseline turns a random walk with drift into a climb.',
  };
}

function* ppo() {
  yield {
    state: table('The step-size cliff: a policy is a distribution, not a parameter vector', [
      ['collect', '1 ¬∑ collect episodes with œÄ_old'],
      ['step', '2 ¬∑ take a big gradient step'],
      ['ruin', '3 ¬∑ the new policy is ruined'],
      ['trap', '4 ¬∑ and it collects its OWN data'],
    ], [['what', '']], [
      ['the data describes where œÄ_old goes ó and only there'],
      ['one oversized update can drop a good action from 60% to 5%: tiny in ?, catastrophic in distribution'],
      ['the gradient was a LOCAL whisper, valid near œÄ_old; far away it pointed nowhere meaningful'],
      ['supervised learning gets a fresh i.i.d. batch regardless of its mistakes ó RL must now learn FROM the wreckage it just created'],
    ]),
    highlight: { removed: ['trap:what'] },
    explanation: 'Why policy optimization is more fragile than supervised training, in one cascade. The gradient is only trustworthy near the policy that collected the data ó and Natural Gradient & Fisher Information showed why "near" must be measured in distribution space (KL), not parameter space: the same ?-step can be a nudge or an earthquake depending on where you stand. Supervised learning shrugs off a bad step because the next batch is drawn fresh from the same dataset. RL cannot shrug: a wrecked policy collects wrecked data, and the feedback loop can be unrecoverable. TRPO (2015) fixed this with an explicit KL trust region ó natural gradient with a constraint ó at the cost of second-order machinery per update. The field wanted the constraint without the machinery.',
    invariant: 'RL\'s data distribution is the thing being optimized: one oversized step poisons every future batch ó steps must be KL-small.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'r = œÄ_new(a) / œÄ_old(a)', min: 0, max: 2 }, y: { label: 'clipped objective', min: -2.1, max: 1.4 } },
      series: [PPO_POS, PPO_NEG],
    }),
    highlight: { compare: ['apos', 'aneg'] },
    explanation: 'PPO\'s entire idea, drawn live from its formula: L = min(r¬∑A, clip(r, 0.8, 1.2)¬∑A), where r is the importance ratio œÄ_new/œÄ_old for an action and A its advantage. Read the good-action curve (A = +1): the objective rewards raising r ó but FLATLINES at r = 1.2. Beyond that, zero gradient: no further credit for pushing a good action harder than 20% past the old policy, so the incentive to overshoot simply vanishes. The bad-action curve (A = ‚àí1) is the mirror with a twist: it flatlines at r = 0.8 going down, yet stays STEEP for r > 1 ó if a bad action somehow got MORE likely, the gradient to undo the mistake is never clipped. Pessimism in both cases: the min() always picks whichever term hurts the update more.',
    invariant: 'The clip kills gradients that push r beyond [1‚àíe, 1+e] in the favorable direction ó and never clips the correction.',
  };

  yield {
    state: table('Why the clip ‚âà a trust region (and what it costs)', [
      ['reuse', 'data reuse'],
      ['region', 'the implicit region'],
      ['cheap', 'the price of simplicity'],
      ['honest', 'the fine print'],
    ], [['detail', '']], [
      ['the ratio r makes old data usable for several epochs of updates ó importance sampling, with the clip as a leash'],
      ['flat objective beyond r = 1 ± e ‚áí near-zero incentive to leave the neighborhood: TRPO\'s KL ball, enforced by indifference instead of constraint'],
      ['ten lines of code, first-order only ó this is why PPO displaced TRPO almost overnight (Schulman et al., 2017)'],
      ['the clip bounds each ratio, not the true KL; with enough epochs the policy can still drift ó practical PPO adds early stopping when KL exceeds a target'],
    ]),
    highlight: { active: ['region:detail'] },
    explanation: 'The clip is a trust region built from indifference: instead of solving a constrained optimization like TRPO, PPO makes the objective stop caring once the policy has moved e away, and an optimizer follows incentives ó where there is no slope, it stops pushing. The honesty row matters: clipping each action\'s ratio is not a true KL bound, and practitioners back it up with a KL early-stop. But the 80% solution at 5% of the complexity won: a first-order method, a few epochs of minibatch reuse per batch of experience, and no Fisher matrix in sight ó the cheapest defensible answer to the question Natural Gradient & Fisher Information posed exactly.',
    invariant: 'PPO replaces "thou shalt not leave the KL ball" with "leaving earns nothing": constraint by incentive design.',
  };

  yield {
    state: table('The lineage, and where it runs today', [
      ['r92', 'REINFORCE ¬∑ 1992'],
      ['ac', 'actor-critic'],
      ['trpo', 'TRPO ¬∑ 2015'],
      ['ppo', 'PPO ¬∑ 2017'],
      ['rlhf', 'RLHF ¬∑ 2022ñ'],
      ['grpo', 'GRPO ¬∑ 2024'],
    ], [['gave', 'what it added']], [
      ['the score-function gradient: learning from sampled actions and rewards alone (Williams)'],
      ['a learned value function as the baseline: the advantage A = R ‚àí V(s), variance tamed at scale'],
      ['the KL trust region via natural gradient ó principled, heavy (Schulman et al.)'],
      ['the clip: trust region by incentive, ten lines, first-order ó the default ever since'],
      ['PPO pointed at language models: human preference scores become the reward ó ChatGPT\'s and Claude\'s training recipe'],
      ['DeepSeek\'s twist: drop the critic, use the group mean of sampled responses as the baseline ó REINFORCE\'s baseline lesson, rediscovered at LLM scale'],
    ]),
    highlight: { active: ['rlhf:gave', 'grpo:gave'] },
    explanation: 'Thirty years from a two-page identity to the training loop behind every aligned chatbot. RLHF is policy gradients with a learned reward: humans rank model outputs, a reward model distills the rankings, and PPO maximizes it ó the actions are tokens, the policy is the LLM, the clip keeps each update from wrecking the language model that collects the next batch. The newest twist closes this page\'s loop perfectly: GRPO (DeepSeek, 2024) deletes the expensive critic network and baselines each response against the MEAN of its sampling group ó the same "subtract the average" insight the second step of this page computed by hand, now saving millions of GPU-hours. The variance tax and its baseline rebate: still the whole game.',
    invariant: 'From Williams to GRPO, one identity and one variance fix: ‚àáE[R] = E[(R ‚àí b)¬∑‚àálog œÄ] ó everything else is engineering.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'REINFORCE & the variance tax') yield* reinforce();
  else if (view === 'trust regions & PPO') yield* ppo();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as noisy evidence about a probability distribution. A policy is a function that maps a state to action probabilities, and a gradient is the direction that changes parameters to improve an objective. Each sampled episode votes for or against the action it took.',
        {type: `callout`, text: `Policy gradients move probability mass, not environment state: they differentiate the log-probability of sampled actions and weight that direction by reward evidence.`},
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/1/1b/Reinforcement_learning_diagram.svg`, alt: `Reinforcement learning loop from agent to action to environment to reward and state`, caption: `Policy gradients learn from this sampled loop: the agent only sees actions, states, and rewards, not a derivative through the environment. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Reinforcement_learning_diagram.svg.`},
        'The raw estimator is unbiased, so its mean points the right way, but the spread is large because each episode is a noisy vote. The baseline panel subtracts average reward before scaling the log-probability gradient. In the PPO view, the clipped flat regions show when the objective stops paying for a larger policy move.',
      
        {type: 'image', src: './assets/gifs/policy-gradients.gif', alt: 'Animated walkthrough of the policy gradients visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Policy gradients exist when the system can score behavior but cannot provide a derivative through the world. A robot falls, a game agent wins, or a language model receives a preference score after sampling a whole answer. The reward is observable, but the environment and the sampling step are not ordinary differentiable layers.',
        'The method optimizes the policy directly. Instead of learning only a value table and then choosing the best action, it changes the probability of actions that produced better outcomes. That matters for continuous actions, stochastic strategies, and language generation, where the action space is too large for enumerating every choice.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep actions that win and discard actions that lose. This is close to the truth, and it works as an intuition for a two-arm bandit. It does not yet say how a neural network parameter should move.',
        'Another approach is Q-learning: estimate Q(s, a), the expected future reward for action a in state s, and pick the largest value. That is practical for small discrete action sets. It breaks down when actions are continuous, token vocabularies are huge, or the policy must remain stochastic.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the sampled action. If the policy samples token 431, the environment only returns a reward for that sampled path. There is no observed reward for every other token, and there is no derivative through the random choice.',
        'Raw reward also has high variance. A good action can receive a bad outcome because the environment was unlucky, and a weak action can get lucky once. Learning from individual episodes without variance control produces updates that point the right way only after many samples.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Differentiate the log probability of the action that was actually sampled. The identity grad E[R] = E[R * grad log pi(a|s)] turns reward-weighted samples into an unbiased gradient estimator. If reward is high, increase the log probability of the sampled action; if reward is low relative to a baseline, decrease it.',
        'A baseline subtracts expected reward without changing the expected gradient. It changes each vote from raw reward to advantage, where advantage means better or worse than expected. That reduces noise while preserving the direction the average update should take.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Collect trajectories with the current policy. For each action, store the observation, action, reward or return, and old log probability. Compute an advantage, usually return minus a baseline value estimate.',
        'REINFORCE multiplies each action\'s log-probability gradient by its return or advantage and applies gradient ascent. Actor-critic methods add a value model, called the critic, to predict expected return and reduce variance. PPO adds a ratio between the new and old policy and clips that ratio so one batch cannot move the policy too far.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The score-function identity is the correctness argument. Because grad pi(a) = pi(a) * grad log pi(a), summing reward times grad pi over actions is the same as taking an expectation of reward times grad log pi over sampled actions. The estimator is noisy, but its average equals the true policy gradient.',
        'The baseline is safe because the expected score is zero: E[grad log pi(a|s)] = grad sum_a pi(a|s) = grad 1 = 0. Multiplying that by a state-dependent baseline adds zero in expectation. PPO clipping is not an exact proof of monotonic improvement, but it is a guardrail against updates that exploit one stale batch too aggressively.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The arithmetic cost is usually smaller than the sample cost. On-policy methods need trajectories from the current or near-current policy, so old data becomes stale after the policy moves. Doubling the batch roughly doubles rollout cost, reward-model scoring, and policy forward passes.',
        'Variance is the behavioral cost. If the true advantage signal is small and returns are noisy, many episodes are needed before the average update becomes reliable. PPO adds extra cost by running several minibatch epochs over collected data and monitoring KL divergence from the old or reference policy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Policy gradients are used in robotics, games, recommender systems, and reinforcement learning from human feedback. They fit when the desired behavior is scored after a sequence of actions rather than labeled at each step. PPO became common because it gives a practical update rule with a simple trust-region-like control.',
        'In language-model RLHF, the action is a token, the trajectory is a generated answer, and the reward often comes from a learned preference model. The policy update increases the probability of answers that score above expectation while measuring drift from a reference model. The same machinery appears in smaller bandit systems when the objective is delayed or non-differentiable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Policy gradients optimize the reward that exists, not the intent behind it. If the reward model overvalues verbosity, loopholes, or superficial signals, the policy learns those shortcuts. This is reward hacking, and it is a measurement failure amplified by optimization.',
        'The methods are sample-inefficient and sensitive to implementation details. Advantage normalization, KL monitoring, entropy bonuses, rollout freshness, value-function quality, and random seeds can change results. PPO clipping is not a true global KL constraint, so serious systems still monitor divergence and stop or shrink updates when drift is too large.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a two-action bandit with actions A and B. The policy starts at 50 percent for each action. A usually pays 1, B usually pays 3, and the baseline is the average reward 2.',
        'If an episode samples B and receives reward 3, the advantage is 3 - 2 = +1. The gradient of log pi(B) increases B\'s probability, so a small step might move B from 50 percent to 55 percent. If another episode samples A and receives reward 1, the advantage is -1, so the update decreases A\'s probability.',
        'For PPO, suppose the old probability of B was 0.50 and the new probability after an update is 0.80. The ratio is 0.80 / 0.50 = 1.6. With clip epsilon 0.2, the objective treats that positive-advantage sample as if the ratio were at most 1.2.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Williams, Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning, 1992; Sutton et al., Policy Gradient Methods for Reinforcement Learning with Function Approximation, 2000; Schulman et al., Trust Region Policy Optimization, 2015; Schulman et al., Proximal Policy Optimization Algorithms, 2017.',
        'Study next: Value Iteration and Q-Learning for value-based alternatives, Gradient Descent for optimizer mechanics, Natural Gradient and Fisher Information for why KL distance matters, Actor-Critic Methods for learned baselines, and RLHF for language-model training with preference rewards.',
      ],
    },
  ],
};


