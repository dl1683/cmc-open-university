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
    explanation: `The problem: a stream of items flows past — clicks, log lines, tweets — and you must keep a FAIR random sample of ${k}, where fair means every item ever seen has an EQUAL chance of being in your sample. The catch: you don't know how long the stream is, it may never end, and you can store only ${k} items. You cannot "wait for all the data and then pick" — there is no all.`,
  };

  for (let i = 1; i <= STREAM.length; i += 1) {
    const item = STREAM[i - 1];
    if (i <= k) {
      reservoir.push(item);
      yield {
        state: arrayState([...reservoir, ...new Array(k - reservoir.length).fill('·')]),
        highlight: { active: [`i${reservoir.length - 1}`] },
        explanation: `Item ${i} ('${item}'): the reservoir isn't full yet — take it unconditionally. The first ${k} items fill the ${k} slots.`,
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
    explanation: `Stream over (this time): the sample is [${reservoir.join(', ')}], and every one of the ${STREAM.length} items had exactly ${k}/${STREAM.length} = 30% chance of being here — the early 'A' and the late 'J' alike. The proof is a tidy induction: item i enters with k/i; each earlier item survives round i with probability (1 − k/i · 1/k) = (i−1)/i, which telescopes every item's chance down to exactly k/n. Memory used: ${k} slots, forever.`,
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
      heading: 'What it is',
      paragraphs: [
        `Reservoir sampling is an algorithm for building a perfectly fair random sample of k items from a stream of unknown or infinite length, using only k slots of memory. You see data flow past — click requests, log lines, sensor readings, tweet IDs — and must maintain a representative subset without knowing when (or if) the stream ends. Classical sampling (collect all data, then shuffle and pick k) is impossible when the stream is unbounded or too large to fit in memory. Reservoir sampling solves this in a single pass.`,
        `The algorithm achieves fairness through an elegant probabilistic balance: the first k items fill the reservoir unconditionally; each subsequent item i is admitted with probability k/i, evicting a uniformly random earlier item if accepted. This means item 10 has a 30% chance of entering (if k = 3), item 100 has 3%, item 1,000,000 has 0.0003%. The cost? Only k memory slots, forever, no matter how long the stream lasts.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The first k items go straight into the reservoir—no choice needed. For item i (where i > k), generate a random number from 1 to i. If that number is ≤ k, the item enters the reservoir; otherwise it passes through and is discarded. When an item is accepted, pick a uniformly random slot (0 to k−1) and replace whatever was there. The algorithm terminates naturally when the stream ends, and at that moment, every item ever seen has identical probability of being in your sample.`,
        `The magic is the telescoping induction: item i enters with probability k/i. Given item i is in, an earlier item (say item j < i) survives round i only if (a) item i is rejected, or (b) item i is accepted but the random slot is not j. Probability = (1 − k/i) + (k/i)(1 − 1/k) = (1 − k/i)(1 + k/i − 1/k) = (i−1)/i. So item j's cumulative survival chance after seeing all n items = (k/k) · (k/(k+1)) · ((k+1)/(k+2)) · ... · ((n−1)/n) = k/n. Early items and late items: same fairness guarantee.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time: O(n), where n is the length of the stream. You process each item exactly once. Space: O(k), constant in the stream length — the defining win of the algorithm. You hold k items in memory and a few scalar variables (loop counter, random numbers); nothing scales with stream size. For a 1-billion-item stream where k = 1,000, you use ~8KB of memory while a classical approach would need gigabytes. Vitter's Algorithm R (1985) formalized this for computer science; the core technique predates modern computing.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Request tracing in production systems: log collectors sample incoming HTTP requests to feed into tracing databases. Storing every request is prohibitive; reservoir sampling keeps a fair cross-section (all endpoints, all response times equally represented) without needing to know traffic volume in advance. BigQuery and Apache Spark use reservoir sampling internally for one-pass statistical sampling of massive datasets. A/B testing platforms apply it to select users from a live user stream for experiment enrollment, ensuring each user sees randomization at the moment they arrive—no need to buffer. Music shufflers use it to shuffle from playlists of unknown or newly-updated length. Any system that must hold a representative sample across unknown data arrival patterns is a home for reservoir sampling.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The probability k/i *decreases* as i grows; students often think later items are penalized. They are, individually—but they arrive later so each has fewer rounds to be evicted. The two effects cancel exactly, which is why the induction works. Another pitfall: confusing "fair" with "uniform." A reservoir sample of k items from n is fair (each item has k/n chance) but not uniform in the order they appear—it is a random *subset*, not a random permutation. If you need the subset in shuffled order, shuffle the final reservoir. Finally, do not discard items before deciding: the algorithm needs to *see* item i to compute its k/i probability; if you filter before sampling, you bias toward items that match your filter, breaking fairness across the full stream.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Explore Sliding Window to contrast: sampling keeps a fair sample of *all* items; sliding window keeps only the *recent* items. Study Two Pointers and Big-O Growth Rates to deepen intuition for how O(k) memory elegantly sidesteps unbounded data. Bloom Filter is another probabilistic data structure for bounded memory on infinite streams—it trades exact counting for false-positive rates. For ML contexts, K-Means Clustering uses sampling (including reservoir methods) to initialize on large unlabeled datasets, ensuring clusters do not drift toward whatever biases arrived first in the training stream.`,
      ],
    },
  ],
};

