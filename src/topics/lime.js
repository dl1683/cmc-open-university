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
      heading: 'Why This Exists',
      paragraphs: [
        `LIME exists for the common case where a model affects a decision but the model itself is sealed. You may have an API that returns a fraud score, a medical risk score, a content decision, or a loan denial, but no weights, no gradients, and no source code. A user still needs a reason: which parts of this input pushed the decision up or down?`,
        `The full model may be a neural network, random forest, vendor service, ensemble, or proprietary stack. LIME does not try to open it. It asks a narrower question: around this one input, can a simple model imitate the black box well enough to explain this one prediction?`,
        {type: 'callout', text: `LIME explains one decision by fitting a small local surrogate, not by discovering the hidden model inside the black box.`},
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        `The obvious approach is to demand global feature importance. Ask the model owner for one ranking of features, then say income mattered most, debt second, age third, or exclamation marks mattered more than capital letters. That feels useful because it turns a complicated model into a familiar table of weights.`,
        `Global importance can work for a simple linear model whose features act independently. It breaks once features interact. In the demo, spam probability depends on the product of exclamation marks and ALL-CAPS words. One feature's effect depends on the other feature's value. A single global weight cannot describe that curve honestly.`,
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        `The wall is locality. A black-box model can be nonlinear, discontinuous, or built from many feature interactions. Even if a simple explanation is faithful near one email, it may be false for another email. This is not a small caveat. It is the central contract of LIME.`,
        `There is another wall: access. Many explanation methods need internals. Gradient saliency needs differentiability and model access. Tree-path explanations need the tree. Coefficient inspection needs the coefficients. LIME works when none of that is available, but the price is sampling. It must learn the local behavior by repeatedly querying the model.`,
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        `The core insight is that a local imitation can be useful even when a global explanation is impossible. Near a single point, many curved decision surfaces can be approximated by a line or a small sparse model. That simple surrogate is not the black box. It is an explanatory instrument.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree diagram with branches ending in class labels.', caption: `Interpretable surrogates trade global flexibility for local readability; decision trees are one familiar form of human-readable model. Source: Wikimedia Commons, T-kita, public domain.`},
        `LIME makes this trade explicit. It chooses interpretability first, then asks the black box enough nearby questions to make that interpretable model locally faithful. The explanation is the surrogate's coefficients, not the hidden model's true internals. The right reading is: for this input, under this perturbation scheme, this feature moved the local surrogate most.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `A LIME run starts with the input being explained. For tabular data, it perturbs feature values. For text, it may remove or mask words. For images, it often turns superpixels on and off. Each perturbed input is sent to the black box, producing a score.`,
        `The samples are weighted by distance from the original input, so close neighbors matter more than far ones. Then LIME fits an interpretable model, often a sparse linear model, on those weighted samples. Finally it reports the strongest positive and negative coefficients. In the demo, CAPS words matter more than exclamation marks near one email, but the relationship flips at another point.`,
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        `The plot begins with a curved boundary to show why one global line would be dishonest. LIME samples nearby points around the email being explained and fits a local stand-in. The fitted line is useful because it tracks the black box near that email, not because it discovers the black box's real formula.`,
        `The second matrix is the important warning. The same black box gives a different local explanation at a different point. That is not a bug in the demo. It is the thing LIME is trying to teach: an explanation can be faithful locally and wrong globally. A serious report must state the neighborhood, sampling method, and stability.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `The correctness claim is local fidelity, not truth recovery. If the weighted samples are representative of the neighborhood and the surrogate fits those samples well, then the surrogate's coefficients summarize how the black box behaves near the original input. The distance kernel is what turns a general regression problem into a local one.`,
        `This is why feature scaling, distance choice, perturbation design, and fit quality matter. The surrogate is trustworthy only when the local sample cloud resembles plausible inputs and the simple model actually predicts the black-box scores in that cloud. LIME should be evaluated by local error, stability under resampling, and counterfactual checks, not by how tidy the bar chart looks.`,
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        `The main cost is queries. A practical LIME explanation may use hundreds or thousands of perturbed samples for one prediction. If the black box is cheap and local, that is acceptable. If the model call is slow, rate-limited, or billed per request, explanations become expensive quickly.`,
        `Fitting the surrogate is usually small compared with querying the model. For a linear surrogate with k selected features, weighted least squares is cheap at the scale of one explanation, but feature selection, image superpixels, and repeated stability runs add overhead. Memory use is modest: the sample matrix, the black-box scores, the weights, and the final local model.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `LIME wins when the model is accessible only through predictions and the user needs an explanation for a single decision. It is useful for model debugging, audit sampling, support tools, and human review screens where a local reason is better than a silent score.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored input, hidden, and output nodes.', caption: `A neural network can be queried from the outside even when its internals are unavailable; LIME uses those queries to build a local explanation. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.`},
        `It is especially natural for tabular business models, text classifiers, and image classifiers with clear perturbation units. A credit model can show which features pushed a denial. A text classifier can show which words drove a label. An image classifier can show which superpixels mattered. The common thread is not model type. It is query access plus an input representation that humans can understand.`,
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        `LIME fails when perturbations leave the data manifold. Randomly removing words, toggling image regions, or changing tabular fields independently can create inputs that real users would never produce. The black box may behave strangely there, and the surrogate may explain that artificial behavior instead of the real decision boundary.`,
        `It also fails against hostile models. Slack et al. showed that perturbation-based explainers can be fooled by scaffolding: a model can detect synthetic probes and behave innocently during explanation while staying biased on real inputs. LIME is an auditing aid for cooperative or uncertain systems, not a proof that a deployed system is fair.`,
      ],
    },
    {
      heading: 'Practical Checks',
      paragraphs: [
        `A useful LIME report should include the predicted class, local score, top positive and negative features, number of samples, kernel width, feature representation, local fit quality, and stability across repeated seeds. Without those details, the explanation is hard to trust or reproduce.`,
        `Deletion tests are a good sanity check. Remove or mask a feature that LIME says is important, query the black box again, and see whether the score moves in the expected direction. Also test nearby real examples, not only synthetic ones. If the explanation changes wildly across tiny plausible edits, report uncertainty instead of a confident feature ranking.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Study Logistic Regression to understand why a linear surrogate is interpretable. Study Kernel Regression for the role of distance weighting. Study SHAP for a related model-agnostic method with Shapley-value credit rules and higher cost. Study Saliency Maps when model internals and gradients are available.`,
        `Then read Adversarial Examples, Data Leakage, Calibration Curves, and Cross-Validation to separate explanation from reliability. For modern interpretability, Sparse Autoencoder Feature Dictionary Case Study goes inside model activations instead of probing only visible inputs. Primary references: Ribeiro, Singh, and Guestrin's LIME paper at https://arxiv.org/abs/1602.04938, and Slack et al.'s attack paper at https://arxiv.org/abs/1911.02508.`,
      ],
    },
  ],
};
