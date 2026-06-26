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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the tree as search over partially denoised answers. Shared nodes are model work reused by several candidates, branch nodes are places where hypotheses diverge, and verifier nodes decide whether a branch deserves more compute. The safe inference is that branching is cheap only while candidate states still share enough denoising history.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Inference-time search improves answers by trying multiple candidates, but autoregressive search pays for each candidate token by token. A diffusion language model can fill many masked positions in parallel and delay commitment. That creates a chance to share early denoising work before splitting into separate candidate answers.',
        {type: 'callout', text: 'In diffusion search, the reusable prefix is shared model state, so the controller should branch only when uncertainty becomes decision-critical.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is beam search or tree-of-thought search. Keep several candidates, score them, and expand the best ones. This is reasonable because search can correct one bad path by keeping alternatives alive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is duplicated model work. If 8 branches each generate 200 tokens autoregressively, the server runs about 1,600 branch-token steps before verifier cost. Many early steps are similar, but the left-to-right cache treats each prefix as a separate path once the candidates diverge.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'In diffusion search, the shared prefix is not a text prefix. It is a shared denoising trajectory over a masked answer buffer. The controller should keep candidates together while uncertainty is broad, then branch only around slots where different hypotheses matter.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system starts with a masked buffer and runs shared denoising steps to expose high-confidence structure. It tracks mask bitsets, candidate ids, confidence margins, verifier scores, and a budget counter. When a key slot remains uncertain, the controller branches, runs branch-local denoising, asks a verifier to score support, and may remask weak conclusions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a search invariant. Shared work is valid only while all surviving candidates agree on the state being shared or while the masked positions have not committed candidate-specific facts. Once a branch commits different content, later denoising and verifier state must be tracked separately for that branch.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost benefit depends on how much work stays shared. If 8 candidates share 12 denoising steps and then each needs 4 branch-local steps, the run costs 12 + 8 * 4 = 44 step-units. Running all 8 independently for 16 steps would cost 128 step-units, so shared work cuts this stylized example by about 66 percent.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This fits reasoning, code repair, constrained generation, and answer verification where several candidates share a common problem setup. It is useful when the system can reveal premises before conclusions and when a verifier can reject unsupported branches. It also fits workloads where batch shape and mask state can be scheduled efficiently.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when candidates diverge early, when verifier scores are weak, or when mask scheduling commits fluent but unsupported text. The bookkeeping can also erase the gain: candidate trees, mask states, confidence margins, and cache versions all consume memory. A naive shared-prefix controller can be slower than ordinary beam search if it branches too late or shares invalid state.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a proof answer has 20 masked slots. After 6 shared denoising steps, 12 slots have confidence above 0.9, 5 slots are medium confidence, and 3 slots define the final claim. The controller keeps one shared state for the first 12 slots and creates 4 branches only for the 3 claim slots.',
        'Each branch then uses 5 local steps and one verifier call. Total denoising cost is 6 shared steps plus 4 * 5 local steps, or 26 step-units, instead of 4 * 11 = 44 if every candidate had run independently from the start. If the verifier rejects 2 branches, the remaining 2 can spend the saved budget on remasking the weakest medium-confidence slots.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Large Language Diffusion Models, LogicDiff, Diffusion-of-Thought, and Simple and Effective Masked Diffusion Language Models. Then study beam search, verifier-guided decoding, mask scheduling, confidence calibration, and diffusion LLM serving. The next engineering question is how to batch these candidate states without corrupting shared cache assumptions.',
      ],
    },
  ],
};
