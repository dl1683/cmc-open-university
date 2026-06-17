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
      heading: `Why decoding is slow`,
      paragraphs: [
        `Autoregressive language models generate one token at a time. After the prompt is processed, the model predicts the next token, appends that token to the context, predicts the next one, and repeats. The prompt-processing phase, often called prefill, can use parallelism across many input positions. The decode phase is harder: token t+1 depends on token t, so the system cannot simply compute the whole answer in one independent batch.`,
        `That sequential dependency makes decoding a latency bottleneck. Each target-model step must read model weights and attention state, update the KV cache, sample or choose one token, and return to the loop. For large models, the decode step is often memory-bandwidth limited rather than pure arithmetic limited. The machine spends a lot of time moving weights and cached keys and values. Speculative decoding exists because the expensive target model is slow at producing one token, but it can verify several proposed positions in parallel.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious speed trick is to use a smaller model instead of the large one. That is cheaper, but it changes the output distribution and usually changes quality. Another obvious trick is batching many users together. That improves throughput, but it does not remove the per-user dependency chain: each sequence still advances token by token. You can also quantize, prune, cache, or use better kernels, but those are optimization layers around the same sequential decode loop.`,
        `Speculative decoding takes a different route. It asks whether a cheap model can guess several future tokens, then lets the expensive model check those guesses in one target-model pass. If the guesses are good, one target pass advances the output by multiple tokens. If the guesses are bad, the target pass still supplies the next correct token, so correctness is preserved. The method changes the schedule of computation, not the model whose distribution defines the answer.`,
      ],
    },
    {
      heading: `Core insight and mechanism`,
      paragraphs: [
        `There are two models in the basic version: a draft model q and a target model p. The draft model is smaller, cheaper, or otherwise faster. Starting from the current context, q proposes k tokens ahead. The serving system then asks p to score the current context plus those k proposed tokens in a single parallel verification pass. That pass computes the target distribution at each proposed position, the same kind of computation p would have performed one step at a time.`,
        `For greedy decoding, the simplified idea is easy: accept the longest prefix of draft tokens that matches what the target model would have chosen, then let the target model supply the first token where the draft disagrees. If all k draft tokens match, the verification pass also gives a bonus next token from the target. The animation uses that deterministic prefix-matching story because it makes the mechanics visible.`,
        `For sampling, the acceptance rule is more subtle. The draft proposes a sampled token x from q. The target distribution p checks whether x can be accepted with probability min(1, p(x) / q(x)). If the token is rejected, the replacement token is sampled from the positive residual distribution that remains after accounting for the draft. This rejection-sampling rule preserves the target distribution exactly. A correct implementation does not make the output "approximately target-like"; it samples from the same distribution the target model would have used without speculation.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Speculation works when the draft model agrees with the target model often enough. Language is locally predictable: after "the cat sat on the," many models assign high probability to similar next tokens. A smaller model trained on the same data, distilled from the target, or sharing early layers with it may be good enough to propose a useful prefix. The target model then verifies the prefix in a shape closer to prefill, where multiple positions can be scored together.`,
        `The speedup lever is accepted tokens per target pass. If the draft proposes four tokens and the target accepts three plus emits one bonus token, the request gained four output tokens from one target pass. If the first draft token is rejected, the request still gained only one token from that target pass. The draft work was cheap, but the schedule did not improve much. That is why acceptance length matters more than the raw number of draft tokens proposed.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Suppose the target model would greedily produce "the cat sat on the mat." The draft model proposes "the cat sat." The target verifies those positions in one pass and agrees, so all three are accepted. The same pass gives the next target token, "on." One expensive pass advanced the output by four tokens.`,
        `On the next round the draft proposes "the mat quickly." The target agrees with "the" and "mat" but not "quickly." The system keeps the accepted prefix and discards the suffix from the first disagreement onward. The target's own token at the disagreement position becomes the output. Nothing about the final greedy sequence changes. The only question is how many target-model passes were saved along the way.`,
      ],
    },
    {
      heading: `Implementation shapes`,
      paragraphs: [
        `The simplest implementation loads a separate assistant model next to the target. The assistant may be a distilled sibling, a smaller checkpoint, or a model trained specifically to match the target's next-token distribution. That design is easy to reason about, but it costs memory and scheduling complexity because two models must be served together.`,
        `Other designs reduce the separate-model cost. Multi-token prediction heads let one model propose several future tokens. Early-exit methods let shallow layers draft and deeper layers verify. Prompt-lookup or n-gram speculation guesses tokens from repeated text in the prompt, which can work well for code, logs, and copied passages. Medusa-style heads and related approaches attach draft heads to the target model. The common control structure remains draft, verify, accept a prefix, then continue.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Measure acceptance length, target passes per generated token, draft latency, verifier latency, memory footprint, and p50 and p99 end-to-end latency. A technique that improves average latency but worsens tail latency may be a poor serving trade. Also measure by traffic class. Code completion, repeated boilerplate, and low-temperature assistant responses may speculate well. High-temperature creative writing, tool-call-heavy turns, or outputs with strict logit processors may accept shorter prefixes.`,
        `Keep the target and draft tokenization and logit transformations aligned. If the target applies temperature, top-p, repetition penalties, bad-word filters, JSON constraints, or tool-call masks, the speculative path must preserve the same distribution after those processors. Otherwise the implementation can silently change model behavior. The acceptance ledger should record draft tokens, target probabilities, accepted prefix length, rejection point, and fallback token so regressions can be debugged.`,
      ],
    },
    {
      heading: `Cost model`,
      paragraphs: [
        `The rough trade is simple. Let k be the number of draft tokens proposed, a be the expected number accepted before rejection, and b be the possible bonus token from the verifier. The system wants many output tokens per target pass, while keeping draft cost and memory low. If a is high, speculation turns one target pass into several output tokens. If a is near zero, the target still does almost the same work as ordinary decoding and the draft path adds overhead.`,
        `Memory can dominate the decision. Loading a second model may reduce latency but lower batch size or increase GPU pressure. Draft KV cache also consumes memory. Some systems place the draft on a different device, but then inter-device transfer and synchronization become part of the critical path. The best design depends on the serving stack, model size, traffic mix, and whether throughput or first-token and inter-token latency is the main product constraint.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `A weak draft is the obvious failure. It proposes many tokens, but the target rejects early, so each target pass advances only one token. A too-strong draft can also be wasteful if it consumes too much memory or latency. A mismatched draft may work on general chat but fail on code, math, multilingual text, tool schemas, or a new model checkpoint. Speculation should be versioned and evaluated whenever the target model, tokenizer, or decoding policy changes.`,
        `There are also correctness hazards. An implementation that accepts tokens without the right probabilistic correction changes the sampling distribution. An implementation that forgets a logit processor can emit tokens ordinary decoding would have masked. A serving system that does not roll back rejected draft KV state cleanly can corrupt later positions. These bugs are subtle because the output may look fluent. Treat speculative decoding as a control-plane feature with invariants, not as a harmless latency flag.`,
      ],
    },
    {
      heading: `Where it matters`,
      paragraphs: [
        `Speculative decoding matters in user-facing LLM products because inter-token latency shapes the feel of streaming. It also matters in batch inference because target passes are expensive and memory bandwidth is scarce. Any workload that produces long continuations can benefit if the draft path is cheap and aligned: chat, summarization, code completion, document generation, and structured extraction.`,
        `It matters less when generation is short, when retrieval or tools dominate latency, when the serving stack is already throughput-bound by batching, or when memory pressure prevents a second model from fitting efficiently. The practical question is not whether speculation is clever. The question is whether accepted tokens per target pass improves the service-level objective enough to justify the memory and operational complexity.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary sources to start with are Fast Inference from Transformers via Speculative Decoding at https://arxiv.org/abs/2211.17192 and Accelerating Large Language Model Decoding with Speculative Sampling at https://arxiv.org/abs/2302.01318. For implementation variants, study Medusa at https://arxiv.org/abs/2401.10774 and LayerSkip at https://arxiv.org/abs/2404.16710.`,
        `Within this curriculum, study KV Cache first because it explains why decoding is memory-bound and why verifying several positions can be cheap. Then study Speculative Decoding Acceptance Ledger, Early-Exit Transformer Layer Skipping, Knowledge Distillation, Softmax & Temperature, Beam Search vs Greedy, Constrained Decoding, Transformer Inference Roofline, LLM Inference Cost Stack, and Verifier-Guided Inference Control Plane Case Study.`,
      ],
    },
  ],
};
