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
      heading: 'What it is',
      paragraphs: [
        `Beam search is a decoding algorithm for language models that keeps the k most-likely partial hypotheses (sentences) alive at every step, instead of greedily picking the single best token. Greedy decoding says: at each step, pick the token with the highest probability, and move on. Beam search says: keep k candidate sentences ranked by their total probability so far, expand each one, score all children, and keep the k best partial sentences. A weaker first word might lead to stronger continuations, so keeping it alive gives the algorithm a second chance to find the globally best sentence instead of getting stuck with a locally-good choice.`,
        `The name "beam" refers to the width k: a beam of k=1 is greedy (one hypothesis), k=2 keeps two candidates alive, k=4 keeps four, etc. Higher k searches more broadly but costs k times more computation. In practice, k=5-10 is common in neural machine translation and speech recognition, where finding the best translation or transcription matters. Modern language models (GPT, Claude) typically use sampling (with temperature control) instead of beam search during inference, favoring diversity over optimality, but beam search is still the standard in constrained-output tasks.`
      ]
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Beam search maintains a list of k candidate hypotheses. Each hypothesis is a partial sentence (a sequence of tokens so far) paired with its total log-probability. At each step: (1) Expand: for each of the k live hypotheses, score all possible next tokens (the vocabulary, ~50k tokens). Multiply the hypothesis's probability by each next-token probability. (2) Rank: sort all k times vocab_size candidates by their total probability. (3) Prune: keep only the k best, discarding the rest. (4) Repeat: go to step 1 until all k hypotheses reach the end-of-sentence token.`,
        `In the demo, starting from "The cat" with k=2, the algorithm explores "sat" (p=0.5) and "ran" (p=0.3). Greedy picks "sat", locks in, and finds a mediocre sentence. Beam search keeps both, expands both, and then re-ranks: maybe "ran away home" (0.3 * 0.9 * 0.9 = 0.24) beats "sat on it" (0.5 * 0.5 * 0.4 = 0.1), so beam reconsiders and outputs the better sentence. This is the core of beam search: global re-ranking at every step, with a fixed-size window.`
      ]
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Each step of beam search scores all vocabulary items for each of the k live hypotheses, costing O(k times vocab_size). For a sequence of length n, total cost is O(n times k times vocab_size). With vocab_size ~ 50k and k=5, this is 250k operations per step, scaling linearly in sequence length. By contrast, greedy (k=1) costs O(n times vocab_size), just 50k per step. Sampling with temperature (used in modern LLMs) also costs O(n times vocab_size) — comparable to greedy. So beam search is roughly 5-10x slower than sampling, which is why it is reserved for tasks where exact quality matters (translation, speech) rather than open-ended generation (chat).`
      ]
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Beam search is standard in neural machine translation (NMT): Google Translate, DeepL, and others use beam search with k=4-8 to find high-quality translations. Speech recognition models (Wav2Vec, Conformer) use beam search to decode audio into text. Any seq2seq task (summarization, code generation, image captioning) benefits from beam search when the output has a single "right" answer. The reason these domains use beam search (not sampling) is because mistranslating a single word or transcribing incorrectly is costly; prioritizing the most-likely output (highest probability under the model) makes sense.`,
        `Modern large language models (GPT-3, Claude, Llama) rarely use beam search during generation. Instead, they use nucleus sampling (top-p) with temperature control — keeping inference fast and outputs diverse. But beam search remains the gold standard when you can afford the compute and want reproducibility and beam-optimal outputs.`
      ]
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A major misconception: beam search finds the globally optimal sentence. It does not. Beam search finds the highest-probability sentence under the model, which is not the same as the best sentence by human judgment. The model might assign high probability to a grammatical but meaningless sentence. Beam search optimizes for the model's beliefs, not objective quality.`,
        `Another pitfall: increasing beam size always improves quality. Beyond a certain point (usually k=5-10), larger beams give diminishing returns and add cost. The model's top k hypotheses often converge to very similar outputs once k > 5; exploring further yields no new insights.`,
        `Finally, confusing beam search with other decoding strategies. Greedy decoding is k=1 (no branching, no comparison). Nucleus sampling is probabilistic (sample from the top p% of the distribution); it is not beam search. Temperature controls the sharpness of the probability distribution; it affects both beam search and sampling independently. Beam search + length penalties (penalizing very long outputs) is common to avoid the model always preferring longer hypotheses.`
      ]
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Understand the probability model behind beam search by studying Softmax & Temperature — the probabilities come from softmax over logits. Explore Attention Mechanism to see how language models produce those logits in the first place. Research length penalties and other scoring adjustments used in practice (e.g., coverage penalties in translation to avoid repeating the same phrase). Study sampling-based decoding methods: top-k sampling, nucleus sampling, and temperature control, which are now preferred in open-ended generation. For a deeper dive, read papers on beam search variants: diverse beam search (keeping diverse hypotheses, not just high-probability ones), and constrained beam search (enforcing hard constraints on outputs). Compare performance: run the same model with greedy, beam k=1, beam k=5, and temperature sampling on a real task and observe trade-offs between speed and quality.`
      ]
    }
  ]
};
