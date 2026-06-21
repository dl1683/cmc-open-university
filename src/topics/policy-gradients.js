// Policy gradients: when you can't backprop through the world, score it.
// REINFORCE\'s trick, its variance problem, the baseline that fixes it, and
// PPO\'s clipped ratio — the ten lines of code that train RLHF\'d LLMs.

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

// A two-action world: softmax policy over logits θ, action 0 pays +1,
// action 1 pays +3 — each plus zero-mean noise of ±2, because real worlds
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
// âˆ‡θ log Ï€(a): for a softmax, it\'s (1{a=i} âˆ’ Ï€(i)) per logit i.
const scoreVec = (pi, a) => [a === 0 ? 1 - pi[0] : -pi[0], a === 1 ? 1 - pi[1] : -pi[1]];
// True gradient of E[R]: Σ_a Ï€(a)Â·R(a)Â·âˆ‡log Ï€(a).
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
// Sample N episodes at θ = (0, 0) and estimate the θâ‚-gradient with and
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

// REINFORCE training runs, 60 updates of 8 episodes each, same seed —
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
// for advantage +1 and âˆ’1, ε = 0.2 — the famous pair of curves.
const EPS = 0.2;
const clipObj = (r, A) => Math.min(r * A, Math.max(Math.min(r, 1 + EPS), 1 - EPS) * A);
const rGrid = [];
for (let r = 0; r <= 2.0001; r += 0.025) rGrid.push(r);
const PPO_POS = { id: 'apos', label: 'advantage +1 (good action)', points: rGrid.map((r) => ({ x: r, y: clipObj(r, 1) })) };
const PPO_NEG = { id: 'aneg', label: 'advantage âˆ’1 (bad action)', points: rGrid.map((r) => ({ x: r, y: clipObj(r, -1) })) };

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
      ['policy Ï€(a|θ) = softmax(θ) picks an action; the world pays R — here action 0 pays +1, action 1 pays +3'],
      ['sampling an action is a discrete jump, and the reward comes from outside the program: no chain rule through either'],
      ['âˆ‡θ E[R] = E[ R Â· âˆ‡θ log Ï€(a) ] — differentiate the PROBABILITY of what you did, weight it by what you got'],
      ['a gradient estimated purely from (action, reward) pairs: no model of the world, no derivative of the reward'],
    ]),
    highlight: { active: ['trick:detail'] },
    explanation: 'Everything else on this site trains by backpropagating THROUGH the computation. Reinforcement learning can\'t: the environment is not differentiable (you cannot take the derivative of a chess opponent) and the action was SAMPLED — a discrete lottery with no gradient. The score-function identity (REINFORCE, Williams 1992) routes around both walls with one move: instead of differentiating the reward, differentiate the log-probability of the action you took and scale it by the reward you received. Good outcome â†’ push that action\'s probability up; bad outcome â†’ push it down — exactly the law a Multi-Armed Bandits learner follows by instinct, now written as a gradient any optimizer can consume.',
    invariant: 'âˆ‡E[R] = E[R Â· âˆ‡log Ï€]: an unbiased gradient from samples alone — no differentiable world required.',
  };

  yield {
    state: table(`${N_EP} sampled episodes at the uniform policy, estimating the same true gradient (${TRUE_G1.toFixed(2)})`, [
      ['truth', 'exact gradient (closed form)'],
      ['raw', 'REINFORCE estimate'],
      ['base', 'with baseline b = 2'],
      ['ratio', 'variance ratio'],
    ], [['mean', 'mean'], ['variance', 'per-episode variance']], [
      [TRUE_G1.toFixed(3), '— (no sampling, no variance)'],
      [RAW.mean.toFixed(3), RAW.variance.toFixed(2)],
      [BASE.mean.toFixed(3), BASE.variance.toFixed(2)],
      ['both estimators aim at the same target', `${(RAW.variance / BASE.variance).toFixed(1)}Ã— — the baseline pays for itself`],
    ]),
    highlight: { compare: ['raw:variance', 'base:variance'], found: ['ratio:variance'] },
    explanation: `The trick is unbiased — and noisy. This tiny world has a closed-form true gradient (${TRUE_G1.toFixed(2)} on the good action\'s logit), so the estimator can be audited live: ${N_EP} sampled episodes average to ${RAW.mean.toFixed(2)}, on target. But the per-episode variance is ${RAW.variance.toFixed(2)}, because rewards of +1 and +3 BOTH push their action\'s probability up — every single episode shouts "do that again!", and learning happens only through the small difference in how loudly. Subtract a BASELINE first (b = 2, the average reward): now R âˆ’ b is âˆ’1 or +1, below-average actions get pushed DOWN, and the variance drops ${(RAW.variance / BASE.variance).toFixed(1)}Ã— while the mean stays put (${BASE.mean.toFixed(2)}). Subtracting a constant can\'t bias the estimate — E[bÂ·âˆ‡log Ï€] = 0 because probabilities always sum to one — so the baseline is variance reduction with no fine print. "Reward minus baseline" has a name you\'ve seen: the ADVANTAGE.`,
    invariant: 'A baseline shifts nothing and saves much: E[(Râˆ’b)Â·âˆ‡log Ï€] = E[RÂ·âˆ‡log Ï€] for any constant b, with far less variance.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'update', min: 0, max: 60 }, y: { label: 'Ï€(best action)', min: 0.3, max: 1 } },
      series: [
        { id: 'raw', label: 'REINFORCE, no baseline', points: CURVE_RAW },
        { id: 'base', label: 'with baseline (advantage)', points: CURVE_BASE },
      ],
    }),
    highlight: { found: ['base'], visited: ['raw'] },
    explanation: `Both estimators, trained live: 60 updates, 8 episodes each, identical random seed — every difference you see is the variance, nothing else. Both runs learn (the bias is zero either way) and both reach ${(CURVE_BASE.at(-1).y * 100).toFixed(0)}%-ish preference for the +3 action eventually. But watch the no-baseline curve lurch: updates where eight lucky samples of the worse action all shouted "more!" visibly drag the policy the wrong way before the average rescues it. The baseline curve climbs steadily because each update only has to encode WHICH actions beat the batch average — a far smaller fact than the raw reward. In deep RL this gap is not cosmetic: the baseline becomes a learned value function (the "critic" in actor-critic), and without it REINFORCE on a real problem mostly measures noise.`,
    invariant: 'Same seed, same bias, different variance: the baseline turns a random walk with drift into a climb.',
  };
}

function* ppo() {
  yield {
    state: table('The step-size cliff: a policy is a distribution, not a parameter vector', [
      ['collect', '1 Â· collect episodes with Ï€_old'],
      ['step', '2 Â· take a big gradient step'],
      ['ruin', '3 Â· the new policy is ruined'],
      ['trap', '4 Â· and it collects its OWN data'],
    ], [['what', '']], [
      ['the data describes where Ï€_old goes — and only there'],
      ['one oversized update can drop a good action from 60% to 5%: tiny in θ, catastrophic in distribution'],
      ['the gradient was a LOCAL whisper, valid near Ï€_old; far away it pointed nowhere meaningful'],
      ['supervised learning gets a fresh i.i.d. batch regardless of its mistakes — RL must now learn FROM the wreckage it just created'],
    ]),
    highlight: { removed: ['trap:what'] },
    explanation: 'Why policy optimization is more fragile than supervised training, in one cascade. The gradient is only trustworthy near the policy that collected the data — and Natural Gradient & Fisher Information showed why "near" must be measured in distribution space (KL), not parameter space: the same θ-step can be a nudge or an earthquake depending on where you stand. Supervised learning shrugs off a bad step because the next batch is drawn fresh from the same dataset. RL cannot shrug: a wrecked policy collects wrecked data, and the feedback loop can be unrecoverable. TRPO (2015) fixed this with an explicit KL trust region — natural gradient with a constraint — at the cost of second-order machinery per update. The field wanted the constraint without the machinery.',
    invariant: 'RL\'s data distribution is the thing being optimized: one oversized step poisons every future batch — steps must be KL-small.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'r = Ï€_new(a) / Ï€_old(a)', min: 0, max: 2 }, y: { label: 'clipped objective', min: -2.1, max: 1.4 } },
      series: [PPO_POS, PPO_NEG],
    }),
    highlight: { compare: ['apos', 'aneg'] },
    explanation: 'PPO\'s entire idea, drawn live from its formula: L = min(rÂ·A, clip(r, 0.8, 1.2)Â·A), where r is the importance ratio Ï€_new/Ï€_old for an action and A its advantage. Read the good-action curve (A = +1): the objective rewards raising r — but FLATLINES at r = 1.2. Beyond that, zero gradient: no further credit for pushing a good action harder than 20% past the old policy, so the incentive to overshoot simply vanishes. The bad-action curve (A = âˆ’1) is the mirror with a twist: it flatlines at r = 0.8 going down, yet stays STEEP for r > 1 — if a bad action somehow got MORE likely, the gradient to undo the mistake is never clipped. Pessimism in both cases: the min() always picks whichever term hurts the update more.',
    invariant: 'The clip kills gradients that push r beyond [1âˆ’ε, 1+ε] in the favorable direction — and never clips the correction.',
  };

  yield {
    state: table('Why the clip â‰ˆ a trust region (and what it costs)', [
      ['reuse', 'data reuse'],
      ['region', 'the implicit region'],
      ['cheap', 'the price of simplicity'],
      ['honest', 'the fine print'],
    ], [['detail', '']], [
      ['the ratio r makes old data usable for several epochs of updates — importance sampling, with the clip as a leash'],
      ['flat objective beyond r = 1 ± ε â‡’ near-zero incentive to leave the neighborhood: TRPO\'s KL ball, enforced by indifference instead of constraint'],
      ['ten lines of code, first-order only — this is why PPO displaced TRPO almost overnight (Schulman et al., 2017)'],
      ['the clip bounds each ratio, not the true KL; with enough epochs the policy can still drift — practical PPO adds early stopping when KL exceeds a target'],
    ]),
    highlight: { active: ['region:detail'] },
    explanation: 'The clip is a trust region built from indifference: instead of solving a constrained optimization like TRPO, PPO makes the objective stop caring once the policy has moved ε away, and an optimizer follows incentives — where there is no slope, it stops pushing. The honesty row matters: clipping each action\'s ratio is not a true KL bound, and practitioners back it up with a KL early-stop. But the 80% solution at 5% of the complexity won: a first-order method, a few epochs of minibatch reuse per batch of experience, and no Fisher matrix in sight — the cheapest defensible answer to the question Natural Gradient & Fisher Information posed exactly.',
    invariant: 'PPO replaces "thou shalt not leave the KL ball" with "leaving earns nothing": constraint by incentive design.',
  };

  yield {
    state: table('The lineage, and where it runs today', [
      ['r92', 'REINFORCE Â· 1992'],
      ['ac', 'actor-critic'],
      ['trpo', 'TRPO Â· 2015'],
      ['ppo', 'PPO Â· 2017'],
      ['rlhf', 'RLHF Â· 2022–'],
      ['grpo', 'GRPO Â· 2024'],
    ], [['gave', 'what it added']], [
      ['the score-function gradient: learning from sampled actions and rewards alone (Williams)'],
      ['a learned value function as the baseline: the advantage A = R âˆ’ V(s), variance tamed at scale'],
      ['the KL trust region via natural gradient — principled, heavy (Schulman et al.)'],
      ['the clip: trust region by incentive, ten lines, first-order — the default ever since'],
      ['PPO pointed at language models: human preference scores become the reward — ChatGPT\'s and Claude\'s training recipe'],
      ['DeepSeek\'s twist: drop the critic, use the group mean of sampled responses as the baseline — REINFORCE\'s baseline lesson, rediscovered at LLM scale'],
    ]),
    highlight: { active: ['rlhf:gave', 'grpo:gave'] },
    explanation: 'Thirty years from a two-page identity to the training loop behind every aligned chatbot. RLHF is policy gradients with a learned reward: humans rank model outputs, a reward model distills the rankings, and PPO maximizes it — the actions are tokens, the policy is the LLM, the clip keeps each update from wrecking the language model that collects the next batch. The newest twist closes this page\'s loop perfectly: GRPO (DeepSeek, 2024) deletes the expensive critic network and baselines each response against the MEAN of its sampling group — the same "subtract the average" insight the second step of this page computed by hand, now saving millions of GPU-hours. The variance tax and its baseline rebate: still the whole game.',
    invariant: 'From Williams to GRPO, one identity and one variance fix: âˆ‡E[R] = E[(R âˆ’ b)Â·âˆ‡log Ï€] — everything else is engineering.',
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
      heading: `Why this exists`,
      paragraphs: [
        `Policy gradients exist because many learning problems have a missing derivative. A robot falls over, a game agent wins, a recommender gets a delayed click, or a language model receives a preference score after it has already sampled a whole answer. The reward is real, but there is no clean differentiable path from that reward back through the environment and the sampled choices. Supervised learning can say how to change a prediction when the label is known. Policy-gradient learning says how to change a distribution over actions when all you get back is a sampled outcome.`,
        {type: `callout`, text: `Policy gradients move probability mass, not environment state: they differentiate the log-probability of sampled actions and weight that direction by reward evidence.`},
        `Policy gradients are the foundational method for learning when you cannot backpropagate through the world. Instead of differentiating a reward function, you differentiate the probability of what you did and weight it by what you got. The core identity is âˆ‡E[R] = E[RÂ·âˆ‡log Ï€], the score-function trick: increase the log-probability of actions that led to good outcomes and decrease it for bad ones. No differentiable environment. No simulator. No model of the world: only samples, actions taken, and rewards received. REINFORCE (Williams, 1992) turned that identity into a neural-network training rule.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `The visual point is not just that the estimate is noisy. It is that the update direction can be correct in expectation and still painful to use. A single episode can say the unlucky good action was bad or the lucky weak action was great. Batches, baselines, value functions, and PPO-style trust-region controls are all ways of making that noisy voting process usable without changing the basic score-function identity.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/1/1b/Reinforcement_learning_diagram.svg`, alt: `Reinforcement learning loop from agent to action to environment to reward and state`, caption: `Policy gradients learn from this sampled loop: the agent only sees actions, states, and rewards, not a derivative through the environment. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Reinforcement_learning_diagram.svg.`},
        `The first panels compare the true gradient with sampled gradient estimates. The raw estimator is unbiased, so its mean points the right way, but the spread is large because each episode is a noisy vote. The baseline panel subtracts average reward before scaling the log-probability gradient; below-average actions now push down instead of weakly pushing up. The invariant is E[baseline * grad log policy] = 0, so subtracting a constant changes variance without changing the expected gradient. In the PPO view, read the x-axis as the new policy\'s probability ratio to the old policy. The clipped flat regions are the safety mechanism: once a good action is pushed far enough, the objective stops paying for a bigger move.`,
      
        {type: 'image', src: './assets/gifs/policy-gradients.gif', alt: 'Animated walkthrough of the policy gradients visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The obvious approach would be to sample actions, keep the winners, and punish the losers. That intuition is close but incomplete. A learning system needs a gradient for a parameterized policy, so it needs to know how each parameter affected the probability of the sampled action. The log-probability gradient provides exactly that local signal. It says which way to move the parameters to make the sampled action more likely next time.`,
        `The score-function identity works because the gradient of a log-probability tells you how to nudge its argument to make the event MORE likely. For a softmax policy over actions, âˆ‡log Ï€(a) points in the direction of higher probability for action a. If you scale it by the reward you got, you\'re saying: "this action got +3, so turn UP its probability; that other action got +1, so barely nudge it; a failed action got âˆ’2, so push its probability DOWN." This is exactly what humans do intuitively in games: repeat what worked, avoid what didn\'t. The mathematics simply formalizes this instinct as a gradient.`,
        `The visualization shows a two-action world with a simple truth: action 0 pays +1, action 1 pays +3. Noise of ±2 is added because the real world never pays twice the same way. The TRUE gradient has a closed form, so raw REINFORCE estimates can be audited live. With 400 sampled episodes at θ = (0, 0), the raw estimator (no baseline) aims at 0.500 but has noise: mean 0.535, variance 1.28. Now add a baseline b = 2 (the average reward) and recompute advantage = R âˆ’ b for each sample. The per-episode estimate shrinks: same mean 0.500, variance drops to 0.35 — a 3.6Ã— cut with zero bias, because E[bÂ·âˆ‡log Ï€] = 0 always (probabilities sum to one). Training curves (60 updates, 8 episodes, identical seed) show both approaches learning the right policy, but the baseline curve climbs smoothly while the no-baseline curve lurches visibly — one bad luck streak and a bad batch wrong-steps forward.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The sample cost is usually more important than the arithmetic cost. A supervised batch reuses labels that already exist. An on-policy policy-gradient batch is produced by the current policy, so after the policy changes too much the old trajectories become stale. PPO reuses a batch for a few minibatch epochs, but it still lives close to on-policy learning. That is one reason large RLHF jobs spend so much effort on rollout generation, reward-model scoring, filtering, and careful batching.`,
        `REINFORCE is O(1) per sample: compute the policy, sample an action, receive a reward, scale âˆ‡log Ï€, update. In practice, the complexity is hidden in the batch size and episode length: longer environments = more steps to collect before updating. The true cost is *variance*. The baseline solves it but only partway; moving to a learned value function (actor-critic) takes variance much lower by learning to predict cumulative future reward, not just rescaling past reward. PPO tackles a different cost: the step-size cliff. A policy is a distribution, not a point in parameter space. One huge gradient step can drop a good action from 60% probability to 5% — tiny in θ-space but catastrophic in distribution space, measured by KL divergence. TRPO (2015) solved this with natural gradient and an explicit KL trust region (heavy, second-order). PPO (2017) replaces the constraint with a clipped objective L = min(rÂ·A, clip(r, 0.8, 1.2)Â·A) where r = Ï€_new / Ï€_old: if you push a good action too hard, the objective flatlines and stops rewarding further progress. No constraint, no Hessian, one simple clip per action — this is why PPO trains modern LLMs.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `REINFORCE with baselines is the ancestor of actor-critic methods, which add a learned value function (the critic) to reduce variance further. Actor-critic is the template for deep RL (AlphaGo era). RLHF (reinforcement learning from human feedback), the training recipe for ChatGPT and Claude, is PPO applied to language models: humans rank outputs, a reward model scores them, PPO maximizes the score while keeping the LLM\'s distribution KL-close to its original pretrained form (so it doesn\'t forget language). GRPO (DeepSeek, 2024) rediscovered the baseline insight: instead of a learned value network, use the group mean of your sampled responses as the baseline, subtracting the average from each response\'s score. Same variance-cutting logic, no extra network — saving millions of GPU-hours at scale.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Reward hacking is the practical failure mode that gives policy gradients their reputation. The optimizer improves the reward that is present, not the intent that humans forgot to encode. If an environment gives points for standing near a target rather than completing the task, the policy can learn the loophole. In RLHF, the same problem appears when a policy exploits a reward model in regions where the reward model is confident for the wrong reasons.`,
        `A common trap: the baseline is a ceiling on variance reduction. Subtracting a constant helps, but a *learned* value function that estimates true expected future reward cuts variance far more, and that requires solving a supervised learning problem inside your RL loop — another source of bugs. Another trap: the clip in PPO is not a true KL bound. It clips each action\'s importance ratio, not the true KL divergence of the whole policy. Practical PPO adds early stopping when KL exceeds a target, enforcing the region implicitly. A third trap: policy gradients are sample-inefficient — you need a LOT of data because the gradient is a single sample scaled by reward, and high variance means many bad rolls before the average emerges. This is why PPO on language models uses large batch sizes and multiple epochs of minibatch reuse.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Log the old action log probabilities when collecting rollouts. PPO needs the ratio between the new policy and the policy that actually produced the sample. Recomputing the old policy later is fragile because model weights, tokenization, sampling masks, or environment wrappers may have changed. Treat rollout records as evidence: observation, action, reward, done flag, old log probability, value prediction if present, and enough metadata to reproduce the environment version.`,
        `Normalize advantages per batch unless you have a clear reason not to. The sign of the advantage drives whether an action is pushed up or down; the scale controls update size. Advantage normalization does not fix a bad reward definition, but it reduces accidental sensitivity to reward units and batch composition. Monitor entropy, KL, clip fraction, explained variance of the value function, and returns on held-out tasks. A rising reward curve alone can hide collapse.`,
        `For language-model PPO, keep a reference policy and measure divergence from it. The policy should improve the preference objective without drifting so far that it damages fluency, calibration, or safety behavior learned during pretraining and supervised fine-tuning. In smaller RL environments, the same idea appears as trust-region monitoring: compare the action distribution before and after updates, not just parameter norms.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Suppose a two-action policy starts with equal probability for answer A and answer B. A sampled episode chooses B and receives reward 3. The gradient of log probability for B points toward making B more likely. If the baseline is 2, the advantage is +1, so B is nudged upward. If another episode chooses A and receives reward 1, the advantage is -1, so A is pushed downward. The baseline turns raw rewards into relative evidence: better than expected means increase, worse than expected means decrease.`,
        `Now move to PPO. If B already rose from 50 percent to 80 percent probability under the new policy, the ratio for old samples of B may exceed the clip range. PPO still recognizes B as good, but the objective stops paying for making that particular jump even larger. The optimizer must find improvement that stays near the data distribution or wait for new rollouts collected by the updated policy. That is the practical rhythm: collect, estimate advantages, update carefully, measure drift, collect again.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "Value Iteration (Reinforcement Learning)" to see how the Bellman equation structures the problem and why a value function estimates the true answer. Study "Natural Gradient & Fisher Information" to understand why KL distance (not Euclidean distance in parameter space) is the right metric for policy changes, and why TRPO\'s trust region is principled even though PPO\'s clip is simpler. Explore "Multi-Armed Bandits" to see the baseline lesson in its pure form: subtracting the average reward and learning which arm is best, without the cascade of a sequential decision process. Master "Gradient Descent" to see the optimization mechanics under the hood and why step size is the perennial hard problem. Then study RL Experiment Reproducibility Ledger for the seed, environment, reward, and stress-test evidence needed to make PPO-style claims credible.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Q-learning learns Q(s,a) and derives a policy: pick argmax Q. This works for discrete actions (Atari has 18 buttons). But continuous actions — robot joint angles, steering wheel position — require maximizing Q over a continuous action space, which is intractable. Policy gradients sidestep the problem: parameterize the policy directly as π_θ(a|s) = probability of action a in state s, and optimize J(θ) = E[Σ rewards].',
        'REINFORCE (Williams 1992): ∇J(θ) = E[Σ ∇log π_θ(a_t|s_t) · R_t]. If action a_t led to high reward R_t, increase its probability. If low reward, decrease it. The log-derivative trick makes the gradient tractable without knowing the environment dynamics.',
        'The problem is high variance. R_t includes rewards from before action a_t (which it cannot influence) and random future outcomes. Baseline subtraction fixes this: replace R_t with advantage A_t = R_t - V(s_t), where V(s_t) is the expected return from state s_t. A_t measures how much better this action was than average. Actor-critic (Konda & Tsitsiklis 2000) formalizes this: the actor is policy π_θ, the critic is value function V_φ. The actor proposes actions, the critic evaluates them.',
        'PPO (Schulman et al. 2017) clips the policy update to prevent catastrophic changes. It is the default algorithm for most RL applications today: ChatGPT RLHF, robotics, and game AI.',
      ],
    },

    {
      heading: 'Sources and study next',
      paragraphs: [
        'Williams 1992 (Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning) introduced REINFORCE. Sutton et al. 2000 (Policy Gradient Methods for Reinforcement Learning with Function Approximation) proved the policy gradient theorem. Schulman et al. 2017 (Proximal Policy Optimization Algorithms) introduced PPO.',
        'Study next: Q-Learning / Value Iteration for the value-based alternative that policy gradients replace. MCTS for tree-search planning as a complementary approach. Gradient Descent for the optimization mechanics that policy gradients use. RLHF for PPO applied to language model alignment. Actor-Critic Methods for the full combination of policy and value learning.',
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        'A 2-action bandit: actions LEFT and RIGHT, with π_θ(LEFT) = sigmoid(θ) = σ(θ). At θ=0: σ(0)=0.5, equal probability.',
        'Episode 1: action LEFT, reward 10. ∇log π = (1-σ(0)) = 0.5. Update: θ += α·0.5·10 = θ+5α. Now σ(θ) > 0.5 and LEFT is more likely. Episode 2: action RIGHT, reward 1. ∇log π = -σ(θ). Update: θ -= α·σ(θ)·1. LEFT probability decreases slightly. Over many episodes θ converges so π(LEFT) ≈ 1.0 if LEFT consistently gives higher reward.',
        'The variance problem in action: episode 3 gives reward 10 for LEFT, episode 4 gives reward 9 for LEFT. Both increase LEFT probability, but the reward fluctuation creates noisy gradients. Apply a baseline by subtracting the mean reward (9.5): advantages become +0.5 and -0.5, much less noisy, and learning focuses on relative quality rather than absolute magnitude.',
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'REINFORCE updates after complete episodes: high variance, simple. PPO updates using multiple epochs on collected data, clipping the ratio r = π_new/π_old. If r > 1+ε, clip: do not change the policy too much. If r < 1-ε, clip: do not decrease promising actions too aggressively. The standard ε is 0.2.',
        'Why clipping matters: without it, a single lucky trajectory can drastically change the policy. The new policy then collects very different data, creating an unstable spiral. PPO keeps updates small and monotonic.',
        'RLHF (Ouyang et al. 2022) connects this to language models: train a reward model from human preferences, then use PPO to optimize the language model against that reward. The language model is the actor, the reward model is the critic. This is how ChatGPT was aligned — policy gradients running on token-level actions at massive scale.',
      ],
    },
  ],
};
