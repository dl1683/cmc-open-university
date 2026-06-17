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
      title: 'Method 1 — gradient saliency: ∂p/∂feature',
      rows: [{ id: 'excl', label: 'exclamation marks' }, { id: 'caps', label: 'ALL-CAPS words' }],
      columns: [{ id: 'grad', label: 'gradient' }, { id: 'gxi', label: 'gradient × input' }],
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
    explanation: `Occlusion verifies the claim by deletion. Remove exclamation marks and the score falls to ${(predict(0, X.caps) * 100).toFixed(1)}%; remove CAPS and it falls to ${(predict(X.excl, 0) * 100).toFixed(1)}%. The larger drop is stronger evidence than a bright heatmap because it changes the model's behavior.`,
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
      format: (v) => ['', 'crisp map', 'map turns to noise ✓', 'PASSES', 'map looks the same ✗', 'FAILS — edge detector'][v],
    }),
    highlight: { found: ['grad:verdict', 'ig:verdict'], removed: ['guided:verdict'] },
    explanation: 'The sanity check randomizes the model weights and redraws the map. A faithful attribution should collapse when the learned model is gone; a pretty map that survives is explaining the input texture, not the model.',
    invariant: 'If the explanation does not depend on the learned weights, it cannot be explaining the model.',
  };

  yield {
    state: matrixState({
      title: 'The attribution toolbox, with price tags',
      rows: [
        { id: 'gxi', label: 'gradient × input' },
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
    {
      heading: `Why This Exists`,
      paragraphs: [
        `A model verdict is often not enough. A spam filter marks one email as spam. A radiology classifier flags one scan. A moderation model blocks one post. The user, reviewer, or engineer then asks a narrower question: which parts of this input pushed this specific prediction? Saliency maps exist to answer that local attribution question. They do not prove that the model is good in general. They try to explain why one verdict happened.`,
        `The demo uses the same two-feature spam setup as Logistic Regression and FGSM. The email has four exclamation marks, three ALL-CAPS words, and a high spam probability. In a real image model, the feature table becomes a heatmap over pixels, patches, or regions. The shape changes, but the burden stays the same: the explanation must be tied to the model, the input, and the output being explained.`,
      ],
    },
    {
      heading: `The Obvious Approach`,
      paragraphs: [
        `The obvious explanation is to inspect model weights or attention weights. If the spam model has a larger weight on ALL-CAPS words, maybe CAPS explains the verdict. If an attention head gives a word a bright score, maybe the model read that word. If an image heatmap outlines the object, maybe the model used the object. These explanations are attractive because they are visible and easy to narrate.`,
        `The wall is that visible does not mean causal. A global weight does not say how much a feature mattered in this input. An attention weight can be a routing signal rather than a faithful explanation. A heatmap can look clean because it detects edges, not because it reflects the learned decision rule. Saliency work begins when the explanation must survive behavioral tests, not when it looks plausible to a human.`,
      ],
    },
    {
      heading: `The Core Insight`,
      paragraphs: [
        `The core insight is local responsibility. A feature is important for this verdict if changing that feature would change the verdict, or if the model is locally sensitive to that feature at this input. Gradient saliency uses derivatives to ask how the score changes for an infinitesimal feature change. Occlusion asks a simpler behavioral question: remove or mask a feature and run the model again.`,
        `Both methods are approximations. Gradients are cheap and local, so they can miss effects when activations saturate or when the model responds only to combinations of features. Occlusion is more behavioral, but masking a feature can create an input the model never saw during training. The safest interpretation is not "the map is true." It is "this method suggests these features mattered, and the claim should be checked by perturbing them."`,
      ],
    },
    {
      heading: `How It Works`,
      paragraphs: [
        `The first table fixes the case. Attribution is not explaining the average spam email or the whole classifier. It is explaining one email with a specific feature vector. The gradient table differentiates the spam probability with respect to each feature. In the demo, CAPS has the larger per-unit sensitivity. Gradient times input then asks a more verdict-specific question: a feature with a large slope but value zero did not contribute much to this particular score.`,
        `The occlusion table deletes features and measures the score drop. Remove the exclamation marks and the spam score falls. Remove the CAPS words and it falls further, so CAPS has stronger behavioral evidence in this example. This is closer to the question a reviewer actually cares about: if we change the highlighted evidence, does the decision change? On images, occlusion may hide patches, blur regions, replace tokens, or mask superpixels instead of setting a numeric feature to zero.`,
        `The heatmap scales the same idea to many features. A bright pixel or patch means high local sensitivity, high gradient-times-input score, strong occlusion effect, or another attribution score depending on the method. The map is not one algorithm. It is a visual surface over feature scores. The algorithm is the scoring rule behind the map and the sanity tests used to check it.`,
      ],
    },
    {
      heading: `What the Visual Proves`,
      paragraphs: [
        `The visual deliberately shows more than one attribution method. If the gradient table and the occlusion table agree, the explanation is stronger because two different tests point at the same feature. If they disagree, the disagreement is useful evidence. It may mean the model is saturated, the mask is unrealistic, features interact, or the local derivative is not enough to describe the finite change that matters.`,
        `The honesty-test view proves the main warning. Attention weights are not automatically explanations. Random-weight sanity checks ask whether the map depends on the trained model at all. If a saliency method draws nearly the same map after the model weights are randomized, the map is explaining input texture or preprocessing artifacts, not the learned decision rule. A decorative overlay that survives a broken model should not pass review.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `The correctness idea is behavioral, not aesthetic. A faithful attribution should change when the model changes, and important highlighted features should matter when perturbed. Gradients work because the derivative is the local linear approximation of the model around the input. For a small feature change, the derivative predicts the direction and rate of output change. Gradient times input adds the actual feature magnitude so the score is less detached from the instance being explained.`,
        `Occlusion works by intervention. It asks the model to make a second prediction with part of the evidence removed. If the output collapses, the removed evidence was causally involved in that tested condition. This is not a perfect proof because the replacement value matters and features can interact, but it is a clear invariant for attribution review: explanations should be tied to changes in model behavior.`,
      ],
    },
    {
      heading: `Cost and Behavior`,
      paragraphs: [
        `Plain gradient saliency is cheap: one backward pass through the model. Gradient times input adds a multiplication per feature. Integrated gradients costs many backward passes because it averages gradients along a path from a baseline to the input; the baseline choice becomes part of the explanation. Grad-CAM uses gradients at a convolutional feature layer to produce coarser class-activation maps. Occlusion costs one or more forward passes per feature group. SHAP-like methods can be far more expensive because they estimate contributions across feature coalitions.`,
        `The cost should match the risk. A quick gradient map is useful during debugging. A model audit needs deletion tests, randomization checks, comparisons across methods, and examples where the explanation is expected to fail. High-dimensional inputs also need grouping. Pixel-level occlusion on a large image can be too slow and too noisy; superpixels or patches make the test tractable, but the grouping choice can change the story.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Saliency is useful for finding shortcut learning and data leakage. A medical classifier may focus on scanner tags instead of anatomy. A content classifier may focus on a watermark, template phrase, or background style. A spam model may rely on formatting quirks that disappear in a new mail client. The map does not solve the model, but it points the investigator toward the feature to delete, mask, rebalance, or monitor.`,
        `It is also useful as a bridge between debugging tools. LIME explains a prediction with a local surrogate rule. Influence functions ask which training examples helped produce a verdict. Sparse Autoencoder Feature Dictionary work asks whether internal features in a model mediate behavior. Saliency asks which input features mattered. These are different cuts through responsibility, and agreement across them is much stronger than one clean figure.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `Saliency fails when the explanation is plausible but not faithful. Edge detectors, smoothing artifacts, saturated gradients, correlated features, and unrealistic masks can all produce maps that look meaningful. A model may use a combination of features where removing any one feature does little. A text model may shift responsibility across equivalent tokens. A vision model may depend on background context that humans ignore.`,
        `It is also the wrong tool for claims about global model behavior. A saliency map explains one verdict under one method. It does not prove fairness, calibration, safety, or general reliability. It should not be used as a compliance artifact by itself. The right language is careful: this attribution method suggests the model was sensitive to these features, and these perturbation tests did or did not support that claim.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Primary sources: Simonyan, Vedaldi, and Zisserman on deep network saliency at https://arxiv.org/abs/1312.6034, Integrated Gradients at https://arxiv.org/abs/1703.01365, Grad-CAM at https://arxiv.org/abs/1610.02391, Sanity Checks for Saliency Maps at https://arxiv.org/abs/1810.03292, and Attention is not Explanation at https://arxiv.org/abs/1902.10186.`,
        `Study Backpropagation for the derivative machinery, FGSM for the link between gradients and adversarial changes, Softmax and Temperature for score interpretation, Multi-Head Attention for routing versus explanation, LIME for local surrogate explanations, Influence Functions for training-data responsibility, and Sparse Autoencoder Feature Dictionary Case Study for testing internal features by ablation or steering.`,
      ],
    },
  ],
};
