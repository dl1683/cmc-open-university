// Heavy hitters in streams: keep a small summary of candidate frequent keys
// with bounded overcount instead of tracking every distinct item.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'heavy-hitters-space-saving',
  title: 'Heavy Hitters: Space-Saving Summaries',
  category: 'Data Structures',
  summary: 'Find the frequent keys in a huge stream: keep a tiny counter table, evict the current minimum, and report candidates with error bounds.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['space-saving', 'compare sketches'], defaultValue: 'space-saving' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* spaceSaving() {
  const k = 3;
  const trackedKeys = ['login', 'search', 'bot'];
  const minCount = 7;

  yield {
    state: graphState({
      nodes: [
        { id: 'event', label: 'event', x: 0.8, y: 4.0, note: 'key' },
        { id: 'hit', label: 'hit?', x: 2.6, y: 4.0, note: 'known' },
        { id: 'inc', label: 'inc', x: 4.1, y: 4.0, note: 'or evict min' },
        { id: 'table', label: 'table', x: 6.1, y: 4.0, note: 'k slots' },
        { id: 'top', label: 'top-k', x: 8.2, y: 4.0, note: 'candidates' },
      ],
      edges: [
        { id: 'e-event-hit', from: 'event', to: 'hit' },
        { id: 'e-hit-inc', from: 'hit', to: 'inc' },
        { id: 'e-inc-table', from: 'inc', to: 'table' },
        { id: 'e-table-top', from: 'table', to: 'top' },
      ],
    }, { title: 'Space-Saving keeps only candidate heavy keys' }),
    highlight: { active: ['hit', 'inc', 'table'], found: ['top'] },
    explanation: `A heavy-hitter summary cannot store every distinct key. Space-Saving keeps ${k} candidate counters (${trackedKeys.join(', ')}). Known keys increment; unknown keys replace the current minimum and inherit its count plus one.`,
    invariant: `The ${k}-slot table is a summary of candidates, not an exact histogram.`,
  };

  yield {
    state: labelMatrix(
      'Three-slot summary',
      [
        { id: 'a', label: 'login' },
        { id: 'b', label: 'search' },
        { id: 'c', label: 'bot' },
        { id: 'new', label: 'new key: api' },
      ],
      [
        { id: 'count', label: 'count' },
        { id: 'error', label: 'error' },
      ],
      [
        ['42', '0'],
        ['18', '2'],
        ['7', '3'],
        ['replace bot with 8', 'err<=7'],
      ],
    ),
    highlight: { active: ['c:count'], found: ['new:count', 'new:error'] },
    explanation: `When a new key arrives and all ${k} slots are full, replace the smallest counter (${trackedKeys[trackedKeys.length - 1]} at count ${minCount}). The new key inherits count ${minCount + 1}; its error field records how much of that count could belong to the evicted key.`,
  };

  yield {
    state: labelMatrix(
      'Why this finds heavy hitters',
      [
        { id: 'many', label: 'many mice' },
        { id: 'elephant', label: 'elephant key' },
        { id: 'threshold', label: 'threshold' },
        { id: 'verify', label: 'verify' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['evict each other', 'noise'],
        ['keeps returning', 'survives'],
        ['count high', 'candidate'],
        ['exact pass/store', 'decide'],
      ],
    ),
    highlight: { found: ['elephant:lesson', 'threshold:lesson'], compare: ['many:lesson'] },
    explanation: `Small keys churn through the minimum slot among the ${k} tracked candidates. A genuinely frequent key keeps reappearing, increases its counter above ${minCount}, and becomes hard to evict. Important decisions should still verify candidates exactly.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'stream skew', min: 0, max: 100 }, y: { label: 'candidate precision', min: 0, max: 100 } },
      series: [
        { id: 'space', label: 'Space-Saving', points: [{ x: 0, y: 35 }, { x: 30, y: 58 }, { x: 70, y: 84 }, { x: 100, y: 94 }] },
        { id: 'cms', label: 'CMS only', points: [{ x: 0, y: 25 }, { x: 30, y: 45 }, { x: 70, y: 70 }, { x: 100, y: 85 }] },
      ],
    }),
    highlight: { active: ['space'], compare: ['cms'] },
    explanation: `The shape is illustrative: with ${k} counter slots, candidate summaries improve when the stream has strong elephants. Flat, low-skew streams are harder because no key clearly dominates the ${k}-entry table.`,
  };
}

function* compareSketches() {
  const sketchFamilies = ['Count-Min', 'Misra-Gries', 'Space-Saving', 'HyperLogLog'];
  const pipelineStages = ['events', 'summary', 'exact', 'alert', 'store'];

  yield {
    state: labelMatrix(
      'Sketch family roles',
      [
        { id: 'cms', label: 'Count-Min' },
        { id: 'mg', label: 'Misra-Gries' },
        { id: 'ss', label: 'Space-Saving' },
        { id: 'hll', label: 'HyperLogLog' },
      ],
      [
        { id: 'answers', label: 'answers' },
        { id: 'doesnot', label: 'does not' },
      ],
      [
        ['count(key)', 'list keys'],
        ['frequent candidates', 'exact counts'],
        ['top-k candidates', 'exact counts'],
        ['distinct count', 'which keys'],
      ],
    ),
    highlight: { active: ['mg:answers', 'ss:answers'], compare: ['cms:doesnot', 'hll:doesnot'] },
    explanation: `Among these ${sketchFamilies.length} sketch families (${sketchFamilies.join(', ')}), Count-Min can estimate the count of a named key but cannot list all keys by itself. Heavy-hitter summaries keep the candidate keys directly.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'events', label: 'events', x: 0.8, y: 4.0, note: 'stream' },
        { id: 'summary', label: 'summary', x: 2.7, y: 4.0, note: 'candidates' },
        { id: 'exact', label: 'exact', x: 4.7, y: 4.0, note: 'verify' },
        { id: 'alert', label: 'alert', x: 6.7, y: 4.0, note: 'safe' },
        { id: 'store', label: 'store', x: 8.5, y: 4.0, note: 'sample' },
      ],
      edges: [
        { id: 'e-events-summary', from: 'events', to: 'summary' },
        { id: 'e-summary-exact', from: 'summary', to: 'exact' },
        { id: 'e-exact-alert', from: 'exact', to: 'alert' },
        { id: 'e-summary-store', from: 'summary', to: 'store' },
      ],
    }, { title: 'Production pipelines verify the expensive few exactly' }),
    highlight: { active: ['summary', 'exact'], found: ['alert'] },
    explanation: `A common production pattern is approximate first pass, exact second pass across ${pipelineStages.length} stages (${pipelineStages.join(' → ')}). The summary filters the huge stream down to a small candidate list, and exact storage or replay verifies important alerts.`,
  };

  yield {
    state: labelMatrix(
      'Where it runs',
      [
        { id: 'net', label: 'network flows' },
        { id: 'search', label: 'search queries' },
        { id: 'logs', label: 'log keys' },
        { id: 'ml', label: 'feature drift' },
      ],
      [
        { id: 'heavy', label: 'heavy means' },
        { id: 'action', label: 'action' },
      ],
      [
        ['elephant flows', 'rate limit'],
        ['trending terms', 'cache/index'],
        ['hot errors', 'page owner'],
        ['top categories', 'investigate'],
      ],
    ),
    highlight: { found: ['net:action', 'logs:action'], active: ['search:heavy', 'ml:heavy'] },
    explanation: `Heavy hitters are the "what is dominating right now?" question. With ${sketchFamilies.length} sketch approaches available, the choice shows up in networking, search, observability, fraud, recommender telemetry, and feature monitoring.`,
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'flat', label: 'flat stream' },
        { id: 'adversary', label: 'adversary' },
        { id: 'merge', label: 'bad merge' },
        { id: 'billing', label: 'billing' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'response', label: 'response' },
      ],
      [
        ['no true heavy', 'wide uncertainty'],
        ['crafted churn', 'salt/hash'],
        ['incompatible params', 'align k/seeds'],
        ['approx counts', 'verify exact'],
      ],
    ),
    highlight: { removed: ['billing:risk'], found: ['billing:response', 'merge:response'] },
    explanation: `Do not let an approximate summary from any of the ${sketchFamilies.length} sketch families become the source of legal, billing, or deletion truth. Use it to find candidates and route attention.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'space-saving') yield* spaceSaving();
  else if (view === 'compare sketches') yield* compareSketches();
  else throw new InputError('Pick a heavy-hitter view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The Space-Saving view shows the pipeline: an event arrives, the algorithm checks whether its key is already tracked, and either increments an existing counter or evicts the current minimum. Watch the minimum slot -- it is the weakest candidate the structure is willing to remember. When a new key replaces it, the inherited error field records how much of the new count may belong to evicted predecessors.',
        {type: 'callout', text: 'Space-Saving treats memory as a competition: persistent keys rise above churn, while rare keys recycle the minimum slot.'},
        {
          type: 'diagram',
          text: '  event --> [hit?] --> [inc / evict min] --> [table: k slots] --> [top-k]\n                                                    ^\n                                                    |\n                                          minimum slot = eviction target',
          label: 'Data flow: every event touches exactly one slot. The minimum slot is the replacement frontier.',
        },
        'In the sketch-comparison view, separate three questions that use different summaries. Count-Min estimates a named key but cannot list keys. Space-Saving keeps candidate identities. HyperLogLog estimates distinct count without storing any keys. A key present in the table is a candidate, not a certificate. A key absent from the table is not necessarily rare -- it was not strong enough to survive the memory budget.',
        {
          type: 'note',
          text: 'The color states in the animation: active (orange) marks slots being updated, found (green) marks candidates that survived to the output, compare (blue) marks alternative sketches or contrasting behavior, and removed (red) marks evicted or failing entries.',
        },
        {type: 'image', src: './assets/gifs/heavy-hitters-space-saving.gif', alt: 'Animated walkthrough of the heavy hitters space saving visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A router sees millions of source-destination pairs per second. An observability pipeline ingests billions of log lines per day. A feature monitor watches every token category in a model input stream. In each case, the operator needs the same answer: which keys are dominating right now?',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Animated packet switching diagram with packets moving through a network', caption: 'Streaming telemetry is a natural setting for heavy hitter sketches. Source: Wikimedia Commons, Packet Switching.'},
        'That question is different from counting a known key. A database can count product X if you name X. A stream operator does not know which product, endpoint, customer, or error code deserves attention yet. It needs discovery under memory pressure -- find the identities large enough to justify exact storage or human investigation.',
        {
          type: 'quote',
          text: 'We present a 1-pass algorithm that computes an epsilon-approximate set of frequent items using only a constant number of counters per monitored element, and provably includes all items whose true frequency exceeds phi * m.',
          attribution: 'Ahmed Metwally, Divyakant Agrawal, and Amr El Abbadi, "Efficient Computation of Frequent and Top-k Elements in Data Streams," ICDT 2005',
        },
        'Space-Saving was designed for exactly this: keep a small table of likely frequent keys, evict the weakest when a new contender arrives, and carry enough error metadata to distinguish real elephants from noise.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is an exact frequency map backed by a top-k heap. For every event, hash the key into a dictionary that maps key strings to integer counts and increment the corresponding entry. Maintain a min-heap of size k over the dictionary values. When a count increases past the heap\'s minimum, swap it in. The result is a perfectly accurate top-k at all times.',
        {
          type: 'bullets',
          items: [
            'Exact frequency map + heap: O(distinct keys) memory, discovers keys, but memory grows with cardinality.',
            'Count-Min Sketch: O(width * depth) memory, cannot list keys on its own -- needs an external key list to answer per-key queries.',
            'Uniform sampling: O(sample size) memory, partially discovers keys, but misses bursty keys and gives weak identity guarantees.',
            'Space-Saving: O(k) memory, keeps candidate identities directly, but counts are approximate with bounded error.',
          ],
        },
        'The exact map treats every new key as equally deserving. In a high-cardinality stream with millions of distinct keys, memory grows without bound. Sampling helps estimate aggregate behavior but can miss keys that spike briefly. A Count-Min Sketch compresses counts into fixed memory, but the key names have to come from somewhere else. Space-Saving sits in the middle: it spends memory on identities, but only on the identities currently strong enough to compete for a slot.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The exact map fails because it cannot forget. Every one-off request, every bot probe, every rare error code permanently occupies a slot. Memory scales with the number of distinct keys, not the number of important keys.',
        'A sketch solves the memory problem but creates an identity problem: it can answer "how many times did key X appear?" but cannot answer "which keys appeared most?" without a separate structure to track candidate names.',
        {
          type: 'note',
          text: 'The hard case is not a stream with one obvious giant. It is a stream with bursts, churn, and many almost-heavy keys. A new key might be the start of a real incident or a single request from a long tail. The summary must decide online, before seeing the future, while carrying enough error information to avoid pretending approximate counts are exact.',
        },
        'The wall is the identity-memory tradeoff: the structure must spend memory on key names, but only for candidates worth remembering. Rare keys must not permanently occupy slots. True heavy keys must survive churn long enough to become visible.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The insight is competitive eviction with inherited error. Instead of tracking every key or none of them, maintain exactly k counter slots and let keys compete for those slots. When a new key arrives and the table is full, the key with the smallest count loses its slot. The new key inherits the evicted count plus one, and the error field records how much of that inherited count might belong to the predecessor.',
        'This turns memory into a survival contest. Rare keys arrive once, briefly occupy or fail to occupy a slot, and disappear. A genuinely frequent key keeps reappearing. Even if it gets evicted early, subsequent arrivals reclaim a slot and the counter climbs again. The more dominant a key truly is, the harder it becomes to evict.',
        'The error field is what makes this honest rather than reckless. Without it, the inherited count would be presented as exact, and a key that replaced a count-50 predecessor would look like it appeared 51 times when it might have appeared once. The error bound says: the true count is somewhere between count minus error and count. That interval is narrow for genuine heavy hitters and wide for noise that recently recycled a slot.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Space-Saving maintains a fixed-size table of k slots. Each slot stores a key, a count, and an error bound. Three cases handle every arriving event:',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Min-heap.png', alt: 'Binary min heap diagram with the smallest value at the root', caption: 'A min-tracking structure can expose the counter slot that Space-Saving should recycle. Source: Wikimedia Commons, Min-heap.'},
        {
          type: 'code',
          language: 'javascript',
          text: 'function spaceSavingUpdate(table, key) {\n  const slot = table.find(s => s.key === key);\n  if (slot) {\n    // Case 1: key already tracked -- increment in place\n    slot.count++;\n    return;\n  }\n  if (table.length < k) {\n    // Case 2: free space -- add new entry\n    table.push({ key, count: 1, error: 0 });\n    return;\n  }\n  // Case 3: table full -- evict the minimum\n  const min = table.reduce((a, b) => a.count <= b.count ? a : b);\n  min.error = min.count;   // inherited error from evicted key\n  min.key = key;           // replace identity\n  min.count = min.count + 1; // new count = old min + 1\n}',
        },
        'The table is backed by two indexes: a hash map from key to slot for O(1) lookups, and a minimum-tracking structure for eviction. Small tables scan for the minimum. Larger summaries use a doubly-linked list of count groups (the Stream-Summary structure from the original paper) so that both increment and evict-minimum run in O(1) amortized time.',
        {
          type: 'diagram',
          text: '  Count groups (doubly linked):   [7] <-> [18] <-> [42]\n                                   |        |        |\n                                  bot    search    login\n\n  After "api" arrives and evicts bot (min = 7):\n\n                                  [8] <-> [18] <-> [42]\n                                   |        |        |\n                                  api    search    login\n                                err<=7',
          label: 'Stream-Summary: each count group holds all keys with that count. Eviction and increment both follow pointers, no heap repair needed.',
        },
        'Merging summaries across shards is more delicate. Two tables with the same capacity k cannot simply concatenate rows and sort. The missing mass in each shard -- the events that fell below the retention frontier -- must be accounted for. Production systems either merge through compatible parameters, feed shard outputs into a second-level summary, or verify the small candidate union exactly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The core invariant: the sum of all counters in the table equals the number of events processed. Every event increments exactly one counter (either an existing key or the evicted minimum plus one). No counts are created from nothing or lost.',
        {
          type: 'note',
          text: 'Guarantee: any key whose true frequency exceeds N/k must appear in the table, where N is the total stream length and k is the number of counters. The proof follows from pigeonhole: if a key appeared more than N/k times but is absent, the k slots consumed more than N total events -- a contradiction.',
        },
        'The mental model is churn versus persistence. Rare keys fight over the minimum slot, evicting each other. A genuinely frequent key keeps reappearing, increments its counter, and rises above the replacement frontier. Even if evicted early, repeated arrivals bring it back.',
        'The error field makes the approximation honest. For any tracked key, the true count lies in the interval [count - error, count]. If count - error is still above the heavy-hitter threshold, the key is a confirmed heavy hitter. If the interval straddles the threshold, the key is a plausible candidate that may need exact verification.',
        {
          type: 'bullets',
          items: [
            'No false negatives above threshold: any key with true frequency > N/k is present in the table.',
            'Bounded overcount: reported count >= true count >= count - error.',
            'Error bound: error <= N/k for every slot.',
            'Monotonic counters: counters never decrease, and the minimum never shrinks over time.',
          ],
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Process one event (hash map + scan): O(1) lookup + O(k) min-scan, O(k) space. Dominated by min-scan; fine for small k.',
            'Process one event (Stream-Summary): O(1) amortized time, O(k) slots + linked list. Dominated by hash map lookup and pointer chasing.',
            'Query top-j candidates (j <= k): O(k log k) to sort, or O(k) with maintained order. Sorting cost; usually done infrequently.',
            'Merge two summaries: O(k) per summary, O(k) combined. Error reconciliation is not trivial.',
          ],
        },
        'Memory is proportional to retained counters, not distinct keys. A table of 1,000 counters uses kilobytes regardless of whether the stream contains 10,000 or 10 billion distinct keys. Doubling k halves the error bound N/k but doubles memory.',
        'The main sizing knob is k. More counters lower the replacement frontier, preserve more near-heavy candidates, and narrow error intervals. Very small tables (k = 10-50) are useful for coarse "what is dominating?" signals. Customer-facing analytics or security investigations usually need k in the hundreds or thousands, or an exact follow-up pass over the candidate set.',
        {
          type: 'note',
          text: 'Latency matters because the update path sits inside ingestion. A structure with good asymptotic bounds can still be wrong if it allocates memory, locks shared state, or repairs a heap on every packet at line rate. Many production systems shard the summary per worker, keep per-core tables, and merge periodically.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Space-Saving fits any system that asks "what is dominating right now?" and can tolerate approximate answers with bounded error.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Partial map of internet connectivity with many colored network links', caption: 'Heavy hitter summaries help operators find dominant flows inside enormous network streams. Source: Wikimedia Commons, Internet map.'},
        {
          type: 'bullets',
          items: [
            'Network traffic (routers, DDoS): "heavy" means elephant flows by byte volume. Action: rate-limit, reroute, alert NOC.',
            'Search engines: "heavy" means trending query terms. Action: pre-cache results, update suggestions.',
            'Observability pipelines: "heavy" means hot error codes or log patterns. Action: page the owner, open investigation.',
            'Feature monitoring (ML): "heavy" means dominant input categories drifting. Action: trigger retraining pipeline.',
            'Ad serving: "heavy" means top campaigns by impression volume. Action: budget pacing, fraud check.',
            'DNS resolvers: "heavy" means most-queried domains. Action: prefetch, cache warming.',
          ],
        },
        'Hierarchical Heavy Hitters extend the idea to prefixes -- finding the most common /16 subnet rather than individual IPs. Elastic Sketch separates elephant and mice flows into distinct tables. HeavyKeeper uses count-with-decay to sharpen top-k accuracy. All share the same core idea: spend identity memory only on keys strong enough to justify it.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Production pattern: approximate first pass, exact second pass\nconst candidates = spaceSaving.topK(20);\nconst verified = [];\nfor (const { key, count, error } of candidates) {\n  if (count - error > threshold) {\n    verified.push(key);  // confirmed heavy hitter\n  } else {\n    // borderline candidate -- verify from exact store\n    const exact = await exactStore.getCount(key, window);\n    if (exact > threshold) verified.push(key);\n  }\n}',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Flat streams with no true elephants: if every key has nearly the same frequency, no small table can confidently name dominant keys because there are none. Wide uncertainty intervals are the correct result, not a bug.',
            'Billing, deletion, or legal truth: approximate counts must never be the source of record for money, access control, or compliance. Use candidates to select a verification set, then count exactly.',
            'Adversarial churn: an attacker who knows k can craft key sequences that maximize eviction and inflate error bounds. Salting or hashing key identities before insertion mitigates this, at the cost of losing human-readable names in the table.',
            'Incompatible merges: two shards with different k, different decay policies, or different key normalization produce summaries that cannot be combined meaningfully. Parameters must travel with the summary.',
            'Unversioned identity logic: if one service hashes raw URLs, another normalizes query strings, and a third lowercases paths, their summaries measure different key spaces. The algorithm can be correct and the metric still wrong.',
          ],
        },
        {
          type: 'note',
          text: 'The summary metadata that must travel with the table: counter capacity k, total events processed N, window start and end timestamps, key normalization version, decay policy (if any), and algorithm variant. Without this, old summaries cannot be compared, merged, or debugged.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a stream of 20 events arrives with k = 3 counter slots. The events in order: A, B, C, A, D, A, B, A, E, A, B, F, A, B, A, B, A, B, A, B. Key A appears 10 times, B appears 7 times, and C, D, E, F each appear once.',
        'After the first three events (A, B, C), the table is full: A=1, B=1, C=1. Event 4 is A again, so A increments to 2. Event 5 is D, a new key. The minimum is B and C tied at 1. Suppose the algorithm picks C. D replaces C with count 2 (old min 1 + 1) and error 1. The table is now A=2, B=1, D=2(err=1).',
        'Event 6 is A (now 3). Event 7 is B (now 2). Event 8 is A (now 4). Event 9 is E, a new key. The minimum is B at 2. E replaces B with count 3, error 2. Table: A=4, E=3(err=2), D=2(err=1). Event 10 is A (now 5). Event 11 is B, new again -- minimum is D at 2. B replaces D with count 3, error 2.',
        'The pattern continues: A keeps climbing because it is genuinely dominant. B keeps getting evicted but keeps returning, each time inheriting higher counts. After all 20 events, A holds the top slot with a count near 10 and low error. B holds a slot with a count near 7 but with accumulated error from evictions. The true heavy hitters (A and B) survived the competition. The one-off keys (C, D, E, F) churned through the minimum slot and disappeared.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Original paper: Metwally, Agrawal, El Abbadi, "Efficient Computation of Frequent and Top-k Elements in Data Streams," ICDT 2005. https://link.springer.com/chapter/10.1007/978-3-540-30570-5_27',
            'Technical report with Stream-Summary details: https://www.cs.ucsb.edu/sites/default/files/documents/2005-23.pdf',
            'Misra-Gries summary (predecessor algorithm): https://people.csail.mit.edu/rrw/6.045-2019/encalgs-mg.pdf',
            'HeavyKeeper (count-with-decay improvement): https://www.usenix.org/system/files/conference/atc18/atc18-gong.pdf',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Count-Min Sketch -- understand sketch-based counting before candidate tracking.',
            'Prerequisite: Hash Tables -- the lookup index behind every streaming summary.',
            'Sibling algorithm: Count Sketch: Signed Frequency -- unbiased estimates via sign hashing.',
            'Extension: Hierarchical Heavy Hitters: Prefix Sketch -- lift identity from keys to prefixes.',
            'Extension: Elastic Sketch Network Telemetry -- separate elephant and mice flows.',
            'Contrast: HyperLogLog -- distinct count without storing any keys.',
            'Contrast: Reservoir Sampling -- uniform samples versus frequency-biased candidates.',
          ],
        },
        'For a deeper treatment of the streaming model, start with the Misra-Gries algorithm, which predates Space-Saving and uses a different eviction rule (decrement all counters instead of replacing the minimum). The two algorithms are closely related and share the same worst-case guarantees, but Space-Saving\'s error tracking per slot is more informative in practice.',
      ],
    },
  ],
};
