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
  yield {
    state: parseGraph('Pratt parsing is a dispatch table plus a loop'),
    highlight: { active: ['tokens', 'prefix', 'infix', 'bp'], compare: ['ast'] },
    explanation: 'A Pratt parser turns each token kind into parse functions. Prefix parselets handle tokens that start expressions. Infix parselets handle operators that extend a left expression. Binding power decides when the loop stops.',
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
    explanation: 'The table is the data structure. One token can have both prefix and infix behavior, as unary minus and binary minus do. Higher binding power lets * claim b and c before + finishes.',
  };
  yield {
    state: parseGraph('The loop keeps consuming operators that bind tightly enough'),
    highlight: { active: ['bp', 'loop', 'ast', 'e-bp-loop', 'e-loop-ast'], found: ['infix'] },
    explanation: 'parseExpression(minPower) parses a prefix expression, then repeatedly looks at the next token. If the next infix operator binds tighter than minPower, it consumes the operator and recursively parses the right side.',
    invariant: 'Precedence is a numeric stop condition, not a pile of nested parser functions.',
  };
}

function* astConstruction() {
  yield {
    state: astGraph('a + b * c becomes +(a, *(b, c))'),
    highlight: { found: ['plus', 'a', 'mul', 'b', 'c'], active: ['e-plus-a', 'e-plus-mul', 'e-mul-b', 'e-mul-c'] },
    explanation: 'Because * has higher binding power than +, the right side of + becomes the subtree b * c. The AST records structure that the flat token stream did not make explicit.',
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
    explanation: 'Crafting Interpreters compiles expressions directly toward bytecode. LLVM Kaleidoscope builds an AST and then emits LLVM IR. The same parsing structure can feed either path.',
  };
  yield {
    state: parseGraph('ASTs link to later compiler data structures'),
    highlight: { active: ['ast', 'emit', 'e-ast-emit'], found: ['tokens', 'bp'], compare: ['prefix', 'infix'] },
    explanation: 'The AST is not the whole compiler. Control Flow Graph & Dominator Tree handles branches. Static Single Assignment & Phi Nodes handles values across joins. Linear Scan Register Allocation handles final machine registers.',
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
      heading: 'What it is',
      paragraphs: [
        'A Pratt parser is a compact expression parser built around token-specific parse functions and binding powers. It is especially good for expression grammars with many precedence levels, unary and binary operators, calls, indexing, and user-extensible operators.',
        'Instead of writing one recursive-descent function for every precedence level, a Pratt parser stores prefix behavior, infix behavior, and precedence in a table. The parser reads tokens left to right and recursively parses the right side only when the next operator binds tightly enough.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The parser state has a token stream, a current token, a previous token, a parselet table, and a minimum binding power. Prefix parselets create the initial left expression. Infix parselets receive the left expression and build a larger expression node. Associativity is encoded by how the right binding power is chosen.',
        'The output can be an Abstract Syntax Tree, bytecode, or compiler IR. Building an AST pairs naturally with Zipper Focused Tree for structured editing and refactoring. Emitting bytecode directly pairs naturally with stack-machine interpreters.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For a + b * c, the parser first parses a as the left expression. It sees + with low binding power and consumes it. To parse the right side of +, it parses b, then sees * with higher binding power, so it consumes * and parses c. The final tree is +(a, *(b, c)), not *((a + b), c).',
        'Add unary minus and function calls and the value of the table becomes obvious. The token - has a prefix parselet for negation and an infix parselet for subtraction. The token ( can be grouping in prefix position and a call operator in infix position. One token table keeps those roles explicit.',
      ],
    },
    {
      heading: 'Implementation notes',
      paragraphs: [
        'A production parser should keep source spans on every AST node, because diagnostics, refactors, formatters, and editor integrations need to point back to the original text. It should also separate lexical errors from parse errors so bad characters do not poison the entire expression parser.',
        'Error recovery is the part tutorials often underplay. After a missing right operand or unmatched parenthesis, the parser needs synchronization tokens such as semicolon, newline, comma, or closing delimiter. Without recovery, one malformed expression can hide every later error in the file.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'A Pratt parser does not replace a lexer, grammar design, error recovery, or statement-level parsing. Bad binding powers create subtle associativity bugs. Error messages also need care because the parser is compact enough that failures can otherwise point at the wrong token.',
        'Primary sources: Vaughan Pratt, Top Down Operator Precedence, at https://tdop.github.io/, Crafting Interpreters compiling expressions at https://craftinginterpreters.com/compiling-expressions.html, Crafting Interpreters parsing expressions at https://craftinginterpreters.com/parsing-expressions.html, and LLVM Kaleidoscope parser and AST at https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/LangImpl02.html. Study JSON Parser Stack Case Study, Finite State Machines, Stack, Tree Traversals, Zipper Focused Tree, Bytecode Stack Virtual Machine, Control Flow Graph & Dominator Tree, Static Single Assignment & Phi Nodes, Unification Union-Find Type Constraints, and Hindley-Milner Algorithm W & Let Polymorphism next.',
      ],
    },
  ],
};
