// Stack: Last In, First Out. Push and pop touch only the top — O(1).

import { sequenceState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'stack',
  title: 'Stack',
  category: 'Data Structures',
  summary: 'Push onto the top, pop from the top — Last In, First Out.',
  controls: [
    { id: 'values', label: 'Push these (in order)', type: 'number-list', defaultValue: '5, 12, 3, 8' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 8 });
  const stack = []; // index 0 = top, matching how the renderer draws it

  yield {
    state: sequenceState('stack', stack),
    highlight: {},
    explanation: 'A stack starts empty. The only place anything ever happens is the top — like a stack of plates: you add to the top and take from the top.',
  };

  let counter = 0;
  for (const value of values) {
    stack.unshift({ id: `s${counter++}`, value });
    yield {
      state: sequenceState('stack', stack),
      highlight: { active: [stack[0].id] },
      explanation: `push(${value}): the new value goes on top of everything already there. No shifting, no searching — push is O(1).`,
      invariant: 'The most recently pushed value is always on top.',
    };
  }

  yield {
    state: sequenceState('stack', stack),
    highlight: { found: [stack[0].id] },
    explanation: `peek() returns ${stack[0].value} — the top — without removing it. Notice it is the LAST value we pushed: Last In, First Out.`,
  };

  while (stack.length > 0) {
    const top = stack[0];
    yield {
      state: sequenceState('stack', stack),
      highlight: { removed: [top.id] },
      explanation: `pop() removes and returns ${top.value}. We never dig below the top — which is why a stack is the natural shape for undo history and function calls.`,
    };
    stack.shift();
  }

  yield {
    state: sequenceState('stack', stack),
    highlight: {},
    explanation: `Empty again — and the values came out in exactly the reverse order they went in (${[...values].reverse().join(', ')}). Reversal is the stack's superpower.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A stack is an abstract data type that enforces Last-In-First-Out (LIFO) access: the last element you push is the first one you can pop. Picture a stack of plates in a cafeteria — you add plates to the top and remove from the top. You never dig into the middle or bottom. This simplicity makes stacks one of the most fundamental and efficient data structures in computing.`,
        `A stack has only two main operations: push (add to the top) and pop (remove from the top). You can also peek at the top element without removing it. That is the entire interface. There is no search, no removal from the middle, no iteration — just top-of-stack access. This constraint is not a limitation; it is the whole point.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Push adds a new element to the top. If you are using an array, this is an unshift operation at the front (or append at the back if you reverse your indexing). Either way, the operation touches only the top slot and runs in O(1). Pop removes the top element and returns it — again, O(1), because you only touch the top slot.`,
        `Peek returns the top element without removing it — also O(1). Behind the scenes, a stack can be implemented as a linked list (where the head is the top) or as an array (where one end is designated as the top). Both achieve O(1) push and pop. The key insight is that you only ever touch one end, so resizing or pointer updates are never required.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Push, pop, and peek are all O(1) operations. Space complexity is O(n) where n is the number of elements stored. There are no hidden costs because the stack never searches, never sorts, and never shifts. This makes stacks one of the fastest, most predictable data structures. The trade-off is that you can only access the top — if you need to check if a specific value is in the stack, you must pop every element until you find it or exhaust the stack.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Stacks power undo/redo systems: each action is pushed onto the undo stack, and pressing Undo pops the last action and pushes it to the redo stack. Programming language implementations use stacks to manage function calls — each function call pushes a frame onto the call stack, and return pops it. Web browsers use stacks for navigation history. Compilers use stacks for syntax parsing and expression evaluation. The Ethereum Virtual Machine and JavaScript engines both rely on the call stack. Any system that needs to reverse order or maintain a LIFO sequence uses a stack.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest mistake is trying to access a middle element or search the stack without popping. If you need to search for a value or access elements in any order, a stack is the wrong data structure — use a Hash Table or array. Another misconception is that stacks are slow because they are abstract; they are actually faster than most structures because operations are guaranteed O(1) with no exceptions. Stack overflow (exceeding memory limits on the call stack) is a real issue in recursion-heavy programs, but that is an implementation detail of the call stack, not a flaw in the stack concept itself. Finally, mixing up stack vs. queue is common — stacks are LIFO, queues are FIFO; if you need to process things in the order they arrived, use a queue.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Learn Queue to see the opposite access pattern (FIFO). Explore how Recursion internally uses the call stack. Understanding Linked List will deepen your appreciation for why pointer-based implementations of stacks are efficient. Study Tree Traversals and Graph BFS, both of which use stacks (or queues) as auxiliary data structures to track which nodes to visit next.`,
      ],
    },
  ],
};

