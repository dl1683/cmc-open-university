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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Interrogating one verdict" fixes one email with known features and runs three attribution methods on it: gradient saliency, occlusion, and a pixel-level heatmap. "The honesty tests" runs sanity checks that catch lying explanations. Active cells mark the feature or method under examination. Found cells mark results that passed a behavioral test. Removed cells mark explanations that failed.',
        {type: 'callout', text: 'A saliency map is only useful when deleting or perturbing the highlighted evidence changes the model verdict.'},
        'Watch the gradient table first. Each row is one input feature; the gradient column shows per-unit sensitivity, and gradient times input shows how much that feature contributed to this specific score. The occlusion table then deletes features one at a time and measures how far the verdict drops. If the two methods agree on which feature matters most, the attribution is more trustworthy.',
        'The heatmap frame scales the same logic to a grid of pixels. Bright cells are high-sensitivity regions. The question to ask at every frame: if I deleted the highlighted feature, would the prediction actually change?',
      
        {type: 'image', src: './assets/gifs/saliency-maps.gif', alt: 'Animated walkthrough of the saliency maps visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A classifier says "spam" or "tumor" or "block this post." The next question is always narrower: which parts of this input caused this specific verdict? Saliency maps answer that local attribution question. They do not certify the model in general. They try to explain one prediction on one input.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Attribution traces one output decision back through the learned network to the input features that moved it. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.'},
        {
          type: 'quote',
          text: 'If the model needs to provide a visual explanation for any arbitrary decision, it needs to find what in the image is evidence for or against a class, and present that evidence to the user.',
          attribution: 'Selvaraju et al., Grad-CAM (2017)',
        },
        'The demo uses a two-feature spam model: exclamation marks and ALL-CAPS words. In a real image classifier the feature table becomes a heatmap over millions of pixels, but the burden is identical. The explanation must be tied to the learned model, the specific input, and the specific output being explained. A pretty overlay that ignores any of those three is decoration, not attribution.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural move is to inspect what the model already exposes. Look at the weight vector: ALL-CAPS has weight 1.6, exclamation marks have weight 1.1, so CAPS must matter more. Look at an attention head: token X got a bright score, so the model must have "read" token X. Look at the heatmap: it outlines the dog, so the model must have used the dog. These explanations feel right because they are visible and easy to narrate.',
        'Attention weights are particularly seductive. They produce clean heatmaps over tokens or patches, and the temptation is to treat them as faithful attributions. But Jain and Wallace (2019) showed that alternative attention distributions can produce the same predictions, and Wiegreffe and Pinter (2019) showed that adversarial attention patterns can be trained to match original outputs. The heatmap looks causal, but its correlation with the actual decision mechanism is not guaranteed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is gradient saturation and the faithfulness gap. A sigmoid or ReLU can flatten the gradient to near zero in large regions of input space, making the saliency map dim or uniform even when the model is highly confident. The derivative at a saturated point says almost nothing about what the model learned. This is not a rare edge case; deep networks with ReLU activations have exactly zero gradient for all negative pre-activations, which can blank out large portions of the attribution map.',
        'Worse, an explanation can look sharp, well-localized, and intuitively correct while explaining the wrong thing. Adebayo et al. (2018) ran a devastating sanity check: they randomized the model weights layer by layer and recomputed the saliency maps. Guided backpropagation and guided Grad-CAM produced nearly identical maps on trained and fully randomized models. The maps were acting as edge detectors on the input image, not as explanations of the learned decision rule. A method that survives model destruction cannot be explaining the model.',
        {
          type: 'note',
          text: 'The sanity check is simple: randomize the weights, redraw the map. If the map does not change, the method is explaining input texture, not the model. This test should be the first thing you run on any new attribution method.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Vanilla gradient saliency (Simonyan et al. 2014) computes the partial derivative of the class score with respect to each input dimension. For a classifier f and input x, the saliency map is the absolute value of the gradient evaluated at x. The gradient tells you: if this pixel changed by a tiny amount, how much would the class score move?',
        {
          type: 'diagram',
          text: 'class score y_c\n      |\n  backpropagate gradient\n      |\n  layer N  (fc / softmax)\n      |\n  layer N-1  (conv + ReLU)\n      |\n     ...      (intermediate layers)\n      |\n  layer 1  (conv + ReLU)\n      |\n  input pixels x\n      |\n  saliency = |dy_c / dx|',
          label: 'Backprop flow: gradient of class score with respect to input pixels',
        },
        {
          type: 'code',
          language: 'python',
          text: '# Vanilla gradient saliency in PyTorch\nimport torch\n\ndef saliency_map(model, image, target_class):\n    image.requires_grad_(True)\n    logits = model(image.unsqueeze(0))\n    score = logits[0, target_class]\n    score.backward()\n    # Absolute gradient across color channels\n    saliency, _ = image.grad.abs().max(dim=0)\n    return saliency',
        },
        'Gradient times input multiplies each gradient by the corresponding input value. This shifts the question from "where is the model locally sensitive?" to "how much did each feature actually contribute to this score?" A pixel with a large gradient but value near zero contributed little to this prediction; multiplying by the input captures that.',
        {type: 'image', src: 'https://docs.pytorch.org/tutorials/_images/fgsm_panda_image.png', alt: 'FGSM panda example showing original image perturbation and changed prediction', caption: 'The same input gradient that powers simple saliency also powers FGSM attacks; explanation and attack share the derivative. Source: PyTorch documentation, https://docs.pytorch.org/tutorials/beginner/fgsm_tutorial.html.'},
        'Occlusion works by intervention rather than derivatives. Mask a patch, re-run the model, measure the score drop. If the score collapses, the masked region was causally involved. The cost is one forward pass per patch position, which is expensive but produces a behavioral signal that does not depend on gradient flow or activation functions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Gradient saliency works because the derivative is the best local linear approximation of the model around the input point. For a small perturbation epsilon, the change in output is approximately the gradient dot epsilon. This is the same mathematical object that powers FGSM adversarial attacks: the gradient points in the direction of maximum output change. For attribution, you take the magnitude; for attacks, you take the sign.',
        'Integrated Gradients (Sundararajan et al. 2017) fixes the saturation problem by integrating the gradient along a straight path from a baseline (typically a black image) to the actual input. This satisfies two axioms: sensitivity (if a feature changes the output, it gets nonzero attribution) and implementation invariance (two functionally identical networks produce the same attribution). Vanilla gradients satisfy neither when ReLU saturation zeroes out the gradient.',
        'Grad-CAM (Selvaraju et al. 2017) takes a different approach. Instead of computing gradients at the input layer, it computes gradients of the class score with respect to the feature maps of a convolutional layer. It then weights each feature map by its average gradient and takes a ReLU of the weighted sum. The result is a coarse, class-discriminative heatmap at the resolution of the chosen convolutional layer. It passes the Adebayo sanity check because it depends on learned feature maps, not just input edges.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Vanilla gradient: one backward pass, pixel-level resolution, usually sanity-check safe, but noisy and vulnerable to ReLU or sigmoid saturation.',
            'SmoothGrad: about 50 backward passes over noisy copies, pixel-level resolution, often clearer than vanilla gradients, but smoothing can also hide real signal.',
            'Integrated Gradients: roughly 50 to 300 backward passes along a baseline path, pixel-level resolution, and stronger axioms, but the baseline choice changes the result.',
            'Grad-CAM: one backward pass plus a layer hook, coarse convolution-layer resolution, and good class localization for CNNs, but not a pixel-exact explanation.',
            'KernelSHAP: exact cost is exponential in feature groups and sampled cost is still high; it gives feature-group attributions, but grouping choices strongly affect the answer.',
          ],
        },
        'Vanilla gradients are nearly free: one backward pass, same cost as one training step. SmoothGrad averages gradients over N noisy copies of the input, typically N=50, so it costs 50x. Integrated Gradients interpolates along a path from baseline to input with M steps, costing M backward passes. Grad-CAM is cheap (one backward pass plus a hook on the target layer) but produces coarse maps at the spatial resolution of the last convolutional layer.',
        'SHAP-based methods estimate Shapley values, which in theory require evaluating all 2^k feature coalitions. KernelSHAP samples coalitions to make this tractable, but cost still scales with the number of feature groups and desired precision. For a 224x224 image with superpixel grouping into 50 regions, a KernelSHAP run might need thousands of forward passes.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Saliency maps are the fastest way to catch shortcut learning. A medical imaging classifier that focuses on hospital ID tags instead of tissue is using a spurious correlation. A bird classifier that focuses on habitat background instead of plumage will fail on out-of-distribution photos. A spam model that relies on email client formatting will break when the client changes. The attribution map does not fix the problem, but it points the investigator to the feature to delete, rebalance, or monitor.',
        'Model debugging during development is the highest-value use case. Before deploying a model, run attribution on correctly classified, misclassified, and adversarially perturbed inputs. If correct predictions highlight the right features and errors highlight irrelevant ones, the model has learned something reasonable. If correct predictions also highlight irrelevant features (background, watermarks, metadata), the model may be right for the wrong reasons and will fail on distribution shift.',
        'Attribution also bridges different explanation tools. LIME builds a local linear surrogate. Influence functions trace responsibility to training examples. Mechanistic interpretability studies internal features and circuits. Saliency asks which input features mattered. These are different slices through the same question, and agreement across methods is far stronger evidence than one clean heatmap.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Saliency fails when the explanation is plausible but unfaithful. The Adebayo sanity check exposed guided backpropagation as an edge detector that ignores the model. But even methods that pass the sanity check can mislead. Integrated Gradients depends on a baseline choice: a black image baseline assumes black pixels are "absent," which is arbitrary for medical images or satellite imagery. Different baselines produce different attributions, and there is no universal correct choice.',
        'Feature interaction is a fundamental blind spot. If the model uses a conjunction of features (the prediction fires only when feature A and feature B are both present), removing either one alone causes a large score drop, but the attribution map assigns high importance to both. The map cannot distinguish "A and B are independently important" from "the model uses the joint presence of A and B." Shapley values handle this better in theory but are exponentially expensive in practice.',
        'Saliency is also the wrong tool for global claims about model behavior. One attribution map explains one verdict under one method. It does not prove fairness, calibration, safety, or reliability. Using a handful of clean-looking heatmaps as compliance evidence is cargo-cult interpretability. The right language is always conditional: this method suggests the model was sensitive to these features on this input, and perturbation tests did or did not support that claim.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Simonyan, Vedaldi, Zisserman (2014). Deep Inside Convolutional Networks: Visualising Image Classification Models and Saliency Maps. https://arxiv.org/abs/1312.6034 -- the original vanilla gradient saliency paper.',
            'Sundararajan, Taly, Yan (2017). Axiomatic Attribution for Deep Networks (Integrated Gradients). https://arxiv.org/abs/1703.01365 -- path-integrated gradients with sensitivity and implementation invariance axioms.',
            'Selvaraju et al. (2017). Grad-CAM: Visual Explanations from Deep Networks via Gradient-based Class Activation Mapping. https://arxiv.org/abs/1610.02391 -- coarse class-discriminative heatmaps from convolutional feature maps.',
            'Adebayo et al. (2018). Sanity Checks for Saliency Maps. https://arxiv.org/abs/1810.03292 -- the randomization test that exposed guided backprop as an edge detector.',
            'Smilkov et al. (2017). SmoothGrad: Removing Noise by Adding Noise. https://arxiv.org/abs/1706.03825 -- averaging gradients over noisy input copies.',
            'Jain and Wallace (2019). Attention is not Explanation. https://arxiv.org/abs/1902.10186 -- alternative attention distributions produce the same predictions.',
          ],
        },
        'Study Backpropagation for the derivative machinery that powers all gradient-based attribution. Study FGSM for the direct link between saliency gradients and adversarial perturbations -- the same gradient that explains the model also attacks it. Study Softmax and Temperature for how class scores are computed before attribution. Study LIME for local surrogate explanations that complement gradient methods. Study Multi-Head Attention for why attention weights are not automatically faithful attributions.',
      ],
    },
  ],
};
