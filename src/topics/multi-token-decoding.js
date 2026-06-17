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
    explanation: 'Plain LLM decoding is sequential. Each next token depends on the previous token, so the system reads model weights and KV cache again and again. Speculative Decoding uses a draft model. Multi-token decoding asks whether the main model can help predict several future positions itself.',
  };

  yield {
    state: medusaGraph('Medusa attaches extra decoding heads to the backbone'),
    highlight: { active: ['h1', 'h2', 'h3', 'e-b-h1', 'e-b-h2', 'e-b-h3'], compare: ['backbone'] },
    explanation: 'Medusa adds lightweight heads on top of the model hidden state. Each head predicts tokens at a future offset. The backbone can be frozen for a lossless acceleration path, or tuned with the heads for larger speedups at higher training complexity.',
  };

  yield {
    state: medusaGraph('Candidate continuations are verified with tree attention'),
    highlight: { active: ['tree', 'verify', 'e-tree-verify'], found: ['emit'], compare: ['h1', 'h2', 'h3'] },
    explanation: 'The heads produce a small tree of candidate continuations. Tree attention lets the model verify many branches in one pass. The runtime accepts the longest prefix that matches the model distribution under the acceptance rule.',
    invariant: 'The acceleration target is fewer decode iterations, not a different answer.',
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
    explanation: 'Medusa is attractive because it removes the need to maintain a separate draft model. The cost shifts into head training, tree candidate management, and verification kernels.',
  };
}

function* lookaheadDecoding() {
  yield {
    state: lookaheadGraph('Lookahead generates candidate n-grams in parallel'),
    highlight: { active: ['ngram1', 'ngram2', 'ngram3', 'e-s-a', 'e-s-b', 'e-s-c'], compare: ['verify'] },
    explanation: 'Lookahead decoding attacks the same sequential bottleneck without a draft model or extra Medusa heads. It uses parallel candidate n-gram generation, then checks which prefix agrees with standard autoregressive decoding.',
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
    explanation: 'The proposals are useful only when they agree with what the model would have produced token by token. Verification protects exactness. Bad lanes cost compute but do not change the output.',
    invariant: 'Accepted tokens must be consistent with ordinary autoregressive decoding.',
  };

  yield {
    state: lookaheadGraph('Verification collapses many guesses into one advance'),
    highlight: { active: ['verify', 'e-a-v', 'e-b-v', 'e-c-v'], found: ['accept', 'e-v-accept'] },
    explanation: 'The win comes from trading more parallel work inside a step for fewer total decode steps. That fits modern accelerators when autoregressive generation is memory-bandwidth bound and underuses parallel compute.',
  };

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
    explanation: 'All of these methods are serving optimizations around the same bottleneck. The right choice depends on model family, latency target, memory headroom, traffic shape, and how much training or kernel work the team can support.',
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
      heading: 'The problem',
      paragraphs: [
        'Multi-token decoding is a family of LLM inference techniques that try to advance generation by more than one token during a single expensive decode cycle. Ordinary autoregressive decoding emits one token, appends it to the context, updates the KV cache, and repeats. That loop is simple and exact, but it creates a hard sequential dependency. The next token cannot be finalized until the previous token is known.',
        'The performance problem is especially visible during decode. Prefill can process a prompt with high parallelism. Decode often becomes memory-bandwidth bound because each step reads model weights and KV cache state to produce one small token result. A GPU may have compute capacity left over while the serving path waits through many serial steps. Multi-token decoding asks whether that unused parallelism can be spent proposing and checking several future tokens at once.',
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The naive answer is to make every single-token step faster: optimize kernels, quantize weights, use a better KV cache layout, increase batch size, and keep the GPU full. Those are necessary serving techniques, but they do not remove the serial shape of one accepted token per model step. Larger batches improve throughput, yet user-facing latency can still be dominated by the number of decode iterations needed for one response.',
        'Another naive answer is to guess several tokens and append them without verification. That is fast but wrong. LLM output is a probability distribution conditioned on the exact prefix. If the system appends a guessed token that the target model would not have selected under the chosen decoding rule, every later token is conditioned on a different prefix. The result is no longer the same model behavior. The central constraint is therefore exactness: propose many tokens if useful, but accept only the prefix that is valid for the target model.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the next-token dependency. Token k plus 1 is conditioned on token k, so a normal decoder cannot know the correct distribution at position k plus 2 until position k plus 1 has been chosen. That is the same reason beam search, sampling, and greedy decoding all have a serial inner loop. The serving system can do a lot around the loop, but it cannot pretend that the dependency is gone.',
        'Multi-token methods get around the wall by splitting the work into proposal and verification. Proposal is allowed to be approximate, parallel, or auxiliary. Verification is tied to the target model. If the proposal matches what the target model would allow, the runtime accepts a prefix longer than one token. If not, it falls back to a shorter prefix, often just the next token. The answer remains exact when the acceptance rule is exact.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to trade extra parallel work inside one step for fewer serial steps overall. If a proposal mechanism can suggest likely continuations cheaply, and the target model can verify several of them in one pass, then the serving loop can move forward by two, three, or more tokens at a time. The right objective is not "many candidates proposed." The right objective is accepted tokens per expensive target-model pass at the required latency and quality.',
        'This connects multi-token decoding to Speculative Decoding, Medusa, Lookahead Decoding, and early-exit self-speculation. The proposal source changes. A small draft model can propose. Extra Medusa heads can propose future positions from the main hidden state. Lookahead can propose n-grams without a separate draft model. Shallow layers can draft and deeper layers can verify. The shared algorithmic shape is propose, verify, accept the longest valid prefix, then repeat.',
      ],
    },
    {
      heading: 'Medusa mechanics',
      paragraphs: [
        'Medusa attaches lightweight decoding heads to the backbone model. A head for offset plus 1 predicts the next token. A head for offset plus 2 predicts a token two positions ahead, and so on. The heads are trained so that a single hidden state can produce plausible future tokens. Those predictions are organized into a candidate tree rather than one flat string, because several alternatives may be plausible at each future position.',
        'Tree attention is the verification trick. Instead of running the model separately for each branch, the runtime constructs attention masks so the target model can check many candidate paths in a single pass. The system then finds the longest prefix that is valid under the decoding rule. Medusa-1 keeps the backbone frozen and trains heads, which is operationally simpler. Medusa-2 tunes more of the model for stronger speedups, but that increases training and deployment risk.',
      ],
    },
    {
      heading: 'Lookahead mechanics',
      paragraphs: [
        'Lookahead decoding attacks the same bottleneck without a draft model and without Medusa heads. It generates candidate n-grams in parallel from the current state, often described as using a Jacobi-style parallel update idea, and then verifies which candidate prefix agrees with standard autoregressive decoding. Bad candidates cost compute, but they do not change the final output because verification controls acceptance.',
        'This is useful when the infrastructure team wants a serving-time algorithmic optimization without maintaining a second model or modifying the main model architecture. The cost shifts into per-step candidate work, verification logic, and careful implementation. Lookahead is not free parallelism. It works only when the extra work fits into otherwise underused accelerator capacity and reduces enough serial iterations to pay for itself.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine the current prefix is `The capital of France is`. Greedy decoding by the target model would likely produce `Paris`, then maybe `.`, then perhaps `It`. A proposal method might offer a candidate chain `Paris . It` plus other branches such as `Paris , a` and `Lyon . The`. Verification checks the branches against the target model. If the target model agrees with `Paris .`, the runtime can accept two tokens and advance the decode loop by two positions. If it agrees only on `Paris`, the runtime advances by one token and discards the rest.',
        'The same idea applies to code generation. After `for (let i = 0;`, a model may predict a familiar continuation such as `i < n; i++)`. If the candidate path matches the target model distribution, several tokens can be accepted. If the code is unusual, sampled at high temperature, or depends on a rare identifier, acceptance may collapse to one token. The method is adaptive because rejected guesses reduce speedup, not correctness.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The Medusa view shows the backbone model feeding several future-token heads. The important state transition is from separate head predictions into a candidate tree, then from the tree into verification. The accepted prefix is the only part that becomes real output. Everything else is speculative work that either helps reduce the next serial step or gets discarded.',
        'The Lookahead view shows parallel n-gram lanes. The lanes are not independent completions. They are candidate futures that must pass through the target model check. The lesson is a utilization tradeoff: spend more parallel compute in one step, accept multiple tokens when the guesses align, and fall back safely when they do not.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The methods work when language has local predictability and the serving hardware has unused parallel capacity during decode. Many continuations are highly regular: punctuation after a named entity, closing braces in code, boilerplate explanation phrases, JSON field separators, repeated formatting, and common answer templates. A proposal mechanism can often guess these futures well enough for verification to accept more than one token.',
        'Exact verification is the safety valve. Without it, multi-token generation would be a different model. With it, wrong guesses become wasted work rather than wrong output. This is why acceptance rate is the central measurement. A system that proposes four tokens but accepts one token on average is not meaningfully accelerating the serial loop. A system that accepts two or three tokens often can reduce time to completion even if each step is more complex.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main cost is serving complexity. Medusa needs trained heads, candidate-tree construction, tree attention masks, acceptance logic, and integration with batching and KV cache management. Lookahead needs candidate generation and verification kernels that do not erase the latency gain. Both methods need runtime metrics for acceptance rate, rejected work, tail latency, and fallback behavior.',
        'There is also a product tradeoff. High temperature sampling, creative writing, rare tokens, long-tail code identifiers, and tool-call boundaries can reduce acceptance because the future is less predictable. Larger candidate trees increase the chance of finding a valid prefix, but they also increase memory, masking, and scheduling work. Continuous batching can conflict with per-request speculative trees if requests accept different numbers of tokens. The serving engine has to reconcile those uneven advances.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Multi-token decoding is strongest for latency-sensitive generation where decode length matters: chat APIs, coding assistants, autocomplete, tool-using agents, structured JSON emission, and long analytical responses. It is especially attractive when the model often emits predictable spans and the hardware is not already saturated by other work. It can compose with KV Cache, PagedAttention, Continuous Batching, prefix caching, quantization, and better kernels.',
        'It also fits deployments where the operator controls the serving stack deeply enough to add custom verification logic. A simple API wrapper cannot usually implement tree attention or per-step acceptance efficiently. The methods belong inside the inference engine, near the scheduler, attention kernels, KV cache allocator, and sampling code.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The method fails economically when acceptance is low. Rejected proposals add compute and memory traffic while the user still receives one token per step. It can also fail operationally if verification creates scheduler stalls, if candidate masks are inefficient, if extra heads increase model memory too much, or if uneven token acceptance makes batching worse. In those cases a simpler optimization may produce better end-to-end latency.',
        'Common failure modes include measuring candidate count instead of accepted tokens, benchmarking only easy prompts, ignoring tail latency, assuming one acceptance rate applies to all sampling settings, and forgetting that exactness depends on the precise decoding rule. A greedy verifier, a top-p sampler, and a constrained JSON decoder do not all accept candidates the same way. The runtime must verify according to the actual policy used for production output.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Medusa at https://arxiv.org/abs/2401.10774, Lookahead Decoding at https://arxiv.org/abs/2402.02057, and Speculative Decoding at https://arxiv.org/abs/2211.17192.',
        'Study Speculative Decoding for the draft-model version, Speculative Decoding Acceptance Ledger for production acceptance bookkeeping, Early-Exit Transformer Layer Skipping for self-speculation, KV Cache for decode state, LLM Continuous Batching for serving throughput, PagedAttention for KV memory management, Beam Search for alternative candidate management, Transformer Inference Roofline for the memory-bandwidth bottleneck, and constrained decoding topics for cases where verification must obey a grammar or schema.',
      ],
    },
  ],
};
