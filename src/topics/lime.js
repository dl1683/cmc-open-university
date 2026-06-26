// LIME: when the model is a sealed black box, query nearby inputs, fit a
// small local surrogate, and read that surrogate carefully.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lime',
  title: 'LIME: Explaining Black Boxes Locally',
  category: 'AI & ML',
  summary: 'No weights, no gradients, just an API? Sample around the input, fit a local line, read the line.',
  controls: [
    { id: 'view', label: 'Open', type: 'select', options: ['explaining one verdict locally', 'the fine print'], defaultValue: 'explaining one verdict locally' },
  ],
  run,
};

// The sealed black box: an interaction-only spam model, p = σ(0.5·x·y − 4).
// Globally curved (the boundary is the hyperbola x·y = 8) — no single
// linear story exists. LIME never sees this formula; it only calls it.
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const blackBox = (excl, caps) => sigmoid(0.5 * excl * caps - 4);

const neighborsOf = (cx, cy) => {
  const pts = [];
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) pts.push([cx + dx, cy + dy]);
  return pts;
};

// Weighted least squares: fit p ≈ b0 + b1·x + b2·y near (cx, cy).
function fitLocal(cx, cy) {
  const pts = neighborsOf(cx, cy);
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const v = [0, 0, 0];
  for (const [x, y] of pts) {
    const w = Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / 2));
    const t = blackBox(x, y);
    const row = [1, x, y];
    for (let a = 0; a < 3; a++) {
      v[a] += w * row[a] * t;
      for (let b = 0; b < 3; b++) M[a][b] += w * row[a] * row[b];
    }
  }
  for (let c = 0; c < 3; c++) {
    const pivot = M[c][c];
    for (let b = c; b < 3; b++) M[c][b] /= pivot;
    v[c] /= pivot;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const k = M[r][c];
      for (let b = c; b < 3; b++) M[r][b] -= k * M[c][b];
      v[r] -= k * v[c];
    }
  }
  return { intercept: v[0], wExcl: v[1], wCaps: v[2] };
}

const AXES = { x: { label: 'exclamation marks', min: 0, max: 9 }, y: { label: 'ALL-CAPS words', min: 0, max: 9 } };
const HYPERBOLA = {
  id: 'boundary',
  label: 'p = 0.5 (x·y = 8)',
  points: Array.from({ length: 25 }, (_, i) => 1 + i * 0.33).map((x) => ({ x, y: 8 / x })).filter((p) => p.y <= 9),
};

function* explainLocally() {
  yield {
    state: plotState({
      axes: AXES,
      series: [HYPERBOLA],
      markers: [{ id: 'q', x: 4, y: 3, label: `p(spam) = ${blackBox(4, 3).toFixed(2)}` }],
    }),
    highlight: { active: ['q'], visited: ['boundary'] },
    explanation: 'The plot starts with a sealed model: you can query scores but cannot read weights or gradients. The curved boundary shows why a global linear explanation would lie; LIME only tries to explain the neighborhood around this email.',
  };

  const pts = neighborsOf(4, 3);
  yield {
    state: plotState({
      axes: AXES,
      series: [HYPERBOLA],
      markers: pts.map(([x, y], i) => ({ id: `s${i}`, x, y, label: blackBox(x, y).toFixed(2) })),
    }),
    highlight: { active: ['s4'], compare: pts.map((_, i) => `s${i}`).filter((_, i) => i !== 4) },
    explanation: 'LIME samples nearby inputs and queries the black box on each one. The weights make close samples matter more than far samples because the surrogate is buying local fidelity, not a global theory.',
    invariant: 'LIME needs only query access: f(x) in, score out — no internals, any model.',
  };

  const local = fitLocal(4, 3);
  yield {
    state: plotState({
      axes: AXES,
      series: [
        HYPERBOLA,
        {
          id: 'tangent',
          label: 'the local stand-in',
          points: [2.2, 5.8].map((x) => ({ x, y: 3 + (-(local.wExcl / local.wCaps)) * (x - 4) })),
        },
      ],
      markers: [{ id: 'q', x: 4, y: 3, label: '0.88' }],
    }),
    highlight: { found: ['tangent'], active: ['q'] },
    explanation: `Weighted least squares fits a local surrogate: p ≈ ${local.intercept.toFixed(2)} + ${local.wExcl.toFixed(2)}·excl + ${local.wCaps.toFixed(2)}·caps. The line is not the real boundary; it is the best simple imitation near (4, 3).`,
  };

  yield {
    state: matrixState({
      title: "The explanation: read the surrogate's weights",
      rows: [{ id: 'excl', label: 'exclamation marks' }, { id: 'caps', label: 'ALL-CAPS words' }],
      columns: [{ id: 'w', label: 'local weight' }, { id: 'verdict', label: 'reading' }],
      values: [[local.wExcl, 1], [local.wCaps, 2]],
      format: (v) => (v === 1 ? 'pushes spam-ward' : v === 2 ? 'pushes harder (~1.4×)' : v.toFixed(3)),
    }),
    highlight: { compare: ['excl:w', 'caps:w'] },
    explanation: 'The report reads the surrogate weights, not the black box internals. For this email, CAPS words pull about 1.4x harder than exclamation marks; that claim is useful only as long as the local surrogate fits.',
  };

  const far = fitLocal(1, 8);
  yield {
    state: matrixState({
      title: 'Same model, different email — the story flips',
      rows: [{ id: 'here', label: 'email at (4, 3)' }, { id: 'there', label: 'email at (1, 8)' }],
      columns: [{ id: 'excl', label: 'weight: excl' }, { id: 'caps', label: 'weight: caps' }],
      values: [[local.wExcl, local.wCaps], [far.wExcl, far.wCaps]],
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['here:caps', 'there:excl'] },
    explanation: `Running LIME at a second point exposes the locality invariant. Around (4, 3), CAPS dominates; around (1, 8), exclamation marks pull ${(far.wExcl / far.wCaps).toFixed(0)}x harder. Both explanations can be faithful locally and wrong globally.`,
    invariant: 'Local fidelity, not global truth: each LIME explanation holds only near the input it explains.',
  };
}

function* finePrint() {
  yield {
    state: matrixState({
      title: 'Fine print 1 — instability: re-sample, re-explain',
      rows: [{ id: 'run1', label: 'sampling run A' }, { id: 'run2', label: 'sampling run B' }],
      columns: [{ id: 'excl', label: 'weight: excl' }, { id: 'caps', label: 'weight: caps' }],
      values: [[0.16, 0.23], [0.21, 0.18]],
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['run1:caps', 'run2:caps'] },
    explanation: 'The instability table shows sampling noise. Different perturbed neighborhoods can fit different weights, so a serious LIME report should use more samples, fixed seeds, repeated runs, or uncertainty bands.',
  };

  yield {
    state: matrixState({
      title: 'Fine print 2 — the scaffolding attack (Slack et al. 2020)',
      rows: [{ id: 'on', label: 'on real data' }, { id: 'off', label: "on LIME's perturbed samples" }],
      columns: [{ id: 'behavior', label: 'model behaves…' }],
      values: [[1], [2]],
      format: (v) => ['', 'BIASED (uses a protected feature)', 'innocent (hides the feature)'][v],
    }),
    highlight: { removed: ['on:behavior'], found: ['off:behavior'] },
    explanation: 'The scaffolding attack is a failure mode of synthetic probes. If perturbed samples look unnatural, a hostile model can behave fairly during examination and stay biased on real inputs.',
    invariant: 'Off-manifold probes are distinguishable — a hostile model can answer them differently.',
  };

  yield {
    state: matrixState({
      title: 'The explanation toolbox, final form',
      rows: [
        { id: 'grad', label: 'gradient saliency' },
        { id: 'lime', label: 'LIME' },
        { id: 'shap', label: 'SHAP' },
      ],
      columns: [{ id: 'needs', label: 'needs' }, { id: 'cost', label: 'cost' }, { id: 'catch', label: 'catch' }],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      format: (v) => ['', 'model internals', '1 backward pass', 'local, gradient noise', 'API access only', '~1000s of queries', 'sampling instability', 'API access only', 'exponential → sampled', 'axioms, but slow + same attack'][v],
    }),
    highlight: { active: ['lime:needs'], compare: ['shap:catch'] },
    explanation: 'The toolbox compares access and cost. Gradients are cheap when you own the model, LIME works with query access, and SHAP buys stronger credit rules at higher cost. Every explanation still needs behavioral verification.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'explaining one verdict locally') yield* explainLocally();
  else if (view === 'the fine print') yield* finePrint();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The black box is the original model, which means a predictor whose internal reasoning is not directly readable. The perturbed samples are nearby inputs made by changing features around one case. The simple model is the local surrogate trained only to explain that one neighborhood.',
        'Read the highlighted weights as local evidence, not global truth. If the explanation says a word, pixel, or feature pushed this prediction up, it means the surrogate saw that feature matter near the selected input. It does not prove the same feature matters everywhere.',
        {type: 'image', src: './assets/gifs/lime.gif', alt: 'Animated walkthrough of the lime visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Complex models can be accurate while giving users no direct reason for one prediction. A doctor, analyst, or engineer may need to know which input features changed one decision before trusting or debugging it. LIME exists to answer that local question without requiring access to the model internals.',
        'LIME means Local Interpretable Model-agnostic Explanations. Local means one neighborhood around one input. Interpretable means the explanation model is simple enough to inspect, such as a sparse linear model. Model-agnostic means the method only needs to query the black box.',
        {type: 'callout', text: `LIME explains one decision by fitting a small local surrogate, not by discovering the hidden model inside the black box.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to inspect the original model. For a linear classifier, read the weights. For a small decision tree, follow the branches. That works when the model itself is simple and exposed.',
        'Another approach is to compute global feature importance. That can say which features matter across the dataset. It does not explain why this one loan application, image, or document received this one prediction.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that modern predictors can be nonlinear, proprietary, or too large to inspect. A global average can hide opposite local behavior: a feature may increase risk for one subgroup and decrease it for another. The user needs a local explanation tied to the specific input.',
        'A local explanation also needs a readable vocabulary. Saying that layer 17 activation 433 changed is not useful to most decision makers. LIME tries to express the explanation in original features or human-readable components.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Near one input, a complicated decision surface can often be approximated by a simpler model. LIME samples nearby variants, asks the black box for predictions, weights samples by closeness to the original input, and fits an interpretable surrogate. The surrogate is then used as the explanation.',
        'The method does not claim to recover the black box. It claims that the surrogate is useful inside a small neighborhood. The size and sampling quality of that neighborhood control how much the explanation should be trusted.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree diagram with branches ending in class labels.', caption: `Interpretable surrogates trade global flexibility for local readability; decision trees are one familiar form of human-readable model. Source: Wikimedia Commons, T-kita, public domain.`},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose the input to explain, such as one text review. Create perturbed versions by removing or changing features, such as dropping words. Query the black-box model on each perturbation to get predicted scores.',
        'Give each perturbation a weight based on distance from the original input. Close samples matter more because the explanation is local. Fit a sparse linear model or small tree to predict the black-box scores from the interpretable features.',
        'Return the surrogate coefficients as the explanation. In text, positive word weights support the predicted class and negative weights oppose it. In images, superpixels play the role of interpretable features.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored input, hidden, and output nodes.', caption: `A neural network can be queried from the outside even when its internals are unavailable; LIME uses those queries to build a local explanation. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.`},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conditional. If the sampled neighborhood is representative and the black-box decision boundary is smooth enough there, then a simple weighted surrogate can approximate the black-box behavior near the input. The fitted weights explain the surrogate, and the surrogate approximates the black box locally.',
        'LIME is therefore only as reliable as its local fidelity score. Fidelity means how closely the surrogate predictions match black-box predictions on weighted nearby samples. Low fidelity means the explanation is readable but not faithful.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is black-box queries. If LIME creates s perturbations and the model prediction costs M, the query cost is O(sM). Fitting a sparse linear surrogate adds cost based on s and the number of interpretable features d, often much smaller than the model-query cost.',
        'When s doubles, the explanation usually becomes more stable but costs about twice as many model calls. Memory is O(sd) if perturbations are stored densely, though sparse text and image representations can reduce it. The expensive behavior is repeated prediction, especially for large neural models.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LIME is useful for debugging classifiers when the engineer can query the model but not easily inspect it. It can show that a text classifier relies on a spurious token, or that an image classifier reacts to the background rather than the object. The access pattern is one prediction at a time, with enough budget for many nearby probes.',
        'It is also useful in model governance as a local audit artifact. A reviewer can compare explanations for accepted and rejected cases, look for unstable reasons, and decide whether a decision needs deeper investigation. The explanation supports review; it does not replace validation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'LIME fails when the neighborhood is unnatural. Removing words can create text no real user would write, and masking image patches can create artifacts the model reacts to. The surrogate may explain behavior on synthetic samples rather than behavior on realistic inputs.',
        'It also fails when small changes cause sharp prediction jumps. In that case a linear local model can be unstable, and different random seeds can produce different explanations. Always check fidelity, repeat runs, and compare with other explanation methods such as SHAP or counterfactual tests.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a sentiment model gives one review a positive score of 0.92. LIME perturbs five words and makes 1000 nearby reviews by hiding subsets of words. The black box scores each variant, and samples closer to the original get larger weights.',
        'A fitted surrogate might assign +0.31 to excellent, +0.18 to fast, -0.22 to broken, and +0.05 to packaging. If removing excellent drops the black-box score from 0.92 to 0.61 in many nearby samples, that positive weight is earned by local behavior. If the surrogate reaches R^2 = 0.84 on weighted samples, the explanation is plausible but still local.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ribeiro, Singh, and Guestrin, Why Should I Trust You?, KDD 2016. Study the original LIME paper for the sampling, locality kernel, sparse surrogate fitting, and evaluation protocol.',
        'Study next by contrast. SHAP gives game-theoretic feature attributions with different cost assumptions. Counterfactual explanations ask what smallest change would alter the decision. Partial dependence and accumulated local effects explain global feature behavior rather than one prediction.',
      ],
    },
  ],
};
