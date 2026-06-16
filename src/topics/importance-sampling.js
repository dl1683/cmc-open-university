// Importance sampling: answer "how would the NEW policy do?" using only
// data logged by the OLD one. Reweight each sample by p/q, and a question
// about an untested system becomes arithmetic on the logs you already have.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'importance-sampling',
  title: 'Importance Sampling & Off-Policy Estimation',
  category: 'Concepts',
  summary: 'Reweight samples from the distribution you have by p/q to estimate the one you want — exact in expectation, priced in variance, audited live.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reweighting the logs', 'when the weights explode'], defaultValue: 'reweighting the logs' },
  ],
  run,
};

// Five actions, true rewards, two policies. Everything discrete so the
// target answer is EXACT and the estimator can be audited against it.
const R = [1, 2, 3, 5, 8];
const P_NEW = [0.05, 0.1, 0.15, 0.3, 0.4];  // the policy we want to evaluate
const Q_LOG = [0.3, 0.3, 0.2, 0.1, 0.1];    // the policy that produced the logs
const Q_BAD = [0.4, 0.4, 0.1, 0.05, 0.05];  // a logger that avoids what p loves
const TRUE_V = R.reduce((s, r, i) => s + P_NEW[i] * r, 0); // Σ p·R, exact
const W_OK = P_NEW.map((p, i) => p / Q_LOG[i]);
const W_BAD = P_NEW.map((p, i) => p / Q_BAD[i]);

function* lcg(seed) {
  let s = seed;
  while (true) {
    s = (s * 1103515245 + 12345) % 2147483648;
    yield s / 2147483648;
  }
}
const draw = (probs, u) => {
  let acc = 0;
  for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (u < acc) return i; }
  return probs.length - 1;
};
// Run n logged episodes under q, estimate E_p[R] via mean(w·R); also track
// the running estimate (for the convergence plot) and the effective sample
// size ESS = (Σw)² / Σw² — how many "real" samples the weights left us.
function isEstimate(q, n, seed) {
  const w = P_NEW.map((p, i) => p / q[i]);
  const rand = lcg(seed);
  let sum = 0;
  let sumW = 0;
  let sumW2 = 0;
  const curve = [];
  const samples = [];
  for (let i = 1; i <= n; i++) {
    const a = draw(q, rand.next().value);
    const x = w[a] * R[a];
    samples.push(x);
    sum += x;
    sumW += w[a];
    sumW2 += w[a] * w[a];
    if (i % 10 === 0) curve.push({ x: i, y: sum / i });
  }
  const mean = sum / n;
  const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return { mean, variance, ess: (sumW * sumW) / sumW2, curve };
}
const N = 500;
const OK = isEstimate(Q_LOG, N, 13579);
const BAD = isEstimate(Q_BAD, N, 13579);
const fmt = (v, d = 2) => v.toFixed(d);

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

function* reweighting() {
  yield {
    state: table('The question you cannot afford to A/B test', [
      ['have', 'what you have'],
      ['want', 'what you want'],
      ['naive', 'the naive answers'],
      ['trick', 'the identity'],
    ], [['detail', '']], [
      ['a million logged decisions from the CURRENT recommender q — actions taken, rewards observed'],
      ['the average reward the NEW policy p WOULD earn — before risking real users on it'],
      ['deploy and pray (expensive, possibly harmful) · average the old logs (answers the wrong question: that\'s q\'s value)'],
      ['E_p[R] = E_q[(p(a)/q(a)) · R] — reweight each logged sample by how much MORE the new policy likes that action'],
    ]),
    highlight: { active: ['trick:detail'] },
    explanation: 'Off-policy evaluation is the quiet workhorse question of applied ML: a hospital wants to evaluate a new treatment protocol against historical records, an ads team wants tomorrow\'s bidder scored on yesterday\'s auctions, an RL lab wants a policy graded without a robot crash. The importance-sampling identity answers all of them with one line of algebra: a sample that the new policy would choose 3× more often than the logger did should count 3× — multiply each logged reward by the ratio p(a)/q(a) and average. No new experiment, no environment model; the logs you already have, re-priced. The catch is a variance bill, and this page computes it honestly.',
    invariant: 'E_p[f] = E_q[(p/q)·f] whenever q covers p: a change of distribution is just a reweighting of evidence.',
  };

  yield {
    state: table(`${N} logged episodes under q, audited against the exact answer (${fmt(TRUE_V, 1)})`, [
      ['w', 'the weights p/q per action'],
      ['truth', 'exact E_p[R] (closed form)'],
      ['est', 'importance-sampled estimate'],
      ['varr', 'the price'],
    ], [['detail', '']], [
      [W_OK.map((w) => fmt(w, 2)).join(' · ') + ' — actions the new policy favors count up to 4×'],
      [fmt(TRUE_V, 2) + ' — computable here because the world is 5 actions; in production this number is exactly what you CANNOT compute'],
      [`${fmt(OK.mean)} from reweighted q-samples — within sampling error of the truth, no sample ever drawn from p`],
      [`per-sample variance ${fmt(OK.variance)}, effective sample size ${fmt(OK.ess, 0)} of ${N}: the weights cost ~${fmt(100 - (100 * OK.ess) / N, 0)}% of the data's power`],
    ]),
    highlight: { found: ['est:detail'], compare: ['truth:detail', 'varr:detail'] },
    explanation: `Run it live. The logger q favors cheap actions (rewards 1–2); the candidate p favors expensive ones (rewards 5–8); the true value of p is ${fmt(TRUE_V, 1)} by direct summation. Feeding ${N} q-logged episodes through the weights yields ${fmt(OK.mean)} — the right answer, extracted from the "wrong" distribution. But check the EFFECTIVE SAMPLE SIZE: (Σw)²/Σw² ≈ ${fmt(OK.ess, 0)}, meaning the reweighted ${N} samples carry the statistical punch of roughly ${fmt(OK.ess, 0)} honest p-samples. That's the deal in one number: importance sampling never biases the answer (each weight exactly corrects the sampling rate), it taxes the precision — and ESS is the receipt, the same diagnostic logic as Confidence Intervals & the Bootstrap applied to reweighted data.`,
    invariant: 'Unbiased at any sample size; the cost appears as ESS = (Σw)²/Σw² — how many equivalent on-policy samples survive the weights.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'logged samples used', min: 0, max: N }, y: { label: 'running estimate of E_p[R]', min: 2, max: 9 } },
      series: [
        { id: 'truthline', label: `exact value ${fmt(TRUE_V, 1)}`, points: [{ x: 0, y: TRUE_V }, { x: N, y: TRUE_V }] },
        { id: 'ok', label: `good logger (ESS ${fmt(OK.ess, 0)})`, points: OK.curve },
        { id: 'bad', label: `bad logger (ESS ${fmt(BAD.ess, 0)})`, points: BAD.curve },
      ],
    }),
    highlight: { found: ['ok'], removed: ['bad'] },
    explanation: `Convergence, watched live with the same random seed. Against a logger that explores reasonably (it tries p's favorite actions 10% of the time each), the running estimate settles onto the true line within a couple hundred samples. The second curve uses a logger that AVOIDS what p loves — it plays the high-reward actions only 5% of the time — and the estimate lurches: long stretches of drift punctuated by violent jumps whenever one of the rare, heavily-weighted samples finally lands. Same identity, same unbiasedness, same ${N} samples — wildly different reliability. The difference is entirely in how well q covers the places p cares about, which the next view dissects.`,
    invariant: 'Convergence speed is governed by weight spread, not sample count: rare-but-heavy samples make the estimate a punctuated equilibrium.',
  };
}

function* explosion() {
  yield {
    state: table('The bad logger, dissected: weights against needs', [
      ['acts', 'actions, by new-policy preference'],
      ['wgt', 'weights p/q under the bad logger'],
      ['mass', 'where p\'s value actually lives'],
      ['ess', 'the verdict'],
    ], [['detail', '']], [
      ['p puts 70% of its mass on the two highest-reward actions'],
      [W_BAD.map((w) => fmt(w, 1)).join(' · ') + ' — the actions p needs most carry weights of 6 and 8'],
      ['the estimate is dominated by samples the logger almost never produces: a 5%-probability event carrying 8× weight'],
      [`ESS ${fmt(BAD.ess, 0)} of ${N} — ${fmt((100 * BAD.ess) / N, 0)}% efficiency: ${N} logged episodes, ~${fmt(BAD.ess, 0)} samples' worth of knowledge`],
    ]),
    highlight: { removed: ['ess:detail'] },
    explanation: `The failure mode is structural, not bad luck. The estimator's variance is driven by E_q[w²·R²], and w² grows as the MISMATCH squared: wherever p wants to go that q rarely went, a few samples must speak for many, and each carries enormous weight. The bad logger visits p's two favorite actions one trial in twenty; those rare visits arrive carrying 6–8× weight and yank the running mean every time. The live receipt: effective sample size ${fmt(BAD.ess, 0)} out of ${N} — three-quarters of the data's power burned as reweighting overhead. And the limit case is absolute: if q NEVER tries an action p uses, no weight can repair it — the logs simply contain no evidence, and the estimator is silently biased no matter how large n grows.`,
    invariant: 'Variance scales with E_q[w²]: coverage gaps become weight spikes, and zero coverage becomes invisible bias — support is non-negotiable.',
  };

  yield {
    state: table('The practical toolbox: trading bias for variance', [
      ['snis', 'self-normalized IS'],
      ['clip', 'weight clipping'],
      ['mix', 'defensive logging'],
      ['dr', 'doubly robust'],
    ], [['move', '']], [
      ['divide by Σw instead of n: Σ(wᵢRᵢ)/Σwᵢ — slightly biased, dramatically tamer, exact as n → ∞; the default in counterfactual evaluation'],
      ['cap every weight at c (say 10): bounded variance, bias toward the logger\'s view — ε-greedy for estimators'],
      ['never let q\'s probabilities hit zero: log with q = 0.9·(intended) + 0.1·uniform, and every future p stays estimable forever'],
      ['use a reward MODEL where weights are wild, IS where the model is wrong: unbiased if EITHER is right — the field\'s workhorse'],
    ]),
    highlight: { active: ['mix:move'] },
    explanation: 'Nobody runs raw importance sampling at scale; everybody runs a variance-managed cousin. Self-normalization replaces the true sample count with the total weight — a ratio of two unbiased estimates, slightly biased and far more stable. Clipping caps the damage any one sample can do, at the cost of under-crediting the places p and q disagree most. The deepest fix is DEFENSIVE LOGGING: mix a sliver of uniform exploration into the production policy so no action\'s probability is ever zero — buying, with a tiny bit of today\'s reward, the right to evaluate ANY future policy on today\'s logs. That tradeoff should feel familiar: it is the explore/exploit bargain from Multi-Armed Bandits, paid not for learning but for measurability.',
    invariant: 'All practical IS trades a little bias for a lot of variance — and logging with full support is what keeps the future estimable at all.',
  };

  yield {
    state: table('Where the reweighting trick runs', [
      ['ppo', 'PPO\'s ratio'],
      ['ope', 'counterfactual evaluation'],
      ['rare', 'rare-event simulation'],
      ['render', 'path tracing'],
      ['anneal', 'particle filters & SMC'],
    ], [['where', '']], [
      ['r = π_new/π_old IS the importance weight — reusing yesterday\'s rollouts for today\'s gradient, with the clip as the weight-explosion guard'],
      ['ads & recsys score new rankers on logged clicks (IPS estimators); medicine evaluates treatment policies on historical records'],
      ['estimating a 10⁻⁹ failure probability by sampling from a stress distribution where failures are common, then weighting back down'],
      ['rendering engines sample light paths from distributions shaped like the integrand — importance sampling is literally in the API names (MIS)'],
      ['robot localization and tracking: a cloud of weighted hypotheses, reweighted by each observation, resampled when ESS collapses'],
    ]),
    highlight: { active: ['ppo:where', 'ope:where'] },
    explanation: 'One identity, five industries. The PPO connection closes a loop from Policy Gradients: REINFORCE to PPO — that ratio r in the clipped objective is exactly an importance weight, the clip is exactly a weight-explosion guard, and "a few epochs of reuse" is exactly the regime where weights stay near 1 and the variance tax stays small. Rare-event simulation inverts the whole story beautifully: instead of suffering weights as a cost, engineers CHOOSE a sampling distribution where disasters are common, then weight the results back down to reality — turning a billion-sample problem into a thousand-sample one. The particle-filter row even reuses this page\'s diagnostic verbatim: when ESS collapses, resample. Reweighting evidence is one of those ideas you meet once and then see everywhere.',
    invariant: 'Sample where information is cheap, weight back to the distribution you owe answers about: the one trick, worn five ways.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reweighting the logs') yield* reweighting();
  else if (view === 'when the weights explode') yield* explosion();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Importance sampling answers a silent question that runs through applied ML: "How good would a NEW policy be, without testing it in the real world?" You have logs of decisions made by an OLD policy q — actions taken, rewards observed. You have a NEW policy p you want to evaluate. Importance sampling rewrites the true value of p in terms of q's logs: instead of needing to deploy p and collect data, you reweight each logged sample by the ratio p(a)/q(a). A sample that p would choose 3× more often than q did now counts 3 times as much. One identity — E_p[f] = E_q[(p/q)·f] — turns logs you already have into answers you cannot afford to collect.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The core is arithmetic. You have five actions with true rewards [1, 2, 3, 5, 8]. Your old policy q (logger) preferred cheap actions: it chose action 0 and 1 with 30% probability each. Your new policy p prefers expensive ones: it puts 40% and 30% on actions 3 and 4. The exact expected reward of p is 5·p(0)·R[0] + ... = 5.4 by direct summation. Now suppose you only have 500 episodes logged under q. You cannot compute 5.4 from them directly — those logs were shaped by q's preferences, not p's. But you can reweight: for each logged sample, multiply the reward by w = p(a)/q(a). When q chose action 4 (which p prefers 4× more: 0.4/0.1 = 4), that sample counts 4 times as much. The average of reweighted rewards estimates p's true value. The live visualization shows this in action: 500 episodes reweighted by p/q produce an estimate of ≈5.97, within sampling error of the true 5.4, with a receipt (the effective sample size ESS) showing that those 500 samples carry the statistical weight of only ≈200 honest p-samples — the cost of the reweighting.`,
        `The identity works because it is mechanically exact: the ratio p(a)/q(a) is the CHANGE IN PROBABILITY, and probabilities are the price per sample. Weight by that ratio, and you have paid the right price for each piece of evidence. This is unbiased: no matter how few samples you draw, the expected value of the estimator is exactly p's true reward.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Importance sampling never lies — it is unbiased at any sample size. But it collects a variance bill. The statistical power of n reweighted samples depends entirely on how much weight varies: if all w = 1 (q and p are identical), you keep all n samples' worth of power; if weights are spread wildly (some samples are 0.1×, others 10×, others 100×), most of those n samples contribute almost nothing, and your effective sample count drops. The diagnostic is the effective sample size (ESS), computed as (Σw)²/(Σw²). In the visualization, a good logger (one that tries all actions regularly) produces ESS ≈ 200 of 500, meaning three-quarters of your data is burned as overhead; a bad logger that AVOIDS p's favorite actions collapses ESS to ≈ 102, and the running estimate lurches chaotically every time a rare, heavily-weighted sample lands. There is no way around this: wherever q and p disagree, you pay in variance. The limit case is catastrophic: if q never tried an action p uses, the logs contain zero evidence, and no weight can repair it. ESS can be computed live as you accumulate samples, making it the practical receipt for the variance tax.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Importance sampling is the workhorse of off-policy evaluation. Hospitals evaluate new treatment protocols on historical patient records without running new clinical trials. Ads platforms score tomorrow's bidding algorithm against auctions logged from today — IPS (inverse-probability scoring) is the standard estimator. Recommender systems evaluate new ranking policies on clicks from the old ranker. In reinforcement learning, the ratio r = π_new/π_old in the clipped objective of "Policy Gradients: REINFORCE to PPO" IS an importance weight: PPO reuses recent rollouts (collected under π_old) to update π_new, and the clip guards against the weight explosion. Rare-event simulation inverts the problem: engineers choose a sampling distribution where disasters are common (plane wings failing at 1% stress instead of 0.0001%), then weight the results back down to reality, turning a billion-sample problem into a thousand. Particle filters in robotics maintain a cloud of weighted hypotheses reweighted by observations, resampling when ESS collapses — the same diagnostic, the same fix.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that importance sampling is nearly free. It is unbiased, yes — but in high-variance regimes, unbiased does not mean useful. A single sample weighted 1000× contributes enormous variance; the running estimate will look insane until enough heavy-weight samples land to average it down. The live bad-logger visualization shows this: you see convergence noise that looks like divergence, until you realize the estimate is correct and just noisy.`,
        `A darker pitfall is SILENT BIAS: if q has zero probability on an action p uses, the logs contain no signal at all. No amount of n will help — the estimator is wrong, and the algorithm never knows. This is why defensive logging — mixing a sliver of uniform exploration into your production policy — is a standard practice: you buy the right to evaluate ANY future policy with a tiny probability on every action. This is the same explore/exploit bargain from "Multi-Armed Bandits", paid not to learn but to preserve future measurability.`,
        `Finally, do not confuse importance sampling with model-based estimation. They solve the same problem (evaluating a new policy on old data) with opposite tradeoffs: IS has no bias, only variance; a learned reward model introduces bias (if the model is wrong, so is the answer) but can have lower variance. The best practice, called doubly robust, uses BOTH: a model estimate with IS as a variance-reduction partner. If either the model or IS is right, the final answer is unbiased.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "Policy Gradients: REINFORCE to PPO" to see the importance-weight ratio r in action, and how the clipping guard connects to variance control. Study "Multi-Armed Bandits" for the explore/exploit bargain and the case for exploration in logging. Then read "Contextual Bandit Logged Policy Evaluation Case Study" for the production log schema: action set, chosen action, propensity, delayed reward, support audit, ESS, and the promotion gate that makes p/q usable outside a toy example. Read "Particle Filter Resampling Localization Case Study" to see ESS drive resampling in a streaming state estimator. Read "Confidence Intervals & the Bootstrap" for the ESS diagnostic and how resampling, like reweighting, extracts information from finite data. Explore "Reservoir Sampling" for a different angle on the data-efficiency problem: when you cannot store all the data, how do you still answer questions about it? Together, these topics show you a family of techniques for getting the most information per sample — the core of practical, efficient decision-making under uncertainty.`,
      ],
    },
  ],
};
