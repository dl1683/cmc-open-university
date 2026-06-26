// Bucket sort: distribute elements into buckets by value range, sort each
// bucket with insertion sort, then concatenate. O(n) expected time when
// input is uniformly distributed.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'bucket-sort',
  title: 'Bucket Sort',
  category: 'Sorting',
  summary: 'Distribute elements into range-based buckets, sort each bucket, and concatenate — O(n) expected time for uniform input.',
  controls: [
    { id: 'values', label: 'Values (0–99)', type: 'number-list', defaultValue: '78, 17, 39, 26, 72, 94, 21, 12, 23, 68' },
  ],
  run,
};

function insertionSort(arr) {
  for (let i = 1; i < arr.length; i += 1) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j -= 1;
    }
    arr[j + 1] = key;
  }
}

export function* run(input) {
  const values = parseNumberList(input.values, { max: 12 });
  const n = values.length;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal;
  const bucketCount = n;
  const buckets = Array.from({ length: bucketCount }, () => []);

  // --- Phase 0: Show input ---
  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Input: ${n} values in [${minVal}, ${maxVal}]. Bucket sort will create ${bucketCount} buckets covering this range, distribute each element into its bucket, sort each bucket with insertion sort, then concatenate.`,
  };

  // --- Phase 1: Distribute into buckets ---
  yield {
    state: arrayState(values),
    highlight: {},
    explanation: `Create ${bucketCount} empty buckets, each covering a sub-range of width ${range === 0 ? 1 : (range / bucketCount).toFixed(2)}. For each element x, its bucket index is floor(${bucketCount} * (x - ${minVal}) / ${range === 0 ? 1 : range + 1}). This maps the value range evenly across all buckets.`,
  };

  for (let i = 0; i < n; i += 1) {
    const v = values[i];
    const bi = range === 0 ? 0 : Math.min(Math.floor(bucketCount * (v - minVal) / (range + 1)), bucketCount - 1);
    buckets[bi].push(v);

    // Show bucket contents as a flat array with separators
    const flat = buckets.flatMap((b) => b);
    yield {
      state: arrayState(flat),
      highlight: { active: [`i${flat.length - 1}`] },
      explanation: `Element ${v}: bucket index = floor(${bucketCount} * (${v} - ${minVal}) / ${range + 1}) = ${bi}. Bucket ${bi} now holds [${buckets[bi].join(', ')}]. If input is uniform, each bucket gets about 1 element on average.`,
    };
  }

  // Show distribution summary
  const nonEmpty = buckets.filter((b) => b.length > 0).length;
  const maxBucket = Math.max(...buckets.map((b) => b.length));
  const flat = buckets.flatMap((b) => b);
  yield {
    state: arrayState(flat),
    highlight: {},
    explanation: `Distribution complete. ${nonEmpty} of ${bucketCount} buckets are non-empty. Largest bucket has ${maxBucket} element${maxBucket === 1 ? '' : 's'}. ${maxBucket <= 2 ? 'Good spread — insertion sort on 1–2 elements is O(1).' : maxBucket <= 3 ? 'Reasonable spread — insertion sort on small buckets is cheap.' : 'Some clustering — insertion sort cost grows quadratically within large buckets.'}`,
  };

  // --- Phase 2: Sort each bucket ---
  for (let bi = 0; bi < bucketCount; bi += 1) {
    if (buckets[bi].length <= 1) continue;

    const before = [...buckets[bi]];
    insertionSort(buckets[bi]);

    const flat2 = buckets.flatMap((b) => b);
    yield {
      state: arrayState(flat2),
      highlight: { swap: buckets[bi].map((_, j) => {
        // Find the global offset of this bucket
        let offset = 0;
        for (let k = 0; k < bi; k += 1) offset += buckets[k].length;
        return `i${offset + j}`;
      }) },
      explanation: `Sort bucket ${bi}: [${before.join(', ')}] → [${buckets[bi].join(', ')}]. Insertion sort on ${buckets[bi].length} elements: ${buckets[bi].length <= 2 ? 'at most 1 comparison.' : `at most ${buckets[bi].length * (buckets[bi].length - 1) / 2} comparisons.`} With uniform input, buckets stay small so this is O(1) expected work per bucket.`,
    };
  }

  // --- Phase 3: Concatenate ---
  const sorted = buckets.flatMap((b) => b);
  yield {
    state: arrayState(sorted),
    highlight: { sorted: sorted.map((_, i) => `i${i}`) },
    explanation: `Concatenate all buckets in order: [${sorted.join(', ')}]. Each bucket covers a higher sub-range than the previous one, so concatenation produces sorted output. Total: ${n} distributions + per-bucket insertion sorts + one concatenation. For uniform input, expected time is O(n).`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation runs in three phases. In Phase 1, each value is assigned a bucket index by dividing the value range evenly across n buckets. Watch each element drop into its bucket and notice that the index is computed purely from arithmetic on the value -- no comparisons against other elements.',
        {type: 'image', src: './assets/gifs/bucket-sort.gif', alt: 'Animated walkthrough of the bucket sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In Phase 2, each non-trivial bucket is sorted with insertion sort. Highlighted cells show which bucket is being processed. When input is uniform, most buckets hold one or two elements, so these sorts finish in a single comparison or none at all.',
        'Phase 3 concatenates every bucket left to right into the final array. Because bucket 0 covers the lowest sub-range and bucket n-1 covers the highest, walking them in order produces a fully sorted sequence. The green highlight at the end confirms correctness.',
        'The pattern to watch for: even spread across buckets means tiny local sorts and fast completion. Clustering into a few buckets means those buckets grow large, and insertion sort inside them gets visibly expensive.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Comparison-based sorting has a proven floor of O(n log n). The argument is information-theoretic: n elements can appear in n! distinct orderings, each comparison eliminates at most half the remaining possibilities, so any comparison tree must have at least log2(n!) leaves. For one million elements, that floor is roughly 20 million comparisons -- no comparison sort can avoid it.',
        'Bucket sort sidesteps this floor entirely when the input distribution is known. If values are uniformly spread over a range, distributing them into n equal-width buckets places roughly one element per bucket on average. Sorting a one-element bucket costs zero comparisons. Concatenating n buckets costs O(n) copies. The total expected work is O(n) -- linear, below the comparison-sort floor.',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:NcxNCsIwEEDhfU4xFyioBxBM2oqgm3YZZjGN4w-GpMSJ0tsLqVk9-Bbv5uPXPSgJnAd1sKcwZ4EP-cxvhKbZg7YXmmFaIFG4Mypd1Fid3YsFNlXaKtsqXZUdKlOkt2NMAj468n5B1a6qun_70qM1MTgSDiQMzwDTuonpygl_',
          alt: 'Flow from input values to range buckets, local sorting, and concatenation.',
          caption: 'Bucket sort replaces one global comparison problem with range buckets, local sorts, and ordered concatenation. Source: https://mermaid.ink/svg/pako:NcxNCsIwEEDhfU4xFyioBxBM2oqgm3YZZjGN4w-GpMSJ0tsLqVk9-Bbv5uPXPSgJnAd1sKcwZ4EP-cxvhKbZg7YXmmFaIFG4Mypd1Fid3YsFNlXaKtsqXZUdKlOkt2NMAj468n5B1a6qun_70qM1MTgSDiQMzwDTuonpygl_',
        },
        'The price: this linear speed depends on the input obeying the distribution assumption. Uniform or near-uniform data gets O(n). Badly skewed data can degrade all the way to O(n^2). Bucket sort trades generality for speed on the specific inputs where it fits.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use a comparison sort. Merge sort guarantees O(n log n) worst-case, quicksort averages O(n log n) with small constants, and both work on any comparable data without knowing anything about the value distribution. They are general-purpose and well-understood.',
        'For integer keys in a small range, counting sort achieves O(n + k) by using each value directly as an array index. But counting sort requires the value range k to be small relative to n. Sorting a million floats in [0, 1) with counting sort would mean either quantizing to integers (losing precision) or allocating an impractically large count array.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Comparison sorts treat every input distribution identically: they learn order only by asking "is a < b?" and need O(n log n) such questions no matter what. If you happen to know the values are uniformly distributed over [0, 1), every comparison is answering a question whose answer is nearly predictable from the values alone. The comparison model cannot exploit that prior knowledge.',
        'Counting sort does exploit structure, but the wrong kind: it needs integer keys in a bounded range. For continuous data -- floats, real-valued measurements, normalized scores -- there is no finite set of slots to count into. Counting sort simply does not apply.',
        'So you are stuck: comparison sorts ignore distributional knowledge, and counting sort demands discrete keys. There is no standard tool that handles continuous data with a known distribution faster than O(n log n).',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'callout',
          text: 'Bucket sort is fast only when the bucket map turns global ordering into many tiny local sorts.',
        },
        'If you know the value range and the distribution is roughly uniform, you can replace sorting with partitioning. Divide the range into n equal-width intervals (buckets). Each element lands in exactly one bucket via a single arithmetic operation -- no comparison needed. Because the buckets are ordered by range, the global ordering problem decomposes into n independent local ordering problems.',
        'The key realization: with uniform input, each bucket receives about one element on average. Sorting a bucket of size 1 or 2 is O(1) work. The total work across all n buckets is O(n), not O(n log n). You have converted a global O(n log n) comparison problem into n independent O(1) problems, plus O(n) overhead for the distribution and concatenation passes.',
        'This only works because the bucket map preserves order. Every element in bucket i has a value strictly less than every element in bucket i+1. So after sorting within each bucket, you can concatenate the buckets in order and the result is globally sorted. The arithmetic distribution function acts as a coarse-grained sort that gets most of the ordering right, and insertion sort fixes up the fine-grained order within each bucket.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1 -- Create buckets. Allocate n empty lists (called buckets), each responsible for a sub-range of width (max - min + 1) / n. For the classic textbook formulation with values in [0, 1), bucket i holds values in the interval [i/n, (i+1)/n). For a general range [a, b], normalize each value x to (x - a) / (b - a + 1) first.',
        'Step 2 -- Distribute. For each element x, compute its bucket index as floor(n * (x - min) / (max - min + 1)). Append x to the end of that bucket\'s list. This takes O(1) per element, O(n) total. No comparisons occur -- just one subtraction, one multiplication, and one floor operation per element.',
        'Step 3 -- Sort each bucket. Run insertion sort on each bucket individually. Insertion sort compares adjacent elements and shifts them into position. For a bucket of size m, this costs O(m^2) comparisons in the worst case. But if input is uniform, the expected bucket size is about 1, so each bucket sort is O(1) expected work. The total expected cost across all n buckets is O(n).',
        'Step 4 -- Concatenate. Walk the buckets from index 0 to n-1, appending each bucket\'s sorted contents to the output array. Because bucket i covers a strictly lower range than bucket i+1, concatenation produces a fully sorted result. Cost: O(n) copies.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on a simple invariant: the buckets partition the value range into disjoint, ordered intervals. Every element in bucket i has a value less than every element in bucket j for i < j. After sorting within each bucket, concatenating them in order produces a globally sorted sequence. No element can be out of place because its bucket assignment already determined its coarse position.',
        'The expected O(n) runtime follows from a probability argument. Suppose n elements are drawn independently and uniformly from [0, 1). The count of elements in bucket i follows a Binomial(n, 1/n) distribution. Its expected value is 1, and its variance is (1 - 1/n), which is less than 1. Insertion sort on a bucket of size m costs proportional to m^2. The expected total cost is the sum of E[m_i^2] for all n buckets. Since E[m_i^2] = Var(m_i) + (E[m_i])^2 = (1 - 1/n) + 1 = 2 - 1/n, the total is n * (2 - 1/n) = 2n - 1. That is O(n).',
        'The uniformity assumption carries all the weight. It guarantees that no single bucket accumulates a disproportionate share of elements. If the distribution is skewed -- say half the elements land in one bucket -- that bucket alone costs O((n/2)^2) = O(n^2/4) for insertion sort, and the linear guarantee collapses.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected time: O(n) for uniformly distributed input. The distribution pass is O(n), the per-bucket insertion sorts total O(n) in expectation (about 2n - 1 operations as derived above), and concatenation is O(n). Doubling the input size doubles the expected work.',
        'Worst-case time: O(n^2). This happens when all elements land in a single bucket -- for example, n copies of the same value, or a distribution crammed into one narrow interval. Insertion sort on that one bucket performs n*(n-1)/2 comparisons.',
        'Space: O(n + k) where k is the number of buckets (typically k = n). The bucket lists collectively hold all n elements, and there are k list headers. This is not an in-place sort; it requires auxiliary storage proportional to the input.',
        'Stability: bucket sort preserves the relative order of equal elements if two conditions hold: elements are appended to their bucket in input order, and the per-bucket sort is stable. Insertion sort (shifting, not swapping) is stable, so the standard implementation is stable overall.',
        'Concrete comparison: for 1,000,000 uniformly distributed floats, bucket sort performs roughly 2,000,000 operations. Merge sort on the same input needs about 20,000,000 comparisons plus 20,000,000 data moves. That is a real 10-20x gap -- but it evaporates the moment the uniformity assumption breaks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Uniformly distributed floating-point data appears more often than you might expect. Sensor readings sampled at regular intervals, random number generator outputs, Monte Carlo simulation results, and hash values all tend toward uniform distributions over a known range. Bucket sort handles these in linear expected time without quantizing to integers.',
        'Histogram construction is the distribution step of bucket sort without the per-bucket sorting or concatenation. Histogram equalization in image processing, percentile computation in statistics, and kernel density estimation all use the same scatter-into-ranges pattern.',
        'External sorting on disk uses the same idea at a larger scale. When a dataset exceeds memory, you distribute records into range-based files (buckets on disk), sort each file independently, and merge. The bucket boundaries are chosen from a sample of the data to keep file sizes balanced.',
        'Radix sort on floating-point numbers sometimes uses bucket sort as an outer layer. IEEE 754 floats can be radix-sorted by reinterpreting their bit pattern as an integer (with a sign-bit transformation). Bucket sort partitions by exponent range, and radix sort finishes each partition.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Skewed distributions destroy the guarantee. If 90% of values fall into 10% of the range -- exponential distributions, Zipf-distributed data, datasets with extreme outliers -- a few buckets absorb most of the elements. Insertion sort on a bucket of size m costs O(m^2), so the total degrades from O(n) toward O(n^2).',
        {
          type: 'image',
          src: 'https://mermaid.ink/svg/pako:TcxBCsIwEADAe16xH-gXBKP1pIhYT0sOMdliSM2W7YbY3wvFg-eBGSdu4eVFYbBmj4-SRpY3pDJXddB1O7B48WUFTWWFZw2ZdHHGbnTAcyrkBegzU1CK0FiyM0e8Z2oU_5ser4UgCLdI8Rc50292wlv1UbymABMHP8HCou4L',
          alt: 'Contrast between uniform input producing many tiny buckets and skewed input producing one crowded bucket.',
          caption: 'Uniform data keeps bucket-local work small; skew concentrates work into one expensive local sort. Source: https://mermaid.ink/svg/pako:TcxBCsIwEADAe16xH-gXBKP1pIhYT0sOMdliSM2W7YbY3wvFg-eBGSdu4eVFYbBmj4-SRpY3pDJXddB1O7B48WUFTWWFZw2ZdHHGbnTAcyrkBegzU1CK0FiyM0e8Z2oU_5ser4UgCLdI8Rc50292wlv1UbymABMHP8HCou4L',
        },
        'Unknown range is a minor obstacle. Bucket sort needs the minimum and maximum values to compute bucket boundaries. If the range is unknown, a preliminary O(n) scan finds it, adding one extra pass. This is cheap but means bucket sort cannot process a stream of unknown-range data in a single pass.',
        'Integer keys in a small range are better served by counting sort. Counting sort places elements directly by value with no per-bucket sorting step. It is simpler, faster, and uses less code. Bucket sort is the right tool only when keys are continuous (floats) or the integer range is too large for a count array.',
        'Memory cost is O(n + k). The bucket lists and their contents require auxiliary space proportional to the input. Heap sort achieves O(n log n) in O(1) extra space. In memory-constrained environments, a comparison sort that works in-place is the better choice.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]. Ten values in [0, 1), so we create ten buckets. Each bucket covers an interval of width 0.1: bucket 0 covers [0.0, 0.1), bucket 1 covers [0.1, 0.2), and so on up to bucket 9 covering [0.9, 1.0).',
        'Bucket assignment uses index = floor(10 * x). Walk through: 0.78 -> floor(7.8) = 7, 0.17 -> floor(1.7) = 1, 0.39 -> floor(3.9) = 3, 0.26 -> floor(2.6) = 2, 0.72 -> floor(7.2) = 7, 0.94 -> floor(9.4) = 9, 0.21 -> floor(2.1) = 2, 0.12 -> floor(1.2) = 1, 0.23 -> floor(2.3) = 2, 0.68 -> floor(6.8) = 6. That is 10 arithmetic operations, zero comparisons.',
        'Bucket contents after distribution: bucket 0 is empty, bucket 1 holds [0.17, 0.12], bucket 2 holds [0.26, 0.21, 0.23], bucket 3 holds [0.39], buckets 4-5 are empty, bucket 6 holds [0.68], bucket 7 holds [0.78, 0.72], bucket 8 is empty, bucket 9 holds [0.94]. Six of ten buckets are non-empty; the largest (bucket 2) has 3 elements.',
        'Per-bucket insertion sort: Bucket 1 [0.17, 0.12] -- compare 0.12 < 0.17, shift, result [0.12, 0.17], 1 comparison. Bucket 2 [0.26, 0.21, 0.23] -- insert 0.21 before 0.26 (1 comparison), then insert 0.23 after 0.21 and before 0.26 (2 comparisons), result [0.21, 0.23, 0.26], 3 comparisons total. Bucket 7 [0.78, 0.72] -- compare 0.72 < 0.78, shift, result [0.72, 0.78], 1 comparison. All other non-empty buckets have exactly 1 element and need no sorting.',
        'Concatenate buckets 0 through 9: [0.12, 0.17, 0.21, 0.23, 0.26, 0.39, 0.68, 0.72, 0.78, 0.94]. Total work: 10 bucket assignments + 5 insertion-sort comparisons + 10 concatenation copies = 25 operations. Merge sort on the same 10 elements would need about 23 comparisons plus 23 data moves -- roughly comparable at this scale.',
        'The payoff shows at scale. At n = 1,000,000 with uniform input, each bucket receives about 1 element on average, so total insertion-sort comparisons stay near n (roughly 1,000,000). Merge sort on the same input requires about 20,000,000 comparisons. That is a 20x gap -- the difference between O(n) and O(n log n) made concrete.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cormen, Leiserson, Rivest, and Stein present the expected-time analysis for uniform input in Introduction to Algorithms, Chapter 8. Knuth covers distribution sorting in The Art of Computer Programming, Volume 3, Section 5.2.5, with historical context on how the idea evolved from punched-card sorting machines.',
        'Prerequisites: study Insertion Sort first (the per-bucket sort -- understand why it is O(m^2) in general but O(1) when m is a small constant), then Counting Sort (the integer-key distribution sort that bucket sort generalizes to continuous keys).',
        'Extensions: Radix Sort processes individual digits rather than value ranges and uses counting sort as its stable sub-sort. External merge sort applies the distribute-and-sort strategy to data that exceeds memory, partitioning into files on disk rather than lists in memory.',
        'Alternatives for different situations: Counting Sort is faster and simpler when keys are integers in a small range. Merge Sort delivers stable O(n log n) regardless of distribution -- the safe default when you cannot assume uniformity. Quick Sort averages O(n log n) with small constants and often beats bucket sort in practice on non-uniform data.',
      ],
    },
  ],
};
