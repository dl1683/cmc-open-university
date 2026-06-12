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
      heading: `What it is`,
      paragraphs: [
        `A learning-rate schedule changes the step size during training. The demo uses the clean bowl loss = w^2/2, where each Gradient Descent step multiplies distance from the optimum by |1 - lr|. With lr = 1.9, the point ricochets across the bottom and shrinks only by 0.9 per step. With lr = 0.05, it never overshoots but crawls by 0.95 per step. A schedule refuses that false choice: start bold when far away, then become careful when close enough that bouncing is waste.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The scheduled curve opens at lr = 1.5 and decays by 0.85 each step until it reaches 0.05. It reaches roughly 0.00006 distance by step 10, while both constants are still visibly away from the optimum after 30 steps. That is the core lesson: far from a minimum, large steps cover ground and can jump out of sharp pockets in Loss Landscapes & Optimization Geometry; near a good basin, small steps stop rattling and let the model settle.`,
        `The second view draws the schedule zoo. Step decay holds a rate and cuts it at milestones. Cosine annealing glides smoothly from peak toward zero. Warmup plus cosine starts with a short ramp because Momentum, RMSProp & Adam builds its variance estimate from only a few gradients at the beginning. Bias correction fixes the expectation, but it cannot make one sample a trustworthy statistic. Warmup keeps early strides small until the denominator has seen enough batches.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The runtime cost is O(1) per training step: compute a scalar learning rate. The real cost is choosing the peak. The LR range test sweeps the rate upward in one short run, finds the productive descent band, and chooses a peak just before loss explodes. That is a narrow slice of Hyperparameter Search, but cheaper than searching every knob blindly. It also gives a visible failure boundary, which is more useful than folklore like "try 1e-3."`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Transformers usually use linear warmup followed by cosine decay. Classic CNN recipes often use step decay. Fine-tuning often uses reduce-on-plateau, which watches validation loss from Cross-Validation & Honest Evaluation and cuts the rate when progress stalls. Early Stopping & Patience often pairs with schedules: one decides how hard to step, the other decides whether the run has stopped earning compute. In production training, the schedule is part of the recipe, not an afterthought.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A schedule is not an optimizer. The optimizer picks direction; the schedule picks ambition. A perfect cosine curve with a peak 10x too high still fails, and warmup does not rescue bad labels or leakage. Do not infer success from training loss alone; the schedule may simply overfit faster. The same explore-then-commit idea appears in Thompson Sampling, but here the exploration is motion through parameter space. Decaying too early can trap a model in a mediocre basin; decaying too late leaves it orbiting the floor.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `After this, study adaptive optimizers, validation protocols, and the geometry of sharp versus flat minima. The useful mental model is phase control: early training needs motion and noise, middle training needs productive descent, and late training needs a small enough step that the model can keep the solution it found.`,
        `A good schedule should be explainable in one sentence before you run it. If you cannot say why the rate starts, peaks, decays, and stops where it does, you probably tuned a curve shape instead of solving the training problem.`,
      ],
    },
  ],
};
