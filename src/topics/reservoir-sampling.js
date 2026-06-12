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
        `Reservoir Sampling keeps a fair random sample of k items from a stream whose length is unknown, possibly enormous, or never-ending. You cannot store every log line, click, packet, or sensor reading and shuffle later. The demo fixes k = 3 and streams A through J. The first three items fill the reservoir; each later item is considered with probability k/i, where i is the number of items seen so far.`,
        `The fairness target is precise: after seeing i items, every item seen so far has probability k/i of being in the reservoir. The visualization freezes the random decisions so the lesson is reproducible, but the displayed probabilities are the real algorithm. Sliding Window keeps recent items; Reservoir Sampling keeps an unbiased sample across all items ever seen.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `For item i <= k, store it. For item i > k, generate a random integer from 1 to i. If it is greater than k, discard the item. If it is at most k, keep the item and evict one uniformly random reservoir slot. The accepted item does not always replace the oldest item, the newest item, or the weakest item; it replaces a uniformly chosen slot so every survivor remains symmetric.`,
        `The proof is a short induction. A new item i enters with probability k/i. An old reservoir item survives round i with probability 1 - 1/i: either the new item is rejected, or it is accepted but evicts a different one of the k slots. Multiplying survival probabilities from i = k+1 to n telescopes to k/n. Early items face more eviction rounds; late items enter less often. The two effects exactly balance.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Processing n stream items costs O(n) time and O(k) memory. Memory does not depend on n, which is the whole point. If k = 1,000 and each stored ID is 8 bytes, the reservoir's raw item storage is about 8 KB, while storing a billion IDs would require about 8 GB before overhead. Big-O Growth Rates explains why bounded memory changes what is possible for streaming data.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Telemetry systems keep representative traces when full retention is too expensive. Data platforms use reservoir-style one-pass sampling for previews, approximate statistics, and audits. A/B Testing & p-values and Confidence Intervals & the Bootstrap depend on samples being representative; reservoir sampling is one way to avoid favoring early or late arrivals. K-Means Clustering can use stream samples to initialize or inspect massive datasets without loading all points. Hash Table may track sampled IDs, while Queue belongs to recent-window sampling instead.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Later items are not unfairly punished. Their entry probability is lower, but they have fewer chances to be evicted. Another mistake is filtering before sampling when the goal is a sample of the original stream; that changes the population. A reservoir is also not a shuffled permutation. It is a random subset, and its internal order is just slot order unless you shuffle afterward. Finally, use good randomness. Biased random integers or modulo bias can distort the guarantee.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Compare Reservoir Sampling with Sliding Window: one samples all history, the other keeps recency. Bloom Filter is another bounded-memory streaming tool, trading exactness for false positives. Big-O Growth Rates explains O(k) memory, while A/B Testing & p-values, Confidence Intervals & the Bootstrap, and Multiple Testing & False Discoveries show why sampling quality matters once statistics enter the picture.`,
      ],
    },
  ],
};
