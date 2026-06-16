// Coding-agent edit grammar adapters: preserve abstract edit intent while
// binding safely to diff, whole-file, IDE, AST, or typed tool surfaces.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'coding-agent-edit-grammar-adapter-case-study',
  title: 'Coding Agent Edit Grammar Adapter Case Study',
  category: 'AI & ML',
  summary: 'A coding-agent portability case study: represent edits as typed intent, bind them to local edit grammars, dry-run them, and store rollback proof.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['edit intent AST', 'adapter rollback ledger'], defaultValue: 'edit intent AST' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function intentGraph(title) {
  return graphState({
    nodes: [
      { id: 'issue', label: 'issue', x: 0.7, y: 3.4, note: 'goal' },
      { id: 'loc', label: 'locate', x: 2.0, y: 2.0, note: 'span' },
      { id: 'intent', label: 'intent', x: 3.5, y: 3.4, note: 'AST' },
      { id: 'bind', label: 'bind', x: 5.0, y: 3.4, note: 'grammar' },
      { id: 'dry', label: 'dry-run', x: 6.6, y: 2.0, note: 'check' },
      { id: 'apply', label: 'apply', x: 6.6, y: 4.8, note: 'patch' },
      { id: 'verify', label: 'verify', x: 8.2, y: 3.4, note: 'tests' },
      { id: 'trace', label: 'trace', x: 9.5, y: 3.4, note: 'proof' },
    ],
    edges: [
      { id: 'e-issue-loc', from: 'issue', to: 'loc' },
      { id: 'e-loc-intent', from: 'loc', to: 'intent' },
      { id: 'e-intent-bind', from: 'intent', to: 'bind' },
      { id: 'e-bind-dry', from: 'bind', to: 'dry' },
      { id: 'e-dry-apply', from: 'dry', to: 'apply' },
      { id: 'e-apply-verify', from: 'apply', to: 'verify' },
      { id: 'e-verify-trace', from: 'verify', to: 'trace' },
    ],
  }, { title });
}

function adapterGraph(title) {
  return graphState({
    nodes: [
      { id: 'intent', label: 'intent', x: 0.7, y: 3.4, note: 'typed' },
      { id: 'schema', label: 'schema', x: 2.1, y: 3.4, note: 'args' },
      { id: 'diff', label: 'diff', x: 3.8, y: 1.2, note: 'hunks' },
      { id: 'replace', label: 'replace', x: 3.8, y: 2.8, note: 'search' },
      { id: 'whole', label: 'whole', x: 3.8, y: 4.4, note: 'file' },
      { id: 'typed', label: 'typed', x: 3.8, y: 6.0, note: 'tool' },
      { id: 'normal', label: 'norm obs', x: 6.0, y: 3.4, note: 'result' },
      { id: 'undo', label: 'undo', x: 7.7, y: 5.0, note: 'snapshot' },
      { id: 'proof', label: 'proof', x: 9.3, y: 3.4, note: 'ledger' },
    ],
    edges: [
      { id: 'e-intent-schema', from: 'intent', to: 'schema' },
      { id: 'e-schema-diff', from: 'schema', to: 'diff' },
      { id: 'e-schema-replace', from: 'schema', to: 'replace' },
      { id: 'e-schema-whole', from: 'schema', to: 'whole' },
      { id: 'e-schema-typed', from: 'schema', to: 'typed' },
      { id: 'e-diff-normal', from: 'diff', to: 'normal' },
      { id: 'e-replace-normal', from: 'replace', to: 'normal' },
      { id: 'e-whole-normal', from: 'whole', to: 'normal' },
      { id: 'e-typed-normal', from: 'typed', to: 'normal' },
      { id: 'e-normal-undo', from: 'normal', to: 'undo' },
      { id: 'e-normal-proof', from: 'normal', to: 'proof' },
      { id: 'e-undo-proof', from: 'undo', to: 'proof' },
    ],
  }, { title });
}

function* editIntentAst() {
  yield {
    state: intentGraph('Edit as typed intent before patch text'),
    highlight: { active: ['issue', 'loc', 'intent', 'e-issue-loc', 'e-loc-intent'], compare: ['bind', 'apply'], found: ['verify'] },
    explanation: 'A portable coding agent should first form an edit intent: target file, locator, precondition, transformation, and expected postcondition. The concrete grammar comes later.',
    invariant: 'Intent is the stable object; patch text is one binding.',
  };

  yield {
    state: labelMatrix(
      'Edit intent AST fields',
      [
        { id: 'op', label: 'op' },
        { id: 'path', label: 'path' },
        { id: 'span', label: 'span' },
        { id: 'pre', label: 'pre' },
        { id: 'post', label: 'post' },
        { id: 'undo', label: 'undo' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['rename', 'intent', 'bad op'],
        ['file', 'route', 'stale'],
        ['anchors', 'locate', 'drift'],
        ['old', 'guard', 'false'],
        ['test', 'verify', 'weak'],
        ['snap', 'revert', 'miss'],
      ],
    ),
    highlight: { active: ['op:value', 'span:value', 'pre:value', 'post:value'], found: ['undo:why'], compare: ['path:risk'] },
    explanation: 'The adapter needs enough structure to reject dangerous edits. A search string without a path, an edit without a precondition, or a patch without a rollback snapshot is too weak for a training trace.',
  };

  yield {
    state: adapterGraph('Bind the same intent to local grammars'),
    highlight: { active: ['intent', 'schema', 'diff', 'replace', 'whole', 'typed', 'e-intent-schema', 'e-schema-diff', 'e-schema-replace', 'e-schema-whole', 'e-schema-typed'], found: ['normal'] },
    explanation: 'The same abstract edit can bind to a unified diff, search-replace block, whole-file rewrite, IDE workspace edit, or typed MCP-style tool. The result must come back as a normalized observation.',
  };

  yield {
    state: labelMatrix(
      'Roundtrip gates',
      [
        { id: 'parse', label: 'parse' },
        { id: 'dry', label: 'dry' },
        { id: 'apply', label: 'apply' },
        { id: 'diff', label: 'diff' },
        { id: 'test', label: 'test' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['schema ok', 'drop'],
        ['clean hit', 'rebind'],
        ['one patch', 'undo'],
        ['expected', 'review'],
        ['oracle', 'repair'],
        ['record', 'audit'],
      ],
    ),
    highlight: { active: ['parse:check', 'dry:check', 'apply:check', 'diff:check'], found: ['test:check', 'trace:check'], removed: ['dry:fail'] },
    explanation: 'The adapter performs a roundtrip: parse the intent, dry-run the local grammar, apply exactly one patch, compare the resulting diff, run the verifier, and store the trace.',
  };
}

function* adapterRollbackLedger() {
  yield {
    state: adapterGraph('Adapter ledger with rollback path'),
    highlight: { active: ['schema', 'diff', 'replace', 'whole', 'typed', 'normal', 'undo', 'proof'], found: ['e-normal-undo', 'e-undo-proof'], compare: ['intent'] },
    explanation: 'An edit adapter is a small transaction system. It needs a pre-edit snapshot, an applied diff, normalized diagnostics, a test result, and an undo path if the binding failed.',
    invariant: 'Every edit surface should emit the same proof shape.',
  };

  yield {
    state: labelMatrix(
      'Grammar surface tradeoffs',
      [
        { id: 'udiff', label: '' },
        { id: 'srch', label: '' },
        { id: 'whole', label: '' },
        { id: 'ast', label: '' },
        { id: 'ide', label: '' },
        { id: 'tool', label: '' },
      ],
      [
        { id: 'kind', label: 'kind' },
        { id: 'risk', label: 'risk' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['udiff', 'hunk', 'check'],
        ['srch', 'multi', 'unique'],
        ['whole', 'clobber', 'diff'],
        ['AST', 'parser', 'types'],
        ['IDE', 'hidden', 'obs'],
        ['tool', 'policy', 'auth'],
      ],
    ),
    highlight: { active: ['udiff:gate', 'srch:gate', 'whole:gate', 'ast:gate', 'tool:gate'], compare: ['whole:risk'], found: ['ast:kind', 'tool:kind'] },
    explanation: 'No grammar is universally best. Diff hunks are compact but fragile, whole-file rewrites are easy but can clobber, AST edits are semantic but parser-bound, and typed tools need policy gates.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'adapter gate', min: 0, max: 5 }, y: { label: 'accepted edits, illustrative percent', min: 0, max: 100 } },
      series: [
        { id: 'raw', label: 'raw model edits', points: [{ x: 0, y: 100 }, { x: 1, y: 100 }, { x: 2, y: 100 }, { x: 3, y: 100 }, { x: 4, y: 100 }] },
        { id: 'safe', label: 'after gates', points: [{ x: 0, y: 100 }, { x: 1, y: 86 }, { x: 2, y: 73 }, { x: 3, y: 61 }, { x: 4, y: 54 }] },
      ],
      markers: [
        { id: 'parse', x: 1, y: 86, label: 'parse' },
        { id: 'dry', x: 2, y: 73, label: 'dry' },
        { id: 'test', x: 4, y: 54, label: 'test' },
      ],
    }),
    highlight: { active: ['safe', 'parse', 'dry', 'test'], compare: ['raw'] },
    explanation: 'A safe adapter rejects many candidate edits before they reach the dataset. That is useful: malformed patches, ambiguous locators, and unverified edits should not become positive training examples.',
  };

  yield {
    state: labelMatrix(
      'Complete case: API rename',
      [
        { id: 'a', label: 'find' },
        { id: 'b', label: 'intent' },
        { id: 'c', label: 'bind' },
        { id: 'd', label: 'test' },
        { id: 'e', label: 'keep' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['old API', 'refs'],
        ['rename', 'schema'],
        ['diff', 'dryrun'],
        ['pass', 'junit'],
        ['trace', 'hash'],
      ],
    ),
    highlight: { active: ['a:proof', 'b:proof', 'c:proof', 'd:proof', 'e:proof'], found: ['d:state', 'e:state'] },
    explanation: 'An agent renames a deprecated API across two files. The adapter anchors each span, emits a diff, checks that only expected hunks changed, runs tests, and stores the rollback snapshot with the final proof.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'edit intent AST') yield* editIntentAst();
  else if (view === 'adapter rollback ledger') yield* adapterRollbackLedger();
  else throw new InputError('Pick an edit-grammar adapter view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A coding-agent edit grammar adapter separates what the agent wants to change from how the local harness accepts edits. The stable object is a typed edit intent: target path, locator, precondition, transformation, postcondition, verifier, and rollback metadata. A unified diff, search-replace block, whole-file rewrite, IDE API call, AST transform, or typed tool call is only one binding of that intent.',
        'This fills a practical gap between Abstract Agent Operation Graph and Agent Harness Portability Audit. Those modules show that edit should be an abstract operation. This module shows the concrete data structure that lets the same edit survive different agent-computer interfaces.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The key structures are an edit intent AST, locator map, file-version clock, adapter capability table, dry-run result, applied diff, normalized diagnostic record, rollback snapshot, and verifier proof ledger. Together they make edit portable, auditable, and reversible.',
        'A locator should not be just a line number. Strong locators combine path, old text, syntax node, symbol name, neighboring anchors, and file digest. That lets the adapter detect stale context instead of applying a plausible patch to the wrong location.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The planner emits edit intent. The adapter chooses the best available grammar, serializes the intent, dry-runs it, applies it against a snapshot, compares the actual diff with the expected intent, runs the verifier, and records the result. If a gate fails, the adapter returns a normalized observation such as parse_error, stale_locator, ambiguous_match, apply_failed, test_failed, or policy_blocked.',
        'This is why edit adapters are more like transaction coordinators than text formatters. They protect the working tree, distinguish model reasoning errors from binding errors, and preserve evidence that the final patch really came from the intended operation.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A coding agent must rename a deprecated API across a repository. In a diff-only harness, the intent binds to unified hunks. In an IDE harness, it binds to symbol-aware workspace edits. In a typed tool harness, it binds to apply_patch with path and hunk arguments. The abstract trace stays the same: find references, prepare rename intent, apply edits, run tests, inspect failures, and submit.',
        'Without the adapter, a model may look brittle because it learned one patch grammar. With the adapter, the evaluation can ask a sharper question: did the model choose the right edit intent, or did the local grammar fail to express it?',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not accept successful patch application as correctness. A patch can apply cleanly and still edit the wrong file, clobber comments, delete unrelated code, or pass weak tests. Do not hide adapter failures inside a generic agent failure. The trace should identify whether the plan, locator, binding, verifier, or rollback gate failed.',
        'Primary sources: SWE-agent on agent-computer interfaces at https://arxiv.org/abs/2405.15793, mini-SWE-agent at https://github.com/SWE-agent/mini-swe-agent, Git apply documentation at https://git-scm.com/docs/git-apply, Model Context Protocol overview at https://modelcontextprotocol.io/docs/getting-started/intro, and Aider Polyglot benchmark notes at https://aider.chat/docs/leaderboards/. Study Abstract Agent Operation Graph, Agent Harness Portability Audit, Verified Agent Trajectory Store, Constrained Decoding, Model Context Protocol Case Study, Git Internals, and Operational Transformation next.',
      ],
    },
  ],
};
