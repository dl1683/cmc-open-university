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
// One GD step multiplies w by (1 âˆ' lr): the whole story is in that factor.
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
  const r2 = (v) => Math.round(v * 100) / 100;
  const lrBold = 1.9;
  const lrTimid = 0.05;
  const steps = 30;
  const w0 = 10;
  const boldFactor = r2(Math.abs(1 - lrBold));
  const timidFactor = r2(Math.abs(1 - lrTimid));
  const boldPath = descend(() => lrBold, steps);
  const timidPath = descend(() => lrTimid, steps);
  const boldFinal = r2(boldPath[steps].y);
  const timidFinal = r2(timidPath[steps].y);

  yield {
    state: plotState({
      axes: { x: { label: 'step' }, y: { label: '|w| — distance from optimum' } },
      series: [
        { id: 'big', label: `lr = ${lrBold} (bold)`, points: boldPath },
        { id: 'small', label: `lr = ${lrTimid} (timid)`, points: timidPath },
      ],
    }),
    highlight: { compare: ['big', 'small'] },
    explanation: `The test bench: a clean bowl, loss = w²/2, start at w = ${w0}; each gradient-descent step multiplies the distance by |1 - lr|, so everything about convergence lives in one number. Run the two constant temperaments: BOLD (lr = ${lrBold}) overshoots the minimum every single step — it lands on the other wall, shrinking by only ×${boldFactor} per step while ricocheting; TIMID (lr = ${lrTimid}) never overshoots and never hurries, ×${timidFactor} per step. ${steps} steps later neither has truly arrived (bold |w| ˜ ${boldFinal}, timid |w| ˜ ${timidFinal}). On real, noisy, non-convex terrain (Loss Landscapes), the bold one also cannot SETTLE — it bounces around the basin floor forever at a "noise floor" set by its own step size.`,
    invariant: `On the bowl, each step scales the error by |1 - lr|: too big ricochets, too small crawls.`,
  };

  const schedLrStart = 1.5;
  const schedLrEnd = 0.05;
  const schedDecay = 0.85;
  const schedPath = descend((t) => Math.max(schedLrStart * schedDecay ** t, schedLrEnd), steps);
  const schedAt10 = r2(schedPath[10].y);

  yield {
    state: plotState({
      axes: { x: { label: 'step' }, y: { label: '|w| — distance from optimum' } },
      series: [
        { id: 'big', label: `lr = ${lrBold}`, points: boldPath },
        { id: 'small', label: `lr = ${lrTimid}`, points: timidPath },
        { id: 'sched', label: `scheduled: ${schedLrStart} ? ${schedLrEnd}`, points: schedPath },
      ],
    }),
    highlight: { visited: ['big', 'small'], found: ['sched'] },
    explanation: `Now refuse the dilemma: START bold, FINISH timid. The scheduled run opens at lr = ${schedLrStart} — early steps slash the distance by half each time — and decays (×${schedDecay}/step) toward ${schedLrEnd} as it nears the floor, where small careful steps finish the job. By step 10 it reaches |w| ˜ ${schedAt10}, which neither constant achieves in ${steps}, because the right learning rate is not a NUMBER, it is a PHASE: far from the optimum you want speed and (on real terrain) basin-hopping noise; near it you want to stop rattling and sink. A schedule is just that sentence, written as a function of the step count.`,
  };

  const numPhases = 2;

  yield {
    state: matrixState({
      title: `The ${numPhases} phases of every training run`,
      rows: [{ id: 'early', label: 'early training' }, { id: 'late', label: 'late training' }],
      columns: [{ id: 'where', label: 'where you are' }, { id: 'want', label: 'what you want' }, { id: 'lr', label: 'so lr should be' }],
      values: [[1, 2, 3], [4, 5, 6]],
      format: (v) => ['', 'far from any minimum', 'speed + exploration noise', 'LARGE', 'inside a good basin', 'settle deep, stop rattling', 'small'][v],
    }),
    highlight: { compare: ['early:lr', 'late:lr'] },
    explanation: `The phase table shows ${numPhases} distinct regimes — and a connection worth keeping: the large-lr phase is not merely fast, it is SELECTIVE. Big noisy steps cannot rest in the narrow, sharp minima that generalize poorly (the flatness filter from Loss Landscapes); they bounce out and keep moving until a basin is wide enough to hold them. Decay the rate too early and you rob training of that filtering; too late and you never consolidate. Which is why the SHAPE of the decay became its own little zoology — the other view tours the zoo.`,
  };
}

function* zoo() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const T = 100;
  const warm = 10;
  const cosine = (t) => 0.5 * (1 + Math.cos((Math.PI * t) / T));
  const numSchedules = 3;
  const stepMilestone1 = 40;
  const stepMilestone2 = 70;
  const stepDecayFactor = r2(1 / 0.316);
  const cosineAtQuarter = r2(cosine(T * 0.25));

  yield {
    state: plotState({
      axes: { x: { label: 'training step' }, y: { label: `learning rate (x peak)` } },
      series: [
        { id: 'step', label: 'step decay', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: t < stepMilestone1 ? 1 : t < stepMilestone2 ? 0.316 : 0.1 })) },
        { id: 'cos', label: 'cosine annealing', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: cosine(t) })) },
        { id: 'warmcos', label: 'warmup + cosine', points: Array.from({ length: T + 1 }, (_, t) => ({ x: t, y: t < warm ? t / warm : cosine(((t - warm) / (T - warm)) * T) })) },
      ],
    }),
    highlight: { active: ['warmcos'], visited: ['step', 'cos'] },
    explanation: `The zoo's ${numSchedules} headliners, drawn as lr-versus-time over ${T} steps. STEP DECAY: hold, then cut by ~${stepDecayFactor}x at milestones ${stepMilestone1} and ${stepMilestone2} — the classic that trained a decade of vision models; brutally effective, knees chosen by hand. COSINE ANNEALING: one smooth half-cosine from peak to zero (at 25% of training, lr is still ${cosineAtQuarter}x peak) — no milestones to tune, gentle start, gentle landing; the modern default. And the third curve adds a ${warm}-step ramp at the front — WARMUP — which has the most interesting justification of the three, because it exists to protect a specific piece of machinery you have already studied.`,
  };

  const samplesAtStep1 = 1;
  const samplesAtStep100 = 100;
  const warmupRows = 3;

  yield {
    state: matrixState({
      title: `Why warmup: Adam's first steps are built on rumors`,
      rows: [
        { id: 't1', label: 'step 1' },
        { id: 't5', label: 'step 5' },
        { id: 't100', label: `step ${samplesAtStep100}` },
      ],
      columns: [{ id: 'samples', label: 'gradients seen' }, { id: 'trust', label: 'v (variance estimate) is...' }, { id: 'risk', label: 'full-size step would...' }],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
      format: (v) => ['', '1', 'one sample — a rumor', 'amplify a fluke hugely', '5', 'still mostly noise', 'wobble dangerously', '~100', 'a real statistic', 'be safe at full size'][v],
    }),
    highlight: { removed: ['t1:risk'], found: ['t100:risk'] },
    explanation: `Recall Adam's second moment v — the per-weight EMA of squared gradients that DIVIDES every step. Bias correction fixes its average, but at step ${samplesAtStep1} that average is computed from ONE sample: a coordinate that happened to draw a tiny first gradient gets a tiny sqrt(v) and therefore an enormous step — a fluke, amplified. A few such steps can throw a fresh network into a bad region it spends the whole run recovering from (the loss spikes that haunt LLM training logs). WARMUP is the fix-by-humility: ramp lr from 0 to peak over the first ${warm} steps, keeping strides short until v has seen enough gradients (by step ~${samplesAtStep100}, ${warmupRows} rows tell the story) to be a statistic instead of a rumor. Essentially every transformer you have used was trained with linear warmup -> cosine decay.`,
    invariant: `Adaptive denominators need samples to be trustworthy; warmup keeps steps small until they are.`,
  };

  const sweepSteps = 41;
  const rangeTest = Array.from({ length: sweepSteps }, (_, i) => {
    const lr = 10 ** (-4 + i * 0.1);
    const loss = lr < 0.003 ? 2.3 - 2 * (Math.log10(lr) + 4) * 0.06 : lr < 0.3 ? 1.9 - 0.55 * (Math.log10(lr) + 2.5) : 0.92 + (Math.log10(lr) + 0.5) ** 2 * 6;
    return { x: Math.log10(lr) + 4, y: loss };
  });
  const sweetSpotLr = r2(10 ** (-4 + 32 * 0.1));
  const sweetSpotLoss = r2(rangeTest[32].y);
  const boomLr = r2(10 ** (-4 + 39 * 0.1));

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
    explanation: `And how do you pick the PEAK the schedule decays from? Stop guessing: run the LR RANGE TEST (Leslie Smith) — one short training run of ${sweepSteps} points while the learning rate sweeps exponentially upward, plotting loss as it goes. The curve tells the whole story: flat on the left (too small to learn anything), a steep productive slope in the middle (loss hits ${sweetSpotLoss} near lr ~ ${sweetSpotLr}), then the explosion past lr ~ ${boomLr}. Pick the peak just below where the loss bottoms out and hand it to your cosine schedule. Five minutes of compute replaces a folk ritual; it is the closest thing hyperparameter choice has to a free lunch (and it composes with Hyperparameter Search for everything else).`,
  };

  const numOptions = 4;
  const schedNames = ['warmup + cosine', 'step decay', 'reduce-on-plateau', 'one-cycle'];

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
    explanation: `The field guide: ${numOptions} schedules (${schedNames.join(', ')}). Note the third row's philosophy difference: reduce-on-plateau doesn't pre-plan anything — it watches validation loss (the honest signal, per Cross-Validation) and cuts the rate 10x whenever progress stalls; slower than a tuned cosine but nearly impossible to misconfigure. The unifying picture to leave with: the optimizer chooses the step DIRECTION, the schedule chooses the step AMBITION, and ambition should track certainty — low while estimates are rumors (warmup), high while exploring, low again while settling. The same explore-then-commit arc as Thompson Sampling, played against a loss landscape instead of slot machines.`,
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
    {heading: 'How to read the animation', paragraphs: ['Read each curve as a policy for step size over training time. The active point shows where the optimizer is in that policy, not a separate algorithm.', {type: 'callout', text: 'A schedule is step-size policy: high ambition while searching, low ambition while settling, and warmup while statistics are still thin.'}, 'The first view shows why one constant rate fails on a bowl. The second view compares schedule shapes and asks what breaks if the current rate is held forever.', {type: 'image', src: './assets/gifs/lr-schedules.gif', alt: 'Animated walkthrough of the lr schedules visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A learning rate is the scalar that multiplies the gradient before parameters move. Early training often needs large steps to make progress, while late training needs small steps to settle.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Gradient_descent.svg/250px-Gradient_descent.svg.png', alt: 'Gradient descent path moving through contour lines toward a minimum', caption: 'Learning rate controls how far each downhill step travels through the contour map. Source: Wikimedia Commons, Gradient descent illustration.'}, 'A schedule exists because one constant rate cannot fit every phase. It makes step size a function of time, optimizer state quality, and desired settling behavior.']},
    {heading: 'The obvious approach', paragraphs: ['Pick one learning rate, train, and keep the best value from a small grid. This is reasonable on cheap convex problems where a stable constant eventually converges.', 'The problem is waste. A rate that is safe late may crawl early, while a rate that is useful early may bounce forever near the minimum.']},
    {heading: 'The wall', paragraphs: ['On loss = w squared / 2, one gradient step with rate lr multiplies distance by abs(1 - lr). Starting at w = 10, lr = 0.05 leaves about 10 * 0.95^30 = 2.15 after 30 steps.', 'A bold lr = 1.9 multiplies distance by 0.9 but flips sign every step, leaving about 0.42 after 30 steps. Neither rate gives both fast search and quiet settling.']},
    {heading: 'The core insight', paragraphs: ['The right rate is a phase policy, not a number. Warmup is caution while optimizer statistics are unreliable, the high-rate phase searches broadly, and decay turns movement into fine adjustment.', 'The policy changes behavior without changing the model or loss. It decides whether optimization explores, rattles, or settles.']},
    {heading: 'How it works', paragraphs: ['Step decay holds a rate and drops it at milestones. Cosine decay uses a smooth half-cosine from peak to minimum, spending more early steps near the high rate and more late steps near the low rate.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation bands highlighted', caption: 'Warmup is a variance-control move: early optimizer statistics are noisy, so the global step stays small while estimates stabilize. Source: Wikimedia Commons, M. W. Toews, public domain.'}, 'Warmup ramps from near zero to peak over the first k steps. It is common with Adam because early second-moment estimates are based on too few gradient samples.']},
    {heading: 'Why it works', paragraphs: ['On the quadratic bowl, scheduled rates multiply different factors over time. Large early rates shrink distance quickly, while smaller late rates avoid overshooting near zero.', 'For Adam, warmup is a statistical guard. The effective step uses lr divided by a square root of an estimated variance, and early variance estimates are noisy, so keeping lr small prevents a few bad denominators from producing huge updates.']},
    {heading: 'Cost and complexity', paragraphs: ['Computing the schedule is almost free. The real cost is choosing peak rate, warmup length, minimum rate, total steps, and decay shape.', 'When batch size, optimizer, precision, or model depth changes, the safe schedule can change too. A copied schedule is a hypothesis about behavior, not a guarantee.']},
    {heading: 'Real-world uses', paragraphs: ['Transformer training commonly uses linear warmup followed by cosine decay. The warmup protects early Adam statistics, and the decay helps the run settle over long token budgets.', 'Fine-tuning often uses smaller peaks and simple decay because the model already starts near useful behavior. Vision recipes still use milestone step decay when published training recipes specify exact drops.']},
    {heading: 'Where it fails', paragraphs: ['A schedule cannot fix wrong gradients, bad labels, data leakage, or broken normalization. If the peak rate is ten times too high, a smooth curve can still diverge.', 'Schedule tuning can overfit validation results. Trying many warmup lengths and decay floors is still hyperparameter search, so the final choice needs honest evaluation.']},
    {heading: 'Worked example', paragraphs: ['Use peak lr = 0.1, minimum lr = 0.001, five warmup steps, and 95 cosine steps. Warmup gives rates 0, 0.02, 0.04, 0.06, 0.08, then reaches 0.1.', 'Halfway through the cosine, the rate is about 0.05. At the end it reaches 0.001, so the same run first moves aggressively and then makes small corrections.']},
    {heading: 'Sources and study next', paragraphs: ['Read Loshchilov and Hutter 2017 for SGDR, Goyal et al. 2017 for warmup in large-batch training, and Smith 2018 for LR range tests and one-cycle policy. Study gradient descent, Adam, batch normalization, and loss landscapes next.']},
  ],
};
