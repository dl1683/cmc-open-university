// Early stopping: the only regularizer that costs NEGATIVE compute. Watch
// validation loss turn while training loss keeps falling, learn why quitting
// at the turn equals a weight penalty, and meet the patience counter that
// keeps noise from making you quit too soon.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'early-stopping',
  title: 'Early Stopping & Patience',
  category: 'AI & ML',
  summary: 'Validation turns while training keeps falling — quit at the turn, with a patience counter to ignore the noise.',
  controls: [
    { id: 'view', label: 'Stop', type: 'select', options: ['the turn, caught in the act', 'patience & the checkpoint'], defaultValue: 'the turn, caught in the act' },
  ],
  run,
};

// Deterministic training curves with two honest noise blips (epochs 9, 15).
const BUMPS = { 9: 0.15, 15: 0.08 };
const trainLoss = (e) => 2.2 * Math.exp(-e / 8) + 0.25;
const valLoss = (e) =>
  2.3 * Math.exp(-e / 8) + 0.32 + 0.012 * Math.max(0, e - 22) ** 1.3 + 0.03 * Math.sin(e * 1.7) + (BUMPS[e] ?? 0);
const EPOCHS = Array.from({ length: 41 }, (_, e) => e);
const BEST_EPOCH = EPOCHS.reduce((a, e) => (valLoss(e) < valLoss(a) ? e : a), 0);
const curve = (id, label, f) => ({ id, label, points: EPOCHS.map((e) => ({ x: e, y: f(e) })) });

function* theTurn() {
  yield {
    state: plotState({
      axes: { x: { label: 'epoch' }, y: { label: 'loss' } },
      series: [curve('train', 'training loss', trainLoss), curve('val', 'validation loss', valLoss)],
    }),
    highlight: { compare: ['train', 'val'] },
    explanation: 'Two curves, one training run. Training loss does what training loss always does — falls forever; the optimizer is paid to make it fall (Gradient Boosting and Regularization both showed it chewing toward zero). Validation loss tells the real story: it falls WITH training while the model learns genuine pattern… and then the curves part company. Learning Curves showed this gap opening across dataset sizes; here it opens across TIME, inside a single run — and the moment it opens has a name: the moment memorization starts paying better than learning.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epoch' }, y: { label: 'loss' } },
      series: [curve('train', 'training loss', trainLoss), curve('val', 'validation loss', valLoss)],
      markers: [{ id: 'turn', x: BEST_EPOCH, y: valLoss(BEST_EPOCH), label: `the turn: epoch ${BEST_EPOCH}` }],
    }),
    highlight: { found: ['turn'], active: ['val'] },
    explanation: `The turn, caught: validation bottoms at epoch ${BEST_EPOCH} (loss ${valLoss(BEST_EPOCH).toFixed(2)}) and climbs from there — by epoch 40 it has given back ${(valLoss(40) - valLoss(BEST_EPOCH)).toFixed(2)} while training loss kept "improving." Every epoch past the turn makes the model objectively worse at its actual job, while every dashboard the optimizer sees says things are going great. EARLY STOPPING is the two-line discipline that takes the validation curve's side: track the best validation score; when training ends, hand back the weights from THAT epoch — not the last one.`,
    invariant: 'Past the validation minimum, more training reduces training loss by memorizing — generalization only decays.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epoch' }, y: { label: '‖w‖ — weight norm during training' } },
      series: [{ id: 'norm', label: 'weight norm', points: EPOCHS.map((e) => ({ x: e, y: 0.45 * Math.sqrt(e) + 0.2 })) }],
      markers: [{ id: 'stopAt', x: BEST_EPOCH, y: 0.45 * Math.sqrt(BEST_EPOCH) + 0.2, label: 'stop here = cap ‖w‖ here' }],
    }),
    highlight: { found: ['stopAt'], active: ['norm'] },
    explanation: 'Why does quitting early REGULARIZE? Watch the weight norm: training starts near zero (initialization) and the norm GROWS with every epoch — Regularization showed it growing forever on separable data. Stopping at epoch 25 therefore caps how large the weights ever got — the model never acquired the huge, confident, contortion-capable weights that overfitting requires. For linear models this is a theorem: early stopping along the gradient path is equivalent to an L2 penalty whose λ shrinks as training lengthens. Same leash, different handle — except this leash is free, and actually SAVES the 15 epochs you didn\'t run.',
    invariant: 'Stopping at epoch t caps the weight norm at ‖w(t)‖ — time-as-λ, the implicit L2.',
  };

  yield {
    state: matrixState({
      title: 'The regularizer price list',
      rows: [
        { id: 'l2', label: 'L2 / weight decay' },
        { id: 'dropoutRow', label: 'dropout' },
        { id: 'data', label: 'more data' },
        { id: 'early', label: 'early stopping' },
      ],
      columns: [{ id: 'cost', label: 'extra cost' }, { id: 'tune', label: 'knob to tune' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', 'none, but λ needs a search', 'λ (Cross-Validation)', 'slower convergence', 'rate p', 'expensive to collect', 'none', 'NEGATIVE — saves epochs', 'patience (forgiving)'][v],
    }),
    highlight: { found: ['early:cost'] },
    explanation: 'The price list explains why early stopping is the first regularizer every practitioner enables: it is the only row with NEGATIVE cost — it returns compute — and its knob is forgiving (patience of 5 vs 10 rarely changes the outcome much, unlike a 10× λ mistake). One caveat for the modern era: epoch-wise DOUBLE DESCENT (the Loss Landscapes companion result) means very large models occasionally dip, rise, and dip AGAIN — a patience set too short banks the first minimum and misses the second. For most models most of the time, stop at the turn; for giant ones, know the exception exists.',
  };
}

function* patience() {
  yield {
    state: plotState({
      axes: { x: { label: 'epoch' }, y: { label: 'validation loss' } },
      series: [curve('val', 'validation loss', valLoss)],
      markers: [
        { id: 'blip', x: 9, y: valLoss(9), label: 'epoch 9: UP — quit?!' },
        { id: 'blip2', x: 15, y: valLoss(15), label: 'epoch 15: up again?!' },
      ],
    }),
    highlight: { removed: ['blip', 'blip2'], active: ['val'] },
    explanation: `The naive rule — "stop the moment validation rises" — meets reality at epoch 9: validation jumps from ${valLoss(8).toFixed(2)} to ${valLoss(9).toFixed(2)}. Quit there and you ship a model with triple the loss of the true optimum still ${BEST_EPOCH - 9} epochs away. But it was NOISE — a wobbly minibatch, a small validation set having a moment (the same single-split jitter Cross-Validation measured) — and the curve dives right back down. Epoch 15 fakes you out again. Validation curves wobble; a tripwire that fires on any uptick fires constantly and early.`,
    invariant: 'A noisy curve crosses "worse than yesterday" many times before it is truly done improving.',
  };

  const timeline = [
    { e: 8, best: valLoss(8), ctr: 0, note: 'new best — counter resets' },
    { e: 9, best: valLoss(8), ctr: 1, note: 'worse (the blip) — counter 1/5' },
    { e: 10, best: valLoss(10), ctr: 0, note: 'new best — patience forgave the blip' },
    { e: 25, best: valLoss(25), ctr: 0, note: 'the true minimum — checkpoint saved' },
    { e: 28, best: valLoss(25), ctr: 3, note: 'no improvement — counter 3/5' },
    { e: 30, best: valLoss(25), ctr: 5, note: 'counter 5/5 → STOP, restore epoch 25' },
  ];
  yield {
    state: matrixState({
      title: 'Patience = 5, walked through this exact run',
      rows: timeline.map(({ e }) => ({ id: `e${e}`, label: `epoch ${e}` })),
      columns: [{ id: 'best', label: 'best val so far' }, { id: 'ctr', label: 'patience counter' }, { id: 'note', label: '' }],
      values: timeline.map(({ best, ctr, note }, i) => [best, ctr, 10 + i]),
      format: (v) => (v >= 10 ? timeline[v - 10].note : Number.isInteger(v) ? `${v}/5` : v.toFixed(3)),
    }),
    highlight: { found: ['e25:note'], removed: ['e30:ctr'], compare: ['e9:ctr'] },
    explanation: 'The production rule, walked through this exact curve: keep a BEST-SO-FAR score and a COUNTER of epochs since it improved. Improvement (by at least a min_delta, to ignore meaningless 0.0001 wiggles) saves a CHECKPOINT of the weights and resets the counter; no improvement ticks it up; at patience (here 5) — stop, and restore the checkpoint. The blips at 9 and 15 tick the counter and are forgiven; the real turn at 25 outlasts the patience window and triggers the stop at 30. Total overspend: five epochs of insurance. The model you keep is epoch 25\'s — the best the run ever was.',
    invariant: 'Patience trades k extra epochs for immunity to k-epoch noise; the checkpoint makes the stop retroactive.',
  };

  yield {
    state: matrixState({
      title: 'The settings that bite people',
      rows: [
        { id: 'restore', label: 'restore_best_weights' },
        { id: 'metric', label: 'what to monitor' },
        { id: 'delta', label: 'min_delta' },
        { id: 'budget', label: 'with halving/Hyperband' },
      ],
      columns: [{ id: 'advice', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'TRUE — else you stop late AND keep the worst weights', 'val loss for stability; the business metric for truth', 'small but nonzero (~1e-4) — silence float jitter', 'early stopping per config = poor man\'s successive halving'][v],
    }),
    highlight: { removed: ['restore:advice'] },
    explanation: 'The footgun list, led by the classic: several frameworks historically defaulted restore_best_weights to FALSE — early stopping would dutifully halt at epoch 30 and keep epoch 30\'s degraded weights, silently discarding the epoch-25 checkpoint it was built to protect. Check that flag in any codebase you inherit. Monitor validation loss (smooth) unless a business metric (Precision-Recall, cost from Picking a Threshold) is what you actually ship. And notice the deep kinship with Hyperparameter Search: early stopping is successive halving with n = 1 — abandoning work the evidence stopped supporting. That instinct, applied everywhere from one training run to a fleet of configs, is most of what "compute-efficient ML" means.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the turn, caught in the act') yield* theTurn();
  else if (view === 'patience & the checkpoint') yield* patience();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Early stopping is a regularizer built from the validation curve. In the demo, training loss keeps falling for all 40 epochs, but validation loss bottoms at epoch 25, about 0.44, then rises to about 0.82 by epoch 40. That split is the turn: the model is still improving at memorizing the training set while getting worse at the job you care about. Learning Curves & Bias–Variance shows the same train-validation gap across dataset sizes; here it opens inside one run, across time.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The naive rule, stop on the first validation uptick, fails because the curve is noisy. This generator deliberately inserts blips at epochs 9 and 15; quitting there would miss the true minimum by many epochs. Production early stopping keeps the best validation score, saves a checkpoint when it improves, and increments a patience counter when it does not. With patience = 5, the demo forgives the blips, recognizes epoch 25 as best, stops at epoch 30, and restores epoch 25 weights.`,
        `It regularizes because weight norms tend to grow along the training path. Stopping at time t caps the norm at ||w(t)||. For linear models, that is closely related to an L2 leash from Regularization: L1 & L2; in practice it behaves like a free, time-based penalty. The model never reaches the large, contorted weights that later epochs can use to memorize exceptions.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The cost is one validation evaluation per epoch and checkpoint storage for the best model. The payoff is negative compute: in this 40-epoch demo, patience stops at 30 and keeps the better epoch-25 model. Dropout and weight decay add training friction; early stopping removes wasted epochs. On very large models, validation itself can be expensive, but it is usually cheaper than training through a long overfitting tail.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Keras, PyTorch Lightning, and most training loops expose early stopping because it is simple and hard to misuse if restore-best-weights is enabled. Hyperparameter Search uses the same instinct at larger scale: abandon configurations whose evidence stops improving. It is also a guardrail during Data Leakage & Contamination reviews, because a suspiciously perfect validation curve should make you inspect the split before celebrating. In small-data projects, it is often the first regularizer to enable.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The classic footgun is stopping late but keeping the late weights. Always restore the checkpoint, not the final epoch. Patience that is too short fires on noise; patience that is too long becomes a training budget. Monitor validation loss for stability unless the shipped metric is different, such as Precision, Recall & the Confusion Matrix or cost from Picking a Threshold with Real Costs. Very large models can show epoch-wise double descent, so a tiny patience can bank the first dip and miss a later one.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Cross-Validation & Honest Evaluation for the validation signal and Learning-Rate Schedules & Warmup for shaping the path to the turn. The key habit is to treat training time as another capacity control: more epochs are useful only until validation evidence says the extra capacity is being spent on memorization.`,
        `In code reviews, look for three settings together: the monitored metric, min_delta, and restore-best-weights. If any one is missing, the callback may look responsible while silently stopping on noise, ignoring meaningful improvement, or keeping the wrong checkpoint.`,
        `Also record the epoch that produced the restored checkpoint. Without that provenance, later comparisons can confuse the stopping epoch with the model epoch.`,
      ],
    },
  ],
};
