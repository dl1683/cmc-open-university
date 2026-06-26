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
      ['the model\'s calm AND the weights\'s honesty', 'this page: combine them so each covers the other\'s failure'],
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Model + correction" walks through the DR formula piece by piece: the direct-method estimate, the residual correction term, and two stress tests where either the model or the weights are deliberately broken. "The stress tests" runs 500 logged episodes and compares DR against the direct method (DM) and importance sampling (IPS) under adversarial conditions.',
        {type: "callout", text: "Doubly robust estimation makes a model answer auditable by weighting only the residual errors the model left behind."},
        'Active cells mark the current computation. Found cells mark estimates that passed the stress test. Removed cells mark estimates that failed. Compare-highlighted cells invite you to read two numbers side by side and ask why one survived.',
        'At each frame, read the table title for context, the highlighted cells for the claim, and the explanation text below for the mechanism behind it. Pause the animation if you want to verify arithmetic yourself.',
        {type: 'image', src: './assets/gifs/doubly-robust.gif', alt: 'Animated walkthrough of the doubly robust visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'You deployed a recommendation policy that logs which actions it took and what rewards came back. Now you want to know: if you had run a DIFFERENT policy, what would the total reward have been? You cannot rewind time, so you must answer from the logs alone. This is the off-policy evaluation problem.',
        'Two classical estimators attack it. The direct method (DM) fits a reward model to the logs and predicts what the new policy would earn. Importance sampling (IPS) reweights each logged reward by the ratio p(a)/q(a) of the new policy\'s probability to the old policy\'s probability. Both are useful. Both break in predictable, opposite ways.',
        'DR was invented because practitioners needed an estimator that could survive the failure of either ingredient. Not one that needed both to be perfect, but one that needed only one to be right.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct method is the natural first attempt. Fit a regression model m(a) that predicts reward given action a. Compute the new policy\'s expected reward as V_DM = sum of p(a) * m(a). This is clean, low variance, and requires no importance weights. Teams reach for it because the estimate is a single forward pass through the model, and more data always improves the fit.',
        'IPS is the other natural attempt. For each logged sample where the old policy chose action a and observed reward r, compute the importance weight w = p(a) / q(a) and report V_IPS = (1/n) * sum of w * r. This is unbiased when the propensities q(a) are correct and every action the new policy might choose was sometimes logged. Teams reach for it because unbiasedness is a hard mathematical guarantee: with enough data, IPS converges to the truth.',
        'Both are reasonable starting points. The question is what happens when their assumptions crack.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The direct method\'s wall is bias that more data cannot fix. If the reward model systematically under-predicts rewards for the actions the new policy favors, the estimate is confidently wrong and stays wrong forever. The error is structural, baked into the model\'s learned function, invisible from inside the model itself.',
        'IPS\'s wall is variance that grows with coverage mismatch. If the new policy loves an action the old policy rarely chose, the importance weight p(a)/q(a) becomes large. A single logged sample with weight 8 can swing the entire estimate. In the animation\'s stress test B, the bad logger produces weights that spike to 6-8x, and the IPS variance reaches hundreds while the truth is only 5.4.',
        'You face a dilemma: eat the bias or eat the variance. Neither estimator lets you have both stability and honesty at once.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of choosing between a biased-but-calm estimate and an unbiased-but-wild one, DR runs the model first, then audits it with importance-weighted residuals. The model handles the bulk of the answer. The weights carry only the model\'s leftover errors. This is not a blend or average of two estimators. It is a specific algebraic arrangement where the weights\' job shrinks in exact proportion to how good the model is.',
        'The formula: V_DR = sum of p(a)*m(a) + (1/n) * sum of w(a) * (r - m(a)). The first term is the direct method verbatim. The second term reweights not rewards but RESIDUALS: each logged sample asks "how wrong was the model here?" and importance weighting carries those errors into the new policy\'s action distribution. If the model were perfect, every residual would be noise centered on zero, and the second term would vanish. If the weights were perfect, the second term would measure the model\'s bias exactly and subtract it.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/College.png/250px-College.png`, alt: `Causal graph with observed variables and directed arrows`, caption: `A causal graph makes the logged-policy problem visible: treatment, covariates, and outcomes decide what the model and weights must adjust. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:College.png.`},
        'The key architectural move is that weights carry residuals (small numbers) instead of raw rewards (large numbers). A model that explains 90% of the reward variance shrinks the payload under the weights by a factor of 100. This is why DR\'s variance is so much lower than IPS even when the weights are identical.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1: Fit a reward model m(a) to the logged data. This can be any supervised model — linear regression, gradient-boosted trees, a neural network. The model predicts the expected reward for each action.',
        'Step 2: Compute the direct-method baseline. For each action a, multiply the new policy\'s probability p(a) by the model\'s prediction m(a) and sum: V_DM = sum p(a)*m(a). This is the model\'s best guess at the new policy\'s value.',
        'Step 3: For each of the n logged samples, compute the residual r_i - m(a_i), where r_i is the observed reward and a_i is the action the logger chose. Multiply by the importance weight w_i = p(a_i) / q(a_i). Average these weighted residuals to get the correction term: (1/n) * sum w_i * (r_i - m(a_i)).',
        'Step 4: Add the correction to the baseline. V_DR = V_DM + correction. The correction is an IPS estimate applied to the model\'s errors rather than to the raw rewards. Because residuals are smaller than rewards when the model is decent, the weights multiply smaller numbers and the variance drops.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof has two independent branches, and DR is unbiased if either branch holds. Branch 1: suppose m(a) = E[r|a] exactly. Then r - m(a) is mean-zero noise for every action. The weighted residuals average to zero regardless of what the weights are. The correction vanishes, and V_DR = V_DM, which is already correct. Variance is tiny because the weights multiply noise, not signal.',
        'Branch 2: suppose the weights are correct, meaning q(a) is the true logging probability for every action. Then E[w * (r - m(a))] = sum over actions of p(a) * (E[r|a] - m(a)) = V_true - V_DM. The correction exactly equals the model\'s bias, so V_DR = V_DM + (V_true - V_DM) = V_true. The estimate is unbiased even if the model is arbitrarily wrong.',
        'DR\'s bias equals the sum over actions of (weight error) * (model error). This is a PRODUCT of two errors at each action. If either factor is zero everywhere, the bias is zero. If both are nonzero but small, the bias is second-order — the product of two small quantities — which is much smaller than either error alone. Two half-decent ingredients beat one perfect-on-paper one.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Compute cost is dominated by fitting the reward model — the same cost as the direct method alone. Once the model exists, the DR correction is a single O(n) pass over the logged data: one subtraction, one multiplication, and one accumulation per sample. Memory is O(n) if you store the weights, or O(1) if you stream.',
        'Statistical cost is measured in variance. DR variance is proportional to E[w^2 * (r - m)^2]. IPS variance is proportional to E[w^2 * r^2]. The ratio is (r - m)^2 / r^2. A model that explains 90% of reward variance reduces the quantity under the weights by a factor of 100. In the animation\'s stress test B, this turns an IPS variance of hundreds into a DR variance in the tens.',
        'The practical overhead is bookkeeping: you must log propensities q(a) at decision time, fit the model with cross-fitting to avoid overfitting the residuals, and monitor effective sample size and weight tails. These are the same requirements as IPS, plus one model fit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'In causal inference, DR is known as AIPW — augmented inverse propensity weighting — introduced by Robins, Rotnitzky, and Zhao in 1994. The canonical application is estimating treatment effects from observational medical data: "would the patient have recovered under the other drug?" The logging policy is whatever process assigned patients to treatments. The reward model is a regression of outcomes on covariates and treatment.',
        'In industry, ads and recommender teams use DR variants (often called SNIPS/DR or switch estimators) to evaluate candidate ranking policies on logged click data before running any live A/B test. The model absorbs click noise, the weights keep the answer honest. This saves weeks of live experimentation per candidate policy.',
        'In reinforcement learning, DR and its sequential extensions (doubly robust per-decision importance sampling) are standard baselines in off-policy evaluation benchmarks for game-playing and dialogue agents evaluated from replay buffers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DR is not infinitely robust. Its bias is the product of model error and weight error summed over actions. If the model is wrong in exactly the region the logger never explores, the residual audit has no samples to catch the error — both factors are nonzero in the same place, and the product is large. This is the bottom row of the animation\'s survival grid.',
        'Overfitting the reward model on the same data you evaluate with is a subtle trap. If the model memorizes the training samples, its residuals on those samples are near zero, and the correction term disappears. On new data the model\'s errors reappear but the correction was trained away. Always use cross-fitting: split the logged data, fit the model on one fold, compute residuals on the other, and average.',
        'DR also cannot fix problems upstream of the estimator. Position bias in logged clicks, delayed conversions, censored rewards, and selective logging all corrupt the reward signal before DR sees it. If the target policy lives mostly outside the logger\'s support, no estimator can save you — run a cautious online experiment instead.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Five actions with true mean rewards R = [1, 2, 3, 5, 8]. New policy p = [0.05, 0.10, 0.15, 0.30, 0.40]. True value V = 0.05*1 + 0.10*2 + 0.15*3 + 0.30*5 + 0.40*8 = 0.05 + 0.20 + 0.45 + 1.50 + 3.20 = 5.40. Logging policy q = [0.30, 0.30, 0.20, 0.10, 0.10]. A bad reward model uses m(a) = 0.6*R(a) + 1, giving m = [1.60, 2.20, 2.80, 4.00, 5.80].',
        'Direct method: V_DM = 0.05*1.60 + 0.10*2.20 + 0.15*2.80 + 0.30*4.00 + 0.40*5.80 = 0.08 + 0.22 + 0.42 + 1.20 + 2.32 = 4.24. This is off by 1.16 from truth, and no amount of data fixes it because the model compresses the reward range.',
        'Suppose one logged sample: the logger chose action 5 (index 4), observed reward r = 9 (true mean 8, noise +1). Weight w = p(4)/q(4) = 0.40/0.10 = 4.0. Residual = 9 - m(4) = 9 - 5.80 = 3.20. IPS contribution: w*r = 4.0*9 = 36. DR contribution: V_DM + w*(r - m) = 4.24 + 4.0*3.20 = 4.24 + 12.80 = 17.04.',
        'Both estimates are noisy from one sample. But notice what the weight multiplied: IPS asked it to carry 9 (the full reward), DR asked it to carry 3.20 (just the residual). Over 500 samples this difference compounds. The animation runs this exact scenario and shows DR\'s variance is several times smaller than IPS while both converge to approximately 5.4.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Robins, Rotnitzky, and Zhao, "Estimation of Regression Coefficients When Some Regressors Are Not Always Observed" (JASA, 1994), which introduced the AIPW estimator for missing-data problems. Dudik, Langford, and Li, "Doubly Robust Policy Evaluation and Learning" (ICML, 2011) brought DR into the machine-learning off-policy setting with finite-sample error bounds.',
        'Start with "Importance Sampling & Off-Policy Estimation" on this site to understand IPS variance and weight explosions — DR exists to tame them. Then read "Contextual Bandit Logged Policy Evaluation Case Study" to see DR in a real evaluation pipeline with propensity logging, support checks, and effective sample size. Study "Propensity Score Overlap Diagnostics" for the balance checks that determine whether any estimator has enough evidence. For the experimental alternative, see "A/B Testing & p-values" — when you can randomize, DR is unnecessary.',
      ],
    },
  ],
};

