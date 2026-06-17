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
      heading: 'Why this topic exists',
      paragraphs: [
        `Language-model search is usually explained with autoregressive models: generate the next token, branch into several possible next tokens, score the partial answers, and continue. That works, but it repeats a large amount of work. Every candidate has its own left-to-right path. The model also carries a separate KV-cache history for each surviving branch. Beam search, tree-of-thought search, and verifier-guided sampling can improve quality, but the bill rises quickly because each branch keeps asking the model to extend a different prefix.`,
        `Diffusion language models change the shape of the problem. They do not have to commit one token at a time from left to right. A masked diffusion model can start with a partly or fully masked sequence, denoise many positions in parallel, and decide later which slots deserve more attention. That makes a new inference-time search pattern possible. If several candidate answers share the same early denoising trajectory, the system can do the coarse work once, then branch only after the important uncertainties become visible.`,
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        `The first naive approach is to run the diffusion sampler independently for every candidate answer. If you want four candidates, you pay four complete denoising runs. This is simple to implement, and it keeps each candidate isolated, but it throws away the main advantage of a masked sampler. Early reverse steps often resolve broad structure that would have been common across candidates: answer length, rough argument shape, repeated context, and easy lexical slots. Recomputing those steps per branch is wasteful.`,
        `The second naive approach is to copy autoregressive search directly. The controller tries to build a token tree, ranks partial strings, and treats the current visible text as the only prefix that matters. That misses the important difference. In diffusion search, the reusable prefix is not necessarily a text prefix. It is a model state: a mask bitset, a partially denoised token buffer, confidence margins for hidden slots, and sometimes a reveal schedule. If the controller stores only strings, it cannot tell which candidates still share denoising work and which have already diverged.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Shared-prefix diffusion search treats early denoising as a common computation over a set of possible answers. The system waits to branch until the remaining masked positions are both uncertain and important. A branch is created when two or more hypotheses need different commitments: a different operator in a proof, a different repair in code, a different entity in a factual answer, or a different ordering of reasoning steps. Before that point, all candidates ride the same reverse process.`,
        `The word prefix is overloaded here. It does not mean "the first tokens in the sentence." It means "the common part of the inference state." Two candidates can share a denoising prefix even if they eventually place different words near the beginning of the final text, because those words may still be masked during the shared steps. The controller is trying to preserve the part of the computation that is still common, not a literal substring.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `A practical controller keeps a small set of data structures. The mask bitset records which slots are still hidden. The candidate tree records which branches came from which shared state. A confidence table records token margins or distributional uncertainty for each slot. A budget ledger records denoising steps, active candidates, verifier calls, and latency. A verifier or reward model scores branch quality. A scheduler decides which slots should be unmasked, remasked, or left for later.`,
        `One run might begin with a prompt and a masked answer buffer. The model performs several shared reverse steps, filling easy slots and giving the controller confidence estimates for hard ones. When the remaining uncertainty clusters around a few high-value positions, the controller forks candidates. Branch A tries one operator, branch B tries another, and branch C keeps the operator masked for another step. Each branch receives some local denoising budget. The verifier then scores support, consistency, syntax, or task-specific correctness, and weak branches are pruned or sent back for repair.`,
        `Logic scheduling adds another layer. Instead of revealing slots only because their token probabilities are sharp, the scheduler asks what role a slot plays in the answer. Premises should usually be visible before conclusions. Definitions should be settled before derived claims. Operators should be chosen before the final arithmetic or proof step is committed. The reveal order becomes a dependency policy, closer to a small reasoning DAG than to a plain confidence sort.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The shared tree view is proving that the branch point should come after useful common work, not before it. The prompt and mask buffer feed a shared denoising path. Only after the shared steps do the candidate branches separate. The important lesson is that search can be organized around reusable model state. A candidate tree is not just a list of strings; it is a record of which computations are still shared and which computations are branch-local.`,
        `The cost ledger makes the same point numerically. Shared steps cost about once, regardless of how many candidates will later exist. Branch-local steps multiply by the number of active candidates. That means the controller is always balancing two risks: branch too early and pay for duplicated work, or branch too late and let the model commit to a weak answer before alternatives are explored. The logic schedule view shows the semantic version of the same tradeoff. Reveal the support first, then let the conclusion compete.`,
      ],
    },
    {
      heading: 'Why it can work',
      paragraphs: [
        `The method works when early denoising contains information that is useful to many possible completions. Many prompts have this property. A proof answer may share the same premises across several final derivations. A code repair may share imports, function boundaries, and failing-test context before choosing the exact patch. A structured extraction may share schema and field order before resolving a difficult entity. In those cases, the sampler can spend parallel compute on shared structure and reserve branch-local compute for the few decisions that matter.`,
        `It also works because diffusion inference can expose uncertainty in a richer way than a committed token prefix. A masked slot can remain undecided while other slots become context. The controller can see that the conclusion is fluent but unsupported, remask it, and ask the model to denoise again after premises have stabilized. That is difficult in a strictly left-to-right sampler, where early commitments become part of the prompt for everything that follows.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The main cost is control-plane complexity. The serving system must batch candidates with compatible step counts, mask shapes, and model states. It must compact candidate trees so memory does not grow with every speculative branch. It must store enough evidence to explain why a branch was pruned. It must also decide when a verifier is worth calling, because a verifier can dominate latency if it runs on every low-quality branch.`,
        `There is also a quality tradeoff. A confidence margin is not the same as correctness. A logic schedule can enforce a sensible reveal order, but it cannot make a model understand the task. Remasking can repair premature commitments, but too much repair creates loops and latency spikes. The method should be judged against strong autoregressive baselines under the same latency and compute budget, not against a weak single-sample baseline.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `The natural uses are tasks where several candidate answers share context and differ at a small number of high-value decisions. Reasoning traces, proof search, code repair, symbolic planning, mathematical derivations, structured generation, and tool-call argument construction all fit that pattern. A verifier can check syntax, unit tests, schema validity, arithmetic consistency, source support, or domain rules. The search controller can spend extra denoising only on branches that might still pass those checks.`,
        `The same idea also matters for serving research. If diffusion LLMs become competitive for production text generation, the interesting systems question will not be only how many denoising steps a single answer needs. It will be how to schedule many masked buffers, how to share early steps across candidates, how to batch irregular repair loops, and how to account for verifier cost. Shared-prefix search is one possible answer to that scheduling problem.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `The method fails when branches diverge too early. If every candidate needs a different hidden state after one step, there is little shared work to amortize. It also fails when the verifier is weak. A biased verifier can prune the unusual but correct branch and keep the fluent branch. A noisy confidence policy can overcommit common phrases and make later repair harder. A bad logic parser can force the wrong reveal order and damage the model's natural generation process.`,
        `There are implementation limits too. Candidate state may be large. Mask patterns can make batching inefficient. Denoising step counts can be hard to compare across prompts. The method may improve average quality while hurting tail latency, which is unacceptable in many serving systems. The safest evaluation reports quality, latency distribution, accelerator utilization, verifier calls, branch counts, and failure slices, not just a single accuracy number.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources to read next are Large Language Diffusion Models, LogicDiff, Diffusion-of-Thought, and Simple and Effective Masked Diffusion Language Models. Inside this curriculum, study Discrete Diffusion Language Model Primer, Block Diffusion LLM Denoising Case Study, Diffusion LLM Serving Scheduler Case Study, Process Reward Models & Verifier Search, Tree of Thoughts Search Case Study, Speculative Decoding Runtime Controller Case Study, Transformer Inference Roofline, and LLM Continuous Batching. The useful mental bridge is this: diffusion changes what can be shared, but search still needs budgets, pruning rules, and evidence.`,
      ],
    },
  ],
};
