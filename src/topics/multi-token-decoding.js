// Multi-token decoding: reduce autoregressive latency by proposing several
// future tokens per model step, then verify candidates without changing output.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-token-decoding',
  title: 'Multi-Token Decoding',
  category: 'AI & ML',
  summary: 'Medusa heads, tree attention, and Lookahead-style n-gram verification for reducing LLM decode steps.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['medusa heads', 'lookahead decoding'], defaultValue: 'medusa heads' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function medusaGraph(title) {
  return graphState({
    nodes: [
      { id: 'backbone', label: 'backbone LLM', x: 1.0, y: 3.8, note: 'frozen or tuned' },
      { id: 'h1', label: 'head +1', x: 3.2, y: 1.4, note: 'next token' },
      { id: 'h2', label: 'head +2', x: 3.2, y: 3.2, note: 'two ahead' },
      { id: 'h3', label: 'head +3', x: 3.2, y: 5.0, note: 'three ahead' },
      { id: 'tree', label: 'candidate tree', x: 5.7, y: 3.2, note: 'parallel branches' },
      { id: 'verify', label: 'tree attention', x: 7.7, y: 3.2, note: 'one pass check' },
      { id: 'emit', label: 'accepted prefix', x: 9.0, y: 3.2, note: 'advance output' },
    ],
    edges: [
      { id: 'e-b-h1', from: 'backbone', to: 'h1', weight: 'hidden state' },
      { id: 'e-b-h2', from: 'backbone', to: 'h2', weight: 'hidden state' },
      { id: 'e-b-h3', from: 'backbone', to: 'h3', weight: 'hidden state' },
      { id: 'e-h1-tree', from: 'h1', to: 'tree', weight: 'top tokens' },
      { id: 'e-h2-tree', from: 'h2', to: 'tree', weight: 'top tokens' },
      { id: 'e-h3-tree', from: 'h3', to: 'tree', weight: 'top tokens' },
      { id: 'e-tree-verify', from: 'tree', to: 'verify', weight: 'tree mask' },
      { id: 'e-verify-emit', from: 'verify', to: 'emit', weight: 'longest accepted' },
    ],
  }, { title });
}

function lookaheadGraph(title) {
  return graphState({
    nodes: [
      { id: 'state', label: 'current state', x: 0.8, y: 3.8, note: 'prefix' },
      { id: 'ngram1', label: 'n-gram lane A', x: 3.0, y: 1.8, note: 'parallel guess' },
      { id: 'ngram2', label: 'n-gram lane B', x: 3.0, y: 3.8, note: 'parallel guess' },
      { id: 'ngram3', label: 'n-gram lane C', x: 3.0, y: 5.8, note: 'parallel guess' },
      { id: 'verify', label: 'verify', x: 5.8, y: 3.8, note: 'standard LLM logits' },
      { id: 'accept', label: 'accept prefix', x: 8.2, y: 3.8, note: 'exact output' },
    ],
    edges: [
      { id: 'e-s-a', from: 'state', to: 'ngram1', weight: 'Jacobi-style step' },
      { id: 'e-s-b', from: 'state', to: 'ngram2', weight: 'Jacobi-style step' },
      { id: 'e-s-c', from: 'state', to: 'ngram3', weight: 'Jacobi-style step' },
      { id: 'e-a-v', from: 'ngram1', to: 'verify', weight: 'candidates' },
      { id: 'e-b-v', from: 'ngram2', to: 'verify', weight: 'candidates' },
      { id: 'e-c-v', from: 'ngram3', to: 'verify', weight: 'candidates' },
      { id: 'e-v-accept', from: 'verify', to: 'accept', weight: 'matching prefix' },
    ],
  }, { title });
}

function* medusaHeads() {
  const tokenCount = 4;
  yield {
    state: labelMatrix(
      'Autoregressive decoding pays one big pass per token',
      [
        { id: 't1', label: 'token 1' },
        { id: 't2', label: 'token 2' },
        { id: 't3', label: 'token 3' },
        { id: 't4', label: 'token 4' },
      ],
      [
        { id: 'dependency', label: 'dependency' },
        { id: 'bigpass', label: 'big-model pass' },
      ],
      [
        ['needs prompt', 'pass 1'],
        ['needs token 1', 'pass 2'],
        ['needs token 2', 'pass 3'],
        ['needs token 3', 'pass 4'],
      ],
    ),
    highlight: { active: ['t1:bigpass', 't2:bigpass', 't3:bigpass', 't4:bigpass'] },
    explanation: `Plain LLM decoding is sequential. Each of ${tokenCount} tokens depends on the previous token, so the system reads model weights and KV cache again and again. Speculative Decoding uses a draft model. Multi-token decoding asks whether the main model can help predict several future positions itself.`,
  };

  const headCount = 3;
  yield {
    state: medusaGraph('Medusa attaches extra decoding heads to the backbone'),
    highlight: { active: ['h1', 'h2', 'h3', 'e-b-h1', 'e-b-h2', 'e-b-h3'], compare: ['backbone'] },
    explanation: `Medusa adds ${headCount} lightweight heads on top of the model hidden state. Each head predicts tokens at a future offset. The backbone can be frozen for a lossless acceleration path, or tuned with the heads for larger speedups at higher training complexity.`,
  };

  yield {
    state: medusaGraph('Candidate continuations are verified with tree attention'),
    highlight: { active: ['tree', 'verify', 'e-tree-verify'], found: ['emit'], compare: ['h1', 'h2', 'h3'] },
    explanation: `The ${headCount} heads produce a small tree of candidate continuations. Tree attention lets the model verify many branches in one pass. The runtime accepts the longest prefix that matches the model distribution under the acceptance rule.`,
    invariant: `The acceleration target is fewer decode iterations, not a different answer — all ${headCount} heads are proposals, not commitments.`,
  };

  yield {
    state: labelMatrix(
      'Medusa compared with draft-model speculation',
      [
        { id: 'spec', label: 'speculative decoding' },
        { id: 'medusa1', label: 'Medusa-1' },
        { id: 'medusa2', label: 'Medusa-2' },
        { id: 'ops', label: 'operational concern' },
      ],
      [
        { id: 'extra', label: 'extra component' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['separate draft model', 'memory and maintenance'],
        ['heads on frozen LLM', 'simpler deployment'],
        ['heads plus backbone tuning', 'more speed, more risk'],
        ['tree verification', 'scheduler and kernel complexity'],
      ],
    ),
    highlight: { found: ['medusa1:tradeoff'], compare: ['spec:tradeoff', 'medusa2:tradeoff'] },
    explanation: `Medusa is attractive because it removes the need to maintain a separate draft model. With ${headCount} heads attached to the backbone, the cost shifts into head training, tree candidate management, and verification kernels.`,
  };
}

function* lookaheadDecoding() {
  const laneCount = 3;
  yield {
    state: lookaheadGraph('Lookahead generates candidate n-grams in parallel'),
    highlight: { active: ['ngram1', 'ngram2', 'ngram3', 'e-s-a', 'e-s-b', 'e-s-c'], compare: ['verify'] },
    explanation: `Lookahead decoding attacks the same sequential bottleneck without a draft model or extra Medusa heads. It uses ${laneCount} parallel candidate n-gram lanes, then checks which prefix agrees with standard autoregressive decoding.`,
  };

  yield {
    state: labelMatrix(
      'Parallel lanes propose future text',
      [
        { id: 'laneA', label: 'lane A' },
        { id: 'laneB', label: 'lane B' },
        { id: 'laneC', label: 'lane C' },
        { id: 'verify', label: 'verification' },
      ],
      [
        { id: 'proposal', label: 'proposal' },
        { id: 'status', label: 'status' },
      ],
      [
        ['the model can', 'matches 2 tokens'],
        ['the model will', 'matches 1 token'],
        ['the answer is', 'mismatch early'],
        ['standard logits', 'choose longest valid prefix'],
      ],
    ),
    highlight: { active: ['laneA:proposal', 'laneB:proposal', 'laneC:proposal'], found: ['verify:status'] },
    explanation: `The ${laneCount} proposals are useful only when they agree with what the model would have produced token by token. Verification protects exactness. Bad lanes cost compute but do not change the output.`,
    invariant: `Accepted tokens must be consistent with ordinary autoregressive decoding across all ${laneCount} lanes.`,
  };

  yield {
    state: lookaheadGraph('Verification collapses many guesses into one advance'),
    highlight: { active: ['verify', 'e-a-v', 'e-b-v', 'e-c-v'], found: ['accept', 'e-v-accept'] },
    explanation: `The win comes from verifying all ${laneCount} lanes in one pass, trading more parallel work inside a step for fewer total decode steps. That fits modern accelerators when autoregressive generation is memory-bandwidth bound and underuses parallel compute.`,
  };

  const strategyCount = 4;
  yield {
    state: labelMatrix(
      'Choosing a multi-token decoding strategy',
      [
        { id: 'draft', label: 'draft-model speculation' },
        { id: 'medusa', label: 'Medusa' },
        { id: 'lookahead', label: 'Lookahead' },
        { id: 'none', label: 'plain decode' },
      ],
      [
        { id: 'bestwhen', label: 'best when' },
        { id: 'pain', label: 'pain point' },
      ],
      [
        ['small draft agrees often', 'extra model memory'],
        ['can train heads', 'tree verification'],
        ['want no aux model', 'more per-step FLOPs'],
        ['latency less important', 'wastes parallelism'],
      ],
    ),
    highlight: { found: ['draft:bestwhen', 'medusa:bestwhen', 'lookahead:bestwhen'], compare: ['none:pain'] },
    explanation: `All ${strategyCount} methods are serving optimizations around the same bottleneck. The right choice depends on model family, latency target, memory headroom, traffic shape, and how much training or kernel work the team can support.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'medusa heads') yield* medusaHeads();
  else if (view === 'lookahead decoding') yield* lookaheadDecoding();
  else throw new InputError('Pick a multi-token decoding view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The Medusa heads view shows a backbone LLM feeding hidden states into parallel prediction heads, each targeting a different future position. Active highlights mark the current stage of the pipeline -- head prediction, tree construction, or verification. Found highlights mark the accepted prefix that becomes real output. Compare highlights show the components being contrasted (frozen backbone vs. trained heads, or different deployment tradeoffs).',
        'The Lookahead decoding view shows parallel n-gram lanes proposing candidate continuations from the current state. Active highlights mark the proposal phase; found highlights mark the accepted prefix after verification. The matrix frames show which lanes matched and how many tokens advanced.',
        {
          type: 'diagram',
          text: 'Draft/Propose          Verify (one target-model pass)       Accept\n+---------+\n| head +1 |----> "Paris"  \\\n+---------+                \\     +------------------+     +----------+\n| head +2 |----> "."        +--->| tree attention   |---->| "Paris ."|\n+---------+                /     | (masked forward) |     | 2 tokens |\n| head +3 |----> "It"     /      +------------------+     +----------+\n+---------+\n\nAll branches checked in one pass. Longest valid prefix emitted.',
          label: 'The draft-verify pipeline: propose many, verify once, accept the longest match',
        },
        'At each frame, ask: how many tokens did this step propose, how many survived verification, and what determined the acceptance boundary?',
        {type: 'callout', text: 'Multi-token decoding is exact only when speculation stays provisional until the target model verifies the prefix.'},
      
        {type: 'image', src: './assets/gifs/multi-token-decoding.gif', alt: 'Animated walkthrough of the multi token decoding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'Inference from large language models is slow mainly because generating tokens one at a time fails to utilize the massive parallel computation capacity of modern accelerators.',
          attribution: 'Leviathan, Kalman, Matias, "Fast Inference from Transformers via Speculative Decoding," 2023',
        },
        'Autoregressive decoding emits one token per forward pass. Each pass reads the full model weights and the accumulated KV cache from memory, produces a single token, appends it to the context, and repeats. That loop is simple and exact, but it is memory-bandwidth bound: the GPU loads gigabytes of weights to produce a few bytes of output. An H100 with 3.35 TB/s bandwidth serving a 70B model (140 GB in FP16) can do roughly 24 weight reads per second -- 24 tokens/s -- regardless of how many FLOPS sit idle.',
        'Prefill processes the entire prompt in parallel and saturates compute. Decode is the bottleneck. A 500-token response at 24 tok/s takes 21 seconds of wall-clock time, during which the GPU spends most of its cycles waiting for memory transfers. Multi-token decoding asks whether that idle compute can be redirected to propose and verify several future tokens per step, collapsing multiple serial iterations into one.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is to make each single-token step faster: quantize weights to reduce memory traffic, optimize attention kernels, use a paged KV cache layout, or increase batch size to amortize weight loads across requests. These are necessary and valuable, but they do not change the serial structure. A 4-bit quantized model producing 500 tokens still runs 500 sequential forward passes. Throughput improves; per-request latency stays proportional to decode length.',
        'The second reasonable attempt is to guess several future tokens and append them without checking. That breaks correctness. LLM output is a conditional distribution: token k+1 depends on the exact prefix through token k. Appending an unverified guess changes the prefix, which changes every subsequent distribution. The output is no longer what the target model would have produced. Any multi-token method must preserve exactness: propose freely, but accept only what the target model confirms.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the autoregressive dependency chain. Token k+1 is drawn from P(x | x_1, ..., x_k). The correct distribution at position k+2 is unknown until x_{k+1} is chosen. This is not a software limitation -- it is the definition of autoregressive generation. Greedy decoding, top-p sampling, and beam search all share this serial inner loop. The system can optimize around the loop, but it cannot skip it without changing the output.',
        'The key observation is that verification is cheaper than generation when done in parallel. A transformer can check whether a proposed sequence of tokens is consistent with its own distribution in a single forward pass by using causal attention masks. If the proposal matches at positions k+1, k+2, and k+3 but diverges at k+4, the system accepts three tokens and resumes from position k+4. The dependency chain is not broken -- it is checked in bulk rather than one link at a time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Every multi-token method follows the same three-phase loop: draft (propose candidate tokens cheaply), verify (run the target model once over all candidates), and accept (emit the longest prefix consistent with the target distribution). The methods differ only in how they draft.',
        {
          type: 'diagram',
          text: 'Speculative Decoding (draft model):\n\n  Small model            Large model             Output\n  +-------+    K tokens   +--------+   accept N   +------+\n  | draft |-------------->| verify |-------------->| emit |\n  | 68M   |  "Paris . It" | 70B    | "Paris ."    | +2   |\n  +-------+               +--------+              +------+\n        ^                                            |\n        +-------- resume from accepted prefix -------+\n\nMedusa (extra heads on same model):\n\n  Backbone hidden state --> head+1 --> "Paris"\n                        --> head+2 --> "."\n                        --> head+3 --> "It"\n  Candidate tree --> tree attention --> accept longest valid prefix\n\nJacobi / Lookahead (no auxiliary model):\n\n  Current state --> parallel n-gram guesses --> verify --> accept prefix',
          label: 'Three drafting strategies, one verify-accept loop',
        },
        'In speculative decoding (Leviathan et al. 2023, Chen et al. 2023), a small draft model runs K autoregressive steps cheaply, then the large target model verifies all K tokens in one forward pass. The draft model is 10-100x smaller, so its K steps cost less wall time than one target-model step. If all K tokens match, the system advances by K+1 positions (K verified plus one bonus token from the verification pass). If the first mismatch is at position j, the system accepts j tokens, resamples position j from a corrected distribution, and discards the rest.',
        'Medusa (Cai et al. 2024) eliminates the draft model by adding lightweight MLP heads to the backbone. Each head predicts a token at a different future offset from the same hidden state. The predictions form a candidate tree -- multiple alternatives at each offset -- and tree attention verifies all branches in one masked forward pass. Medusa-1 freezes the backbone and trains only the heads; Medusa-2 fine-tunes the backbone jointly for higher acceptance at the cost of more invasive training.',
        {type: 'image', src: 'https://vllm.ai/blog-assets/figures/spec-decode/figure2.png', alt: 'Speculative decoding diagram with a draft model proposing tokens and a target model verifying them', caption: 'Draft-model speculative decoding splits proposal from verification so the large model can check several future tokens in one pass. Source: vLLM blog, https://vllm.ai/blog/2024-10-17-spec-decode.'},
        'EAGLE (Li et al. 2024) takes a different approach: it trains a lightweight autoregressive draft head that operates on the feature level rather than the token level. Instead of predicting token probabilities directly, the draft head predicts the next hidden state, which is then projected to vocabulary space. This produces higher-quality drafts than Medusa because the draft head captures sequential dependencies between future positions rather than predicting each offset independently.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness guarantee comes from the acceptance-rejection scheme. For greedy decoding, the rule is simple: accept a drafted token if and only if the target model assigns it the highest probability at that position. For sampling, Leviathan et al. use a modified rejection sampling scheme: accept token x with probability min(1, q(x)/p(x)), where q is the target distribution and p is the draft distribution. If rejected, resample from a corrected distribution (q - p), normalized. This guarantees the final output distribution is identical to sampling from the target model alone.',
        {
          type: 'code',
          language: 'python',
          text: '# Acceptance probability for speculative decoding (sampling)\n# p_draft: draft model probability for the proposed token\n# q_target: target model probability for the same token\n\ndef acceptance_prob(p_draft, q_target):\n    """Token is accepted with this probability.\n    If rejected, resample from max(0, q - p), normalized."""\n    return min(1.0, q_target / p_draft)\n\n# Example: draft proposes "Paris" with p=0.6, target gives q=0.85\n# accept_prob = min(1, 0.85/0.6) = 1.0  --> always accept\n\n# Draft proposes "Lyon" with p=0.3, target gives q=0.05\n# accept_prob = min(1, 0.05/0.3) = 0.167 --> reject 83% of the time\n\n# Key property: when draft matches target well,\n# acceptance is high and multiple tokens advance per step.',
        },
        'The method works because language has local predictability. After "The capital of France is," the next tokens are highly constrained. Punctuation after entities, closing brackets in code, JSON field separators, boilerplate phrases -- these spans are easy to draft correctly. A draft model that agrees with the target on 70-80% of tokens yields an average acceptance length of 3-4 tokens per verification step, roughly a 2-3x wall-clock speedup.',
        'The deeper reason is the arithmetic intensity gap. Verification of K tokens costs about the same memory bandwidth as generating one token (one weight read), but uses K times more compute. Since decode is memory-bound and compute is idle, the extra FLOPS for verification are essentially free. The system trades surplus compute for reduced serial steps.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Method', 'Draft source', 'Extra memory', 'Training cost', 'Typical speedup', 'Output distribution'],
          rows: [
            ['Autoregressive', 'None', 'None', 'None', '1x (baseline)', 'Exact'],
            ['Speculative (Leviathan 2023)', 'Separate small model', 'Draft model weights', 'Draft model training', '2-3x', 'Exact (rejection sampling)'],
            ['Medusa (Cai 2024)', 'Extra heads on backbone', 'Head parameters (~1-5%)', 'Head training or joint fine-tune', '2-3x', 'Exact (Medusa-1) or approximate'],
            ['EAGLE (Li 2024)', 'Feature-level draft head', 'Draft head (~1-2%)', 'Draft head training', '2.5-3.5x', 'Exact (rejection sampling)'],
            ['Jacobi / Lookahead (Fu 2024)', 'Parallel n-gram guesses', 'N-gram cache', 'None', '1.5-2x', 'Exact (prefix verification)'],
          ],
        },
        'The direct cost varies by method. Speculative decoding pays memory for a second model (the draft model must fit alongside the target in GPU memory) but requires no target-model changes. Medusa adds 1-5% parameter overhead for the heads but eliminates the draft model. EAGLE adds a lightweight autoregressive module. Lookahead/Jacobi needs no extra parameters but burns more FLOPS per step and typically achieves lower speedup.',
        'All methods add serving complexity: candidate tree construction, custom attention masks, acceptance logic, KV cache management for speculative tokens that may be discarded, and integration with continuous batching where different requests accept different numbers of tokens per step. The scheduler must handle uneven advances across a batch.',
        {
          type: 'note',
          text: 'Speedup numbers depend heavily on the task, sampling temperature, draft-target alignment, and hardware. Reported numbers are typically measured on greedy or low-temperature generation of English text or code. High-temperature creative sampling, rare tokens, and long-tail distributions reduce acceptance rates and compress speedups toward 1x.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Multi-token decoding is strongest when decode length dominates latency and the generation is moderately predictable. The ideal workloads are chat APIs, code completion, structured JSON emission, analytical responses, and tool-calling agents -- tasks where the model frequently emits predictable spans (punctuation, formatting, common phrases, syntactic boilerplate) interspersed with genuinely uncertain tokens.',
        {type: 'image', src: 'https://vllm.ai/blog-assets/figures/spec-decode/figure9.png', alt: 'vLLM speculative decoding architecture with scheduler, draft worker, target worker, scoring, and acceptance', caption: 'Serving systems need scheduler, draft-worker, target-worker, and acceptance plumbing; speculative decoding is an engine feature, not a prompt trick. Source: vLLM blog, https://vllm.ai/blog/2024-10-17-spec-decode.'},
        {
          type: 'bullets',
          items: [
            'Latency-sensitive chat serving: 2-3x fewer decode steps directly reduces time-to-last-token for interactive use.',
            'Code completion: highly structured syntax means draft models agree with the target on 70-90% of tokens for common patterns.',
            'Structured output (JSON, XML, SQL): field names, delimiters, and schema-constrained values are easy to draft.',
            'Long-form generation: a 2,000-token response at 2.5x speedup saves 800 decode steps -- seconds of wall time.',
            'Composes with other optimizations: quantization reduces weight-read cost, PagedAttention manages speculative KV entries, continuous batching handles multi-request scheduling.',
          ],
        },
        'The method also fits deployments where the serving team controls the inference engine deeply enough to implement custom verification kernels and tree attention masks. vLLM, TensorRT-LLM, and SGLang all ship speculative decoding support. A thin API wrapper around a black-box model cannot implement it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The method fails when acceptance rate is low. If the draft proposes four tokens and the target accepts only one on average, the system pays extra compute and memory traffic for no net speedup. Low acceptance happens with high-temperature sampling (the target distribution is flat, so the draft often picks a different token), rare or domain-specific vocabulary, and tasks where each token genuinely depends on reasoning the draft model cannot replicate.',
        {
          type: 'bullets',
          items: [
            'High temperature / top-p with large p: flat distributions make draft-target agreement unlikely.',
            'Domain mismatch: a draft model trained on English text drafting poorly for code, math, or non-English languages.',
            'Constrained decoding: grammar-constrained or schema-constrained sampling changes the acceptance rule; naive speculative verification may not respect the constraint.',
            'Batch throughput priority: when maximizing tokens/second across many requests matters more than per-request latency, larger batch sizes with plain decoding can be more efficient than per-request speculation.',
            'Memory pressure: the draft model or extra heads consume memory that could serve a larger batch or a bigger target model.',
            'Tail latency: verification failures cause variable step lengths, making P99 latency harder to predict than plain decoding.',
          ],
        },
        'A common benchmarking mistake is measuring only easy prompts (English text, greedy decoding, short outputs) and reporting the best-case speedup. Production workloads mix easy and hard queries. The system must handle both without regressing latency on the hard ones. Measuring accepted tokens per verification step, stratified by sampling temperature and task type, is the honest metric.',
        'Tree verification also adds kernel and scheduler complexity. Medusa candidate trees with 64 leaves require custom CUDA kernels for masked attention. Continuous batching with speculative decoding must handle requests that accept 1, 3, and 5 tokens in the same batch step. These are solvable engineering problems, but they are real costs that must be weighed against the latency improvement.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Leviathan, Kalman, Matias, "Fast Inference from Transformers via Speculative Decoding" (2023): https://arxiv.org/abs/2211.17192 -- the foundational paper establishing the draft-verify-accept loop with provably exact output distribution.',
            'Chen, Borgeaud, Irving et al., "Accelerating Large Language Model Decoding with Speculative Sampling" (2023): https://arxiv.org/abs/2302.01318 -- independent concurrent work with the same core idea, detailed analysis of acceptance rates.',
            'Cai, Li, Geng et al., "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads" (2024): https://arxiv.org/abs/2401.10774 -- eliminates the draft model by adding prediction heads to the backbone.',
            'Li, Cai, et al., "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty" (2024): https://arxiv.org/abs/2401.15077 -- feature-level drafting for higher acceptance than Medusa.',
            'Fu, Bailis, Stoica, Zhang, "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding" (2024): https://arxiv.org/abs/2402.02057 -- Jacobi-style parallel decoding without any auxiliary model.',
          ],
        },
        'Prerequisites: study Transformer Inference Roofline to understand why decode is memory-bandwidth bound, and KV Cache to understand the state that accumulates across decode steps. Study rejection sampling to understand the acceptance probability computation that guarantees exact output.',
        'Extensions: Speculative Decoding for the draft-model variant in depth, Early-Exit Transformer Layer Skipping for self-speculation where shallow layers draft and deep layers verify, LLM Continuous Batching for the scheduling challenges that speculative methods interact with, and PagedAttention for managing KV cache entries for speculative tokens that may be discarded.',
      ],
    },
  ],
};
