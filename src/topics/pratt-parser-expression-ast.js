// Pratt parsing: token stream plus binding powers builds an expression AST
// without a separate precedence table grammar for every operator level.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'pratt-parser-expression-ast',
  title: 'Pratt Parser Expression AST',
  category: 'Concepts',
  summary: 'Parse expressions with prefix/infix parselets and binding power: tokens become an AST while precedence and associativity stay in compact tables.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['binding power', 'ast construction'], defaultValue: 'binding power' },
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

function parseGraph(title) {
  return graphState({
    nodes: [
      { id: 'tokens', label: 'tokens', x: 0.8, y: 4.0, note: 'a + b * c' },
      { id: 'prefix', label: 'prefix', x: 2.5, y: 2.3, note: 'nud' },
      { id: 'infix', label: 'infix', x: 2.5, y: 5.7, note: 'led' },
      { id: 'bp', label: 'power', x: 4.4, y: 4.0, note: 'precedence' },
      { id: 'loop', label: 'loop', x: 6.0, y: 4.0, note: 'binds' },
      { id: 'ast', label: 'AST', x: 7.7, y: 4.0, note: '+ root' },
      { id: 'emit', label: 'emit', x: 9.4, y: 4.0, note: 'IR' },
    ],
    edges: [
      { id: 'e-tokens-prefix', from: 'tokens', to: 'prefix' },
      { id: 'e-tokens-infix', from: 'tokens', to: 'infix' },
      { id: 'e-prefix-bp', from: 'prefix', to: 'bp' },
      { id: 'e-infix-bp', from: 'infix', to: 'bp' },
      { id: 'e-bp-loop', from: 'bp', to: 'loop' },
      { id: 'e-loop-ast', from: 'loop', to: 'ast' },
      { id: 'e-ast-emit', from: 'ast', to: 'emit' },
    ],
  }, { title });
}

function astGraph(title) {
  return graphState({
    nodes: [
      { id: 'plus', label: '+', x: 5.0, y: 2.0, note: 'root' },
      { id: 'a', label: 'a', x: 3.5, y: 4.0, note: 'left' },
      { id: 'mul', label: '*', x: 6.5, y: 4.0, note: 'right' },
      { id: 'b', label: 'b', x: 5.8, y: 6.0, note: 'left' },
      { id: 'c', label: 'c', x: 7.2, y: 6.0, note: 'right' },
      { id: 'stream', label: 'a + b * c', x: 1.0, y: 4.0, note: 'tokens' },
      { id: 'table', label: 'table', x: 9.0, y: 4.0, note: '+ < *' },
    ],
    edges: [
      { id: 'e-plus-a', from: 'plus', to: 'a' },
      { id: 'e-plus-mul', from: 'plus', to: 'mul' },
      { id: 'e-mul-b', from: 'mul', to: 'b' },
      { id: 'e-mul-c', from: 'mul', to: 'c' },
      { id: 'e-stream-plus', from: 'stream', to: 'plus' },
      { id: 'e-table-mul', from: 'table', to: 'mul' },
    ],
  }, { title });
}

function* bindingPower() {
  const expression = 'a + b * c';
  const operators = ['+', '*'];
  const tokenKinds = ['number', '-', '+', '*'];

  yield {
    state: parseGraph('Pratt parsing is a dispatch table plus a loop'),
    highlight: { active: ['tokens', 'prefix', 'infix', 'bp'], compare: ['ast'] },
    explanation: `A Pratt parser turns each of ${tokenKinds.length} token kinds into parse functions. Prefix parselets handle tokens that start expressions like ${expression}. Infix parselets handle ${operators.length} operators that extend a left expression. Binding power decides when the loop stops.`,
  };
  yield {
    state: labelMatrix(
      'Expression table',
      [
        { id: 'number', label: 'number' },
        { id: 'minus', label: '-' },
        { id: 'plus', label: '+' },
        { id: 'star', label: '*' },
      ],
      [
        { id: 'prefix', label: 'prefix' },
        { id: 'infix', label: 'infix' },
        { id: 'bp', label: 'binding power' },
      ],
      [
        ['literal', '-', '-'],
        ['negate', 'subtract', 'low'],
        ['-', 'add', 'low'],
        ['-', 'multiply', 'higher'],
      ],
    ),
    highlight: { active: ['star:bp', 'plus:bp'], found: ['minus:prefix', 'minus:infix'] },
    explanation: `The table is the data structure for ${expression}. One token can have both prefix and infix behavior, as unary minus and binary minus do. Higher binding power lets * claim b and c before + finishes.`,
  };
  yield {
    state: parseGraph('The loop keeps consuming operators that bind tightly enough'),
    highlight: { active: ['bp', 'loop', 'ast', 'e-bp-loop', 'e-loop-ast'], found: ['infix'] },
    explanation: `parseExpression(minPower) parses a prefix expression, then repeatedly looks at the next token. If the next infix operator among ${operators.length} operators binds tighter than minPower, it consumes the operator and recursively parses the right side.`,
    invariant: `Precedence is a numeric stop condition across ${tokenKinds.length} token kinds, not a pile of nested parser functions.`,
  };
}

function* astConstruction() {
  const expression = 'a + b * c';
  const astResult = '+(a, *(b, c))';

  yield {
    state: astGraph('a + b * c becomes +(a, *(b, c))'),
    highlight: { found: ['plus', 'a', 'mul', 'b', 'c'], active: ['e-plus-a', 'e-plus-mul', 'e-mul-b', 'e-mul-c'] },
    explanation: `Because * has higher binding power than +, ${expression} becomes ${astResult}. The AST records structure that the flat token stream did not make explicit.`,
  };
  yield {
    state: labelMatrix(
      'Parser output options',
      [
        { id: 'ast', label: 'AST' },
        { id: 'bytecode', label: 'bytecode' },
        { id: 'ir', label: 'IR' },
        { id: 'errors', label: 'errors' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'use', label: 'use' },
      ],
      [
        ['tree nodes', 'analysis/refactor'],
        ['op stream', 'interpreter VM'],
        ['typed values', 'optimizer'],
        ['token spans', 'diagnostics'],
      ],
    ),
    highlight: { active: ['ast:stores', 'ir:use'], compare: ['bytecode:stores'] },
    explanation: `Crafting Interpreters compiles expressions like ${expression} directly toward bytecode. LLVM Kaleidoscope builds an AST like ${astResult} and then emits LLVM IR. The same parsing structure can feed either path.`,
  };
  yield {
    state: parseGraph('ASTs link to later compiler data structures'),
    highlight: { active: ['ast', 'emit', 'e-ast-emit'], found: ['tokens', 'bp'], compare: ['prefix', 'infix'] },
    explanation: `The AST for ${expression} is not the whole compiler. Control Flow Graph & Dominator Tree handles branches. Static Single Assignment & Phi Nodes handles values across joins. Linear Scan Register Allocation handles final machine registers.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'binding power') yield* bindingPower();
  else if (view === 'ast construction') yield* astConstruction();
  else throw new InputError('Pick a Pratt parser view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the binding-power table as the parser control structure. A prefix parselet handles a token that can start an expression, and an infix parselet extends an expression that already has a left side. The active comparison asks whether the next operator binds tightly enough to belong to the current call.',
        {type: 'image', src: './assets/gifs/pratt-parser-expression-ast.gif', alt: 'Animated walkthrough of the pratt parser expression ast visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In the tree view, ownership is the important state. The token stream stays flat, but the AST records which operator owns which operands. The safe inference is that a lower binding-power operator must wait for an outer call.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Expressions need structure that the token stream does not show. In a + b * c, the tokens appear left to right, but * owns b and c before + can finish. A parser must recover that ownership before evaluation, type checking, or code generation.',
        {type: 'callout', text: 'A Pratt parser makes precedence a data lookup and a stop condition, so expression structure comes from binding power instead of parser nesting.'},
        'A Pratt parser exists to keep expression parsing compact and extensible. Operator behavior lives in tables, while one recursive loop handles precedence, associativity, prefix forms, infix forms, postfix forms, calls, and indexing.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Recursive descent often starts with one function per precedence level. Equality calls comparison, comparison calls term, term calls factor, and factor calls unary. This is clear for a small fixed grammar.',
        'The approach becomes awkward as operators multiply. Adding one precedence level means adding another function and threading error behavior through the ladder. Shared tokens such as minus and open parenthesis also need different behavior in different positions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that precedence is hidden in control flow. The language designer wants a visible table of operators, binding powers, and associativity, but the parser spreads those facts across mutually recursive functions. The implementation works while becoming harder to inspect.',
        'Expression-heavy languages, query DSLs, and editors need operators to be added, tested, and diagnosed locally. A precedence ladder can still parse them, but the cost of change rises. The grammar shape and parse mechanics become entangled.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Precedence can be a numeric stop condition. parseExpression(minPower) first parses something that can start an expression, then keeps consuming operators while the next operator has enough left binding power. When the next operator is too weak, the call returns.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Abstract_syntax_tree_for_Euclidean_algorithm.svg/500px-Abstract_syntax_tree_for_Euclidean_algorithm.svg.png', alt: 'Abstract syntax tree diagram with statement, branch, comparison, assignment, and binary operation nodes', caption: 'An AST records ownership and nesting that the token stream alone does not expose. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Abstract_syntax_tree_for_Euclidean_algorithm.svg.'},
        'Associativity is encoded by right binding power. Left-associative operators make another equal-precedence operator wait outside the recursive right side. Right-associative operators allow equal precedence on the right, so assignment can group as a = (b = c).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The parser keeps a token cursor, a prefix table, an infix table, and binding powers. A prefix parselet builds the first expression from a literal, name, group, or unary operator. The result becomes the current left expression.',
        'The Pratt loop peeks at the next token. If that token has an infix parselet whose left binding power is at least the current threshold, the parser consumes it and parses the right side with the operator-specific right binding power. The infix parselet then returns a larger AST node.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that parseExpression(minPower) consumes exactly the expression owned by the current caller. Operators with high enough binding power are inside the returned expression. Operators below the threshold remain for an outer caller.',
        'This proves precedence by induction over recursive calls. The prefix parselet builds a valid starting expression. Each infix step extends it only when the operator legally binds to it, and the recursive right parse consumes all tighter operators before control returns.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For ordinary expression grammars, runtime is O(n) for n tokens. Each token is consumed a constant number of times, and each binding-power check is a small table lookup. Building an AST adds O(n) output space.',
        'The behavioral cost is table discipline. Bad binding powers produce a valid-looking but wrong tree, which is worse than a syntax error. Good implementations also store source spans so diagnostics can point at the missing operand or unexpected operator.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pratt parsing fits interpreters, compilers, calculators, query languages, and expression-heavy DSLs. It is strongest when a language has many operators or wants operator behavior to be configured as data. The same structure can emit AST nodes or bytecode.',
        'Editor tooling benefits from the AST shape when nodes carry source spans. Formatting, hover information, refactoring, and error recovery all need stable ownership information. The Pratt parser supplies the expression tree that later tools inspect.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A Pratt parser is not a complete language parser. Statements, declarations, indentation rules, macros, imports, and layout-sensitive syntax still need broader parsing design. Pratt handles expression structure, not every grammar problem.',
        'It can also be overkill for a tiny fixed grammar. If a language has five operators and no planned extension, a simple precedence ladder may be easier for a new maintainer. The trade is local clarity now versus extensibility later.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Parse a + b * c with minPower = 0. The prefix parselet reads a, then the loop sees + with enough binding power, so + takes a as its left side. To parse the right side of +, the parser calls parseExpression with the right binding power of +.',
        'Inside that call, the prefix parselet reads b. The next token is *, and * binds more tightly than +, so the recursive call consumes * and c before returning. The right side of + becomes *(b, c).',
        'The final AST is +(a, *(b, c)). The source order did not change, but ownership did. If + and * both had the same binding power by mistake, the parser would build the wrong tree while still accepting the input.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Vaughan Pratt, Top Down Operator Precedence; Bob Nystrom, Crafting Interpreters chapters on parsing expressions and compiling expressions; and LLVM Kaleidoscope parser notes. These sources show both AST-building and compiler-front-end variants.',
        'Study next: Finite State Machine for tokenization, Tree Traversals for AST inspection, Bytecode Stack Virtual Machine for direct emission, Control Flow Graph for later compiler structure, and Hindley-Milner Type Inference for what type checkers do with parsed expressions.',
      ],
    },
  ],
};
