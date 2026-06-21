// Insertion sort: grow a sorted prefix by inserting each new value into
// its place — exactly how people sort a hand of playing cards.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'insertion-sort',
  title: 'Insertion Sort',
  category: 'Sorting',
  summary: 'Take each value and slide it left into its place in the sorted prefix.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '7, 2, 9, 4, 4, 1' },
  ],
  run,
};

const prefixIds = (count) => Array.from({ length: count }, (_, i) => `i${i}`);

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });

  yield {
    state: arrayState(values),
    highlight: { sorted: prefixIds(1) },
    explanation: 'Insertion sort is how you sort cards in your hand: everything to the left of your attention is already sorted, and each new card slides left until it fits. A one-element prefix is trivially sorted, so we start at position 1.',
  };

  for (let i = 1; i < values.length; i += 1) {
    const value = values[i];
    yield {
      state: arrayState(values),
      highlight: { active: [`i${i}`], sorted: prefixIds(i) },
      explanation: `Pick up ${value} (position ${i}). The prefix to its left is sorted — now slide ${value} leftward until the value before it is no bigger.`,
      invariant: `Positions 0–${i - 1} are sorted (relative to each other).`,
    };

    let j = i;
    while (j > 0 && values[j - 1] > value) {
      yield {
        state: arrayState(values),
        highlight: { compare: [`i${j - 1}`, `i${j}`], sorted: prefixIds(i) },
        explanation: `${values[j - 1]} is bigger than ${value}, so ${value} must go further left — shift ${values[j - 1]} one slot right to make room.`,
      };
      [values[j - 1], values[j]] = [values[j], values[j - 1]];
      j -= 1;
    }

    yield {
      state: arrayState(values),
      highlight: { found: [`i${j}`], sorted: prefixIds(i + 1) },
      explanation: j === i
        ? `${value} was already in place — no shifting needed. On nearly-sorted data this happens constantly, which is why insertion sort runs in almost O(n) there.`
        : `${value} settles into position ${j}. The sorted prefix now covers positions 0–${i}.`,
    };
  }

  yield {
    state: arrayState(values),
    highlight: { sorted: prefixIds(values.length) },
    explanation: `Sorted! Worst case is O(n²) (reversed input shifts everything every time), but on nearly-sorted data it is nearly O(n) — which is why real libraries use insertion sort to finish small or almost-sorted ranges inside quick sort and merge sort.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The array has an invisible wall between sorted and unsorted territory. Everything to the left of the wall is sorted relative to each other. Everything to the right has not been touched yet.',
        {type: 'callout', text: 'The sorted prefix is the invariant: every step preserves it while absorbing exactly one new value.'},
        'The active highlight marks the value being inserted. The compare highlights show it being tested against sorted-prefix values from right to left. Each comparison that finds a larger value triggers a shift: that larger value copies one slot right, opening a gap. When the walk stops, the found highlight marks where the active value lands.',
        'Watch the sorted prefix (marked in green) grow by one element each round. If the active value is already in place, no shifting happens and the prefix just extends. On nearly-sorted input most rounds look like that. On reversed input every round shifts the entire prefix.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Pick up a hand of playing cards. Each new card goes into the right spot among the cards you already hold. You do not re-sort the whole hand; you slide a few cards over and drop the new one in. Insertion sort turns that gesture into an array algorithm.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Insertion-sort-example-300px.gif', alt: 'Animated insertion sort moving each value into a sorted prefix', caption: 'The animation shows the sorted prefix growing while the active value shifts left into its slot. Source: Wikimedia Commons, insertion sort animation.'},
        'The idea is ancient, but Donald Shell formalized its importance in 1959 when he built Shellsort on top of it: run insertion sort with large gaps first, shrink the gaps, and finish with a standard insertion pass on a nearly-sorted array. That design works because insertion sort is fast when disorder is local.',
        'Among the quadratic sorts, insertion sort is the best choice for nearly-sorted data. Bubble sort always makes full passes. Selection sort always scans the entire unsorted region. Insertion sort does work proportional to how far values actually need to move, so it can finish in near-linear time when the input is almost ordered.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Take items one at a time and place each into its correct position. Start from the second element (a single element is trivially sorted). Compare it leftward through the already-sorted prefix, shift larger values right, and drop it into the gap.',
        'This is not a naive idea that needs replacing. It is exactly what insertion sort does. The algorithm is the obvious approach, refined into a clean loop with a precise invariant. The question is not "what is smarter?" but "where does the obvious approach hit a wall?"',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Each insertion may shift up to i elements, where i is the current index. On reverse-sorted input, every new value travels all the way to the front. The total shifts sum to 1 + 2 + 3 + ... + (n-1) = n(n-1)/2. That is O(n²) work.',
        'The wall is not the comparison count. Binary insertion sort can find the insertion point in O(log i) comparisons using binary search. But it still must shift O(i) elements to make room, because arrays store values in contiguous memory. Finding the position faster does not help when moving data is the bottleneck.',
        'Random input hits the wall too. On average, each element travels about halfway across the sorted prefix, giving n²/4 shifts. Doubling the array quadruples the work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Maintain a sorted prefix at the left end of the array. Initially it contains just element 0. For each index i from 1 to n-1: save the value at i (the key), walk left through the prefix comparing the key against each element, shift every element larger than the key one position right, and write the key into the gap that opens.',
        'The walk stops when it finds an element smaller than or equal to the key, or when it reaches the start of the array. The key then occupies the one position where it is greater than or equal to everything on its left and less than or equal to everything on its right within the prefix. The sorted prefix has grown by one.',
        'Using strict greater-than for the shift condition (shift when prefix value > key, stop when prefix value <= key) preserves stability. Equal values are never moved past each other, so records with the same key keep their original relative order.',
        'Binary insertion sort is a variant that uses binary search to locate the insertion point in O(log i) comparisons instead of O(i). The position is found faster, but the shifting step is unchanged: every element between the insertion point and position i still moves one slot right. Total comparisons drop to O(n log n), but total data movement stays O(n²). The variant helps when comparisons are expensive relative to moves.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is induction on the prefix length. Base case: a single element is sorted. Inductive step: assume positions 0 through i-1 are sorted. The algorithm saves the value at position i, shifts every prefix element greater than it one slot right (preserving their relative order), and writes the saved value into the gap.',
        'After the insert, every value to the left of the key is smaller or equal (the walk stopped there), and every value to the right of the key within the prefix is strictly greater (they were shifted past it). Combined with the inductive assumption that the other prefix elements were already sorted, positions 0 through i are now sorted. The invariant holds for i+1, so it holds for every iteration until the entire array is sorted.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Best case: the array is already sorted. Each element checks the one before it, finds it smaller, and stays put. That is n-1 comparisons, zero shifts, O(n) time.',
        'Worst case: the array is reverse-sorted. Element i shifts across all i previous elements. Total shifts: 1 + 2 + ... + (n-1) = n(n-1)/2. Time is O(n²). The same count applies to comparisons.',
        'Average case on random data: each element travels about halfway across the prefix. Total shifts are roughly n²/4, still O(n²). Doubling n quadruples the work.',
        'A sharper way to measure: the running time is O(n + d), where d is the number of inversions in the input. An inversion is a pair (i, j) with i < j but a[i] > a[j]. Each shift fixes exactly one inversion. Already-sorted data has zero inversions (O(n) time). Reverse-sorted data has n(n-1)/2 inversions (O(n²) time). An array with only a few elements out of place has few inversions and sorts almost linearly. This adaptivity is what makes insertion sort valuable.',
        'Space is O(1) — one temporary variable for the key, no auxiliary arrays. The sort is in-place and stable.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Small arrays (n < 20 or so). The inner loop is a tight comparison-and-shift with no function calls, no recursion, no heap operations, and excellent cache locality. The constant factor is so small that insertion sort beats O(n log n) algorithms on tiny inputs despite its worse asymptotic class. This is engineering fact, not theory.',
        'Nearly-sorted data. Appending a few records to a sorted list, repairing a small number of swaps, or extending a naturally ordered run are all low-inversion situations where insertion sort runs close to O(n). Libraries exploit this: Python\'s TimSort detects natural runs and finishes them with insertion sort. C++ introsort falls back to insertion sort for small partitions.',
        'Online sorting. Elements arrive one at a time and must be kept in order. Each new arrival is inserted into the sorted prefix without touching future elements. No other simple sort offers this streaming property.',
        'Stability matters. Insertion sort never moves equal elements past each other, so it preserves the relative order of records with equal keys. When used as the small-array finisher inside a stable merge sort, it keeps the overall sort stable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Large random arrays. A million random values produce roughly 250 billion inversions on average. Insertion sort processes them one at a time. Merge sort, quicksort, or heapsort finish the same job in about 20 million operations.',
        'Reverse-sorted data. Every element shifts across the entire prefix. This is the worst case and it is quadratic with the largest possible constant. If the input might be reversed, insertion sort is the wrong choice.',
        'Large records moved by value. Each shift copies the full record. If records are large structs, the data movement dominates and insertion sort spends most of its time on memory copies rather than comparisons. Sorting an array of pointers or indices avoids this, but the direct approach is painful.',
        'Data structures without cheap shifting. In a linked list, finding the insertion point still requires a linear scan (no random access for binary search), and although the actual insertion is O(1), the scan cost gives no advantage over arrays. The algorithm is designed for contiguous memory with cheap sequential access.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Input: [5, 2, 4, 6, 1, 3]. The sorted prefix starts as just [5].',
        'i=1, key=2: Compare 2 with 5. 5 > 2, shift 5 right. Reach the start. Insert 2 at position 0. Array: [2, 5, 4, 6, 1, 3]. Shifts: 1.',
        'i=2, key=4: Compare 4 with 5. 5 > 4, shift 5 right. Compare 4 with 2. 2 ≤ 4, stop. Insert 4 at position 1. Array: [2, 4, 5, 6, 1, 3]. Shifts: 1.',
        'i=3, key=6: Compare 6 with 5. 5 ≤ 6, stop immediately. 6 is already in place. Array: [2, 4, 5, 6, 1, 3]. Shifts: 0.',
        'i=4, key=1: Compare 1 with 6, 5, 4, 2 in turn. All are greater, so all four shift right. Reach the start. Insert 1 at position 0. Array: [1, 2, 4, 5, 6, 3]. Shifts: 4.',
        'i=5, key=3: Compare 3 with 6, 5, 4. All three shift right. Compare 3 with 2. 2 ≤ 3, stop. Insert 3 at position 2. Array: [1, 2, 3, 4, 5, 6]. Shifts: 3.',
        'Total shifts: 1 + 1 + 0 + 4 + 3 = 9. The array has 9 inversions, and insertion sort performed exactly 9 shifts — one per inversion. On already-sorted [1, 2, 3, 4, 5, 6], zero inversions means zero shifts and only 5 comparisons (one per element after the first). The inner loop never fires.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Vol. 3: Sorting and Searching, Section 5.2.1. Definitive analysis of straight insertion, binary insertion, comparison counts, and inversion-based running time.',
        'Shell, "A High-Speed Sorting Procedure," Communications of the ACM, 1959. Introduced diminishing-gap insertion sort (Shellsort), proving that letting elements jump long distances before the final insertion pass dramatically reduces total work.',
        'Prerequisites: Bubble Sort (adjacent-swap inversion repair, always O(n²), no adaptivity — shows what insertion sort improves on), Selection Sort (always scans the full unsorted region regardless of input order — the opposite tradeoff). Extensions: Shellsort (gap-based insertion sort, breaks the O(n²) barrier without divide-and-conquer), TimSort (detects natural runs and finishes them with insertion sort), introsort (quicksort that falls back to insertion sort for small partitions). Related: Quicksort and Merge Sort for the O(n log n) escape from quadratic sorting.',
      ],
    },
  ],
};
