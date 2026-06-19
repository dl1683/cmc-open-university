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

// A toy language model\'s continuation tree for the prompt "The cat…".
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
      explanation: `Step ${depth}: expand every live hypothesis, multiply in each continuation\'s probability, ${k === 1 ? 'and keep only the single best' : 'rank them ALL together, and keep the top 2'}: ${kept.map((c) => `"…${frames.get(c.id).name}" at ${pct(c.score)}`).join(', ')}. ${pruned.length ? `Pruned ${pruned.length} weaker branch${pruned.length === 1 ? '' : 'es'} (faded).` : ''}`,
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
      ? `Greedy\'s sentence: "${sentence}" at ${pct(winner.score)} total. It took "sat" because 50% beat 30% in the moment — and walked into weak continuations. Now run BEAM (k=2) on the same model: it keeps "ran" alive and finds "The cat ran away home" at 24%, beating this. The lesson generalizes: locally optimal is not equal to globally optimal.`
      : `Beam\'s winner: "${sentence}" at ${pct(winner.score)} — built on "ran", the SECOND-best first word, which greedy throws away immediately (try it). Larger beams search wider at linear cost; today\'s chat LLMs usually use temperature SAMPLING instead (see Softmax & Temperature), but beam search still rules translation and speech recognition, where there\'s one right answer to find.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Each node is a partial sentence. The percentage on a node is the joint probability of the entire prefix up to that point — not the probability of the last token alone. Highlighted nodes are the active beam: the hypotheses the decoder is still considering. Faded nodes were expanded, scored, and pruned because a higher-scoring prefix existed.",
        "Toggle between greedy and beam (k=2) to see the difference. Greedy keeps exactly one active node per depth level. Beam search keeps two. At the first expansion, greedy commits to 'sat' (50%) and discards 'ran' (30%). Beam search keeps both. By depth three, 'ran away home' reaches 24% total probability while greedy's path through 'sat' lands at 10%.",
        "The returning path at the end traces the winner back to the root. The gap between greedy's result and beam's result is the price of committing too early to a locally dominant token.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "An autoregressive model — a machine translator, speech recognizer, image captioner, or text generator — does not output a finished sentence. It outputs a probability distribution over the next token, one step at a time. Something has to turn that stream of distributions into a complete sequence. That something is the decoding strategy.",
        "The output space is exponential. A vocabulary of 50,000 tokens and a sequence length of 20 produce 50,000^20 possible outputs. Exhaustive search is out of the question. The decoder must search selectively, and the question is how much of the possibility tree to keep alive at each step.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "Greedy decoding: at every step, pick the single most probable next token, append it, and move on. One forward pass per step, no bookkeeping, no alternatives to track. For many tasks this is fast enough and good enough.",
        "Greedy is appealing because it is the simplest thing that could work. It mirrors how a person might write — choose the best next word and keep going. And when the model is confident and the output is short, greedy often matches the result of more expensive methods.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "Greedy fails because the best sequence does not always start with the best first token. The joint probability of a sequence is the product of every conditional token probability along the path. A first token at 30% can lead to continuations at 90% each, producing a total probability that dominates a path that started at 50% but decayed through weak continuations.",
        "The animation shows this directly. Greedy picks 'sat' (50%) over 'ran' (30%) and ends at a total of 10%. Beam search keeps 'ran' alive and finds 'ran away home' at 24%. The locally optimal choice led to a globally inferior sequence.",
        "The problem gets worse with longer outputs and larger vocabularies. More steps mean more chances for a weaker start to recover through stronger continuations, and more vocabulary means more alternatives that greedy never sees.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Keep k partial sequences alive instead of one. At each step, expand all k prefixes by the full vocabulary, score every candidate by its cumulative probability, and keep only the top k. This is frontier pruning: the decoder carries a fixed-width frontier through the exponential tree, discarding everything outside the top k at each level.",
        "The ranking is cumulative, not local. A prefix is scored by the product of all token probabilities from the start (in practice, a sum of log-probabilities to avoid underflow). A token that loses at step one can survive because its later continuations lift the total score above competitors. k = 1 recovers greedy decoding. Larger k searches wider at roughly linear cost.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "Initialize with k = beam width copies of the start-of-sequence token, each with score 0 (log-probability). At each decoding step: (1) run the model forward on all k live prefixes to get next-token distributions, (2) for each prefix, combine its accumulated log-probability with each candidate token's log-probability to get k times V candidate scores, (3) select the top k candidates across all prefixes, (4) update the beam with these k new prefixes.",
        "The loop continues until enough beams emit an end-of-sequence token, a maximum length is reached, or a task-specific stopping condition fires. Completed beams are moved to a finished set and compared against still-running beams after length normalization.",
        "Each beam record stores its token sequence, accumulated score, parent pointer, and completion flag. In a transformer decoder, every beam also carries its own KV cache because each prefix has different attention history. Length normalization divides the log-probability by length^alpha (alpha typically 0.6 to 1.0) to prevent short outputs from winning simply because they multiplied fewer numbers less than one. Coverage penalties in translation systems penalize beams that ignore source words.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Beam search is an approximate best-first search with a hard memory cap. It works when the scoring function provides useful partial guidance — when good final sequences tend to have good prefixes. Under that condition, keeping the top k prefixes at each level preserves enough of the useful search space while discarding most of the exponential tree.",
        "There is no optimality guarantee. A beam can prune the globally best sequence at an early step if its prefix score falls outside the top k. The method guarantees only that each step retains the best k candidates among those it actually generated. Increasing k reduces the chance of early pruning but cannot eliminate it. In the limit, k approaching the full branching factor recovers exhaustive search — which is exactly what beam search exists to avoid.",
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        "Time per sequence is O(k * V * T), where k is beam width, V is vocabulary size, and T is output length. Each step runs k forward passes through the model and selects the top k from k*V candidates. k = 1 is greedy. k = 5 (a common production value) costs roughly 5x greedy decoding time.",
        "Memory scales with k. Each beam carries tokens, scores, parent pointers, and cached attention state. For large transformers, the KV cache per beam is the dominant memory cost — a 7B-parameter model with 32 layers, 32 heads, and 2048-token context can use several gigabytes of KV cache per beam. Five beams means five copies of that state.",
        "Doubling k doubles decode cost but does not double quality. Empirically, translation quality plateaus around k = 4 to 10. Beyond that, returns diminish and can even reverse — a phenomenon called the beam search curse, where larger beams find sequences the model scores highly but humans rate lower.",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        "Machine translation has been the flagship application since the seq2seq revolution (Sutskever et al. 2014, Bahdanau et al. 2015). Translation has a narrow correct answer space and a strong scoring model, so beam search's bias toward high-probability sequences matches the goal. Production MT systems typically use k = 4 to 8.",
        "Speech recognition uses beam search to decode CTC or attention-based outputs, often combined with a language model score. Image captioning, summarization, and OCR also fit: all are tasks where one best output is desired and diversity is not a virtue.",
        "Constrained decoding extends beam search to enforce structural rules — valid JSON, grammar constraints, required phrases, or finite-state output formats. The beam explores only candidates that satisfy the constraint, combining probabilistic ranking with symbolic validity. This makes beam search the natural bridge between neural generation and structured output requirements.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "The beam search curse: larger beams sometimes produce worse output. Koehn and Knowles (2017) showed that translation quality can degrade beyond k = 10. The cause is model-quality mismatch — the model's probability ranking does not perfectly track human quality, and wider search exposes the gap. A wider beam finds sequences the model likes but humans do not.",
        "Repetition and blandness. Beam search maximizes probability, and high-probability text tends to be generic. Open-ended generation (dialogue, creative writing, code) benefits from controlled randomness. Nucleus sampling (top-p) and temperature scaling are preferred for these tasks because they deliberately allow lower-probability tokens, producing more diverse and natural text.",
        "Beam collapse. When the model distribution is low-entropy, multiple beams converge to near-identical sequences with minor wording differences, wasting the extra compute. Diverse beam search (Vijayakumar et al. 2018) penalizes similarity between beams, but adds another hyperparameter to tune.",
        "Stopping bugs. The decoder must decide when a completed beam can be compared against unfinished beams, how to normalize for length, and when all beams are finished. Small errors in these decisions produce outputs that are systematically too short, too long, or sensitive to arbitrary tie-breaking.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Vocabulary: {A, B, C, <end>}. Beam width k = 2. We decode 3 steps. All probabilities are conditional on the prefix so far; joint probability is the running product.",
        "Step 1 — expand the start token. P(A) = 0.5, P(B) = 0.3, P(C) = 0.2. Score each: log P(A) = -0.30, log P(B) = -0.52, log P(C) = -0.70. Keep top 2: A (joint 0.50) and B (joint 0.30). C is pruned.",
        "Step 2 — expand both beams. From A: P(A|A) = 0.3, P(B|A) = 0.4, P(C|A) = 0.3. Joint scores: AA = 0.50 * 0.3 = 0.15, AB = 0.50 * 0.4 = 0.20, AC = 0.50 * 0.3 = 0.15. From B: P(A|B) = 0.6, P(B|B) = 0.2, P(C|B) = 0.2. Joint scores: BA = 0.30 * 0.6 = 0.18, BB = 0.30 * 0.2 = 0.06, BC = 0.30 * 0.2 = 0.06. All six candidates ranked: AB (0.20), BA (0.18), AA (0.15), AC (0.15), BB (0.06), BC (0.06). Keep top 2: AB (0.20) and BA (0.18). Four candidates pruned.",
        "Step 3 — expand AB and BA. From AB: P(A|AB) = 0.2, P(B|AB) = 0.5, P(C|AB) = 0.3. Joint scores: ABA = 0.20 * 0.2 = 0.04, ABB = 0.20 * 0.5 = 0.10, ABC = 0.20 * 0.3 = 0.06. From BA: P(A|BA) = 0.3, P(B|BA) = 0.4, P(C|BA) = 0.3. Joint scores: BAA = 0.18 * 0.3 = 0.054, BAB = 0.18 * 0.4 = 0.072, BAC = 0.18 * 0.3 = 0.054. All six: ABB (0.10), BAB (0.072), ABC (0.06), BAA (0.054), BAC (0.054), ABA (0.04). Winner: ABB at joint probability 0.10.",
        "Greedy comparison. Greedy picks A (0.50), then B (highest at 0.4, giving AB = 0.20), then B again (highest at 0.5, giving ABB = 0.10). Here greedy and beam search agree. But change step 2 so that P(A|B) = 0.9: then BA = 0.27, and beam search keeps BA alive while greedy never sees it. The beam finds BAB = 0.27 * 0.4 = 0.108, beating ABB = 0.10. Greedy cannot recover because it discarded B at step 1.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Lowerre 1976 (The HARPY Speech Understanding System) introduced beam search for speech recognition. Sutskever, Vinyals, and Le 2014 (Sequence to Sequence Learning with Neural Networks) established beam search as the standard decoder for neural seq2seq models. Freitag and Al-Onaizan 2017 (Beam Search Strategies for Neural Machine Translation) showed diminishing returns and occasional degradation with large beams. Koehn and Knowles 2017 (Six Challenges for Neural Machine Translation) documented the beam search curse. Vijayakumar et al. 2018 (Diverse Beam Search) proposed inter-beam dissimilarity penalties.",
        "Prerequisites if unfamiliar: Softmax and Temperature (how token probability distributions are shaped before beam search explores them). Extensions: Speculative Decoding (draft-and-verify for faster generation), KV Cache (the attention state each beam must carry independently). Alternatives: top-k sampling and nucleus (top-p) sampling (controlled randomness preferred for open-ended generation), A* Search (optimal search with admissible heuristics — beam search trades optimality for bounded memory).",
      ],
    },
  ],
};

