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
    {
      heading: `Why this exists`,
      paragraphs: [
        `Stacks exist for unfinished work where the newest item must be handled first. Function calls, undo history, nested parentheses, and depth-first search all have the same shape: start something, start something inside it, then finish the inner thing before returning to the outer thing.`,
        `The public interface is tiny: push adds an item, pop removes and returns the newest item, and peek reads the newest item without removing it. There is usually an isEmpty check too, because popping from an empty stack is an underflow error.`,
        `That small interface is the point. A stack is not a weak list. It is a list with a rule strong enough to make algorithms simpler. The caller cannot remove an old frame by accident, so nested lifetimes stay nested.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious approach is a general list where you insert, remove, and inspect anywhere. That flexibility is useful, but it makes the caller responsible for preserving the right order. For nested work, arbitrary access is not a feature. It is a source of bugs.`,
        `A stack removes that freedom. You can only touch the top. The wall it solves is bookkeeping: the structure itself remembers the latest unfinished item, so the algorithm does not need to search for what should happen next.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is Last In, First Out. The last item pushed is the first item popped. That one rule reverses order and matches nested lifetimes: inner work must finish before outer work can resume.`,
        `This is not just a storage choice. It is a correctness rule. If a parser sees an opening bracket, the next closing bracket must match the most recent unmatched opening bracket, not an older one. A stack makes that rule automatic.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `Watch only the top. The animation deliberately makes the rest of the stack passive because older items are blocked by newer items. Push creates a new top. Peek reads that top. Pop removes it and reveals the previous unfinished item.`,
        `The visual reversal at the end is the lesson. Values leave in the opposite order from arrival because every pop removes the most recent remaining value. If you imagine an undo system, a parser, or a recursive call stack while watching, the same invariant is doing the work.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `In JavaScript, the natural array implementation treats the end of the array as the top. Array push appends at the end, and pop removes from the end, so neither operation shifts the other elements. That gives amortized O(1) behavior: most pushes are one write, with an occasional resize when the backing storage grows.`,
        `A pointer implementation is just as simple. With Linked List, make the head node the top: push creates a new head, pop moves the head pointer to the next node, and peek reads the head value. Each operation rewires one pointer.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Correctness comes from the top invariant: after any sequence of pushes and pops, the top is the most recently pushed item that has not yet been popped. Push makes a new item top. Pop removes the current top and exposes the next most recent unfinished item.`,
        `For balanced parentheses, that invariant proves the algorithm. Push each opener. When a closer arrives, it must match the stack top. If it does, pop. If it does not, the nesting is wrong. At the end, the stack must be empty because every opener needs a matching closer.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `Push, pop, and peek are O(1) in the intended implementation. Array-backed push is amortized O(1); linked-list push is worst-case O(1) but allocates a node per item. Space is O(n), where n is the number of stored items, plus small overhead for array capacity or node pointers. Searching is O(n) because the interface gives you no shortcut to older entries. Big-O Growth Rates matters here because the structure earns its speed by refusing operations that would require scanning.`,
        `The implementation detail that matters most in JavaScript is which end you use. Array push and pop at the end are the natural stack operations. Array unshift and shift at the front are poor stack operations because they can reindex the array. The abstract data type says "top"; the runtime still has opinions about which physical end is cheap.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Undo systems usually keep one history stack for actions and a second one for redo. Expression evaluators use stacks for operators and operands; Dijkstra's shunting-yard algorithm turns infix math like 3 + 4 * 5 into an order a machine can execute. Compilers and interpreters use call stacks, parsers use stacks to match nested parentheses, and depth-first Tree Traversals often use an explicit stack instead of recursive calls. Web navigation also looks stack-shaped: each page visit pushes a location, and Back pops toward the previous one.`,
        `Systems code leans on the same idea. The JavaScript engine uses the call stack beside The Event Loop; the event loop schedules callbacks, while the call stack records what is currently executing. Backtracking regex engines also use stack-like saved choices, which is why Regex Backtracking & ReDoS Case Study belongs next to this topic. Graph algorithms choose between structures too: Graph BFS uses Queue for level order, while depth-first search uses a stack when it wants to chase one path deeply before backing up.`,
        `Stacks are also useful as a way to remove recursion without changing the algorithm's shape. A recursive DFS stores unfinished calls in the language runtime. An iterative DFS stores those calls explicitly as stack frames. The second version is more verbose, but it gives you control over memory, cancellation, pause/resume behavior, and instrumentation.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Stacks fail when older items need to be served before newer ones. Print jobs, customer support tickets, and breadth-first search want Queue instead. A stack also fails as a lookup table: if you keep popping just to inspect older values, your design probably wants Hash Table, Linked List, or an array.`,
        `Implementation details matter. In JavaScript, push/pop at the end of an array is the fast stack pair; unshift/shift at the front can re-index elements and cost O(n). Recursive code can also exhaust the call stack long before it exhausts heap memory.`,
        `A stack can also hide exponential work. Backtracking algorithms often feel neat because the stack records choices cleanly, but the number of saved choices can explode. Regex backtracking, naive search in games, and recursive combinatorics all need pruning, memoization, or a different state representation once the stack starts recording too many possible futures.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `A text editor undo system is a complete stack case. Each edit pushes an action onto the undo stack. Pressing Undo pops the most recent action and applies its inverse. That popped action can be pushed onto a redo stack. Pressing Redo pops from redo and applies the action again.`,
        `The stack rule is what users expect: undo the last thing I did, not the first thing I did today. A queue would preserve arrival order and undo old edits first, which would be wrong. A hash table could find an edit by ID, but it would not encode the newest-first rule.`,
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
