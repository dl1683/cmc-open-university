// Consistency distillation compresses many denoising steps into one or a few
// jumps, creating a speed-quality frontier for diffusion-style systems.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'consistency-distillation-few-step-diffusion-case-study',
  title: 'Consistency Distillation Few-Step Diffusion Case Study',
  category: 'AI & ML',
  summary: 'A case study for making diffusion fast: teacher trajectories, consistency targets, progressive halving, one-step and two-step sampling, quality gaps, and deployment gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['teacher student', 'quality frontier'], defaultValue: 'teacher student' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function distillGraph(title) {
  return graphState({
    nodes: [
      { id: 'noise', label: 'noise', x: 0.7, y: 4.0, note: 'xT' },
      { id: 't64', label: '64', x: 2.1, y: 2.4, note: 'teacher' },
      { id: 't32', label: '32', x: 3.3, y: 2.9, note: 'teacher' },
      { id: 't16', label: '16', x: 4.5, y: 3.4, note: 'teacher' },
      { id: 'clean', label: 'x0', x: 5.8, y: 4.0, note: 'target' },
      { id: 'student', label: 'student', x: 3.2, y: 5.7, note: 'few step' },
      { id: 'loss', label: 'loss', x: 5.6, y: 5.7, note: 'match' },
      { id: 'serve', label: 'serve', x: 8.0, y: 4.8, note: 'fast' },
    ],
    edges: [
      { id: 'e-noise-t64', from: 'noise', to: 't64' },
      { id: 'e-t64-t32', from: 't64', to: 't32' },
      { id: 'e-t32-t16', from: 't32', to: 't16' },
      { id: 'e-t16-clean', from: 't16', to: 'clean' },
      { id: 'e-noise-student', from: 'noise', to: 'student' },
      { id: 'e-student-loss', from: 'student', to: 'loss' },
      { id: 'e-clean-loss', from: 'clean', to: 'loss' },
      { id: 'e-loss-serve', from: 'loss', to: 'serve' },
    ],
  }, { title });
}

function* teacherStudent() {
  yield {
    state: distillGraph('Distill a long teacher trajectory into a short student path'),
    highlight: { active: ['noise', 't64', 't32', 't16', 'clean', 'e-noise-t64', 'e-t64-t32', 'e-t32-t16', 'e-t16-clean'], found: ['student', 'loss'] },
    explanation: 'Classic diffusion quality comes from many small denoising steps. Distillation trains a student to jump farther along the same trajectory, so sampling can use one or a few steps instead of dozens or hundreds.',
    invariant: 'The student is judged by whether its short path lands near the teacher path, not by headline speed alone.',
  };

  yield {
    state: labelMatrix(
      'Progressive halving ledger',
      [
        { id: 'r1', label: 'round1' },
        { id: 'r2', label: 'round2' },
        { id: 'r3', label: 'round3' },
        { id: 'r4', label: 'round4' },
      ],
      [
        { id: 'teacher', label: 'teacher' },
        { id: 'student', label: 'student' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['64 steps', '32 steps', 'small gap'],
        ['32 steps', '16 steps', 'drift'],
        ['16 steps', '8 steps', 'detail'],
        ['8 steps', '4 steps', 'artifacts'],
      ],
    ),
    highlight: { active: ['r1:student', 'r2:student', 'r3:student'], compare: ['r4:risk'] },
    explanation: 'Progressive distillation repeatedly halves the sampler budget. Each round uses the previous sampler as the teacher for a shorter student, while the validation ledger watches the quality gap.',
  };

  yield {
    state: labelMatrix(
      'Consistency target',
      [
        { id: 'same', label: 'same item' },
        { id: 'far', label: 'far noise' },
        { id: 'near', label: 'near noise' },
        { id: 'map', label: 'map' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['x0 id', 'anchor'],
        ['xt high', 'hard jump'],
        ['xs low', 'teacher step'],
        ['f(theta)', 'same clean'],
      ],
    ),
    highlight: { active: ['far:stores', 'near:stores', 'map:why'], found: ['same:why'] },
    explanation: 'Consistency training asks states from the same trajectory to map to the same clean sample. The useful mental model is a table of paired noisy states and the clean target they should agree on.',
  };

  yield {
    state: distillGraph('The deployment artifact is a speed-quality contract'),
    highlight: { active: ['student', 'loss', 'serve', 'e-student-loss', 'e-loss-serve'], compare: ['t64', 't32', 't16'], found: ['clean'] },
    explanation: 'The student becomes a deployment artifact only after the contract is met: acceptable quality gap, stable failure modes, predictable latency, and a fallback path to the slower teacher when the task is risky.',
  };
}

function* qualityFrontier() {
  yield {
    state: plotState({
      axes: { x: { label: 'sampler steps', min: 1, max: 160 }, y: { label: 'quality score', min: 60, max: 100 } },
      series: [
        { id: 'teacher', label: 'teacher', points: [{ x: 4, y: 84 }, { x: 8, y: 89 }, { x: 16, y: 93 }, { x: 32, y: 96 }, { x: 64, y: 98 }, { x: 128, y: 99 }] },
        { id: 'student', label: 'student', points: [{ x: 1, y: 83 }, { x: 2, y: 90 }, { x: 4, y: 94 }, { x: 8, y: 96 }] },
        { id: 'cost', label: '', points: [{ x: 1, y: 99 }, { x: 2, y: 94 }, { x: 4, y: 86 }, { x: 8, y: 74 }, { x: 16, y: 55 }, { x: 32, y: 35 }] },
      ],
      markers: [
        { id: 'two', x: 2, y: 90, label: '2-step' },
      ],
    }),
    highlight: { active: ['student', 'two'], compare: ['teacher'], found: ['cost'] },
    explanation: 'Few-step diffusion is a frontier, not a boolean win. A two-step student can be much faster, but the product decision depends on the remaining quality gap and what failures look like.',
  };

  yield {
    state: labelMatrix(
      'Evaluation ledger',
      [
        { id: 'fid', label: 'FID' },
        { id: 'pref', label: 'pref' },
        { id: 'tail', label: 'p99+$' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['sample metric', 'blind spots'],
        ['human view', 'expensive'],
        ['serving+GPU', 'queues'],
      ],
    ),
    highlight: { active: ['fid:role', 'tail:role'], compare: ['pref:risk', 'tail:risk'] },
    explanation: 'A real deployment ledger must join sample metrics with user-visible quality, tail latency, and cost. Distillation can improve p99 while creating subtle artifacts that one metric will miss.',
  };

  yield {
    state: labelMatrix(
      'Media generator case',
      [
        { id: 'draft', label: 'draft' },
        { id: 'edit', label: 'edit' },
        { id: 'hero', label: 'hero' },
        { id: 'unsafe', label: 'unsafe' },
      ],
      [
        { id: 'route', label: 'route' },
        { id: 'why', label: 'why' },
      ],
      [
        ['2-step', 'fast preview'],
        ['4-step', 'control'],
        ['teacher', 'quality'],
        ['reject', 'policy'],
      ],
    ),
    highlight: { active: ['draft:route', 'edit:route'], compare: ['hero:route'], found: ['unsafe:route'] },
    explanation: 'The same product can use multiple samplers. A two-step model makes fast previews, a four-step model handles edits, the full teacher handles final hero assets, and the policy gate rejects unsafe requests before spending GPU time.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'release week', min: 0, max: 7 }, y: { label: 'relative value', min: 0, max: 100 } },
      series: [
        { id: 'speed', label: 'speed', points: [{ x: 0, y: 40 }, { x: 1, y: 82 }, { x: 2, y: 84 }, { x: 3, y: 85 }, { x: 4, y: 85 }, { x: 5, y: 86 }, { x: 6, y: 86 }] },
        { id: 'quality', label: 'quality', points: [{ x: 0, y: 96 }, { x: 1, y: 89 }, { x: 2, y: 91 }, { x: 3, y: 93 }, { x: 4, y: 94 }, { x: 5, y: 95 }, { x: 6, y: 95 }] },
        { id: 'fallback', label: 'fb', points: [{ x: 0, y: 0 }, { x: 1, y: 18 }, { x: 2, y: 12 }, { x: 3, y: 8 }, { x: 4, y: 6 }, { x: 5, y: 5 }, { x: 6, y: 4 }] },
      ],
      markers: [
        { id: 'launch', x: 1, y: 82, label: 'launch' },
      ],
    }),
    highlight: { active: ['speed', 'quality', 'fallback', 'launch'] },
    explanation: 'A good rollout watches drift after launch. The few-step model should keep its speed advantage while quality recovers through calibration and fallback rate declines as routing improves.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'teacher student') yield* teacherStudent();
  else if (view === 'quality frontier') yield* qualityFrontier();
  else throw new InputError('Pick a consistency distillation view.');
}


export const article = { sections: [
  { heading: 'How to read the animation', paragraphs: [
    'The teacher-student view shows a long denoising path being compressed into a short learned path. Active nodes are teacher steps or student jumps; compare nodes are the teacher trajectory used as the reference; found nodes are deployment artifacts that passed a quality gate.',
    'The quality-frontier view plots sampler steps against quality and cost. The safe inference is that fewer neural-network calls reduce latency only if the student preserves the teacher endpoint closely enough for the product route.',
  ] },
  { heading: 'Why this exists', paragraphs: [
    'Diffusion models generate by starting with noise and repeatedly denoising. A sampler with 50 neural-network evaluations at 40 ms each spends about 2 seconds before decoding, which is too slow for drag-to-edit previews or interactive generation.',
    'Consistency distillation exists to turn many small denoising steps into one or a few learned jumps. It keeps the teacher as the source of quality but trains a student to land near the same clean sample with far fewer calls.',
    {type:'callout', text:'Few-step diffusion works when the student preserves the teacher endpoint invariant, not when it merely skips sampler steps.'},
    {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/99/X-Y_plot_of_algorithmically-generated_AI_art_of_European-style_castle_in_Japan_demonstrating_DDIM_diffusion_steps.png', alt:'A grid of Stable Diffusion DDIM outputs from random noise to a castle image as sampler steps increase.', caption:'DDIM sampling steps demonstration. Source: Wikimedia Commons, Benlisquare, CC BY-SA 4.0.'},
  ] },
  { heading: 'The obvious approach', paragraphs: [
    'The obvious approach is to skip sampler steps with the same model. DDIM and ODE solvers can reduce 1000 small steps to 50 or 20 because the trajectory is smooth enough over moderate intervals.',
    'A second reasonable approach is progressive distillation. Train a 32-step student from a 64-step teacher, then train a 16-step student from the 32-step model, and keep halving while quality remains acceptable.',
  ] },
  { heading: 'The wall', paragraphs: [
    'The wall is curvature and accumulated error. A denoiser trained for small moves is asked to cross a large interval, so details, conditioning, identity, and geometry can drift before the next correction happens.',
    'The measurement wall is just as serious. A fast model can improve p99 latency while damaging text rendering, hands, faces, fine geometry, or diversity in slices that one aggregate score hides.',
  ] },
  { heading: 'The core insight', paragraphs: [
    'Points on the same probability-flow trajectory should map to the same clean endpoint. If x_t and x_s came from the same image, a consistency function should return the same x0 from both noise levels.',
    'The student is therefore trained on agreement, not on speed alone. The invariant is endpoint consistency along the teacher trajectory, and the deployment decision is whether the remaining endpoint error is acceptable for the route.',
  ] },
  { heading: 'How it works', paragraphs: [
    'Training samples an image, adds noise, picks two times, and uses a teacher or ODE step to connect the farther noisy state to a nearer state. The student predicts the clean endpoint from both states, and the loss penalizes disagreement while a boundary condition keeps near-clean inputs close to themselves.',
    'A curriculum starts with nearby pairs and gradually widens the jump. The deployed system may use one-step for thumbnails, two-step for live previews, four-step for edits, and the teacher for final assets that need maximum quality.',
  ] },
  { heading: 'Why it works', paragraphs: [
    'The correctness argument is an approximate invariant. If every point on a teacher trajectory maps to the same clean endpoint, then evaluating the student once at a noisy point should recover that endpoint.',
    'Progressive distillation has an induction shape. If a student matches two teacher steps within error delta, then replacing pairs of teacher steps preserves the trajectory up to accumulated error, which is why repeated halving must be validated at each round.',
  ] },
  { heading: 'Cost and complexity', paragraphs: [
    'If one network evaluation costs 40 ms, a 50-step teacher costs 2000 ms and a 2-step student costs 80 ms before fixed overhead. The raw evaluation count drops 25x, but end-to-end speedup is lower because text encoding, safety checks, VAE decode, and network overhead remain.',
    'Training cost is the tax. The team pays teacher generation, trajectory storage or recomputation, curriculum tuning, EMA targets, slice-level evaluation, and fallback routing before it earns lower serving latency.',
  ] },
  { heading: 'Real-world uses', paragraphs: [
    'Few-step models fit preview-heavy products: image drafting, inpainting brushes, style sliders, video keyframe previews, and avatar systems. The common pattern is high volume, low tolerance for waiting, and some tolerance for retry or fallback.',
    'They also fit routing architectures. A cheap student can reject bad prompts, create candidate grids, or serve drafts while the full teacher handles final renders and hard prompt slices.',
  ] },
  { heading: 'Where it fails', paragraphs: [
    'It fails on outputs that need exact detail. Text in images, identity preservation, symmetric geometry, medical imagery, charts, and technical diagrams often need more correction steps.',
    'It also fails when teams retire the teacher too early. A distilled model should reduce slow-path volume, not remove the ability to recover quality for prompts where the fast path is known to drift.',
  ] },
  { heading: 'Worked example', paragraphs: [
    'A product serves 10000 image previews per hour. The 50-step teacher needs 2.0 seconds and 50 evaluations per accepted sample; a 2-step student needs 0.08 seconds and 2 evaluations, but 8 percent of outputs fall back to a 20-step route.',
    'Average evaluations become 2 + 0.08 * 20 = 3.6 evaluations per preview, about 14x fewer than the teacher. If the fallback rate rises to 40 percent on prompts with text, average evaluations become 10, so routing those prompts directly to the teacher may be cheaper and better.',
  ] },
  { heading: 'Sources and study next', paragraphs: [
    'Primary sources: Consistency Models by Song et al., Progressive Distillation by Salimans and Ho, Improved Consistency Training, and continuous-time consistency model scaling papers. Study probability-flow ODEs, DDIM, diffusion loss functions, and knowledge distillation next.',
    'Then compare latent consistency models, rectified flow, DPM-Solver, diffusion serving schedulers, quality evaluation, and fallback routing. The practical question is cost per accepted sample, not cost per generated sample.',
  ] },
] };
