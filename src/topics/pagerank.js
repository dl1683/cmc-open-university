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
      heading: 'What it is',
      paragraphs: [
        `PageRank answers a 1998 question: on a web of linked pages, which ones matter most? Naive counting — tally incoming links — is gameable: create a thousand junk pages that all point to you and fake importance. PageRank's fix is beautifully circular: a page matters if important pages link to it. This self-referential definition looks circular, but iteration breaks the circularity and finds a fixed point.`,
        `The algorithm models a random web surfer: follow links 85% of the time (the damping factor d = 0.85), jump to a random page 15% of the time. This "random surfer model" prevents rank from vanishing into a dead-end corner of the graph. The result is a probability distribution: each page gets a score between 0 and 1, and all scores sum to exactly 1.0.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Start: give every page equal score. In a six-page web, each begins at 1/6.`,
        `Each iteration does two things: (1) Each page divides its current score equally among the pages it links to — a vote split among endorsements. (2) Every page keeps a base 15% share from the random surfer model, giving pages with no incoming links a floor. Iterate until scores stabilize (typically 50 sweeps at Google's billion-page scale).`,
        `The payoff: pages linked by important pages rank higher. A single link from a hub outweighs three links from obscure pages. Link spam from unimportant sources earns almost nothing. Mathematically, this process finds the dominant eigenvector of the link-transition matrix — the power method in action.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Each iteration touches every link once, so one sweep is O(L) where L is the link count. To converge (typically 50 iterations on real graphs), PageRank costs O(50 × L). On today's web with trillions of links, this requires distributed computation and is run as a background batch process, not on every search. Modern engines combine PageRank with other signals — anchor text, click-through data — to rank results.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `PageRank powered Google's search results from 1998 onward and remains a component of their ranking. Beyond search, the same skeleton applies everywhere: rank scientific papers by citation flow (a citation from Nature outweighs one from a blog), find influential Twitter accounts by follower network structure, detect essential proteins in biological networks by interaction graph, and identify central nodes in any directed graph by importance flow.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Pitfall 1: Thinking PageRank is a ranking. It is not. It is one signal among many; Google combines it with content quality, freshness, and user engagement.`,
        `Pitfall 2: "Link farms" — pages created solely to boost rank of a target page. Because PageRank only flows from important sources, fabricated links from new pages contribute nothing.`,
        `Pitfall 3: Assuming convergence is instant. It is not. Graph diameter (longest shortest path) and link structure affect convergence rate. The damping factor (0.85) is a tuning choice; higher values (more link-following) converge slower but preserve more information.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Graph BFS to understand how the link graph itself is crawled and stored. K-Means Clustering to see another "iterate a simple rule to convergence" pattern. Dijkstra's Shortest Path for single-source graph traversal (PageRank is all-sources importance diffusion). Embeddings & Similarity to model pages and links in vector space. HNSW (Vector Search at Scale) to see how importance scores are retrieved at internet scale.`,
      ],
    },
  ],
};

