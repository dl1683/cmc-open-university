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
        'Each node is a page, and each arrow is a hyperlink from one page to another. The number on a node is its current PageRank score, meaning the estimated fraction of time a random web reader would spend there after many clicks.',
        { type: 'callout', text: 'PageRank turns link structure into a probability distribution, then uses repeated redistribution to find the stable scores.' },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/PageRanks-Example.svg',
          alt: 'Directed PageRank graph with node size proportional to score',
          caption: 'A PageRank graph makes the fixed-point idea visible: authority concentrates where important links point. Source: Wikimedia Commons, 345Kai and Stannered, public domain.',
        },
        'The animation starts with every page equal, then repeatedly redistributes score along outgoing links. A page with two outgoing links splits its score in half; a page with one outgoing link gives all of its link-following score to that target.',
        'The highlighted node is the current leader after that round of redistribution. When later frames barely change, the scores have reached a fixed point, which means applying the update again gives almost the same vector of scores.',
      
        {type: 'image', src: './assets/gifs/pagerank.gif', alt: 'Animated walkthrough of the pagerank visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Search needs more than word matching. If thousands of pages contain the word "database", the engine still has to decide which pages are likely to be useful before the user reads them.',
        'The web supplies a second signal: links. A hyperlink is a directed edge, meaning one page points to another, and many links together form a graph. PageRank turns that graph into one authority score per page.',
        'The original use was web search, but the same problem appears anywhere directed references carry weight. Citation graphs, package dependency graphs, and recommendation graphs all need a way to separate central nodes from merely noisy nodes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct idea is to count incoming links. This count is called indegree: a page with 500 incoming links has indegree 500, while a page with 3 incoming links has indegree 3.',
        'Indegree captures something real because useful pages often receive more references. It is cheap to compute too: scan every link once and increment the target page\'s counter.',
        'For a small honest graph, this may be enough. If a class wiki has ten pages and nobody is trying to manipulate the result, the page with the most links is often one of the most useful pages.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Indegree treats all links as equal. One link from a respected reference page and one link from a throwaway spam page both add exactly one vote.',
        'The natural repair is to make votes from important pages count more. That creates a circular definition: a page is important if important pages link to it, but those linking pages need their own importance scores first.',
        'There is also a probability leak. A page with no outgoing links is a dangling node, so a reader who follows links can get stuck there unless the model defines what happens next.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'PageRank replaces direct voting with a random-surfer model. Imagine a reader who is on one page, follows a random outgoing link with probability d, and jumps to a random page with probability 1 - d.',
        'The constant d is the damping factor; the classic value is 0.85. PageRank is the long-run probability that this reader is on each page after the clicking process has run for a long time.',
        'The circular definition becomes a fixed point. If the current scores are used to redistribute rank, the correct final scores are the ones that reproduce themselves after the redistribution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with N pages and give each page score 1/N. This is a probability distribution, which means all scores are nonnegative and the scores sum to 1.',
        'On each iteration, compute every next score from the old scores. Page A receives a base teleport amount of (1 - d) / N, plus d times the sum of rank(T) / outdegree(T) for every page T that links to A.',
        'Outdegree means the number of outgoing links from a page. If a page has rank 0.30 and three outgoing links, it contributes 0.85 * 0.30 / 3 = 0.085 to each linked page when d = 0.85.',
        'Repeat until the vector changes by less than a chosen tolerance. A tolerance is a small allowed error, such as 0.000001, used to stop once another sweep would no longer change the displayed ranking in any meaningful way.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each update preserves total probability. The base teleport terms add up to 1 - d, and the link-following contributions redistribute the other d units of probability from source pages to target pages.',
        'Correctness comes from Markov chains. A Markov chain is a process where the next state depends only on the current state, and here the states are pages while transition probabilities come from links plus teleporting.',
        'Because teleporting gives every page a nonzero chance of being reached, the chain has one stationary distribution. A stationary distribution is a probability vector that does not change after one more transition, and PageRank iteration converges to that vector.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One iteration visits each link once to send rank along it. If N is the number of pages, E is the number of links, and k is the number of iterations, the running time is O(kE).',
        'Memory is O(N + E): one score per page plus the link lists. This is why PageRank is stored as a sparse graph, where only real links are stored, instead of as an N by N table with mostly empty entries.',
        'The behavioral cost is steady streaming over edges. Doubling the number of links roughly doubles each sweep, while asking for a tighter tolerance increases k because the algorithm must keep sweeping after the visible ranking has already mostly stabilized.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Web search used PageRank as a global authority signal. A query-specific text matcher could find pages containing the right words, then PageRank helped prefer pages that the web graph already treated as authoritative.',
        'Citation ranking uses the same mechanism. A paper cited by influential papers receives more weight than a paper cited only by obscure papers, even if both have the same raw citation count.',
        'Dependency and recommendation graphs also use PageRank-like scoring. A package, user, product, or protein can be ranked by how much weighted attention flows to it through directed relationships.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PageRank is not query-aware. It can say a page is globally authoritative, but it cannot decide by itself whether that page answers a specific search phrase.',
        'It can be manipulated when the graph itself is manipulated. Link farms, paid links, and coordinated citation rings manufacture edges that look like endorsements but do not represent independent judgment.',
        'It also has a cold-start problem. A new excellent page has few incoming links, so PageRank may score it poorly until the graph has had time to point at it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use four pages A, B, C, and D. A links to B and C, B links to C, C links to A, and D links to C. Each page starts at 1/4 = 0.250, d = 0.85, and the teleport base is (1 - 0.85) / 4 = 0.0375.',
        'After one iteration, A receives only from C: 0.0375 + 0.85 * 0.250 = 0.250. B receives half of A: 0.0375 + 0.85 * 0.125 = 0.14375. C receives half of A plus all of B plus all of D: 0.0375 + 0.85 * (0.125 + 0.250 + 0.250) = 0.56875. D receives no links, so it stays at 0.0375.',
        'After the second iteration, A receives C\'s large score and rises to 0.0375 + 0.85 * 0.56875 = 0.52094. C falls to 0.0375 + 0.85 * (0.125 + 0.14375 + 0.0375) = 0.29781 because its incoming sources now carry less total rank.',
        'The important behavior is visible in the numbers. Rank does not just count links; it moves through the graph, so a page can rise one round after a high-rank neighbor points at it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Sergey Brin and Lawrence Page, "The Anatomy of a Large-Scale Hypertextual Web Search Engine," 1998. It explains PageRank together with the crawler and indexing system around it.',
        'For the math, read Amy Langville and Carl Meyer, "Google\'s PageRank and Beyond," 2006. Study Markov chains, stationary distributions, eigenvectors, sparse matrix-vector multiplication, and graph traversal before moving to large-scale implementations.',
      ],
    },
  ],
};
