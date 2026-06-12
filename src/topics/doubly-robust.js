// Doubly robust estimation: a reward model that might be wrong, plus
// importance weights that might be wild — combined so the estimate survives
// if EITHER ingredient is right. Two flawed tools, one honest answer.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'doubly-robust',
  title: 'Doubly Robust Estimation',
  category: 'Concepts',
  summary: 'Predict with the model, correct the prediction with importance-weighted residuals: unbiased if the model OR the weights are right — stress-tested live both ways.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['model + correction', 'the stress tests'], defaultValue: 'model + correction' },
  ],
  run,
};

// The same 5-action world as Importance Sampling, for continuity: logger q,
// candidate p, true mean rewards R, reward noise ±2. Truth = Σ p·R = 5.4.
const R = [1, 2, 3, 5, 8];
const NOISE = 2;
const P_NEW = [0.05, 0.1, 0.15, 0.3, 0.4];
const Q_LOG = [0.3, 0.3, 0.2, 0.1, 0.1];
const Q_BAD = [0.4, 0.4, 0.1, 0.05, 0.05];
const TRUE_V = R.reduce((s, r, i) => s + P_NEW[i] * r, 0);
const M_GOOD = [...R];                          // a model that nailed it
const M_BAD = R.map((r) => 0.6 * r + 1);        // systematically distorted
const dm = (m) => m.reduce((s, v, i) => s + P_NEW[i] * v, 0); // direct method

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
// One pass of logs under q; returns IPS and DR estimates with per-sample
// variances, so the two estimators face identical luck.
function run500(q, m, seed) {
  const w = P_NEW.map((p, i) => p / q[i]);
  const rand = lcg(seed);
  const n = 500;
  const ips = [];
  const dr = [];
  const base = dm(m);
  for (let i = 0; i < n; i++) {
    const a = draw(q, rand.next().value);
    const r = R[a] + NOISE * (2 * rand.next().value - 1);
    ips.push(w[a] * r);
    dr.push(base + w[a] * (r - m[a]));
  }
  const stats = (xs) => {
    const mean = xs.reduce((x, y) => x + y, 0) / n;
    const variance = xs.reduce((x, y) => x + (y - mean) ** 2, 0) / n;
    return { mean, variance };
  };
  return { ips: stats(ips), dr: stats(dr), base };
}
const CASE_A = run500(Q_LOG, M_BAD, 24680);   // wrong model, decent weights
const CASE_B = run500(Q_BAD, M_GOOD, 24680);  // wild weights, right model
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

function* modelPlusCorrection() {
  yield {
    state: table('Two estimators, two opposite failure modes', [
      ['dmRow', 'direct method (DM): trust the model'],
      ['ips', 'importance sampling (IPS): trust the weights'],
      ['dream', 'what you actually want'],
    ], [['how', 'how it estimates'], ['fails', 'how it fails']], [
      ['fit a reward model m(a) to the logs, report Σ p(a)·m(a) — no weights, no noise', 'BIASED wherever the model is wrong, and more data never fixes it: the error is baked in'],
      ['reweight logged rewards by p/q (see Importance Sampling & Off-Policy Estimation)', 'unbiased but high-variance — and explosive when the logger barely covers what p loves'],
      ['the model\'s calm AND the weights\' honesty', 'this page: combine them so each covers the other\'s failure'],
    ]),
    highlight: { compare: ['dmRow:fails', 'ips:fails'], active: ['dream:how'] },
    explanation: 'Off-policy evaluation offers two tools with opposite temperaments. The DIRECT METHOD fits a model of rewards and simply asks it about the new policy — beautifully low variance, but any systematic model error becomes systematic answer error, forever; you cannot wash bias out with sample size. IPS is the opposite animal: provably unbiased, but it pays in variance, sometimes ruinously. The classic dilemma is choosing which risk to eat. Doubly robust estimation refuses the choice: it runs BOTH, in an arrangement where the model handles the bulk of the answer and the weights audit only what the model got wrong.',
    invariant: 'DM: bias you cannot detect, variance you love. IPS: bias zero, variance you fear. DR: an architecture for having both halves.',
  };

  yield {
    state: table('The estimator, dissected: V_DR = Σ p·m + mean[ w · (r − m) ]', [
      ['plug', 'part 1 · the model\'s answer'],
      ['resid', 'part 2 · the weighted residual audit'],
      ['cancel1', 'if the MODEL is right'],
      ['cancel2', 'if the WEIGHTS are right'],
    ], [['role', '']], [
      ['Σ p(a)·m(a): the direct method\'s plug-in estimate — smooth, fearless, possibly wrong'],
      ['for every logged sample, the model\'s ERROR on it (r − m), importance-weighted back to p: an IPS estimate not of the value, but of the model\'s bias'],
      ['residuals are pure noise centered on zero — the audit term vanishes on average, weights multiply ~nothing, variance stays tiny'],
      ['the audit term is an unbiased estimate of EXACTLY the model\'s bias, so part 1\'s error is measured and subtracted — wrong model, corrected answer'],
    ]),
    highlight: { active: ['cancel1:role', 'cancel2:role'] },
    explanation: 'Read the formula as a institution: the model gives the answer, the weights audit it. Part 1 is the direct method verbatim. Part 2 reweights not rewards but RESIDUALS — each logged sample asks "how wrong was the model right here?", and importance weighting carries those errors to where the new policy lives. Now trace the two safety proofs. Model right: every residual is noise, the audit averages to zero, and you inherit DM\'s serenity. Weights right: the audit is an unbiased measurement of the model\'s bias — precisely the quantity to subtract — and you inherit IPS\'s honesty. One estimator, two independent reasons to be correct: hence DOUBLY robust.',
    invariant: 'V_DR = DM + IPS(residuals): unbiased if the model is right OR the weights are right — two chances to be correct, one needed.',
  };

  yield {
    state: table(`Stress test A — distorted model, decent logger (truth = ${fmt(TRUE_V, 1)})`, [
      ['dmRow', 'direct method alone'],
      ['ips', 'IPS alone'],
      ['drRow', 'doubly robust'],
    ], [['est', 'estimate'], ['varr', 'per-sample variance']], [
      [`${fmt(CASE_A.base)} — off by ${fmt(TRUE_V - CASE_A.base)}, and it would stay off forever`, '~0 (a plug-in has no sampling noise)'],
      [fmt(CASE_A.ips.mean), fmt(CASE_A.ips.variance)],
      [`${fmt(CASE_A.dr.mean)} — the audit found the model\'s bias and paid it back`, `${fmt(CASE_A.dr.variance)} — ${fmt(CASE_A.ips.variance / CASE_A.dr.variance, 1)}× calmer than IPS`],
    ]),
    highlight: { removed: ['dmRow:est'], found: ['drRow:est', 'drRow:varr'] },
    explanation: `First stress test, computed live on 500 logged episodes: the model is systematically distorted (m = 0.6·R + 1 — it compresses the range, underrating exactly the actions p loves), while the logger covers p decently. The direct method confidently reports ${fmt(CASE_A.base)} against a truth of ${fmt(TRUE_V, 1)} — and that gap is structural, immune to more data. IPS gets ${fmt(CASE_A.ips.mean)} at a variance of ${fmt(CASE_A.ips.variance)}. DR gets ${fmt(CASE_A.dr.mean)} — the weighted residuals measured the model's compression and corrected it — at ${fmt(CASE_A.ips.variance / CASE_A.dr.variance, 1)}× less variance than IPS, because the weights only had to carry the model's ERRORS (a few units) instead of raw rewards (up to 8). Wrong model, right answer, calmer than the honest estimator.`,
    invariant: 'Weights carrying residuals ride smaller numbers than weights carrying rewards: DR beats IPS variance even while fixing DM bias.',
  };
}

function* stressTests() {
  yield {
    state: table(`Stress test B — wild weights, decent model (truth = ${fmt(TRUE_V, 1)})`, [
      ['ips', 'IPS alone (the bad logger from Importance Sampling)'],
      ['drRow', 'doubly robust, same logs'],
      ['why', 'why the explosion was contained'],
    ], [['est', 'estimate'], ['varr', 'per-sample variance']], [
      [fmt(CASE_B.ips.mean), `${fmt(CASE_B.ips.variance)} — weight spikes of 6–8× multiplying full rewards`],
      [fmt(CASE_B.dr.mean), `${fmt(CASE_B.dr.variance)} — ${fmt(CASE_B.ips.variance / CASE_B.dr.variance, 1)}× calmer on identical samples`],
      ['the model already explained the rewards; the 8× weights multiplied residuals of ±2 noise instead of payoffs of 8', '— variance scales with what the weights CARRY'],
    ]),
    highlight: { compare: ['ips:varr', 'drRow:varr'], active: ['why:est'] },
    explanation: `Second stress test, the mirror image: the logger is the coverage-starved one whose ESS collapsed in Importance Sampling & Off-Policy Estimation, but the model is good. Same 500 samples, same luck, live: IPS shows variance ${fmt(CASE_B.ips.variance)} — the rare heavy-weighted samples carry full-size rewards. DR's variance is ${fmt(CASE_B.dr.variance)}, ${fmt(CASE_B.ips.variance / CASE_B.dr.variance, 1)}× smaller, because by the time a weight of 8 lands, the model has already accounted for the reward and the weight multiplies only leftover noise. The general law in one sentence: importance weights are dangerous in proportion to what they're asked to carry, and DR asks them to carry as little as the model allows.`,
    invariant: 'DR variance ∝ E[w²·(r − m)²]: a decent model shrinks the residuals and defuses the very weights that wreck IPS.',
  };

  yield {
    state: table('The full grid: who survives what', [
      ['both', 'model right · weights right'],
      ['mwrong', 'model WRONG · weights right'],
      ['wwrong', 'model right · weights WRONG'],
      ['neither', 'both wrong'],
    ], [['dmCol', 'DM'], ['ipsCol', 'IPS'], ['drCol', 'DR']], [
      ['fine', 'fine (noisy)', 'fine — and lowest variance of all'],
      ['BIASED', 'fine', 'fine — case A, verified live'],
      ['fine (by luck)', 'noisy or biased', 'fine — case B, verified live'],
      ['BIASED', 'unreliable', 'biased too — robustness is doubled, not infinite'],
    ]),
    highlight: { found: ['mwrong:drCol', 'wwrong:drCol'], removed: ['neither:drCol'] },
    explanation: 'The contract, stated as a grid. Down the first three rows DR is the only column that never breaks — that is the theorem, and cases A and B above are rows two and three running live. The last row is the honest one: if the model is distorted AND the logger never visits the regions where it\'s distorted, the audit never sees the evidence, and DR fails too — gracefully (its error is a PRODUCT of the two flaws, so being half-right still helps), but it fails. Doubly robust means two independent chances at correctness, not a proof against all worlds. The practical posture: build the best model you can, log with the best coverage you can afford, and let DR make each one insurance for the other.',
    invariant: 'DR\'s bias = (model error) × (weight error) summed over actions: zero if either factor is zero, small if both are merely imperfect.',
  };

  yield {
    state: table('Where doubly robust runs', [
      ['causal', 'causal inference (AIPW)'],
      ['ope', 'industry off-policy evaluation'],
      ['rl', 'RL evaluation'],
      ['ab', 'the A/B connection'],
    ], [['where', '']], [
      ['the same estimator under its statistics name — augmented inverse propensity weighting (Robins et al., 1994): the standard tool for treatment effects from observational data, where the "logger" is whatever assigned patients to treatments'],
      ['ads and recommender teams score candidate rankers on logged clicks with DR variants (the SNIPS/DR family) before any live test — the model absorbs click noise, the weights keep the answer honest'],
      ['evaluating a new game-playing or dialogue policy from replay buffers: DR and its sequential extensions are the default baselines in off-policy evaluation benchmarks'],
      ['when you CAN randomize, A/B Testing & p-values stays the gold standard — DR is for the questions an experiment can\'t touch: too risky, too slow, or already in the past'],
    ]),
    highlight: { active: ['causal:where'] },
    explanation: 'One estimator, two famous lives. Statistics discovered it as AIPW in the 1990s for causal questions — "would this patient have recovered under the other treatment?" — where nature is the logging policy and nobody gets to rerun the experiment. Machine learning rediscovered it for counterfactual evaluation of rankers and policies, where deploying the candidate IS the expensive experiment. Both fields converged on the same wisdom this page computed: models alone are confidently wrong, weights alone are honestly erratic, and the product structure of DR\'s bias means two half-decent ingredients beat one perfect-on-paper one. The last row keeps perspective: when a randomized test is available and affordable, run it — DR exists for everywhere it isn\'t.',
    invariant: 'AIPW = DR: when experiments are impossible, the model-plus-audit architecture is how observational data earns trust.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'model + correction') yield* modelPlusCorrection();
  else if (view === 'the stress tests') yield* stressTests();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Doubly robust estimation answers a hard question: can you evaluate a new policy on logged data when the logs came from a different policy? Two classical tools exist — the direct method (fit a reward model, use it to predict) and importance sampling (reweight the logged data). Both fail cleanly: the model is biased when wrong, and importance weights explode when coverage is poor. Doubly robust estimation refuses to choose. It runs both tools at once, arranged so that the estimate is correct if EITHER ingredient is right. Two flawed tools, one honest answer.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The formula is the key: V_DR = Σ p(a)·m(a) + mean[ w(a)·(r(a) − m(a)) ]. Part 1 is the direct method: fit a reward model m to the logs and ask what the new policy p would see. Part 2 is an audit: for each logged sample, compute the model's error on it (the residual r − m), reweight that error by importance weight w = p / q (where q is the logger policy), and average the result.`,
        `This arrangement has two independent safety proofs. If the MODEL is right: every residual is noise centered on zero, the audit term vanishes, and you inherit the direct method's serenity — low variance, no sampling noise. If the WEIGHTS are right: the audit term is an unbiased estimate of exactly the model's bias (the quantity you want to subtract), so even if the model is systematically distorted, the correction brings the answer home.`,
        `The key insight is that the audit multiplies RESIDUALS, not raw rewards. In importance sampling, weights are asked to carry full reward magnitudes (up to 8 in the live stress tests); in doubly robust, weights carry only the model's ERRORS. A good model shrinks residuals to noise; the same weight multiplying noise instead of full rewards cuts variance by orders of magnitude.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Compute cost: fit one reward model (same as the direct method), compute importance weights (same as importance sampling), run the formula above. The model-fitting step dominates; the audit is a single pass over the logged data. Variance: depends on the product of model error and weight error. If the model explains the rewards well, variance scales with the model's residual variance (usually tiny); if weights are wild, it scales with the residual magnitudes (much smaller than raw rewards). Bias: equals the PRODUCT of (model error) × (weight error) summed over actions. If either ingredient is right, bias is zero; if both are wrong, DR fails gracefully — the bias is smaller than the sum of independent failures.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Doubly robust estimation has two famous lives. In statistics, it arrived as AIPW (augmented inverse propensity weighting) in Robins et al. (1994), the standard tool for causal inference from observational data — "would the patient recover under the other treatment?" — where the logger is nature and experiments are infeasible. In machine learning and industry, it reappeared for off-policy evaluation: ads and recommender teams use DR variants (the SNIPS/DR family) to score candidate rankers on logged clicks before any live test. Reinforcement learning uses DR and sequential extensions as default baselines in off-policy evaluation benchmarks. When the choice matters — evaluating an expensive ranker against logs without running a live A/A test — DR is the workhorse. When you CAN randomize, run the experiment instead: A/B Testing & p-values stays the gold standard.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most common misunderstanding: "doubly robust means infinitely robust." It does not. The bias is the PRODUCT of model error and weight error; if both are substantially wrong AND correlated (e.g., the model is wrong in regions the logger never explores), DR fails. Robustness is doubled, not infinite — two independent chances to be correct, not a guarantee. Another trap: confusing the audit term with IPS. The audit computes IPS on RESIDUALS (r − m), not on rewards r; this is essential for variance control. A third pitfall: fitting the model on the same logged data you evaluate on. If the model overfits, its residuals become prediction noise on held-out data, and the audit loses its corrective power — always use cross-fitting or separate data.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with "Importance Sampling & Off-Policy Estimation" to understand IPS and its failure modes — DR exists precisely to patch them. Read "Policy Gradients: REINFORCE to PPO" to see where the new policy p comes from in reinforcement learning settings. Study "A/B Testing & p-values" to understand when you can run an experiment instead of relying on off-policy estimates. Explore "Gradient Boosting" to see an ensemble method that also learns to correct model predictions. Together, these illuminate the full landscape of model evaluation: when to trust the model, when to distrust it, and how to combine both stances for an answer you can ship.`,
      ],
    },
  ],
};

