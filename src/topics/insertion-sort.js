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
    {heading: 'How to read the animation', paragraphs: [
      'The animation splits the array into a sorted prefix on the left and an unsorted suffix on the right. The active value is the next unsorted item being inserted, and shifts open the gap where it belongs.',
      {type: 'callout', text: 'The sorted prefix is the invariant: every step preserves it while absorbing exactly one new value.'},
      {type: 'image', src: './assets/gifs/insertion-sort.gif', alt: 'Animated walkthrough of the insertion sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ]},
    {heading: 'Why this exists', paragraphs: [
      'Insertion sort exists for small or nearly sorted sequences where rebuilding the whole order is wasteful. It behaves like sorting cards by hand: keep the cards in your hand sorted, then slide the next card into place.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Insertion-sort-example-300px.gif', alt: 'Animated insertion sort moving each value into a sorted prefix', caption: 'The animation shows the sorted prefix growing while the active value shifts left into its slot. Source: Wikimedia Commons, insertion sort animation.'},
    ]},
    {heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to keep a sorted group and insert each new value where it belongs. That is the algorithm, with one invariant: before each insertion, every value to the left of the active index is already sorted.',
    ]},
    {heading: 'The wall', paragraphs: [
      'The wall is movement in a contiguous array. If the new value belongs at the front, every larger value in the sorted prefix must shift one slot right.',
      'On reverse-sorted input, element i shifts across i earlier elements. The total is 1 + 2 + ... + (n - 1), which is n(n - 1) / 2 shifts.',
    ]},
    {heading: 'The core insight', paragraphs: [
      'Insertion sort pays for inversions, not just for array length. An inversion is a pair of positions i < j where the left value is larger than the right value, and each shift removes one such pair.',
    ]},
    {heading: 'How it works', paragraphs: [
      'For index i, save array[i] as the key, then walk left through the sorted prefix. While the previous value is greater than the key, copy it one slot right; when the walk stops, write the key into the open slot.',
    ]},
    {heading: 'Why it works', paragraphs: [
      'The proof is induction on the prefix length. A one-element prefix is sorted, and inserting the next key after all smaller-or-equal values and before all larger values keeps the enlarged prefix sorted.',
    ]},
    {heading: 'Cost and complexity', paragraphs: [
      'Best case time is O(n), when every key is already after the previous value and no shifting happens. Worst and average random cases are O(n squared), because many keys cross a large fraction of the prefix.',
      'Space is O(1) because the algorithm uses one saved key and edits the original array. Doubling a reversed input roughly quadruples the shifts, while doubling a sorted input only doubles the comparisons.',
    ]},
    {heading: 'Real-world uses', paragraphs: [
      'Sorting libraries use insertion sort for tiny partitions because the loop is simple, branch-friendly, and cache-local. Hybrid sorts also use it to finish nearly sorted runs after larger algorithms have done the coarse work.',
    ]},
    {heading: 'Where it fails', paragraphs: [
      'It fails on large random arrays because too many values must move. It also fails when records are large and copied by value, because each shift copies the whole record.',
    ]},
    {heading: 'Worked example', paragraphs: [
      'Use [5, 2, 4, 6, 1, 3]. Key 2 shifts 5, key 4 shifts 5, key 6 shifts nothing, key 1 shifts 6, 5, 4, and 2, and key 3 shifts 6, 5, and 4.',
      'The final array is [1, 2, 3, 4, 5, 6]. Total shifts are 1 + 1 + 0 + 4 + 3 = 9, matching the nine inversions in the original input.',
    ]},
    {heading: 'Sources and study next', paragraphs: [
      'Read Knuth, The Art of Computer Programming, Volume 3, for insertion-sort analysis and inversion counts. Then study Bubble Sort, Selection Sort, Shellsort, Merge Sort, Quicksort, and TimSort to compare movement, stability, adaptivity, and asymptotic cost.',
    ]},
  ],
};
