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
      heading: `What it is`,
      paragraphs: [
        `Speculative decoding is a parallelization trick that lets a big language model generate text as much as 3–5 times faster while producing absolutely identical output. The idea is elegantly simple: instead of the big model generating one token, waiting, then generating the next, a tiny draft model (often a smaller sibling or distilled version) guesses several tokens ahead in one cheap forward pass. The big model then verifies all those guesses at once in a single parallel pass — the same computational shape as processing a long input prompt (prefill). If the draft model's guesses match what the big model would have generated anyway, they are accepted wholesale. If there is a mismatch, the drafts from that point onward are discarded, and the big model supplies its own token instead.`,
        `The output is provably identical to what the big model would produce alone — no approximation, no regrets. This is not a heuristic or a degradation; it is mathematically sound. The acceptance rule (rejection sampling) preserves even sampling distributions exactly, so the statistical properties of the generation are unchanged. OpenAI, Google, and other major LLM providers run this in production because it is one of the simplest wins in inference speed.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The draft model and the big model run in a tight loop. First, the draft model generates k tokens cheaply (often at 1/5th to 1/20th of the big model's latency, depending on size). These k tokens are treated as hypotheses — not the final answer. Then the big model processes all k proposed tokens plus the context in one forward pass. During this pass, the big model computes the probability distribution over the next token at every position, just as it normally would. This batch processing is the magic: computing k positions in parallel costs nearly the same as computing one, because the computation is memory-bound, not arithmetic-bound. The reading of weights and KV cache (see KV Cache topic) dominates, not the math.`,
        `At each position, the big model checks whether its most-likely token matches the draft's proposal. If position 1 matches and position 2 matches, but position 3 disagrees, the first two tokens are accepted, and the big model's choice at position 3 is taken instead. No tokens are wasted: even the tokens the draft got wrong cost nothing extra because they were verified in a single pass. If the draft model proposes tokens and all of them match, the big model gets one extra "free" token out of the same verification pass — a bonus token that costs nothing, since the computation was happening anyway.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The speedup depends almost entirely on the draft model's agreement rate with the big model. A well-trained draft model (like a 7B distilled version of a 70B base) can achieve 60–70% agreement on each token, giving a 3–4× speedup with minimal overhead. A weak draft, with only 30–40% agreement, manages only 1.2–1.5× speedup — barely worth the complexity. The real cost is GPU memory: you must load both models simultaneously, and memory is the bottleneck in production inference. For a billion-parameter big model and a 100M–500M draft model, that is a substantial additional footprint. Latency overhead is negligible: the draft model's passes are so fast that even failed speculations cost almost nothing. The winning condition is simple: the draft must be cheap enough and accurate enough that the speedup outweighs the memory burden.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every major LLM provider uses speculative decoding in production. Claude at Anthropic, GPT-4 at OpenAI, Gemini at Google, and Llama deployments at Meta all rely on this for streaming speed. When you chat with an LLM and words stream in rapidly, speculative decoding is a major reason why latency feels acceptable. The draft model is usually created through Knowledge Distillation — training a small student model to mimic a large teacher — or by pruning a larger model. In some setups, the draft model is an older, smaller checkpoint of the same training run. The technique is so effective and so simple that it has become standard practice. You see it mentioned in technical discussions of inference optimization whenever people talk about why generation is faster than you would expect from just scaling up hardware.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A common misconception is that speculative decoding is an approximation or a degradation. It is not: the output distribution is identical by design, and the acceptance rule preserves sampling. Another pitfall is assuming it works equally well for all applications. It works best for text generation with high beam agreement, and poorly for highly creative or highly constrained generation (low temperature, many rejections). Practitioners sometimes underestimate the GPU memory overhead: a draft model that is 1/10th the size still demands 1/10th more memory on the device, which can be the difference between a model fitting in VRAM and not. Finally, there is a temptation to use a draft model so weak that it gets rejected constantly, turning speculative decoding into busy work. The speedup depends on agreement, not on speculation count. A smaller draft model trained well beats a larger draft model trained poorly.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Speculative Decoding Acceptance Ledger turns this primer into a production case study: draft probabilities, target probabilities, acceptance length, KV handoff, p99 gates, and rollback conditions.`,
        `Early-Exit Transformer Layer Skipping shows the LayerSkip variant of this idea: the same model drafts from early layers, then deeper layers verify or repair the draft without loading a separate assistant model.`,
        `To understand why speculative decoding is possible, read KV Cache — it explains why generation is memory-bound and why batching many positions together is cheap. Knowledge Distillation covers how to train a draft model that is both small and accurate. Softmax & Temperature explores how sampling distributions work and why rejection sampling preserves them. Beam Search vs Greedy and Attention Mechanism provide context on how big models generate text one token at a time in the first place.`,
      ],
    },
  ],
};
