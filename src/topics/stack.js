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
      heading: `What it is`,
      paragraphs: [
        `A stack is a Last-In, First-Out container: the newest item is the first one you can remove. Think of cafeteria plates, browser back history, or a pile of sticky notes on your desk. You add to the top, remove from the top, and deliberately ignore everything below it until the newer work is gone. That narrow rule is what makes the structure useful.`,
        `The public interface is tiny: push adds an item, pop removes and returns the newest item, and peek reads the newest item without removing it. There is usually an isEmpty check too, because popping from an empty container is an underflow error. You do not search, sort, or delete from the middle. If you need keyed lookup, use Hash Table; if you need arrival order, use Queue. The value here is disciplined reversal: the last unfinished thing gets handled first.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `In JavaScript, the natural array implementation treats the end of the array as the top. Array push appends at the end, and pop removes from the end, so neither operation shifts the other elements. That gives amortized O(1) behavior: most pushes are one write, with an occasional resize when the backing storage grows. Using unshift and shift at the front is the classic mistake, because those operations must re-index the array and can cost O(n).`,
        `A pointer implementation is just as simple. With Linked List, make the head node the top: push creates a new head, pop moves the head pointer to the next node, and peek reads the head value. Each operation rewires one pointer. This is why stacks pair so naturally with Recursion: every function call pushes a frame containing local variables and a return address, and every return pops that frame.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Push, pop, and peek are O(1) in the intended implementation. Array-backed push is amortized O(1); linked-list push is worst-case O(1) but allocates a node per item. Space is O(n), where n is the number of stored items, plus small overhead for array capacity or node pointers. Searching is O(n) because the interface gives you no shortcut to older entries. Big-O Growth Rates matters here because the structure earns its speed by refusing operations that would require scanning.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Undo systems usually keep one history stack for actions and a second one for redo. Expression evaluators use stacks for operators and operands; Dijkstra's shunting-yard algorithm turns infix math like 3 + 4 * 5 into an order a machine can execute. Compilers and interpreters use call stacks, parsers use stacks to match nested parentheses, and depth-first Tree Traversals often use an explicit stack instead of recursive calls. Web navigation also looks stack-shaped: each page visit pushes a location, and Back pops toward the previous one.`,
        `Systems code leans on the same idea. The JavaScript engine uses the call stack beside The Event Loop; the event loop schedules callbacks, while the call stack records what is currently executing. Backtracking regex engines also use stack-like saved choices, which is why Regex Backtracking & ReDoS Case Study belongs next to this topic. Graph algorithms choose between structures too: Graph BFS uses Queue for level order, while depth-first search uses a stack when it wants to chase one path deeply before backing up.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first pitfall is choosing the wrong end of an array. In JavaScript, push/pop is the fast stack pair; unshift/shift is the slow pair for this purpose. The second is treating the structure like a general list. If you keep popping just to inspect older values, your design probably wants Hash Table, Linked List, or an array instead. The third is ignoring overflow: recursive code can exhaust the call stack long before it exhausts heap memory, especially in browsers with relatively shallow stack limits.`,
        `Another interview trap is confusing LIFO and FIFO. A stack reverses order; a Queue preserves it. That one distinction explains why undo, parsing, and depth-first search feel natural here, while print jobs and request scheduling do not.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Queue to see the opposite access rule, then revisit Recursion with the call stack in mind. Linked List shows the pointer version of the same operations. Regex Backtracking & ReDoS Case Study shows a production failure mode built from saved stack choices. JSON Parser Stack Case Study shows nested syntax as explicit frames. Tree Traversals and Graph BFS make the choice between stack and queue visible in traversal order, and Big-O Growth Rates explains why O(1) push and pop are such a strong primitive.`,
      ],
    },
  ],
};
