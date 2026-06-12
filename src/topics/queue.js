// Queue: First In, First Out. Enqueue at the back, dequeue from the front.

import { sequenceState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'queue',
  title: 'Queue',
  category: 'Data Structures',
  summary: 'Enqueue at the back, dequeue from the front — First In, First Out.',
  controls: [
    { id: 'values', label: 'Enqueue these (in order)', type: 'number-list', defaultValue: '5, 12, 3, 8' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 8 });
  const queue = []; // index 0 = front

  yield {
    state: sequenceState('queue', queue),
    highlight: {},
    explanation: 'A queue starts empty. New items join at the BACK; items leave from the FRONT — exactly like a line at a store. First come, first served.',
  };

  let counter = 0;
  for (const value of values) {
    queue.push({ id: `q${counter++}`, value });
    yield {
      state: sequenceState('queue', queue),
      highlight: { active: [queue[queue.length - 1].id] },
      explanation: `enqueue(${value}): the new value joins at the back. With a pointer to the tail this is O(1) — no walking required.`,
      invariant: 'Items stand in the exact order they arrived.',
    };
  }

  while (queue.length > 0) {
    const front = queue[0];
    yield {
      state: sequenceState('queue', queue),
      highlight: { removed: [front.id] },
      explanation: `dequeue() removes ${front.value} from the front — it has waited the longest, so it goes first. ${queue.length === 1 ? 'After this the queue is empty, so front and back must both be reset — forgetting that is a classic bug.' : 'Everyone else moves one step closer to the front.'}`,
    };
    queue.shift();
  }

  yield {
    state: sequenceState('queue', queue),
    highlight: {},
    explanation: `Done — values left in the same order they arrived (${values.join(', ')}). Queues preserve order; stacks reverse it. That single difference decides which one you need.`,
  };
}
