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
      heading: 'How to read the animation',
      paragraphs: [
        'The choice-stack view shows a backtracking regular expression engine exploring parse alternatives. Active means the engine is trying one path, visited means a choice point has already been pushed or popped, and found means a match succeeded or all alternatives failed.',
        'The linear-engine view shows the contrast. The safe inference is that two parse histories reaching the same automaton state at the same input position can be merged, so the engine does not need to replay the same suffix for each history.',
        {type:'callout', text:'Catastrophic backtracking appears when a choice stack replays many equivalent parses against the same late failure instead of merging them.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Regular expressions often run on request paths: validators, routers, log parsers, search boxes, import filters, syntax highlighters, and security rules. A small pattern can become a CPU program with a hostile worst case.',
        'ReDoS means regular expression denial of service. It happens when a pattern and input make a backtracking engine spend too much time exploring alternatives that all fail.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious rich-engine design is depth-first search over alternatives. Try one path, push the other choices onto a stack, and return to them if the current path fails.',
        'This is attractive because it supports familiar engine features and first-success behavior. It also maps naturally to recursive matching code and stack-based implementation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when many different paths consume the same prefix and the decisive failure arrives at the end. The engine keeps proving the same suffix failure under different partitions.',
        'The teaching pattern is ^(a+)+$ on input aaaaaaaaaaaaaaaaaaaa!. The nested repetitions create many ways to group the a characters, and the final ! makes every grouping fail.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Backtracking treats ambiguity as deferred work. That is fine when alternatives are few or failure happens early, but dangerous when the choice stack encodes an exponential tree.',
        'Linear engines treat ambiguity as a frontier of active states. If two histories are equivalent at the same input position, the engine keeps one state rather than replaying both histories.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For ^(a+)+$, the inner a+ can consume one or more a characters, and the outer + can repeat that group. A greedy engine first consumes all a characters as one group.',
        'When $ sees !, the path fails. The engine pops a saved choice, gives back some a characters, tries a different partition, reaches the same final !, and fails again.',
        'Patterns with overlapping alternatives behave similarly. For (a|aa)+$, the prefix aaaa can be split as a+a+a+a, aa+a+a, a+aa+a, and other combinations before the same late failure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Backtracking is correct because it explores the alternatives allowed by the pattern and reports success if any path matches. Correctness does not imply a useful time bound.',
        'A Thompson-style engine is correct for regular features because it simulates all possible automaton positions after each input character. Merging equal states preserves whether a future suffix can match while avoiding duplicate histories.',
        'The catch is feature support. Backreferences and some look-around semantics require more than regular-language state merging, so engines with those features often accept backtracking risk.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The worst-case cost of a vulnerable backtracking pattern can be exponential in input length. Adding one more a can nearly double the number of partitions the engine must try before it rejects.',
        'For 20 a characters followed by !, nested repetition can force hundreds of thousands of attempts in common backtracking implementations. At 30 a characters, the same shape can reach millions or billions of logical paths depending on engine optimizations.',
        'Linear engines such as RE2 trade feature support for a time bound. They keep active-state sets and reject constructs that would require unbounded backtracking behavior.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Backtracking engines are useful for trusted inputs, controlled patterns, scripting, editor features, and pattern languages that need captures, backreferences, or look-around. Their expressiveness and first-success semantics are valuable.',
        'Linear engines are the safer default for public request validation, user-supplied patterns, log ingestion, WAF rules, and search filters. Those paths need predictable resource use more than every regex feature.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Backtracking fails at trust boundaries with nested quantifiers, overlapping alternatives, optional tokens inside repetitions, and late anchors after ambiguous prefixes. Invalid input is often the dangerous input.',
        'Timeouts reduce blast radius but do not prove safety. A timeout still spends CPU, can tie up worker pools, and can turn invalid requests into load spikes.',
        'Rewrites can also break behavior. Removing ambiguity must preserve the intended language or deliberately narrow it, and complex nested languages often belong in a parser.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Run ^(a+)+$ on input aaaa!. The engine first tries aaaa as one inner group, reaches $, sees !, and fails.',
        'It then tries aaa|a, aa|aa, aa|a|a, a|aaa, a|aa|a, a|a|aa, and a|a|a|a. Every partition reaches the same ! and fails.',
        'With 4 a characters the example is small enough to list. With 20 a characters, the number of possible positive-length partitions is 2^19, or 524,288, before engine-specific pruning.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OWASP Regular Expression Denial of Service at https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS, Russ Cox, Regular Expression Matching Can Be Simple And Fast, at https://swtch.com/~rsc/regexp/regexp1.html, and the RE2 README at https://github.com/google/re2. These sources explain the attack shape, Thompson NFA simulation, and linear-engine contract.',
        'Study Stack, Recursion, Thompson NFA Regex Engine, Subset Construction, Finite State Machines, Parser Design Patterns, JSON Parser Stack Case Study, and Web Workers. The transfer lesson is that search trees need either pruning, merging, or resource bounds.',
      ],
    },
  ],
};
