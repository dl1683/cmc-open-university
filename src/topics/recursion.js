// Recursion, visualized as the call tree it really is: every call opens a
// frame, waits on its children, and returns a value to its parent.

import { callTreeState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'recursion',
  title: 'Recursion',
  category: 'Concepts',
  summary: 'Watch a function call itself — frames open, hit base cases, and return upward.',
  controls: [
    { id: 'fn', label: 'Function', type: 'select', options: ['fibonacci', 'factorial'], defaultValue: 'fibonacci' },
    { id: 'n', label: 'n', type: 'number', defaultValue: '5' },
  ],
  run,
};

export function* run(input) {
  const fn = input.fn === 'factorial' ? 'factorial' : 'fibonacci';
  const n = parseIntegerInRange(input.n, { min: 1, max: fn === 'fibonacci' ? 7 : 8, label: 'n' });

  const frames = new Map(); // id -> {id, parentId, name, args, status, result}
  let counter = 0;
  let calls = 0;
  const snapshot = () => callTreeState([...frames.values()], { calls });
  const name = fn === 'fibonacci' ? 'fib' : 'fact';

  yield {
    state: callTreeState([]),
    highlight: {},
    explanation: fn === 'fibonacci'
      ? `fib(n) = fib(n - 1) + fib(n - 2), with fib(1) = fib(2) = 1. The rule is safe only because each call asks smaller questions that eventually hit a base case.`
      : `fact(n) = n * fact(n - 1), with fact(1) = 1. The rule is safe only because each call moves one step closer to the base case.`,
  };

  const trace = fn === 'fibonacci' ? traceFib : traceFact;
  const finalResult = yield* trace(n, null);

  yield {
    state: snapshot(),
    highlight: { returning: [rootId()] },
    explanation: fn === 'fibonacci'
      ? `Done: fib(${n}) = ${finalResult}, after ${calls} calls. The repeated subtrees show the tax: naive recursion recomputes answers it already learned. Memoization fixes that by remembering each fib(k) once.`
      : `Done: fact(${n}) = ${finalResult}, after ${calls} calls. This call tree is only a chain, so a loop can do the same work with less stack. Recursion earns its keep when the problem shape is naturally recursive.`,
  };

  function rootId() {
    for (const frame of frames.values()) if (frame.parentId === null) return frame.id;
    return frames.keys().next().value;
  }

  function openFrame(arg, parentId) {
    const id = `f${counter++}`;
    calls += 1;
    frames.set(id, { id, parentId, name, args: arg, status: 'active', result: null });
    return id;
  }

  function* close(id, result, why) {
    const frame = frames.get(id);
    frame.status = 'returned';
    frame.result = result;
    yield {
      state: snapshot(),
      highlight: { returning: [id] },
      explanation: why,
    };
  }

  function* traceFib(k, parentId) {
    const id = openFrame(k, parentId);
    if (k <= 2) {
      yield {
        state: snapshot(),
        highlight: { active: [id] },
        explanation: `fib(${k}) is a base case, so it returns 1 without opening more frames. Base cases are the floor that keeps recursion from falling forever.`,
      };
      yield* close(id, 1, `fib(${k}) returns 1 to its caller, giving the waiting parent one finished child result to combine.`);
      return 1;
    }

    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fib(${k}) is not a base case. It cannot answer until two smaller calls answer: fib(${k - 1}) and fib(${k - 2}). This frame waits on its children.`,
      invariant: 'A frame can only return after every call below it has returned.',
    };
    frames.get(id).status = 'waiting';

    const a = yield* traceFib(k - 1, id);
    frames.get(id).status = 'active';
    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fib(${k - 1}) returned ${a}. The parent frame keeps that value, but it still cannot return until fib(${k - 2}) answers.`,
    };
    frames.get(id).status = 'waiting';

    const b = yield* traceFib(k - 2, id);
    frames.get(id).status = 'active';
    yield* close(id, a + b, `Both child answers are in, so fib(${k}) = ${a} + ${b} = ${a + b}. The waiting frame has enough information to return upward to its own caller.`);
    return a + b;
  }

  function* traceFact(k, parentId) {
    const id = openFrame(k, parentId);
    if (k <= 1) {
      yield {
        state: snapshot(),
        highlight: { active: [id] },
        explanation: `fact(1) is the base case, so it returns 1 immediately. The descent stops here and the waiting frames can unwind.`,
      };
      yield* close(id, 1, 'fact(1) returns 1, and the chain of waiting frames starts collapsing upward.');
      return 1;
    }

    yield {
      state: snapshot(),
      highlight: { active: [id] },
      explanation: `fact(${k}) wants ${k} * fact(${k - 1}), but it cannot multiply until the smaller call returns. The frame waits with ${k} saved on the stack.`,
      invariant: 'A frame can only return after every call below it has returned.',
    };
    frames.get(id).status = 'waiting';

    const sub = yield* traceFact(k - 1, id);
    frames.get(id).status = 'active';
    yield* close(id, k * sub, `fact(${k - 1}) returned ${sub}, so fact(${k}) = ${k} * ${sub} = ${k * sub}. Work that was paused on the way down finishes on the way back up.`);
    return k * sub;
  }
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Recursion exists because many problems contain smaller copies of themselves. A folder contains folders. A tree node has child trees. A parser reads an expression made from smaller expressions. In those cases, a function that can solve the smaller case can often solve the whole case.`,
        `Every recursive solution needs two parts: a base case that stops and a recursive case that makes the problem smaller. Without the base case, calls never bottom out. Without real progress toward it, the program burns through the call stack until it crashes.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious approach for a repeated shape is to write the answer in terms of the smaller shape. Factorial is n times the factorial of n - 1. A tree traversal visits a node, then traverses its children. This is reasonable because the code mirrors the definition of the data.`,
        `The wall is hidden cost. Some recursion forms a straight chain, like factorial. Some forms a branching tree, like naive Fibonacci. Branching can repeat the same subproblem many times. Recursion can also fail by going too deep for the JavaScript call stack, even when the total work is otherwise simple.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `A recursive function is a promise: if smaller calls return correct answers, the current frame knows how to combine them into a correct larger answer. The base case anchors the promise. The recursive case reduces the problem until it reaches that anchor.`,
        `The shape of the call tree matters more than the fact that the code calls itself. A chain costs one frame per level. A branching tree can grow explosively. A divide-and-conquer tree may still be efficient if each level does controlled work.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `Inspect recursion as a call tree plus a stack. The tree shows the mathematical dependency structure: which smaller problems are being asked. The stack shows runtime reality: which frames are currently unfinished and what each frame is waiting to receive.`,
        `The most important question is whether the call tree is a chain, a balanced divide-and-conquer tree, or a branching tree with repeated subproblems. That shape determines cost. The code may look compact while the call tree grows far larger than the input suggests.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A JavaScript function call creates a frame with arguments, local variables, and a return location. The engine pushes that frame onto the call stack. When the function calls itself, a new frame goes on top. A frame cannot finish until the frames above it finish, which is exactly the Last-In, First-Out behavior taught by Stack.`,
        `Think of each call as an unfinished question. fact(4) asks "what is 4 times fact(3)?" and pauses. fact(3) asks the smaller version, and so on. When fact(1) returns 1, the answers unwind upward. For Fibonacci, a frame waits for two child answers before it can add them.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Correctness is usually an induction argument. The base case is correct directly. Then assume the recursive calls solve smaller inputs correctly. If the current frame combines those smaller answers according to the problem rule, the current answer is correct too.`,
        `Factorial shows the chain version: if fact(k - 1) is correct, then k * fact(k - 1) is fact(k). Tree traversals show the structural version: if the left subtree and right subtree are traversed correctly, then visiting the current node in the chosen order builds the correct whole traversal.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The cost depends on the call tree. Factorial does n calls, so it is O(n) time and O(n) stack space. Naive Fibonacci is exponential, often described as O(2^n) and more tightly O(phi^n), because it recomputes the same values again and again. Memoization (Dynamic Programming) stores each Fibonacci result once, turning the time into O(n).`,
        `Stack space is not optional. Each unfinished call needs a frame. A million-step chain may be easy for a loop and still unsafe for recursion in JavaScript because engines have finite call stacks. Big-O Growth Rates helps expose both time growth and hidden repeated work.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Divide-and-conquer algorithms use recursion because the problem literally splits into smaller problems. Merge Sort sorts the left half, sorts the right half, then merges. Quick Sort partitions around a pivot, then sorts the left and right partitions. Binary Search can be written recursively too, although the iterative version uses less stack space.`,
        `Tree-shaped data is the strongest use case. File systems, DOM trees, syntax trees, and JSON documents all contain smaller structures of the same kind. Graph algorithms need more care because graphs can have cycles; Graph BFS uses a FIFO queue explicitly, while recursive depth-first search must track a visited set or it may loop forever. Backtracking solvers for Sudoku, mazes, constraint problems, and some regex engines also fit the pattern: choose, recurse, undo, try the next choice.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Recursion fails when the base case is missing, unreachable, or not getting closer. It also fails when a simple long chain exceeds the call stack. Do not rely on tail-call optimization being available across browsers and Node runtimes.`,
        `The common misconception is that recursive code is either always elegant or always slow. Neither is true. The design question is "what call tree am I creating?" A balanced tree traversal is natural. Naive Fibonacci is a repeated-subproblem trap. A million-step linear process usually wants a loop.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `Consider rendering a nested comment thread. Each comment can have replies, and each reply can have more replies. The recursive shape is direct: render the current comment, then render the list of child comments with one more level of indentation. The base case is a comment with no replies.`,
        `The same case has real limits. A malicious or imported thread could be thousands of levels deep and overflow the stack. A production renderer may cap depth, convert the traversal to an explicit Stack, or stream batches so the UI stays responsive. Recursion explains the structure; engineering still chooses the safe execution strategy.`,
      ],
    },
    {
      heading: `What to remember`,
      paragraphs: [
        `Recursion is not a style preference. It is a way to express self-similar structure while relying on the call stack to remember unfinished work. The base case, progress measure, and call-tree shape are the core of the technique.`,
        `For course design, teach recursion beside Stack and induction. Students should learn to ask three questions before writing code: what is the base case, what gets smaller, and how many frames or repeated subproblems does this create?`,
        `A good recursion explanation should always include the return path. Beginners often understand the descent but miss the unwind, where waiting frames receive child answers and finish their own work. The stack is not only where calls go down; it is where unfinished obligations come back up.`,
        `When the call tree repeats the same subproblem, the next lesson is memoization. When the call depth is too large, the next lesson is an explicit Stack or Queue. Recursion is therefore a gateway topic: it teaches structure first, then forces students to choose the right execution strategy.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `References: MDN's recursion glossary entry at https://developer.mozilla.org/en-US/docs/Glossary/Recursion and Eloquent JavaScript's recursion discussion at https://eloquentjavascript.net/03_functions.html. Study Stack to understand the call stack directly. Then read Memoization (Dynamic Programming) to see repeated subproblems collapse from exponential to linear work. Big-O Growth Rates helps you judge the call tree. Regex Backtracking & ReDoS Case Study shows recursive choice search turning into a production latency bug. Zipper Focused Tree shows recursion turned into a navigable focus plus breadcrumbs. Dancing Links & Exact Cover shows recursive backtracking paired with reversible sparse-matrix state. Merge Sort, Quick Sort, Tree Traversals, and Graph BFS show where recursion competes with or complements explicit data structures.`,
      ],
    },
  ],
};
