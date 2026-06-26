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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation draws a call tree. A stack frame is one active function call with its own argument, local variables, and return address. The active frame is executing now; waiting frames are paused until their child calls return.',
        'Watch the descent and the unwind separately. Descent creates smaller calls until a base case returns without calling again. Unwind sends values back upward, so each waiting parent can finish its own computation.',
        {type: `callout`, text: `Recursion is stack-managed delegation: each frame owns one smaller promise and waits until the base case starts the return path.`},
      
        {type: 'image', src: './assets/gifs/recursion.gif', alt: 'Animated walkthrough of the recursion visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Recursion exists because some data is built from smaller data of the same kind. A tree node owns child trees. A folder can contain folders. A grammar rule can contain smaller grammar rules.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/2/24/Tree_graph.svg`, alt: `Labeled tree graph with six vertices and five edges`, caption: `A tree makes recursion natural because each child subtree has the same shape as the parent problem. Source: https://commons.wikimedia.org/wiki/File:Tree_graph.svg.`},
        'A recursive function lets the code match that shape. It handles one layer directly and delegates each smaller layer to the same rule. The call stack stores the unfinished work so the programmer does not have to build that stack by hand.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a loop. For an array sum or a factorial, a counter and an accumulator are clear. Each pass updates state and moves to the next item.',
        'Loops are also easier to predict for memory. There is one frame, one set of variables, and no hidden call depth. For flat repeated work, iteration is usually the simplest tool.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the input is nested rather than flat. An iterative tree traversal needs an explicit stack of nodes to visit. An in-order traversal also needs state about whether the left side has already been processed.',
        'The loop is still possible, but it starts simulating the call stack. The programmer must push children, pop the next node, and remember where each suspended computation should resume. Recursive code often states the same traversal in the shape of the data itself.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A recursive solution needs a base case and a smaller recursive case. The base case stops descent. The recursive case reduces the input and trusts the same function to solve the smaller problem.',
        'The key invariant is progress toward the base case. If every call moves to a strictly smaller input, the chain cannot descend forever. If that progress is missing, recursion becomes an infinite loop with stack frames.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Calling a function creates a stack frame. In recursion, the new frame is for the same function, but with a smaller argument or a smaller piece of data. The caller waits with its local state preserved.',
        'For factorial, factorial(n) returns n * factorial(n - 1), and factorial(0) returns 1. factorial(5) waits for factorial(4), which waits for factorial(3), until factorial(0) returns. Then the products form on the way back up.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is usually proved by induction. First prove the base case directly. Then assume the function is correct for smaller inputs and show that the current call combines those smaller answers correctly.',
        'For factorial, the base case says 0! = 1. If factorial(n - 1) returns (n - 1)!, then n * factorial(n - 1) returns n!. The same proof shape applies to tree traversal: if each child subtree is processed correctly, processing the current node in the right position gives a correct whole-tree traversal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Linear recursion such as factorial makes n + 1 calls and keeps O(n) frames at maximum depth. Doubling n doubles the work and doubles the deepest stack. JavaScript engines usually do not eliminate that stack growth.',
        'Branching recursion can grow much faster. Naive Fibonacci calls fib(n - 1) and fib(n - 2), so subproblems repeat. fib(6) recomputes fib(3) several times; memoization stores those answers and changes the behavior from exponential growth to linear subproblem count.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Recursion is a natural fit for syntax trees, DOM trees, file trees, expression evaluators, and divide-and-conquer algorithms. Each node or slice asks the same question of smaller pieces.',
        'Parsers use recursive descent when grammar rules refer to sub-rules. Search algorithms use recursion for backtracking because each choice creates a smaller remaining problem and an automatic return point.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Recursion fails when depth can exceed the call-stack limit. A linked list with one million nodes can crash a recursive traversal even though the algorithm is logically simple. An explicit stack is safer for untrusted depth.',
        'It also fails when the same subproblem appears many times and no cache is used. Naive Fibonacci is the standard warning: the definition is short, but the computation repeats work until runtime explodes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Compute factorial(5). The calls are factorial(5), factorial(4), factorial(3), factorial(2), factorial(1), factorial(0). At the deepest point there are six frames, and only factorial(0) can return immediately.',
        'The return path is 1, then 1 * 1 = 1, then 2 * 1 = 2, then 3 * 2 = 6, then 4 * 6 = 24, then 5 * 24 = 120. Each frame needed only its own n and the child result. The stack supplied the waiting room.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary historical source: John McCarthy, Recursive Functions of Symbolic Expressions and Their Computation by Machine, Part I, 1960. Standard references include Structure and Interpretation of Computer Programs and CLRS chapters on divide-and-conquer.',
        'Study next: stacks to understand frames, depth-first search for recursive traversal, memoization for repeated subproblems, and dynamic programming for turning recursive structure into stored subproblem tables.',
      ],
    },
  ],
};