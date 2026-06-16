// Diffusion inference search: share early denoising work across candidate
// branches, then spend extra steps only where candidates diverge.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'diffusion-inference-search-shared-prefix-case-study',
  title: 'Diffusion Inference Search Shared Prefix Case Study',
  category: 'AI & ML',
  summary: 'A diffusion-LLM inference case study: share early denoising steps across branches, then use confidence, logic order, and verifiers to spend search compute where it matters.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shared denoise tree', 'logic schedule'], defaultValue: 'shared denoise tree' },
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

function sharedTree(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.7, y: 3.6, note: 'task' },
      { id: 'mask', label: 'mask buf', x: 2.3, y: 3.6, note: 'slots' },
      { id: 's1', label: 'shared s1', x: 4.0, y: 3.6, note: 'denoise' },
      { id: 's2', label: 'shared s2', x: 5.7, y: 3.6, note: 'denoise' },
      { id: 'a', label: 'branch A', x: 7.4, y: 1.8, note: 'candidate' },
      { id: 'b', label: 'branch B', x: 7.4, y: 3.6, note: 'candidate' },
      { id: 'c', label: 'branch C', x: 7.4, y: 5.4, note: 'candidate' },
      { id: 'verify', label: 'verifier', x: 9.2, y: 3.6, note: 'score' },
    ],
    edges: [
      { id: 'e-prompt-mask', from: 'prompt', to: 'mask' },
      { id: 'e-mask-s1', from: 'mask', to: 's1' },
      { id: 'e-s1-s2', from: 's1', to: 's2' },
      { id: 'e-s2-a', from: 's2', to: 'a' },
      { id: 'e-s2-b', from: 's2', to: 'b' },
      { id: 'e-s2-c', from: 's2', to: 'c' },
      { id: 'e-a-verify', from: 'a', to: 'verify' },
      { id: 'e-b-verify', from: 'b', to: 'verify' },
      { id: 'e-c-verify', from: 'c', to: 'verify' },
    ],
  }, { title });
}

function* sharedDenoiseTree() {
  yield {
    state: sharedTree('Branch after shared denoising, not before'),
    highlight: { active: ['prompt', 'mask', 's1', 's2', 'e-prompt-mask', 'e-mask-s1', 'e-s1-s2'], found: ['a', 'b', 'c'] },
    explanation: 'Autoregressive search usually pays for each candidate path token by token. A diffusion sampler can share early denoising steps while candidates are still mostly masked, then branch only when the uncertain slots need different hypotheses.',
    invariant: 'Branching is cheapest before candidate states diverge too far.',
  };

  yield {
    state: labelMatrix(
      'Shared-step cost ledger',
      [
        { id: 's0', label: 'step 0' },
        { id: 's1', label: 'step 1' },
        { id: 's2', label: 'step 2' },
        { id: 's3', label: 'step 3' },
        { id: 's4', label: 'step 4' },
      ],
      [
        { id: 'shared', label: 'shared' },
        { id: 'branches', label: 'branches' },
        { id: 'mask', label: 'masks' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['yes', '1', '100%', '1x'],
        ['yes', '1', '72%', '1x'],
        ['yes', '1', '45%', '1x'],
        ['no', '4', '22%', '4x'],
        ['no', '4', '5%', '4x'],
      ],
    ),
    highlight: { active: ['s0:shared', 's1:shared', 's2:shared'], compare: ['s3:branches', 's4:branches'], found: ['s4:mask'] },
    explanation: 'The ledger separates shared denoise work from branch-local work. The search controller should know how many candidates exist, how many masks remain, and when shared work stops being valid.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'candidate quality', min: 0, max: 1 }, y: { label: 'relative compute', min: 0, max: 4.4 } },
      series: [
        { id: 'single', label: 'single diffusion', points: [{ x: 0.58, y: 1.0 }, { x: 0.66, y: 1.1 }, { x: 0.72, y: 1.2 }] },
        { id: 'shared', label: 'shared search', points: [{ x: 0.68, y: 1.2 }, { x: 0.78, y: 1.5 }, { x: 0.84, y: 1.7 }] },
        { id: 'ar', label: 'AR branches', points: [{ x: 0.70, y: 3.2 }, { x: 0.80, y: 3.8 }, { x: 0.85, y: 4.0 }] },
      ],
      markers: [
        { id: 'frontier', x: 0.84, y: 1.7, label: 'frontier' },
      ],
    }),
    highlight: { active: ['shared', 'frontier'], compare: ['ar'] },
    explanation: 'The numbers are stylized, but the frontier is the point: search can become cheaper when candidates share early denoising work. Real systems must measure step count, batch shape, verifier quality, and cache behavior.',
  };

  yield {
    state: labelMatrix(
      'Search controller state',
      [
        { id: 'mask', label: 'mask bits' },
        { id: 'tree', label: 'branch tree' },
        { id: 'conf', label: 'confidence' },
        { id: 'verify', label: 'verifier' },
        { id: 'budget', label: 'budget' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['hidden slots', 'stale'],
        ['candidates', 'blowup'],
        ['margins', 'overcommit'],
        ['scores', 'bias'],
        ['steps', 'latency'],
      ],
    ),
    highlight: { active: ['tree:stores', 'conf:stores', 'budget:stores'], compare: ['verify:failure'] },
    explanation: 'The data structures are familiar: mask bitsets, candidate trees, confidence margins, verifier scores, and budget counters. The novelty is that the shared prefix is a denoising trajectory rather than a left-to-right token prefix.',
  };
}

function* logicSchedule() {
  yield {
    state: labelMatrix(
      'Logic-aware reveal order',
      [
        { id: 'prem1', label: 'premise 1' },
        { id: 'prem2', label: 'premise 2' },
        { id: 'op', label: 'operator' },
        { id: 'bridge', label: 'bridge' },
        { id: 'concl', label: 'conclusion' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'when', label: 'when' },
        { id: 'why', label: 'why' },
      ],
      [
        ['fact', 'early', 'anchor'],
        ['fact', 'early', 'anchor'],
        ['rule', 'middle', 'compose'],
        ['link', 'middle', 'support'],
        ['answer', 'late', 'derive'],
      ],
    ),
    highlight: { active: ['prem1:when', 'prem2:when', 'op:when'], found: ['concl:when'] },
    explanation: 'A logic schedule does not reveal tokens only by local confidence. It asks which slots should become context first. Premises should usually anchor the denoising process before the conclusion is committed.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'roles', label: 'role tags', x: 0.8, y: 3.5, note: 'premise' },
        { id: 'dag', label: 'logic DAG', x: 2.8, y: 3.5, note: 'deps' },
        { id: 'queue', label: 'unmask q', x: 4.8, y: 3.5, note: 'priority' },
        { id: 'denoise', label: 'denoise', x: 6.8, y: 3.5, note: 'steps' },
        { id: 'verify', label: 'verify', x: 8.7, y: 3.5, note: 'reason' },
        { id: 'repair', label: 'repair', x: 6.8, y: 5.3, note: 'remask' },
      ],
      edges: [
        { id: 'e-roles-dag', from: 'roles', to: 'dag' },
        { id: 'e-dag-queue', from: 'dag', to: 'queue' },
        { id: 'e-queue-denoise', from: 'queue', to: 'denoise' },
        { id: 'e-denoise-verify', from: 'denoise', to: 'verify' },
        { id: 'e-verify-repair', from: 'verify', to: 'repair' },
        { id: 'e-repair-queue', from: 'repair', to: 'queue' },
      ],
    }, { title: 'A scheduler turns logical dependencies into unmask priority' }),
    highlight: { active: ['dag', 'queue', 'denoise', 'e-dag-queue', 'e-queue-denoise'], found: ['verify'] },
    explanation: 'The scheduler can be represented as a small dependency DAG. Slots that support many later claims get high priority. A verifier can remask unsupported conclusions and send them back to the queue.',
  };

  yield {
    state: labelMatrix(
      'Confidence-only versus logic-guided',
      [
        { id: 'first', label: 'first slots' },
        { id: 'middle', label: 'middle' },
        { id: 'last', label: 'last' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'conf', label: 'confidence' },
        { id: 'logic', label: 'logic guided' },
      ],
      [
        ['easy words', 'premises'],
        ['phrases', 'rules'],
        ['hard words', 'conclusion'],
        ['fluent wrong', 'needs parser'],
      ],
    ),
    highlight: { active: ['first:logic', 'middle:logic', 'last:logic'], compare: ['risk:conf'] },
    explanation: 'Confidence-only decoding can commit fluent but unsupported conclusions early. Logic-guided decoding tries to reveal the evidence first, then the operation, and only then the final claim.',
  };

  yield {
    state: sharedTree('Verifier closes the diffusion search loop'),
    highlight: { active: ['a', 'b', 'c', 'verify', 'e-a-verify', 'e-b-verify', 'e-c-verify'], found: ['s2'], compare: ['prompt'] },
    explanation: 'The full architecture is a search loop: share early denoising, branch where uncertainty matters, apply a reasoning verifier, remask weak branches, and emit only after the mask buffer and verifier agree.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shared denoise tree') yield* sharedDenoiseTree();
  else if (view === 'logic schedule') yield* logicSchedule();
  else throw new InputError('Pick a diffusion inference search view.');
}

export const article = {
  references: [
    { title: 'Large Language Diffusion Models', url: 'https://arxiv.org/abs/2502.09992' },
    { title: 'LogicDiff', url: 'https://arxiv.org/abs/2602.15174' },
    { title: 'Diffusion-of-Thought', url: 'https://arxiv.org/abs/2402.07754' },
    { title: 'Simple and Effective Masked Diffusion Language Models', url: 'https://s-sahoo.com/mdlm/' },
  ],
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Diffusion inference search is the idea that non-autoregressive language generation can explore candidate completions by sharing early denoising steps, then branching only where uncertainty matters. The shared prefix is not a text prefix. It is a partially denoised token buffer plus a mask bitset.',
        'The local diffusion-inference notes emphasize the hardware implication: autoregressive decoding is often memory-bandwidth trapped by serial token generation and KV-cache residency, while diffusion generation can shift more work into parallel denoising batches. This case study adds a search controller on top.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A masked diffusion sampler starts with many hidden slots. Early reverse steps produce broad structure that can be shared by all candidate branches. Later, when high-value uncertain slots remain, the controller forks candidates, commits different hypotheses, and scores them with confidence rules or a verifier.',
        'The same mechanism can support a logic schedule. Instead of revealing tokens only by local confidence, the scheduler gives priority to premises, definitions, and operators before conclusions. That makes the denoising order closer to a reasoning dependency graph.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Suppose a reasoning answer has five regions: two premises, one operator, one bridge, and one conclusion. A confidence-only sampler might reveal the conclusion early because it is a common phrase. A logic-guided sampler reveals the premises first, then the operator, then the bridge, and leaves the conclusion masked until enough support exists.',
        'For search, the first several denoise steps are shared across all branches. Branch A tries one operator, branch B tries another, and branch C keeps the operator masked for one more step. A verifier scores support consistency, rejects unsupported branches, and can remask the conclusion if it was committed too early.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost ledger tracks shared steps, branch-local steps, mask count, candidates, and verifier calls. Search is attractive only when shared denoising is large enough to offset branch expansion. If every branch diverges immediately, the method loses its advantage.',
        'Serving complexity is real. The scheduler must batch by step count and mask count, keep candidate trees compact, avoid overcommitting low-confidence tokens, and compare quality against autoregressive baselines with the same latency budget.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Parallel denoising does not automatically mean faster or better inference. If a model needs many reverse steps, if confidence gates are weak, or if cache reuse is poor, production latency can disappoint. The search controller must be evaluated end to end.',
        'A second misconception is that logic scheduling solves reasoning by itself. It is a control policy over token reveal order. It still needs a model that understands the task, a verifier that can detect unsupported claims, and evaluation slices that catch fluent wrong answers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Large Language Diffusion Models at https://arxiv.org/abs/2502.09992, LogicDiff at https://arxiv.org/abs/2602.15174, Diffusion-of-Thought at https://arxiv.org/abs/2402.07754, and Masked Diffusion Language Models at https://s-sahoo.com/mdlm/. Study Discrete Diffusion Language Model Primer, Block Diffusion LLM Denoising Case Study, Diffusion LLM Serving Scheduler Case Study, Process Reward Models & Verifier Search, Transformer Inference Roofline, and LLM Inference Scaling Playbook next.',
      ],
    },
  ],
};
