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
        'Read the stream position i as the count of items seen so far. The reservoir is the fixed-size sample memory. A new item either enters with probability k / i or passes by forever.',
        'The safe inference is probabilistic, not per-run. One run may keep early items or late items by chance, but after n items every item has the same inclusion probability k / n.',
        {type: 'callout', text: 'Reservoir sampling is fair because late admission and old-item eviction are tuned to leave every seen item with the same final chance.'},
      
        {type: 'image', src: './assets/gifs/reservoir-sampling.gif', alt: 'Animated walkthrough of the reservoir sampling visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Reservoir sampling exists for streams whose final length is unknown or too large to store. Logs, telemetry events, network packets, and file lines can arrive one at a time. You may need a fair sample without keeping the whole stream.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram with input and output ends', caption: 'Streaming data behaves like a queue of arrivals: the sampler must decide before the tail is known. Source: https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        'The constraint is single pass and bounded memory. A correct sample of size k should give item 1 and item n the same final chance, even though item 1 arrived when the reservoir was empty and item n arrived after it was full.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store everything and sample at the end. That gives a uniform sample because every item is available. It fails when the stream is too large or never announces an end.',
        'Another simple approach is to keep the first k items. That uses bounded memory, but it is biased toward the beginning. Keeping the last k items is biased toward the end.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is fairness over time. Early items have more chances to be evicted. Late items have fewer chances to enter. A correct algorithm must balance those two facts with no lookahead.',
        'A stream does not allow second thoughts. Once an item is discarded, it is gone. The decision rule must be local, using only k, the current item, and how many items have already appeared.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'When item i arrives and i > k, accept it with probability k / i. If accepted, replace one uniformly random reservoir slot. The falling admission probability compensates for the shorter survival time of later items.',
        'Uniform replacement is as important as the admission probability. It makes every current reservoir item face the same eviction risk. Without that, the sample would drift toward some position or slot pattern.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For the first k items, fill the reservoir. For each later item at position i, draw a random integer j in [0, i). If j < k, put the new item in slot j; otherwise discard it.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A stream can be read as a directed path of decisions: each item either enters the reservoir or flows past. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'The test j < k succeeds with probability k / i. Conditional on success, j is uniform over reservoir slots. The algorithm never needs to know how many items remain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is by induction on i, the number of items seen. After k items, every item is in the reservoir with probability 1, which equals k / k. Assume after i - 1 items, every earlier item has probability k / (i - 1).',
        'Item i enters with probability k / i. An older item is evicted only if item i is accepted and its exact slot is chosen, which has probability (k / i) * (1 / k) = 1 / i. Its survival probability is therefore (i - 1) / i.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation regions', caption: 'The proof is about distribution, not a particular run: repeated samples converge toward the intended probability law. Source: https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.'},
        'The older item probability becomes k / (i - 1) * (i - 1) / i = k / i. The new item also has probability k / i. The invariant holds for all items after every step.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Algorithm R uses O(n) time for n stream items and O(k) memory for the reservoir. Each item needs one random draw and at most one array write. Runtime doubles when stream length doubles, but memory stays fixed.',
        'When k doubles, memory doubles and the acceptance probability doubles at the same stream position. Vitter-style skip algorithms reduce random draws by jumping over rejected items, but the sample distribution stays the same.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Reservoir sampling is used for log sampling, telemetry inspection, online experiments, and random line selection from large files. The access pattern is always one pass with a sample that should represent the whole stream.',
        'It is useful when the total count is unavailable at the start. A service can keep 1,000 representative requests from a day of traffic without knowing in the morning how many requests the day will contain.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when recent data should matter more than old data. Reservoir sampling treats the first item and the last item equally. Sliding windows or exponential decay are better for recent behavior.',
        'It also fails for weighted sampling unless the algorithm is changed. If some items should have higher inclusion probability, use weighted reservoir methods such as priority keys. Distributed merging needs care because each partial reservoir represents a different stream size.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let k = 3 and stream A, B, C, D, E, F, G. First fill the reservoir with A, B, C. For item D at i = 4, suppose j = 1, so D replaces slot 1 and the reservoir becomes A, D, C.',
        'For E at i = 5, suppose j = 4, so E is rejected because 4 is not less than 3. For F at i = 6, suppose j = 0, so F replaces A and the reservoir becomes F, D, C. For G at i = 7, suppose j = 5, so G is rejected.',
        'The final sample in this run is F, D, C. Across many runs, each of the seven items has probability 3 / 7. For A, the survival probability would be 1 * 3/4 * 4/5 * 5/6 * 6/7 = 3/7 if it were not evicted in this particular run.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Vitter, Random Sampling with a Reservoir, ACM Transactions on Mathematical Software, 1985. For weighted sampling, study Efraimidis and Spirakis, Weighted Random Sampling with a Reservoir, 2006.',
        'Study next: streaming algorithms for bounded-memory processing, Count-Min Sketch for frequency estimates, HyperLogLog for distinct counts, Fisher-Yates shuffle for in-memory random permutation, and sliding windows for recent-only streams.',
      ],
    },
  ],
};