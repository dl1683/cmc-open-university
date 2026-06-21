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
    explanation: `Six pages, nine links — a tiny web. The 1998 question: which page MATTERS most? Counting incoming links is gameable (make a thousand junk pages that link to you). PageRank\'s fix is beautifully circular: a page is important if IMPORTANT pages link to it. Circular definitions usually die — this one is solved by iteration. Everyone starts equal: ${(1 / N).toFixed(3)} each.`,
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
    explanation: `After ${iterations} iterations: ${ranking.map(([id, s]) => `${id}=${s.toFixed(3)}`).join(', ')}. Note the moral: B, C, D each CAST three links but EARN almost nothing — links from unimportant pages barely count, which is exactly what makes naive link-spam useless. Google ran this to convergence (~50 sweeps) over billions of pages; mathematically it\'s the dominant eigenvector of the link matrix, and the iteration is the power method finding it.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each node is a web page. The number on it is its current PageRank score. Directed edges are hyperlinks. At each iteration, every page splits its score among its outgoing links, a teleport share is added, and scores update simultaneously.',
        { type: 'callout', text: 'PageRank turns link structure into a probability distribution, then uses repeated redistribution to find the stable scores.' },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/PageRanks-Example.svg',
          alt: 'Directed PageRank graph with node size proportional to score',
          caption: 'A PageRank graph makes the fixed-point idea visible: authority concentrates where important links point. Source: Wikimedia Commons, 345Kai and Stannered, public domain.',
        },
        'The highlighted node is the current leader. Watch how leadership can shift as authority flows through hubs. When scores stop changing visibly between frames, the algorithm has converged to its fixed point.',
        'The key inference rule: if a node has high score and few outgoing links, each of its targets receives a large share. One link from a high-authority page transfers more rank than many links from low-authority pages.',
      
        {type: 'image', src: './assets/gifs/pagerank.gif', alt: 'Animated walkthrough of the pagerank visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1998, Larry Page and Sergey Brin at Stanford faced a concrete problem: the web had hundreds of millions of pages, and keyword matching alone could not tell which pages deserved to appear first. A query for "java" returned coffee importers, programming tutorials, and Indonesian travel guides with equal confidence.',
        'The web had one untapped signal: hyperlinks. A link from one page to another is a human decision to endorse, cite, or reference. Millions of such decisions encode collective judgment about which pages matter. The question was how to aggregate that signal into a single importance score per page.',
        'PageRank was the answer, and it became the core of Google\'s original ranking engine. The paper "The Anatomy of a Large-Scale Hypertextual Web Search Engine" (Brin & Page, 1998) described both the algorithm and the system that ran it over 24 million pages.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Count incoming links. A page with 500 inbound links seems more important than a page with 3. This is indegree ranking, and it captures real information: popular pages do get linked more.',
        'Indegree works for small, honest graphs. In the early web, before commercial incentives dominated, simple link counting gave reasonable results. It is the same intuition behind counting citations in academic publishing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Indegree treats every link as equal. A spammer can create 10,000 junk pages, each linking to a target, and that target instantly looks authoritative. One link from a respected source and one link from a spam farm count the same.',
        'The fix seems obvious: weight links by the importance of the linking page. But that is circular. You need importance scores to weight the links, and you need weighted links to compute importance scores. The definition refers to itself.',
        'A second problem: some pages have no outgoing links (dangling nodes). A random surfer arriving at such a page gets stuck, and probability mass accumulates there with no way out. A third problem: groups of pages can link only to each other, forming rank sinks that absorb authority from the rest of the graph.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model a random surfer who starts on a random page and at each step either follows a random outgoing link (with probability d = 0.85) or teleports to a uniformly random page (with probability 1 - d = 0.15). PageRank is the long-run fraction of time this surfer spends on each page.',
        'The circular definition becomes a fixed-point equation: PR(A) = (1-d)/N + d * sum over all pages T linking to A of PR(T)/L(T), where L(T) is the number of outgoing links from T. Each page divides its current authority equally among its outgoing links and passes it forward. The teleport term (1-d)/N ensures every page receives a base share, preventing rank sinks and handling dangling nodes.',
        'This is not a heuristic. The PageRank vector is the principal eigenvector of the column-stochastic transition matrix M, where M[i][j] = d/L(j) if page j links to page i, plus (1-d)/N for every entry. The damping factor guarantees this matrix is primitive (positive, irreducible, aperiodic), so the Perron-Frobenius theorem guarantees a unique dominant eigenvector with eigenvalue 1.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Initialize every page with score 1/N, where N is the number of pages. This is the uniform distribution: no information yet.',
        'Each iteration computes a new score for every page simultaneously. For page A: start with the teleport base (1 - 0.85)/N = 0.15/N. Then for each page T that links to A, add 0.85 * rank(T) / outdegree(T). This is the authority T passes to A, weighted by how important T currently is and diluted by how many pages T endorses.',
        'Repeat until the rank vector stops changing. Formally, stop when the L1 norm of the difference between consecutive rank vectors falls below a tolerance (typically 1e-6 to 1e-8). In practice, 50 to 100 iterations suffice even for billion-page graphs because the subdominant eigenvalue is at most d = 0.85, giving geometric convergence.',
        'Dangling pages (no outgoing links) are handled by redistributing their rank mass uniformly: if a page has no links, the surfer teleports from it. Implementations often collect dangling mass into a single scalar and spread it across all pages each iteration.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider four pages: A, B, C, D. Links: A links to B and C. B links to C. C links to A. D links to C. Each page starts with rank 1/4 = 0.250. Damping d = 0.85. Teleport base = 0.15/4 = 0.0375.',
        'Iteration 1: Page A receives a link from C (rank 0.250, outdegree 1). PR(A) = 0.0375 + 0.85 * (0.250/1) = 0.0375 + 0.2125 = 0.250. Page B receives a link from A (rank 0.250, outdegree 2). PR(B) = 0.0375 + 0.85 * (0.250/2) = 0.0375 + 0.1063 = 0.144. Page C receives links from A (rank 0.250, outdegree 2), B (rank 0.250, outdegree 1), and D (rank 0.250, outdegree 1). PR(C) = 0.0375 + 0.85 * (0.250/2 + 0.250/1 + 0.250/1) = 0.0375 + 0.85 * 0.625 = 0.0375 + 0.5313 = 0.569. Page D has no incoming links. PR(D) = 0.0375. Sum: 0.250 + 0.144 + 0.569 + 0.0375 = 1.000.',
        'Iteration 2: Using the new scores, C still dominates because it receives links from three pages. PR(A) = 0.0375 + 0.85 * (0.569/1) = 0.521. PR(B) = 0.0375 + 0.85 * (0.250/2) = 0.144. PR(C) = 0.0375 + 0.85 * (0.250/2 + 0.144/1 + 0.0375/1) = 0.0375 + 0.85 * 0.306 = 0.298. PR(D) = 0.0375. Notice A surged because C (which was 0.569) poured all its authority into A.',
        'Iteration 3: PR(A) = 0.0375 + 0.85 * (0.298/1) = 0.291. PR(B) = 0.0375 + 0.85 * (0.521/2) = 0.259. PR(C) = 0.0375 + 0.85 * (0.521/2 + 0.144/1 + 0.0375/1) = 0.0375 + 0.85 * 0.442 = 0.413. PR(D) = 0.0375. The scores oscillate toward equilibrium. Each iteration, changes shrink by roughly a factor of d = 0.85. After about 50 iterations the values stabilize.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The update rule is power iteration on the stochastic matrix M. Starting from any initial probability vector, repeated multiplication by M converges to the dominant eigenvector because d < 1 makes the subdominant eigenvalue at most d = 0.85. Each iteration shrinks the distance to the true eigenvector by at least a factor of 0.85.',
        'The teleport term makes M a primitive matrix: every entry is positive (the surfer can reach any page in one step with nonzero probability). By the Perron-Frobenius theorem, a primitive stochastic matrix has a unique stationary distribution. That uniqueness means the result does not depend on initialization.',
        'Correctness of the ranking follows from the random-surfer model. If you simulated billions of random walks on the web graph, the fraction of time spent on each page would converge to the PageRank vector. The iteration computes the same answer without simulation, in far fewer operations.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each iteration visits every edge once: O(E) per sweep, where E is the number of links. Total cost is O(k * E) for k iterations. Memory is O(N + E): one rank value per page plus the sparse adjacency list.',
        'When the graph doubles in edges, each iteration takes twice as long. When the graph doubles in pages (with similar link density), both per-iteration cost and memory double. The number of iterations k is nearly independent of graph size because convergence rate depends on d, not N.',
        'Google\'s original system computed PageRank over 24 million pages in hours on commodity hardware (1998). The key was sparse representation: the web graph is sparse (average outdegree around 7 to 10), so each sweep is linear in edges, not quadratic in pages. MapReduce and later Pregel/GraphX scaled this to billions of pages by partitioning edges across machines and summing contributions in parallel.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Web search ranking was the original application. Google used PageRank as a prior: pages with high authority ranked higher for any query, then content relevance signals refined the ordering. This worked because the web graph was large enough that link authority correlated with quality.',
        'Academic citation analysis uses the same idea. A paper cited by influential papers is more important than one cited by obscure ones. Google Scholar applies eigenvector centrality to citation graphs to surface influential research.',
        'Social network influence detection, biological protein interaction ranking, recommendation systems, and software dependency analysis all use PageRank variants. The pattern generalizes to any directed graph where edges represent endorsement, dependency, or flow.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PageRank is query-independent. It ranks pages globally without knowing what the user is searching for. A page about rare diseases and a page about celebrity gossip get scored by the same authority metric. Modern search engines combine PageRank with hundreds of query-dependent and content-quality signals.',
        'Link spam is a persistent weakness. Link farms, paid links, reciprocal link schemes, and blog comment spam all inject artificial edges into the graph. Google developed TrustRank, spam classifiers, and manual penalties to fight manipulation that PageRank alone cannot detect.',
        'Topic drift is another failure. A highly authoritative page about physics links to a friend\'s cooking blog. That link transfers physics-scale authority to an unrelated domain. Topic-sensitive PageRank (Haveliwala, 2002) addressed this by computing separate PageRank vectors for different topic categories.',
        'Freshness is invisible to PageRank. New pages have zero incoming links and zero rank regardless of quality. It takes time for the link graph to reflect a page\'s true importance, creating a cold-start problem for new content.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Brin, S. & Page, L. (1998), "The Anatomy of a Large-Scale Hypertextual Web Search Engine," Proceedings of the 7th International World Wide Web Conference. The original paper describes both the algorithm and the system architecture.',
        'The eigenvalue interpretation is standard linear algebra: PageRank is the principal eigenvector of the stochastic link matrix. Langville & Meyer, "Google\'s PageRank and Beyond" (2006) gives the full mathematical treatment.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Prerequisite: Graph BFS — understand how directed graphs are traversed before studying flow on them. Markov Chain — the probability model underlying PageRank; steady-state distributions, ergodicity, and mixing times.',
        'Extension: Eigenvector centrality — the linear algebra generalization; PageRank is a specific instance with damping. HITS algorithm (Kleinberg, 1999) — a competing hub-authority model that computes two scores per node instead of one, and is query-dependent.',
        'Parallel pattern: K-Means Clustering — another "iterate a simple update to a fixed point" algorithm, showing the same convergence structure in a completely different domain.',
      ],
    },
  ],
};
