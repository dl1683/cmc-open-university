// Saliency maps: asking a model "why?" — and checking whether the answer
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
    explanation: 'The spam filter flags an email at 97.3% — and the user appeals: WHY? "The weights said so" is not an answer a bank regulator, a doctor, or a deleted-email owner will accept. ATTRIBUTION asks: how much of this one verdict does each input feature own? For our two-feature toy we can answer exactly — and the techniques that answer it are the same ones pointed at million-pixel images, where the answer gets drawn as a heatmap called a saliency map.',
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
    explanation: 'Method 1: differentiate the verdict with respect to the INPUT — ∂p/∂feature = wᵢ·σ′(z). You have seen this exact arrow before: it is FGSM\'s attack direction from Adversarial Examples, used for honesty instead of evasion. One gradient evaluation, and per-unit sensitivity says CAPS words push harder (0.041 vs 0.029). Multiply by how much of each feature the email actually contains — GRADIENT × INPUT — and the blame splits nearly evenly: this email is spammy for both reasons. Attack and explanation are the same mathematics with different intentions.',
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
    explanation: `Method 2 needs no calculus and no access to the model's insides: OCCLUSION. Re-run the prediction with each feature deleted. Strip the exclamation marks → 97.3% falls to ${(predict(0, X.caps) * 100).toFixed(1)}%; strip the CAPS → it falls to ${(predict(X.excl, 0) * 100).toFixed(1)}%. The CAPS removal hurts more — occlusion crowns it the bigger culprit, agreeing with the gradient's per-unit ranking. On images this becomes sliding a gray patch across the photo and watching the confidence dip — when the patch covers the dog's face, "dog" collapses; the dip map IS the explanation. Price: one forward pass per feature, against the gradient's single backward pass.`,
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
    explanation: 'Scale the two-feature table to 150,528 pixels and draw |gradient| as brightness: a SALIENCY MAP. The bright blob is where the classifier\'s attention concentrates — ideally the animal\'s face, suspiciously often the watermark, the grass, or the hospital tag that correlated with the label (models caught diagnosing pneumonia from the X-ray machine\'s metal token, not the lungs). This is attribution\'s real job in practice: not satisfying curiosity, but CATCHING SHORTCUT LEARNING before deployment does. Variants refine the recipe — integrated gradients averages the gradient along a path from a blank baseline (fixing saturation), Grad-CAM pools gradients at the last convolution layer for clean object-level blobs — but all descend from the two moves you just watched: differentiate, or delete.',
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
    explanation: 'Transformers ship with built-in heatmaps — the attention weights from Multi-Head Attention — and it is irresistible to read them as "what the model looked at." Resist. The test (Jain & Wallace 2019, "Attention is not Explanation"): construct ALTERNATIVE attention patterns, pointing at different words, that produce the SAME prediction. If two contradictory stories both fit the verdict, neither is the verdict\'s cause. Attention shows where information FLOWED, which is plumbing — not which information DECIDED, which is causality. The plumbing is genuinely useful for debugging; it is not testimony.',
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
    explanation: 'The acid test for any attribution method (Adebayo et al. 2018, "Sanity Checks for Saliency Maps"): REPLACE the trained weights with random noise and regenerate the explanation. The model now knows nothing — an honest explanation must dissolve into static. Plain gradients and integrated gradients pass. Several beloved methods, guided backprop among them, produced nearly IDENTICAL pretty maps on the lobotomized model: they were acting as fancy edge detectors, tracing the input\'s structure rather than the model\'s reasoning. An explanation that survives the death of the thing it explains was never an explanation.',
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
    explanation: 'The working toolbox, honestly priced. And the closing discipline, which the occlusion method already taught you: treat every saliency map as a HYPOTHESIS, not a verdict. The map claims the CAPS words drove the flag? Delete them and re-run — if the prediction barely moves, the map lied. Faithfulness (does the explanation track the model\'s real mechanism?) beats plausibility (does it look reasonable to a human?) every time they conflict — a plausible-but-unfaithful explanation is exactly how a biased model passes review. Explanation tools point; verification convicts.',
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
      heading: `What it is`,
      paragraphs: [
        `A saliency map is a heatmap that answers the question "which parts of the input did the model rely on for this prediction?" In the demo, you start with a spam email flagged at 97.3% confidence, and ask: which features — the exclamation marks or the ALL-CAPS words — drove that verdict? The answer comes as a number per feature (or a bright/dark pixel for each of 150,000 image pixels). Saliency maps are the most direct tool for understanding what a neural network attended to, catching shortcut learning before it harms users in production.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The demo shows two complementary methods: gradient saliency and occlusion. Gradient saliency follows the chain rule: ∂p/∂feature = wᵢ·σ′(z), where σ′ is the derivative of the sigmoid. You have seen this exact slope before — it is FGSM's attack direction from adversarial examples, reused here for honesty instead of evasion. One backward pass computes how much each feature *locally* influences the verdict at this one input. In the demo, CAPS words have a steeper gradient (0.041 vs 0.029), meaning per unit change, they push the probability harder. Multiply by the input's actual values — gradient × input — to split the blame proportionally: both the exclamation marks and CAPS contribute roughly equally to the 97.3% spam score.`,
        `Occlusion is simpler and requires no calculus: delete each feature one at a time and re-run the prediction. When you remove the CAPS words, the spam score drops from 97.3% to 31.0% (or 23.1% for exclamation marks, depending on the baseline). The magnitude of that drop tells you how much the removed feature contributed. The gradient method said CAPS words mattered more on a *per-unit* basis; occlusion crowns them the bigger culprit in absolute terms — removing them causes the larger verdict collapse. Both methods agree on the culprit, though they measure responsibility slightly differently. Occlusion costs one forward pass per feature; gradients cost one backward pass, making gradients cheaper on wide inputs.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Gradient saliency (gradient × input): 1 backward pass + a multiplication per feature. On a million-pixel image, that is negligible overhead — effectively free after you have the loss gradient. Integrated gradients refines this to fix saturation artifacts by averaging gradients along a path from a blank baseline to the actual input, roughly 50 backward passes total, and the cost of interpolating baselines. Occlusion and SHAP: 1 forward pass per feature (or per interaction for SHAP), becoming prohibitively expensive on wide inputs but revealing higher-order feature interactions that gradients alone cannot. Grad-CAM (for convolutional networks only): 1 forward pass + layer-wise gradient hooks, producing coarse, spatially coherent activation maps. On a CNN it is faster than per-pixel occlusion; on a transformer it does not apply. Each method trades cost against faithfulness and the kinds of explanations they reveal — there is no free lunch.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Medical imaging: a radiologist approves a model that diagnoses pneumonia from chest X-rays at 99% accuracy — then a researcher discovers the saliency map highlights the X-ray machine's metal token, not the lungs. The model learned a shortcut: hospital equipment correlates with pneumonia labels in the training set, so it exploited that instead of the disease. Saliency maps caught the shortcut before deployment. Image classification: when a self-driving car's model flags a stop sign, the developer asks the saliency map and learns it is focusing on the red color, not the octagon shape — brittle to red paint. Watermarked datasets: commercial image datasets sometimes embed invisible logos; a model trained on them may weight the watermark more than the true subject. Before shipping, generate saliency maps to spot the shortcut. Credit scoring: a bank's classifier rejects an applicant, and regulators demand proof that the decision rested on income and debt, not a protected attribute. Occlusion saliency on the relevant features provides that audit trail.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `First: attention weights are not explanations. Multi-Head Attention heatmaps look like saliency maps, but Jain & Wallace (2019) showed you can construct *different* attention patterns that produce the *same* output. Attention traces the flow of information; it does not prove causality. Second: many beloved saliency methods fail the sanity check (Adebayo et al., 2018). Replace the trained weights with random noise and regenerate the explanation. Plain gradients pass — the map turns to noise. Guided backprop *fails* — it produces nearly identical, pretty edge-detector outputs on both trained and random models, meaning it is tracing the input image's structure, not the model's learned reasoning. An explanation that survives the death of the thing it explains was never an explanation. Third: saliency maps are hypotheses, not verdicts. The map claims CAPS words drove the flag? Delete them and re-run the prediction. If the score barely moves, the map lied — plausibility beats faithfulness, and your model is sneaking reasoning past the explanation method. Always verify by occlusion or another orthogonal method.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Gradient saliency uses backpropagation to ask "how sensitive is the output to the input?" — so study Backpropagation to understand ∂p/∂feature deeply. The gradient is the same arrow as FGSM from Adversarial Examples & FGSM, reused to attack the model instead of explain it — compare both intentions. On transformers, saliency competes with Multi-Head Attention's built-in visualization, though as you learned, those two tell different stories. Logistic Regression and Convolution are the building blocks beneath the demo's spam classifier and image models. For production systems, Softmax & Temperature shows how to turn raw logits into calibrated confidences, pairing them with saliency to catch both misaligned scores and shortcut-learned features.`,
      ],
    },
  ],
};

