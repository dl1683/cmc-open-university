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
      heading: 'What it is',
      paragraphs: [
        'Abstract interpretation is a mathematical way to run a program analysis over approximations instead of exact executions. Rather than enumerate every possible state, the analyzer maps concrete states into an abstract domain that is smaller and computable.',
        'The interval domain is the most approachable example. Instead of knowing x exactly, the analyzer knows x is in [lo, hi]. That is enough to prove some array bounds, overflow checks, loop invariants, and dead branches, while admitting that some cases are unknown.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The analysis uses the Data-Flow Worklist Analysis skeleton. Each program point has an abstract state. Transfer functions update abstract states through assignments and branches. Joins merge states from multiple predecessors. The result must over-approximate every concrete execution so that a proven-safe result is meaningful.',
        'Loops are the hard part. Plain joining can ascend forever: [1,1], [1,2], [1,3], and so on. Widening forces convergence by jumping to a broader interval such as [1,+inf]. Narrowing can then use branch conditions, such as x < 10000, to recover a tighter upper bound.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For x = 1; while (x < 10000) x = x + 1; return x, the loop head first sees [1,1]. After one body pass, the backedge brings [2,2], and the join becomes [1,2]. Without widening this keeps growing. With widening, the analyzer may jump to [1,+inf], then narrow under the loop guard to [1,9999] inside the loop and [10000,+inf] or a tighter exit interval outside, depending on the transfer functions.',
        'This is the key tradeoff: the result is sound but may be imprecise. If an alarm remains, the analyzer is saying it could not prove safety in its chosen abstraction. A better domain or a targeted Symbolic Execution Path Constraints pass may discharge the alarm.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'A real analyzer needs a lattice for abstract values, a bottom value for unreachable states, a join, a widening operator, and transfer functions for language operations. It also needs precise CFG edges for exceptions, short-circuit logic, function calls, and library models.',
        'Good reports explain the path, the abstract fact, and the lost precision point. Without that trace, users see only noisy warnings. With it, abstract interpretation becomes a practical engineering tool rather than a black box.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Cousot MIT abstract interpretation lecture at https://web.mit.edu/16.399/www/lecture_01-intro/Cousot_MIT_2005_Course_01_4-1.pdf, Cousot dynamic interval analysis overview at https://pcousot.github.io/publications/Cousot-Klaus-Havelund-Festschrift.pdf, Clang data-flow intro at https://clang.llvm.org/docs/DataFlowAnalysisIntro.html, and Bruno Blanchet abstract interpretation notes at https://bblanche.gitlabpages.inria.fr/absint.pdf. Study Data-Flow Worklist Analysis, eBPF Verifier Register State Case Study, Taint Analysis Source-to-Sink Case Study, Symbolic Execution Path Constraints, and Linear Scan Register Allocation next.',
      ],
    },
  ],
};
