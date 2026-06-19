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
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Consistency Distillation Few-Step Diffusion Case Study. A case study for making diffusion fast: teacher trajectories, consistency targets, progressive halving, one-step and two-step sampling, quality gaps, and deployment gates..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Diffusion models produce strong images, audio, and video because they denoise gradually. The cost is latency: a sampler may need dozens or hundreds of model evaluations before it reaches a clean sample.',
        'Consistency distillation exists to make that sampler usable in interactive products. It trains a student model to take much larger jumps along the same denoising path, so preview, editing, and serving routes can use one or a few steps instead of a long sequential chain.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The baseline diffusion sampler starts from noise and applies many small denoising updates. Each update is conservative. The model only has to repair a little uncertainty at a time, which is why the final sample can be high quality.',
        'A reasonable speed hack is to skip steps or use a shorter hand-tuned schedule. That helps until the jumps become too large. Then details wash out, conditioning weakens, and artifacts appear because the model was trained for a slower trajectory.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is sequential work. If a request needs 50 denoising evaluations, the runtime cannot stream a finished sample after the fifth one. GPU batching helps throughput, but the critical path is still long for each sample.',
        'The second wall is evaluation. A faster sampler can look fine on one metric and fail on the product task. Face details, text rendering, edit faithfulness, diversity, and safety behavior can degrade in ways that a single FID-style number will not catch.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Progressive distillation trains a shorter sampler from a longer deterministic teacher. A 64-step teacher trains a 32-step student. That student can become the teacher for 16 steps, then 8, then 4. Each round halves the step budget while trying to keep the student on the teacher trajectory.',
        'Consistency models use a related target. Points from the same probability-flow trajectory should map to the same clean sample. The model learns a function that sends noisy states at different times back toward the same x0 endpoint.',
        'The practical records are teacher trajectories, paired noisy states, clean targets, student predictions, time or noise levels, loss weights, sampler budgets, quality scores, and fallback routes. Without that ledger, speed claims are hard to debug.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The point is not merely to remove sampler steps. The point is to teach a student model that far-apart noisy states on the same trajectory should agree about the same clean sample. Once that agreement is learned, inference can take larger jumps without asking the model to invent the path from scratch.',
        'This turns a slow iterative process into a learned shortcut. The shortcut is useful only when it preserves the behavior users care about: prompt adherence, structure, identity, safety, and artifact quality.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The training signal turns a long path into endpoint agreement. If two noisy states came from the same underlying sample, the student is penalized when it maps them to different clean results. That consistency gives the model permission to jump farther at inference.',
        'The teacher matters because it supplies a path that already works. The student is not guessing how to denoise from scratch in one leap. It is learning to approximate a known sampler under a shorter compute budget.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Inference cost drops roughly with the number of model evaluations on the critical path. A two-step sampler can be far cheaper than a 50-step sampler if the model size and batching behavior are similar.',
        'Training cost moves in the other direction. Distillation needs teacher runs, stored or recomputed pairs, careful noise schedules, loss weighting, and validation across routes. The cheaper runtime is bought with an extra training and evaluation pipeline.',
        'The quality frontier is the real artifact. One step may be fast but brittle. Two to eight steps often give a better speed-quality tradeoff. More steps move the student closer to teacher behavior but give back some latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Few-step diffusion wins when users need fast approximations more than perfect final samples. Preview images, interactive editing, rapid design exploration, and low-latency media generation can route many requests through a distilled sampler.',
        'It also wins when a product can tier quality. A fast model can produce candidates, a slower route can refine selected results, and the full teacher can handle expensive final assets or high-risk prompts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A one-step or two-step student can lose detail, diversity, prompt faithfulness, or edit control. The failure may be small in aggregate metrics but obvious to users when hands, text, geometry, or fine texture matter.',
        'Distillation can also preserve teacher biases while adding new artifacts. If the teacher struggles on a distribution slice, the student usually does not fix that slice by being faster. It may make the weak cases harder to detect because the output arrives with less visible uncertainty.',
        'Removing the teacher fallback too early is a deployment error. Distillation should reduce expensive sampling volume. It should not remove the slow path before the product knows which requests the fast path cannot handle.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A media editor can use a two-step consistency model for thumbnails, a four-step model for controlled edits, and the original teacher for final hero images. The router sends unsafe prompts to policy handling before spending GPU time and sends high-risk quality requests to the slower sampler.',
        'The dashboard should track sampler choice, p50 and p99 latency, GPU cost, human preference, artifact categories, fallback rate, and route-specific failures. If the fast model is excellent for previews but weak for final text rendering, the product narrows the route instead of calling the method a failure.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Keep teacher version, student version, noise schedule, timestep pairing, loss weighting, sampler step count, and evaluation slice in the same experiment ledger. Few-step claims are hard to interpret if the teacher changed or if the student was evaluated on easier prompts.',
        'Evaluate by route. A two-step preview sampler, a four-step edit sampler, and a full teacher route have different jobs. Track their latency, cost, fallback rate, and failure categories separately instead of collapsing them into one quality number.',
        'Preserve a slow path. The distilled model should reduce how often expensive sampling is needed, not remove the ability to recover quality when the fast path is uncertain.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use consistency distillation when latency is part of the product experience and the domain tolerates a measured quality-speed tradeoff. It is especially useful for previews, ideation, and interactive editing.',
        'Do not use it as a blanket replacement for the teacher until difficult slices have been tested. The fastest route should earn trust per workload, not inherit trust from the full sampler.',
        'The right question is not "can we sample in two steps?" The right question is "which requests can safely use two steps, what quality debt appears, and when should the system fall back?"',
        'A strong rollout usually starts with a narrow route. Put the distilled sampler where speed is visibly valuable, keep teacher comparison data flowing, and expand only after the failure categories are boring and measured across representative prompts, formats, and latency tiers.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Consistency Models at https://arxiv.org/abs/2303.01469, Progressive Distillation at https://arxiv.org/abs/2202.00512, and OpenAI sCM discussion at https://openai.com/index/simplifying-stabilizing-and-scaling-continuous-time-consistency-models/.',
        'Study Diffusion Models first, then Knowledge Distillation, Benchmark Variance Model Selection, Diffusion LLM Serving Scheduler, and any topic on inference routing or quality evaluation. The useful next question is not whether a sampler is fast; it is which requests can safely use the fast route.',
      ],
    },
  

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for consistency-distillation-few-step-diffusion-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
