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
      heading: `What it is`,
      paragraphs: [
        `Beam search is a compromise between greedy decoding and exhaustive search. Greedy decoding keeps one partial output: at each step, choose the highest-probability next token and never reconsider. Beam search keeps k partial outputs, expands each one, ranks the expanded candidates by cumulative score, and keeps the best k. A locally second-best token can survive long enough to reveal a better full sentence.`,
        `The beam width k controls the search budget. k = 1 is greedy. k = 4 or k = 8 is common in older neural machine translation and speech-recognition setups. Open-ended chat systems usually prefer sampling controlled by Softmax & Temperature, because they want diversity rather than one high-probability paraphrase. But beam search remains useful when the output has a narrow target: translation, transcription, code constrained by a grammar, or structured data generation.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Implementations use sums of log probabilities, not raw probability multiplication, to avoid underflow. At each decoding step, the model scores the vocabulary for every live hypothesis. The algorithm adds each next-token log probability to that hypothesis's accumulated score, keeps the top k continuations, and repeats until end-of-sequence or a maximum length. The KV Cache must be tracked per beam, because each partial sequence has a different prefix state.`,
        `The demo's arithmetic uses raw probabilities because it is visible: "ran" starts lower than "sat" but leads to stronger continuations. In real systems, scores are usually modified with length penalties, coverage penalties, or constraints. Without a length penalty, log probabilities make longer sequences look worse because every extra token adds a negative number. With too much length reward, the decoder rambles. Practical beam search is scoring design plus pruning, not just "keep k."`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Beam search roughly multiplies decode work by k, but the real bill is the model forward pass, cache memory, and vocabulary projection, not just sorting 50k scores. For output length T, beam width k, vocabulary V, and model cost M per step, the rough shape is O(T k (M + V log k)) if you take top candidates efficiently rather than fully sorting kV every time. Memory also scales with k because each beam carries tokens, scores, and cached attention state. Speculative Decoding attacks a different bottleneck: it proposes multiple future tokens, while beam search keeps multiple competing futures.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Beam search was central in sequence-to-sequence translation systems after the 2014-2017 neural machine translation wave. Speech recognizers often combine acoustic scores, language-model scores, and lexicon constraints in beam-like decoders. Image captioning and summarization systems have used it too, especially when evaluation rewards one concise output. Constrained beam search can enforce required words, JSON schemas, or grammar rules, making it useful when "valid" matters as much as "likely."`,
        `Large chat models more often use nucleus sampling, top-k sampling, or low-temperature argmax. Those systems optimize user experience: variety, latency, and avoiding near-duplicate beams. Beam search can make open-ended prose bland because many beams collapse to similar high-probability continuations. Diversity-promoting beams exist, but they add more scoring knobs.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Beam search is not guaranteed global optimal decoding unless the beam is wide enough to avoid pruning the eventual winner, which defeats the point. It is closer to A* Search or Graph BFS in spirit: maintain a frontier, score candidates, prune aggressively, accept that the heuristic can throw away a path that later would have won. It optimizes model score, not human quality. A bad model with a perfect beam still returns bad high-probability text.`,
        `Bigger beams can hurt. Translation papers have repeatedly observed quality saturation or degradation at large beam sizes, partly because model probabilities and human metrics disagree and partly because length normalization becomes fragile. Beam search is deterministic only if all tie-breaking, floating-point behavior, and model state are deterministic.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Softmax & Temperature first, because beam scores come from token probabilities. Self-Consistency Reasoning Vote shows a different decoding-time search pattern: sample full paths and vote over final answers. Tree of Thoughts Search Case Study turns intermediate reasoning into an explicit frontier, while Monte Carlo Tree Search & UCT Primer shows the classical exploration/exploitation version of tree search. The Transformer Block explains where logits come from; KV Cache explains why every beam needs its own prefix state. Entropy & Information helps explain why low-entropy models collapse beams into similar outputs. Speculative Decoding is the speed-focused alternative, and A* Search plus Graph BFS connect beam search to older frontier-search algorithms.`,
      ],
    }
  ]
};
