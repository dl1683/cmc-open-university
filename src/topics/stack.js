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
  const stack = []; // Visualization keeps index 0 as the drawn top; production JS stacks usually use array push/pop at the end.

  yield {
    state: sequenceState('stack', stack),
    highlight: {},
    explanation: 'A stack starts empty. Only the top is accessible: new work goes on top, and the next removal also comes from the top.',
  };

  let counter = 0;
  for (const value of values) {
    stack.unshift({ id: `s${counter++}`, value });
    yield {
      state: sequenceState('stack', stack),
      highlight: { active: [stack[0].id] },
      explanation: `push(${value}): the new value becomes the top. The invariant is simple: the most recent unfinished item is always the next one available.`,
      invariant: 'The most recently pushed value is always on top.',
    };
  }

  yield {
    state: sequenceState('stack', stack),
    highlight: { found: [stack[0].id] },
    explanation: `peek() returns ${stack[0].value}, the top value, without removing it. It is the last value pushed, which is exactly Last In, First Out.`,
  };

  while (stack.length > 0) {
    const top = stack[0];
    yield {
      state: sequenceState('stack', stack),
      highlight: { removed: [top.id] },
      explanation: `pop() removes and returns ${top.value}. Nothing below it can be touched until newer items above it are gone.`,
    };
    stack.shift();
  }

  yield {
    state: sequenceState('stack', stack),
    highlight: {},
    explanation: `Empty again. The values came out in reverse order (${[...values].reverse().join(', ')}), because each pop removes the newest remaining value.`,
  };
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: ['Watch only the top of the stack. Active items are being pushed or inspected, and removed items are about to be popped.', {type: 'callout', text: 'A stack is useful because it turns nested unfinished work into one enforced rule: the newest live item is the only item you can touch.'}, {type: 'image', src: './assets/gifs/stack.gif', alt: 'Animated walkthrough of the stack visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: ['A stack exists for nested unfinished work. Function calls, bracket pairs, undo history, and depth-first search all need the newest unfinished item to finish first.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Call_stack_layout.svg/500px-Call_stack_layout.svg.png', alt: 'Call stack frame layout with return address, parameters, locals, stack pointer, and frame pointer', caption: 'A runtime call stack records return addresses and frame state in the same newest-first order shown by push and pop. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Call_stack_layout.svg.'}], },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is one current variable. It works for one unfinished item, but nesting overwrites older state.'], },
    { heading: 'The wall', paragraphs: ['Nested work needs a sequence of saved states, not one slot. A raw array plus manual index can work, but it does not enforce newest-first access by itself.'], },
    { heading: 'The core insight', paragraphs: ['Allow access at only one end. Push adds the newest item there, pop removes from there, and peek reads that item without removing it.'], },
    { heading: 'How it works', paragraphs: ['An array-backed stack usually treats the end as the top, so push appends and pop removes without shifting earlier elements. A linked-list stack treats the head as the top and rewires one pointer per operation.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Singly linked list nodes connected by next pointers', caption: 'A linked-list stack changes only the head pointer on push or pop; the rest of the chain stays untouched. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Linked_list.svg.'}], },
    { heading: 'Why it works', paragraphs: ['The invariant is last in, first out: the top is the most recently pushed item not yet popped. Push makes the new item top, and pop exposes the next newest item.'], },
    { heading: 'Cost and complexity', paragraphs: ['Push, pop, and peek are O(1) for a linked-list stack and amortized O(1) for a growing array stack. Space is O(n), and the price of speed is no random access.'], },
    { heading: 'Real-world uses', paragraphs: ['Runtime call stacks store return addresses and frames. Parsing, bracket matching, undo, browser back navigation, and iterative depth-first search all use the same newest-first rule.'], },
    { heading: 'Where it fails', paragraphs: ['A stack fails for first-in, first-out service such as print jobs or breadth-first search. It also fails for arbitrary lookup, and recursive use can overflow the runtime call stack.'], },
    { heading: 'Worked example', paragraphs: ['Push 5, then 3, then 8, giving [5, 3, 8] with top 8. Pop returns 8, peek reads 3, push 1, then two pops return 1 and 3, always the newest live item.'], },
    { heading: 'Sources and study next', paragraphs: ['Study Turing on return-address stacks, Bauer and Samelson on stack-based formula translation, and Dijkstra shunting-yard parsing. Then compare Queue, Linked List, Recursion, Tree Traversals, and Expression Parsing.'], },
  ],
};
