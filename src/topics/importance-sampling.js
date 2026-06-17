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
        `Importance sampling answers a hard question in applied statistics and machine learning: how good would a new sampling policy be if the data was collected by an old policy? The old policy q chose actions and produced logged rewards. The new policy p has not been deployed yet. Importance sampling evaluates p by reweighting q's logs with the ratio p(a) / q(a).`,
        `The identity is simple: an expectation under p can be written as an expectation under q after multiplying each sample by p / q. A logged action that p would choose three times as often as q counts three times as much. An action p would choose less often counts less. This converts old evidence into an estimate for a new policy without pretending the old logs came from the new policy.`,
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Deploying a new policy can be expensive, slow, or unsafe. A hospital cannot casually route patients through every possible treatment protocol. An ads platform cannot send all traffic to an untested bidding rule. A recommendation system cannot expose users to a weak ranker just to measure it cleanly. Historical logs are often the only evidence available before launch.`,
        `The naive baseline is to average the rewards in the old logs and call that the new policy's value. That fails because the old policy shaped which actions appear. If q rarely chose the actions p prefers, the raw average mostly measures q, not p. Importance sampling exists to correct that sampling mismatch while preserving a clear audit trail: action, reward, old propensity, new probability, weight, and contribution.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The animation is a ledger of evidence. Each row was collected under q, then repriced for p. The weight p(a) / q(a) is the price adjustment. If p likes an action more than q did, that row grows. If p likes it less, that row shrinks.`,
        `The running estimate is useful, but the effective sample size is the warning light. Falling ESS means the estimate is being carried by a small number of high-weight rows. The invariant is support: if q never logged an action p might take, no weight can create evidence for that action. The visual is not only showing convergence; it is showing when old data has enough overlap to answer the new question.`,
      ],
    },
    {
      heading: `Core insight and mechanism`,
      paragraphs: [
        `Suppose there are five actions with rewards [1, 2, 3, 5, 8]. The old logger q chose the cheap actions more often. The new policy p chooses the expensive actions more often. The exact value of p is the sum over actions of p(a) times reward(a). The logs, however, were drawn from q, so their unweighted average estimates q's value.`,
        `Importance sampling changes each logged reward into weight times reward, where weight = p(a) / q(a). If q chose action 4 with probability 0.1 and p would choose it with probability 0.4, that row receives weight 4. If q chose action 0 with probability 0.3 and p would choose it with probability 0.05, that row receives weight 1/6. Averaging these weighted rewards estimates the value of p.`,
        `The estimator is unbiased when q has support everywhere p has support. In expectation, each action's reward is counted in proportion to p, because the q probability of seeing the action cancels with the p / q multiplier. The mechanism is arithmetic, but the operational discipline is logging propensities accurately enough that the arithmetic has something real to divide by.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Importance sampling is cheap computationally and expensive statistically. Computing the estimate is a pass over the log: read action, reward, q probability, p probability, compute weight, and add weight times reward. The hard part is variance. If weights vary wildly, a few rows dominate the estimate while most rows contribute little.`,
        `Effective sample size, often written ESS = (sum w)^2 / sum(w^2), is the practical diagnostic. If 500 logged rows behave like only 120 balanced rows, the estimate may still be unbiased but too noisy for a launch decision. Weight clipping can reduce variance, but it introduces bias. Self-normalized estimators can stabilize scale, but they also change the estimator. Every repair is a tradeoff, not a free improvement.`,
      ],
    },
    {
      heading: `Why it works and when it cannot`,
      paragraphs: [
        `The proof is a change of measure. Draw actions from q. For any action a, the expected weighted reward contribution is q(a) times p(a) / q(a) times reward(a), which simplifies to p(a) times reward(a). Summed across actions, that is exactly the value of p. The old policy supplies samples; the ratio converts their accounting to the new policy.`,
        `The proof also states the failure condition. If q(a) is zero while p(a) is positive, the ratio is undefined and the log contains no examples of that action. This is silent bias, not just high variance. It is why production logging policies often keep a small amount of exploration or randomization: they buy future measurability by ensuring the old policy leaves evidence for plausible future policies.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Importance sampling is the workhorse of off-policy evaluation. Ads platforms score a candidate bidding policy against auctions logged by the current policy. Recommender systems estimate how a new ranker would have performed on clicks produced by an old ranker. Contextual bandit systems use inverse-propensity scoring when each logged decision records the probability of the chosen action.`,
        `The same idea appears outside product logs. Reinforcement learning uses policy ratios when updating a new policy from rollouts collected by an older policy. PPO clips those ratios because huge weights can destabilize learning. Rare-event simulation chooses a sampling distribution where rare failures appear more often, then weights samples back down to the real distribution. Particle filters maintain weighted hypotheses and resample when ESS collapses.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that unbiased means useful. An estimator can be unbiased and still have variance so large that the confidence interval is useless. A single row with weight 1000 can swing the estimate. The right question is not only whether the estimator is correct in expectation, but whether this log contains enough effective evidence for this policy difference.`,
        `A second pitfall is bad propensities. If the logged q probability is rounded, missing, computed after filtering, or attached to the wrong action set, the ratio is wrong. Off-policy evaluation is a data-contract problem as much as a statistics problem. The log must include the available actions, chosen action, logged propensity, reward definition, delay window, and any filters that affected exposure.`,
        `Do not confuse importance sampling with model-based estimation. A learned reward model can have lower variance but introduces model bias. Doubly robust estimators combine a model estimate with an importance-weighted correction. The appeal is practical: if either the model or the propensity side is right under its assumptions, the estimate can remain valid. The cost is more machinery and more ways to violate the assumptions silently.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Multi-Armed Bandits for exploration and logging propensities. Study Contextual Bandit Logged Policy Evaluation for the production schema: action set, chosen action, propensity, delayed reward, support audit, ESS, and promotion gate. Study Policy Gradients: REINFORCE to PPO to see policy ratios used during learning, not only evaluation.`,
        `Then study Particle Filter Resampling Localization to see ESS used in a streaming state estimator, Confidence Intervals and the Bootstrap for uncertainty around finite estimates, Doubly Robust Estimation for model-assisted off-policy evaluation, and Reservoir Sampling for a different answer to finite-data pressure. Together they teach the same operational lesson: old data can answer new questions only when the sampling process is part of the record.`,
      ],
    },
  ],
};
