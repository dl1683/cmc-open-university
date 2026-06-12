// PageRank: links are votes, but votes from important pages count more —
// a circular definition resolved by simple iteration. The algorithm that
// started Google, visualized on a six-page web.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'pagerank',
  title: 'PageRank',
  category: 'AI & ML',
  summary: 'Iterate "important pages are linked to by important pages" until it converges — Google\'s founding idea.',
  controls: [
    { id: 'iterations', label: 'Iterations', type: 'select', options: ['5', '10'], defaultValue: '5' },
  ],
  run,
};

const PAGES = [
  { id: 'A', label: 'A', x: 2.0, y: 4.8 },
  { id: 'B', label: 'B', x: 1.0, y: 1.4 },
  { id: 'C', label: 'C', x: 4.2, y: 1.0 },
  { id: 'D', label: 'D', x: 1.0, y: 8.2 },
  { id: 'E', label: 'E', x: 6.6, y: 5.4 },
  { id: 'F', label: 'F', x: 9.0, y: 3.2 },
];
// Directed links (from → to). B, C, D are obscure pages; E is the hub.
const LINKS = [
  ['B', 'A'], ['C', 'A'], ['D', 'A'],
  ['A', 'E'], ['B', 'E'], ['C', 'E'], ['D', 'E'],
  ['E', 'F'],
  ['F', 'A'],
];
const D = 0.85; // damping: the random surfer follows links 85% of the time

export function* run(input) {
  const iterations = parseInt(String(input.iterations), 10);
  if (![5, 10].includes(iterations)) throw new InputError('Pick 5 or 10 iterations.');

  const N = PAGES.length;
  const out = new Map(PAGES.map((p) => [p.id, LINKS.filter(([from]) => from === p.id).length]));
  let rank = new Map(PAGES.map((p) => [p.id, 1 / N]));

  const snapshot = () => graphState({
    nodes: PAGES.map((p) => ({ ...p, note: rank.get(p.id).toFixed(3) })),
    edges: LINKS.map(([from, to]) => ({ id: `${from}${to}`, from, to })),
  });
  const top = () => [...rank.entries()].sort((a, b) => b[1] - a[1])[0];

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `Six pages, nine links — a tiny web. The 1998 question: which page MATTERS most? Counting incoming links is gameable (make a thousand junk pages that link to you). PageRank's fix is beautifully circular: a page is important if IMPORTANT pages link to it. Circular definitions usually die — this one is solved by iteration. Everyone starts equal: ${(1 / N).toFixed(3)} each.`,
  };

  yield {
    state: snapshot(),
    highlight: { active: ['A'], compare: ['BA', 'CA', 'DA', 'FA'] },
    explanation: 'The update rule, in words: each page splits its current score equally among the pages it links to (a vote divided among endorsements), and everyone keeps a base 15% "random surfer" share — the model being a reader who follows links 85% of the time and jumps to a random page otherwise. Look at A: four incoming links (from B, C, D, F). Looks strong. Now watch the iteration disagree.',
  };

  for (let i = 1; i <= iterations; i += 1) {
    const next = new Map(PAGES.map((p) => [p.id, (1 - D) / N]));
    for (const [from, to] of LINKS) {
      next.set(to, next.get(to) + (D * rank.get(from)) / out.get(from));
    }
    rank = next;
    const [leader, score] = top();
    yield {
      state: snapshot(),
      highlight: { found: [leader] },
      explanation: `Iteration ${i}: every score redistributed in one sweep. Current leader: ${leader} (${score.toFixed(3)}). ${i === 1 ? 'E surges — it collects links from almost everyone.' : i === 2 ? 'Now F rises on the strength of ONE link — because that link comes from the hub E, and E pours its entire (large) score into F. One endorsement from royalty outweighs three from strangers.' : 'Scores are settling toward a fixed point — each pass changes them less.'}`,
      invariant: 'The scores always sum to 1.0 — PageRank is the probability of finding the random surfer on each page.',
    };
  }

  const ranking = [...rank.entries()].sort((a, b) => b[1] - a[1]);
  yield {
    state: snapshot(),
    highlight: { found: [ranking[0][0]], active: [ranking[1][0]] },
    explanation: `After ${iterations} iterations: ${ranking.map(([id, s]) => `${id}=${s.toFixed(3)}`).join(', ')}. Note the moral: B, C, D each CAST three links but EARN almost nothing — links from unimportant pages barely count, which is exactly what makes naive link-spam useless. Google ran this to convergence (~50 sweeps) over billions of pages; mathematically it's the dominant eigenvector of the link matrix, and the iteration is the power method finding it.`,
  };

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'The pattern outlives the search engine: iterate a self-referential score until it stops moving. The same skeleton ranks scientific papers (citations as links), finds influential users in social networks, and detects important proteins in biology graphs. Compare K-Means Clustering — another "loop a simple update to a fixed point" algorithm — and Graph BFS for how the link structure gets crawled in the first place.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `PageRank is the 1998 insight that helped make web search work: links are votes, but a vote from an important page should count more than a vote from an obscure one. The visualization shows a six-page web with nine directed links. Everyone starts equal at 1/6, then the scores are redistributed again and again until the ranking stops moving. This is Markov Chains & Steady States in search-engine clothing: the score of a page is the long-run probability that a random surfer is standing there.`,
        `The random surfer follows a link 85% of the time and jumps to a random page 15% of the time. That damping factor, usually written d = 0.85, keeps rank from getting trapped in dead ends or tight cycles. The result is not a raw popularity count. It is a probability distribution, so all page scores sum to 1.0 after every sweep.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Each iteration starts every page with the base teleport share, (1 - d) / N. Then every page divides its current score evenly across its outgoing links. In the demo, page E is a hub that receives many votes, then pours its entire high score into F. That is why F can rise on one link while B, C, and D remain weak even though they cast several links.`,
        `The loop is power iteration. Multiply the rank vector by the link-transition matrix, normalize through the damping term, and repeat. After 5 or 10 visible sweeps the numbers are already settling; at web scale the classic implementation ran dozens of sweeps until changes fell below a tolerance. Eigenvalues & Eigenvectors explains why the fixed point is the dominant eigenvector.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `One sweep touches every edge once, so the sparse cost is O(L), where L is the number of links. Dense matrix multiplication would be wasteful; real web graphs store outgoing links like adjacency lists, the same representation you meet in Graph BFS. Total cost is O(kL) for k sweeps. Memory is O(N + L), and the work is embarrassingly parallel because each page can contribute rank to its neighbors independently before a reduce step sums the incoming mass.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Search engines no longer rank by PageRank alone, but link analysis is still one signal among freshness, content quality, spam detection, and user intent. The same idea ranks papers by citation flow, finds central accounts in social graphs, and scores proteins in biological interaction networks. It also shows up in recommendation and reinforcement-learning intuition: Value Iteration (Reinforcement Learning) is another case where repeated local updates propagate global importance through a graph.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is treating PageRank as the whole search algorithm. It is a graph signal, not a judgment of truth, usefulness, or freshness. The second is thinking any inbound link helps equally. A link farm made of unimportant pages mostly passes around unimportant score. The third is assuming convergence is instant. It depends on graph structure and the spectral gap; a higher damping factor preserves link information but generally mixes more slowly.`,
        `PageRank is also not a shortest-path algorithm. A shortest-path search answers one route question from one source; PageRank diffuses probability from everywhere to everywhere. The visualization's fixed point is closer to K-Means Clustering than to one-shot search: repeat a simple update until the system stops changing.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Markov Chains & Steady States for the probability model, then Eigenvalues & Eigenvectors for the linear algebra that proves the fixed point exists. Graph BFS explains how crawlers discover link graphs. Consistent Hashing and LRU Cache show the distributed storage and caching patterns needed once scores serve real traffic. Embeddings & Similarity and HNSW (Vector Search at Scale) are modern companions: they rank by vector meaning rather than link authority.`,
      ],
    },
  ],
};
