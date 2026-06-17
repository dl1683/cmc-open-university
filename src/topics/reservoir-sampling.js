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
      heading: 'Why Streams Need Sampling',
      paragraphs: [
        `Reservoir sampling solves a simple problem under a harsh constraint: keep a fair sample of k items from a stream whose final length is unknown. The stream might be click events, traces, packets, log lines, sensor readings, or records from a file too large to hold in memory.`,
        `If the stream ends after n items, fairness means every item had probability k/n of appearing in the final sample. The first event and the last event deserve the same chance. The algorithm must deliver that guarantee while storing only k items and seeing each stream item once.`,
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        `The most obvious method is to store everything, shuffle at the end, and take k items. That is exactly fair, and it is the right mental baseline. It fails when there is no end yet, when storage is too expensive, or when the sample must be available while the stream is still moving.`,
        `Other simple shortcuts are biased. Keeping the first k items ignores the future. Keeping the latest k items is a sliding window, not a sample of all history. Taking every kth item can line up with periodic structure in the data. Those choices are useful for other jobs, but they do not produce a uniform sample over the full stream.`,
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        `The wall is symmetry over time. Early items are easy to store because the reservoir is empty. Later items are harder because the reservoir is full. If early items get a permanent advantage, the sample is biased toward the beginning. If later items always replace earlier items, the sample is biased toward recency.`,
        `A correct stream sampler must balance those two forces without knowing n. The probability for item i must depend only on how many items have been seen so far. It cannot depend on the final stream length, because the algorithm does not know that length yet.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `Fill the first k slots. For item i after that, keep it with probability k/i. If the item is accepted, choose one of the k reservoir slots uniformly at random and replace the item in that slot. If the item is rejected, discard it immediately.`,
        `The accepted item must replace a random slot. Replacing the oldest item would create a recency sample. Replacing the newest item would protect early items too much. Random replacement keeps the stored items symmetric, so every item already in the reservoir faces the same eviction risk.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `The algorithm has two phases. While fewer than k items have arrived, copy each item into the next empty reservoir slot. After the reservoir is full, process item i by drawing a random integer or equivalent probability test. With probability k/i, admit the item.`,
        `If admitted, draw a random slot from 1 through k and overwrite it. The overwritten item is not special. It is just the one selected by the eviction draw. This is why the reservoir has no meaningful order unless a later step shuffles it for presentation.`,
      ],
    },
    {
      heading: 'What The Visual Proves',
      paragraphs: [
        `The visual freezes the random choices so the run is reproducible. The final letters are not the lesson. The lesson is the probability shown at each step: after the reservoir is full, item i enters with chance k/i, and an accepted item replaces a uniformly random slot.`,
        `The invariant is the real proof target. After processing item i, every item seen so far has probability k/i of sitting in the reservoir. The animation shows that the probability falls as the stream grows, but it falls for all items together, not only for late arrivals.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Use induction. After the first k items, each stored item has probability 1, which equals k/k. Now suppose that after item i - 1, every earlier item has probability k/(i - 1) of being in the reservoir.`,
        `When item i arrives, it enters with probability k/i. For any older item currently in the reservoir, eviction happens only if item i is accepted and then chooses that item's slot. That probability is (k/i) * (1/k), or 1/i. So each old item survives the round with probability 1 - 1/i, which is (i - 1)/i. Multiplying k/(i - 1) by (i - 1)/i gives k/i.`,
      ],
    },
    {
      heading: 'Cost And Behavior',
      paragraphs: [
        `Processing n items costs O(n) time because every stream item is inspected once. Memory is O(k) because the reservoir stores only k items, plus a counter and random-number state. The algorithm does not grow with the stream length.`,
        `When n doubles, memory does not change. The later admission probabilities get smaller, but the reservoir stays the same size. If k is 1,000 and each stored ID is 8 bytes, raw item storage is about 8 KB. Storing a billion IDs would be about 8 GB before object overhead, indexes, or metadata.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Reservoir sampling wins when the user needs examples from the whole stream, not summaries only. Observability systems can keep representative traces when retaining every request is too expensive. Data tools can show previews from huge files without loading the full file. Pipelines can audit records while scanning once.`,
        `It is also useful before heavier analysis. A clustering job can inspect a fair sample before loading all points. A data-quality job can keep raw examples of events that passed a filter. A statistics workflow can produce an unbiased sample when the population arrives online rather than as a finished table.`,
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        `Reservoir sampling is wrong when recency matters. A dashboard that asks "what is happening now" needs a sliding window or decay-weighted sample. It is also wrong when the task needs exact counts, heavy hitters, quantiles, or membership answers. Those are different stream problems.`,
        `Bad randomness breaks the guarantee. Filtering before sampling changes the population being sampled. Merging independent reservoirs also needs care because reservoirs from streams of different lengths should not contribute equally unless the streams had equal sizes. The sample is uniform over items only if the algorithm sees the population you intend to sample.`,
        `Sampling after retries, deduplication, or enrichment can also change the meaning of the sample. A request stream, a user stream, and an error stream are different populations. Before trusting the reservoir, name the unit being sampled and make sure each unit appears once with the intended probability.`,
      ],
    },
    {
      heading: 'Variants',
      paragraphs: [
        `The version shown here is the classic fixed-size reservoir. Weighted reservoir sampling changes the admission rule so heavier items are more likely to appear. Priority-based methods assign random keys and keep the best k keys, which can make merging and weighting easier in distributed systems.`,
        `There is also a useful k = 1 version. Keep the first item, then replace the current item with probability 1/i at step i. After n items, every item has probability 1/n of being held. The full algorithm is just the k-slot generalization of that same balancing idea.`,
        `Distributed reservoirs need extra care. If one worker sees a million records and another sees a thousand, their local samples should not be merged by taking half from each. Merge logic must account for stream sizes or use priority keys whose ordering remains valid across partitions.`,
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        `Compare Reservoir Sampling with Sliding Window first. Sliding Window answers recent-history questions; reservoir sampling answers all-history uniform-sample questions. Then study Big-O Growth, Randomized Algorithms, and Probability basics if the induction proof still feels slippery.`,
        `For adjacent streaming tools, study Bloom Filters for bounded-memory membership, Count-Min Sketch for approximate frequencies, KLL or Greenwald-Khanna sketches for quantiles, and HyperLogLog for approximate distinct counts. Those structures keep summaries, while reservoir sampling keeps raw examples.`,
      ],
    },
  ],
};
