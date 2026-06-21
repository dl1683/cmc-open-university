// Speculative decoding: let a small, fast model GUESS several tokens ahead,
// then have the big model check the whole guess in one parallel pass.
// Same output as the big model alone — several times sooner.

import { arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'speculative-decoding',
  title: 'Speculative Decoding',
  category: 'AI & ML',
  summary: 'A small draft model guesses ahead; the big model verifies in one pass — identical output, much faster.',
  controls: [
    { id: 'draft', label: 'Draft model quality', type: 'select', options: ['good draft', 'weak draft'], defaultValue: 'good draft' },
  ],
  run,
};

// The big model's "true" continuation — what it WOULD generate token by token.
const TRUTH = ['the', 'cat', 'sat', 'on', 'the', 'mat', 'and', 'purred', 'softly', '.'];

// Scripted draft proposals per quality level: [proposal tokens, accepted count]
const ROUNDS = {
  'good draft': [
    { propose: ['the', 'cat', 'sat'] },
    { propose: ['the', 'mat', 'quickly'] },
    { propose: ['purred', 'softly', '.'] },
  ],
  'weak draft': [
    { propose: ['the', 'dog', 'ran'] },
    { propose: ['cat', 'sat', 'down'] },
    { propose: ['on', 'a', 'rug'] },
    { propose: ['the', 'mat', 'today'] },
    { propose: ['and', 'meowed', 'loud'] },
    { propose: ['purred', 'softly', '.'] },
    { propose: ['.'] },
  ],
};

export function* run(input) {
  const rounds = ROUNDS[String(input.draft)];
  if (!rounds) throw new InputError('Pick a draft quality.');

  let output = [];
  const ids = (from, to) => Array.from({ length: to - from }, (_, k) => `i${from + k}`);

  yield {
    state: arrayState(['…prompt…']),
    highlight: {},
    explanation: 'The bottleneck of LLM generation: tokens come ONE at a time, and each costs a full forward pass of the big model (see KV Cache — generation is memory-bound: most of the time goes to reading weights, not arithmetic). Speculative decoding\'s bet: a tiny DRAFT model (often a distilled sibling — see Knowledge Distillation) guesses several tokens cheaply, and the big model checks them all AT ONCE — verifying k tokens in parallel costs about the same as generating one, exactly like prefill.',
  };

  let bigPasses = 0;
  for (const round of rounds) {
    const start = output.length;
    const proposed = [...output, ...round.propose];
    yield {
      state: arrayState(proposed),
      highlight: { active: ids(start, proposed.length), found: ids(0, start) },
      explanation: `DRAFT: the small model races ahead, proposing "${round.propose.join(' ')}" (3 tokens at ~1/20th the big model's cost). These are guesses — unverified.`,
    };

    // verify against truth
    let accepted = 0;
    while (accepted < round.propose.length && round.propose[accepted] === TRUTH[start + accepted]) accepted += 1;
    bigPasses += 1;
    const allGood = accepted === round.propose.length;
    const bonus = TRUTH[start + accepted];

    if (allGood) {
      output = [...output, ...round.propose];
      if (bonus !== undefined && output.length < TRUTH.length) output.push(bonus);
      yield {
        state: arrayState(output),
        highlight: { found: ids(start, output.length) },
        explanation: `VERIFY (one parallel pass of the big model): all ${accepted} guesses match what the big model would have said — accepted! And the verification pass produces the next token "${bonus ?? ''}" for free. ${accepted + 1} tokens gained from one big-model pass.`,
        invariant: 'Accepted tokens are exactly the tokens the big model would have generated — the output is provably unchanged.',
      };
    } else {
      const rejectedView = [...output, ...round.propose];
      yield {
        state: arrayState(rejectedView),
        highlight: { found: ids(start, start + accepted), removed: ids(start + accepted, rejectedView.length) },
        explanation: `VERIFY: the big model agrees with ${accepted === 0 ? 'NONE of the guesses' : `the first ${accepted}`} — "${round.propose[accepted]}" is NOT what it would have said. Everything from the mismatch is thrown away, and the big model supplies its own token "${TRUTH[start + accepted]}" instead (it was computed during verification anyway). Wrong guesses cost nothing extra — they just don't help.`,
      };
      output = [...output.slice(0, start), ...round.propose.slice(0, accepted), TRUTH[start + accepted]];
      yield {
        state: arrayState(output),
        highlight: { found: ids(start, output.length) },
        explanation: `${accepted + 1} token${accepted === 0 ? '' : 's'} gained this round. The sequence remains EXACTLY what the big model alone would produce — speculation changes the speed, never the words.`,
      };
    }
    if (output.length >= TRUTH.length) break;
  }

  yield {
    state: arrayState(output),
    highlight: { found: ids(0, output.length) },
    explanation: `Done: ${output.length} tokens from ${bigPasses} big-model passes instead of ${TRUTH.length} — a ${(TRUTH.length / bigPasses).toFixed(1)}× speedup${String(input.draft) === 'weak draft' ? '… barely. A weak draft gets rejected constantly, and each round then yields only ~1 token: speculation is only as good as the drafter\'s agreement rate. Run the good draft for the contrast' : ', with output guaranteed identical to the slow way'}. This trick (with a probabilistic acceptance rule that preserves even SAMPLING distributions exactly) runs in production at every major LLM provider — it is a large part of why streaming feels fast. Free lunch? Almost: you pay GPU memory for the second model and win only when the draft agrees often.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a draft-verify loop producing one token sequence. Highlighted tokens are unverified guesses from the small draft model. Green tokens have been accepted by the large target model\'s verification pass. Red tokens were rejected at the first point where the draft disagreed with what the target model would have said.',
        {type: 'callout', text: 'Speculative decoding is safe speedup only when verification preserves the target distribution, not just a plausible continuation.'},
        'Each round has two beats. First the draft model races ahead, proposing several tokens cheaply. Then the target model checks all of them in a single parallel forward pass -- the same cost as generating one token the slow way. The number of tokens that survive verification is the speedup. Toggle between "good draft" and "weak draft" to see how agreement rate controls whether speculation pays off or wastes effort.',
      
        {type: 'image', src: './assets/gifs/speculative-decoding.gif', alt: 'Animated walkthrough of the speculative decoding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large language models generate text one token at a time. Each token requires a full forward pass: load every weight in the model from GPU memory, multiply, produce one output. For a 70-billion-parameter model, each token takes roughly 35 ms. A hundred tokens cost 3.5 seconds. The GPU\'s thousands of arithmetic cores sit mostly idle, because the bottleneck is not computation -- it is memory bandwidth. The hardware spends most of its time reading weights, not doing math.',
        'This is the memory-bandwidth wall. During the decode phase (after the prompt has been processed), the model reads tens of gigabytes of weights to produce a single number. The ratio of useful arithmetic to bytes moved -- called arithmetic intensity -- is tiny. A modern GPU can do 300+ TFLOPS of compute but can only move ~3 TB/s of data. At batch size 1, generating one token uses less than 1% of the available FLOPS. The compute is there. It is wasted.',
        'Speculative decoding (Leviathan et al. 2023, Chen et al. 2023) exploits the gap. A small draft model (1-7B parameters) generates K candidate tokens quickly -- roughly 1 ms each. The large target model then verifies all K tokens in one parallel forward pass (~40 ms). If the guesses match, you get K+1 tokens for the cost of one target pass. The output distribution is provably identical to running the target model alone. No quality loss. Just faster.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The standard ways to speed up generation attack the per-token cost. Quantize weights from 16-bit to 4-bit to reduce memory traffic. Write faster CUDA kernels. Batch multiple user requests so the same weight read serves several sequences. All of these help, and production systems use all of them. But none escape the sequential loop: token t+1 depends on token t, so the model still runs one forward pass per output token. A 70B model at 4-bit quantization is faster per step, but 100 tokens still means 100 sequential passes.',
        'The other natural idea: use a smaller model. A 7B model generates tokens 10x faster than 70B. But smaller models are measurably worse -- they hallucinate more, miss reasoning steps, and lose coherence in long output. Users who need big-model quality cannot switch to the small one. The challenge is big-model quality at small-model speed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The sequential dependency is fundamental. Token t+1 depends on token t. The big model cannot produce multiple tokens independently. Every optimization -- quantization, better kernels, smaller models -- still runs the same one-token-at-a-time loop. You can make each step cheaper, but you cannot skip the chain.',
        'The deeper wall is arithmetic intensity. A single decode step reads the entire weight matrix (tens of gigabytes) and the KV cache to produce one token. The GPU loads all those bytes, does a small amount of math, and outputs one number. Thousands of ALU cores wait idle. Memory bandwidth, not compute, is the constraint. The GPU could verify five tokens in the time it takes to read the weights once, because the math for five positions costs almost nothing extra once the weights are already loaded. That is the opening speculation exploits.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Verifying K tokens costs about the same as generating one. The target model\'s forward pass is dominated by reading weights from memory. Once those weights are loaded for verification, scoring K candidate positions requires only a small amount of additional arithmetic -- the same weights, reused K times. This is exactly how the prefill phase works: the model processes hundreds of prompt tokens in one pass because the bottleneck is weight-loading, not per-token compute.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png', alt: 'Transformer model architecture diagram with encoder and decoder blocks', caption: 'Transformer decoding is expensive because each verified position reuses the same large block stack and attention machinery. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png.'},
        'A draft model that agrees with the target 80% of the time turns one expensive forward pass into 4-5 accepted tokens on average. The key constraint: the output must be identical to what the target model would have produced alone. A modified rejection sampling rule guarantees this -- accept draft token x with probability min(1, p(x)/q(x)), where p is the target distribution and q is the draft. If rejected, resample from the residual distribution. This is not an approximation. The output is statistically identical to the target model alone.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Two models: a small draft model q and the large target model p. From the current context, q proposes K tokens ahead. The system then feeds the context plus all K proposed tokens to p in a single parallel verification pass. That pass computes the target distribution at each proposed position -- the same computation p would have done one step at a time, but batched.',
        'For greedy decoding (temperature = 0), the rule is simple: accept the longest prefix of draft tokens that matches what the target model would have chosen. At the first disagreement, discard the rest and use the target model\'s own token. If all K draft tokens match, the verification pass also produces the next token for free -- a bonus. The animation shows this deterministic version because it makes the mechanics visible.',
        'For sampling (temperature > 0), acceptance is probabilistic. The draft proposes token x sampled from q. The target checks whether to keep it with probability min(1, p(x)/q(x)). If accepted, move on. If rejected, sample the replacement from the positive part of (p - q), normalized. This rejection-sampling rule preserves the exact target distribution. A correct implementation does not produce "approximately target-like" output -- it samples from the same distribution the target model would have used without speculation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Language is locally predictable. After "the cat sat on the," most models -- large and small -- assign high probability to similar continuations. A draft model trained on the same data, distilled from the target, or sharing its tokenizer and early layers can propose a useful prefix that the target will accept. The verification pass processes those positions in parallel, like a mini-prefill, reusing weight reads across all K positions.',
        'The correctness guarantee comes from the rejection sampling math. At each position, the acceptance probability min(1, p(x)/q(x)) ensures that accepted tokens follow the target distribution p. When q(x) > p(x), the draft overestimates that token, so it is accepted less often. When q(x) <= p(x), the draft underestimates, so the token is always accepted. Rejected tokens are replaced by sampling from the residual (p - q)+ distribution. The combined accept-or-resample procedure produces exactly distribution p. This was proven independently by Leviathan et al. and Chen et al.',
        'The speedup lever is accepted tokens per target pass. If the draft proposes four tokens and three are accepted plus a bonus token, one target pass produced four output tokens. If the first draft token is rejected, the target pass produced only one token -- no worse than ordinary decoding, but the draft work was wasted. Acceptance rate, not draft speed, determines whether speculation helps.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Let K be draft tokens proposed per round, and let the per-token acceptance rate be α. On average, the system accepts about αK tokens before the first rejection, plus one resampled or bonus token. The expected tokens per target pass is roughly (1 - α^(K+1)) / (1 - α). With α = 0.8 and K = 4, that is about 3.4 tokens per target pass -- a 3.4x speedup over standard decoding, minus draft overhead.',
        'The real cost is memory. Loading a second model consumes GPU memory that could serve a larger batch. A 7B draft model alongside a 70B target adds 10% to memory usage at FP16, more with its own KV cache. Some systems put the draft on a separate device, but then inter-device transfer enters the critical path. Others use self-speculative methods (layer-skipping within the target) or Medusa heads (small prediction heads attached to the target) to avoid the second model entirely.',
        'Typical production speedups are 2-3x. The ceiling depends on draft-target agreement, which varies by domain. Code completion often sees 80-90% acceptance (code is locally predictable). Creative writing at high temperature sees lower acceptance. The technique is free in output quality -- the distribution is preserved exactly -- but not free in system complexity.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'LLM serving infrastructure uses speculative decoding widely. vLLM, TensorRT-LLM, and most major inference providers run it in production. It is a large part of why streaming output feels fast -- inter-token latency drops by 2-3x.',
        'Code generation is a sweet spot. Code is syntactically constrained and locally repetitive, so draft models achieve high acceptance rates. Autocomplete systems that generate 10-50 tokens of code benefit heavily. Translation is similar: the structure of the output is predictable enough that a small model can draft accurately.',
        'Long-form generation benefits whenever the output is predictable at the local level -- summaries, structured extraction, document generation, chat responses. Any workload that produces many tokens and tolerates the memory cost of a second model is a candidate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A weak draft model kills the speedup. If draft-target agreement is below 50%, most rounds accept only one token, and the draft overhead (memory, latency, scheduling) produces a net slowdown. A draft that works on English chat may fail on code, math, multilingual text, or JSON schema output. Speculation must be re-evaluated whenever the target model, tokenizer, or decoding policy changes.',
        'Batched serving reduces the benefit. When the target model is already processing many sequences in a batch, memory bandwidth is better utilized and the arithmetic-intensity gap shrinks. Speculation helps most at batch size 1 (interactive use) and helps least when the server is throughput-bound with large batches.',
        'Correctness hazards are subtle. An implementation that skips the rejection sampling rule changes the output distribution. An implementation that forgets a logit processor (temperature, top-p, repetition penalty) can emit tokens the target model would have masked. A system that does not roll back rejected draft KV cache entries corrupts later positions. These bugs produce fluent-looking but statistically wrong output. Speculative decoding is a control-plane feature with invariants, not a harmless flag.',
        'Draft-free alternatives exist. Medusa (Cai et al. 2024) attaches small prediction heads to the target model itself, avoiding the second model entirely -- reported 2.2x speedup. Self-speculative decoding skips layers within the target to create a cheaper "draft" pass. Prompt-lookup speculation reuses n-grams from the input, which works well for code and copy-heavy tasks. Each trades a different resource for speed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Target model: 70B. Draft model: 7B. K = 4 (draft proposes 4 tokens per round). The target would greedily produce: "the cat sat on the mat."',
        'Round 1. Draft proposes: "the", "cat", "sat", "on". Target verifies all four in one forward pass. All four match what the target would have said. Accepted: 4 tokens. The verification pass also computes the next target token, "the" -- a free bonus. Net gain: 5 tokens from 1 target pass.',
        'Round 2. Draft proposes: "mat", "and", "purred", "softly". Target agrees with "mat" but would have said "." instead of "and". Rejection at position 2. Accepted: "mat" (1 token). Target supplies "." as the replacement. Tokens "and", "purred", "softly" are discarded. Net gain: 2 tokens from 1 target pass.',
        'Result: 7 tokens ("the cat sat on the mat .") from 2 target passes instead of 7. Speedup: 3.5x. The final sequence is identical to what the target would have produced alone. The draft model changed the speed, not the words.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Leviathan et al. 2023, "Fast Inference from Transformers via Speculative Decoding" -- the original formulation and proof that the output distribution is preserved. Chen et al. 2023, "Accelerating Large Language Model Decoding with Speculative Sampling" -- independent concurrent work with the same core idea. Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads" -- draft-free alternative using prediction heads. Stern et al. 2018, "Blockwise Parallel Decoding" -- earlier multi-token prediction work that planted the seed.',
        {
          type: 'bullets',
          items: [
            'KV Cache -- speculative decoding extends the cache; understanding why decode is memory-bound makes the entire technique click.',
            'Transformer Block -- the model being accelerated; understanding the forward pass explains why verification of K tokens costs about the same as generating one.',
            'Attention -- the mechanism that makes parallel verification possible; attention over cached keys is already a batch operation, so scoring K positions reuses the same weight reads.',
            'Knowledge Distillation -- the technique used to train draft models that closely match the target\'s distribution, which directly controls acceptance rate.',
            'Quantization -- the complementary approach that reduces per-token cost; speculative decoding is orthogonal and can be combined with it.',
          ],
        },
      ],
    },
  ],
};
