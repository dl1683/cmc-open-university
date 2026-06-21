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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/pratt-parser-expression-ast.gif', alt: 'Animated walkthrough of the pratt parser expression ast visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Expression syntax looks simple until a language has precedence, associativity, unary operators, calls, indexing, grouping, and good error messages. The flat token stream a + b * c does not say which operation owns b and c. The parser must recover that structure.',
        {type: 'callout', text: 'A Pratt parser makes precedence a data lookup and a stop condition, so expression structure comes from binding power instead of parser nesting.'},
        'A Pratt parser solves the expression part with a small loop and token-specific parse functions. It turns a token stream into an AST or bytecode while keeping precedence and associativity in data tables rather than in a tall stack of grammar functions.',
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        'The common recursive-descent approach writes one function per precedence level: equality calls comparison, comparison calls term, term calls factor, and so on. This is clear for a tiny language, and many production parsers use a version of it.',
        'The cost appears as the expression grammar grows. Adding a new operator may mean adding a new layer or threading behavior through several functions. Tokens such as minus and open parenthesis also have multiple roles: prefix minus versus binary minus, grouping versus function call.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not that recursive descent cannot parse expressions. It can. The wall is that precedence becomes spread through control flow. The grammar shape, operator table, associativity rules, and error behavior are entangled.',
        'A parser for a language, DSL, editor, or calculator often wants operators to be easy to add and easy to inspect. A pile of mutually recursive precedence functions hides the table the language designer actually cares about.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Precedence is a numeric stop condition. parseExpression(minPower) first parses something that can start an expression. Then it keeps consuming infix or postfix operators only while the next operator binds tightly enough for the current caller.',
        'The token table says what each token can do in prefix position and infix position. Binding power says how far the expression extends. That is why one token can support both unary minus and binary subtraction without duplicating the whole grammar.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the binding-power view, treat the table as the main data structure. Prefix parselets build the first expression, infix parselets extend a left expression, and the binding-power comparison decides whether the loop continues or returns control to the caller.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Abstract_syntax_tree_for_Euclidean_algorithm.svg/500px-Abstract_syntax_tree_for_Euclidean_algorithm.svg.png', alt: 'Abstract syntax tree diagram with statement, branch, comparison, assignment, and binary operation nodes', caption: 'An AST records ownership and nesting that the token stream alone does not expose. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Abstract_syntax_tree_for_Euclidean_algorithm.svg.'},
        'In the AST-construction view, watch when the root changes. The token stream stays flat, but the tree records ownership. The important moment is that * binds b and c before + completes, so the right child of + becomes the subtree *(b, c).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The parser stores a token stream, a cursor, a prefix parselet table, an infix parselet table, and binding powers. A prefix parselet handles literals, names, grouping, unary operators, and anything else that can start an expression.',
        'After the prefix parselet returns a left expression, the Pratt loop peeks at the next token. If the token has an infix parselet whose left binding power is high enough, the parser consumes it, recursively parses the right side with the operator-specific right binding power, and builds a larger expression node.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that parseExpression(minPower) returns the expression that starts at the current position and includes every following operator whose binding power belongs to this caller. When the next operator is too weak, it is left for an outer call.',
        'Associativity is handled by choosing the right binding power. A left-associative operator parses its right side with a stricter threshold, so another equal-precedence operator stays outside. A right-associative operator allows equal precedence on the right, which is why a = b = c groups as a = (b = c).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For a + b * c, the parser first parses a. It sees +, whose binding power is high enough for the top-level call, so + receives a as its left side. To parse the right side of +, the parser starts at b.',
        'After b, the parser sees *. Because * binds more tightly than +, the recursive call consumes * and c before returning. The final AST is +(a, *(b, c)). The source order did not change; the tree made precedence explicit.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'A Pratt parser is linear in the number of tokens it consumes for ordinary expression grammars: each token is advanced a constant number of times. The table lookup and binding-power comparisons are small constant work.',
        'The space cost depends on the output. Building an AST stores nodes and source spans. Emitting bytecode directly stores instructions and may use less memory, but it gives up the tree that refactoring tools, type checkers, optimizers, and diagnostics often want.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Write the operator table as data first. For each token, record whether it has prefix behavior, infix behavior, postfix behavior, left binding power, right binding power, associativity, and the AST node it should build. The parser loop should read that table instead of hiding the language design in scattered conditionals.',
        'Keep source spans on every node. A Pratt parser without spans can build the right tree and still produce poor diagnostics. Error messages need to point at the missing right operand, unexpected operator, or unclosed group, not merely at the end of the file.',
        'Separate tokenization errors from parse errors. The Pratt parser should receive a clean token stream with positions, not guess whether `--`, `=>`, string literals, or comments are valid tokens.',
      ],
    },
    {
      heading: 'Testing it',
      paragraphs: [
        'Golden AST tests are useful. Parse expressions such as `a + b * c`, `(a + b) * c`, `-a * b`, `a = b = c`, `a - b - c`, calls, indexing, and postfix operators, then compare the produced tree with the expected grouping.',
        'Also test bad input. Missing operands, unmatched parentheses, two operators in a row, and unexpected end-of-file should produce stable diagnostics with useful spans. A parser that succeeds on happy examples but reports useless errors is not finished.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'Pratt parsing is a strong fit for interpreters, calculators, query languages, expression-heavy DSLs, and compiler front ends where operators are numerous or extensible. It keeps the operator table visible and local.',
        'It also fits editor tooling when paired with source spans. AST nodes can point back to tokens, which makes formatting, diagnostics, hover information, and structured edits easier to implement.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Pratt parsing is not a full language parser by itself. Statement syntax, indentation rules, declarations, imports, macros, layout sensitivity, and ambiguous grammar choices still need broader parsing design.',
        'It is also less helpful when the grammar is tiny and fixed. A simple hand-written precedence ladder may be clearer for five operators that will never change.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Bad binding powers create quiet bugs. The parser still returns a tree, but the tree groups incorrectly. This is worse than a syntax error because later compiler stages may accept the wrong meaning.',
        'The other common failures are poor diagnostics, missing source spans, no recovery after a bad right operand, and confusing prefix with infix behavior for shared tokens. A compact parser still needs a serious error strategy.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Vaughan Pratt, Top Down Operator Precedence, at https://tdop.github.io/, Crafting Interpreters expression parsing at https://craftinginterpreters.com/parsing-expressions.html, Crafting Interpreters compiling expressions at https://craftinginterpreters.com/compiling-expressions.html, and LLVM Kaleidoscope parser and AST at https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/LangImpl02.html.',
        'Study Finite State Machine and lexer design before the parser if tokenization is weak. Study Tree Traversals and Zipper Focused Tree for AST manipulation. Study Bytecode Stack Virtual Machine, Control Flow Graph and Dominator Tree, Static Single Assignment and Phi Nodes, Unification Union-Find Type Constraints, and Hindley-Milner Algorithm W for what compilers do after expression parsing.',
      ],
    },
  ],
};
