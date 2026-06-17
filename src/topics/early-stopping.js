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
      heading: `Why early stopping exists`,
      paragraphs: [
        `Early stopping exists because training loss is loyal to the training set, not to the problem. A flexible model can keep finding ways to reduce the loss on examples it has already seen. At first, that means learning real structure. Later, it can mean memorizing quirks, mislabeled examples, rare coincidences, or noise. The optimizer does not know the difference. It only sees that the objective improved.`,
        `The validation curve is the outside witness. It measures whether the current weights still transfer to data held out from training. When validation loss falls with training loss, the model is learning patterns that generalize. When training loss keeps falling while validation loss rises, extra epochs are buying a better memory of the training set and a worse model for future data. Early stopping is the discipline of taking the validation curve seriously before the last epoch.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious approach is to pick a fixed number of epochs. Train for 10, 50, or 100 epochs because the run budget says so or because a previous model used that schedule. That can work when the task, data size, optimizer, and architecture are stable. The wall appears when the right stopping time changes across datasets, random seeds, augmentations, or model sizes. A fixed epoch count is a guess made before the evidence arrives.`,
        `The next obvious rule is to stop the first time validation loss gets worse. That fails because validation curves are noisy. A small validation set can wobble. Minibatch order can move the model through a slightly worse point before a better one. Learning-rate schedules can create temporary bumps. If the rule fires on one bad epoch, it may quit long before the true minimum. Early stopping needs to distinguish ordinary noise from sustained loss of generalization.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is to treat time as a capacity control. Early epochs fit broad, easy patterns because those are the directions the optimizer finds first. Later epochs can spend capacity on smaller and stranger details. Stopping early limits how far the weights travel along that path. In many models, especially linear models trained by gradient methods, this behaves like a regularizer: the model is not allowed to reach the large or highly specialized weights available later in training.`,
        `The second insight is retroactive stopping. The model may stop at epoch 30, but the model you keep can be the checkpoint from epoch 25. That distinction is essential. Patience lets training continue past the best epoch long enough to prove that the improvement has really ended. Checkpoint restoration then returns the weights from the best observed validation score, not the weights from the final allowed epoch.`,
      ],
    },
    {
      heading: `Mechanism and state`,
      paragraphs: [
        `A production early-stopping loop carries a small state machine. It stores the best validation score so far, the epoch that produced it, a copy of the corresponding weights, a counter for epochs since improvement, a patience limit, a monitored metric, and often a min_delta threshold. If the new score improves by at least min_delta, the loop saves a checkpoint and resets the counter. If not, it increments the counter. When the counter reaches patience, training halts.`,
        `The monitored metric must match the decision. Validation loss is often smoother than accuracy and gives useful signal while probabilities are still changing. Accuracy, F1, AUC, cost-weighted utility, or recall at a fixed precision may be better when that is what the system ships. The direction also matters: loss should decrease, accuracy should increase. A silent maximize/minimize mistake can make a callback stop exactly when the model gets better.`,
        `The validation split is part of the mechanism, not an afterthought. It must be held out from gradient updates and from repeated manual tuning as much as the project allows. If the validation set leaks training examples or drives too many human decisions, early stopping becomes another way to overfit the evaluation procedure.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Early stopping works when validation performance is a trustworthy proxy for future performance and when overfitting grows with additional training. The invariant is simple: keep the best model seen on held-out data. The stopping epoch may be late, but the selected weights are never worse than any earlier checkpoint according to the monitored validation metric. This does not prove the model is globally best; it proves the run did not discard its own best evidence.`,
        `The regularization effect comes from the training path. Gradient-based optimization does not jump to an arbitrary parameter vector. It moves from initialization through a sequence of models. Stopping selects one point on that path. Earlier points usually have smaller norms, smoother functions, or less specialized decision boundaries than later points. That is why early stopping can act like a time-based version of weight decay while also saving compute.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The direct cost is one validation pass per evaluation interval plus storage for the best checkpoint. If validation runs once per epoch, the method adds a predictable measurement cost. If validation is huge, teams may evaluate less often, use a fixed validation slice, or monitor a cheaper proxy first. The payoff is often negative training compute: the job stops before the planned budget is exhausted.`,
        `Patience is the main knob. Short patience reacts quickly but can fire on noise. Long patience is safer but spends more epochs after the best point. min_delta prevents tiny floating-point or sampling wiggles from resetting the counter forever. Evaluation frequency changes the meaning of patience: five checks per epoch and five epochs are not the same patience budget.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Early stopping is a good default for small and medium supervised learning runs, fine-tuning jobs, tabular models, computer vision models, and any project where training can continue long after validation quality peaks. It is especially useful when the correct epoch budget is unknown and the cost of an extra validation pass is small compared with the cost of wasted training.`,
        `The same idea appears in hyperparameter search. Successive halving, Hyperband, and many practical sweep systems abandon configurations whose intermediate validation evidence is poor. The scale is different, but the principle is the same: compute should keep flowing toward candidates that still have evidence of improvement. Early stopping is that resource-allocation rule applied inside one training run.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Early stopping fails when the validation signal is bad. A tiny validation set can be too noisy. A validation set drawn from the wrong distribution can reward the wrong model. Leakage can make every epoch look better than it should. If the monitored metric is not aligned with the deployed objective, early stopping faithfully selects the wrong thing.`,
        `It also fails as a complete regularization strategy when the model overfits before the first useful validation checkpoint, when the model is so underpowered that it never fits the training set, or when the learning curve has multiple valleys. Large models can show nonmonotonic behavior, including a first validation dip followed by later recovery. In those cases, patience and learning-rate schedule design matter, and a single short run may not reveal the best stopping policy.`,
      ],
    },
    {
      heading: `Evaluation signals`,
      paragraphs: [
        `Record both the stopping epoch and the restored checkpoint epoch. They answer different questions. The stopping epoch tells you how much patience was spent. The restored epoch tells you which weights were selected. A comparison table that reports only the final epoch can make a model look worse or better than it actually was.`,
        `Inspect the full learning curve, not only the selected metric. A healthy early-stopping run often shows training loss continuing down while validation loss flattens or rises. If both curves are high, the model underfits. If validation improves erratically, the split may be too small or the learning rate too high. If validation is perfect from the start, check for leakage before celebrating.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Cross-Validation & Honest Evaluation to understand the held-out signal that early stopping depends on. Study Learning Curves & Bias-Variance to diagnose train-validation gaps. Regularization: L1 & L2 explains explicit penalties that complement time-based regularization. Learning-Rate Schedules & Warmup explains why the path to the validation minimum changes when the optimizer changes. Hyperparameter Search shows how the same evidence rule allocates compute across many runs.`,
      ],
    },
  ],
};
