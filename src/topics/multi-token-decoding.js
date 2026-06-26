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
    { heading: 'How to read the animation', paragraphs: [
      'The animation has two views. The Medusa view shows one large language model backbone feeding small heads that guess future tokens; the Lookahead view shows n-gram lanes that guess continuations without a second model. Active highlights mark proposals or verification work, and found highlights mark accepted tokens that become part of the output. The safe inference rule is that a proposed token is only real after the target model verifies it under the same prefix ordinary autoregressive decoding would use.',
      {type: 'callout', text: 'Multi-token decoding is exact only when speculation stays provisional until the target model verifies the prefix.'},
      {type: 'image', src: './assets/gifs/multi-token-decoding.gif', alt: 'Animated walkthrough of the multi token decoding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    { heading: 'Why this exists', paragraphs: ['A large language model generates text autoregressively, which means each new token depends on the tokens before it. During decode, the model often reads a large set of weights and key-value cache entries to produce one token, then repeats the same expensive step for the next token. Multi-token decoding exists because that loop often waits on memory bandwidth while accelerator compute sits underused.']},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is to make the one-token step faster. Quantization reads fewer bytes, kernel tuning removes overhead, batching shares weight reads across users, and a better key-value cache layout reduces memory movement. Those optimizations matter, but a 500-token answer still needs 500 dependent decode iterations if the system only accepts one token per target-model pass.']},
    { heading: 'The wall', paragraphs: ['The wall is the dependency chain. Token 12 cannot be sampled from the correct distribution until tokens 1 through 11 are fixed, because every transformer layer conditions on the exact prefix. Naively appending guessed tokens changes the prefix and therefore changes the distribution of every later token, so the system is no longer producing the target model behavior.']},
    { heading: 'The core insight', paragraphs: [
      'The core insight is to separate proposal from commitment. A cheap mechanism can propose several future tokens, but the target model remains the authority that decides how many of those tokens are valid. Verification can be parallel even though generation is sequential: several links in the chain are checked at once instead of trusted blindly.',
      {type: 'image', src: 'https://vllm.ai/blog-assets/figures/spec-decode/figure2.png', alt: 'Speculative decoding diagram with a draft model proposing tokens and a target model verifying them', caption: 'Draft-model speculative decoding splits proposal from verification so the large model can check several future tokens in one pass. Source: vLLM blog, https://vllm.ai/blog/2024-10-17-spec-decode.'},
    ]},
    { heading: 'How it works', paragraphs: ['Every version follows the same loop. Draft some candidate tokens, run the target model over the proposed continuation with a causal or tree attention mask, then accept the longest valid prefix and discard the rest. Speculative decoding uses a smaller draft model, Medusa attaches extra prediction heads to the same backbone, and Lookahead decoding builds candidate n-grams from the current state.']},
    { heading: 'Why it works', paragraphs: ['The correctness argument is an invariant: after each accepted step, the emitted prefix is one that the target model itself could have emitted under the chosen decoding rule. For greedy decoding, this means each accepted token matches the target model top token at that position. For sampling, rejection sampling accepts or resamples so the final distribution equals the target distribution rather than the draft distribution.']},
    { heading: 'Cost and complexity', paragraphs: ['If the target model normally produces one token per pass and speculation accepts three tokens per pass on average, the decode loop needs about one third as many target passes. That does not make the system three times cheaper, because drafting, verification masks, cache handling, and scheduling add work. The method wins when accepted tokens per verification step rise faster than the added work per step.']},
    { heading: 'Real-world uses', paragraphs: [
      'Chat serving, coding assistants, structured JSON generation, and agent traces are natural fits because many spans are predictable. Punctuation, boilerplate, schema keys, and common phrases give the draft source many chances to agree with the target model. The technique belongs inside the inference engine because a black-box API wrapper cannot implement tree attention, speculative cache rollback, or accepted-token scheduling.',
      {type: 'image', src: 'https://vllm.ai/blog-assets/figures/spec-decode/figure9.png', alt: 'vLLM speculative decoding architecture with scheduler, draft worker, target worker, scoring, and acceptance', caption: 'Serving systems need scheduler, draft-worker, target-worker, and acceptance plumbing; speculative decoding is an engine feature, not a prompt trick. Source: vLLM blog, https://vllm.ai/blog/2024-10-17-spec-decode.'},
    ]},
    { heading: 'Where it fails', paragraphs: ['It fails when the proposal source disagrees with the target model. High-temperature sampling, rare vocabulary, math-heavy reasoning, domain mismatch, or adversarial prompts can reduce the accepted prefix to one token, leaving only overhead. It also strains serving stacks because one request may accept five tokens while another accepts none in the same batch.']},
    { heading: 'Worked example', paragraphs: ['Suppose plain decode needs one target pass per token for a 12-token answer. If each target pass takes 40 milliseconds, decode takes 12 * 40 = 480 milliseconds. Now use a draft mechanism that accepts 3, 2, 4, and 3 tokens across four verification passes; if each verification pass takes 50 milliseconds, target time is 4 * 50 = 200 milliseconds plus draft overhead.']},
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Leviathan, Kalman, and Matias on speculative decoding; Chen et al. on speculative sampling; Cai et al. on Medusa; Li et al. on EAGLE; and Fu et al. on Lookahead Decoding. Study transformer decoding, key-value cache layout, rejection sampling, continuous batching, and PagedAttention next because they explain the dependency chain and the serving machinery.']},
  ],
};
