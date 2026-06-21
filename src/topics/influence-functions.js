// Influence functions: saliency asks which features drove a verdict; this
// page asks which training examples taught it.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'influence-functions',
  title: 'Influence: Which Training Data Did This?',
  category: 'AI & ML',
  summary: 'Delete one training example, retrain, watch the prediction move — exact influence, and the mislabeled point it catches.',
  controls: [
    { id: 'view', label: 'Trace', type: 'select', options: ['which examples taught this verdict', 'hunting the mislabeled point'], defaultValue: 'which examples taught this verdict' },
  ],
  run,
};

// The 10 emails from Logistic Regression: [excl, caps, label].
const DATA = [
  [4, 3, 1], [5, 1, 1], [3, 4, 1], [5, 4, 1], [2, 3, 1],
  [0, 1, 0], [1, 0, 0], [2, 1, 0], [1, 2, 0], [3, 1, 0],
];
const TEST = [3, 2.5];
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function train(data) {
  let w1 = 0;
  let w2 = 0;
  let b = 0;
  const lr = 0.5;
  for (let e = 0; e < 200; e++) {
    let g1 = 0;
    let g2 = 0;
    let gb = 0;
    for (const [x, y, t] of data) {
      const p = sigmoid(w1 * x + w2 * y + b);
      g1 += (p - t) * x;
      g2 += (p - t) * y;
      gb += p - t;
    }
    w1 -= (lr * g1) / data.length;
    w2 -= (lr * g2) / data.length;
    b -= (lr * gb) / data.length;
  }
  return { w1, w2, b, p: (x, y) => sigmoid(w1 * x + w2 * y + b) };
}
const meanLoss = (m, data) =>
  data.reduce((a, [x, y, t]) => {
    const p = m.p(x, y);
    return a - (t * Math.log(p) + (1 - t) * Math.log(1 - p));
  }, 0) / data.length;

const labelOf = ([x, y, t]) => `(${x},${y}) ${t ? 'spam' : 'ham'}`;
const AXES = { x: { label: 'exclamation marks', min: 0, max: 6 }, y: { label: 'ALL-CAPS words', min: -1, max: 6 } };

function* whoTaught() {
  const full = train(DATA);
  const pFull = full.p(...TEST);
  yield {
    state: plotState({
      axes: AXES,
      series: [{ id: 'boundary', label: 'p = 0.5', points: [0, 6].map((x) => ({ x, y: -(full.w1 * x + full.b) / full.w2 })) }],
      markers: [
        ...DATA.map(([x, y, t], i) => ({ id: `d${i}`, x, y, label: t ? 's' : 'h' })),
        { id: 'test', x: TEST[0], y: TEST[1], label: `new email: ${(pFull * 100).toFixed(0)}%` },
      ],
    }),
    highlight: { active: ['test'], visited: ['boundary'] },
    explanation: `The plot fixes the verdict to explain: this new email scores ${(pFull * 100).toFixed(0)}% spam. Instead of asking which input feature mattered, influence asks which training examples made this verdict likely.`,
  };

  const influences = DATA.map((d, i) => {
    const m = train(DATA.filter((_, j) => j !== i));
    return { d, i, dp: m.p(...TEST) - pFull };
  });
  const sorted = [...influences].sort((a, b) => a.dp - b.dp);
  yield {
    state: matrixState({
      title: `Leave-one-out: how p(spam) = ${(pFull * 100).toFixed(1)}% moves when each example vanishes`,
      rows: sorted.map(({ d, i }) => ({ id: `r${i}`, label: labelOf(d) })),
      columns: [{ id: 'dp', label: 'Δp when removed' }],
      values: sorted.map(({ dp }) => [dp]),
      format: (v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`,
    }),
    highlight: {
      removed: [`r${sorted[0].i}:dp`, `r${sorted[1].i}:dp`],
      found: [`r${sorted[sorted.length - 1].i}:dp`, `r${sorted[sorted.length - 2].i}:dp`],
    },
    explanation: `The ledger is exact leave-one-out influence. Delete one training example, retrain, and measure how this email\'s spam score moves. Boundary examples change the verdict most; deep interior examples barely move it.`,
    invariant: 'Exact influence: Δ prediction after deleting one example and fully retraining — the definition, not an estimate.',
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [{ id: 'boundary', label: 'p = 0.5', points: [0, 6].map((x) => ({ x, y: -(full.w1 * x + full.b) / full.w2 })) }],
      markers: DATA.map(([x, y, t], i) => {
        const inf = influences.find((f) => f.i === i).dp;
        return { id: `d${i}`, x, y, label: Math.abs(inf) > 0.01 ? `${inf > 0 ? '+' : ''}${(inf * 100).toFixed(0)}` : '' };
      }),
    }),
    highlight: {
      compare: influences.filter((f) => Math.abs(f.dp) > 0.05).map((f) => `d${f.i}`),
      visited: influences.filter((f) => Math.abs(f.dp) <= 0.01).map((f) => `d${f.i}`),
    },
    explanation: 'Placing influence back on the scatter makes the geometry visible. Examples near the boundary bend the verdict; examples deep in safe territory have almost zero influence on this test point.',
  };

  yield {
    state: matrixState({
      title: 'Scaling the question to real models',
      rows: [
        { id: 'loo', label: 'exact LOO (this page)' },
        { id: 'inf', label: 'influence functions' },
        { id: 'tracin', label: 'TracIn / data Shapley' },
      ],
      columns: [{ id: 'cost', label: 'cost' }, { id: 'catch', label: 'catch' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'n retrainings', 'gold standard, impossible at scale', 'one Hessian solve (Koh & Liang 2017)', 'approximation strains on deep non-convex nets', 'gradient dot-products along training', 'cheaper, noisier'][v],
    }),
    highlight: { active: ['inf:cost'] },
    explanation: 'Exact deletion is the gold standard and the scaling wall. Influence functions approximate the effect with second-order geometry; TracIn uses gradient dot-products. Both trade exactness for avoiding one retraining per example.',
  };
}

function* mislabelHunt() {
  const BAD = [...DATA, [1, 1, 1]];
  const fullBad = train(BAD);
  yield {
    state: plotState({
      axes: AXES,
      series: [{ id: 'boundary', label: 'p = 0.5', points: [0, 6].map((x) => ({ x, y: -(fullBad.w1 * x + fullBad.b) / fullBad.w2 })) }],
      markers: [
        ...DATA.map(([x, y, t], i) => ({ id: `d${i}`, x, y, label: t ? 's' : 'h' })),
        { id: 'bad', x: 1, y: 1, label: 'labeled SPAM?!' },
      ],
    }),
    highlight: { removed: ['bad'], visited: ['boundary'] },
    explanation: 'The highlighted point is suspicious because it sits deep in ham territory but is labeled spam. Influence turns that suspicion into a test: remove each example and ask whether clean validation loss improves.',
  };

  const valBase = meanLoss(fullBad, DATA);
  const hunts = BAD.map((d, i) => {
    const m = train(BAD.filter((_, j) => j !== i));
    return { d, i, val: meanLoss(m, DATA) };
  }).sort((a, b) => a.val - b.val);
  yield {
    state: matrixState({
      title: `Remove each example, retrain, re-grade (baseline loss ${valBase.toFixed(3)})`,
      rows: hunts.slice(0, 6).map(({ d, i }) => ({ id: `h${i}`, label: labelOf(d) })),
      columns: [{ id: 'val', label: 'clean-set loss after removal' }],
      values: hunts.slice(0, 6).map(({ val }) => [val]),
      format: (v) => v.toFixed(3),
    }),
    highlight: { found: [`h${hunts[0].i}:val`], compare: [`h${hunts[1].i}:val`] },
    explanation: `The deletion score now uses clean validation loss. Removing the suspicious point improves loss from ${valBase.toFixed(3)} to ${hunts[0].val.toFixed(3)}; removing legitimate examples is worse or flat. A point whose absence helps is teaching the model the wrong thing.`,
    invariant: 'A training example is suspect exactly when removing it improves held-out loss.',
  };

  yield {
    state: matrixState({
      title: 'The label-debugging workflow',
      rows: [
        { id: 'rank', label: '1. rank by influence / self-influence' },
        { id: 'audit', label: '2. human-review the top 1%' },
        { id: 'fix', label: '3. fix or drop, retrain' },
        { id: 'verify', label: '4. verify on clean validation' },
      ],
      columns: [{ id: 'note', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'memorized points: high self-influence, no support', 'arithmetic shortlists, humans confirm', 'never silently — log the change', 'Cross-Validation discipline applies'][v],
    }),
    highlight: { active: ['rank:note'] },
    explanation: 'The workflow ranks likely label errors before human review. Self-influence is the related signal: examples that only the model itself supports often indicate memorization, poison, or mislabeled data.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'which examples taught this verdict') yield* whoTaught();
  else if (view === 'hunting the mislabeled point') yield* mislabelHunt();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view shows a scatter plot of ten training emails with two features (exclamation marks, ALL-CAPS words) and a logistic-regression decision boundary. The test email is marked with its current spam probability. Active markers are examples whose deletion is being measured. Visited markers are examples already evaluated. Found markers highlight the most influential examples.',
        {type: 'callout', text: 'Influence is a counterfactual data question: remove one training point and measure how the trained model would move.'},
        'The ledger view shows each training example as a row, with one column: the change in the test email\'s spam probability when that example is removed and the model is retrained from scratch. Negative values mean the example was supporting the spam verdict; removing it lowers the score. Positive values mean the example was pushing against it.',
        'The second trace injects a mislabeled point and measures each example\'s effect on clean validation loss instead of a single test prediction. The example whose removal most improves held-out loss is the strongest candidate for a label error.',
      
        {type: 'image', src: './assets/gifs/influence-functions.gif', alt: 'Animated walkthrough of the influence functions visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'If the model makes a mistake, which training points are most responsible, and would the mistake be avoided if those points were removed?',
          attribution: 'Koh & Liang, "Understanding Black-box Predictions via Influence Functions," ICML 2017',
        },
        'Feature attribution answers which parts of the input drove a prediction. Influence asks a different question: which training examples taught the model to behave this way? That question matters when a model gives a suspicious verdict, memorizes a bad label, reproduces copyrighted training data, or appears poisoned.',
        'The idea has a long history. R. Dennis Cook introduced Cook\'s distance in 1977 to measure how much each data point affects the fitted parameters of a linear regression. Cook\'s distance uses the hat matrix to estimate the parameter shift from deleting one observation without actually refitting. Koh and Liang generalized this to arbitrary differentiable models by replacing the hat matrix with the inverse Hessian of the training loss, making the same deletion-approximation idea work for logistic regression, neural networks, and any model trained by empirical risk minimization.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to look at the model\'s weights or the test input\'s features. For the toy spam classifier, that means staring at exclamation counts, all-caps words, and the decision boundary. Feature inspection explains local geometry but cannot tell you which training emails pulled the boundary into that position.',
        'The second instinct is similarity: sort training examples by distance to the test point and assume the nearest ones matter most. But proximity is not influence. A nearby example surrounded by many supporting neighbors may have almost no effect if removed, because the others hold the boundary in place. A farther boundary example may matter far more because it is the marginal vote that tips the separator. Influence is about counterfactual training impact, not geometric distance.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The exact answer is leave-one-out retraining: delete one example, retrain from scratch, measure how the target quantity changes. For n training examples, that requires n full retrainings. With ten emails and 200 gradient-descent steps, this page finishes in milliseconds.',
        'At real scale, the wall is arithmetic. ImageNet has 1.2 million training images. A single ResNet-50 training run takes hours on a modern GPU. Leave-one-out influence for every training point would require 1.2 million retrainings -- roughly 137 GPU-years. For a single test prediction. If you want influence scores for a thousand test points, multiply again. The naive method is the gold standard and the scaling impossibility.',
        'This is the problem Koh and Liang solved: approximate the leave-one-out effect using second-order information from one trained model, without ever retraining.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The core idea from Cook (1977), extended by Koh and Liang (2017), is to ask: if I infinitesimally upweight one training example z, how does the optimal parameter vector theta-hat change? The answer is a classic result from robust statistics. Upweighting z by a small epsilon shifts the optimum by approximately -H_inv * grad_L(z, theta-hat), where H is the Hessian of the total training loss at the optimum and grad_L(z, theta-hat) is the gradient of the loss on example z.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock loss surface with a curved valley', caption: 'A curved loss surface makes the Hessian idea concrete: influence estimates how a small training-weight change moves the optimum through local curvature. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'},
        {
          type: 'code',
          language: 'python',
          text: '# Influence of training point z on test loss at z_test\n# theta_hat: trained parameters\n# H: Hessian of training loss at theta_hat\n\ngrad_z = gradient(loss(z, theta_hat))        # training point gradient\ngrad_test = gradient(loss(z_test, theta_hat)) # test point gradient\n\n# Influence = - grad_test^T . H^{-1} . grad_z\nH_inv_grad_z = solve(H, grad_z)  # Hessian-inverse-vector product\ninfluence = -dot(grad_test, H_inv_grad_z)',
        },
        'The formula has three parts. First, compute the gradient of the loss at the training point z. This is the direction that z pulls the parameters during training. Second, multiply by the inverse Hessian H^{-1}. The Hessian describes the curvature of the loss surface, so H^{-1} translates the gradient pull into an actual parameter shift, accounting for how stiff or flexible the loss landscape is in each direction. Third, dot the result with the test-point gradient to project the parameter shift onto the quantity you care about.',
        'The Hessian is a p-by-p matrix where p is the number of parameters. For a model with millions of parameters, forming and inverting this matrix is impossible. Two approximations make it tractable. Implicit Hessian-vector products compute H*v without ever forming H, using a second backward pass through the computation graph. LiSSA (Linear time Stochastic Second-order Algorithm) estimates H^{-1}*v through a truncated Neumann series: sample mini-batches, apply iterated corrections, and converge to the inverse-Hessian-vector product without storing the full matrix. Koh and Liang showed LiSSA works well enough to rank influential examples on deep networks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The approximation is a first-order Taylor expansion of the retraining process. If the loss is twice-differentiable and the model is at a local minimum (gradient near zero), then small perturbations to the training distribution produce small, linear shifts in the optimal parameters. The Hessian captures the local curvature, so the inverse Hessian tells you how far the optimum moves per unit of gradient force. This is exact in the infinitesimal limit and a good approximation when the perturbation (removing one example out of thousands) is small.',
        'For convex losses like logistic regression, the Hessian is positive definite everywhere, and the optimum is unique. The approximation is tight. For non-convex deep networks, the story is rougher: the Hessian may be indefinite, there are many local minima, and the "optimum" depends on the training trajectory. Adding a damping term (H + lambda*I) regularizes the Hessian and makes the approximation stable, at the cost of some accuracy. Empirically, Koh and Liang showed the approximate influence scores still correlate well with actual leave-one-out retraining on networks trained to convergence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Leave-one-out retraining: full retrain per example, n retrains total, exact gold standard.',
            'Influence functions from Koh and Liang: one H^{-1}*v product per example after one-time Hessian work, tight for convex models and approximate for deep nets.',
            'TracIn from Pruthi et al.: gradient dot-product per checkpoint, cheaper than Hessian methods but noisier and checkpoint-dependent.',
            'Data Shapley from Ghorbani and Zou: Monte Carlo over subset permutations in practice, game-theoretic but expensive even when approximated.',
          ],
        },
        'The Hessian-inverse-vector product is the bottleneck for influence functions. With LiSSA, each product costs O(t * p) where t is the number of Neumann iterations and p is the parameter count. Once you have H^{-1} * grad_z for a training point, computing influence on any test point is a single dot product. This means the expensive work is per-training-point, and you can amortize it across many test queries.',
        'Memory is the second constraint. Storing per-example gradients for n training points with p parameters requires n*p floats. For a 100M-parameter model and 1M training examples, that is 400 TB in float32. Practical implementations compute influence on-the-fly or use gradient compression, random projections, or representative subsets.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Label debugging is the most proven use case. Rank training examples by self-influence (how much does removing this example change the model\'s loss on this same example) or by influence on validation loss. The top-ranked examples disproportionately contain mislabeled data, annotation errors, and ambiguous cases. Koh and Liang found that influence functions identified mislabeled examples in a dog-vs-fish classifier that human review confirmed, and that removing those examples improved test accuracy.',
        'Data poisoning audits use influence to find injected examples that disproportionately affect specific predictions. If an attacker added backdoor examples to shift the model on a trigger pattern, those examples will have high influence on the triggered test inputs. Influence provides a principled shortlist for human review instead of scanning the entire training set.',
        'Data valuation and attribution apply influence to answer which data sources contributed to a model\'s behavior. This matters for licensing disputes, copyright claims, and deciding which data providers to pay. Influence on held-out performance ranks data sources by their marginal contribution to model quality.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High influence does not mean high quality. A mislabeled boundary example is highly influential because it pulls the model the wrong way. A rare but correct minority example is also highly influential because the dataset has little else like it. Removing high-influence data blindly can erase important edge cases and hurt underrepresented groups.',
        'The second-order approximation degrades on large non-convex models. When the loss surface has many saddle points, the Hessian is indefinite, and the damped inverse may not reflect the true retraining behavior. Models trained with heavy data augmentation, dropout, or stochastic depth introduce randomness that the deterministic influence formula does not capture. Empirical studies (Basu et al., 2021) found that influence function rankings can diverge from actual leave-one-out rankings on deep networks, especially for examples far from the decision boundary.',
        {
          type: 'note',
          text: 'Low influence on one test point does not mean useless. Interior examples stabilize class distributions, improve calibration, and may be critical for different test queries. Influence is always target-specific -- never treat it as a global data-quality score.',
        },
        'Group effects are invisible to single-point influence. Two examples may each have low individual influence but high joint influence because they together anchor a region of the boundary. Pairwise and higher-order influence interactions are combinatorially expensive to compute. Removing individually low-influence points can sometimes cause large aggregate shifts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Cook, R.D. "Detection of Influential Observation in Linear Regression," Technometrics, 1977 -- the origin of deletion diagnostics and Cook\'s distance.',
            'Koh & Liang, "Understanding Black-box Predictions via Influence Functions," ICML 2017, https://arxiv.org/abs/1703.04730 -- the generalization to deep models via implicit Hessian-vector products.',
            'Agarwal, Bullins & Hazan, "Second-Order Stochastic Optimization for Machine Learning in Linear Time," JMLR 2017 -- the LiSSA algorithm for scalable H^{-1}*v estimation.',
            'Pruthi et al., "Estimating Training Data Influence by Tracing Gradient Descent," NeurIPS 2020, https://arxiv.org/abs/2002.08484 -- TracIn, the gradient-dot-product alternative.',
            'Ghorbani & Zou, "Data Shapley: Equitable Valuation of Data for Machine Learning," ICML 2019, https://arxiv.org/abs/1904.02868 -- game-theoretic data valuation.',
            'Basu et al., "Influence Functions in Deep Learning Are Fragile," ICLR 2021 -- empirical analysis of where the approximation breaks.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Logistic Regression gives the model geometry used in this visualization.',
            'Prerequisite: Cross-Validation and Honest Evaluation gives the held-out discipline that validates influence claims.',
            'Extension: Data Shapley Valuation gives a game-theoretic alternative to pointwise influence.',
            'Extension: Poisoning Attack Threat Model gives the adversarial setting where influence becomes a defense.',
            'Contrast: Saliency Maps and Feature Attribution explain input features rather than training data.',
            'Contrast: LIME explains black boxes through local function approximation rather than training-data attribution.',
          ],
        },
      ],
    },
  ],
};
