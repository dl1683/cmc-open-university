// Influence functions: saliency asked which FEATURES drove a verdict;
// this page asks which TRAINING EXAMPLES taught it. On our 10-email
// dataset we can answer exactly — delete each example, retrain, measure.

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
    explanation: `A new email arrives — 3 exclamation marks, 2.5 average caps words — and the trained filter says ${(pFull * 100).toFixed(0)}% spam. Saliency Maps and LIME would now interrogate the input FEATURES. This page asks the other question: which of the ten TRAINING examples are responsible for this verdict? Whose past testimony convicted this email? On a 10-point dataset we can afford the gold-standard answer — no approximations: delete one example, retrain from scratch (the module really does it, 200 epochs each), and measure how the verdict moves. That measured movement is the example's exact LEAVE-ONE-OUT INFLUENCE.`,
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
    explanation: `Ten retrainings, ten verdicts on the same email — the full influence ledger, sorted. Remove the spam example (2,3) and the prediction drops ${(sorted[0].dp * 100).toFixed(1)} points; remove (5,1) and it drops ${(sorted[1].dp * 100).toFixed(1)}. Those two examples are doing the prosecuting. On the defense side, the ham examples (1,2) and (3,1) prop the verdict UP by ~+5.8 points each — remove either and the boundary relaxes toward "spam". And six of the ten examples barely register at ±1 point: most of the training set is dead weight for THIS verdict.`,
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
    explanation: 'Now place the influences back on the map and the geometry speaks: every influential example hugs the BOUNDARY; every example deep in safe territory scores ≈ 0. It makes sense — the boundary is the only thing the verdict depends on, and deep points could move a mile without bending it. You have met this idea wearing other costumes: support vectors in SVMs ARE the influential points; Focal Loss reweights by difficulty, and difficulty lives at the boundary; active learning asks to label exactly these points. A model is its borderline cases — influence just measures that literally.',
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
    explanation: 'Our luxury was n = 10; retraining GPT once per training document is not a plan. INFLUENCE FUNCTIONS (Koh & Liang, 2017) approximate the deletion without performing it — a second-order Taylor argument: how much would the optimum shift if this example\'s loss were down-weighted? — at the price of a Hessian inverse and shakier guarantees on deep non-convex models. TracIn instead dot-products the test gradient with each example\'s training gradients. The applications are bigger than curiosity: DATA VALUATION (what is this document worth to the model? — the question behind training-data markets and copyright suits), debugging ("the model is weird about X — which data taught it?"), and the second view\'s specialty: finding poisoned or mislabeled examples by what their deletion fixes.',
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
    explanation: 'A new labeled email arrives from the annotation pipeline: one exclamation mark, one caps word — the gentlest message imaginable — labeled SPAM. It is almost certainly a labeling mistake (a fat-fingered click, a confused annotator, or worse: deliberate poisoning), sitting deep in ham territory, quietly dragging the boundary toward it every epoch. In a 100k-example dataset, how would you ever FIND it? Answer: ask what the validation set thinks of each example\'s absence.',
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
    explanation: `Run the same deletion experiment, but score each removal by the model's loss on trustworthy validation data. The verdict is unambiguous: deleting the suspicious (1,1)-spam example IMPROVES the loss from ${valBase.toFixed(3)} to ${hunts[0].val.toFixed(3)} — a 42% drop — while deleting any LEGITIMATE example makes things worse or flat (the runner-up barely moves it). An example whose absence makes the model BETTER is an example teaching falsehoods. No human re-review of 100k labels; the arithmetic points its finger.`,
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
    explanation: 'The production workflow this powers — used to clean benchmark datasets (label errors were found in ImageNet and MNIST test sets this way) and to audit poisoned data. A related fingerprint needs no test point at all: SELF-INFLUENCE — how much an example\'s own prediction depends on its own presence. Mislabeled and memorized points score high (nothing else supports them; the model must memorize them individually — the same pathological points Focal Loss accidentally amplifies). The closing symmetry of the explanation trilogy: Saliency asks the input, LIME asks the function, influence asks the data — and a verdict you cannot trace to features, behavior, AND training data is a verdict you do not understand yet.',
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
      heading: `What it is`,
      paragraphs: [
        `Influence functions answer a question the other explanations do not: which training examples taught this verdict? Saliency maps ask which FEATURES drove the prediction; LIME asks how the FUNCTION behaves locally; influence asks which TRAINING DATA is responsible. On the ten-email spam filter in this visualization, the answer is exact: delete one example, retrain, and measure the verdict shift. That shift is the example's LEAVE-ONE-OUT INFLUENCE. It is expensive (retrain ten times for ten examples), but the gold-standard ground truth is worth it on small problems. The principle remains: an example's influence is how much the verdict would shift if that example vanished.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Train once on all ten emails, measure the test verdict. Train nine more times, each dropping a different example, and measure the new verdicts. The difference is the influence. The spam (2,3) and (5,1) hugging the decision boundary cause drops of 13.5% and 11.6% respectively. The ham examples (1,2) and (3,1) near the boundary pull it toward ham, swinging verdicts up by ~5.8% each. But examples deep in ham territory barely register: ±1% or less. The pattern is clear: influence concentrates at the boundary. This makes support vector machines concrete — only the support vectors (boundary points) shape the decision boundary. Focal Loss reweights hard examples the same way: prioritizing the examples most likely to move the boundary. Influence just measures that pull numerically.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Exact leave-one-out requires n retrainings for n examples — impossible at scale. On 10 points it is fine; on ImageNet with 1.4 million examples it is infeasible. Koh and Liang (2017) introduced INFLUENCE FUNCTIONS: approximate deletion using a Hessian-vector product (second-order Taylor). Cost drops from n retrainings to one Hessian solve, though the approximation frays on deep non-convex nets. TracIn (Pruthi et al., 2020) sidesteps the Hessian: dot-product test gradient against each training gradient accumulated over training steps. Noisier, cheaper, and practical at scale. The spectrum: exact LOO (gold, impossible at scale), influence functions (Hessian-based, shaky on deep nets), TracIn (gradient dot-products, cheaper), and data Shapley (game-theoretic, expensive but clean).`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `DATA VALUATION: what is this training example worth? Influence answers it quantitatively for pricing and labeling prioritization. COPYRIGHT ATTRIBUTION: if a generative model echoes copyrighted work, influence identifies which training examples shaped it — evidence for legal disputes. POISONING AUDITS: detect adversarial examples in crowd-sourced training data by their outsized influence. LABEL DEBUGGING: an example labeled spam at (1,1) sits deep in ham territory; removing it improves validation loss from 0.222 to 0.129 — a 42% drop. An example whose removal improves the model teaches falsehoods. ImageNet and MNIST researchers found label errors using this method. The arithmetic does the human review at scale.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `High influence does not mean high quality; a mislabeled boundary example has huge influence but teaches wrong. Conversely, a correct example deep in safe territory has zero influence but is not useless. SELF-INFLUENCE — how much an example's own prediction depends on its own presence — is a separate fingerprint: mislabeled and memorized points score very high (nothing else supports them). Another trap: approximations are not exact on deep networks. When high stakes demand precision (copyright disputes), exact LOO on a held-out proxy set is safer. Finally, influence measures training-time impact, not test-time robustness; a low-influence example could still break the model on adversarial test inputs.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Influence is the third question of the explanation trilogy: Saliency Maps & Feature Attribution ask the features, LIME: Explaining Black Boxes Locally asks the function, and influence asks the data. When you build a classifier, study Logistic Regression to understand decision boundary geometry. Validate with Cross-Validation & Honest Evaluation: if influence identifies a mislabel and you remove it, does validation improve? And to see influence at work in training, study Focal Loss & Hard Examples, which reweights by boundary difficulty — the same principle applied during training instead of postmortem.`,
      ],
    },
  ],
};
