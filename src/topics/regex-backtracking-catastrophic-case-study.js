// Regex backtracking: a choice stack explores one parse path at a time. On
// ambiguous repeated groups, a failing suffix can force exponential retries.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'regex-backtracking-catastrophic-case-study',
  title: 'Regex Backtracking & ReDoS Case Study',
  category: 'Concepts',
  summary: 'See how a backtracking regex engine stores choices on a stack, why patterns like (a+)+$ explode, and how Thompson/RE2-style engines avoid ReDoS failure modes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['choice stack', 'linear engines'], defaultValue: 'choice stack' },
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

function engineGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pattern', label: 'pattern', x: 0.6, y: 4.0, note: notes.pattern ?? '^(a+)+$' },
      { id: 'input', label: 'input', x: 2.2, y: 4.0, note: notes.input ?? 'aaaa!' },
      { id: 'greedy', label: 'greedy', x: 3.9, y: 2.4, note: notes.greedy ?? 'eat aaaa' },
      { id: 'stack', label: 'stack', x: 5.6, y: 4.0, note: notes.stack ?? 'choices' },
      { id: 'fail', label: 'fail', x: 7.2, y: 2.4, note: notes.fail ?? '! vs $' },
      { id: 'retry', label: 'retry', x: 7.2, y: 5.8, note: notes.retry ?? 'give back a' },
      { id: 'time', label: 'time', x: 9.1, y: 4.0, note: notes.time ?? 'explodes' },
    ],
    edges: [
      { id: 'e-pattern-input', from: 'pattern', to: 'input', weight: '' },
      { id: 'e-input-greedy', from: 'input', to: 'greedy', weight: '' },
      { id: 'e-greedy-stack', from: 'greedy', to: 'stack', weight: '' },
      { id: 'e-stack-fail', from: 'stack', to: 'fail', weight: '' },
      { id: 'e-fail-retry', from: 'fail', to: 'retry', weight: '' },
      { id: 'e-retry-stack', from: 'retry', to: 'stack', weight: '' },
      { id: 'e-stack-time', from: 'stack', to: 'time', weight: '' },
    ],
  }, { title });
}

function comparisonGraph(title) {
  return graphState({
    nodes: [
      { id: 'regex', label: 'regex', x: 0.8, y: 4.0, note: 'same syntax' },
      { id: 'back', label: 'backtrack', x: 2.8, y: 2.2, note: 'choice stack' },
      { id: 'nfa', label: 'Thompson', x: 2.8, y: 5.8, note: 'active set' },
      { id: 'fail', label: 'bad suffix', x: 5.2, y: 2.2, note: 'retry tree' },
      { id: 'frontier', label: 'frontier', x: 5.2, y: 5.8, note: 'one set' },
      { id: 'redos', label: 'ReDoS', x: 7.5, y: 2.2, note: 'CPU burn' },
      { id: 'safe', label: 'safe', x: 7.5, y: 5.8, note: 'bounded' },
      { id: 'service', label: 'service', x: 9.3, y: 4.0, note: 'latency' },
    ],
    edges: [
      { id: 'e-regex-back', from: 'regex', to: 'back', weight: '' },
      { id: 'e-regex-nfa', from: 'regex', to: 'nfa', weight: '' },
      { id: 'e-back-fail', from: 'back', to: 'fail', weight: '' },
      { id: 'e-nfa-frontier', from: 'nfa', to: 'frontier', weight: '' },
      { id: 'e-fail-redos', from: 'fail', to: 'redos', weight: '' },
      { id: 'e-frontier-safe', from: 'frontier', to: 'safe', weight: '' },
      { id: 'e-redos-service', from: 'redos', to: 'service', weight: '' },
      { id: 'e-safe-service', from: 'safe', to: 'service', weight: '' },
    ],
  }, { title });
}

function growthPlot() {
  const points = [4, 6, 8, 10, 12, 14].map((n) => ({ x: n, y: 2 ** (n - 1) }));
  return plotState({
    axes: { x: { label: 'number of a characters' }, y: { label: 'candidate partitions' } },
    series: [{ id: 'paths', label: 'rough backtracking paths', points }],
    markers: [
      { id: 'n10', x: 10, y: 2 ** 9, label: '512' },
      { id: 'n14', x: 14, y: 2 ** 13, label: '8192' },
    ],
  }, { title: 'Ambiguous repetitions create a retry tree' });
}

function* choiceStack() {
  yield {
    state: engineGraph('Backtracking explores one interpretation at a time'),
    highlight: { active: ['pattern', 'input', 'greedy', 'stack'], compare: ['time'] },
    explanation: 'For ^(a+)+$, the inner a+ and outer + both create choices. A backtracking engine greedily consumes the a characters, records places where it could give some back, then checks the final $.',
    invariant: 'Backtracking stores deferred alternatives on a stack.',
  };

  yield {
    state: labelMatrix(
      'The failure on aaaa!',
      [
        { id: 'try1', label: 'try 1' },
        { id: 'try2', label: 'try 2' },
        { id: 'try3', label: 'try 3' },
        { id: 'try4', label: 'try 4' },
      ],
      [
        { id: 'groups', label: 'group split' },
        { id: 'suffix', label: '$ sees' },
        { id: 'result', label: 'result' },
      ],
      [
        ['aaaa', '!', 'fail'],
        ['aaa | a', '!', 'fail'],
        ['aa | aa', '!', 'fail'],
        ['aa | a | a', '!', 'fail'],
      ],
    ),
    highlight: { active: ['try1:result', 'try2:groups', 'try4:groups'], removed: ['try4:result'] },
    explanation: 'The suffix ! proves the match impossible, but the backtracking engine may need to try many ways to partition the same a characters among repeated groups before it can say no.',
  };

  yield {
    state: engineGraph('Every failed suffix pops another saved choice', { stack: 'many frames', fail: 'still !', retry: 'new split', time: '2^n' }),
    highlight: { active: ['stack', 'fail', 'retry', 'e-fail-retry', 'e-retry-stack'], found: ['time'] },
    explanation: 'Nested repetition makes each a boundary ambiguous. The engine keeps trying a different split, reaches the same bad suffix, fails again, and repeats. This is catastrophic backtracking.',
  };

  yield {
    state: growthPlot(),
    highlight: { active: ['paths'], found: ['n14'], compare: ['n10'] },
    explanation: 'The exact count depends on the engine and pattern, but the shape is the point: adding a few more a characters can multiply the number of candidate paths. That is enough to freeze a request handler or browser tab.',
  };

  yield {
    state: labelMatrix(
      'Evil-regex shape',
      [
        { id: 'nested', label: '(a+)+$' },
        { id: 'overlap', label: '(a|aa)+$' },
        { id: 'optional', label: '(a|a?)+$' },
        { id: 'safe', label: '^a+$' },
      ],
      [
        { id: 'ambiguity', label: 'shape' },
        { id: 'badInput', label: 'bad' },
      ],
      [
        ['nested', 'a...!'],
        ['overlap', 'a...!'],
        ['optional', 'a...!'],
        ['single', 'linear'],
      ],
    ),
    highlight: { active: ['nested:ambiguity', 'overlap:ambiguity', 'optional:ambiguity'], found: ['safe:badInput'] },
    explanation: 'OWASP calls out the same family: repeated groups whose contents are themselves repeated or overlapping. The safe version removes ambiguity, so a failed suffix does not create a retry tree.',
  };
}

function* linearEngines() {
  yield {
    state: comparisonGraph('Same regex family, different execution model'),
    highlight: { active: ['regex', 'back', 'nfa'], compare: ['redos'], found: ['safe'] },
    explanation: 'The danger is not regex syntax alone. It is regex syntax plus an engine that explores alternatives one at a time. Thompson simulation carries all alternatives in one active-state frontier.',
    invariant: 'Engine choice is part of the algorithmic complexity story.',
  };

  yield {
    state: labelMatrix(
      'Backtracking versus Thompson-style matching',
      [
        { id: 'state', label: 'state' },
        { id: 'failure', label: 'fail' },
        { id: 'features', label: 'feature set' },
        { id: 'service', label: 'service' },
      ],
      [
        { id: 'backtracking', label: 'BT' },
        { id: 'linear', label: 'linear' },
      ],
      [
        ['stack', 'set'],
        ['retry', 'once'],
        ['rich', 'regular'],
        ['ReDoS', 'caps'],
      ],
    ),
    highlight: { active: ['failure:backtracking', 'failure:linear'], compare: ['features:linear'] },
    explanation: 'Backtracking engines support features that are hard or impossible to implement with finite automata, but that expressiveness changes worst-case behavior. RE2 rejects constructs such as backreferences and look-around to preserve safety.',
  };

  yield {
    state: comparisonGraph('Mitigation starts before deployment'),
    highlight: { active: ['safe', 'service', 'frontier'], compare: ['redos'] },
    explanation: 'The strongest mitigation is to use a linear-time regex engine when pattern features allow it. The second layer is to simplify ambiguous patterns, cap input length, set timeouts where available, and treat user-controlled patterns as code.',
  };

  yield {
    state: labelMatrix(
      'Rewrite the vulnerable intent',
      [
        { id: 'bad1', label: '(a+)+$' },
        { id: 'good1', label: 'a+$' },
        { id: 'bad2', label: '(a|aa)+$' },
        { id: 'good2', label: 'aa*$' },
      ],
      [
        { id: 'problem', label: 'issue' },
        { id: 'rewrite', label: 'rewrite' },
      ],
      [
        ['nested', 'a+'],
        ['single', 'ok'],
        ['overlap', 'factor'],
        ['same', 'ok'],
      ],
    ),
    highlight: { active: ['bad1:problem', 'bad2:problem'], found: ['good1:rewrite', 'good2:rewrite'] },
    explanation: 'A lot of ReDoS prevention is ordinary grammar cleanup: remove nested repetitions over the same alphabet, factor overlapping alternatives, and make failure paths deterministic.',
  };

  yield {
    state: labelMatrix(
      'Production checklist',
      [
        { id: 'engine', label: 'engine' },
        { id: 'pattern', label: 'pattern' },
        { id: 'input', label: 'input' },
        { id: 'budget', label: 'budget' },
        { id: 'monitor', label: 'monitor' },
      ],
      [
        { id: 'question', label: 'Q' },
        { id: 'answer', label: 'safe' },
      ],
      [
        ['linear?', 'RE2'],
        ['ambig?', 'lint'],
        ['user?', 'cap'],
        ['cancel?', 'enforce'],
        ['slow?', 'metrics'],
      ],
    ),
    highlight: { active: ['engine:answer', 'input:answer', 'budget:answer'], found: ['monitor:answer'] },
    explanation: 'Regexes are tiny programs. In services, they need the same operational discipline as parsers: engine choice, input caps, resource budgets, and observability for slow paths.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'choice stack') yield* choiceStack();
  else if (view === 'linear engines') yield* linearEngines();
  else throw new InputError('Pick a regex backtracking view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A backtracking regex engine matches by making a choice, pushing alternative choices onto a stack, and retrying those alternatives if the current path fails. That execution model is convenient and expressive, but ambiguous nested repetitions can create an enormous retry tree.',
        'ReDoS, or regular expression denial of service, happens when an attacker supplies a pattern, input, or both that make the engine spend excessive CPU exploring doomed alternatives. The classic teaching pattern is ^(a+)+$ against a long run of a characters followed by a non-matching suffix such as !.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For ^(a+)+$, the inner a+ can consume many a characters, and the outer + can repeat the group in many partitions. A greedy engine first consumes as much as it can. When $ sees ! and fails, the engine pops a saved choice, gives back some a characters, and tries another partition. The suffix still fails, so the engine keeps retrying.',
        'The problem is not that the language is impossible to recognize efficiently. Thompson NFA simulation and DFA-style engines can represent all active alternatives together. The problem is the one-path-at-a-time choice stack combined with ambiguous repeated structure.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'On input aaaa!, a backtracking engine can try aaaa as one group, then aaa|a, then aa|aa, then aa|a|a, and so on. Every split reaches the same final failure because ! is not the end of string. With more a characters, the number of partitions grows rapidly.',
        'OWASP highlights evil-regex shapes such as nested repetition and overlapping alternation: (a+)+$, ([a-zA-Z]+)*$, (a|aa)+$, and (a|a?)+$. The repair is to remove ambiguity where possible, such as replacing (a+)+$ with a+$ for that language.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Backtracking engines can be fast on common cases because they try likely alternatives first and stop after the first success. Their worst case, however, can be exponential for patterns with many equivalent interpretations of the same prefix and a late failure.',
        'Thompson-style engines have steadier bounds because each input position carries a de-duplicated active-state set. RE2 explicitly prioritizes safety, guarantees asymptotically linear running time in the input length, and refuses constructs such as backreferences and look-around that require backtracking-style machinery.',
      ],
    },
    {
      heading: 'Primary sources and study next',
      paragraphs: [
        'Primary sources: OWASP Regular expression Denial of Service at https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS; Russ Cox, Regular Expression Matching Can Be Simple And Fast at https://swtch.com/~rsc/regexp/regexp1.html; and Google RE2 README at https://github.com/google/re2.',
        'Study Stack for the choice-stack model, Recursion for the call-tree version of the same idea, Thompson NFA Regex Engine Case Study for the linear frontier, and Subset Construction: NFA to DFA for cached deterministic matching. Finite State Machines, Parser Design Patterns Primer, JSON Parser Stack Case Study, and Web Workers are useful production-adjacent follow-ups.',
      ],
    },
  ],
};
