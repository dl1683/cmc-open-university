// Abstract interpretation: compute sound approximations over abstract values
// such as intervals, using joins and widening to converge.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'abstract-interpretation-interval-domain',
  title: 'Abstract Interpretation & Interval Domain',
  category: 'Concepts',
  summary: 'Approximate all executions with a sound abstract domain: intervals, joins, widening, narrowing, and alarms when a proof cannot rule out a bug.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['interval loop', 'widen and narrow'], defaultValue: 'interval loop' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function aiGraph(title) {
  return graphState({
    nodes: [
      { id: 'program', label: 'program', x: 0.9, y: 3.8, note: 'many runs' },
      { id: 'concrete', label: 'states', x: 2.5, y: 2.2, note: 'huge' },
      { id: 'abstract', label: 'domain', x: 2.5, y: 5.3, note: 'compact' },
      { id: 'interval', label: 'interval', x: 4.5, y: 5.3, note: '[lo,hi]' },
      { id: 'transfer', label: 'transfer', x: 5.2, y: 2.5, note: 'sound' },
      { id: 'join', label: 'join', x: 7.0, y: 3.8, note: 'merge' },
      { id: 'widen', label: 'widen', x: 8.7, y: 2.3, note: 'force stop' },
      { id: 'alarm', label: 'alarm', x: 8.7, y: 5.3, note: 'unknown' },
    ],
    edges: [
      { id: 'e-program-concrete', from: 'program', to: 'concrete' },
      { id: 'e-program-abstract', from: 'program', to: 'abstract' },
      { id: 'e-abstract-interval', from: 'abstract', to: 'interval' },
      { id: 'e-concrete-transfer', from: 'concrete', to: 'transfer' },
      { id: 'e-interval-transfer', from: 'interval', to: 'transfer' },
      { id: 'e-transfer-join', from: 'transfer', to: 'join' },
      { id: 'e-join-widen', from: 'join', to: 'widen' },
      { id: 'e-join-alarm', from: 'join', to: 'alarm' },
    ],
  }, { title });
}

function* intervalLoop() {
  yield {
    state: aiGraph('Abstract interpretation tracks sets of states compactly'),
    highlight: { active: ['program', 'abstract', 'interval', 'e-program-abstract', 'e-abstract-interval'], compare: ['concrete'] },
    explanation: 'A concrete run has exact values. Abstract interpretation replaces many concrete states with one abstract value. The interval domain represents every possible value of x as [low, high].',
  };
  yield {
    state: labelMatrix(
      'Interval loop',
      [
        { id: 'entry', label: 'x = 1' },
        { id: 'head1', label: 'loop head 1' },
        { id: 'body', label: 'x = x + 1' },
        { id: 'head2', label: 'loop head 2' },
      ],
      [
        { id: 'interval', label: 'x interval' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['[1,1]', 'exact init'],
        ['[1,1]', 'first visit'],
        ['[2,2]', 'after body'],
        ['[1,2]', 'join paths'],
      ],
    ),
    highlight: { active: ['entry:interval', 'body:interval'], found: ['head2:interval'], compare: ['head1:interval'] },
    explanation: 'The loop head sees two paths: the initial entry path and the backedge path. Joining [1,1] and [2,2] gives [1,2]. Repeating this process keeps expanding the interval.',
    invariant: 'A sound interval must contain every real value that can arrive there.',
  };
  yield {
    state: aiGraph('A warning means not proven safe, not automatically unsafe'),
    highlight: { active: ['interval', 'transfer', 'join', 'alarm'], found: ['e-join-alarm'], compare: ['widen'] },
    explanation: 'If an interval for i is [0, 20] and the array length is 10, the analyzer cannot prove the access safe. That creates an alarm even if some concrete paths would never hit the bad index.',
  };
}

function* widenAndNarrow() {
  yield {
    state: labelMatrix(
      'Widening and narrowing',
      [
        { id: 'slow', label: 'plain join' },
        { id: 'wide', label: 'widen' },
        { id: 'narrow', label: 'narrow' },
        { id: 'alarm', label: 'alarm' },
      ],
      [
        { id: 'result', label: 'result' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['[1,2],[1,3]...', 'may take long'],
        ['[1,+inf]', 'terminates fast'],
        ['[1,9999]', 'recovers precision'],
        ['possible bug', 'needs triage'],
      ],
    ),
    highlight: { active: ['wide:result', 'narrow:result'], compare: ['slow:tradeoff'], found: ['alarm:result'] },
    explanation: 'Widening deliberately loses precision to force convergence over loops. Narrowing then tries to recover some precision after the widening point stabilizes.',
  };
  yield {
    state: aiGraph('The abstract domain is a design choice'),
    highlight: { active: ['abstract', 'interval', 'transfer', 'join'], found: ['widen'], compare: ['alarm'] },
    explanation: 'Intervals are easy to visualize, but other domains track signs, nullness, shapes, ownership, string constraints, or relational facts. Better domains reduce false positives but cost more.',
  };
  yield {
    state: aiGraph('Abstract interpretation sits under many analyzers'),
    highlight: { active: ['program', 'abstract', 'transfer', 'alarm'], visited: ['join', 'widen'], found: ['interval'] },
    explanation: 'Static analyzers use abstract interpretation to scale beyond tests. The analyzer over-approximates behavior, proves what it can, and reports the remaining uncertain paths for humans or deeper tools.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'interval loop') yield* intervalLoop();
  else if (view === 'widen and narrow') yield* widenAndNarrow();
  else throw new InputError('Pick an abstract-interpretation view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Testing tells you what happened on the runs you executed. Static analysis often needs a stronger kind of answer: can this array index ever exceed the array length, can this counter ever become negative, can this loop violate an invariant for any input?',
        'Abstract interpretation exists to make those questions computable. Instead of trying to list every concrete state of the program, it summarizes many possible states with one abstract value that is small enough to propagate through the control-flow graph.',
        {type: 'callout', text: 'Abstract interpretation wins by proving over a safe summary of all states, accepting false alarms instead of missing real executions.'},
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        'The obvious approach is exhaustive execution: try every input, follow every branch, and record every value. For toy programs that can work. For real programs it immediately runs into infinite input domains, unbounded loops, and path counts that grow faster than the analyzer can store.',
        'Symbolic execution attacks the same wall with constraints, but it can still drown in paths and solver queries. Abstract interpretation takes a different bargain. It gives up exact values in exchange for a conservative summary that can cover all executions at once.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace a set of possible values with an abstract value. In the interval domain, the possible values of `x` become a range such as `[0, 10]` or `[1, +inf]`. The analyzer no longer knows whether `x` is exactly 3, but it may know enough to prove that `x` is never negative or never larger than an array bound.',
        'The contract is soundness. The abstract value must contain every concrete value that could really occur. It may contain extra values that are impossible in the real program. Those extra values cause false alarms, but they are the price of not missing real executions.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the interval-loop view, read each row as the analyzer revisiting a program point with a broader fact about `x`. The loop head is the important place: it receives the initial path and the backedge path, then joins them into one interval.',
        'In the widen-and-narrow view, the jump to `[1,+inf]` is intentional precision loss. It is not the analyzer giving up; it is the analyzer forcing a loop to converge. Narrowing then uses guards and transfer functions to recover facts that widening blurred.',
        'An alarm means "not proven safe in this abstraction." It is not automatically a bug. It is also not noise to ignore. It marks the point where the current domain could not rule out a bad concrete execution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The engine usually looks like Data-Flow Worklist Analysis. Each program point has an abstract state. Transfer functions update that state through assignments, arithmetic, branches, calls, and memory operations. Joins merge facts from multiple predecessors.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Directed edges help show how abstract facts move through program points until a fixed point is reached. Source: Wikimedia Commons, David W., public domain.'},
        'For intervals, assignment is interval arithmetic. If `x` is `[1, 4]`, then `x + 1` is `[2, 5]`. If a branch says `x < 10`, the true side can intersect the interval with `[-inf, 9]` for integer code. If two paths meet with `[1, 3]` and `[8, 12]`, their join is `[1, 12]`.',
        'Loops require a fixed point: keep applying transfer and join until no abstract state changes. Plain joining can ascend forever: `[1,1]`, `[1,2]`, `[1,3]`, and so on. Widening accelerates convergence by jumping to a stable broader interval such as `[1,+inf]`. Narrowing then runs a few more passes to regain precision from guards.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof obligation is local. Every transfer function must over-approximate the concrete operation it models, and every join must contain the values from all incoming paths. If those local pieces are sound, the fixed point over the CFG over-approximates all executions represented by the model.',
        'Widening preserves soundness because it grows the abstract value instead of deleting real states. It may introduce impossible values, but it does not remove possible ones. That is why widening can create false alarms while still supporting sound proofs of safety.',
        'A safety proof is valid only inside the modeled language semantics. Integer overflow rules, exceptions, aliasing, dynamic dispatch, reflection, native calls, and library summaries all have to match the program being analyzed. An elegant interval lattice does not save an analyzer from a wrong model.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take `x = 1; while (x < 10000) x = x + 1; return x`. At entry, `x` is `[1,1]`. After one loop body, the backedge brings `[2,2]`. Joining entry and backedge gives `[1,2]`. Another pass gives `[1,3]`. Without widening, the analyzer can keep climbing one integer at a time.',
        'With widening at the loop head, the sequence may jump from `[1,2]` to `[1,+inf]`. The loop guard `x < 10000` can narrow the in-loop state to `[1,9999]`. The exit side can infer that the loop condition is false, so `x >= 10000`; a precise transfer can conclude the returned value is `[10000,10000]`, while a rougher one may return `[10000,+inf]`.',
        'Now put `arr[x]` inside the loop for an array of length 10000. If the analyzer has `[1,9999]`, it can prove the access safe. If widening left it at `[1,+inf]`, it must warn. The warning is a precision failure, not proof of an out-of-bounds access.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Intervals are cheap. Each tracked numeric value needs a lower bound and an upper bound, plus operations for arithmetic, join, comparison, widening, and narrowing. That makes the domain attractive for large codebases and for analyzers that need predictable runtime.',
        'The tradeoff is lost relationships. If `x == y` always holds, separate intervals for `x` and `y` forget that fact. If `i < len` is true only because the two variables move together, the interval domain may warn even when the concrete program is safe.',
        'More precise domains can track signs, congruences, octagons, polyhedra, symbolic equalities, nullness, shapes, ownership, strings, or taint. They reduce some false positives but cost more per operation and require more complicated transfer functions. There is no free domain.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'The interval domain wins when the property is mostly about numeric range: bounds checks, integer overflow, loop counters, simple guards, dead branches, and monotone resource limits. It is also a strong teaching domain because the abstraction is visible and easy to test by hand.',
        'It fails when the proof needs relationships, data structure shape, heap aliasing, path-sensitive facts, or semantic knowledge of library calls. In those cases a production analyzer may refine the warning with a relational domain, SMT query, path split, function summary, or symbolic execution pass.',
        'Good reports explain the abstract fact that triggered the alarm and where precision was lost. A warning that says only "possible out of bounds" is hard to act on. A warning that says "`i` widened to `[0,+inf]` at this loop head, so the analyzer cannot prove `i < len`" teaches the user what to inspect.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cousot MIT abstract interpretation lecture at https://web.mit.edu/16.399/www/lecture_01-intro/Cousot_MIT_2005_Course_01_4-1.pdf, Cousot dynamic interval analysis overview at https://pcousot.github.io/publications/Cousot-Klaus-Havelund-Festschrift.pdf, Clang data-flow intro at https://clang.llvm.org/docs/DataFlowAnalysisIntro.html, and Bruno Blanchet abstract interpretation notes at https://bblanche.gitlabpages.inria.fr/absint.pdf.',
        'Study Data-Flow Worklist Analysis for the fixed-point engine, eBPF Verifier Register State Case Study for a production-flavored abstract state, Taint Analysis Source-to-Sink Case Study for another static-analysis goal, Symbolic Execution Path Constraints for concrete witnesses, and Linear Scan Register Allocation for another interval-shaped abstraction.',
      ],
    },
  ],
};
