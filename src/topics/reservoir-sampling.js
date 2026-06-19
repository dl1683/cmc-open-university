// Reservoir sampling: keep a perfectly fair random sample of k items from a
// stream of unknown, possibly endless length — using only k slots of memory
// and one elegant probability: keep item i with chance k/i.

import { arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'reservoir-sampling',
  title: 'Reservoir Sampling',
  category: 'Concepts',
  summary: 'A fair sample from an endless stream in k slots of memory — the probability balances itself.',
  controls: [
    { id: 'k', label: 'Reservoir size k', type: 'select', options: ['3'], defaultValue: '3' },
  ],
  run,
};

const STREAM = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
// The dice rolls, pre-scripted so every run is reproducible. The PROBABILITIES
// shown alongside are the real algorithm; only the randomness is frozen.
const DECISIONS = {
  4: { accept: true, slot: 1 },
  5: { accept: true, slot: 0 },
  6: { accept: false },
  7: { accept: true, slot: 2 },
  8: { accept: false },
  9: { accept: false },
  10: { accept: true, slot: 1 },
};

export function* run(input) {
  const k = parseInt(String(input.k), 10);
  if (k !== 3) throw new InputError('This demo uses k = 3.');

  const reservoir = [];

  yield {
    state: arrayState(['·', '·', '·']),
    highlight: {},
    explanation: `The problem: a stream of items flows past — clicks, log lines, tweets — and you must keep a FAIR random sample of ${k}, where fair means every item ever seen has an EQUAL chance of being in your sample. The catch: you don\'t know how long the stream is, it may never end, and you can store only ${k} items. You cannot "wait for all the data and then pick" — there is no all.`,
  };

  for (let i = 1; i <= STREAM.length; i += 1) {
    const item = STREAM[i - 1];
    if (i <= k) {
      reservoir.push(item);
      yield {
        state: arrayState([...reservoir, ...new Array(k - reservoir.length).fill('·')]),
        highlight: { active: [`i${reservoir.length - 1}`] },
        explanation: `Item ${i} ('${item}'): the reservoir isn\'t full yet — take it unconditionally. The first ${k} items fill the ${k} slots.`,
      };
      continue;
    }

    const d = DECISIONS[i];
    if (d.accept) {
      const evicted = reservoir[d.slot];
      reservoir[d.slot] = item;
      yield {
        state: arrayState([...reservoir]),
        highlight: { swap: [`i${d.slot}`] },
        explanation: `Item ${i} ('${item}'): keep it with probability k/i = ${k}/${i}. The (scripted) die says YES — so '${item}' evicts a uniformly-random slot: out goes '${evicted}', slot ${d.slot}. Notice the probability FELL as the stream grew: later items are individually less likely to enter… but earlier items have survived more eviction rounds. The two effects cancel exactly.`,
        invariant: `After item i, every item seen so far sits in the reservoir with probability exactly ${k}/i.`,
      };
    } else {
      yield {
        state: arrayState([...reservoir]),
        highlight: { range: [0, 1, 2].map((s) => `i${s}`) },
        explanation: `Item ${i} ('${item}'): keep with probability ${k}/${i}… the die says NO — '${item}' flows past, never stored. (Rejected items cost zero memory; that is the entire budget trick.)`,
        invariant: `After item i, every item seen so far sits in the reservoir with probability exactly ${k}/i.`,
      };
    }
  }

  yield {
    state: arrayState([...reservoir]),
    highlight: { found: [0, 1, 2].map((s) => `i${s}`) },
    explanation: `Stream over (this time): the sample is [${reservoir.join(', ')}], and every one of the ${STREAM.length} items had exactly ${k}/${STREAM.length} = 30% chance of being here — the early 'A' and the late 'J' alike. The proof is a tidy induction: item i enters with k/i; each earlier item survives round i with probability (1 − k/i · 1/k) = (i−1)/i, which telescopes every item\'s chance down to exactly k/n. Memory used: ${k} slots, forever.`,
  };

  yield {
    state: arrayState([...reservoir]),
    highlight: {},
    explanation: 'Where streams meet sampling, this is the tool: monitoring systems keeping a fair sample of requests for tracing (storing all is impossible), Spark and BigQuery sampling massive datasets in one pass, A/B platforms selecting users from a live stream, even shuffling songs from a playlist of unknown length. Its streaming cousins live nearby: the Sliding Window keeps the RECENT items, reservoir sampling keeps a fair sample of ALL of them — two different answers to "the data won\'t fit".',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a reservoir array of k = 3 slots and a stream of 10 items flowing past one at a time. Empty slots display a dot. An active highlight marks the item currently being decided on. A swap highlight means the item was accepted and replaced an existing slot. A range highlight across all slots means the item was rejected and the reservoir stayed unchanged. A found highlight at the end marks the final sample.',
        'The invariant line below each step is the real proof target: after processing item i, every item seen so far sits in the reservoir with probability exactly k/i. Watch how that fraction shrinks as i grows, but shrinks for every item equally. The specific letters that end up in the reservoir depend on the frozen random draws. The probability structure does not.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'You have a stream of items: log lines, click events, sensor readings, database rows from a scan. You need a fair random sample of k items. Fair means every item that ever appeared has the same probability of being in the final sample. The stream may be enormous or unbounded. You cannot store it all and pick afterward.',
        'Jeffrey Vitter formalized the solution in 1985 as Algorithm R. The idea existed in folklore before that (Knuth discusses it in TAOCP Vol. 2, 1969 edition), but Vitter gave the first rigorous analysis and the faster skip-based variants. The algorithm sees each item once, stores exactly k items, and guarantees uniform probability k/n after n items have passed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'If you know the stream length n in advance, the problem is easy. Generate k distinct random indices in the range [1, n], then collect the items at those positions. This costs O(n) time to scan and O(k) space for the sample. It works perfectly when you can compute the indices before scanning.',
        'Alternatively, store everything, then call a standard sampling routine on the finished collection. This also gives a perfect uniform sample. Both approaches assume you can either predict the total count or afford to buffer the entire stream.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A stream does not announce its length. Items arrive one by one and may never stop. Buffering everything costs O(n) memory, which defeats the purpose of sampling. You cannot go back to re-read earlier items, so you cannot defer the sampling decision until the end.',
        'The deeper problem is fairness over time. Early items enter easily because the reservoir has room. Later items face a full reservoir. If early items get a permanent advantage, the sample is biased toward the beginning. If later items always push out earlier ones, the sample is biased toward the end. A correct algorithm must balance these two forces using only local information: how many items have been seen so far.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Accept item i with probability k/i, and if accepted, replace a uniformly random slot. This single rule makes every item\'s inclusion probability self-correcting. The acceptance rate falls as the stream grows, which compensates for the fact that earlier items have survived more eviction rounds. The two effects cancel exactly, leaving every item with probability k/n after n items.',
        'Random slot replacement is essential. Replacing the oldest slot would create a recency-biased sample. Replacing the newest slot would over-protect early items. Uniform random replacement ensures that every item currently in the reservoir faces the same eviction risk on every round.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Algorithm R has two phases.',
        'Phase 1 (filling): for items 1 through k, place each item in the next empty reservoir slot. No randomness is needed. After k items, the reservoir is full and every item is present with probability 1 = k/k.',
        'Phase 2 (streaming): for each item at position i (where i > k), generate a random integer j uniformly in the range [0, i). If j < k, replace reservoir[j] with the new item. If j >= k, discard the item. The test j < k succeeds with probability k/i, so each new item enters with exactly the right chance. If it enters, it lands in slot j, which is uniform over the k slots.',
        'The algorithm never backtracks, never buffers rejected items, and never needs to know how many items remain. It processes each item in O(1) time.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is by induction on the number of items seen.',
        'Base case: after k items, each sits in the reservoir with probability k/k = 1.',
        'Inductive step: suppose that after processing item i - 1, every one of the first i - 1 items has probability k/(i - 1) of being in the reservoir. Item i arrives.',
        'Item i enters with probability k/i. That handles the new item.',
        'For any older item already in the reservoir, it is evicted only if two things happen: item i is accepted (probability k/i) and the random slot chosen is that specific item\'s slot (probability 1/k). The combined eviction probability is (k/i) * (1/k) = 1/i. So the older item survives round i with probability 1 - 1/i = (i - 1)/i.',
        'The older item\'s probability of being in the reservoir was k/(i - 1) before this round. After surviving, it becomes k/(i - 1) * (i - 1)/i = k/i. The (i - 1) terms cancel, giving exactly k/i.',
        'After n total items, every item has probability k/n. The first item and the last item have the same chance. The proof works because the admission probability k/i and the survival probability (i - 1)/i are designed to telescope.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: O(n). Each of the n stream items requires one random number generation and at most one array write. No sorting, no multiple passes, no backtracking.',
        'Space: O(k). The reservoir holds k items, plus a counter for the current position and whatever state the random number generator needs. Memory does not grow with the stream length.',
        'When n doubles, runtime doubles but memory stays fixed. When k doubles, memory doubles but the per-item work stays O(1). For k = 1,000 items each holding an 8-byte ID, the reservoir is about 8 KB regardless of whether the stream has a million or a billion items.',
        'Vitter\'s Algorithm L improves the expected number of random number generations from O(n) to O(k(1 + log(n/k))) by computing how many items to skip before the next acceptance rather than flipping a coin for every item. The output distribution is identical; only the speed of rejecting items changes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Log sampling: production systems generate millions of requests per second. Keeping a fair sample of k requests for distributed tracing is a direct application. Every request has the same chance of appearing in the sample, so rare endpoints are not systematically excluded.',
        'A/B test traffic sampling: when assigning users to experiment groups from a live stream of sign-ups, reservoir sampling ensures early users and late users have the same inclusion probability. This prevents temporal bias in treatment assignment.',
        'Database approximate queries: SQL\'s TABLESAMPLE and BigQuery\'s reservoir-based sampling scan a table once and return a uniform random subset without loading the entire table into memory. PostgreSQL\'s BERNOULLI sampling is similar in spirit.',
        'Random line selection from large files: the classic Unix interview question "select a random line from a file of unknown length" is reservoir sampling with k = 1. GNU shuf -n k implements exactly this algorithm.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Weighted sampling: if items have non-uniform importance weights, Algorithm R gives each item equal probability regardless of weight. Efraimidis and Spirakis (2006) solved this with Algorithm A-Res, which assigns each item a key (random^(1/weight)) and keeps the k largest keys. The interface is similar but the math is different.',
        'Recency-biased workloads: reservoir sampling treats the first item and the last item identically. If you need "what happened recently," use a sliding window or exponential decay. Reservoir sampling answers "what does the whole stream look like," not "what does the stream look like now."',
        'Parallel and distributed streams: merging two independent reservoirs is not as simple as concatenating and re-sampling. If one worker saw a million items and another saw a thousand, their reservoirs carry different representational weight. Correct merging requires tracking stream sizes or using priority-key methods where keys are globally comparable.',
        'Structured streams: if items arrive in sorted, clustered, or periodic order and the random number generator has correlated output, the uniformity guarantee can break. The proof assumes each random draw is independent.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'k = 3, stream = [A, B, C, D, E, F, G]. We trace every decision with specific random numbers.',
        'Items 1-3 (filling phase): A goes to slot 0, B to slot 1, C to slot 2. Reservoir: [A, B, C]. No randomness needed.',
        'Item 4 (D): generate j uniform in [0, 4). Say j = 1. Since 1 < 3, accept D into slot 1. Reservoir: [A, D, C]. Probability of acceptance was 3/4.',
        'Item 5 (E): generate j uniform in [0, 5). Say j = 4. Since 4 >= 3, reject E. Reservoir stays [A, D, C]. Probability of acceptance was 3/5.',
        'Item 6 (F): generate j uniform in [0, 6). Say j = 0. Since 0 < 3, accept F into slot 0. Reservoir: [F, D, C]. Probability of acceptance was 3/6 = 1/2.',
        'Item 7 (G): generate j uniform in [0, 7). Say j = 5. Since 5 >= 3, reject G. Reservoir stays [F, D, C]. Probability of acceptance was 3/7.',
        'Final reservoir: [F, D, C]. Every one of the 7 items had probability 3/7 of being in the final sample. Verify for item A: it entered with probability 1, survived round 4 with probability (1 - 1/4) = 3/4, survived round 5 with (1 - 1/5) = 4/5, was evicted in round 6 (j = 0 hit its slot). In this particular run, A did not survive. But across many runs, its survival probability is 1 * 3/4 * 4/5 * 5/6 * 6/7 = 3/7. The intermediate fractions telescope: each numerator cancels the next denominator.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Vitter, "Random Sampling with a Reservoir," ACM Transactions on Mathematical Software, 1985. The original algorithm (Algorithm R) and faster variants (Algorithm X, Algorithm Z) that skip rejected items. Knuth, The Art of Computer Programming Vol. 2, Section 3.4.2. Efraimidis and Spirakis, "Weighted Random Sampling with a Reservoir," Information Processing Letters, 2006. Li, "Reservoir-Sampling Algorithms of Time Complexity O(n(1 + log(N/n)))," ACM Transactions on Mathematical Software, 2013.',
        'Study next: streaming algorithms (reservoir sampling belongs to the family of single-pass, bounded-memory algorithms over data streams). Count-Min Sketch (frequency estimation in bounded memory from a stream). HyperLogLog (cardinality estimation: how many distinct items, not which ones). Fisher-Yates shuffle (random permutation when the collection fits in memory; reservoir sampling is its streaming cousin). Sliding window algorithms (when you need the recent k items rather than a fair sample of all items).',
      ],
    },
  ],
};
