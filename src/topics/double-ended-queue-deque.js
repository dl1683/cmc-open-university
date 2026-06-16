// Deque: push and pop at both ends, often implemented by a circular buffer or
// block list so front and back operations stay O(1).

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'double-ended-queue-deque',
  title: 'Double-Ended Queue (Deque)',
  category: 'Data Structures',
  summary: 'A deque supports push and pop at both front and back, making it the primitive behind monotonic queues, work stealing, and sliding windows.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['two-ended operations', 'sliding window case study'], defaultValue: 'two-ended operations' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function dequeGraph(title, slots, notes = {}) {
  const nodes = slots.map((slot, index) => ({
    id: `s${index}`,
    label: slot ?? '_',
    x: 1.1 + index * 1.45,
    y: 3.8,
    note: notes[`s${index}`] ?? '',
  }));
  return graphState({
    nodes: [
      ...nodes,
      { id: 'front', label: 'front', x: notes.frontX ?? 1.1, y: 1.4, note: notes.front ?? 'read/pop' },
      { id: 'back', label: 'back', x: notes.backX ?? 6.9, y: 6.2, note: notes.back ?? 'push/read' },
      { id: 'cap', label: 'cap', x: 9.2, y: 3.8, note: notes.cap ?? String(slots.length) },
    ],
    edges: [
      { id: 'e-front-s', from: 'front', to: notes.frontSlot ?? 's0', weight: 'front' },
      { id: 'e-back-s', from: 'back', to: notes.backSlot ?? 's4', weight: 'back' },
      { id: 'e-cap-s', from: 'cap', to: notes.backSlot ?? 's4', weight: 'wrap' },
    ],
  }, { title });
}

function* twoEndedOperations() {
  yield {
    state: dequeGraph('A deque exposes both ends of the sequence', ['A', 'B', 'C', '_', '_', '_'], {
      s0: 'first',
      s2: 'last',
      frontSlot: 's0',
      backSlot: 's2',
      frontX: 1.1,
      backX: 4.0,
      cap: 'ring slots',
    }),
    highlight: { active: ['front', 'back', 's0', 's2'], compare: ['cap'] },
    explanation: 'A double-ended queue supports insertion and removal at both ends. It keeps queue order, but unlike a plain FIFO queue it lets algorithms treat the back as a stack-like editing point.',
    invariant: 'pushFront, popFront, pushBack, and popBack should be O(1) amortized.',
  };

  yield {
    state: dequeGraph('pushBack appends after the current back', ['A', 'B', 'C', 'D', '_', '_'], {
      s0: 'first',
      s3: 'new last',
      frontSlot: 's0',
      backSlot: 's3',
      frontX: 1.1,
      backX: 5.45,
      cap: 'ring slots',
    }),
    highlight: { active: ['back', 's3', 'e-back-s'], found: ['s0', 's1', 's2'] },
    explanation: 'pushBack writes into the free slot after the old last element and moves the back pointer. This is the familiar queue enqueue direction.',
  };

  yield {
    state: dequeGraph('pushFront prepends before the current front', ['A', 'B', 'C', 'D', '_', 'Z'], {
      s5: 'new first',
      s3: 'last',
      frontSlot: 's5',
      backSlot: 's3',
      frontX: 8.35,
      backX: 5.45,
      cap: 'wrap',
    }),
    highlight: { active: ['front', 's5', 'e-front-s', 'cap'], compare: ['s0'] },
    explanation: 'In a circular-buffer implementation, pushing at the front can wrap to the physical end of the array. Logical order is Z, A, B, C, D even though the storage wraps.',
  };

  yield {
    state: dequeGraph('popFront and popBack remove from opposite ends', ['_', 'B', 'C', '_', '_', 'Z'], {
      s5: 'first',
      s2: 'last',
      frontSlot: 's5',
      backSlot: 's2',
      frontX: 8.35,
      backX: 4.0,
      cap: 'holes ok',
    }),
    highlight: { active: ['front', 'back', 's5', 's2'], removed: ['s0', 's3'] },
    explanation: 'Removing from either side only advances one pointer and optionally clears a slot. The implementation does not shift the middle elements.',
  };
}

function* slidingWindowCaseStudy() {
  yield {
    state: labelMatrix(
      'Sliding-window maximum uses a deque of candidates',
      [
        { id: 'step1', label: 'read 8' },
        { id: 'step2', label: 'read 3' },
        { id: 'step3', label: 'read 9' },
        { id: 'step4', label: 'slide' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'deque', label: 'deque' },
        { id: 'max', label: 'max' },
      ],
      [
        ['push back', '[8]', '8'],
        ['keep smaller behind', '[8,3]', '8'],
        ['pop smaller back, push 9', '[9]', '9'],
        ['drop expired front', '[9,...]', '9'],
      ],
    ),
    highlight: { active: ['step3:operation', 'step3:deque'], found: ['step3:max', 'step4:max'] },
    explanation: 'Monotonic Queue is built from deque operations. New values enter at the back, dominated candidates are popped from the back, and expired indices leave from the front.',
  };

  yield {
    state: dequeGraph('The front is the answer; the back is the editing surface', ['9', '7', '4', '_', '_', '_'], {
      s0: 'max',
      s2: 'weakest',
      frontSlot: 's0',
      backSlot: 's2',
      frontX: 1.1,
      backX: 4.0,
      cap: 'window',
    }),
    highlight: { active: ['front', 's0'], compare: ['back', 's2'] },
    explanation: 'The front holds the current best candidate. The back is where new arrivals remove weaker candidates before joining. That is why both ends matter.',
  };

  yield {
    state: labelMatrix(
      'Implementation choices',
      [
        { id: 'ring', label: 'ring buffer' },
        { id: 'blocks', label: 'block deque' },
        { id: 'list', label: 'linked list' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['cache friendly', 'resize/wrap logic'],
        ['grows both ways', 'more pointers'],
        ['simple splicing', 'poor locality'],
      ],
    ),
    highlight: { active: ['ring:strength', 'blocks:strength'], compare: ['list:cost'] },
    explanation: 'A deque is an interface, not one storage layout. Circular buffers are common for bounded queues; block deques avoid moving everything when growth happens at both ends.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'two-ended operations') yield* twoEndedOperations();
  else if (view === 'sliding window case study') yield* slidingWindowCaseStudy();
  else throw new InputError('Pick a deque view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A deque, pronounced deck, is a double-ended queue. It supports adding and removing items at both the front and the back while preserving a logical order.',
        'The interface is small but powerful: pushFront, pushBack, popFront, popBack, peekFront, and peekBack. It is the missing primitive behind monotonic queues, undo buffers, task schedulers, browser work queues, and work-stealing runtimes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A bounded deque is often a circular buffer with head and tail indices. Moving either end is arithmetic modulo capacity. A growing deque can use a resizable circular array, a block map, or a linked list of chunks so both ends can expand.',
        'The important invariant is that operations at either end do not shift the middle. That is what keeps the end operations O(1) amortized.',
      ],
    },
    {
      heading: 'Case study: sliding-window maximum',
      paragraphs: [
        'For each new value, a monotonic queue pops smaller candidates from the back and then pushes the new value. For each expired index, it pops from the front. The maximum is always the front. This works only because the structure can edit the back and expire the front efficiently.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Deque does not imply thread safety. A work-stealing deque has a very specific concurrency contract: one owner pushes and pops at the bottom while thieves steal from the top. A general concurrent deque is a harder object.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Queue, Ring Buffer, Monotonic Queue, Work-Stealing Deque Scheduler, Lock-Free Queue, and Backpressure & Flow Control next. For implementation references, compare Java ArrayDeque at https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html and CPython collections.deque at https://docs.python.org/3/library/collections.html#collections.deque.',
      ],
    },
  ],
};
