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
