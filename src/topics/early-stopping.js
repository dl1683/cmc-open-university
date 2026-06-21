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
    explanation: `The turn, caught: validation bottoms at epoch ${BEST_EPOCH} (loss ${valLoss(BEST_EPOCH).toFixed(2)}) and climbs from there — by epoch 40 it has given back ${(valLoss(40) - valLoss(BEST_EPOCH)).toFixed(2)} while training loss kept "improving." Every epoch past the turn makes the model objectively worse at its actual job, while every dashboard the optimizer sees says things are going great. EARLY STOPPING is the two-line discipline that takes the validation curve\'s side: track the best validation score; when training ends, hand back the weights from THAT epoch — not the last one.`,
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
    explanation: 'The price list explains why early stopping is the first regularizer every practitioner enables: it is the only row with NEGATIVE cost — it returns compute — and its knob is forgiving (patience of 5 vs 10 rarely changes the outcome much, unlike a 10Ã— λ mistake). One caveat for the modern era: epoch-wise DOUBLE DESCENT (the Loss Landscapes companion result) means very large models occasionally dip, rise, and dip AGAIN — a patience set too short banks the first minimum and misses the second. For most models most of the time, stop at the turn; for giant ones, know the exception exists.',
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
    { e: 30, best: valLoss(25), ctr: 5, note: 'counter 5/5 â†’ STOP, restore epoch 25' },
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation plots two loss curves across 40 training epochs. The blue curve is training loss: it falls monotonically because the optimizer is paid to reduce it. The orange curve is validation loss: it falls, bottoms out, and climbs back up. The marker labeled "the turn" pins the epoch where validation was lowest. Everything after that marker is wasted compute that makes the model worse at its actual job.',
        {type: 'callout', text: 'Early stopping regularizes by selecting the best held-out checkpoint, not the last checkpoint the optimizer happened to reach.'},
        'In the patience view, red markers flag noise blips -- epochs where validation jumped briefly before resuming its descent. The matrix walks the patience counter through these exact epochs, showing when the counter ticks, when it resets, and when it finally fires. "Found" highlights mark the checkpoint the system keeps. "Removed" highlights mark the stop event. Watch the counter forgive noise and still catch the real turn.',
        {
          type: 'diagram',
          text: 'loss\n  |  \\                        ___--- val loss (overfitting)\n  |   \\    ___----------___--\n  |    \\  /\n  |     \\/  <-- the turn (best val epoch)\n  |      \\\n  |       \\___\n  |           \\____          train loss (always falling)\n  |                \\______\n  +-----------------------------------> epoch',
          label: 'Train vs validation loss: the curves diverge at the turn',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Training loss is loyal to the training set, not to the problem. A flexible model can keep reducing its loss on seen examples indefinitely -- first by learning real patterns, then by memorizing noise, mislabeled points, and rare coincidences. The optimizer cannot tell the difference. It only knows the objective went down.',
        'The validation curve is the outside witness. It measures whether current weights transfer to data the optimizer never touched. When training loss falls while validation loss rises, extra epochs buy a better memory of the training set and a worse model for future data. Early stopping is the discipline of believing the validation curve before the last epoch.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Overfitting_svg.svg/330px-Overfitting_svg.svg.png', alt: 'Training error falling while validation error bottoms out and rises', caption: 'The validation minimum is the decision point: training can keep improving while generalization gets worse. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Overfitting_svg.svg.'},
        {
          type: 'quote',
          text: 'The question is not whether to stop early, but how to define the right moment. A network that trains too long will overfit; one that trains too briefly will underfit. The practical problem is that the optimum is unknown in advance and noisy to estimate.',
          attribution: 'Lutz Prechelt, "Early Stopping -- But When?", 1998',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is to pick a fixed epoch budget. Train for 50 or 100 epochs because a previous model used that schedule or because the compute budget says so. This works when the task, dataset size, optimizer, and architecture are all stable -- the optimal stopping epoch does not move much between runs.',
        'The second reasonable attempt is a tripwire: stop the first time validation loss increases. That is closer to the right idea but fragile in practice. Validation curves wobble. A small held-out set can spike from minibatch noise. Learning-rate warmup can create temporary bumps. A rule that fires on one bad epoch quits long before the true minimum, potentially with triple the loss of the best reachable model.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fixed-budget approach fails because the right stopping epoch changes across datasets, random seeds, augmentation strategies, and model sizes. A budget chosen before training starts is a guess made before the evidence arrives. Too short and the model underfits; too long and it memorizes.',
        'The tripwire approach fails because it cannot distinguish one noisy epoch from the onset of overfitting. In the animation, validation spikes at epoch 9 and again at epoch 15 -- both are noise, and the true minimum is still 16 epochs away. Any rule that reacts to a single uptick is a false-alarm machine.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Pyplot_overfitting.png/330px-Pyplot_overfitting.png', alt: 'Noisy data fit by both a simple line and an overflexible curve', caption: 'Overflexible training can fit the seen points while damaging extrapolation, which is the failure early stopping is trying to catch. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Pyplot_overfitting.png.'},
        {
          type: 'table',
          headers: ['Stopping method', 'Mechanism', 'Failure mode'],
          rows: [
            ['Fixed epoch count', 'Train for N epochs regardless of evidence', 'Optimal epoch varies per run; guess is stale'],
            ['First-increase tripwire', 'Stop when val loss rises once', 'Fires on noise; quits far from the true minimum'],
            ['Threshold-based', 'Stop when val loss < target', 'Requires knowing the achievable loss in advance'],
            ['Patience-based', 'Stop after k epochs without improvement', 'Trades k extra epochs for noise immunity'],
          ],
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A patience-based early stopping loop carries a small state machine: the best validation score seen so far, the epoch that produced it, a checkpoint of those weights, a counter of epochs since the last improvement, a patience limit k, and a min_delta threshold. Each epoch, if validation improves by at least min_delta, the loop saves a new checkpoint and resets the counter to zero. If not, it increments the counter. When the counter reaches k, training halts and the checkpoint weights are restored.',
        {
          type: 'code',
          language: 'python',
          text: 'best_val = float("inf")\nbest_weights = None\nwait = 0\npatience = 5\nmin_delta = 1e-4\n\nfor epoch in range(max_epochs):\n    train_one_epoch(model, train_loader)\n    val_loss = evaluate(model, val_loader)\n\n    if val_loss < best_val - min_delta:\n        best_val = val_loss\n        best_weights = copy.deepcopy(model.state_dict())\n        wait = 0\n    else:\n        wait += 1\n        if wait >= patience:\n            break\n\nmodel.load_state_dict(best_weights)  # restore the best',
        },
        'The monitored metric must match the decision. Validation loss is smooth and gives signal while probabilities are still shifting. But if the system ships accuracy, F1, or cost-weighted utility, monitor that instead. Direction matters: loss should decrease, accuracy should increase. A silent maximize/minimize mix-up makes the callback stop exactly when the model improves.',
        'The validation split is part of the mechanism. It must be held out from gradient updates and from repeated manual tuning. If the validation set leaks training examples or drives too many human decisions, early stopping becomes another way to overfit the evaluation procedure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is simple: keep the best model seen on held-out data. The stopping epoch may be late (patience overshoots by k), but the selected weights are never worse than any earlier checkpoint on the monitored metric. The run does not discard its own best evidence.',
        'The deeper reason is implicit regularization. Gradient-based training starts from small random weights and grows the weight norm with each epoch. Stopping at epoch t caps how large the weights ever get -- the model never acquires the huge, confident, contortion-capable weights that overfitting requires. For linear models trained by gradient descent, this is a theorem: early stopping along the gradient path is mathematically equivalent to L2 regularization with a penalty lambda that shrinks as training lengthens. Same leash, different handle.',
        {
          type: 'note',
          text: 'The equivalence between early stopping and L2 regularization was formalized by Ali, Dobriban, and Tibshirani (2019) and earlier by Bishop (1995). For nonlinear networks the equivalence is approximate, but the directional effect -- shorter training path means smaller effective model capacity -- holds empirically across architectures.',
        },
        'This connects directly to the bias-variance tradeoff. Early epochs fit broad, high-bias patterns (underfitting). Later epochs reduce bias by fitting finer details, but variance grows as the model specializes to training noise. The validation minimum sits at the bias-variance crossing. Early stopping selects that crossing point automatically, without requiring a hand-tuned lambda.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The direct cost is one validation pass per evaluation interval plus storage for one checkpoint. If validation runs once per epoch on a dataset one-fifth the size of training, the overhead is roughly 20% per epoch. The payoff is often negative net compute: the job stops before the planned budget is exhausted. Early stopping is the only regularizer that returns compute.',
        {
          type: 'table',
          headers: ['Regularizer', 'Extra compute cost', 'Knob to tune', 'Forgiveness'],
          rows: [
            ['L2 / weight decay', 'Near zero (one multiply per param)', 'lambda -- sensitive to scale', 'Low: 10x lambda mistake changes the model'],
            ['Dropout', 'Slower convergence (~1.2-2x epochs)', 'Drop rate p', 'Moderate: 0.3 vs 0.5 is usually survivable'],
            ['More data', 'Linear in dataset size', 'None (if available)', 'High, but expensive to collect'],
            ['Early stopping', 'NEGATIVE -- saves unrun epochs', 'Patience k', 'High: k=5 vs k=10 rarely changes outcome'],
          ],
        },
        'Patience is the main knob. Short patience (3-5) reacts quickly but can fire on noise. Long patience (10-20) is safer but spends more epochs past the best point. min_delta prevents floating-point jitter from resetting the counter forever. Evaluation frequency changes the meaning of patience: checking five times per epoch with patience 5 is one epoch of insurance, not five.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Early stopping is the right default for supervised learning runs where the optimal epoch count is unknown: fine-tuning pretrained models, tabular gradient boosting (XGBoost and LightGBM both have built-in early stopping rounds), computer vision training, and any project where training can continue long after validation peaks. It is especially effective when the cost of one extra validation pass is small compared with the cost of wasted training epochs.',
        'The same principle scales beyond a single run. Successive halving, Hyperband, and practical sweep systems abandon configurations whose intermediate validation evidence is poor. Early stopping is that resource-allocation rule applied inside one training run; Hyperband is the same rule applied across many runs. The instinct -- stop funding work the evidence has stopped supporting -- is most of what "compute-efficient ML" means.',
        'In production, early stopping also serves as a safety net. A training job launched overnight with a generous max_epochs will self-terminate at the right time, checkpoint the best weights, and free the GPU. Without it, the job either runs to completion (wasting hours) or requires a human to watch the curve.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Early stopping fails when the validation signal is unreliable. A tiny validation set is too noisy to reveal a clean minimum. A validation set drawn from the wrong distribution rewards the wrong model. Leakage between train and validation makes every epoch look better than it should. If the monitored metric is misaligned with the deployed objective, early stopping faithfully selects the wrong thing.',
        'It also fails when the learning curve is nonmonotonic after the first dip. Large overparameterized models can exhibit epoch-wise double descent: validation loss dips, rises, and dips again to a lower value. A patience window set too short banks the first minimum and misses the second. For most models most of the time, stop at the turn; for very large ones, know the exception exists and consider longer patience or learning-rate restarts.',
        'Finally, early stopping is not a complete regularization strategy on its own. If the model overfits before the first validation checkpoint, there is nothing to stop. If the model is so underpowered that it never fits the training set, the validation curve never turns -- early stopping has nothing to do. It complements explicit regularizers (L2, dropout, data augmentation) rather than replacing them.',
        {
          type: 'bullets',
          items: [
            'Tiny validation set: noise dominates the signal; the "best" epoch is random.',
            'Distribution mismatch: validation rewards a model that performs well on the wrong task.',
            'Double descent: a short patience window misses a second, deeper valley.',
            'Metric mismatch: monitoring loss while shipping accuracy (or vice versa) selects the wrong tradeoff.',
            'restore_best_weights=False: several frameworks historically defaulted this to False, so the callback stops late AND keeps the worst weights.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Prechelt, "Early Stopping -- But When?" (1998) -- the foundational patience-based framework and the source of practical guidelines still used today.',
            'Bishop, "Neural Networks for Pattern Recognition" (1995), Section 9.2 -- formalizes the connection between early stopping and L2 regularization for linear models.',
            'Ali, Dobriban, Tibshirani, "The Implicit Regularization of Ordinary Least Squares Ensembles" (2019) -- tightens the early-stopping/L2 equivalence with modern tools.',
            'Goodfellow, Bengio, Courville, "Deep Learning" (2016), Section 7.8 -- textbook treatment of early stopping as regularization.',
          ],
        },
        'Prerequisite: study Cross-Validation and Honest Evaluation to understand the held-out signal early stopping depends on. Study Learning Curves and Bias-Variance to diagnose train-validation gaps and know which side of the tradeoff you are on. Extension: Regularization (L1 and L2) explains the explicit penalty that early stopping approximates implicitly. Learning-Rate Schedules and Warmup shows how the optimizer changes the path to the validation minimum. Hyperparameter Search (Successive Halving, Hyperband) generalizes the same evidence rule across a fleet of configurations.',
      ],
    },
  ],
};
