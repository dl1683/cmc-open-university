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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation runs two views. "Reweighting the logs" walks through a ledger of 500 episodes drawn from a logging policy q, each repriced with a weight p(a)/q(a) to estimate the value of a candidate policy p. Tables show the weights, exact answer, IS estimate, variance, and effective sample size. The convergence plot tracks how the running estimate approaches the true value over samples drawn.',
        {type: 'callout', text: 'Importance sampling changes the question by changing weights: samples from q can answer for p only where q actually gathered evidence.'},
        '"When the weights explode" shows the failure mode: a bad logger that avoids the actions p favors. Tables dissect the weight distribution, ESS collapse, and the practical toolbox (self-normalization, clipping, defensive logging, doubly robust). The final table maps the IS identity to five real domains.',
        'Active cells mark the current focus. Found cells mark quantities that match the exact answer. Compare cells highlight the gap between truth and estimate. Removed cells flag pathological values like collapsed ESS. Watch for the gap between "unbiased" and "reliable" -- it is the central lesson.',
      
        {type: 'image', src: './assets/gifs/importance-sampling.gif', alt: 'Animated walkthrough of the importance sampling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A hospital wants to know whether a new treatment protocol would improve outcomes before assigning patients to it. An ads platform wants to score a candidate bidding rule on yesterday\'s auctions without running it live. An RL lab wants to grade a new robot controller without risking a crash. In each case, deploying the new policy to collect fresh data is expensive, slow, or dangerous. The only available evidence is a log of decisions made by the old policy.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/MonteCarloIntegrationCircle.svg/500px-MonteCarloIntegrationCircle.svg.png', alt: 'Monte Carlo integration points inside and outside a quarter circle', caption: 'Monte Carlo estimators answer questions with samples. Importance sampling changes where samples come from, then corrects the accounting with weights. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:MonteCarloIntegrationCircle.svg'},
        'Importance sampling, formalized by Kahn and Harris in 1951 for Monte Carlo neutron transport at Los Alamos, answers this class of problem. It converts samples drawn from one distribution into an estimate of an expectation under a different distribution, using only arithmetic on the existing data. No new experiment is needed. The cost is paid in variance, not in deployment risk.',
        {
          type: 'diagram',
          label: 'Proposal distribution q vs. target distribution p',
          text: [
            '  Reward:     1      2      3      5      8',
            '',
            '  q (logger): |=====  |=====  |====   |==    |==',
            '              0.30   0.30   0.20   0.10  0.10',
            '',
            '  p (target): |=      |==     |===    |=====  |=======',
            '              0.05   0.10   0.15   0.30  0.40',
            '',
            '  weight p/q: 0.17   0.33   0.75   3.00  4.00',
            '',
            '  Where p cares most, q samples least.',
            '  The weight corrects the mismatch -- but at a variance cost.',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to average the rewards in the old logs directly. The logger q chose actions and observed rewards; averaging those rewards gives an unbiased estimate of q\'s value. If p and q are similar, this average is a rough proxy for p\'s value too.',
        'A slightly better attempt is to deploy p on a small slice of traffic -- an A/B test. This gives an unbiased estimate of p\'s value under the true environment, but it requires live exposure. In medicine, A/B testing is a clinical trial. In ads, it means revenue risk. In robotics, it means potential hardware damage. The cost is not computational; it is operational and sometimes ethical.',
        'Both approaches fail to answer the specific question importance sampling addresses: what would p\'s value be, using only data that already exists from q, without deploying p at all?',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The raw average of logged rewards estimates E_q[R], not E_p[R]. When p and q disagree about which actions matter, the average answers the wrong question. If q rarely chose the actions p favors, the raw average is almost entirely about q\'s preferences and says nearly nothing about p.',
        'A/B testing avoids this problem but hits a different wall: you cannot test every candidate policy live. A recommendation team might want to evaluate fifty ranker variants before choosing one to deploy. Running fifty parallel A/B tests requires splitting traffic fifty ways, diluting statistical power and exposing users to many untested systems. The cost scales linearly with the number of candidates.',
        'The structural issue is that the data-generating process (q) shaped which actions appear in the log. Any estimator that ignores this shaping is biased toward q. The wall is distributional mismatch: the samples you have are not from the distribution you need.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The importance sampling identity rewrites an expectation under p as an expectation under q. For any function f(a):',
        {
          type: 'code',
          language: 'text',
          text: 'E_p[f(a)] = sum_a p(a) * f(a)\n           = sum_a q(a) * [p(a)/q(a)] * f(a)\n           = E_q[ w(a) * f(a) ]    where w(a) = p(a) / q(a)',
        },
        'Each logged sample gets a weight w = p(a)/q(a). An action that p would choose 4x more often than q counts 4x. An action p would choose less often shrinks. The weighted average of rewards estimates the value of p. The animation traces this with five discrete actions, rewards [1, 2, 3, 5, 8], and two policies that disagree sharply about which actions matter.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions with different parameters', caption: 'The estimator is healthy when proposal and target densities overlap enough that weights stay controlled. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Normal_Distribution_PDF.svg'},
        {
          type: 'code',
          language: 'javascript',
          text: '// Importance-weighted estimator with likelihood ratio\nfunction importanceSamplingEstimate(loggedData, pPolicy, qPolicy) {\n  let sumWeightedReward = 0;\n  let sumWeight = 0;\n  let sumWeightSq = 0;\n\n  for (const { action, reward } of loggedData) {\n    const w = pPolicy(action) / qPolicy(action);  // likelihood ratio\n    sumWeightedReward += w * reward;\n    sumWeight += w;\n    sumWeightSq += w * w;\n  }\n\n  const n = loggedData.length;\n  const ordinary = sumWeightedReward / n;          // unbiased IS\n  const selfNormalized = sumWeightedReward / sumWeight;  // SNIS: biased, lower variance\n  const ess = (sumWeight * sumWeight) / sumWeightSq;     // effective sample size\n\n  return { ordinary, selfNormalized, ess };\n}',
        },
        'The ordinary estimator divides by n and is unbiased. The self-normalized estimator (SNIS) divides by the sum of weights instead. SNIS is slightly biased but far more stable, because it automatically adjusts for scale differences between p and q. In practice, SNIS is the default in most off-policy evaluation systems.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is a change of measure. For any action a, the expected contribution to the weighted average is q(a) * [p(a)/q(a)] * R(a) = p(a) * R(a). The q in the sampling cancels with the q in the denominator of the weight. Summed over all actions, the result is exactly E_p[R]. The estimator is unbiased whenever q(a) > 0 for every a where p(a) > 0 -- the support condition.',
        'The variance of the estimator is Var_q[w * R] / n. Since w = p/q can be large where p and q disagree, the variance scales with E_q[w^2], which is the second moment of the weight distribution. This is why mismatch between p and q is not just inconvenient -- it is the direct driver of statistical cost. ESS = (sum w)^2 / sum(w^2) measures how many equivalent on-policy samples the weighted data provides.',
        'The support condition is absolute. If q(a) = 0 for some action a where p(a) > 0, the weight is undefined and the log contains zero evidence about that action. The estimator becomes silently biased, not just noisy. No amount of data can repair a coverage gap. This is why production logging policies mix in uniform exploration: they pay a small cost today to guarantee that any future policy can be evaluated.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computation is trivial: one pass over the log, O(n) time, O(1) extra space. For each logged sample, read action, reward, and propensity q(a), compute w = p(a)/q(a), accumulate w*R. The bottleneck is never compute.',
        {
          type: 'table',
          headers: ['Method', 'Bias', 'Variance', 'Data needed', 'Compute'],
          rows: [
            ['Uniform (Monte Carlo)', 'None', 'High for rare events', 'Drawn from target p', 'O(n)'],
            ['Importance sampling', 'None (with support)', 'Depends on p/q mismatch', 'Drawn from proposal q', 'O(n)'],
            ['Stratified sampling', 'None', 'Lower than uniform', 'Strata defined over p', 'O(n) + stratification'],
            ['Self-normalized IS', 'O(1/n) bias', 'Much lower than raw IS', 'Drawn from proposal q', 'O(n)'],
          ],
        },
        'The real cost is statistical. ESS measures how much of the data survives reweighting. If 500 logged episodes yield ESS of 120, the estimate has the precision of 120 on-policy samples -- 76% of the data\'s power is burned as reweighting overhead. When p and q diverge sharply, ESS can collapse to single digits, making the estimate nominally unbiased but practically useless.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/72/Relative_error_of_a_Monte_Carlo_integration_to_calculate_pi.svg/500px-Relative_error_of_a_Monte_Carlo_integration_to_calculate_pi.svg.png', alt: 'Relative error plot for Monte Carlo integration estimating pi', caption: 'Monte Carlo error can fall slowly even for a simple target; importance weights can make the effective sample count much smaller than the log size. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Relative_error_of_a_Monte_Carlo_integration_to_calculate_pi.svg'},
        'Effective sample size: ESS = (sum w)^2 / sum(w^2). This is the diagnostic that matters. Report it alongside every IS estimate. If ESS / n < 0.1, the estimate is fragile. If ESS / n < 0.01, it is noise.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Off-policy evaluation in ads, recommendations, and contextual bandits. Platforms log every decision with its propensity, then evaluate dozens of candidate policies offline before committing to an A/B test. The inverse propensity score (IPS) estimator is importance sampling applied to logged bandit data.',
        'Reinforcement learning reuses rollouts across policy updates. PPO\'s clipped surrogate objective is built on the importance weight pi_new(a|s) / pi_old(a|s). The clip at [1-epsilon, 1+epsilon] is a weight-explosion guard. A few epochs of reuse keep weights near 1 where the variance tax is small.',
        'Rare-event simulation inverts the logic: instead of suffering weight variance as a cost, engineers choose a proposal distribution where failures are common (e.g., stress a bridge at 10x load), simulate under that distribution, then weight results back to the real failure rate. This turns a billion-sample problem (estimate a 10^-9 probability) into a thousand-sample one.',
        'Path tracing in rendering samples light paths from distributions shaped like the integrand. Multiple importance sampling (MIS) combines proposals from different light-sampling strategies. The API names in production renderers literally say "importance sampling."',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Weight degeneracy is the central failure mode. When p and q disagree strongly, a few samples carry enormous weight while most contribute nothing. The estimate becomes a punctuated equilibrium: long stretches of drift interrupted by violent jumps when a rare, heavily-weighted sample lands. Unbiased does not mean useful -- a confidence interval wide enough to include every plausible answer is technically correct and practically worthless.',
        'Bad propensities are an engineering failure that masquerades as a statistics problem. If the logged q(a) is rounded, missing, computed after filtering, or attached to the wrong action set, every weight is wrong. Off-policy evaluation requires a data contract: available actions, chosen action, logged propensity, reward definition, delay window, and any filters that affected exposure. Without this contract, the math is fiction.',
        {
          type: 'note',
          text: 'The self-normalized estimator (SNIS) trades O(1/n) bias for dramatically lower variance. Weight clipping caps each w at a threshold c, bounding variance but biasing toward q. Defensive logging mixes uniform exploration into q so no action has zero probability, guaranteeing future evaluability. Doubly robust estimators combine a reward model with IS correction -- unbiased if either the model or the propensities are correct. Nobody runs raw IS at scale; everyone runs a variance-managed cousin.',
        },
        'High-dimensional action spaces make importance sampling nearly impossible. If actions are sentences, images, or continuous vectors, the probability of any specific action under both p and q is vanishingly small, and weight ratios become astronomically large or degenerate. In these settings, model-based or doubly robust approaches are necessary.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Kahn and Harris, "Estimation of Particle Transmission by Random Sampling," National Bureau of Standards Applied Mathematics Series 12 (1951). The original Monte Carlo importance sampling paper from Los Alamos.',
            'Owen, "Monte Carlo Theory, Methods and Examples," Chapter 9: Importance Sampling (2013). The clearest modern treatment of variance analysis, ESS, and self-normalization.',
            'Dudik, Langford, and Li, "Doubly Robust Policy Evaluation and Learning," ICML 2011. Introduces the DR estimator that combines model prediction with IS correction.',
          ],
        },
        'Study Multi-Armed Bandits for the exploration/exploitation tradeoff that drives logging policy design. Study Policy Gradients: REINFORCE to PPO to see importance weights used during learning, not just evaluation. Study Particle Filter Resampling Localization to see ESS used as a resampling trigger in streaming inference.',
        'Study Confidence Intervals and the Bootstrap for uncertainty quantification around finite estimates. Study Doubly Robust Estimation for the model-assisted extension. Study Reservoir Sampling for a different answer to finite-data pressure when the log is too large to hold in memory.',
      ],
    },
  ],
};
