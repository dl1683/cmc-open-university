// Thompson sampling: don't track one number per option — track a whole
// BELIEF about each, and let the width of your uncertainty decide how much
// you explore. Bayesian bandits, 1933, still the production standard.

import { plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'thompson-sampling',
  title: 'Thompson Sampling',
  category: 'AI & ML',
  summary: 'Beta-distribution beliefs that sharpen with data — exploration that fades automatically as certainty grows.',
  controls: [
    { id: 'rounds', label: 'Run', type: 'select', options: ['4 rounds', '8 rounds'], defaultValue: '4 rounds' },
  ],
  run,
};

const ARM_A = 0.04;
const ARM_B = 0.06;
const BATCH = 200;
const GRID = 240;
const X_MAX = 0.14;

// numeric Beta machinery (deterministic; no gamma function needed)
function betaPdf(alpha, beta) {
  const xs = Array.from({ length: GRID }, (_, i) => ((i + 0.5) / GRID) * X_MAX);
  const raw = xs.map((x) => (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x));
  const peak = Math.max(...raw);
  const ys = raw.map((v) => Math.exp(v - peak));
  return { xs, ys };
}
function probBBeatsA(aA, bA, aB, bB) {
  // P(B > A) by numeric integration over the grid
  const A = betaPdf(aA, bA);
  const B = betaPdf(aB, bB);
  const sumA = A.ys.reduce((s, v) => s + v, 0);
  const sumB = B.ys.reduce((s, v) => s + v, 0);
  let cdfA = 0;
  let p = 0;
  for (let i = 0; i < GRID; i += 1) {
    cdfA += A.ys[i] / sumA;
    p += (B.ys[i] / sumB) * cdfA;
  }
  return Math.min(1, Math.max(0, p));
}

export function* run(input) {
  const rounds = String(input.rounds) === '4 rounds' ? 4 : String(input.rounds) === '8 rounds' ? 8 : null;
  if (rounds === null) throw new InputError('Pick a round count.');

  let aA = 1; let bA = 1; let aB = 1; let bB = 1;
  const axes = { x: { label: 'conversion rate' }, y: { label: 'relative belief' } };
  const curves = () => {
    const A = betaPdf(aA, bA);
    const B = betaPdf(aB, bB);
    return [
      { id: 'armA', label: 'A', points: A.xs.map((x, i) => ({ x, y: A.ys[i] })) },
      { id: 'armB', label: 'B', points: B.xs.map((x, i) => ({ x, y: B.ys[i] })) },
    ];
  };

  yield {
    state: plotState({ axes, series: curves() }),
    highlight: {},
    explanation: 'The Multi-Armed Bandits topic used ε-greedy: explore a FIXED fraction blindly, forever. Thompson sampling (1933!) is subtler: hold a full probability DISTRIBUTION over each arm\'s unknown conversion rate. For a yes/no outcome the natural choice is the Beta distribution: start at Beta(1,1) — the flat lines you see, total ignorance — then for every visitor, SAMPLE one plausible rate from each belief and serve whichever arm drew higher. That single trick makes exploration automatic.',
  };

  yield {
    state: plotState({ axes, series: curves() }),
    highlight: { active: ['armA', 'armB'] },
    explanation: `With both beliefs flat, samples from A and B beat each other equally often — traffic naturally splits ~50/50. No ε parameter chose that; ignorance itself did. As data arrives, the update is bookkeeping: Beta(α, β) → wins add to α, losses add to β. The belief narrows around the evidence — and narrower beliefs win samples more consistently.`,
    invariant: 'An arm\'s share of traffic equals the probability — under current beliefs — that it is the best arm.',
  };

  for (let round = 1; round <= rounds; round += 1) {
    const pB = probBBeatsA(aA, bA, aB, bB);
    const nB = Math.round(pB * BATCH);
    const nA = BATCH - nB;
    aA += Math.round(ARM_A * nA);
    bA += nA - Math.round(ARM_A * nA);
    aB += Math.round(ARM_B * nB);
    bB += nB - Math.round(ARM_B * nB);
    yield {
      state: plotState({ axes, series: curves() }),
      highlight: { active: ['armB'], visited: ['armA'] },
      explanation: `Round ${round}: beliefs gave B a ${(pB * 100).toFixed(0)}% chance of being best, so sampling routed ${nB} of ${BATCH} visitors to B (true rates, unknown to the algorithm: A 4%, B 6%). After updating: A ~ Beta(${aA}, ${bA}), B ~ Beta(${aB}, ${bB}). Watch the curves ${round === 1 ? 'start to lean apart' : round === 2 ? 'sharpen — B\'s peak pulls right of A\'s' : 'separate decisively: overlap is where exploration lives, and it is vanishing'}.`,
    };
  }

  const finalPB = probBBeatsA(aA, bA, aB, bB);
  yield {
    state: plotState({ axes, series: curves() }),
    highlight: { active: ['armB'] },
    explanation: `After ${rounds * BATCH} visitors: P(B is best) ≈ ${(finalPB * 100).toFixed(0)}%, and B's traffic share followed it — exploration DECAYED ITSELF as certainty grew, the behavior ε-greedy can never produce with its fixed blind tax. That self-regulation is why Thompson sampling is the production bandit at ad platforms, in Bing's experimentation papers, and across growth tooling: one mechanism, no exploration knob to mistune.`,
  };

  yield {
    state: plotState({ axes, series: curves() }),
    highlight: {},
    explanation: 'The deeper lesson outlives bandits: representing knowledge as DISTRIBUTIONS instead of point estimates buys calibrated decisions — narrow belief, act; wide belief, gather. The same Bayesian update underlies spam filters and medical trial designs (where Thompson allocation sends more patients to the apparently-better treatment mid-trial). Pair with A/B Testing & p-values for the frequentist contrast, and Softmax & Temperature for the other famous way of turning scores into exploration.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Thompson Sampling is a Bayesian bandit algorithm that represents each arm as a distribution, not one estimate. The visualization compares two arms with true conversion rates A = 4% and B = 6%, unknown to the learner. Both start as Beta(1,1), a flat belief over plausible conversion rates. Each batch has 200 visitors; the algorithm routes traffic according to the probability that an arm is best.`,
        `This improves the fixed exploration tax in Multi-Armed Bandits. When beliefs are wide and overlapping, exploration is high. When B's distribution moves right and narrows, B wins most posterior samples and receives most traffic automatically.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `For binary rewards, Beta distributions are convenient because wins and losses update them by counting. A success increments alpha; a failure increments beta. To choose an arm, sample one plausible rate from each Beta distribution and serve the arm with the larger draw. In the page's reporting shortcut, numeric integration estimates P(B > A), then routes that share of the 200-visitor batch to B.`,
        `The curves are the lesson. At the start, both are flat, so traffic is near 50/50. After each batch, B's curve shifts toward 6% and tightens; overlap is where exploration lives. This is uncertainty-aware sampling, not magic. It is philosophically close to Naive Bayes (Spam Filter): keep a probabilistic belief, update with evidence, act on the posterior.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Memory is two parameters per arm for Bernoulli rewards. Sampling or updating is O(k) for k arms. Reporting exact "probability best" can require integration or Monte Carlo, but the decision rule itself is cheap. More complex rewards need richer models, just as Softmax & Temperature needs logits before it can turn scores into probabilities.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Ad platforms, recommender systems, growth teams, and some adaptive trials use Thompson-style allocation when serving the current best option matters. LinUCB Personalized News Case Study is the UCB-style cousin for contextual actions, where uncertainty comes from a ridge-regression matrix instead of a Beta posterior. Policy Gradients: REINFORCE to PPO inherits the same taste for sampling from a policy, but the reward can arrive many steps later. Contextual Bandit Logged Policy Evaluation Case Study explains the production requirement that every sampled action must log its probability so future policies can be replayed. Value Iteration (Reinforcement Learning) is the planning-side cousin when a model of future states is available.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The Beta-Bernoulli version assumes binary, independent, quickly observed outcomes. Delayed revenue, repeated users, correlated sessions, and nonstationary rates need stronger models. Also, Bayesian allocation is not a free frequentist proof. If you need a public ship/no-ship claim, pair the adaptive run with A/B Testing & p-values, Confidence Intervals & the Bootstrap, or a preplanned sequential analysis.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with Multi-Armed Bandits for regret and epsilon-greedy, then LinUCB Personalized News Case Study for contextual upper-confidence bonuses, then A/B Testing & p-values for the fixed-test contrast. Contextual Bandit Logged Policy Evaluation Case Study shows how Thompson-style sampled decisions become reusable logged data through propensity fields. Natural Gradient & Fisher Information shows another place where probability distributions define geometry, while Policy Gradients: REINFORCE to PPO shows how sampling-based decisions scale from two buttons to sequential policies.`,
      ],
    },
  ],
};
