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
        `A learning rate schedule is a rule that changes your step size as training progresses. Instead of taking the same-sized step for 1000 epochs, you start with a large step (move fast, explore broadly), then gradually shrink it (settle in, refine the answer). The schedule itself is just a function: given the current training step, tell me the learning rate to use now. It is the single most effective lever in training: getting it right often beats weeks of tweaking everything else, because the right step size at the right time is not a constant — it is a PHASE.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization shows the core dilemma. On a clean bowl (loss = w²/2), a constant learning rate forces a tragic choice: pick 1.9 and you ricochet by ×0.9 per step forever; pick 0.05 and you creep by ×0.95 per step. One number cannot cover both jobs. The solution: START with lr = 1.5 (move aggressively) and DECAY toward 0.05 (small careful steps to finish). This reaches the bottom in ten steps — what neither constant achieves in thirty.`,
        `The zoo shows three main shapes: STEP DECAY cuts the rate by ~3× at predetermined milestones (classic, battle-tested on vision). COSINE ANNEALING glides smoothly from peak to zero (no milestones to tune, modern default). WARMUP + COSINE adds a linear ramp first: the rate climbs slowly from zero to peak over the first few hundred steps, then decays on a cosine curve. This ramp protects Adam and RMSProp: their per-weight variance estimate is a rumor at step 1 (built from one sample), and a full-size step would amplify that fluke wildly — see the loss spikes in LLM training logs. Warmup keeps strides tiny until the variance estimate has seen enough samples to be trustworthy. Every transformer you have used was trained with warmup + cosine.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A schedule costs nothing at runtime: one function call per training step to ask "what is the lr now?" That call is O(1) — typically a lookup, a multiplication, a max. No extra memory, no gradient computation. The complexity is in picking the schedule in the first place. Use the LR RANGE TEST (Leslie Smith): run one short training sweep while exponentially ramping the learning rate upward, plot training loss as the rate climbs. The curve tells you everything: flat on the left (rate too small to learn), a steep descent in the middle (the productive zone), then explosion above that. Pick the peak just below where the curve bottoms out — that is your maximum learning rate. Five minutes of compute replaces a folk ritual. From there, hand that peak to a cosine schedule (or step-decay if you prefer) and rely on that shape having been battle-tested across millions of models.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Transformers and LLMs: warmup + cosine is the standard, because the architecture is sensitive to unstable early steps. Vision CNNs: step decay (0.97× per epoch, or 1/10 at milestones) because vision tasks are more forgiving. Fine-tuning: reduce-on-plateau (cut the rate 10× when validation loss stalls) is safer when you do not know how many epochs you need. Fast runs: one-cycle policy squeezes maximum from minimal epochs. Every schedule trades exploration (large rate, bounce, skip sharp minima) against exploitation (small rate, settle deep in a basin). The timeline reflects your belief about terrain: far out, move boldly; as you converge, stop bouncing and sink.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The schedule and optimizer are not the same thing. The optimizer (SGD, Adam, etc.) picks the DIRECTION of the step; the schedule picks the MAGNITUDE. You need both. Without a good schedule, even Adam flounders. Another trap: running warmup + cosine straight without an LR range test is a gamble. The peak learning rate matters enormously; if it is 10× too high the whole schedule is ruined. Spend five minutes on the range test — it is free. Do not confuse decay-on-plateau with a guarantee of success: it reacts only to what has already happened (validation loss stalled), so it adapts slowly and will miss sharp phase transitions. Finally, do not over-tune the schedule if you have not tuned the optimizer's other hyperparameters (momentum, β₁, β₂ for Adam); you might be fighting a losing battle. Fix the direction first, then the magnitude.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Learning rate schedules are one axis of Gradient Descent: study the foundations of how and why we step downhill, and what "step size" means mathematically. Momentum and RMSProp & Adam show the other half — how optimizers direct the step. To understand the terrain that schedules navigate, read Loss Landscapes & Optimization Geometry and see why flat basins need large learning rates (they filter sharp, overfitting-prone minima) and why small rates are necessary only when settling. The LR range test is a slice of Hyperparameter Search — the broader framework for choosing all the knobs. Thompson Sampling explores a different explore-then-commit arc: it allocates steps to arms with promise and gradually commits to the best; a learning rate schedule does the same thing over time, retreating from exploration as it gains confidence.`,
      ],
    },
  ],
};

