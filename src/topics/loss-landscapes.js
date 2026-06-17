// Loss landscapes: the terrain gradient descent actually walks — basins
// that trap, saddles that stall, and the surprising rule that FLAT valleys,
// not deep ones, are where generalization lives.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'loss-landscapes',
  title: 'Loss Landscapes & Optimization Geometry',
  category: 'AI & ML',
  summary: 'The terrain under gradient descent: trapping basins, stalling saddles, and why flat minima generalize.',
  controls: [
    { id: 'view', label: 'Survey', type: 'select', options: ['walking the terrain', 'sharp valleys vs flat ones'], defaultValue: 'walking the terrain' },
  ],
  run,
};

// A 1-D slice of a non-convex loss: double well, left basin deeper.
const well = (w) => ((w * w - 4) ** 2) / 16 + w / 4 + 1;
const wellGrad = (w) => (w * (w * w - 4)) / 4 + 0.25;
const WS = Array.from({ length: 61 }, (_, i) => -3.5 + i * (7 / 60));

// Sharp-vs-flat: two minima of EQUAL training depth, different widths.
const trainLoss = (w) => 3 - 2.5 * Math.exp(-((w - 2) ** 2) / 0.05) - 2.5 * Math.exp(-((w + 2) ** 2) / 1.5);
const testLoss = (w) => trainLoss(w - 0.3);

function* terrain() {
  yield {
    state: plotState({
      axes: { x: { label: 'a weight w (1-D slice)' }, y: { label: 'loss' } },
      series: [{ id: 'well', label: 'loss(w)', points: WS.map((w) => ({ x: w, y: well(w) })) }],
      markers: [
        { id: 'good', x: -2.12, y: well(-2.12), label: 'deep basin: 0.49' },
        { id: 'meh', x: 1.86, y: well(1.86), label: 'shallow basin: 1.48' },
      ],
    }),
    highlight: { found: ['good'], compare: ['meh'] },
    explanation: 'Gradient Descent was introduced on a friendly bowl — one valley, one bottom, convergence guaranteed (Logistic Regression\'s convex luxury). A neural network\'s loss is nothing like that bowl. Here is a 1-D slice through a realistic terrain: TWO valleys, the left genuinely better (loss 0.49) than the right (1.48), separated by a ridge. The full landscape of a modern network has millions of dimensions and unimaginably many such features — this slice is a core sample, and it already breaks the convex guarantees.',
  };

  const path = [];
  let w = 3;
  for (let i = 0; i < 12; i++) {
    path.push({ x: w, y: well(w) });
    w -= 0.4 * wellGrad(w);
  }
  yield {
    state: plotState({
      axes: { x: { label: 'a weight w (1-D slice)' }, y: { label: 'loss' } },
      series: [
        { id: 'well', label: 'loss(w)', points: WS.map((v) => ({ x: v, y: well(v) })) },
        { id: 'path', label: 'GD from w₀ = 3', points: path },
      ],
      markers: [{ id: 'stuck', x: path.at(-1).x, y: path.at(-1).y, label: `settled at ${path.at(-1).x.toFixed(2)}` }],
    }),
    highlight: { active: ['path'], removed: ['stuck'] },
    explanation: `Watch actual gradient descent (computed live, lr = 0.4) released from w₀ = 3: it rolls downhill, brakes, and settles at w ≈ ${path.at(-1).x.toFixed(2)} — the SHALLOW basin, loss 1.48. The better valley sits a short walk away, but reaching it means going UPHILL over the ridge, and pure gradient descent never goes uphill. Where you START decides where you END: that is non-convexity\'s tax, and why initialization (the He/Xavier schemes from Vanishing Gradients) is not bookkeeping but destiny.`,
    invariant: 'Plain gradient descent is strictly downhill: it converges to the basin of whatever slope it starts on.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'distance from the critical point' }, y: { label: 'loss along each axis' } },
      series: [
        { id: 'axisUp', label: 'along axis 1: minimum', points: WS.map((v) => ({ x: v, y: 2 + 0.3 * v * v })) },
        { id: 'axisDown', label: 'along axis 2: MAXIMUM', points: WS.map((v) => ({ x: v, y: 2 - 0.3 * v * v })) },
      ],
      markers: [{ id: 'saddle', x: 0, y: 2, label: 'gradient = 0 here' }],
    }),
    highlight: { compare: ['axisUp', 'axisDown'], active: ['saddle'] },
    explanation: 'Now the high-dimensional twist that makes the trap story misleading: the SADDLE POINT. At this spot the gradient is exactly zero — but it is a minimum along one axis and a MAXIMUM along the other: a mountain pass, not a valley floor. Count what randomness demands: a true local minimum needs the surface to curve upward along ALL d directions; if each direction\'s curvature were a coin flip, that is 2⁻ᵈ — and d is in the millions. Random zero-gradient points in high dimension are saddles, essentially always. The 1990s fear of "millions of bad local minima" had the wrong villain.',
    invariant: 'A random critical point in d dimensions is a minimum with probability ~2⁻ᵈ: high-D is saddles all the way.',
  };

  yield {
    state: matrixState({
      title: 'The real enemy is slowness, not traps — and the escape kit',
      rows: [
        { id: 'saddleRow', label: 'saddle plateaus' },
        { id: 'momentum', label: 'momentum' },
        { id: 'noise', label: 'minibatch noise (SGD)' },
        { id: 'adaptive', label: 'Adam-style scaling' },
      ],
      columns: [{ id: 'role', label: 'what it does' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'gradient ≈ 0 for long stretches — GD crawls', 'accumulated velocity coasts across flats', 'random kicks knock you off the pass', 'scales up steps along quiet directions'][v],
    }),
    highlight: { removed: ['saddleRow:role'], found: ['noise:role'] },
    explanation: 'Why saddles still matter: near the pass the gradient is nearly zero in every direction, so vanilla GD slows to a geological crawl — the plateau on your loss curve that LOOKS like convergence and is actually a saddle\'s waiting room. The escape kit is the modern optimizer\'s standard equipment: MOMENTUM carries speed across the flat; the NOISE in minibatch gradients — long treated as a defect — randomly perturbs the trajectory off the unstable direction (SGD\'s sloppiness is a feature); adaptive methods amplify steps where gradients run quiet. And the empirical surprise that buried the old pessimism: for big networks, nearly all the minima these methods reach are roughly equally good, and often connected by low-loss tunnels (mode connectivity). The landscape is not a minefield; it is a vast, navigable river delta.',
  };
}

function* sharpFlat() {
  yield {
    state: plotState({
      axes: { x: { label: 'a weight w (1-D slice)' }, y: { label: 'training loss' } },
      series: [{ id: 'train', label: 'training loss', points: WS.map((w) => ({ x: w, y: trainLoss(w) })) }],
      markers: [
        { id: 'sharp', x: 2, y: trainLoss(2), label: 'sharp: 0.50' },
        { id: 'flat', x: -2, y: trainLoss(-2), label: 'flat: 0.50' },
      ],
    }),
    highlight: { compare: ['sharp', 'flat'] },
    explanation: 'Two minima, IDENTICAL training loss — 0.50 each. To the training set they are indistinguishable; an optimizer hunting low loss has no reason to prefer either. But look at their shapes: the right one is a needle-thin slot canyon, the left a wide, lazy basin. Hold that picture and ask the only question that matters: what happens when the data shifts — when test data differs slightly from training data, as it always does?',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'a weight w (1-D slice)' }, y: { label: 'loss' } },
      series: [
        { id: 'train', label: 'training loss', points: WS.map((w) => ({ x: w, y: trainLoss(w) })) },
        { id: 'test', label: 'test loss (shifted world)', points: WS.map((w) => ({ x: w, y: testLoss(w) })) },
      ],
      markers: [
        { id: 'sharpPay', x: 2, y: testLoss(2), label: `sharp pays: ${testLoss(2).toFixed(2)}` },
        { id: 'flatPay', x: -2, y: testLoss(-2), label: `flat pays: ${testLoss(-2).toFixed(2)}` },
      ],
    }),
    highlight: { removed: ['sharpPay'], found: ['flatPay'] },
    explanation: `Test data is the same terrain nudged sideways — the distribution shifted a little, so the whole curve slides. Now read the bill at each minimum: the FLAT basin barely notices (0.50 → ${testLoss(-2).toFixed(2)}) because a wide floor forgives a sideways nudge; the SHARP canyon is catastrophic (0.50 → ${testLoss(2).toFixed(2)}) — one step left of a needle and you are climbing its wall. Same training performance, ${(testLoss(2) / testLoss(-2)).toFixed(1)}× different generalization. Flatness is robustness to being slightly wrong about the world — which is the entire job description of generalization (the variance story of Learning Curves, drawn as geometry).`,
    invariant: 'A flat minimum tolerates train→test shift; a sharp one converts the same shift into large loss.',
  };

  yield {
    state: matrixState({
      title: 'What herds the optimizer toward flat minima?',
      rows: [
        { id: 'smallbatch', label: 'small batches (noisy SGD)' },
        { id: 'bigbatch', label: 'huge batches' },
        { id: 'lr', label: 'large learning rate' },
        { id: 'sam', label: 'SAM / weight averaging' },
      ],
      columns: [{ id: 'effect', label: 'effect on where you land' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'noise can\'t sit in a needle → lands flat', 'precise steps settle anywhere — often sharp', 'big steps overshoot narrow slots', 'explicitly seeks low-loss NEIGHBORHOODS'][v],
    }),
    highlight: { found: ['smallbatch:effect'], removed: ['bigbatch:effect'] },
    explanation: 'The herding forces. A noisy optimizer is a ball being jiggled while it rolls: it cannot REST in a needle-thin canyon — the jiggle bounces it out — but a wide basin holds it easily, so SGD\'s noise acts as a flatness filter (the famous observation that very large batches, with their precise quiet gradients, generalize WORSE — Keskar et al. 2016). Large learning rates do the same by overshooting slots narrower than the step size. And once the principle was understood, it became a design target: SAM (sharpness-aware minimization) optimizes the worst loss in a neighborhood rather than at a point, and stochastic weight averaging centers you in the basin you found. The dial-vs-terrain summary of all of deep learning practice: architecture shapes the landscape; the optimizer\'s noise chooses which valleys are inhabitable; regularization (Regularization, Dropout) flattens them further. None of it is convex; all of it is geometry.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'walking the terrain') yield* terrain();
  else if (view === 'sharp valleys vs flat ones') yield* sharpFlat();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A loss landscape is the geometry created by a model, a dataset, and a loss function. Each possible setting of the model weights is a point. The height at that point is the loss. Training is the path an optimizer takes through that surface. Gradient descent, momentum, Adam, minibatch noise, initialization, normalization, weight decay, and learning-rate schedules matter because they change the path.',
        'This topic exists because a scalar loss curve hides too much. A training chart can tell you that loss fell from 2.1 to 0.4, but it cannot tell you whether the optimizer crossed a ravine, crawled through a saddle, bounced out of a sharp slot, or settled in a broad basin. The local shape around the solution affects training speed, numerical stability, sensitivity to weight perturbations, and generalization to new data.',
        'Two models can reach the same training loss and still behave differently. One may sit in a narrow region where tiny parameter changes or data shifts cause loss to rise sharply. Another may sit in a wide region where nearby parameters also work. Loss landscapes turn that difference into a geometric question instead of a vague statement about "better training."',
      ],
    },
    {
      heading: 'The naive convex story',
      paragraphs: [
        'The naive story comes from convex optimization. In least squares or logistic regression under the right assumptions, the loss can look like one bowl. There is one global minimum. If the learning rate is reasonable, following the negative gradient moves toward it. Local information is enough because every downhill path leads to the same basin.',
        'That story is useful for learning the gradient step, but it is misleading for neural networks. Neural-network losses are non-convex. Hidden units can be permuted without changing the represented function. Layers can rescale one another. Saturating activations can flatten regions. Interactions between layers can create ridges, curved valleys, plateaus, and saddle points.',
        'The old fear was that a large network would be trapped by countless bad local minima. The modern view is more specific. Bad minima can exist, but in high dimensions saddles, ill-conditioned ravines, sharp regions, poor gradient flow, and optimization instability are often the practical enemies. Training failure is usually not just "the model found the wrong bottom." It can be "the optimizer could not move well through the geometry it created."',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that optimization and generalization are geometric. Optimization asks whether the training procedure can move through the landscape efficiently. Generalization asks whether the point it finds remains good when data, weights, or deployment conditions shift slightly. A low-loss point with steep walls may be fragile. A low-loss point in a broad basin is usually more tolerant.',
        'Flatness is not magic, and it is not the only source of generalization, but it captures an important kind of robustness. If moving a little in parameter space causes a large loss increase, the solution depends on very precise weights. If nearby points also have low loss, the solution is less sensitive to noise, quantization, data sampling, and small distribution changes.',
        'This explains why optimizers are not interchangeable knobs. Minibatch SGD introduces noise. Momentum carries velocity through flat regions. Adam rescales coordinates using gradient statistics. Learning-rate schedules change exploration over time. Weight decay, dropout, augmentation, sharpness-aware minimization, and weight averaging all change either the surface, the path, or the region where training settles.',
      ],
    },
    {
      heading: 'Basins and paths',
      paragraphs: [
        'A basin is a region whose local downhill directions lead toward the same minimum or valley. The first visual shows a one-dimensional slice with two basins. Plain gradient descent starts on the right and moves downhill into the shallow basin even though the left basin is lower. The better region is nearby in the drawing, but reaching it requires going uphill over a ridge.',
        'The lesson is not that real networks are one-dimensional. The lesson is that local descent has no global map. It follows the slope it can see. Initialization, batch order, learning rate, optimizer state, and noise can choose the basin of attraction before the run has any chance to compare alternatives.',
        'This is why repeated seeds matter. One successful run does not prove the landscape is easy. One failed seed does not prove the architecture is broken. Variation across seeds is evidence about basin size, optimizer stability, and the degree to which training depends on early accidents.',
      ],
    },
    {
      heading: 'Saddles and curvature',
      paragraphs: [
        'A saddle point has zero gradient but is not a minimum. Along one direction it curves upward; along another it curves downward. In two dimensions this looks like a mountain pass. In high dimensions it is common because a true local minimum needs upward curvature in every direction, while a saddle needs only one direction that can go down.',
        'This changes how you read a plateau. A tiny gradient does not automatically mean convergence. It may mean the optimizer is moving through a flat saddle neighborhood, an ill-conditioned ravine, or a region where gradients are poorly scaled across parameters. The Hessian, or curvature matrix, is the formal object behind this story, but even simple gradient-norm and learning-rate diagnostics can reveal that loss is flat for the wrong reason.',
        'Modern optimizers are partly saddle escape tools. Momentum can carry speed across flat regions. Minibatch noise can nudge a run off unstable directions. Adaptive scaling can increase movement along quiet coordinates. These tools do not make the landscape convex. They make the path through non-convex geometry less brittle.',
      ],
    },
    {
      heading: 'Flatness and generalization',
      paragraphs: [
        'The sharp-vs-flat visual holds training loss equal. Both minima look equally good to the training objective. Then the test curve shifts slightly. The wide basin barely changes, while the sharp basin becomes much worse. This makes generalization visible as robustness: the model did not need a lower training loss; it needed a neighborhood of low loss.',
        'Flatness connects to many training practices. Small batches add gradient noise, making it harder to settle in a narrow slot. Larger learning rates can jump over sharp minima. Weight decay limits parameter growth and can smooth the effective solution. Data augmentation changes the loss surface by forcing nearby inputs to share labels. Stochastic weight averaging moves toward the center of a basin. Sharpness-aware minimization explicitly optimizes for low loss in a neighborhood.',
        'There is a caveat. Neural networks can be reparameterized in ways that change apparent sharpness without changing the function. Multiplying one layer and dividing the next can alter parameter-space geometry. A serious flatness claim must specify the parameterization, scale controls, perturbation rule, and evaluation set. Flatness is useful evidence, not a magic scalar that replaces validation.',
      ],
    },
    {
      heading: 'Why it works as a diagnosis',
      paragraphs: [
        'Landscape language works because it ties visible training symptoms to mechanisms. A plateau can mean the optimizer is near a saddle or moving through poorly scaled curvature. A validation gap can mean the model found a sharp or over-specialized region. Seed variance can mean the useful basins are small or hard to enter. These are not just metaphors; they name testable hypotheses.',
        'The diagnosis stays honest when it predicts an intervention. If the issue is a saddle or flat region, momentum, noise, or learning-rate changes should help. If the issue is sharpness, weight decay, augmentation, lower step size late in training, SAM, or averaging may help. If the intervention does not change the failure, the landscape story was probably incomplete.',
      ],
    },
    {
      heading: 'How to inspect a run',
      paragraphs: [
        'Use landscape thinking when a training run behaves strangely. A long plateau may suggest a saddle, poor gradient flow, too small a learning rate, bad initialization, or saturated activations. Loss spikes may suggest sharp curvature, too large a learning rate, unstable normalization, exploding gradients, or a bad batch. A model that trains well but fails validation may have found a brittle solution, overfit labels, or exploited leakage.',
        'Collect measurements before changing five knobs at once. Track training loss, validation loss, gradient norms, update norms, learning rate, batch statistics, activation ranges, weight norms, seed variation, and checkpoint perturbation behavior. If small weight noise ruins validation, sharpness is plausible. If gradient norms vanish in early layers, gradient flow may be the issue. If restarts land in very different places, initialization and optimizer noise matter.',
        'Debugging choices follow the diagnosis. Warmup can prevent early instability. Lower learning rates or clipping can calm sharp regions. Momentum can cross flats. Weight decay and augmentation can improve robustness. Normalization can reshape gradient flow. Early stopping can stop before the optimizer over-specializes to the training set. Landscape language is useful because it points to mechanisms, not because it gives every answer from a picture.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Studying a landscape is expensive because it usually requires extra model evaluations. A two-dimensional plot may evaluate a grid of points around a trained solution. Each point can require running the model over a dataset or sample. This is useful for research, debugging, and explanation, but ordinary training does not draw the surface. It samples local gradients along the path it takes.',
        'Optimizers trade memory and computation for better movement. Plain gradient descent stores little state but can crawl through ravines and saddles. Momentum stores velocity. Adam stores first and second moment estimates, using more memory but scaling steps by recent gradient behavior. SAM performs extra work to seek parameters whose neighborhoods have low loss, not just points with low loss.',
        'The right optimizer is workload-dependent. Adam may reach useful loss quickly but sometimes needs careful weight decay and scheduling for best generalization. SGD with momentum may generalize well but require more tuning. SAM may improve robustness but increase step cost. Landscape intuition helps explain these tradeoffs, but held-out evaluation decides whether the cost was worth paying.',
      ],
    },
    {
      heading: 'Where it helps',
      paragraphs: [
        'Landscape thinking helps in deep learning training, hyperparameter tuning, robustness work, model compression, quantization, fine-tuning, and transfer learning. Quantization and pruning are especially tied to flatness: if nearby parameter values still work, lower precision or sparsity is easier to tolerate. Fine-tuning also depends on geometry because a small update can either move smoothly into a new task basin or destroy useful pretrained structure.',
        'It also helps explain why architecture matters. Residual connections, normalization, activation choices, initialization, and attention patterns shape the surface before the optimizer starts. A training recipe is not only an optimizer. It is a joint design of landscape, path, and evaluation target.',
      ],
    },
    {
      heading: 'Where it misleads',
      paragraphs: [
        'A one-dimensional slice can show a wall that the full model can move around. A two-dimensional plane can miss a low-loss tunnel. A pretty plot can overstate certainty because it is only one chosen view of a huge parameter space. Use landscape plots as evidence about a slice, not as a complete map.',
        'Another mistake is using training geometry to excuse weak evaluation. A model in a flat-looking basin can still fail because the dataset is biased, labels leaked, the validation set is too similar to training, or the deployment distribution changed in a way not represented by the plot. Generalization is measured on honest data, not inferred from geometry alone.',
        'A good landscape argument combines pictures with measurements. If a paper claims a flatter solution, ask how flatness was measured, whether parameter scale was controlled, whether multiple seeds were compared, and whether the claim predicts validation behavior. If a run seems stuck, ask whether gradient norms, curvature estimates, restarts, and ablations support the diagnosis.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study gradient descent for the local step rule, then momentum and Adam for the ways optimizer state changes the path. Study saddle points and the Hessian to connect small gradient with curvature. Study vanishing and exploding gradients to understand when the backward signal cannot describe the landscape well to early layers.',
        'Then study regularization, dropout, data augmentation, sharpness-aware minimization, stochastic weight averaging, learning-rate schedules, initialization, normalization, and honest evaluation. A landscape story is useful only when the validation setup is clean enough to tell whether the model basin actually survives new data.',
      ],
    },
  ],
};
