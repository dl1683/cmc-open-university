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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a vertical stack. Items enter from the top (push) and leave from the top (pop). The highlighted item in green is the one being added or inspected. A red highlight means that item is about to be removed.',
        {type: 'callout', text: 'A stack is useful because it turns nested unfinished work into one enforced rule: the newest live item is the only item you can touch.'},
        'Watch the top position. After every push, the new value sits on top of everything already there. After every pop, the item beneath the removed one becomes the new top. Peek highlights the top without removing it. At the end, the stack empties in reverse order: the last value pushed is the first value popped.',
        'If you pause at any frame, the top of the stack is always the most recently pushed item that has not yet been popped. That one fact is the entire data structure.',
      
        {type: 'image', src: './assets/gifs/stack.gif', alt: 'Animated walkthrough of the stack visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Alan Turing proposed using a stack of return addresses for subroutine calls in his 1946 design for the ACE computer. If function A calls function B, and B calls C, the machine needs to remember that C returns to B and B returns to A, in that order. A list of addresses is not enough; you need the guarantee that the most recent address is the next one used. Turing realized that pushing each return address on entry and popping it on exit gives exactly that guarantee.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Call_stack_layout.svg/500px-Call_stack_layout.svg.png', alt: 'Call stack frame layout with return address, parameters, locals, stack pointer, and frame pointer', caption: 'A runtime call stack records return addresses and frame state in the same newest-first order shown by push and pop. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Call_stack_layout.svg.'},
        'Friedrich Bauer and Klaus Samelson formalized the stack as an abstract data type in 1957, earning the IEEE Computer Pioneer Award for the contribution. Their insight was that the pattern Turing used for return addresses applies everywhere nesting appears: expression parsing, memory allocation, undo history, and recursive computation all share the same shape. Start something, start something inside it, finish the inner thing before the outer thing resumes.',
        'The result is the simplest useful abstraction over ordered data. Three operations (push, pop, peek), one rule (last in, first out), and a large family of problems that become trivial once you have it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Suppose you need to track the most recent unfinished task. The simplest idea: store it in a single variable. When a new task arrives, overwrite the variable. When the task finishes, you are done.',
        'This works when nesting never exceeds one level. A single "current task" variable handles one function calling one other function, one level of parentheses, one undo action.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A single variable cannot hold more than one value. Function calls nest arbitrarily deep: A calls B calls C calls D. Each call needs its own saved return address, and those addresses must be recovered in reverse order. Overwriting a single variable loses every address except the latest.',
        'You could use an array and an index, tracking the "current" position yourself. But then every caller must manually increment and decrement the index, check bounds, and avoid accessing the wrong slot. The bookkeeping is error-prone because the array does not enforce the rule that only the most recent item is accessible. You need a structure whose interface makes the LIFO rule automatic, so the algorithm cannot accidentally violate it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The LIFO (Last In, First Out) rule is the only invariant you need. When you push, the new item becomes the top. When you pop, the top item leaves. The structure itself enforces that you can only touch one item — the most recently pushed one that has not yet been popped. No index bookkeeping, no manual bounds checks, no way to reach underneath.',
        'This works because the newest unfinished item is always the next one that must finish. Function A started first, called B, and B called C. C must return to B before B can return to A. The newest address (C's return to B) is the next one used. The stack does not need to know anything about functions or nesting — it only needs to enforce the newest-first order.',
        'The single insight: a list that only allows operations on one end, in newest-first order, makes nested lifetimes trivial to track. Push when a new nesting begins. Pop when it ends. The stack tracks everything in the right order automatically.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A stack exposes three operations. Push places a new item on top. Pop removes the top item and returns it. Peek reads the top item without removing it. Some implementations add isEmpty to guard against popping an empty stack (underflow).',
        'Array-backed implementation: treat the end of the array as the top. Push appends to the end, pop removes from the end. Neither operation shifts existing elements, so both run in O(1) amortized time. When the backing array fills, it doubles in capacity; the occasional resize costs O(n) but is spread across n preceding O(1) pushes, keeping the amortized cost constant.',
        'Linked-list-backed implementation: treat the head of the list as the top. Push creates a new node pointing to the current head and updates the head pointer. Pop moves the head pointer to the next node. Each operation rewires one pointer in O(1) worst-case time, with no amortization needed, but each node carries pointer overhead.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Singly linked list nodes connected by next pointers', caption: 'A linked-list stack changes only the head pointer on push or pop; the rest of the chain stays untouched. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Linked_list.svg.'},
        'Stack overflow occurs when pushes exceed available space. For an array-backed stack with a fixed capacity, this means the array is full. For recursive function calls, the language runtime allocates a fixed-size call stack (typically around 1 MB); deep recursion can exhaust it even when heap memory remains plentiful.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The LIFO invariant: after any sequence of pushes and pops, the top of the stack is the most recently pushed item that has not yet been popped. Push preserves this because the new item is more recent than anything already present. Pop preserves it because removing the current top exposes the next most recent item.',
        'This invariant matches every problem with nested lifetimes. In a function call chain A -> B -> C, C must return before B, and B before A. The stack enforces that order structurally. In expression parsing, an opening bracket pushed onto the stack must match the next closing bracket, not some older one. The LIFO rule makes the match automatic.',
        'The invariant also explains why the output order is reversed. If you push 1, 2, 3 and then pop three times, you get 3, 2, 1. Every pop returns the newest remaining item, so the sequence inverts. This reversal property is what makes stacks natural for undo, backtracking, and depth-first exploration.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Push, pop, and peek are each O(1). Array-backed push is amortized O(1) with capacity doubling; linked-list push is worst-case O(1). Space is O(n) for n stored items, plus minor overhead for unused array capacity or per-node pointers.',
        'Doubling means the array rarely resizes. After n pushes, the total cost of all resizes is about 2n, so each push pays roughly 2 units of work on average. When n doubles from 1,000 to 2,000, the stack handles it with one resize and 1,000 constant-time pushes.',
        'There is no O(1) search, no random access, and no way to inspect the k-th item without popping k items first. The stack earns its speed by refusing every operation except touching the top. If you need to find an item by value, you need a different structure.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Function call stacks: every CPU architecture has a hardware stack pointer. When a function is called, the return address and local variables are pushed onto the call stack. When the function returns, they are popped. Every program you run depends on this.',
        'Expression evaluation: the Shunting-yard algorithm (Dijkstra, 1961) uses an operator stack to convert infix expressions like 3 + 4 * 5 into postfix order that a machine can evaluate left to right. A second stack evaluates the postfix result by pushing operands and popping them when an operator arrives.',
        'Depth-first search: DFS explores one path as deep as possible before backtracking. Recursive DFS uses the call stack implicitly. Iterative DFS uses an explicit stack, giving the programmer control over memory and the ability to pause, resume, or cancel traversal.',
        'Undo and redo: each user action pushes onto the undo stack. Undo pops the most recent action and pushes it onto a redo stack. Redo reverses the process. The stack ensures you always undo the last thing you did, not the first.',
        'Bracket matching: push every opening bracket. When a closing bracket arrives, pop and check that the opener matches. If the stack is empty at the end and every match succeeded, the brackets are balanced.',
        'Browser back button: each page visit pushes a URL. Pressing Back pops the most recent URL and navigates there. The history is a stack.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No random access. If you need the third item from the bottom, you must pop everything above it. If you are searching for a value, you must pop until you find it or empty the stack. Both are O(n) and destructive.',
        'FIFO problems need a queue, not a stack. Print jobs, customer service tickets, and breadth-first search all require oldest-first processing. Using a stack would serve the newest request first and starve older ones.',
        'Deep recursion can overflow the call stack. The runtime call stack is typically around 1 MB, enough for a few thousand frames. A recursive DFS on a graph with 100,000 nodes in a straight chain will crash. Converting to an explicit heap-allocated stack avoids this, but adds verbosity.',
        'Backtracking can hide exponential cost. The stack records branch points cleanly, but the number of branches can explode. Regex backtracking engines, brute-force game search, and recursive combinatorics all look tidy as stack code but run forever without pruning or memoization.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with an empty stack. Push 5: stack is [5], top is 5. Push 3: stack is [5, 3], top is 3. Push 8: stack is [5, 3, 8], top is 8.',
        'Pop: returns 8, stack is [5, 3], top is 3. The most recently pushed item (8) left first.',
        'Peek: returns 3 without removing it. Stack is still [5, 3].',
        'Push 1: stack is [5, 3, 1], top is 1. Pop: returns 1, stack is [5, 3]. Pop: returns 3, stack is [5].',
        'The output sequence from all pops is 8, 1, 3. Each pop returned whatever was on top at that moment. The LIFO rule held at every step: the most recently pushed item not yet popped was always the one returned.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Samelson and Bauer, "Sequentielle Formelubersetzung" (1957) formalized the stack as an abstract data type for expression translation. The 1946 ACE report by Turing described return-address stacks for subroutine calls. Dijkstra 1961 Shunting-yard algorithm demonstrated stack-based expression parsing.',
        'Study Queue next for the opposite access rule (FIFO). Revisit Recursion to see the call stack in action. Linked List shows the pointer-based stack implementation. Tree Traversals and depth-first search make the choice between stack and queue visible in traversal order. Expression parsing (Shunting-yard) and bracket matching are direct stack applications worth implementing.',
      ],
    },
  ],
};
