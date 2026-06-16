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

export const article = {
  references: [
    { title: 'Consistency Models', url: 'https://arxiv.org/abs/2303.01469' },
    { title: 'Progressive Distillation for Fast Sampling of Diffusion Models', url: 'https://arxiv.org/abs/2202.00512' },
    { title: 'OpenAI: Simplifying, Stabilizing, and Scaling Continuous-Time Consistency Models', url: 'https://openai.com/index/simplifying-stabilizing-and-scaling-continuous-time-consistency-models/' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['Consistency distillation and progressive distillation are ways to make diffusion-style generation fast. The core idea is to compress a slow teacher sampler into a student that can take one or a few larger jumps.', 'This topic belongs next to Diffusion Models and Knowledge Distillation: the teacher supplies a trajectory through noisy states, and the student learns a cheaper map that preserves enough quality for the product route.'] },
    { heading: 'Data structures', paragraphs: ['A useful implementation stores teacher trajectories, paired noisy states, clean targets, student predictions, loss weights, sampler-step budgets, quality scores, and fallback routes. Those records are what turn a research claim into a deployable artifact.', 'The validation ledger is as important as the model. It must track quality metrics, human preference, artifact classes, latency, cost, and which requests still need the slower teacher.'] },
    { heading: 'How it works', paragraphs: ['Progressive distillation repeatedly halves the number of sampler steps. A 64-step teacher trains a 32-step student; that student can become the next teacher for a 16-step student, and so on.', 'Consistency models use a related idea: states along the same diffusion trajectory should map consistently to the same clean sample. This lets the model jump from noise toward data much more directly.'] },
    { heading: 'Complete case study', paragraphs: ['A real-time media product uses a two-step consistency model for previews, a four-step model for controlled edits, and the full teacher for expensive final assets. Requests that trip safety or quality gates do not use the fast path.', 'The launch dashboard records speed, quality, fallback rate, and artifact categories. If the few-step model is fast but creates unacceptable detail errors, the router narrows its use instead of declaring the whole method a failure.'] },
    { heading: 'Costs and tradeoffs', paragraphs: ['Few-step models reduce sequential sampling cost, but they can carry a quality gap from the teacher. They may also need expensive distillation data, careful loss weighting, and route-specific evaluation.', 'The product question is not whether two steps are possible. It is whether two steps are good enough for a particular task, with a measured fallback when they are not.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not compare only step count. A one-step sampler that harms quality, diversity, or controllability can be worse than a slower sampler. Do not trust one metric such as FID or one benchmark slice when the user-visible failure mode is different.', 'A second trap is failing to preserve the teacher fallback. Distillation should narrow expensive compute, not remove the safety valve before the quality frontier is understood.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Consistency Models at https://arxiv.org/abs/2303.01469, Progressive Distillation at https://arxiv.org/abs/2202.00512, and OpenAI sCM discussion at https://openai.com/index/simplifying-stabilizing-and-scaling-continuous-time-consistency-models/. Study Diffusion Models, Knowledge Distillation, Benchmark Variance Model Selection, LLM Inference Scaling Playbook, and Diffusion LLM Serving Scheduler next.'] },
  ],
};
