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
        'The animation asks a counterfactual question about training data. A counterfactual is a comparison against a world where one fact is changed; here, one training example is removed and the model is retrained or approximated as if it had been retrained.',
        {type: 'callout', text: 'Influence is a counterfactual data question: remove one training point and measure how the trained model would move.'},
        'Active points are the examples currently being tested, visited points have already been scored, and found points are the examples with the largest measured effect. Negative influence on a spam score means the removed example had been pushing the model toward spam; positive influence means it had been pushing away from spam.',
        {type: 'image', src: './assets/gifs/influence-functions.gif', alt: 'Animated walkthrough of the influence functions visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A trained model is not only a function from inputs to outputs. It is also a compressed record of the examples that shaped its parameters, so debugging a bad prediction often requires asking which rows taught the model that behavior.',
        'Feature attribution explains which input features mattered for one prediction. Influence functions explain which training examples mattered, which is the question you need for label debugging, data poisoning audits, dataset valuation, and copyright or provenance review.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct method is leave-one-out retraining. Remove training example i, train the model again, measure the target prediction or validation loss, put the example back, and repeat for every example.',
        'This is correct because it measures the exact counterfactual. It is also easy to explain to a zero-background reader: the most influential example is the one whose removal changes the thing you care about the most.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Leave-one-out retraining scales with the number of training rows times the cost of a full training run. If a model has 1,000,000 training examples and one training run costs 8 GPU-hours, exact influence over all rows costs 8,000,000 GPU-hours for one target question.',
        'Similarity search does not solve the problem. A nearby training point may be redundant, while a farther boundary point may be the one holding the decision surface in place.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Influence functions replace full retraining with a local sensitivity calculation. If a training row were given a tiny extra weight, its gradient would pull the parameters in one direction; the inverse Hessian converts that pull through the curvature of the loss surface.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock loss surface with a curved valley', caption: 'A curved loss surface makes the Hessian idea concrete: influence estimates how a small training-weight change moves the optimum through local curvature. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'},
        'The Hessian is the matrix of second derivatives of the loss, so it describes local curvature. The influence score then projects the estimated parameter movement onto the test loss or prediction you are trying to explain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Train the model once and save the final parameters. For each training point, compute its loss gradient; for the target test point, compute the gradient of the target loss or score.',
        'The classic estimate is minus the test gradient dotted with H inverse times the training gradient. Practical systems do not form H inverse directly; they solve Hessian-vector products with iterative methods, damping, subsampling, or cheaper gradient-tracing approximations.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a Taylor approximation around the trained optimum. At an optimum, the total training gradient is near zero; a tiny change to one example creates a small force, and local curvature predicts how far the optimum must move to cancel that force.',
        'For convex models with a well-conditioned Hessian, this is a stable approximation to leave-one-out retraining. For deep networks it is not a proof of exact deletion, but it is a principled ranking method when the perturbation is small and the local geometry is informative.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exact leave-one-out costs n full retrains for n training examples. Influence functions pay one training run, then one gradient and one inverse-Hessian-vector-style solve per scored example.',
        'Cost behaves differently depending on reuse. If the expensive vector solve is shared across many test points, scoring more targets can be cheap; if each target needs a fresh solve over a huge model, the method can still be expensive.',
        'Memory is often the hidden cost. Storing per-example gradients for 1,000,000 examples and 100,000,000 parameters is impossible in ordinary memory, so implementations stream, compress, project, or score a candidate subset.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Label debugging uses influence to rank examples whose removal improves validation loss. A high-scoring row is then inspected by a human because it may be mislabeled, ambiguous, duplicated, or adversarial.',
        'Security teams use influence to narrow poisoning investigations. Data owners use it to estimate which sources helped or hurt a model, especially when a global dataset-quality score would hide target-specific behavior.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High influence is not the same as bad data. A rare but correct minority example can be highly influential because few other rows teach the same region of the input space.',
        'The approximation can fail when the model is far from a stable local optimum, the Hessian is noisy or indefinite, training uses heavy randomness, or examples interact in groups. Single-point influence also misses cases where two ordinary examples together create a large effect.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a spam classifier gives a test email p(spam) = 0.82. Removing example A and retraining gives 0.60, removing B gives 0.84, removing C gives 0.81, and removing D gives 0.73.',
        'The influence on the spam probability is old minus new: A = 0.22, B = -0.02, C = 0.01, and D = 0.09. A was the strongest support for the spam verdict, D also supported it, B slightly opposed it, and C barely mattered.',
        'If the validation loss is 0.410 and removing a suspicious row lowers it to 0.355, the improvement is 0.055. That row is not automatically wrong, but it is a good review candidate because its absence made clean held-out behavior better.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Cook, Detection of Influential Observation in Linear Regression, for the statistical origin of deletion diagnostics. Then read Koh and Liang, Understanding Black-box Predictions via Influence Functions, for the modern machine-learning formulation.',
        'Study Hessian Matrix before the curvature formula, Logistic Regression for the toy classifier, Gradient Descent for parameter movement, Data Shapley for a game-theoretic alternative, and TracIn for a cheaper checkpoint-gradient approach.',
      ],
    },
  ],
};
