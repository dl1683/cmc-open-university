// Beam search vs greedy decoding: how an LLM actually picks its words.
// Greedy grabs the best next token; beam search keeps k hypotheses alive —
// and sometimes the best sentence starts with the second-best word.

import { callTreeState, InputError } from '../core/state.js';

export const topic = {
  id: 'beam-search',
  title: 'Beam Search vs Greedy',
  category: 'AI & ML',
  summary: 'Keep k candidate sentences alive instead of one — and watch greedy decoding lose.',
  controls: [
    { id: 'mode', label: 'Decode with', type: 'select', options: ['greedy', 'beam (k=2)'], defaultValue: 'beam (k=2)' },
  ],
  run,
};

// A toy language model's continuation tree for the prompt "The cat…".
// Each node: token and its probability GIVEN the path so far. Rigged the way
// real language is: the locally-best first word leads to a mediocre sentence.
const TREE = {
  token: 'The cat', p: 1, children: [
    { token: 'sat', p: 0.5, children: [
      { token: 'on', p: 0.5, children: [{ token: 'it', p: 0.4, children: [] }, { token: 'me', p: 0.3, children: [] }] },
      { token: 'down', p: 0.4, children: [{ token: 'again', p: 0.5, children: [] }, { token: 'fast', p: 0.2, children: [] }] },
    ] },
    { token: 'ran', p: 0.3, children: [
      { token: 'away', p: 0.9, children: [{ token: 'home', p: 0.9, children: [] }, { token: 'fast', p: 0.1, children: [] }] },
      { token: 'far', p: 0.1, children: [{ token: 'away', p: 0.8, children: [] }] },
    ] },
    { token: 'is', p: 0.2, children: [
      { token: 'happy', p: 0.8, children: [{ token: 'now', p: 0.7, children: [] }] },
      { token: 'gone', p: 0.2, children: [{ token: 'now', p: 0.5, children: [] }] },
    ] },
  ],
};

const pct = (x) => `${Math.round(x * 100)}%`;

export function* run(input) {
  const mode = String(input.mode);
  if (!['greedy', 'beam (k=2)'].includes(mode)) throw new InputError('Pick a decoding mode.');
  const k = mode === 'greedy' ? 1 : 2;

  // frames mirror the explored part of the tree
  const frames = new Map();
  let counter = 0;
  const addFrame = (node, parentId, score) => {
    const id = `f${counter++}`;
    frames.set(id, {
      id, parentId, name: node.token, args: pct(score),
      status: 'waiting', result: null, node, score,
    });
    return id;
  };
  const snapshot = () => callTreeState([...frames.values()].map(({ node, score, ...f }) => f));

  const rootId = addFrame(TREE, null, 1);
  frames.get(rootId).status = 'active';

  yield {
    state: snapshot(),
    highlight: { active: [rootId] },
    explanation: `A language model never outputs a sentence — it outputs next-token probabilities, one step at a time. The question is what to DO with them. ${k === 1 ? 'GREEDY decoding: always take the single most likely token. Fast, obvious… and short-sighted, as you\'re about to see.' : 'BEAM SEARCH (k=2): keep the 2 best partial sentences alive at every step, judged by their TOTAL probability so far. A weaker first word can survive long enough to win.'} Each node shows its sentence-so-far probability.`,
  };

  let beam = [{ id: rootId, node: TREE, score: 1 }];
  for (let depth = 1; depth <= 3; depth += 1) {
    // expand every live hypothesis
    const candidates = [];
    for (const hyp of beam) {
      if (hyp.node.children.length === 0) { candidates.push(hyp); continue; }
      for (const child of hyp.node.children) {
        const score = hyp.score * child.p;
        const id = addFrame(child, hyp.id, score);
        candidates.push({ id, node: child, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const kept = candidates.slice(0, k);
    const pruned = candidates.slice(k);

    for (const c of kept) frames.get(c.id).status = 'active';
    for (const hyp of beam) if (!kept.some((c) => c.id === hyp.id)) frames.get(hyp.id).status = 'waiting';
    for (const p of pruned) frames.get(p.id).status = 'waiting';

    yield {
      state: snapshot(),
      highlight: { active: kept.map((c) => c.id), visited: pruned.map((p) => p.id) },
      explanation: `Step ${depth}: expand every live hypothesis, multiply in each continuation's probability, ${k === 1 ? 'and keep only the single best' : 'rank them ALL together, and keep the top 2'}: ${kept.map((c) => `"…${frames.get(c.id).name}" at ${pct(c.score)}`).join(', ')}. ${pruned.length ? `Pruned ${pruned.length} weaker branch${pruned.length === 1 ? '' : 'es'} (faded).` : ''}`,
      invariant: k === 1 ? 'Greedy carries exactly one hypothesis — it can never recover from a locally-good, globally-bad pick.' : 'The beam always holds the k best COMPLETE prefixes, not the k best next words.',
    };
    beam = kept;
  }

  const winner = beam[0];
  const path = [];
  let walk = winner.id;
  while (walk) { path.unshift(walk); walk = frames.get(walk).parentId; }
  for (const id of path) frames.get(id).status = 'returned';
  frames.get(winner.id).result = pct(winner.score);

  const sentence = path.map((id) => frames.get(id).name).join(' ');
  yield {
    state: snapshot(),
    highlight: { returning: path },
    explanation: k === 1
      ? `Greedy's sentence: "${sentence}" at ${pct(winner.score)} total. It took "sat" because 50% beat 30% in the moment — and walked into weak continuations. Now run BEAM (k=2) on the same model: it keeps "ran" alive and finds "The cat ran away home" at 24%, beating this. The lesson generalizes: locally optimal is not equal to globally optimal.`
      : `Beam's winner: "${sentence}" at ${pct(winner.score)} — built on "ran", the SECOND-best first word, which greedy throws away immediately (try it). Larger beams search wider at linear cost; today's chat LLMs usually use temperature SAMPLING instead (see Softmax & Temperature), but beam search still rules translation and speech recognition, where there's one right answer to find.`,
  };
}

export const article = {
  sections: [
    {
      heading: "Why this exists",
      paragraphs: [
        "A language model emits a probability distribution for the next token, not a completed sentence. The decoder has to decide how much future possibility to keep alive. Greedy decoding chooses the best next token at every step and commits immediately. That is fast, deterministic, and often good enough for narrow tasks.",
        "Beam search exists because the best whole sequence may start with a token that is not locally best. A translation, transcript, caption, or structured output can need one weaker prefix to survive until its later tokens make the full sequence better. Beam search keeps a small frontier of candidate prefixes instead of one path or the entire tree.",
      ],
    },
    {
      heading: "The naive approach",
      paragraphs: [
        "The first naive approach is greedy decoding. For the prompt in the demo, greedy sees that `sat` has the highest first-step probability and takes it. After that, every future decision is trapped under the `sat` prefix. Greedy never asks whether the second-best first token could lead to a stronger sentence.",
        "The other naive approach is exhaustive search. Expand every possible token at every position, score every complete sequence, and choose the best one. That is impossible for real language generation because the vocabulary can contain tens of thousands of tokens and the tree grows exponentially with length. Beam search is the practical middle ground: keep only k prefixes at each step.",
      ],
    },
    {
      heading: "The core insight",
      paragraphs: [
        "The core insight is frontier pruning. At depth t, the decoder does not need every possible prefix. It keeps the k best prefixes under the current scoring rule, expands only those, and repeats. k is the beam width. k = 1 is greedy. Larger k buys more search coverage at a roughly linear increase in decode work.",
        "The score is cumulative, not local. A prefix is ranked by the probability of the whole prefix so far, usually represented as a sum of log probabilities. That is why a locally weaker token can survive. It may be below the first-place token at step one, but its later continuations can produce a better total sequence.",
      ],
    },
    {
      heading: "How it works",
      paragraphs: [
        "At each decoding step, the model scores the vocabulary for every live hypothesis. The decoder combines each hypothesis score with each candidate next-token score, ranks the expanded candidates, and keeps the best k prefixes. The loop stops when enough beams reach end-of-sequence, a maximum length is hit, or a task-specific stopping rule fires.",
        "Real implementations use log probabilities because multiplying many small probabilities underflows. They also use top-k selection instead of sorting every expanded candidate when possible. A beam record stores tokens, accumulated score, parent pointer, completion flag, and model cache state. In a transformer decoder, the KV Cache must be tracked per beam because each prefix has different attention history.",
        "Most production beam decoders add scoring controls. Length normalization prevents short outputs from winning only because they contain fewer negative log probabilities. Coverage penalties help translation systems avoid ignoring source words. Constrained beam search can force required phrases or grammar states. The algorithm is simple; the scoring rule decides whether it behaves well.",
      ],
    },
    {
      heading: "What the visual is proving",
      paragraphs: [
        "The visual proves the difference between local and cumulative choice. Each node is a partial sentence with the probability of the whole prefix, not merely the probability of the last token. Greedy keeps one active path. Beam search expands all live paths, ranks the resulting prefixes together, and keeps the frontier.",
        "The important moment is the first pruning point. In the toy tree, `ran` starts below `sat`, so greedy throws it away. Beam search with k = 2 keeps it alive. Later, `ran away home` becomes the better complete sequence. The picture is not claiming that beam search is magic. It is showing exactly what extra state buys: reversible commitment for a few alternatives.",
      ],
    },
    {
      heading: "Why it works",
      paragraphs: [
        "Beam search works when the scoring rule gives useful partial guidance. If a good final sequence tends to have good prefixes, keeping the top k prefixes preserves enough of the useful search space while discarding most of the exponential tree. It is an approximate best-first search with a hard memory cap.",
        "It is not an optimality proof. A beam can prune the eventual best sequence early. The method only guarantees that each step keeps the best k prefixes according to the current score among candidates it generated at that step. Increasing k reduces the chance of early loss but raises cost. Infinite k becomes exhaustive search, which defeats the reason beam search exists.",
      ],
    },
    {
      heading: "Cost and tradeoffs",
      paragraphs: [
        "The rough time cost scales with output length T, beam width k, vocabulary size V, and model step cost M. A simple mental model is that beam search multiplies decoding by k, then adds selection over the vocabulary candidates. Efficient top-k operations avoid fully sorting kV candidates, but the vocabulary projection and model forward pass still dominate many systems.",
        "Memory scales with k too. Each live beam needs tokens, score, parent links, and cached attention state. For large transformer decoders, KV cache memory can matter more than the bookkeeping arrays. Larger beams also reduce batching efficiency if beams finish at different times or require different constraints.",
        "The behavioral tradeoff is quality versus diversity. Beam search favors high-probability sequences. In translation or transcription, that often matches the product goal. In open-ended chat, it can produce bland, repetitive, similar beams. Sampling methods such as nucleus sampling and temperature often fit open-ended generation better because they intentionally allow controlled variety.",
      ],
    },
    {
      heading: "Where it wins",
      paragraphs: [
        "Beam search wins when the task has a narrow target and a strong scoring model. Neural machine translation, speech recognition, OCR, image captioning, summarization, and grammar-constrained generation are natural fits. In these settings, the system often wants one best sequence, not ten creative alternatives.",
        "Constrained beam search is especially useful when validity matters. A decoder can require certain words, obey a JSON schema, respect a grammar, or track finite-state constraints while still ranking candidates by model score. This makes beam search a bridge between probabilistic generation and symbolic validity rules.",
      ],
    },
    {
      heading: "Failure modes",
      paragraphs: [
        "The most common misconception is that a larger beam is always better. It is not. Larger beams can expose mismatch between model probability and human quality. They can also make length penalties more fragile. If the score prefers short safe outputs or generic phrases, a wider beam may find those more reliably.",
        "Beam search can also collapse. If the model distribution is low entropy, many beams become near-duplicates with tiny wording changes. Diversity-promoting beams can force variety, but then the decoder has another objective to tune. If the model itself is wrong, beam search only searches the model's mistakes more carefully.",
        "Stopping is another source of bugs. A decoder must decide when completed beams can beat unfinished beams, how to normalize length, and how to handle end-of-sequence. Small mistakes here can make outputs too short, too long, or dependent on arbitrary tie-breaking.",
      ],
    },
    {
      heading: "Study next",
      paragraphs: [
        "Study Softmax & Temperature first, because beam scores come from token probabilities. Then study KV Cache to understand why each beam carries prefix state, Transformer Block to see where logits come from, and Entropy & Information to understand why some distributions collapse to similar beams.",
        "For search contrasts, study A* Search, Graph BFS, Tree of Thoughts Search Case Study, Self-Consistency Reasoning Vote, Process Reward Models & Verifier Search, and Speculative Decoding. Beam search keeps competing prefixes. Self-consistency samples full paths and votes. Tree of Thoughts searches semantic states. Speculative decoding targets speed rather than alternate futures.",
      ],
    }
  ]
};
