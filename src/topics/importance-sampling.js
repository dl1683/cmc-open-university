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
const TRUE_V = R.reduce((s, r, i) => s + P_NEW[i] * r, 0); // Σ pÂ·R, exact
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
// Run n logged episodes under q, estimate E_p[R] via mean(wÂ·R); also track
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
      ['deploy and pray (expensive, possibly harmful) Â· average the old logs (answers the wrong question: that\'s q\'s value)'],
      ['E_p[R] = E_q[(p(a)/q(a)) Â· R] — reweight each logged sample by how much MORE the new policy likes that action'],
    ]),
    highlight: { active: ['trick:detail'] },
    explanation: 'Off-policy evaluation is the quiet workhorse question of applied ML: a hospital wants to evaluate a new treatment protocol against historical records, an ads team wants tomorrow\'s bidder scored on yesterday\'s auctions, an RL lab wants a policy graded without a robot crash. The importance-sampling identity answers all of them with one line of algebra: a sample that the new policy would choose 3Ã— more often than the logger did should count 3Ã— — multiply each logged reward by the ratio p(a)/q(a) and average. No new experiment, no environment model; the logs you already have, re-priced. The catch is a variance bill, and this page computes it honestly.',
    invariant: 'E_p[f] = E_q[(p/q)Â·f] whenever q covers p: a change of distribution is just a reweighting of evidence.',
  };

  yield {
    state: table(`${N} logged episodes under q, audited against the exact answer (${fmt(TRUE_V, 1)})`, [
      ['w', 'the weights p/q per action'],
      ['truth', 'exact E_p[R] (closed form)'],
      ['est', 'importance-sampled estimate'],
      ['varr', 'the price'],
    ], [['detail', '']], [
      [W_OK.map((w) => fmt(w, 2)).join(' Â· ') + ' — actions the new policy favors count up to 4Ã—'],
      [fmt(TRUE_V, 2) + ' — computable here because the world is 5 actions; in production this number is exactly what you CANNOT compute'],
      [`${fmt(OK.mean)} from reweighted q-samples — within sampling error of the truth, no sample ever drawn from p`],
      [`per-sample variance ${fmt(OK.variance)}, effective sample size ${fmt(OK.ess, 0)} of ${N}: the weights cost ~${fmt(100 - (100 * OK.ess) / N, 0)}% of the data\'s power`],
    ]),
    highlight: { found: ['est:detail'], compare: ['truth:detail', 'varr:detail'] },
    explanation: `Run it live. The logger q favors cheap actions (rewards 1–2); the candidate p favors expensive ones (rewards 5–8); the true value of p is ${fmt(TRUE_V, 1)} by direct summation. Feeding ${N} q-logged episodes through the weights yields ${fmt(OK.mean)} — the right answer, extracted from the "wrong" distribution. But check the EFFECTIVE SAMPLE SIZE: (Σw)²/Σw² â‰ˆ ${fmt(OK.ess, 0)}, meaning the reweighted ${N} samples carry the statistical punch of roughly ${fmt(OK.ess, 0)} honest p-samples. That\'s the deal in one number: importance sampling never biases the answer (each weight exactly corrects the sampling rate), it taxes the precision — and ESS is the receipt, the same diagnostic logic as Confidence Intervals & the Bootstrap applied to reweighted data.`,
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
    explanation: `Convergence, watched live with the same random seed. Against a logger that explores reasonably (it tries p\'s favorite actions 10% of the time each), the running estimate settles onto the true line within a couple hundred samples. The second curve uses a logger that AVOIDS what p loves — it plays the high-reward actions only 5% of the time — and the estimate lurches: long stretches of drift punctuated by violent jumps whenever one of the rare, heavily-weighted samples finally lands. Same identity, same unbiasedness, same ${N} samples — wildly different reliability. The difference is entirely in how well q covers the places p cares about, which the next view dissects.`,
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
      [W_BAD.map((w) => fmt(w, 1)).join(' Â· ') + ' — the actions p needs most carry weights of 6 and 8'],
      ['the estimate is dominated by samples the logger almost never produces: a 5%-probability event carrying 8Ã— weight'],
      [`ESS ${fmt(BAD.ess, 0)} of ${N} — ${fmt((100 * BAD.ess) / N, 0)}% efficiency: ${N} logged episodes, ~${fmt(BAD.ess, 0)} samples' worth of knowledge`],
    ]),
    highlight: { removed: ['ess:detail'] },
    explanation: `The failure mode is structural, not bad luck. The estimator\'s variance is driven by E_q[w²Â·R²], and w² grows as the MISMATCH squared: wherever p wants to go that q rarely went, a few samples must speak for many, and each carries enormous weight. The bad logger visits p\'s two favorite actions one trial in twenty; those rare visits arrive carrying 6–8Ã— weight and yank the running mean every time. The live receipt: effective sample size ${fmt(BAD.ess, 0)} out of ${N} — three-quarters of the data\'s power burned as reweighting overhead. And the limit case is absolute: if q NEVER tries an action p uses, no weight can repair it — the logs simply contain no evidence, and the estimator is silently biased no matter how large n grows.`,
    invariant: 'Variance scales with E_q[w²]: coverage gaps become weight spikes, and zero coverage becomes invisible bias — support is non-negotiable.',
  };

  yield {
    state: table('The practical toolbox: trading bias for variance', [
      ['snis', 'self-normalized IS'],
      ['clip', 'weight clipping'],
      ['mix', 'defensive logging'],
      ['dr', 'doubly robust'],
    ], [['move', '']], [
      ['divide by Σw instead of n: Σ(wáµ¢Ráµ¢)/Σwáµ¢ — slightly biased, dramatically tamer, exact as n â†’ âˆž; the default in counterfactual evaluation'],
      ['cap every weight at c (say 10): bounded variance, bias toward the logger\'s view — ε-greedy for estimators'],
      ['never let q\'s probabilities hit zero: log with q = 0.9Â·(intended) + 0.1Â·uniform, and every future p stays estimable forever'],
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
      ['r = Ï€_new/Ï€_old IS the importance weight — reusing yesterday\'s rollouts for today\'s gradient, with the clip as the weight-explosion guard'],
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
    { heading: 'How to read the animation', paragraphs: [
        'The animation reads a log collected by one policy q and estimates the value of another policy p. A policy is a probability rule for choosing actions; a log entry records action, reward, and the probability q assigned to that action. Active rows are being reweighted, and compared rows show the exact answer versus the estimate.',
        {type: 'callout', text: 'Importance sampling changes the question by changing weights: samples from q can answer for p only where q actually gathered evidence.'},
        'The safe inference rule is that a logged action can speak for p only if q gave that action nonzero probability. Watch the effective sample size, because it shows how much data survives after weights are applied.',
      
        {type: 'image', src: './assets/gifs/importance-sampling.gif', alt: 'Animated walkthrough of the importance sampling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    { heading: 'Why this exists', paragraphs: [
        'Sometimes the policy you want to evaluate is not the policy that collected the data. A hospital has old treatment logs, an ads system has yesterday bidding logs, and a robotics team has rollouts from a safer controller. Running the new policy live may be expensive or risky.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/MonteCarloIntegrationCircle.svg/500px-MonteCarloIntegrationCircle.svg.png', alt: 'Monte Carlo integration points inside and outside a quarter circle', caption: 'Monte Carlo estimators answer questions with samples. Importance sampling changes where samples come from, then corrects the accounting with weights. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:MonteCarloIntegrationCircle.svg'},
        'Importance sampling estimates an expectation under a target distribution p using samples from a proposal distribution q. The trade is clear: you avoid a new experiment, but you pay variance when p and q disagree.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is to average the logged rewards directly. That gives the value of q, the policy that produced the log. If p and q are nearly identical, it may be a decent rough proxy.',
        'Another approach is to deploy p in an A/B test. That gives clean evidence for p, but it spends real users, money, patients, or hardware risk. It also scales poorly when many candidate policies need screening.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The raw log average answers the wrong expectation. If q chose safe action A 90% of the time and p would choose high-reward action B 90% of the time, q logs contain little evidence about p. The data distribution shaped what you observed.',
        'A/B tests hit an operational wall. Evaluating 50 candidates live either splits traffic into weak samples or exposes users to many unproven policies. Offline evaluation needs a way to correct for the policy that generated the log.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Rewrite the target expectation by multiplying and dividing by q. For an action a, p(a) * reward(a) equals q(a) * [p(a) / q(a)] * reward(a), as long as q(a) is not zero. The ratio p/q is the importance weight.',
        'Actions that p favors more than q receive weight above 1. Actions that p favors less receive weight below 1. If q never sampled an action that p might take, the estimate has no evidence for that part of p and becomes biased.',
      ], },
    { heading: 'How it works', paragraphs: [
        'For each logged sample, read action a, reward r, target probability p(a), and logging probability q(a). Compute w = p(a) / q(a). Add w * r to the numerator, then divide by the number of samples for ordinary importance sampling.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions with different parameters', caption: 'The estimator is healthy when proposal and target densities overlap enough that weights stay controlled. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Normal_Distribution_PDF.svg'},
        'Self-normalized importance sampling divides by sum(w) instead of n. That adds small finite-sample bias but often reduces variance. Effective sample size, ESS = (sum w)^2 / sum(w^2), estimates how many on-policy samples the weighted log is worth.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'The correctness argument is cancellation. The expected weighted contribution under q is q(a) * [p(a) / q(a)] * r(a), which simplifies to p(a) * r(a). Summing over actions gives the target expectation under p.',
        'The support condition is mandatory: whenever p(a) > 0, q(a) must also be > 0. Without support, the denominator is zero and no logged sample can represent that action. More data from the same q cannot fix a missing action.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Compute cost is O(n) time and O(1) extra memory for a log of n samples. The estimator is just one pass of ratios and accumulators. The real cost is statistical, not computational.',
        'Variance grows with large weights. If one action has p(a) = 0.4 and q(a) = 0.01, its weight is 40, so a few samples can dominate the estimate. When 500 logged episodes have ESS = 50, the estimate behaves like only 50 useful on-policy samples.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/72/Relative_error_of_a_Monte_Carlo_integration_to_calculate_pi.svg/500px-Relative_error_of_a_Monte_Carlo_integration_to_calculate_pi.svg.png', alt: 'Relative error plot for Monte Carlo integration estimating pi', caption: 'Monte Carlo error can fall slowly even for a simple target; importance weights can make the effective sample count much smaller than the log size. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Relative_error_of_a_Monte_Carlo_integration_to_calculate_pi.svg'},
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Ads and recommendation systems use inverse propensity scoring to evaluate candidate rankers from logged traffic. The logging policy records the probability of the shown action, and offline evaluation reweights outcomes for a new policy before live testing.',
        'Reinforcement learning uses importance ratios when reusing trajectories from an older policy. PPO clips those ratios to control variance. Rare-event simulation uses the same identity in reverse by sampling failures more often and weighting them back to the real distribution.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'Weight degeneracy is the main failure. A few huge weights can make an unbiased estimate too noisy to use. Clipping weights, self-normalization, defensive exploration, and doubly robust estimators are common variance controls.',
        'Bad logging breaks the math. Missing propensities, rounded probabilities, filtered action sets, delayed rewards, or changed reward definitions make p/q wrong. High-dimensional actions such as generated text can also make useful overlap between p and q nearly vanish.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Rewards are [1, 2, 3, 5, 8]. The logging policy q is [0.30, 0.30, 0.20, 0.10, 0.10], and target policy p is [0.05, 0.10, 0.15, 0.30, 0.40]. The exact value under p is 0.05*1 + 0.10*2 + 0.15*3 + 0.30*5 + 0.40*8 = 5.40.',
        'The weights p/q are [0.17, 0.33, 0.75, 3.00, 4.00]. If a 5-sample log drawn from q contains actions with rewards [1, 2, 2, 3, 8], the weighted reward sum is 0.17*1 + 0.33*2 + 0.33*2 + 0.75*3 + 4*8 = 35.74. Ordinary IS gives 35.74 / 5 = 7.15, high because one rare high-weight sample dominated the small log.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources include Kahn and Harris, Estimation of Particle Transmission by Random Sampling, 1951, and Owen, Monte Carlo Theory, Methods and Examples. Dudik, Langford, and Li explain doubly robust policy evaluation.',
        'Study probability expectations, Monte Carlo estimation, and multi-armed bandits before using importance sampling. Study policy gradients, PPO, particle filters, confidence intervals, and doubly robust estimation next.',
      ], },
  ],
};
