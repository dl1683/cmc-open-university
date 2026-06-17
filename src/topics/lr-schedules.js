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
// One GD step multiplies w by (1 − lr): the whole story is in that factor.
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
    explanation: 'The test bench: a clean bowl, loss = w²/2, start at w = 10; each gradient-descent step multiplies the distance by |1 − lr|, so everything about convergence lives in one number. Run the two constant temperaments: BOLD (lr = 1.9) overshoots the minimum every single step — it lands on the other wall, shrinking by only ×0.9 per step while ricocheting; TIMID (lr = 0.05) never overshoots and never hurries, ×0.95 per step. Thirty steps later neither has truly arrived. On real, noisy, non-convex terrain (Loss Landscapes), the bold one also cannot SETTLE — it bounces around the basin floor forever at a "noise floor" set by its own step size.',
    invariant: 'On the bowl, each step scales the error by |1 − lr|: too big ricochets, too small crawls.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'step' }, y: { label: '|w| — distance from optimum' } },
      series: [
        { id: 'big', label: 'lr = 1.9', points: descend(() => 1.9, 30) },
        { id: 'small', label: 'lr = 0.05', points: descend(() => 0.05, 30) },
        { id: 'sched', label: 'scheduled: 1.5 → 0.05', points: descend((t) => Math.max(1.5 * 0.85 ** t, 0.05), 30) },
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
      axes: { x: { label: 'training step' }, y: { label: 'learning rate (× peak)' } },
      series: [
        { id: 'step', label: 'step decay', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: t < 40 ? 1 : t < 70 ? 0.316 : 0.1 })) },
        { id: 'cos', label: 'cosine annealing', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: cosine(t) })) },
        { id: 'warmcos', label: 'warmup + cosine', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: t < warm ? t / warm : cosine(((t - warm) / (T - warm)) * T) })) },
      ],
    }),
    highlight: { active: ['warmcos'], visited: ['step', 'cos'] },
    explanation: 'The zoo\'s three headliners, drawn as lr-versus-time. STEP DECAY: hold, then cut by ~3× at milestones — the classic that trained a decade of vision models; brutally effective, knees chosen by hand. COSINE ANNEALING: one smooth half-cosine from peak to zero — no milestones to tune, gentle start, gentle landing; the modern default. And the third curve adds the ramp at the front — WARMUP — which has the most interesting justification of the three, because it exists to protect a specific piece of machinery you have already studied.',
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
    explanation: 'Recall Adam\'s second moment v — the per-weight EMA of squared gradients that DIVIDES every step. Bias correction fixes its average, but at step 1 that average is computed from ONE sample: a coordinate that happened to draw a tiny first gradient gets a tiny √v̂ and therefore an enormous step — a fluke, amplified. A few such steps can throw a fresh network into a bad region it spends the whole run recovering from (the loss spikes that haunt LLM training logs). WARMUP is the fix-by-humility: ramp lr from 0 to peak over the first few hundred steps, keeping strides short until v has seen enough gradients to be a statistic instead of a rumor. Essentially every transformer you have used was trained with linear warmup → cosine decay.',
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
    explanation: 'And how do you pick the PEAK the schedule decays from? Stop guessing: run the LR RANGE TEST (Leslie Smith) — one short training run while the learning rate sweeps exponentially upward, plotting loss as it goes. The curve tells the whole story: flat on the left (too small to learn anything), a steep productive slope in the middle, then the explosion. Pick the peak just below where the loss bottoms out — here around lr ≈ 0.05 — and hand it to your cosine schedule. Five minutes of compute replaces a folk ritual; it is the closest thing hyperparameter choice has to a free lunch (and it composes with Hyperparameter Search for everything else).',
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
    explanation: 'The field guide. Note the third row\'s philosophy difference: reduce-on-plateau doesn\'t pre-plan anything — it watches validation loss (the honest signal, per Cross-Validation) and cuts the rate 10× whenever progress stalls; slower than a tuned cosine but nearly impossible to misconfigure. The unifying picture to leave with: the optimizer chooses the step DIRECTION, the schedule chooses the step AMBITION, and ambition should track certainty — low while estimates are rumors (warmup), high while exploring, low again while settling. The same explore-then-commit arc as Thompson Sampling, played against a loss landscape instead of slot machines.',
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
      heading: 'Why this exists',
      paragraphs: [
        'A learning-rate schedule exists because one constant step size is trying to solve several different problems at once. Early in training, the model is far from a useful basin and needs motion. Later in training, it is near a basin and needs precision. A constant rate must choose between covering ground and settling down, so it usually does one of them badly.',
        'The learning rate is the ambition knob of gradient descent. The gradient points in a direction; the learning rate decides how far to trust that direction. A schedule changes that trust over time. It lets the run start cautiously while estimates are unreliable, become aggressive while useful descent is available, and become careful again when the model should preserve what it found.',
        'This is why schedules are not cosmetic recipe details. In modern training, especially with Adam-style adaptive optimizers, the schedule can decide whether a run spikes early, escapes poor basins, reaches a good solution, or spends the last third of compute rattling around the floor.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to pick a learning rate that looks stable and leave it alone. On the clean bowl loss in the demo, that already fails. A large constant rate moves quickly but overshoots the optimum and keeps bouncing. A small constant rate is stable but wastes the early run. Real neural networks make the problem worse because the loss surface is curved, noisy, and nonstationary.',
        'Another obvious approach is to search a few constants and keep the best validation curve. That can work on small problems, but it hides the phase structure of training. The best early rate is not necessarily the best late rate. The best rate before Adam has reliable second-moment estimates is not necessarily safe at step one. A schedule turns that observation into a training policy.',
        'The mistake is treating the learning rate as a property of the model. It is a property of the run at a moment in time. The right question is not only "what learning rate should this model use?" It is "how should step ambition change as evidence, curvature, noise, and remaining training time change?"',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is phase control. Early training often benefits from larger motion because the model is far from a good solution and gradients can point toward broad improvements. Late training needs smaller motion because a large step near a good basin turns progress into oscillation. Warmup adds an even earlier phase: before optimizer statistics are reliable, keep steps small.',
        'The clean bowl makes the math visible. For loss = w^2/2, one gradient descent step multiplies distance from the optimum by |1 - lr|. A rate near 2 can be technically stable but bouncy; a rate near 0 is safe but slow. A decaying schedule uses larger multipliers early and smaller multipliers late, so the same run can move quickly and then settle.',
        'In high-dimensional training, the same principle appears as a balance between exploration, noise, and consolidation. Large rates can filter out sharp, fragile minima by refusing to rest in them. Smaller rates later let the model consolidate inside a basin. The schedule is therefore part optimization method, part regularizer, and part compute allocation policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step decay holds a rate for a while and cuts it at chosen milestones. It is blunt but effective when the training recipe is well understood. Cosine annealing smoothly lowers the rate from a peak toward zero or a floor, avoiding hand-picked cliffs. One-cycle schedules increase and then decrease the rate to squeeze strong progress from short training runs.',
        'Warmup is different because it protects the beginning of training. Adam and related optimizers divide updates by estimates of gradient variance. At step one, those estimates are built from almost no evidence. Bias correction fixes the expected scale, but it cannot make one observed gradient a reliable statistic. Warmup ramps the global rate while those adaptive denominators become less rumor-like.',
        'The LR range test turns peak selection into an experiment. Sweep the rate upward over a short run and plot loss. The flat region is too timid. The steep descending region is productive. The exploding region is unsafe. A good peak is usually below the explosion boundary, then a schedule such as warmup plus cosine controls how the run approaches and leaves that peak.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The constant-rate view proves the false choice. A bold constant rate is not simply "better" because it moves quickly; near the optimum it wastes progress by ricocheting. A timid constant rate is not simply "safer" because it stays stable; far from the optimum it spends steps making tiny corrections. The scheduled curve wins because it changes behavior across phases.',
        'The schedule-zoo view proves that different schedules encode different assumptions. Step decay assumes known milestones. Cosine assumes a smooth commitment path. Warmup plus cosine assumes unreliable early optimizer statistics and a long settling phase. Reduce-on-plateau assumes validation progress is the best trigger. The curves are not decorations. They are beliefs about the run.',
        'The warmup table is the most operational part of the visual. It connects schedule design to optimizer internals. If the adaptive denominator is based on too few samples, a full-size early step can amplify a fluke coordinate. Warmup keeps the run from trusting statistics before the optimizer has earned that trust.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The per-step runtime cost is trivial: compute one scalar and pass it to the optimizer. The real cost is recipe design. You must choose warmup length, peak rate, decay shape, floor, total steps, batch size, optimizer, and sometimes restarts. Those choices interact. Changing batch size without reconsidering the schedule can silently change the effective optimization regime.',
        'The tradeoff is responsiveness versus predictability. A fixed cosine schedule is predictable and easy to reproduce, but it cannot react if validation loss stalls early. Reduce-on-plateau reacts to validation behavior, but it adds patience windows, noise sensitivity, and more conditional logic. Large-scale training often prefers predictable schedules because they are easier to plan, compare, and debug.',
        'Schedules also trade exploration against preservation. Decay too early and the model may settle in a mediocre basin before it has explored enough. Decay too late and the model may never stop bouncing around a good basin. Warm up too long and you waste compute. Warm up too short and you risk early instability.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Warmup plus cosine is common in transformer and LLM training because it protects early Adam statistics and gives a smooth landing. Step decay remains useful in classic vision recipes where milestone schedules are well established. One-cycle policies are useful when training budgets are short and the goal is to extract strong performance from a fixed number of epochs.',
        'Reduce-on-plateau is useful for fine-tuning and smaller experiments where validation loss is cheap and informative. It is less elegant than a planned cosine schedule, but it often works because it waits for evidence that progress has stalled. It pairs naturally with early stopping: one mechanism asks whether to reduce ambition; the other asks whether the run has stopped earning compute.',
        'Schedules are also useful as communication. A training recipe with explicit warmup, peak, decay, and floor tells future readers what the run believed about stability and convergence. A mysterious constant rate or copied curve tells them almost nothing.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A schedule is not an optimizer. It does not fix wrong gradients, bad labels, leakage, broken normalization, or a model that cannot represent the task. If the peak rate is ten times too high, a beautiful cosine curve still fails. If the validation protocol is dishonest, reduce-on-plateau will respond to the wrong signal.',
        'Training loss can be misleading. A schedule may lower training loss faster while hurting generalization, especially when the model overfits late. Always check validation behavior, calibration, task metrics, and stability across seeds. The right schedule is the one that improves the actual objective, not the one with the prettiest loss curve.',
        'Do not cargo-cult warmup length or cosine decay from a different scale. Optimizer, batch size, dataset, model depth, normalization, gradient clipping, and hardware precision can all change safe step sizes. A schedule copied from a larger or smaller run should be treated as a hypothesis, not a law.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Gradient Descent for the base step rule, Adam Optimizer for adaptive denominators, Loss Landscapes for sharp and flat minima, Gradient Noise Scale for batch-size interactions, Hyperparameter Search for peak-rate selection, Cross-Validation for honest validation signals, and Early Stopping for compute decisions.',
        'A good exercise is to run the same small model with four schedules: constant, step decay, warmup plus cosine, and reduce-on-plateau. Plot training loss, validation loss, final metric, and gradient norm. The point is not to crown one universal winner. The point is to see how each schedule encodes a different belief about phases of learning.',
        'Before launching a serious run, write one sentence that explains the schedule: why it starts where it starts, why it peaks where it peaks, why it decays when it decays, and why it ends where it ends. If that sentence is vague, the schedule is probably a ritual rather than a design.',
      ],
    },
  ],
};
