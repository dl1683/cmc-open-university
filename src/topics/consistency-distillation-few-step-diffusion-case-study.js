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
    { title: 'Simplifying, Stabilizing, and Scaling Continuous-Time Consistency Models', url: 'https://arxiv.org/abs/2410.11081' },
    { title: 'Improved Techniques for Training Consistency Models', url: 'https://arxiv.org/abs/2310.14189' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Teacher student" traces how a long denoising trajectory is compressed into a short student path through consistency distillation. "Quality frontier" plots the speed-quality tradeoff across sampler budgets and shows routing decisions for a tiered deployment.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current stage: a teacher step being executed, a student jump being trained, or a quality gate being checked.',
            'Compare (blue) nodes show the alternative the current step is measured against -- typically the teacher trajectory that the student must approximate.',
            'Found (green) nodes are committed outcomes: a consistency target confirmed, a quality gate passed, or a deployment route cleared.',
          ],
        },
        'In the progressive-halving ledger, each row is one distillation round. The risk column tracks what degrades at each compression level. In the consistency-target matrix, rows are paired noisy states and the clean sample they must agree on.',
        {
          type: 'note',
          text: 'The safe inference rule: if two noisy states came from the same probability-flow trajectory, their predicted clean endpoints should match. Every animation frame shows that agreement being compressed into fewer neural-network calls. Watch for the moment the student path diverges from the teacher -- that is where the quality gap lives.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'Diffusion models have achieved unprecedented quality in image, video, and audio generation, but their iterative sampling procedure requires tens to hundreds of sequential neural network evaluations, making them slow for interactive applications.',
          attribution: 'Song et al., "Consistency Models" (2023), Section 1',
        },
        'Diffusion sampling buys quality with sequential work. A request starts from pure noise and calls a neural network repeatedly -- 20, 50, or 1,000 times -- to walk toward a clean image, audio clip, or video frame. Each call depends on the previous output. GPU batching improves throughput across requests but does not shorten the per-sample critical path.',
        {
          type: 'table',
          headers: ['Sampler steps', 'Latency at 40ms/eval', 'Use case fit', 'User experience'],
          rows: [
            ['1,000 (DDPM)', '40 seconds', 'Research only', 'Unusable for any product'],
            ['50 (DDIM)', '2 seconds', 'Batch generation', 'Acceptable for queued jobs'],
            ['20 (DPM-Solver)', '800ms', 'Near-interactive', 'Workable with loading indicator'],
            ['2 (distilled)', '80ms', 'Real-time preview', 'Feels instant; enables drag-to-edit'],
            ['1 (consistency)', '40ms', 'Inline generation', 'Faster than a network round-trip'],
          ],
        },
        'That gap between 2 seconds and 80 milliseconds is the difference between a batch pipeline and an interactive tool. A designer dragging a strength slider, an editor painting an inpainting mask, or a chat interface generating inline images needs sub-second feedback. Consistency distillation exists to close that gap by training a student model to take large jumps along the teacher trajectory while landing on the same clean endpoint.',
        {type:'callout', text:'Few-step diffusion works when the student preserves the teacher endpoint invariant, not when it merely skips sampler steps.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/99/X-Y_plot_of_algorithmically-generated_AI_art_of_European-style_castle_in_Japan_demonstrating_DDIM_diffusion_steps.png', alt:'A grid of Stable Diffusion DDIM outputs from random noise to a castle image as sampler steps increase.', caption:'DDIM sampling steps demonstration. Source: Wikimedia Commons, Benlisquare, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is to skip steps. Keep the trained diffusion model, choose a coarser timestep schedule (say every 5th step instead of every step), and hope the denoiser can cover more distance per call. DDIM and DPM-Solver do exactly this with clever ODE discretization. It works for mild reductions -- 1,000 steps down to 20-50 -- because the underlying ODE is smooth enough to tolerate larger steps.',
        {
          type: 'diagram',
          text: 'Step-skipping vs. distillation:\n\n  Step-skipping (same model, coarser schedule):\n    x_T --> x_80 --> x_60 --> x_40 --> x_20 --> x_0\n    5 evaluations, same weights, larger jumps per step\n\n  Progressive distillation (new model, learned jumps):\n    x_T --------> x_50 --------> x_0\n    2 evaluations, trained weights, each jump matches 25 teacher steps\n\n  Consistency model (one learned map):\n    x_T -----------------------------> x_0\n    1 evaluation, trained to map any noise level to the clean endpoint',
          label: 'Three strategies for reducing sampler steps, ordered by training investment',
        },
        'The second reasonable attempt is progressive distillation. Train a 32-step student from a 64-step teacher, then a 16-step student from the 32-step model, halving the budget each round. This works because each student only needs to match two teacher steps, not reinvent denoising from scratch.',
        {
          type: 'note',
          text: 'Neither approach is naive. Step-skipping exploits the smoothness of the probability-flow ODE. Progressive distillation exploits the fact that two small steps compose into one predictable large step. Both fail when the jumps become large enough that the model must handle qualitatively different noise levels in a single call.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is error accumulation across large jumps. A denoiser trained for small noise intervals is being asked to cross a large interval in one step. At small intervals, the ODE is nearly linear and a single Euler step is accurate. At large intervals, the curvature of the probability-flow ODE causes the single-step prediction to drift off the true trajectory. Details wash out, conditioning weakens, and modes collapse.',
        {
          type: 'table',
          headers: ['Attempt', 'Why it helps', 'Precise wall', 'Failure signal'],
          rows: [
            ['Skip steps (DDIM/DPM)', 'No retraining; ODE solvers handle moderate jumps', 'ODE curvature causes drift at large step sizes', 'Blurry output, weak conditioning below ~10 steps'],
            ['Progressive halving', 'Student matches two teacher steps; incremental', 'Each round inherits + amplifies the previous gap', 'Quality falls sharply after round 4 (8 -> 4 steps)'],
            ['One-step shortcut', 'Minimum possible latency', 'Single map must cover all noise levels and all modes', 'Mode collapse, texture loss, prompt drift'],
            ['Route everything fast', 'Simple serving architecture', 'Different routes have different error budgets', 'Preview looks fine; final asset has artifacts in hands, text, geometry'],
          ],
        },
        'The second wall is measurement. A distilled sampler can cut p99 latency by 10x while silently degrading edit faithfulness, text legibility, subject identity, or diversity. Aggregate metrics like FID average over easy and hard prompts. A model that nails landscapes but mangles typography will score well on FID while failing on the prompts users care about most.',
        {
          type: 'note',
          text: 'The Salimans and Ho progressive distillation paper (2022) reports that quality degrades gracefully from 1,024 steps to 8 steps, then falls sharply at 4 and 2 steps. The "cliff" is not at a fixed step count -- it depends on the model architecture, the noise schedule, and the distribution complexity. The only way to find it is to measure per-slice quality at each budget.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Points on the same probability-flow trajectory should predict the same clean sample. If x_t (a noisy state at time t) and x_s (a less noisy state at time s < t) both came from the same underlying image x_0, then a well-trained consistency function f should satisfy f(x_t, t) = f(x_s, s) = x_0. Once this invariant is learned, inference can evaluate f at any noise level and jump directly to the clean endpoint.',
        {
          type: 'diagram',
          text: 'Consistency function invariant:\n\n  Probability-flow ODE trajectory for one sample:\n\n    x_T (pure noise)                             x_0 (clean)\n     |                                            ^\n     +---> x_t ----> x_s ----> x_r ----> ... --->+\n            |         |         |                 |\n            v         v         v                 |\n         f(x_t,t)  f(x_s,s)  f(x_r,r)            |\n            \\         |         /                 |\n             \\        |        /                  |\n              +-------+-------+                   |\n                      |                           |\n                      v                           |\n               all equal to x_0  <================+\n\n  The consistency function maps every point on the\n  trajectory to the same clean endpoint.',
          label: 'Self-consistency: all points on one ODE trajectory predict the same x_0',
        },
        'This reframes the problem. The student does not need to learn a multi-step denoising recipe. It needs to learn a single function that is self-consistent along trajectories. The teacher provides the trajectories; the consistency loss enforces the agreement.',
        {
          type: 'code',
          language: 'python',
          text: '# The consistency target in one equation\n#\n# Given: x_t and x_s on the same ODE trajectory (t > s),\n#        teacher provides x_s = ODE_step(x_t, t, s)\n#\n# Loss:  || f_theta(x_t, t) - stopgrad(f_theta(x_s, s)) ||^2\n#\n# Boundary condition: f_theta(x, epsilon) = x  (near-clean input)\n#\n# At convergence: f_theta(x_t, t) = x_0 for all t,\n#                 so one evaluation at any noise level\n#                 recovers the clean sample.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The distillation pipeline has four components: trajectory generation, pair sampling, consistency training, and progressive curriculum.',
        {
          type: 'diagram',
          text: 'Distillation pipeline:\n\n  1. Trajectory generation\n     Teacher model + ODE solver --> deterministic paths from x_0 to x_T\n\n  2. Pair sampling\n     Pick (x_t, t) and (x_s, s) on the same path, t > s\n     Teacher provides x_s = ODE_step(x_t, t, s)\n\n  3. Consistency training\n     Student predicts f(x_t, t) and f(x_s, s)\n     Loss = distance( f(x_t,t), stopgrad(f(x_s,s)) )\n     Boundary: f(x, eps) = x\n\n  4. Progressive curriculum\n     Start with adjacent pairs (t close to s)\n     Gradually increase the gap (t far from s)\n     Final model handles any (t, s) pair in one jump',
          label: 'Four-stage pipeline from teacher trajectories to one-step student',
        },
        'The teacher is frozen. It generates deterministic ODE trajectories that define the "correct" denoising path. The student never sees the teacher weights -- only its outputs. This means the student architecture can differ from the teacher (smaller, different parameterization, different noise conditioning).',
        {
          type: 'code',
          language: 'python',
          text: '# Pseudocode: one consistency-distillation training step\n\ndef train_step(student, teacher, ema_student, images, schedule):\n    # Sample noise level pair from curriculum\n    t_far, t_near = schedule.sample_pair()      # t_far > t_near\n    noise = torch.randn_like(images)\n    x_far = add_noise(images, noise, t_far)\n\n    # Teacher produces the "next point" on the ODE trajectory\n    with torch.no_grad():\n        x_near = teacher.ode_step(x_far, t_far, t_near)\n\n    # Student predicts clean endpoint from both noise levels\n    pred_far  = student(x_far, t_far)\n    with torch.no_grad():\n        pred_near = ema_student(x_near, t_near)   # EMA target\n\n    # Consistency loss: predictions should agree\n    loss = huber_loss(pred_far, pred_near)\n    loss.backward()\n\n    # Update EMA target (slow-moving average of student)\n    ema_update(ema_student, student, decay=0.9999)\n    return loss.item()',
        },
        {
          type: 'note',
          text: 'The EMA (exponential moving average) target is a stabilization trick from Song et al. (2023). Instead of using a stop-gradient on the student itself, the target network is a slowly-updated copy. This prevents oscillation where the student chases its own moving predictions. The decay rate (typically 0.999-0.9999) controls how quickly the target tracks the student.',
        },
        'Progressive curriculum matters. Early training uses adjacent timestep pairs (small gap between t_far and t_near). The student only needs to match one teacher step. As training proceeds, the gap widens: the student must match 2, 4, 8, and eventually all teacher steps in a single jump. This is easier to optimize than asking for one-step accuracy from the start.',
        {
          type: 'table',
          headers: ['Curriculum stage', 'Pair gap', 'Student task', 'Difficulty'],
          rows: [
            ['Early', 't_far - t_near = 1 step', 'Match one teacher step', 'Easy: nearly linear ODE segment'],
            ['Middle', 't_far - t_near = 4-8 steps', 'Match a short sub-trajectory', 'Moderate: some curvature to learn'],
            ['Late', 't_far - t_near = full range', 'Map any noise to clean in one jump', 'Hard: must handle all noise levels'],
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on three properties of the probability-flow ODE.',
        {
          type: 'bullets',
          items: [
            'Determinism: given x_0 and a noise schedule, the forward ODE produces a unique trajectory. Two different clean images produce two different trajectories that never cross (under mild regularity conditions).',
            'Invertibility: the reverse ODE, starting from x_T, traces the trajectory back to x_0. The teacher sampler approximates this reverse ODE numerically.',
            'Self-consistency: any function that maps all points on one trajectory to the same value is a valid consistency function. The canonical choice is the clean endpoint x_0.',
          ],
        },
        {
          type: 'quote',
          text: 'We propose to learn model outputs to be consistent for arbitrary pairs of (x_t, t) that belong to the same PF ODE trajectory. We call such models consistency models.',
          attribution: 'Song et al., "Consistency Models" (2023), Section 3',
        },
        'The training loss enforces this self-consistency empirically. If the loss converges to zero on a diverse training set, the student has learned a function that agrees along trajectories. At inference, evaluating this function at any noise level returns (approximately) the clean endpoint.',
        'Progressive distillation has a related induction argument. If the k-step teacher approximates the true ODE within error epsilon, and the k/2-step student matches each pair of teacher steps within error delta, then the student approximates the ODE within epsilon + delta. The quality degrades additively with each halving round, which is why the cliff appears after 3-4 rounds (8x or 16x compression).',
        {
          type: 'note',
          text: 'The proof is practical, not algebraic. The consistency invariant is learned from data, not guaranteed by construction. That is why the evaluation ledger -- measuring endpoint agreement on the specific prompts, styles, safety slices, and failure modes the product serves -- is part of the algorithmic story, not an afterthought.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Resource', 'Teacher (50-step)', 'Student (2-step)', 'Ratio'],
          rows: [
            ['Neural net evals per sample', '50', '2', '25x fewer'],
            ['Critical-path latency (40ms/eval)', '2,000ms', '80ms', '25x faster'],
            ['GPU memory per sample (KV cache)', 'Reused across steps', 'Reused across steps', 'Same model size'],
            ['Throughput (batch of 8, A100)', '~4 samples/s', '~100 samples/s', '~25x higher'],
            ['Training cost (distillation)', '0', '50-200 GPU-hours', 'One-time investment'],
          ],
        },
        'The 25x headline is for the neural-network-evaluation bottleneck only. Real end-to-end speedup is lower because VAE decode, safety classifiers, text encoding, CLIP scoring, memory transfers, and request overhead remain constant. A practical 50-step-to-2-step distillation might yield 8-15x wall-clock speedup depending on the serving stack.',
        'Training cost is nontrivial. The team must generate or cache teacher trajectories (one forward pass per training pair), store timestep-paired states, tune the curriculum schedule, choose the distance metric (L2, LPIPS, pseudo-Huber), set the EMA decay, and evaluate at multiple step budgets. A single distillation run for a 2B-parameter model on 512x512 images typically costs 50-200 A100-hours.',
        {
          type: 'table',
          headers: ['Step budget', 'Typical role', 'Dominant benefit', 'Dominant tax'],
          rows: [
            ['1 step', 'Instant thumbnail or draft', 'Lowest possible sequential latency', 'Highest mode-collapse and artifact risk'],
            ['2 steps', 'Interactive preview, drag-to-edit', 'Sub-100ms with one correction pass', 'Fragile on fine text, geometry, identity'],
            ['4-8 steps', 'Controlled edits, style transfer', 'Near-teacher prompt adherence', 'Returns some latency; still needs evaluation'],
            ['Teacher (20-50)', 'Final render, hero asset, fallback', 'Best known quality for hard prompts', 'High latency, high GPU cost per sample'],
          ],
        },
        {
          type: 'note',
          text: 'The right cost model is cost per accepted sample, not cost per generated sample. A one-step model that produces 30% rejected outputs (user retries, safety failures, artifact rejections) may cost more in practice than a two-step model with 5% rejection. Track rejection rate and fallback rate alongside raw latency.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A media-generation product serves three routes: real-time preview while the user types a prompt, controlled inpainting/style edits on selected candidates, and final high-resolution hero assets. The engineering goal is to spend the minimum sampling work that meets each route contract.',
        {
          type: 'diagram',
          text: 'Routing architecture:\n\n  User prompt\n      |\n      v\n  [ Safety classifier ] --reject--> policy response (no GPU spend)\n      |\n      v\n  [ Route selector ]\n      |         |          |\n      v         v          v\n  Preview    Edit       Hero\n  2-step     4-step     Teacher\n  <100ms     <400ms     <3s\n      |         |          |\n      v         v          v\n  [ Quality gate: artifact detector + CLIP score ]\n      |                    |\n   pass --> serve      fail --> fallback to slower route',
          label: 'Tiered sampler routing with quality gates and fallback',
        },
        'The distillation pipeline runs offline. The team distills the 50-step DDIM teacher into a 2-step consistency model (for previews) and a 4-step progressive-distillation model (for edits). Both students are evaluated on held-out prompts covering text-in-image, faces, hands, geometric patterns, and safety-adjacent content.',
        {
          type: 'table',
          headers: ['Route', 'Sampler', 'Latency target', 'Gate metric', 'Fallback trigger'],
          rows: [
            ['Typing preview', '2-step CM', '<100ms', 'p95 latency; CLIP score > 0.28', 'Prompt contains text-rendering or precise-layout keywords'],
            ['Inpainting edit', '4-step PD', '<400ms', 'Edit faithfulness (LPIPS < 0.15 on mask boundary)', 'Identity drift > threshold or boundary artifacts'],
            ['Hero asset', '50-step teacher', '<3s', 'Human preference A/B > 50%; artifact audit clean', 'N/A (already on the slow path)'],
            ['Unsafe prompt', 'None', 'N/A', 'Policy classifier confidence > 0.95', 'Always reject before GPU spend'],
          ],
        },
        {
          type: 'code',
          language: 'python',
          text: '# Simplified route-selection logic\ndef select_route(prompt, user_tier):\n    if safety_classifier(prompt).score > 0.95:\n        return "reject"\n\n    features = prompt_analyzer(prompt)\n    if features.has_text_rendering or features.has_precise_layout:\n        return "hero"       # 2-step CM struggles with text\n    if features.is_edit and features.mask_area > 0.3:\n        return "edit_4step"  # large edits need more correction\n    if user_tier == "preview":\n        return "preview_2step"\n\n    return "edit_4step"      # default to moderate quality\n\n# Post-generation quality gate\ndef quality_gate(image, route, prompt):\n    clip_score = clip_similarity(image, prompt)\n    artifacts = artifact_detector(image)\n    if clip_score < ROUTE_THRESHOLDS[route] or artifacts.score > 0.3:\n        return fallback_to_slower_route(route)\n    return serve(image)',
        },
        'The dashboard tracks per-route metrics: sampler choice distribution, p50/p99 latency, GPU-seconds per accepted sample, fallback rate, human preference scores, and artifact category breakdown. A good launch starts narrow: the 2-step model serves only previews, and the fast route expands only after its failure categories are measured and boring.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'Fast route', 'Slow route', 'Why tiering matters'],
          rows: [
            ['Image generation (Midjourney, DALL-E)', '1-4 step preview grid', '20-50 step upscale/refine', 'Users browse 4 candidates fast, then refine one slowly'],
            ['Video generation (Runway, Sora)', '2-step keyframe preview', 'Full teacher for final render', 'Previewing 4-second clips at teacher speed would take minutes'],
            ['Audio synthesis (Stable Audio)', '1-step draft waveform', 'Teacher for master quality', 'Musicians need instant feedback on prompt changes'],
            ['Interactive inpainting', '2-step mask fill', '8-step final composite', 'Brush strokes must feel real-time; final save can wait'],
            ['Latent upscaling', '1-step super-resolution', '4-step with detail refinement', 'Low-res preview is instant; high-res is a batch job'],
            ['Real-time avatar/face', '1-step consistency model', 'Teacher on keyframes', 'Webcam-speed generation requires <33ms per frame'],
          ],
        },
        'The common pattern: distilled models are routing primitives, not universal replacements. The fast model handles the high-volume, latency-sensitive, error-tolerant slice. The teacher handles the low-volume, quality-critical, error-intolerant slice. The router decides which requests go where.',
        {
          type: 'note',
          text: 'Stability AI released Stable Diffusion Turbo (SD-Turbo) in late 2023, a consistency-distilled model that generates 512x512 images in a single step. It demonstrates the practical tradeoff: single-step generation is dramatically faster but produces softer textures and weaker fine detail compared to the 20-step teacher. The product use case is real-time preview, not final-quality output.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Text rendering: diffusion models already struggle with legible text in images. Distilled models amplify this because text requires precise high-frequency detail that large jumps tend to blur. A 2-step model may produce plausible letterforms at a glance but unreadable text at full resolution.',
            'Identity preservation: face identity, character consistency across frames, and subject fidelity require the model to maintain fine-grained features across the denoising trajectory. Large jumps can drift identity, producing faces that are plausible but wrong.',
            'Geometric precision: architectural renders, technical diagrams, and symmetrical patterns need exact spatial relationships. The ODE curvature at large step sizes introduces spatial distortion that the teacher would have corrected incrementally.',
            'Diversity collapse: a one-step consistency model can mode-collapse to the mean of the posterior distribution, producing safe but repetitive outputs. The teacher explores more of the distribution because each small step adds controlled stochasticity.',
            'Teacher weakness inheritance: distillation transfers, not repairs, the teacher distribution. If the teacher fails on medical imagery, non-Latin scripts, or culturally specific content, the student inherits those failures with fewer correction opportunities.',
            'Premature teacher retirement: removing the slow fallback path before the system knows which requests the fast path cannot handle. Distillation should reduce expensive sampling volume, not eliminate the ability to recover quality.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Mitigation'],
          rows: [
            ['Mode collapse', 'Repeated similar outputs for diverse prompts', 'Use 2+ steps; add stochasticity in the first step'],
            ['Texture softening', 'Plausible composition but waxy/smooth surfaces', 'Increase step budget for texture-critical routes'],
            ['Prompt drift', 'Output ignores parts of complex prompts', 'Route complex prompts to teacher; evaluate per-attribute'],
            ['Artifact injection', 'New artifacts not in teacher output (color banding, edge halos)', 'Audit distillation loss curves; check for training instability'],
            ['Metric-reality gap', 'Low FID but users report worse quality', 'Add human preference eval and per-slice artifact tracking'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Song et al., "Consistency Models" (2023), arxiv:2303.01469', 'The foundational paper: self-consistency along PF ODE trajectories, one-step and few-step generation, consistency training and distillation'],
            ['Salimans & Ho, "Progressive Distillation" (2022), arxiv:2202.00512', 'The halving framework: 2x step reduction per round, deterministic teacher-student pairing, quality-budget tradeoff curves'],
            ['Song & Dhariwal, "Improved Consistency Training" (2023), arxiv:2310.14189', 'Practical stabilization: pseudo-Huber loss, adaptive curriculum, LPIPS distance, improved one-step quality'],
            ['Lu et al., "Simplifying, Stabilizing, and Scaling CT Consistency Models" (2024), arxiv:2410.11081', 'Continuous-time formulation: TrigFlow parameterization, adaptive weighting, scaling to 1.5B parameters on ImageNet 512x512'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Diffusion Models to understand the forward noising process, the reverse denoising SDE/ODE, and why many small steps produce high-quality samples.',
            'Prerequisite: study Knowledge Distillation for the general teacher-student framework, loss design, and capacity considerations.',
            'Extension: study Benchmark Variance and Model Selection to understand why a single FID number is insufficient for release decisions -- slice-level evaluation is mandatory for distilled models.',
            'Production: study Inference Routing or Diffusion LLM Serving Scheduler for the deployment architecture that selects sampler budgets per request based on prompt features, quality requirements, and cost constraints.',
            'Contrast: study Latent Consistency Models (LCM) for a variant that distills in latent space with classifier-free guidance, and Rectified Flow for an alternative trajectory-straightening approach that reduces the need for distillation.',
          ],
        },
      ],
    },
  ],
};
