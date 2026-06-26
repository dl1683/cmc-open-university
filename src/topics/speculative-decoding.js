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
    { heading: 'How to read the animation', paragraphs: ['Active tokens are draft guesses, found tokens are target-accepted output, and removed tokens are rejected guesses. Read each round as cheap proposal followed by target verification.', {type: 'callout', text: 'Speculative decoding is safe speedup only when verification preserves the target distribution, not just a plausible continuation.'}, {type: 'image', src: './assets/gifs/speculative-decoding.gif', alt: 'Animated walkthrough of the speculative decoding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['Autoregressive language models emit one token after another. Each target-model decode step is expensive, so interactive latency is often limited by one accepted token per large-model pass.'], },
    { heading: 'The obvious approach', paragraphs: ['The obvious speedups make each pass cheaper with quantization, kernels, batching, or KV cache reuse. Those help, but a single sequence still advances one target token at a time.'], },
    { heading: 'The wall', paragraphs: ['A small model alone is faster but changes the model being sampled. The target cannot independently choose several future tokens because each future token depends on the earlier accepted token.'], },
    { heading: 'The core insight', paragraphs: ['A cheap draft model can guess several tokens, and the target model can verify those positions together. The target stays authoritative, so speed comes only from accepted draft prefix length.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png', alt: 'Transformer model architecture diagram with encoder and decoder blocks', caption: 'Transformer decoding is expensive because each verified position reuses the same large block stack and attention machinery. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png.'}], },
    { heading: 'How it works', paragraphs: ['From the current context, the draft proposes K tokens. The target scores the context plus those K tokens in one verification pass, then accepts the longest safe prefix or samples with a rejection rule.'], },
    { heading: 'Why it works', paragraphs: ['For greedy decoding, every emitted token is either a draft token the target also chose or a target replacement at the first disagreement. For sampling, rejection sampling adjusts draft probabilities so the final distribution remains the target distribution.'], },
    { heading: 'Cost and complexity', paragraphs: ['If K = 4 and the draft is accepted 80 percent per position, one target pass can often yield about three or more tokens before overhead. The tax is draft computation, extra memory, scheduler complexity, and rollback of rejected state.'], },
    { heading: 'Real-world uses', paragraphs: ['Speculative decoding fits interactive LLM serving, code completion, translation, extraction, and structured generation when local continuations are predictable. It is strongest when the draft and target agree often.'], },
    { heading: 'Where it fails', paragraphs: ['It fails when the draft is weak, the sampling policy is implemented differently in draft and target, or batching already fills the accelerator. A wrong verifier can produce fluent text that no longer matches target-model sampling.'], },
    { heading: 'Worked example', paragraphs: ['Suppose the target would greedily emit the cat sat on the mat. Round 1 accepts four draft tokens plus a bonus next token, while round 2 accepts mat and replaces the rejected next word with a period, giving seven tokens from two target passes.'], },
    { heading: 'Sources and study next', paragraphs: ['Study Leviathan et al. on speculative decoding, Chen et al. on speculative sampling, Stern et al. on blockwise parallel decoding, and Medusa-style draft-free variants. Then review Transformer Block, KV Cache, Attention, Quantization, and Knowledge Distillation.'], },
  ],
};
