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
      heading: 'Why this exists',
      paragraphs: [
        'PageRank exists because counting links is too naive. If every inbound link were an equal vote, a spammer could create thousands of low-quality pages pointing at one target. The original web-search problem needed a way to distinguish links from important pages from links made of noise.',
        'The PageRank insight is circular but useful: a page is important if important pages link to it. Circular definitions sound impossible until you turn them into an iteration. Start every page with equal score, let pages pass score through outgoing links, add a small random-jump probability, and repeat until the scores settle.',
        'This is Markov chains and eigenvectors in search-engine clothing. The final score of a page is the long-run probability that a random surfer is on that page. The random surfer follows links most of the time and occasionally teleports to a random page.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is indegree: count how many pages link to a page. That captures a real signal, but it treats every linking page as equally trustworthy. A link from a major respected page and a link from a newly created junk page count the same.',
        'Another obvious approach is traffic or clicks. That can be useful, but early web search needed a signal derived from the link graph itself. It also needed a way to work before every query, so ranking could be precomputed over the graph rather than learned from each user interaction.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is recursive importance. You want important pages to pass more authority, but you do not know which pages are important until the scores are computed. PageRank resolves that by iterating the circular definition until it reaches a stable fixed point.',
        'The second wall is graph traps. A group of pages can link only to each other and absorb score forever. A page with no outgoing links can trap probability mass. The teleport term solves both by giving the random surfer a chance to jump anywhere.',
        'The third wall is scale. The web graph has billions of pages and many more links. A practical algorithm has to exploit sparsity: one sweep should touch each link once, not multiply a dense matrix.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the web as a directed graph and define a probability distribution over pages. At each iteration, every page splits its current score across outgoing links. Every page also receives a base teleport share. The repeated update converges to a stationary distribution under the damped random-surfer model.',
        'That means PageRank is not a raw vote count. It is authority flow. A page can receive few links and still rank highly if those links come from important pages. A page can emit many links and still remain unimportant if little authority flows into it.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The first frame shows equal starting mass. Nothing has been learned yet. Every page begins with the same probability because PageRank has not flowed through the graph.',
        'The update frames show probability mass moving through directed links. A page divides its current score among its outgoing links. The base teleport share is added to every page so no region of the graph can permanently trap the surfer.',
        'The later frames show convergence. One sweep is not the answer. Repeated power iterations let local link choices settle into a global authority score. The scores always sum to one because they represent a probability distribution.',
      ],
    },
    {
      heading: 'How the algorithm works',
      paragraphs: [
        'Let N be the number of pages and d be the damping factor, often 0.85. Each iteration gives every page a base score of (1 - d) / N. Then for each link from page u to page v, page u contributes d * rank[u] / outdegree[u] to page v.',
        'Dangling pages with no outgoing links need special handling. Conceptually, the random surfer teleports from them rather than getting stuck. Implementations usually redistribute dangling mass across all pages or fold it into the teleport step.',
        'In matrix terms, the update repeatedly multiplies a rank vector by a damped transition matrix. In algorithm terms, it is sparse power iteration. Each sweep touches the edges, accumulates incoming contributions, and checks how much the rank vector changed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In the six-page animation, page A receives several inbound links. A naive link count would make A look obviously strongest. But page E receives many links too, and then E points to F. Once E accumulates authority, its single outgoing link can lift F strongly.',
        'That is the lesson: one endorsement from an important page can outweigh several endorsements from weak pages. B, C, and D cast links, but they earn little rank because little authority flows into them. Their votes are not worthless, but they are light.',
        'After several sweeps, the scores change less and less. The final ordering is a graph-wide equilibrium, not a local count around one page. That is why PageRank was powerful: it extracted global authority from local hyperlink structure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The damping factor makes the Markov chain well behaved. Teleportation gives every page a path to every other page in the probabilistic model, which helps guarantee a unique stationary distribution under standard assumptions.',
        'Power iteration works because the repeated update amplifies the dominant eigenvector of the transition process. You do not need to solve a dense eigensystem directly. You repeatedly pass mass through sparse links until the vector stops moving much.',
        'The method also works because link structure carries social information. Links are not perfect endorsements, but at web scale they encode attention, citation, navigation, and authority relationships. PageRank turns that graph signal into a numerical prior for ranking.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'One sweep touches every edge once, so sparse cost is O(L), where L is the number of links. Total cost is O(kL) for k sweeps. Memory is O(N + L): ranks for pages plus an adjacency representation of links.',
        'The work parallelizes well. Each page distributes score to neighbors, and reducers sum incoming contributions. Large-scale PageRank is therefore a graph-processing workload: partition edges, stream contributions, aggregate, repeat, and checkpoint.',
        'Convergence speed depends on graph structure, damping, tolerance, and initialization. A higher damping factor preserves more link-following behavior but can mix more slowly. Practical systems often stop when the change in rank vector falls below a threshold rather than waiting for mathematical perfection.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'PageRank wins when directed links or endorsements form a meaningful graph. Web pages, citation networks, social graphs, package dependency graphs, biological interaction networks, and recommendation graphs can all use variants of authority flow.',
        'It is also valuable as a teaching pattern: iterate a self-referential score until a fixed point emerges. That pattern appears in Markov chains, value iteration, graph centrality, reputation systems, and many propagation algorithms.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PageRank is not the whole search algorithm. It does not understand query intent, truth, freshness, page quality, personalization, spam context, or content relevance. Modern search systems use many signals, and link authority is only one kind of evidence.',
        'It can also be manipulated. Link farms, paid links, and coordinated graph attacks try to create artificial authority. Damping and authority weighting help, but spam detection, trust signals, content analysis, and manual policy systems became necessary companions.',
        'PageRank also does not answer shortest-path questions. It is a global stationary score. A path algorithm asks how to get from one node to another; PageRank asks where a random surfer tends to spend time over the whole graph.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'PageRank is authority flow with teleportation. Links pass score, important pages pass more score, and repeated updates find a stable probability distribution.',
        'The algorithm matters beyond web search because it shows how local graph links can produce a global ranking when the update rule is simple, sparse, and iterated to convergence.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Markov Chains & Steady States for the probability model, Eigenvalues & Eigenvectors for the fixed point, Graph BFS for graph traversal, K-Means Clustering for another fixed-point iteration, Value Iteration for reinforcement-learning propagation, HITS for a related hub-authority model, and HNSW Vector Search at Scale for a modern ranking neighbor.',
      ],
    },
  ],
};
