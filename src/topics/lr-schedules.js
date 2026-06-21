// Learning-rate schedules: one constant step size must choose between
// covering ground and settling down — so don't make it constant. Warmup,
// decay, cosine: the dial that turns "explore" into "settle" over time.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lr-schedules',
  title: 'Learning-Rate Schedules & Warmup',
  category: 'AI & ML',
  summary: 'Big steps to cover ground, small steps to settle — schedules turn one impossible constant into a dial over time.',
  controls: [
    { id: 'view', label: 'Tune', type: 'select', options: ['why one constant fails', 'the schedule zoo & warmup'], defaultValue: 'why one constant fails' },
  ],
  run,
};

// The honest test bench: loss = w²/2, gradient = w, start at w = 10.
// One GD step multiplies w by (1 âˆ’ lr): the whole story is in that factor.
function descend(lrAt, steps) {
  let w = 10;
  const path = [{ x: 0, y: Math.abs(w) }];
  for (let t = 0; t < steps; t++) {
    w -= lrAt(t) * w;
    path.push({ x: t + 1, y: Math.abs(w) });
  }
  return path;
}

function* constantFails() {
  yield {
    state: plotState({
      axes: { x: { label: 'step' }, y: { label: '|w| — distance from optimum' } },
      series: [
        { id: 'big', label: 'lr = 1.9 (bold)', points: descend(() => 1.9, 30) },
        { id: 'small', label: 'lr = 0.05 (timid)', points: descend(() => 0.05, 30) },
      ],
    }),
    highlight: { compare: ['big', 'small'] },
    explanation: 'The test bench: a clean bowl, loss = w²/2, start at w = 10; each gradient-descent step multiplies the distance by |1 âˆ’ lr|, so everything about convergence lives in one number. Run the two constant temperaments: BOLD (lr = 1.9) overshoots the minimum every single step — it lands on the other wall, shrinking by only Ã—0.9 per step while ricocheting; TIMID (lr = 0.05) never overshoots and never hurries, Ã—0.95 per step. Thirty steps later neither has truly arrived. On real, noisy, non-convex terrain (Loss Landscapes), the bold one also cannot SETTLE — it bounces around the basin floor forever at a "noise floor" set by its own step size.',
    invariant: 'On the bowl, each step scales the error by |1 âˆ’ lr|: too big ricochets, too small crawls.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'step' }, y: { label: '|w| — distance from optimum' } },
      series: [
        { id: 'big', label: 'lr = 1.9', points: descend(() => 1.9, 30) },
        { id: 'small', label: 'lr = 0.05', points: descend(() => 0.05, 30) },
        { id: 'sched', label: 'scheduled: 1.5 â†’ 0.05', points: descend((t) => Math.max(1.5 * 0.85 ** t, 0.05), 30) },
      ],
    }),
    highlight: { visited: ['big', 'small'], found: ['sched'] },
    explanation: 'Now refuse the dilemma: START bold, FINISH timid. The scheduled run opens at lr = 1.5 — early steps slash the distance by half each time — and decays toward 0.05 as it nears the floor, where small careful steps finish the job. It reaches in ten steps what neither constant achieves in thirty, because the right learning rate is not a NUMBER, it is a PHASE: far from the optimum you want speed and (on real terrain) basin-hopping noise; near it you want to stop rattling and sink. A schedule is just that sentence, written as a function of the step count.',
  };

  yield {
    state: matrixState({
      title: 'The two phases of every training run',
      rows: [{ id: 'early', label: 'early training' }, { id: 'late', label: 'late training' }],
      columns: [{ id: 'where', label: 'where you are' }, { id: 'want', label: 'what you want' }, { id: 'lr', label: 'so lr should be' }],
      values: [[1, 2, 3], [4, 5, 6]],
      format: (v) => ['', 'far from any minimum', 'speed + exploration noise', 'LARGE', 'inside a good basin', 'settle deep, stop rattling', 'small'][v],
    }),
    highlight: { compare: ['early:lr', 'late:lr'] },
    explanation: 'The phase table — and a connection worth keeping: the large-lr phase is not merely fast, it is SELECTIVE. Big noisy steps cannot rest in the narrow, sharp minima that generalize poorly (the flatness filter from Loss Landscapes); they bounce out and keep moving until a basin is wide enough to hold them. Decay the rate too early and you rob training of that filtering; too late and you never consolidate. Which is why the SHAPE of the decay became its own little zoology — the other view tours the zoo.',
  };
}

function* zoo() {
  const T = 100;
  const warm = 10;
  const cosine = (t) => 0.5 * (1 + Math.cos((Math.PI * t) / T));
  yield {
    state: plotState({
      axes: { x: { label: 'training step' }, y: { label: 'learning rate (Ã— peak)' } },
      series: [
        { id: 'step', label: 'step decay', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: t < 40 ? 1 : t < 70 ? 0.316 : 0.1 })) },
        { id: 'cos', label: 'cosine annealing', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: cosine(t) })) },
        { id: 'warmcos', label: 'warmup + cosine', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: t < warm ? t / warm : cosine(((t - warm) / (T - warm)) * T) })) },
      ],
    }),
    highlight: { active: ['warmcos'], visited: ['step', 'cos'] },
    explanation: 'The zoo\'s three headliners, drawn as lr-versus-time. STEP DECAY: hold, then cut by ~3Ã— at milestones — the classic that trained a decade of vision models; brutally effective, knees chosen by hand. COSINE ANNEALING: one smooth half-cosine from peak to zero — no milestones to tune, gentle start, gentle landing; the modern default. And the third curve adds the ramp at the front — WARMUP — which has the most interesting justification of the three, because it exists to protect a specific piece of machinery you have already studied.',
  };

  yield {
    state: matrixState({
      title: 'Why warmup: Adam\'s first steps are built on rumors',
      rows: [
        { id: 't1', label: 'step 1' },
        { id: 't5', label: 'step 5' },
        { id: 't100', label: 'step 100' },
      ],
      columns: [{ id: 'samples', label: 'gradients seen' }, { id: 'trust', label: 'v (variance estimate) is…' }, { id: 'risk', label: 'full-size step would…' }],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      format: (v) => ['', '1', 'one sample — a rumor', 'amplify a fluke hugely', '5', 'still mostly noise', 'wobble dangerously', '~100', 'a real statistic', 'be safe at full size'][v],
    }),
    highlight: { removed: ['t1:risk'], found: ['t100:risk'] },
    explanation: 'Recall Adam\'s second moment v — the per-weight EMA of squared gradients that DIVIDES every step. Bias correction fixes its average, but at step 1 that average is computed from ONE sample: a coordinate that happened to draw a tiny first gradient gets a tiny âˆšvÌ‚ and therefore an enormous step — a fluke, amplified. A few such steps can throw a fresh network into a bad region it spends the whole run recovering from (the loss spikes that haunt LLM training logs). WARMUP is the fix-by-humility: ramp lr from 0 to peak over the first few hundred steps, keeping strides short until v has seen enough gradients to be a statistic instead of a rumor. Essentially every transformer you have used was trained with linear warmup â†’ cosine decay.',
    invariant: 'Adaptive denominators need samples to be trustworthy; warmup keeps steps small until they are.',
  };

  const rangeTest = Array.from({ length: 41 }, (_, i) => {
    const lr = 10 ** (-4 + i * 0.1);
    const loss = lr < 0.003 ? 2.3 - 2 * (Math.log10(lr) + 4) * 0.06 : lr < 0.3 ? 1.9 - 0.55 * (Math.log10(lr) + 2.5) : 0.92 + (Math.log10(lr) + 0.5) ** 2 * 6;
    return { x: Math.log10(lr) + 4, y: loss };
  });
  yield {
    state: plotState({
      axes: { x: { label: 'learning rate, swept upward (log scale)' }, y: { label: 'training loss during the sweep' } },
      series: [{ id: 'sweep', label: 'LR range test', points: rangeTest }],
      markers: [
        { id: 'flat', x: 0.5, y: 2.27, label: 'too small: flat' },
        { id: 'sweet', x: 3.2, y: 0.95, label: 'steepest descent' },
        { id: 'boom', x: 3.9, y: 1.9, label: 'explodes' },
      ],
    }),
    highlight: { found: ['sweet'], removed: ['boom'], visited: ['flat'] },
    explanation: 'And how do you pick the PEAK the schedule decays from? Stop guessing: run the LR RANGE TEST (Leslie Smith) — one short training run while the learning rate sweeps exponentially upward, plotting loss as it goes. The curve tells the whole story: flat on the left (too small to learn anything), a steep productive slope in the middle, then the explosion. Pick the peak just below where the loss bottoms out — here around lr â‰ˆ 0.05 — and hand it to your cosine schedule. Five minutes of compute replaces a folk ritual; it is the closest thing hyperparameter choice has to a free lunch (and it composes with Hyperparameter Search for everything else).',
  };

  yield {
    state: matrixState({
      title: 'Which schedule, where',
      rows: [
        { id: 'warmcos', label: 'warmup + cosine' },
        { id: 'stepdec', label: 'step decay' },
        { id: 'plateau', label: 'reduce-on-plateau' },
        { id: 'onecycle', label: 'one-cycle' },
      ],
      columns: [{ id: 'home', label: 'natural home' }, { id: 'why', label: 'because' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8]],
      format: (v) => ['', 'transformers / LLMs', 'protects Adam early, lands softly', 'classic CNN recipes', 'simple, battle-tested milestones', 'the lazy-but-sound default', 'reacts to the validation curve itself', 'fast single runs', 'up-then-down squeezes max from few epochs'][v],
    }),
    highlight: { active: ['warmcos:home'], compare: ['plateau:why'] },
    explanation: 'The field guide. Note the third row\'s philosophy difference: reduce-on-plateau doesn\'t pre-plan anything — it watches validation loss (the honest signal, per Cross-Validation) and cuts the rate 10Ã— whenever progress stalls; slower than a tuned cosine but nearly impossible to misconfigure. The unifying picture to leave with: the optimizer chooses the step DIRECTION, the schedule chooses the step AMBITION, and ambition should track certainty — low while estimates are rumors (warmup), high while exploring, low again while settling. The same explore-then-commit arc as Thompson Sampling, played against a loss landscape instead of slot machines.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'why one constant fails') yield* constantFails();
  else if (view === 'the schedule zoo & warmup') yield* zoo();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view ("why one constant fails") runs gradient descent on a quadratic bowl, loss = w^2/2, starting at w = 10. The y-axis is |w|, the distance from the optimum. Two constant learning rates race: the bold one (lr = 1.9) ricochets through the minimum every step, shrinking by only 0.9x per step while oscillating. The timid one (lr = 0.05) creeps at 0.95x per step without overshooting. A third curve starts bold and decays, beating both. When the scheduled curve appears, watch how fast it closes the gap compared to either constant.',
        {type: 'callout', text: 'A schedule is step-size policy: high ambition while searching, low ambition while settling, and warmup while statistics are still thin.'},
        'The second view ("the schedule zoo") plots learning rate as a fraction of peak over training steps. Three shapes overlay: step decay (flat plateaus with sharp drops), cosine annealing (a smooth half-cosine), and warmup + cosine (a linear ramp followed by the cosine). The warmup table shows why full-size early steps are dangerous when Adam\'s variance denominator is built from a single gradient sample. The LR range test sweeps the rate upward and plots loss, showing how to find the peak rate from data instead of guessing.',
        'At each frame, ask: which training phase is this step in, and what would break if the rate were frozen at its current value for the rest of the run?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Gradient descent subtracts lr * gradient from each weight. The learning rate sets the step size. Too large: the step overshoots the minimum and oscillates. Too small: the step barely moves, burning compute on negligible corrections. A fixed rate forces one compromise for the entire run, but training has two distinct phases with opposite needs.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Gradient_descent.svg/250px-Gradient_descent.svg.png', alt: 'Gradient descent path moving through contour lines toward a minimum', caption: 'Learning rate controls how far each downhill step travels through the contour map. Source: Wikimedia Commons, Gradient descent illustration.'},
        'Early on, parameters are far from any useful basin. Large steps cover ground and generate enough noise to escape sharp, narrow minima that generalize poorly. Late in training, the model sits inside a good basin. The same large step bounces off the basin walls, and loss plateaus at a noise floor set by the step size itself. The model cannot improve because its own strides keep knocking it away from the minimum.',
        'A learning-rate schedule changes the rate over time: large early, small late, with optional warmup and restarts. It converts an impossible single-number choice into a policy that matches step size to training phase.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Pick one learning rate and hold it constant. Grid-search over candidates (lr = 0.1, 0.01, 0.001), keep the one with the best final loss. This works for small problems where training is cheap and the landscape is simple.',
        'The approach is not stupid. On a convex surface with one basin, any stable constant rate converges given enough steps. Practitioners used constant rates for years and still do for quick experiments. The question is not whether a constant works but whether it wastes compute by spending every step at the wrong ambition level.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A fixed rate must satisfy two contradictory demands at once. On the quadratic bowl (loss = w^2/2), each step multiplies distance from the optimum by |1 - lr|. Rate 1.9 gives factor 0.9: it converges, but ricochets through the minimum every step. Rate 0.05 gives factor 0.95: stable but glacial. After 30 steps the bold rate leaves |w| near 0.4 (via 10 * 0.9^30) and the timid rate leaves |w| near 2.1 (via 10 * 0.95^30). Neither is close to zero because neither rate suits both phases.',
        'Grid-searching constants picks the least-bad single value. It cannot express "be bold now, be careful later" because a constant is one number, not a function of time.',
        'The wall sharpens with Adam. Adam divides each update by sqrt(v_hat), an exponential moving average of squared gradients. At step 1, that average is built from one sample. Bias correction rescales the mean but cannot make one observation reliable. A parameter whose first gradient happens to be small gets a tiny denominator and an enormous corrected step. At full learning rate, a few such flukes throw a fresh network into a bad region it spends the whole run recovering from. These are the early loss spikes visible in LLM training logs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The right learning rate is not a number. It is a phase. Far from the optimum you want speed and exploration noise. Near the optimum you want precision. Before optimizer statistics are trustworthy you want caution. A schedule encodes these three regimes as a function of step count.',
        'On the bowl, convergence factors multiply. When lr(t) is large early, each factor |1 - lr(t)| is small, and distance shrinks fast. As lr(t) decays, later factors approach 1: less speed, but zero overshoot. The cumulative product is smaller than any single constant achieves in the same number of steps.',
        'Large rates also act as implicit regularizers. On real, non-convex surfaces, big noisy steps cannot rest in narrow sharp minima. They bounce out and keep moving until a basin is wide enough to hold them. This flatness filter connects schedules to generalization: the high-rate phase selects for flat minima, and the decay phase consolidates inside them.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step decay holds a constant rate, then cuts it by a factor (typically 3-10x) at hand-chosen milestones. ResNet training classically drops lr by 10x at epochs 30 and 60 of 90. Performance depends on choosing the right milestones, and shifting them by a few epochs changes the result. But it trained a decade of vision models because milestones are easy to copy from published recipes.',
        'Cosine annealing (Loshchilov & Hutter, 2017) follows the formula: lr(t) = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * t / T)), where T is total steps. The curve is smooth and parameter-free beyond the endpoints. It is front-loaded: at 25% of training the rate has dropped only about 15%, spending most of the budget at high ambition. By 75% it is down to 15% of peak. The final quarter is a long settling phase. This is the modern default for transformers.',
        'Linear warmup (Goyal et al., 2017) ramps the rate from near zero to peak over the first k steps: lr(t) = lr_max * (t / k) for t < k. The purpose is to protect Adam\'s variance estimates. At step 1, the per-parameter denominator sqrt(v_hat) is based on one gradient sample. A full-size step divided by a noisy denominator can be enormous. Warmup keeps the global multiplier small until the adaptive statistics have seen enough gradients to be trustworthy. Essentially every transformer trains with linear warmup into cosine decay.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation bands highlighted', caption: 'Warmup is a variance-control move: early optimizer statistics are noisy, so the global step stays small while estimates stabilize. Source: Wikimedia Commons, M. W. Toews, public domain.'},
        'Cosine annealing with warm restarts, or SGDR (Loshchilov & Hutter, 2017), resets the rate to peak after each cosine cycle, with cycle lengths that double (e.g. 10, 20, 40 epochs). Each restart lets the optimizer escape shallow local minima. Snapshots taken at each cycle\'s minimum make good checkpoints; ensembling them gives a free accuracy boost (Huang et al. 2017).',
        'One-cycle policy (Smith, 2018) ramps the rate up from a low value to a peak over roughly 30% of training, then decays back down over the remaining 70%. The upward phase serves as both warmup and an aggressive exploration sweep. Smith showed this often trains faster than monotone schedules, squeezing strong performance from short budgets. The rising phase lets SGD explore broadly before committing; the decay phase consolidates.',
        'Reduce-on-plateau watches validation loss and cuts the rate (typically by 10x) whenever progress stalls for a patience window. It makes no assumptions about training length or milestone timing. Slower than a tuned cosine but nearly impossible to misconfigure, making it natural for fine-tuning and smaller experiments.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is phase separation. A schedule partitions training into regimes matched to the optimizer\'s needs and transitions smoothly enough that no single step wastes the progress accumulated before it.',
        'On the quadratic bowl, the argument is multiplicative. After T steps the distance from the optimum is 10 * product(|1 - lr(t)|) for t = 0 to T-1. Large lr(t) early makes those factors small, shrinking distance fast. As lr(t) decays, later factors approach 1, contributing no speed but no overshoot. The total product is smaller than any constant achieves in the same steps because the constant must keep every factor identical.',
        'For warmup the argument is statistical. Adam\'s effective step for parameter i is lr * m_hat_i / sqrt(v_hat_i). The variance of v_hat_i decreases as 1/t_eff, where t_eff is the effective sample count. Warmup keeps lr small while t_eff is small, so the product lr / sqrt(v_hat_i) stays bounded even when individual denominators are unreliable. Once enough gradients have been observed, the denominators are trustworthy and the full rate is safe.',
        'For cosine annealing the argument is smoothness. Abrupt rate changes (as in step decay) create transient instability: the optimizer suddenly has different dynamics and may overshoot before settling. Cosine decay is continuous, so the optimizer adjusts gradually. The front-loaded shape spends more compute at high rates, which is efficient because early steps make the largest per-step progress.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computing the rate at each step costs nothing: one scalar from a closed-form expression. There is zero extra computation compared to a constant rate. The real cost is recipe design. A full schedule requires choosing warmup length, peak rate, decay shape, minimum rate, and total steps. These interact with batch size, optimizer, model depth, normalization, and gradient clipping. Changing batch size without adjusting the schedule silently shifts the effective optimization regime.',
        'Often, tuning the schedule matters more than tuning the architecture. A good schedule on a mediocre model frequently beats a bad schedule on a better model, because the schedule determines whether the optimizer actually reaches a good minimum.',
        'Schedules trade responsiveness against predictability. A cosine schedule is deterministic and reproducible but cannot react if validation stalls early. Reduce-on-plateau adapts to the run\'s behavior but adds patience windows and conditional logic. Large-scale pipelines prefer deterministic schedules because they are easier to plan, checkpoint, and debug across restarts.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Transformer pretraining and LLM training use linear warmup plus cosine decay as the standard recipe. GPT, BERT, LLaMA, and essentially all large language models use this combination because it protects Adam\'s early statistics and gives a smooth landing over hundreds of billions of tokens.',
        'Fine-tuning pretrained models typically uses linear decay or reduce-on-plateau with a small peak rate. The model is already in a good basin; the schedule\'s job is to nudge it without leaving.',
        'One-cycle policy achieves super-convergence on short training budgets. Smith showed it reaches competitive accuracy in fewer passes through the data, making it natural for rapid prototyping where compute is limited.',
        'Step decay trained the ImageNet generation of CNNs: AlexNet, VGG, ResNet. The milestones (drop lr by 10x at epochs 30 and 60) were tuned once and reused across architectures. The method persists wherever published recipes specify exact milestones.',
        'Warm restarts (SGDR) are used when the training landscape has many local minima worth visiting. Each restart lets the optimizer escape and explore a new basin; snapshots at cycle minimums can be ensembled for a free accuracy boost.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A schedule is not an optimizer. It cannot fix wrong gradients, bad labels, data leakage, or broken normalization. If the peak rate is 10x too high, a beautiful cosine curve still diverges.',
        'Schedules add hyperparameters: warmup steps, decay rate, minimum LR, restart period. Each interacts with batch size, model depth, and optimizer settings. The wrong schedule can perform worse than a well-chosen constant rate.',
        'Copying a schedule from a different scale is a common failure mode. A warmup length tuned for a 175B-parameter model on 300B tokens does not transfer to a 7B model on 1T tokens. Batch size, model depth, normalization strategy, and hardware precision all change the safe step size. A borrowed schedule is a hypothesis, not a law.',
        'Hyperparameter transfer between scales is non-trivial. The linear scaling rule (scale lr proportionally to batch size) is an approximation that breaks for very large batches. Schedule transfer requires experimentation, not arithmetic.',
        'Schedule tuning can become its own form of overfitting. If you try 20 warmup lengths and pick the best validation score, you are optimizing the schedule on the validation set. Treat schedule choice as a single hyperparameter decision, not a search over dozens of variants.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: 100-epoch training run on the quadratic bowl (loss = w^2/2), starting at w = 10. Peak learning rate lr_max = 0.1. We use 5 epochs of linear warmup followed by cosine decay to lr_min = 0.001 (0.01x the initial rate).',
        'The cosine annealing formula: lr(t) = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * t / T)). With lr_max = 0.1, lr_min = 0.001, and T = 95 (the post-warmup epochs):',
        'Epoch 0: warmup phase, lr = 0.1 * (0/5) = 0.0. Epoch 1: lr = 0.02. Epoch 3: lr = 0.06. Epoch 5: warmup complete, lr = 0.1 (peak). The ramp keeps early steps small, protecting against noisy Adam denominators on a real network.',
        'Epoch 25 (20 steps into cosine): lr = 0.001 + 0.0495 * (1 + cos(pi * 20/95)) = 0.082. Still near peak, spending most compute at high ambition.',
        'Epoch 50 (45 steps into cosine): lr = 0.001 + 0.0495 * (1 + cos(pi * 45/95)) = 0.044. Half the peak rate. The model is inside a good basin and steps are shrinking to avoid rattling off the walls.',
        'Epoch 75 (70 steps into cosine): lr = 0.001 + 0.0495 * (1 + cos(pi * 70/95)) = 0.010. Down to 10% of peak. Fine adjustments only.',
        'Epoch 100 (95 steps into cosine): lr = 0.001 + 0.0495 * (1 + cos(pi)) = 0.001. The minimum rate. Final settling. On the bowl, the scheduled run reaches |w| < 0.0001 in 100 steps, which no single constant rate achieves in the same budget.',
        'Contrast with a constant lr = 0.1 for 100 steps: |w| = 10 * 0.9^100 = 0.00027. Similar, but the schedule gets there faster in the middle epochs and settles more precisely at the end. On real, noisy, non-convex surfaces the difference is dramatic because the schedule also prevents late-training oscillation that a constant rate cannot avoid.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Loshchilov & Hutter 2017, "SGDR: Stochastic Gradient Descent with Warm Restarts" --- cosine annealing and warm restarts. Goyal et al. 2017, "Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour" --- linear warmup and the batch-size scaling rule. Smith 2018, "A Disciplined Approach to Neural Network Hyper-Parameters" --- one-cycle policy and the LR range test. Smith & Topin 2019, "Super-Convergence" --- super-convergence via one-cycle at large learning rates. Huang et al. 2017, "Snapshot Ensembles: Train 1, Get M for Free" --- ensembling from warm-restart snapshots.',
        'Prerequisite: Gradient Descent --- the base update rule that the learning rate scales; without understanding the gradient step, the schedule is just a curve. Extension: Adam Optimizer --- adds per-parameter adaptive rates on top of the global schedule, making warmup critical because Adam\'s denominators need samples to stabilize. Interaction: Batch Normalization --- smooths the loss surface, allowing higher peak rates and making schedules more forgiving. Foundation: Loss Functions --- the landscape the schedule navigates; different losses create different curvatures and change which rates are stable.',
      ],
    },
  ],
};
