// Counting Bloom filters replace bits with small counters so deletes can
// decrement shared evidence without erasing other keys' footprints.

import { arrayState, graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'counting-bloom-filter',
  title: 'Counting Bloom Filter',
  category: 'Systems',
  summary: 'A deletable Bloom-filter variant: use small counters instead of bits, increment on insert, decrement on delete, and treat nonzero as set.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['insert and delete', 'stable stream'], defaultValue: 'insert and delete' },
  ],
  run,
};

const SIZE = 12;
const POS = {
  A: [2, 5, 9],
  B: [5, 9, 10],
  C: [1, 5, 7],
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

  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function stableFlow(title) {
  return graphState({
    nodes: [
      { id: 'item', label: 'new item', x: 0.8, y: 3.2, note: 'stream' },
      { id: 'age', label: 'age down', x: 2.7, y: 3.2, note: 'random cells' },
      { id: 'insert', label: 'insert', x: 4.6, y: 3.2, note: 'set counters' },
      { id: 'query', label: 'query', x: 6.5, y: 3.2, note: 'duplicate?' },
      { id: 'stable', label: 'stable rate', x: 8.4, y: 3.2, note: 'bounded' },
    ],
    edges: [
      { id: 'e-item-age', from: 'item', to: 'age' },
      { id: 'e-age-insert', from: 'age', to: 'insert' },
      { id: 'e-insert-query', from: 'insert', to: 'query' },
      { id: 'e-query-stable', from: 'query', to: 'stable' },
    ],
  }, { title });
}

function* insertAndDelete() {
  const counters = new Array(SIZE).fill(0);

  yield {
    state: arrayState(counters),
    highlight: {},
    explanation: 'A Counting Bloom Filter starts like a Bloom Filter, but every cell is a small counter instead of one bit. Query still asks whether all hashed cells are nonzero.',
    invariant: 'Counters let overlapping keys share evidence without losing track of how many inserts contributed to a cell.',
  };

  for (const key of ['A', 'B']) {
    const positions = POS[key];
    yield {
      state: arrayState(counters),
      highlight: { active: positions.map((p) => `i${p}`) },
      explanation: `insert(${key}): increment counters ${positions.join(', ')}. Overlap is allowed; shared cells count both keys instead of only remembering one bit.`,
    };
    for (const p of positions) counters[p] += 1;
    yield {
      state: arrayState(counters),
      highlight: { found: positions.map((p) => `i${p}`) },
      explanation: `After inserting ${key}, those counters are positive. The filter still cannot prove membership, but it can safely say no when any required counter is zero.`,
    };
  }

  yield {
    state: arrayState(counters),
    highlight: { active: POS.A.map((p) => `i${p}`), compare: POS.B.map((p) => `i${p}`) },
    explanation: 'A and B overlap at counters 5 and 9. That is why deletion needs counts. Clearing those cells would accidentally erase part of B.',
  };

  for (const p of POS.A) counters[p] -= 1;
  yield {
    state: arrayState(counters),
    highlight: { removed: POS.A.map((p) => `i${p}`), found: POS.B.map((p) => `i${p}`) },
    explanation: 'delete(A): decrement only A positions. The shared counters remain nonzero because B still contributes to them. B can still query as maybe present.',
    invariant: 'Correct deletion assumes each delete corresponds to a prior insert and counters do not underflow.',
  };

  yield {
    state: labelMatrix(
      'Operation contract',
      [
        { id: 'insert', label: 'insert' },
        { id: 'query', label: 'query' },
        { id: 'delete', label: 'delete' },
        { id: 'overflow', label: 'overflow' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['increment k cells', 'counter cap'],
        ['all nonzero?', 'false positive'],
        ['decrement k cells', 'bad delete'],
        ['saturate or widen', 'false negatives'],
      ],
    ),
    highlight: { found: ['delete:action'], compare: ['overflow:risk'] },
    explanation: 'Counting filters buy deletion with memory and discipline. Bad deletes, counter overflow, or underflow can create false negatives, which ordinary Bloom filters avoid.',
  };
}

function* stableStream() {
  yield {
    state: stableFlow('Stable Bloom filters forget old stream evidence'),
    highlight: { active: ['age', 'insert'], found: ['stable'] },
    explanation: 'A stable Bloom filter targets unbounded streams. It randomly decrements some counters before inserting the new item, so old evidence gradually disappears and memory stays fixed.',
    invariant: 'Stable filters trade possible false negatives for bounded memory over an infinite stream.',
  };

  yield {
    state: labelMatrix(
      'Variant map',
      [
        { id: 'classic', label: 'classic Bloom' },
        { id: 'counting', label: 'counting Bloom' },
        { id: 'stable', label: 'stable Bloom' },
        { id: 'cuckoo', label: 'cuckoo filter' },
      ],
      [
        { id: 'delete', label: 'delete?' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['no', 'tiny bits'],
        ['yes', 'counters'],
        ['ages out', 'false negatives'],
        ['yes', 'fingerprints'],
      ],
    ),
    highlight: { active: ['counting:delete', 'stable:delete'], compare: ['classic:delete'], found: ['cuckoo:delete'] },
    explanation: 'Different approximate-membership structures choose different contracts. Counting Bloom preserves deletions when operations are well-formed; stable Bloom handles endless streams by allowing old items to fade.',
  };

  yield {
    state: labelMatrix(
      'Streaming duplicate detection',
      [
        { id: 'recent', label: 'recent item' },
        { id: 'old', label: 'old item' },
        { id: 'new', label: 'new item' },
        { id: 'hot', label: 'hot repeat' },
      ],
      [
        { id: 'counter', label: 'counters' },
        { id: 'answer', label: 'answer' },
      ],
      [
        ['high', 'maybe duplicate'],
        ['aged down', 'maybe absent'],
        ['zeros exist', 'definitely new'],
        ['refreshed', 'kept alive'],
      ],
    ),
    highlight: { found: ['recent:answer', 'hot:answer'], compare: ['old:answer'] },
    explanation: 'Stable filters are useful when recency matters more than all-time history: web crawl deduplication windows, telemetry streams, approximate replay suppression, and cache-admission hints.',
  };

  yield {
    state: stableFlow('The right filter depends on the contract'),
    highlight: { active: ['query', 'stable'], compare: ['age'], found: ['insert'] },
    explanation: 'If false negatives are unacceptable, use a normal or counting Bloom filter with rebuilds as needed. If the stream is unbounded and old history may be forgotten, a stable filter is a better fit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'insert and delete') yield* insertAndDelete();
  else if (view === 'stable stream') yield* stableStream();
  else throw new InputError('Pick a counting-bloom-filter view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The first, "insert and delete," shows a counter array where each insert increments k counters and each delete decrements them. Watch what happens when two keys share a counter position: the counter rises to 2 on overlapping inserts, and only drops to 1 when one key is removed. The second key\'s evidence survives because the counter is still nonzero.',
        'The second view, "stable stream," demonstrates a counting Bloom filter that deliberately forgets old evidence. Before each new insertion, the filter randomly decrements a few counters across the array. Over time, this aging process causes old keys to lose their footprint and eventually query as absent. The filter reaches a steady-state fill level where insertions and decrements balance.',
        'In both views, green highlights mark counters being incremented, red marks decrements, and blue marks counter positions being checked during a query. A query returns "maybe present" when all k checked counters are nonzero, and "definitely absent" when any checked counter reads zero.',
        'Pay attention to the counter values, not just the colors. The difference between a 1 and a 2 in a shared cell is the entire reason this data structure exists. That difference is what makes deletion safe.',
        {type: 'image', src: './assets/gifs/counting-bloom-filter.gif', alt: 'Animated walkthrough of the counting bloom filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Bloom filter is a compact array of bits that answers membership queries. To insert a key, you hash it with k independent hash functions to get k positions, then set those bits to 1. To query, you check the same k positions: if all are 1, the key is "probably present." If any bit is 0, the key is definitely absent. The structure never stores the key itself, just evidence that something hashed to those positions. This makes it small but approximate: false positives are possible because different keys can set the same bits.',
        {
          type: 'callout',
          text: 'Counting Bloom filters keep the Bloom filter maybe answer while adding enough shared evidence accounting to delete safely.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png',
          alt: 'Bloom filter bit array with several keys mapped by hash arrows',
          caption: 'Bloom filter hash footprint diagram. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png',
        },
        'The problem is deletion. Suppose keys A and B both hash to position 4. The bit at position 4 is 1. Now you want to remove A from the set. If you clear position 4 to 0, you have destroyed B\'s evidence at that position. The next query for B will find a 0 at position 4 and report "definitely absent" even though B was never removed. This is a false negative, and standard Bloom filters are supposed to never produce those.',
        'The counting Bloom filter, introduced by Fan, Cao, Almeida, and Broder in their 2000 paper on web caching, solves this by replacing each bit with a small integer counter. Insert increments the k counters. Delete decrements them. A counter at 2 means two currently-inserted keys contribute evidence to that cell. Removing one drops it to 1, not to 0, so the other key\'s evidence survives. The query rule stays the same: all k counters nonzero means "maybe present," any zero means "definitely absent."',
        'This sounds simple, but the consequences are deep. The structure is no longer monotone. Bits in a standard Bloom filter only go from 0 to 1, never back. Counters go up and down, which means new failure modes appear: counter overflow, counter underflow from mismatched deletes, and race conditions under concurrent updates. The counting Bloom filter trades the simplicity of a write-once structure for the power of mutable membership.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first idea people try is clearing bits directly. You inserted A, which set positions 2, 5, and 7. Now you want to remove A, so you clear positions 2, 5, and 7 back to 0. This is fast and uses no extra memory. But it is wrong whenever any other key shares a position with A. If B also hashes to position 5, clearing it destroys B\'s evidence. The filter now reports B as absent even though B was never removed.',
        'The second idea is rebuilding. Keep the original set in a separate data structure, remove the key from it, then reconstruct the entire Bloom filter from scratch. This is correct because the rebuilt filter reflects exactly the current set membership. But it costs O(n * k) time per rebuild, where n is the number of elements. If your set has a million keys and three hash functions, every single delete requires three million hash-and-set operations. For workloads with frequent deletes, this is impractical.',
        'The third idea is versioning: maintain two Bloom filters, one for "currently present" and one for "deleted." Query checks both: if the key is in the present filter and not in the deleted filter, report present. This avoids the bit-clearing problem but doubles memory and introduces a new complication. The deleted filter itself cannot support deletion, so you need to rebuild it periodically, which brings back the rebuild cost.',
        'The counting Bloom filter is the direct solution. Replace each 1-bit cell with a c-bit counter, typically 4 bits. Insert increments, delete decrements, query checks for nonzero. No rebuild required. No auxiliary structures. The cost is 4x the memory of a standard Bloom filter, which is real but often acceptable given that Bloom filters are already compact.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the bit-sharing problem, and it is fundamental, not incidental. A Bloom filter works precisely because it compresses the evidence for many keys into a shared bit array. That compression is what makes it small. But sharing is exactly what prevents safe deletion: you cannot tell, from a 1-bit, how many keys contributed to it.',
        'You might think you could track which keys map to which positions. But that would require storing the keys or their hashes, which defeats the purpose. A Bloom filter\'s space advantage comes from not storing per-key information. The moment you record "key A contributed to positions 2, 5, 7," you are spending memory proportional to the number of keys, which is what you were trying to avoid.',
        'The wall also has a probabilistic face. As the filter fills up, more positions are shared. With m = 1000 cells, k = 3 hash functions, and n = 200 keys, the expected number of positions hit is 200 * 3 = 600 (with collisions). The probability that a randomly chosen position has been set is approximately 1 - (1 - 1/1000)^600, which is about 0.45. Nearly half the cells are occupied, and many of those are shared by multiple keys. Deletion by bit-clearing would corrupt evidence for roughly 45% of cells.',
        'The counting Bloom filter breaks through this wall by adding just enough per-cell information, a count, to track shared occupancy without tracking individual keys. The counter tells you "three keys contribute here" without telling you which three. That is sufficient for safe deletion: decrementing from 3 to 2 preserves the evidence for the remaining two keys.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A bit is a claim: "at least one key hashes here." A counter is a stronger claim: "exactly this many currently-inserted keys hash here." That extra information is precisely what you need to reverse an insertion without damaging other keys\' evidence.',
        'Think of it as reference counting for hash positions. When you insert key A, you increment the reference count at each of A\'s k positions. When you remove A, you decrement them. As long as the reference count is accurate, the counter at position p reflects the true number of currently-inserted keys that hash to p. Decrementing one key\'s contribution leaves the others intact.',
        'The insight is that you do not need to know which keys contribute to a cell. You only need to know how many. That is a crucial distinction. Storing "which" costs O(n) memory. Storing "how many" costs O(log max_count) bits per cell, typically 4 bits. The counter is a lossy summary of occupancy, but it is exactly the right lossy summary for supporting deletion.',
        'This insight also reveals the failure boundary. If the count is wrong, deletion breaks. A counter can be wrong because of overflow (the count exceeds the counter width and wraps or saturates), underflow (deleting a key that was never inserted drives the counter negative), or concurrency (two threads increment and decrement without synchronization). Every deployment of a counting Bloom filter must reason about these three threats.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an array of m counters, each initialized to 0 and typically stored in 4 bits (values 0 through 15). Choose k independent hash functions h_1 through h_k, each mapping a key to a position in the range 0 to m-1. These are the same hash functions you would use in a standard Bloom filter; only the storage per cell changes.',
        'Insert(x): compute h_1(x), h_2(x), ..., h_k(x). Increment the counter at each of those k positions. If key "cat" hashes to positions 3, 7, and 12 with k=3, then counter[3]++, counter[7]++, counter[12]++. If counter[7] was already 2 from previous insertions, it becomes 3. No information about "cat" specifically is stored; only the aggregate counts change.',
        'Query(x): compute the same k positions. If every counter at those positions is at least 1, return "maybe present." If any counter is 0, return "definitely absent." The logic is identical to a standard Bloom filter, except you compare against 0 instead of checking a bit. The false positive rate is the same as the underlying Bloom filter because the query condition is equivalent: a nonzero counter means the same thing as a set bit.',
        'Delete(x): compute the same k positions. Decrement the counter at each position. This is safe only if x was previously inserted. If counter[7] is 3 and you delete "cat," it drops to 2. The other two keys that hash to position 7 still keep it nonzero. Their query results are unaffected.',
        'The stable Bloom filter variant adapts this for unbounded streams. Before each new insertion, it picks P random counter positions and decrements each by 1 (flooring at 0). Then it inserts the new key normally. The random decrements gradually erase old evidence, creating a sliding-window effect. The filter reaches equilibrium: the rate of counter creation from insertions matches the rate of counter erosion from aging. Old keys eventually lose all their counter evidence and query as absent.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness of insert and query follows directly from the Bloom filter argument. If x was inserted, all k of its counter positions were incremented to at least 1. Since counters never go below 0 on their own, those positions remain nonzero as long as no invalid deletion occurs. So query(x) returns "maybe present," which is correct. If x was not inserted but all k positions happen to be nonzero because of other keys, query(x) also returns "maybe present." That is a false positive, same as in a standard Bloom filter.',
        'Correctness of deletion relies on matched insert/delete pairs. Suppose x was inserted, so its k counters were incremented. Deleting x decrements those same k counters. If no other key shares position p with x, counter[p] goes from 1 to 0. If another key y also hashes to p, counter[p] goes from 2 to 1. In both cases, the counter accurately reflects the remaining occupancy. Key y\'s query still finds counter[p] >= 1, so y is not affected.',
        'The formal invariant is: counter[p] equals the number of currently-inserted keys whose hash functions include position p. As long as every delete corresponds to a prior insert, and no counter overflows its width, this invariant holds after every operation. If the invariant holds, then query produces no false negatives: any currently-inserted key has all its counters at >= 1.',
        'Stable Bloom filters break this invariant on purpose. The random decrements can reduce a counter below the true occupancy count, causing a key to lose evidence at one of its positions. That key then queries as absent, which is a false negative. The tradeoff is deliberate: by forgetting old keys, the filter maintains bounded memory over an infinite stream. The false negative rate is a tunable function of the aging rate P and the filter size m.',
        'The false positive behavior remains unchanged from standard Bloom filters. The probability that a non-member queries as present depends on the fraction of nonzero counters, which depends on the load factor n/m and the number of hash functions k. The optimal k that minimizes false positives is still (m/n) * ln(2), the same as for bit-based Bloom filters.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Time: insert, delete, and query each compute k hash values and access k counter positions. That is O(k) per operation. With k typically between 3 and 10, each operation touches a handful of cells. Hash computation dominates in practice; a 128-bit MurmurHash3 can generate all k positions via double hashing (h1 + i*h2 mod m for i = 0..k-1), so even k=10 requires only two base hashes.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png',
          alt: 'Bloom filter false positive probability curves for different filter sizes',
          caption: 'False positive probability as Bloom filter load changes. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png',
        },
        'Space: a standard Bloom filter uses 1 bit per cell. A counting Bloom filter with 4-bit counters uses 4 bits per cell, so it needs 4x the memory for the same m. For a filter sized to hold 1 million elements with a 1% false positive rate, the standard Bloom filter needs about 9.6 million bits (1.2 MB). The counting version needs about 4.8 MB. That is larger but still far smaller than storing the million keys themselves, which might be 50-100 MB of strings.',
        'Counter overflow risk: with 4-bit counters (max value 15), a cell overflows if more than 15 keys hash to the same position. With m = 10 million cells and n = 1 million keys, the expected count at a given cell is n*k/m. For k = 7, that is 0.7 on average. The probability that any single cell exceeds 15 is astronomically small, roughly Poisson(0.7) evaluated at 16+, which is below 10^-15. In practice, 4-bit counters are safe for all but the most extreme load factors.',
        'Stable Bloom filters add O(P) aging work per insertion, where P is the number of random decrements. Deng and Rafiei showed that P = 2 suffices for many practical stream deduplication scenarios with false positive rates under 5%. The total per-insert cost becomes O(k + P), which is O(k) since P is a small constant.',
        'The counting Bloom filter does not support resizing. If you need to change m, you must rebuild the filter from the original keys. This is the same limitation as standard Bloom filters. Scalable Bloom filters (Almeida et al., 2007) address this by chaining multiple filters of increasing size, and that approach can be combined with counting.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The original motivation was web caching. Fan, Cao, Almeida, and Broder introduced counting Bloom filters in their 2000 paper "Summary Cache" to solve a specific problem: a cluster of web proxies needs to know which proxy holds which cached page. Each proxy maintains a counting Bloom filter summarizing its cache contents. When a page is evicted from cache, the proxy deletes it from its filter. Periodically, each proxy broadcasts a standard (bit) Bloom filter derived from its counters. Other proxies use these summaries to route requests to the right cache.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Bloom_filter_speed.svg/500px-Bloom_filter_speed.svg.png',
          alt: 'Bloom filter in front of slower storage with false positive and fast negative paths',
          caption: 'Bloom filter as a fast guard before slow storage. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Bloom_filter_speed.svg/500px-Bloom_filter_speed.svg.png',
        },
        'Network packet forwarding uses counting Bloom filters in software-defined networking. A forwarding table summarized as a counting filter can be updated incrementally as routes change, without rebuilding the entire filter. The false positive rate maps directly to a small rate of misdirected packets, which the network stack already handles via TTL and error correction.',
        'Stream deduplication is the primary use case for stable Bloom filters. A log ingestion pipeline receiving millions of events per second needs to suppress duplicates. Exact deduplication requires storing every seen event ID, which grows without bound. A stable Bloom filter maintains a fixed-size probabilistic window: recent event IDs are recognized as duplicates with high probability, while very old IDs are forgotten and would be accepted again if resent. For most log systems, re-accepting a months-old duplicate is harmless.',
        'Distributed databases use counting Bloom filters for anti-entropy protocols. When two nodes reconcile their data, each sends a counting filter summarizing its key set. The receiving node queries its own keys against the remote filter to identify keys the remote side is missing. Because the filters support deletion, they stay current as keys are added and removed without periodic full rebuilds.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Deleting a key that was never inserted is the most dangerous failure. Suppose key "dog" was never inserted, but you call delete("dog") anyway. The filter decrements the k counters at dog\'s hash positions. If key "cat" shares position 7 with "dog," and counter[7] was 1 (contributed solely by "cat"), it drops to 0. Now querying "cat" finds a 0 at position 7 and reports "definitely absent," even though "cat" is still in the set. This is a false negative, and there is no way to detect or recover from it using the filter alone.',
        'Counter overflow is rare but catastrophic in theory. If a 4-bit counter at position p reaches 15 and another key hashes to p, the counter either wraps to 0 (creating mass false negatives) or saturates at 15 (preventing future decrements from being accurate). Saturation is the safer failure mode: the counter stays at 15 and effectively becomes a permanent 1-bit, losing delete capability at that position. Most implementations use saturation, which converts local cells back to non-deletable Bloom filter behavior.',
        'Concurrency without synchronization corrupts counts. Thread A reads counter[5] = 3 and prepares to write 4. Thread B reads counter[5] = 3 and prepares to write 2. If A writes first and B overwrites, the counter is 2 instead of the correct 4. This lost update means the count no longer reflects reality, and future deletes may undercount. Production systems protect counters with atomic increment/decrement operations (e.g., compare-and-swap) or partition the filter by thread.',
        'Stable Bloom filters fail differently: they produce false negatives by design. Any system that treats a stable filter query as a definitive membership answer will eventually act on a false negative. The failure is not a bug but a misuse. Stable filters are deduplication hints, not authoritative membership records.',
        'Space overhead can be a failure in itself. A system that needs 100 million cells at 4 bits each consumes 50 MB, compared to 12.5 MB for a standard Bloom filter with the same m. If the workload rarely deletes, that 4x overhead buys almost nothing. In memory-constrained environments like embedded devices or network ASICs, the extra space can push the filter off the fast path entirely.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Set up a counting Bloom filter with m = 8 counter cells (indexed 0 through 7), each 4 bits wide, and k = 3 hash functions. All counters start at 0: [0, 0, 0, 0, 0, 0, 0, 0].',
        'Insert "apple": h1("apple") = 1, h2("apple") = 3, h3("apple") = 6. Increment those positions. Counters become [0, 1, 0, 1, 0, 0, 1, 0]. Insert "banana": h1("banana") = 3, h2("banana") = 5, h3("banana") = 7. Increment those positions. Counters become [0, 1, 0, 2, 0, 1, 1, 1]. Notice position 3 is now 2 because both "apple" and "banana" hash there.',
        'Query "apple": check positions 1, 3, 6. Values are 1, 2, 1. All nonzero, so the answer is "maybe present." Query "cherry": suppose h1("cherry") = 0, h2("cherry") = 3, h3("cherry") = 5. Values are 0, 2, 1. Position 0 is zero, so the answer is "definitely absent." Query "grape": suppose h1("grape") = 1, h2("grape") = 5, h3("grape") = 7. Values are 1, 1, 1. All nonzero, so the answer is "maybe present," even though "grape" was never inserted. This is a false positive: "grape" happens to hash to positions that other keys have already incremented.',
        'Delete "apple": decrement positions 1, 3, 6. Counters become [0, 0, 0, 1, 0, 1, 0, 1]. Position 3 drops from 2 to 1, not to 0, because "banana" still contributes to that cell. Query "banana": check positions 3, 5, 7. Values are 1, 1, 1. All nonzero. Banana\'s evidence is intact despite apple\'s deletion. This is the payoff: the counter at position 3 correctly tracked that two keys shared it, so removing one left the other\'s evidence untouched.',
        'Now the dangerous case. Delete "melon," which was never inserted: suppose h1("melon") = 5, h2("melon") = 7, h3("melon") = 0. Decrement those positions. Counters become [0, 0, 0, 1, 0, 0, 0, 0]. Positions 5 and 7 drop from 1 to 0. Query "banana": check positions 3, 5, 7. Values are 1, 0, 0. Position 5 is zero, so the answer is "definitely absent." But "banana" was never deleted. The invalid delete of "melon" destroyed banana\'s evidence at positions 5 and 7. This is a false negative, the kind of bug that is invisible from inside the filter and can only be prevented by ensuring every delete corresponds to a real prior insert.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original counting Bloom filter paper is Fan, Cao, Almeida, and Broder, "Summary Cache: A Scalable Wide-Area Web Cache Sharing Protocol," IEEE/ACM Transactions on Networking, 2000. The stable Bloom filter was introduced by Deng and Rafiei, "Approximately Detecting Duplicates for Streaming Data using Stable Bloom Filters," SIGMOD 2006, available at https://webdocs.cs.ualberta.ca/~drafiei/papers/DupDet06Sigmod.pdf.',
        'For improved counting constructions, see Bonomi, Mitzenmacher, Panigrahy, Singh, and Varghese, "An Improved Construction for Counting Bloom Filters," ESA 2006, at https://www.eecs.harvard.edu/~michaelm/postscripts/esa2006b.pdf. For the broader landscape of approximate membership structures, Broder and Mitzenmacher\'s survey "Network Applications of Bloom Filters" at https://www.eecs.harvard.edu/~michaelm/NEWWORK/postscripts/BloomFilterSurvey.pdf covers the fundamentals and many variants.',
        'Cuckoo filters (Fan, Andersen, Kaminsky, Mitzenmacher, 2014) offer deletion support with better space efficiency than counting Bloom filters for many workloads. Their paper is at https://www.cs.cmu.edu/~dga/papers/cuckoo-conext2014.pdf. Quotient filters provide another deletion-capable alternative with better cache locality.',
        'Study the standard Bloom filter first if you have not already, since the counting variant assumes you understand false positives, optimal hash count, and the bit-sharing mechanism. Then explore cuckoo filters, quotient filters, Count-Min Sketch (which uses a similar counter array but answers frequency queries instead of membership), and heavy hitter algorithms that build on count-based sketches.',
      ],
    },
  ],
};
