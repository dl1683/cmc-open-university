// Saliency maps: asking a model "why?" and checking whether the answer
// is honest. The gradient that attacks a model (FGSM) can also explain it;
// the hard part is that explanations can lie too.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'saliency-maps',
  title: 'Saliency Maps & Feature Attribution',
  category: 'AI & ML',
  summary: 'Ask the model WHY — gradients and occlusion point at the responsible features, and sanity checks catch lying explanations.',
  controls: [
    { id: 'view', label: 'Run', type: 'select', options: ['interrogating one verdict', 'the honesty tests'], defaultValue: 'interrogating one verdict' },
  ],
  run,
};

// The spam model from Logistic Regression / FGSM, and one flagged email.
const W = { w1: 1.1, w2: 1.6, b: -5.6 };
const X = { excl: 4, caps: 3 };
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const predict = (excl, caps) => sigmoid(W.w1 * excl + W.w2 * caps + W.b);
const P = predict(X.excl, X.caps);

function* interrogate() {
  yield {
    state: matrixState({
      title: `The verdict to explain: p(spam) = ${(P * 100).toFixed(1)}%`,
      rows: [{ id: 'excl', label: 'exclamation marks' }, { id: 'caps', label: 'ALL-CAPS words' }],
      columns: [{ id: 'val', label: 'value in this email' }],
      values: [[X.excl], [X.caps]],
      format: String,
    }),
    highlight: { active: ['excl:val', 'caps:val'] },
    explanation: 'The table fixes the question: this is one verdict, not the whole model. Attribution asks how much each input feature contributed to this spam score, so the explanation must stay tied to this email.',
  };

  const slope = P * (1 - P);
  const grads = { excl: W.w1 * slope, caps: W.w2 * slope };
  yield {
    state: matrixState({
      title: 'Method 1 — gradient saliency: âˆ‚p/âˆ‚feature',
      rows: [{ id: 'excl', label: 'exclamation marks' }, { id: 'caps', label: 'ALL-CAPS words' }],
      columns: [{ id: 'grad', label: 'gradient' }, { id: 'gxi', label: 'gradient Ã— input' }],
      values: [[grads.excl, grads.excl * X.excl], [grads.caps, grads.caps * X.caps]],
      format: (v) => v.toFixed(3),
    }),
    highlight: { compare: ['excl:gxi', 'caps:gxi'] },
    explanation: 'Gradient saliency differentiates the spam score with respect to each input feature. CAPS has the larger per-unit slope, while gradient times input asks a second question: how much did the actual feature value in this email matter?',
    invariant: 'Gradient saliency is local: it describes THIS verdict at THIS input, not the model in general.',
  };

  const dropExcl = P - predict(0, X.caps);
  const dropCaps = P - predict(X.excl, 0);
  yield {
    state: matrixState({
      title: 'Method 2 — occlusion: delete a feature, watch the verdict',
      rows: [{ id: 'excl', label: 'remove the !!!!' }, { id: 'caps', label: 'remove the CAPS' }],
      columns: [{ id: 'newp', label: 'p(spam) becomes' }, { id: 'drop', label: 'verdict drop' }],
      values: [[predict(0, X.caps), dropExcl], [predict(X.excl, 0), dropCaps]],
      format: (v) => `${(v * 100).toFixed(1)}%`,
    }),
    highlight: { found: ['caps:drop'], compare: ['excl:drop'] },
    explanation: `Occlusion verifies the claim by deletion. Remove exclamation marks and the score falls to ${(predict(0, X.caps) * 100).toFixed(1)}%; remove CAPS and it falls to ${(predict(X.excl, 0) * 100).toFixed(1)}%. The larger drop is stronger evidence than a bright heatmap because it changes the model behavior.`,
  };

  const HEAT = [
    [0.02, 0.05, 0.04, 0.03, 0.02, 0.01],
    [0.03, 0.18, 0.62, 0.55, 0.08, 0.02],
    [0.04, 0.71, 0.95, 0.88, 0.34, 0.03],
    [0.02, 0.12, 0.41, 0.36, 0.06, 0.02],
  ];
  yield {
    state: matrixState({
      title: 'The same idea at a million pixels: a saliency heatmap',
      rows: HEAT.map((_, r) => ({ id: `r${r}`, label: '' })),
      columns: HEAT[0].map((_, c) => ({ id: `p${c}`, label: '' })),
      values: HEAT,
      format: () => '',
    }),
    highlight: { found: ['r2:p2', 'r2:p3', 'r1:p2'] },
    explanation: 'The heatmap is the same attribution idea at pixel scale. Bright cells mean the model is locally sensitive there; the safety question is whether those cells mark the object or a shortcut such as a watermark, tag, or background cue.',
  };
}

function* honesty() {
  yield {
    state: matrixState({
      title: 'Caveat 1 — attention weights are not explanations',
      rows: [{ id: 'looks', label: 'what attention looks like' }, { id: 'is', label: 'what tests showed' }],
      columns: [{ id: 'claim', label: '' }],
      values: [[1], [2]],
      format: (v) => ['', '"the model READ these words"', 'different attention, same output'][v],
    }),
    highlight: { removed: ['is:claim'] },
    explanation: 'Attention weights look like explanations, but they are only routing signals. If different attention patterns can produce the same prediction, the heatmap is not proof of causal responsibility.',
  };

  yield {
    state: matrixState({
      title: 'Caveat 2 — the sanity check: lobotomize the model, re-draw the map',
      rows: [
        { id: 'grad', label: 'plain gradient' },
        { id: 'ig', label: 'integrated gradients' },
        { id: 'guided', label: 'guided backprop' },
      ],
      columns: [{ id: 'before', label: 'trained model' }, { id: 'after', label: 'RANDOM weights' }, { id: 'verdict', label: 'verdict' }],
      values: [[1, 2, 3], [1, 2, 3], [1, 4, 5]],
      format: (v) => ['', 'crisp map', 'map turns to noise âœ“', 'PASSES', 'map looks the same âœ—', 'FAILS — edge detector'][v],
    }),
    highlight: { found: ['grad:verdict', 'ig:verdict'], removed: ['guided:verdict'] },
    explanation: 'The sanity check randomizes the model weights and redraws the map. A faithful attribution should collapse when the learned model is gone; a pretty map that survives is explaining the input texture, not the model.',
    invariant: 'If the explanation does not depend on the learned weights, it cannot be explaining the model.',
  };

  yield {
    state: matrixState({
      title: 'The attribution toolbox, with price tags',
      rows: [
        { id: 'gxi', label: 'gradient Ã— input' },
        { id: 'ig', label: 'integrated gradients' },
        { id: 'occ', label: 'occlusion / SHAP' },
        { id: 'cam', label: 'Grad-CAM' },
      ],
      columns: [{ id: 'cost', label: 'cost' }, { id: 'catch', label: 'the catch' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', '1 backward pass', 'noisy, saturates', '~50 passes', 'baseline choice matters', '1 pass per feature', 'features interact', '1 pass + layer hook', 'CNNs only, coarse'][v],
    }),
    highlight: { active: ['ig:cost'], compare: ['occ:catch'] },
    explanation: 'The toolbox trades cost for fidelity. Treat every map as a hypothesis: if highlighted features are deleted and the prediction barely moves, the explanation was plausible but not faithful.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'interrogating one verdict') yield* interrogate();
  else if (view === 'the honesty tests') yield* honesty();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The animation explains local attribution, which means explaining one model verdict on one input. Active cells show the feature or method under test, found cells show evidence that changes the verdict, and removed cells show methods that failed a sanity check.',
      {type: 'callout', text: 'A saliency map is only useful when deleting or perturbing the highlighted evidence changes the model verdict.'},
      {type: 'image', src: './assets/gifs/saliency-maps.gif', alt: 'Animated walkthrough of the saliency maps visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: [
      'A classifier can output spam, tumor, fraud, or blocked, but that label does not say what evidence drove the decision. Saliency maps exist to assign responsibility to input features for this specific prediction.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Attribution traces one output decision back through the learned network to the input features that moved it. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
    ]},
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to inspect visible internals such as weights, attention scores, or a heatmap. This can help in a linear model, but a bright map is only a picture until behavior confirms it.',
    ]},
    { heading: 'The wall', paragraphs: [
      'The wall is faithfulness. A map can look sharp while explaining input texture rather than the learned model, and gradients can saturate to near zero even when a feature mattered earlier in the computation.',
    ]},
    { heading: 'The core insight', paragraphs: [
      'A saliency map is a hypothesis about causal evidence. It becomes credible only when it changes with the trained model and predicts what happens when the highlighted feature is perturbed.',
    ]},
    { heading: 'How it works', paragraphs: [
      'Vanilla saliency computes the derivative of a class score with respect to each input feature. Occlusion masks a feature, reruns the model, and measures the score drop, trading extra forward passes for direct behavioral evidence.',
      {type: 'image', src: 'https://docs.pytorch.org/tutorials/_images/fgsm_panda_image.png', alt: 'FGSM panda example showing original image perturbation and changed prediction', caption: 'The same input gradient that powers simple saliency also powers FGSM attacks; explanation and attack share the derivative. Source: PyTorch documentation, https://docs.pytorch.org/tutorials/beginner/fgsm_tutorial.html.'},
    ]},
    { heading: 'Why it works', paragraphs: [
      'Gradient saliency works when the local linear approximation is meaningful: a small output change is roughly the gradient dot the input change. Occlusion works as an intervention because it compares the original input with a modified input and measures model behavior directly.',
    ]},
    { heading: 'Cost and complexity', paragraphs: [
      'A vanilla gradient map costs one backward pass. SmoothGrad may cost 50 backward passes, Integrated Gradients may cost 50 to 300, and simple occlusion costs one forward pass per feature group.',
    ]},
    { heading: 'Real-world uses', paragraphs: [
      'Saliency maps are useful for model debugging, shortcut detection, and comparing explanation tools. They can reveal that a model used watermarks, scanner marks, background, borders, or formatting rather than the intended evidence.',
    ]},
    { heading: 'Where it fails', paragraphs: [
      'A saliency map explains one prediction under one method. It does not prove fairness, calibration, robustness, or compliance, and it can miss feature interactions where two inputs matter only together.',
    ]},
    { heading: 'Worked example', paragraphs: [
      'Use score = sigmoid(1.1 * exclamation_count + 1.6 * caps_count - 5.6). For 4 exclamation marks and 3 ALL-CAPS words, the logit is 3.6 and p(spam) is about 97.3 percent.',
      'Remove CAPS and the logit becomes -1.2, so p(spam) falls to about 23.1 percent. Remove exclamation marks and p(spam) falls to about 31.0 percent, so occlusion says CAPS had the larger behavioral effect on this verdict.',
    ]},
    { heading: 'Sources and study next', paragraphs: [
      'Study Simonyan et al. on saliency, Sundararajan et al. on Integrated Gradients, Selvaraju et al. on Grad-CAM, Adebayo et al. on sanity checks, and Jain and Wallace on attention. Then study backpropagation, FGSM, LIME, SHAP, and distribution shift.',
    ]},
  ],
};