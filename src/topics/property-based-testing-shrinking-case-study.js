// Property-based testing: generate many structured inputs for a property, then
// shrink any failing example into a small reproducible counterexample.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'property-based-testing-shrinking-case-study',
  title: 'Property-Based Testing Shrinking Case Study',
  category: 'Concepts',
  summary: 'A generative testing primer: strategies, random examples, edge cases, invariants, failing inputs, shrinking trees, minimal counterexamples, seeds, and replay packets.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['generator search', 'shrinking tree'], defaultValue: 'generator search' },
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

function pbtGraph(title) {
  return graphState({
    nodes: [
      { id: 'strategy', label: 'strategy', x: 0.8, y: 3.5, note: 'gen' },
      { id: 'examples', label: 'examples', x: 2.4, y: 2.0, note: 'many' },
      { id: 'edges', label: 'edge cases', x: 2.4, y: 5.0, note: 'bias' },
      { id: 'property', label: 'property', x: 4.2, y: 3.5, note: 'invariant' },
      { id: 'pass', label: 'pass', x: 5.9, y: 2.0, note: 'keep' },
      { id: 'fail', label: 'fail', x: 5.9, y: 5.0, note: 'counter' },
      { id: 'shrink', label: 'shrink', x: 7.5, y: 5.0, note: 'simplify' },
      { id: 'minimal', label: 'minimal', x: 9.0, y: 3.5, note: 'replay' },
    ],
    edges: [
      { id: 'e-strategy-examples', from: 'strategy', to: 'examples' },
      { id: 'e-strategy-edges', from: 'strategy', to: 'edges' },
      { id: 'e-examples-property', from: 'examples', to: 'property' },
      { id: 'e-edges-property', from: 'edges', to: 'property' },
      { id: 'e-property-pass', from: 'property', to: 'pass' },
      { id: 'e-property-fail', from: 'property', to: 'fail' },
      { id: 'e-fail-shrink', from: 'fail', to: 'shrink' },
      { id: 'e-shrink-minimal', from: 'shrink', to: 'minimal' },
    ],
  }, { title });
}

function shrinkPlot() {
  return plotState({
    axes: {
      x: { label: 'shrink attempt', min: 0, max: 12 },
      y: { label: 'input size', min: 0, max: 120 },
    },
    series: [
      { id: 'size', label: 'size', points: [{ x: 0, y: 96 }, { x: 2, y: 48 }, { x: 4, y: 19 }, { x: 6, y: 8 }, { x: 8, y: 5 }, { x: 10, y: 3 }] },
      { id: 'signal', label: 'still fails', points: [{ x: 0, y: 110 }, { x: 2, y: 70 }, { x: 4, y: 38 }, { x: 6, y: 20 }, { x: 8, y: 14 }, { x: 10, y: 9 }] },
    ],
    markers: [
      { id: 'min', x: 10, y: 3, label: 'min' },
    ],
  });
}

function* generatorSearch() {
  yield {
    state: pbtGraph('Property tests search generated inputs'),
    highlight: { active: ['strategy', 'examples', 'edges', 'property', 'e-strategy-examples', 'e-strategy-edges', 'e-examples-property', 'e-edges-property'], found: ['fail'] },
    explanation: 'Property-based testing replaces handpicked examples with generators. The test states a property that should hold for every generated input within a described domain.',
    invariant: 'The property is the specification; the generator defines the explored input space.',
  };

  yield {
    state: labelMatrix(
      'Strategy table',
      [
        { id: 'int', label: 'int' },
        { id: 'list', label: 'list' },
        { id: 'dict', label: 'dict' },
        { id: 'state', label: 'state' },
      ],
      [
        { id: 'makes', label: 'makes' },
        { id: 'edge', label: 'edge cases' },
      ],
      [
        ['numbers', '0,min,max'],
        ['arrays', 'empty,dup'],
        ['maps', 'missing key'],
        ['ops', 'weird order'],
      ],
    ),
    highlight: { active: ['int:edge', 'list:edge', 'state:edge'], found: ['dict:makes'] },
    explanation: 'Strategies are data generators with structure. Good strategies produce ordinary examples, boundary cases, and weird compositions that humans forget to write.',
  };

  yield {
    state: pbtGraph('Failing examples enter the shrinker'),
    highlight: { active: ['property', 'fail', 'shrink', 'minimal', 'e-property-fail', 'e-fail-shrink', 'e-shrink-minimal'], compare: ['pass'] },
    explanation: 'Finding a failure is only half the value. Shrinking tries to simplify the failing input while preserving the property violation.',
  };

  yield {
    state: labelMatrix(
      'Replay packet',
      [
        { id: 'seed', label: 'seed' },
        { id: 'case', label: 'case' },
        { id: 'prop', label: 'property' },
        { id: 'env', label: 'env' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['rng', 'reproduce'],
        ['input', 'debug'],
        ['name', 'intent'],
        ['version', 'drift'],
      ],
    ),
    highlight: { active: ['seed:why', 'case:why', 'prop:stores'], found: ['env:why'] },
    explanation: 'A failure should be replayable. Store the seed or example database entry, the minimal case, property name, library version, and environment details.',
  };
}

function* shrinkingTree() {
  yield {
    state: labelMatrix(
      'Shrinking attempts',
      [
        { id: 'drop', label: 'drop item' },
        { id: 'small', label: 'small num' },
        { id: 'sort', label: 'simplify' },
        { id: 'keep', label: 'keep fail' },
      ],
      [
        { id: 'candidate', label: 'candidate' },
        { id: 'result', label: 'result' },
      ],
      [
        ['[9,3,0]', 'passes'],
        ['[4,3,0]', 'fails'],
        ['[0,3,4]', 'fails'],
        ['[0,3]', 'minimal'],
      ],
    ),
    highlight: { active: ['small:result', 'sort:result', 'keep:result'], compare: ['drop:result'] },
    explanation: 'Shrinkers try simpler candidates and keep any candidate that still fails. Passing candidates are discarded because they lost the bug.',
  };

  yield {
    state: shrinkPlot(),
    highlight: { active: ['size', 'signal', 'min'] },
    explanation: 'The search should drive complexity down while preserving the failure signal. The final counterexample should be small enough to understand and commit as a regression case.',
  };

  yield {
    state: pbtGraph('The minimal counterexample is a design clue'),
    highlight: { active: ['shrink', 'minimal', 'e-shrink-minimal'], found: ['strategy', 'property'] },
    explanation: 'A minimal failure is often more useful than a stack trace. It tells you which input feature is essential to the bug and which complexity was noise.',
  };

  yield {
    state: labelMatrix(
      'Pitfalls',
      [
        { id: 'weak', label: 'weak prop' },
        { id: 'badgen', label: 'bad gen' },
        { id: 'filter', label: 'filter' },
        { id: 'nondet', label: 'nondet' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['always true', 'stronger'],
        ['misses bug', 'domain gen'],
        ['discard storm', 'construct'],
        ['flaky fail', 'control env'],
      ],
    ),
    highlight: { active: ['weak:symptom', 'badgen:symptom', 'nondet:symptom'], found: ['filter:fix'] },
    explanation: 'Property testing fails quietly when properties are weak, generators miss the domain, filters discard most inputs, or the system is nondeterministic.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'generator search') yield* generatorSearch();
  else if (view === 'shrinking tree') yield* shrinkingTree();
  else throw new InputError('Pick a property-testing view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the generator-search view as a loop over executable claims. A property is a rule that should hold for a family of inputs, and a strategy is the generator that builds those inputs. Active nodes show generation and execution; found nodes show a counterexample that violates the property.',
        'Read the shrinking tree as a second search. Each candidate is a simpler input tried after the first failure. A candidate that still fails replaces the current best failure; a candidate that passes is discarded because it lost the bug.',
        {type:'callout', text:'Property-based testing turns a specification into a search system, and shrinking turns the first failure into the smallest useful debug artifact.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Example tests prove the cases a developer thought to write. They are necessary, but they usually cover polite inputs: empty lists, one normal value, and the bug remembered from last week. Real failures often come from duplicate values, boundary sizes, strange ordering, old versions, or operation sequences nobody wrote by hand.',
        'Property-based testing exists to search the input space from a stated rule. Instead of testing one queue script, the test says that any valid sequence of enqueue and dequeue operations should match a simple model. The framework then generates many cases and keeps the failing ones for replay.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to add more examples. That helps because examples are readable and targeted. A developer can write the known edge cases and explain each one during review.',
        'The next approach is random fuzzing. Generate large random inputs and see what crashes. Fuzzing finds failures that examples miss, but the first report can be a 500-operation sequence or a huge byte string that proves something broke without showing the smallest cause.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not only finding a failure. It is turning that failure into a debug artifact. A giant failing input may hide the one operation, byte, or size transition that actually matters.',
        'There is also an oracle problem. The test must know what correct behavior means for generated inputs. Without a property, model, round trip, or invariant, random data only creates noise.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A property is a behavioral invariant over a generated domain. Sorting should return an ordered permutation. Encoding followed by decoding should recover the original value. A cache should never exceed capacity. A state machine should match a simpler reference model.',
        'Shrinking makes the method useful after failure. Once an input fails, the framework tries to remove operations, shorten lists, lower numbers, simplify strings, or simplify nested values. It keeps only changes that preserve the failure, so the final case contains less irrelevant material.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The runner asks a strategy for an example and executes the property against real code. It records pass, fail, discard, timeout, and enough seed or example data for replay. If the case fails, shrinking starts from that concrete input.',
        'Strategies are structured generators, not plain random functions. An integer strategy knows about zero and bounds. A list strategy knows about length and element shrinkers. A state-machine strategy can generate operation sequences while respecting preconditions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works when the property captures the real contract and the strategy reaches the relevant domain. If the queue must behave like a model list, every generated valid operation sequence can compare implementation outputs with model outputs. A resize bug becomes visible when the generator crosses the internal capacity boundary.',
        'Shrinking is correct as a debugging aid because it only accepts candidates that still violate the same property. It is not a proof of minimality in every mathematical sense, but it is a monotone search toward simpler failing examples. The final input is useful because every removed part was unnecessary to reproduce the failure.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Runtime cost is examples times property cost. If one property run takes 5 milliseconds and the runner tries 1000 examples, the test spends about 5 seconds before shrinking. A slow database-backed property may need fewer examples or a fake model because search multiplies the cost.',
        'The larger cost is test design. A weak property can pass forever while checking little. Excessive filtering wastes generated cases. Nondeterministic code can make shrinking unstable because a candidate fails once and passes later.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Property-based testing works well for parsers, serializers, encoders, decoders, queues, heaps, caches, permission checks, date logic, numeric code, and state machines. These domains have clear invariants and many awkward inputs.',
        'It also works when exact expected output is hard but a relation is easy. Round trips, idempotence, monotonicity, conservation, commutativity, and equivalence with a slower reference implementation can all act as testable properties.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the generator never reaches the bug. A queue resize property will not find a resize bug if generated operation sequences never exceed the initial capacity. Strategy design is coverage design.',
        'It also fails when generated values are syntactically valid but impossible in production, or when the property repeats the implementation instead of checking behavior. Property tests complement examples, model checking, symbolic execution, and fuzzing; they do not replace all of them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A ring-buffer queue starts with capacity 4 and doubles to 8. The property says dequeued values must match a model array for any valid sequence. The runner finds this failure: enqueue 0, 1, 2, 3, dequeue twice, enqueue 4, 5, 6, then dequeue all values; the implementation returns 2, 3, 6, 5 instead of 2, 3, 4, 5, 6.',
        'Shrinking removes unrelated operations and values. It may end at enqueue 0, 1, 2, 3, dequeue, enqueue 4, 5, dequeue all, which still crosses wraparound plus resize. That small case points directly at the copy order during resize instead of making the developer inspect hundreds of random commands.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Hypothesis documentation, Hypothesis strategy reference, and the Hypothesis article on compositional shrinking. Also study QuickCheck because it established the modern property-based testing style.',
        'Study state-space model checking, Alloy, SMT solvers, symbolic execution, parser fuzzing, and reference-model testing next. The practical skill is writing properties that are strong enough to find bugs and small enough to debug.',
      ],
    },
  ],
};
