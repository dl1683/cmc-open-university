// Influence functions: saliency asks which features drove a verdict; this
// page asks which training examples taught it.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'influence-functions',
  title: 'Influence: Which Training Data Did This?',
  category: 'AI & ML',
  summary: 'Delete one training example, retrain, watch the prediction move â€” exact influence, and the mislabeled point it catches.',
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
      columns: [{ id: 'dp', label: 'Î”p when removed' }],
      values: sorted.map(({ dp }) => [dp]),
      format: (v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`,
    }),
    highlight: {
      removed: [`r${sorted[0].i}:dp`, `r${sorted[1].i}:dp`],
      found: [`r${sorted[sorted.length - 1].i}:dp`, `r${sorted[sorted.length - 2].i}:dp`],
    },
    explanation: `The ledger is exact leave-one-out influence. Delete one training example, retrain, and measure how this email's spam score moves. Boundary examples change the verdict most; deep interior examples barely move it.`,
    invariant: 'Exact influence: Î” prediction after deleting one example and fully retraining â€” the definition, not an estimate.',
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
      format: (v) => ['', 'memorized points: high self-influence, no support', 'arithmetic shortlists, humans confirm', 'never silently â€” log the change', 'Cross-Validation discipline applies'][v],
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
      heading: `Why this exists`,
      paragraphs: [
        `Feature explanations answer one question: which parts of this input pushed the prediction? Influence asks a different question: which training examples made the model behave this way? That question matters when a model gives a strange verdict, memorizes a bad example, repeats copyrighted material, or appears to have learned from poisoned data.`,
        `This article starts with the exact version because it is easy to trust. Delete one training example, retrain the model, and measure how the target prediction or validation loss changes. That counterfactual change is leave-one-out influence. It is expensive, but it gives the ground truth that scalable approximations are trying to imitate.`,
      ],
    },
    {
      heading: `The naive explanation`,
      paragraphs: [
        `The naive explanation is to inspect the final weights or the features in the test input. For the toy spam classifier, that means staring at exclamation marks, all-caps words, and the learned decision boundary. That can explain the local geometry, but it cannot tell you which training emails pulled the boundary into that position.`,
        `Another naive approach is to sort examples by similarity to the test point. Similarity can be useful, but it is not influence. A nearby example may have little effect if many other examples support the same region. A farther boundary example may matter more because removing it changes the fitted separator. Influence is about counterfactual training impact, not just distance.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core idea is deletion. Train on the full dataset and record the target quantity: a test probability, a logit, a loss, or a validation score. Then remove one training example, retrain from the remaining data, and measure the same target again. The difference is that example's exact leave-one-out influence on the target.`,
        `The sign matters. If removing an example lowers the spam probability for the test email, that example was supporting the spam verdict. If removing it raises the spam probability, that example was pushing against the verdict. If nothing changes, the example was not influential for this particular target, even if it is useful elsewhere in the dataset.`,
      ],
    },
    {
      heading: `How the toy system works`,
      paragraphs: [
        `The visualization uses a tiny logistic-regression spam classifier. Each email has two features: exclamation marks and all-caps words. The model learns a linear boundary that separates spam-labeled examples from ham-labeled examples. A new email lands near that boundary, so the page asks which training points made its spam score high or low.`,
        `Because there are only ten examples, the page can do the exact thing: retrain once per deletion. That is not how large systems usually run influence, but it is the right teaching move. It shows the definition before introducing approximation. Boundary examples move the verdict most because they help decide where the separator must sit.`,
      ],
    },
    {
      heading: `What the visual proves`,
      paragraphs: [
        `The first view proves that influence is target-specific. The same training set can contain examples that strongly affect one test email and barely affect another. The ledger orders examples by how much the chosen spam probability changes after deletion, so the explanation is about this verdict, not a global ranking of data quality.`,
        `The second view proves the debugging use case. A point labeled spam sits deep in ham territory. Geometry makes it suspicious, but deletion makes the argument testable. Remove each example, retrain, and score against clean validation data. If removing one example improves held-out loss, that example is a candidate for review because its presence was teaching the model the wrong pattern.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Influence works because training is an optimization process over data. Each example contributes gradients that pull the parameters toward lower loss on that example. If an example sits near a decision boundary or conflicts with nearby labels, its gradient can have a large effect on the fitted parameters. Deleting it changes the optimum, which changes predictions.`,
        `Classical influence functions approximate that deletion without fully retraining. They use second-order local geometry: how would the optimum move if the weight of one training example were reduced slightly? The Hessian describes curvature around the optimum, and the example gradient describes the direction of pressure. This is the mathematical bridge from exact deletion to scalable estimation.`,
      ],
    },
    {
      heading: `Scaling up`,
      paragraphs: [
        `Exact leave-one-out costs one retraining per candidate example. That is fine for ten emails and impossible for millions of images, documents, or code files. Scalable influence methods trade exactness for cheaper estimates. Koh and Liang's influence functions use Hessian-vector products. TracIn uses gradient dot-products across saved training checkpoints. Data Shapley estimates value by averaging contributions across many subsets.`,
        `Each method answers a related but not identical question. Exact deletion is the gold standard for a stated target. Influence functions estimate infinitesimal upweighting or downweighting around a trained optimum. TracIn measures gradient alignment through the training path. Data Shapley is a game-theoretic value measure. The right tool depends on whether you need debugging, attribution, data valuation, or triage.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `The biggest cost is computation. Exact leave-one-out retraining scales poorly. Hessian-based methods can be hard to run on large deep networks and can be unstable when the loss surface is non-convex or the model is not near a clean optimum. Gradient-dot-product methods are cheaper but depend on checkpoint selection and can be noisy.`,
        `The second cost is interpretation. Influence is always tied to a target: one test point, one loss, one validation set, or one metric. A point with low influence on one verdict may still matter for coverage. A point with high influence may be a valuable rare example or a harmful mislabel. Influence ranks candidates; it does not replace human review or clean evaluation.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Influence is valuable for label debugging. Rank examples whose removal improves clean validation loss, review the top slice, then relabel or remove confirmed errors. It is also useful for poisoning audits because malicious or inconsistent points often have outsized effects on specific behaviors. In active learning, influence can help identify examples that would change a boundary if labeled correctly.`,
        `It also supports data valuation and attribution. If a model's output appears to depend heavily on a small cluster of training examples, influence can guide audits, dataset licensing discussions, or removal requests. In high-stakes settings, the approximate score should be treated as a lead, and any final claim should be checked with exact retraining on a smaller proxy or controlled subset when possible.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `High influence does not mean high quality. A mislabeled boundary example can be extremely influential because it pulls the model the wrong way. A rare but correct example can also be highly influential because the dataset has little else like it. Removing high-influence data blindly can erase important minority cases.`,
        `Low influence does not mean useless. Deep interior examples may not affect one boundary point but still stabilize the class distribution, help calibration, or matter for a different target. Approximate influence can also fail on large non-convex models, models trained with heavy regularization, nondeterministic pipelines, or data augmentation. Always validate the proposed change on clean held-out data.`,
      ],
    },
    {
      heading: `Practical workflow`,
      paragraphs: [
        `Start by choosing the target. Are you explaining one bad prediction, lowering clean validation loss, finding mislabeled examples, auditing a suspected poison set, or valuing a data source? Then compute an influence ranking suitable for the scale. Use exact leave-one-out for small datasets or small candidate pools. Use approximations for large triage.`,
        `Review the top-ranked examples with humans or stronger checks. Record whether each example is wrong, rare, duplicated, poisoned, or merely hard. Retrain after fixing or removing confirmed problems. Compare against clean validation and slice metrics. The loop is not complete until the model improves on held-out data without damaging important subgroups.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Influence is the data-side member of the explanation family. Study Saliency Maps & Feature Attribution for feature-level explanations, LIME: Explaining Black Boxes Locally for local function behavior, Logistic Regression for the geometry in this visualization, Cross-Validation & Honest Evaluation for the clean validation discipline, Focal Loss & Hard Examples for boundary-focused training, Active Learning Query Strategies, Data Shapley Valuation, Poisoning Attack Threat Model, and Dataset Deduplication Pipeline.`,
        `Primary sources worth reading are Understanding Black-box Predictions via Influence Functions at https://arxiv.org/abs/1703.04730, Estimating Training Data Influence by Tracing Gradient Descent at https://arxiv.org/abs/2002.08484, Data Shapley at https://arxiv.org/abs/1904.02868, and Representer Point Selection for Explaining Deep Neural Networks at https://arxiv.org/abs/1811.09720.`,
      ],
    },
  ],
};
