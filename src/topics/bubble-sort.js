// Bubble sort: compare neighbors, swap when out of order.
// The largest unsorted value "bubbles" to the end on every pass.

import { arrayState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'bubble-sort',
  title: 'Bubble Sort',
  category: 'Sorting',
  summary: 'Compare each pair of neighbors and swap — the simplest sort there is.',
  controls: [
    { id: 'values', label: 'Values', type: 'number-list', defaultValue: '9, 2, 14, 5, 5, 1' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 10 });
  const sortedIds = () => values.map((_, i) => `i${i}`).slice(values.length - sortedCount);
  let sortedCount = 0;

  yield {
    state: arrayState(values),
    highlight: {},
    explanation: 'Bubble sort makes repeated passes, comparing each pair of NEIGHBORS and swapping them if they are out of order. Watch the largest value travel right on every pass.',
  };

  for (let end = values.length - 1; end > 0; end -= 1) {
    let swapped = false;
    for (let i = 0; i < end; i += 1) {
      const inOrder = values[i] <= values[i + 1];
      yield {
        state: arrayState(values),
        highlight: { compare: [`i${i}`, `i${i + 1}`], sorted: sortedIds() },
        explanation: `Compare neighbors ${values[i]} and ${values[i + 1]}: ${inOrder ? 'already in order — leave them.' : 'out of order — swap them.'}`,
        invariant: sortedCount > 0
          ? `The last ${sortedCount} position${sortedCount === 1 ? ' is' : 's are'} final — each pass locked one more in place.`
          : undefined,
      };
      if (!inOrder) {
        [values[i], values[i + 1]] = [values[i + 1], values[i]];
        swapped = true;
        yield {
          state: arrayState(values),
          highlight: { swap: [`i${i}`, `i${i + 1}`], sorted: sortedIds() },
          explanation: `Swapped: ${values[i]} and ${values[i + 1]} trade places. ${values[i + 1]} keeps riding right as long as it is the biggest thing on this pass.`,
        };
      }
    }
    sortedCount += 1;
    yield {
      state: arrayState(values),
      highlight: { sorted: sortedIds() },
      explanation: `Pass complete: ${values[end]} has bubbled to position ${end} and will never move again.${swapped ? '' : ' No swaps happened this whole pass — the array must already be sorted, so we can stop early.'}`,
    };
    if (!swapped) break;
  }

  sortedCount = values.length;
  yield {
    state: arrayState(values),
    highlight: { sorted: values.map((_, i) => `i${i}`) },
    explanation: `Sorted! Bubble sort compared neighbors up to n times across n passes — O(n²). Fine for ${values.length} values, hopeless for a million. That pain is why Merge Sort and Quick Sort exist.`,
  };
}
