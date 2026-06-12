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
      heading: 'What it is',
      paragraphs: [
        `Thompson sampling is a Bayesian bandit algorithm that treats each arm's true rate as an unknown quantity described by a probability distribution—specifically a Beta distribution for binary outcomes like click-through rates or ad conversions. Instead of tracking a single point estimate (arm A has 4% conversion, arm B has 6%), you maintain a full belief distribution Beta(α, β) for each, starting flat at Beta(1,1) representing total ignorance.`,
        `Born in 1933 and still the production standard at ad platforms (Google, Microsoft's Bing), medical trial designs, and growth experimentation frameworks. Its core insight: sampling one plausible rate from each distribution and serving whichever arm drew higher creates automatic, self-regulating exploration—no exploration parameter to mistune. The algorithm allocates traffic proportional to P(arm is best), a principle so elegant it explains why Thompson beats ε-greedy across decades of practice.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start with Beta(1,1) for each arm—a flat line representing no prior knowledge. When a visitor arrives, sample one value from arm A's Beta distribution and one from arm B's; serve whichever sample is higher. Record the outcome: a success increments α for that arm, a failure increments β. That's the full update rule, requiring no inverse functions or gamma math—just arithmetic.`,
        `As evidence accumulates, the Beta distribution tightens. If arm B truly converts at 6% and arm A at 4%, B's distribution will shift right and sharpen faster. After enough trials, B's samples beat A's in nearly every draw, so exploration naturally concentrates on the better arm. The traffic share each arm receives equals the current probability—under the learner's beliefs—that it is the best arm. Exploration is not a blind tax (like ε-greedy) but an adaptive allocation tied directly to uncertainty.`,
        `When beliefs diverge completely (overlap nearly gone), you're essentially always serving the best-so-far arm, but you never stopped exploring—the mechanism adapted smoothly from 50/50 splits to 95/5 concentrations without any external knob turning. The width of the distribution IS your exploration mandate.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Computationally trivial: one random sample from a Beta distribution per visitor, one arithmetic update per outcome. Memory per arm is two floats (α and β). The only moderately expensive step is computing P(arm B beats arm A) if you need it for reporting—you integrate the ratio of two Beta PDFs over the domain, but even that runs in milliseconds on modern hardware. Thompson scales linearly with the number of arms and requires no matrix operations, making it deployable at internet scale.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Ad platforms use Thompson sampling to allocate ad creatives (treatments) to users, learning conversion rates in real time while simultaneously serving better-performing ads more often. Microsoft's Bing team publishes experimentation papers validating Thompson against frequentist A/B testing, finding it allocates traffic efficiently without losing statistical validity. Clinical trials now use Thompson allocation to send more patients to apparently-superior treatments mid-trial while remaining statistically sound—a profound ethical improvement over fixed-allocation designs that continue serving inferior arms.`,
        `Growth engineers at startups use Thompson-based bandits to choose between product variants (onboarding flows, pricing tiers, feature flags). The algorithm's self-adapting exploration means it finds winners faster than fixed-allocation tests while avoiding the premature convergence risk of pure exploitation (always picking the current best, which may improve with more data). Every major analytics platform now offers Thompson sampling as a built-in option, often under the label "Bayesian bandits" or "probabilistic allocation."`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Thompson sampling assumes your outcomes are truly binary (success/failure, click/no-click) and independent—delays, batching, or correlated outcomes can break the Beta model. If you're optimizing a complex metric (time-on-page, engagement score), the Beta assumption fails, and you need a more general Bayesian model (multivariate Normal for continuous rewards, Dirichlet for categorical). Practitioners sometimes forget that Thompson's beauty—automatic exploration—only emerges after enough samples; early on with wild priors, it can seem chaotic.`,
        `Another misconception: Thompson sampling is not frequentist-invalid. It produces valid confidence intervals, passes repeated-run guarantees, and can be reported as a proper A/B test if you sequence-check the result. Bayesian bandits and frequentist hypothesis testing are not enemies; Thompson is just a method for sequentially choosing where to sample next, and the final tally still has valid coverage properties.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Read Multi-Armed Bandits to see ε-greedy (the naive baseline Thompson improves on) and the exploration-exploitation tradeoff abstracted. Then A/B Testing & p-values to understand the frequentist formalism Thompson operates within. Softmax & Temperature covers the other famous way to convert estimated arm values into exploration behavior—sampling proportional to softmax scores instead of from Beta distributions, popular in reinforcement learning. For the reasoning behind sequential decision-making under uncertainty, Value Iteration (Reinforcement Learning) shows dynamic programming's view of the same problem over multiple steps. Finally, Reservoir Sampling demonstrates another case where a probability distribution (uniform over items) drives algorithmic decisions, showing the pattern that spans Thompson sampling, rejection sampling, and beyond.`,
      ],
    },
  ],
};

