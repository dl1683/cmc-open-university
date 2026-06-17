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
    explanation: 'A portable coding agent should first form an edit intent: target file, locator, precondition, transformation, and expected postcondition. The concrete grammar comes later, after the runtime knows which edit surface is available.',
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
    explanation: 'The same abstract edit can bind to a unified diff, search-replace block, whole-file rewrite, IDE workspace edit, or typed MCP-style tool. The result must come back as a normalized observation so failures can be compared across grammars.',
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
    explanation: 'An edit adapter is a small transaction system. It needs a pre-edit snapshot, an applied diff, normalized diagnostics, a test result, and an undo path if the binding failed, because a bad edit should not become hidden working-tree state.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Edit is the most dangerous operation in a coding-agent trace because it changes the workspace. A model can choose the right high-level fix and still fail because the local runtime expects a different patch grammar, line numbers drifted, or the replacement matched too many spans.',
        'A coding-agent edit grammar adapter separates what the agent wants to change from how the local environment accepts edits. The stable object is a typed edit intent: target path, locator, precondition, transformation, postcondition, verifier, and rollback metadata. A unified diff, search-replace block, whole-file rewrite, IDE API call, AST transform, or typed tool call is only one binding of that intent.',
        'This matters for curriculum because editing is where abstract reasoning meets a real filesystem. A learner should not leave with the idea that a patch is just text. A patch is a proposed state transition with authority, scope, evidence, and rollback cost.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to let the model emit the native edit format directly. If the runtime expects a unified diff, train on diffs. If it expects search-replace blocks, train on those. This is simple and often works in one environment.',
        'The wall appears when the edit surface changes or the file has drifted. A diff hunk can fail to apply. A search string can match multiple places. A whole-file rewrite can clobber unrelated changes. A clean apply also does not prove the edit was the intended one.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make edit intent the stable object and treat concrete patch text as a binding. The key structures are an edit intent AST, locator map, file-version clock, adapter capability table, dry-run result, applied diff, normalized diagnostic record, rollback snapshot, and verifier proof ledger.',
        'This fills a practical gap between Abstract Agent Operation Graph and the agent-portability audit module. Those modules show that edit should be an abstract operation. This module shows the concrete data structure that lets the same edit survive different agent-computer interfaces.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        "The edit-intent view separates the agent's desired operation from the patch syntax used to carry it. The target path, locator, expected old text, transformation, and verifier are the durable pieces. A diff hunk or search-replace block is only the local encoding.",
        "The rollback-ledger view shows the safety argument. A serious adapter records the pre-edit snapshot, the chosen grammar, the dry-run result, the actual diff, the verifier result, and the rollback handle. That ledger is what lets a runtime reject unsafe edits without losing the lesson from the failed attempt.",
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
      heading: 'Worked example',
      paragraphs: [
        'An agent needs to rename `loadUserProfile` to `loadAccountProfile` in two files. The intent says which symbol should change, which files are in scope, which old references must be present, and which tests or static checks should run afterward. In a diff-based runner, the adapter emits hunks. In an IDE runner, it may call a rename API. In an AST-backed runner, it may bind to parsed identifier nodes.',
        'The adapter then compares the actual workspace diff with the intent. If a search-replace edit also changed a comment in generated code outside the allowed scope, the apply may have succeeded but the adapter should reject it. If the target file changed and the old anchor is missing, the adapter should report a stale locator rather than guessing.',
      ],
    },
    {
      heading: 'Intent schema',
      paragraphs: [
        'A useful edit intent is more than path plus replacement. It should include the reason for the change, the expected old state, a locator strategy, allowed write scope, transformation type, verifier, and rollback policy. For multi-file edits, it should also describe whether all edits must apply atomically or whether partial application is allowed.',
        'The locator deserves special care. Line numbers are weak because files drift. Stronger locators combine file digest, surrounding text, syntax node, symbol name, import path, and sometimes semantic information from a language server. The point is to fail loudly when evidence no longer identifies the target.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is roundtrip proof. The intent is parsed, bound to a local grammar, dry-run, applied once, converted back to an actual diff, compared with the expected change, verified by tests or policy, and linked to a rollback snapshot. Each gate preserves the invariant that applied workspace state matches the intended edit.',
        'A locator should not be just a line number. Strong locators combine path, old text, syntax node, symbol name, neighboring anchors, and file digest. That lets the adapter detect stale context instead of applying a plausible patch to the wrong location.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Adapters add latency and rejection. Malformed patches, ambiguous locators, and weak preconditions are dropped before they reach the dataset. That can look wasteful, but it prevents bad edits from becoming positive examples.',
        'No grammar is universally best. Diff hunks are compact but fragile. Search-replace blocks are readable but can match too much. Whole-file rewrites are easy but can clobber. AST edits are semantic but parser-bound. Typed tools need authorization and policy gates.',
        'The adapter also changes evaluation. A raw model might be penalized for a patch grammar mismatch even when its intended fix was good. A model might also be rewarded for a clean patch that only passed because the verifier was weak. Separating intent, binding, and verification gives the evaluator a better error taxonomy.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Edit adapters win in multi-environment training, IDE agents, typed tool environments, and portability audits. They let evaluation ask a sharper question: did the model choose the right edit intent, or did the local grammar fail to express it?',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the intent schema is too weak to identify the target or too rigid to express local editing conventions. It also fails when the verifier is shallow. A patch can apply cleanly, pass weak tests, and still edit the wrong behavior. The trace should identify whether the plan, locator, binding, verifier, or rollback gate failed.',
        'It also fails when policy is implicit. If the adapter can edit generated files, vendored code, lockfiles, or unrelated user changes without declaring that authority, it becomes a clobbering tool. Good adapters make write scope explicit and treat unexpected diffs as evidence of danger, not as harmless side effects.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failure modes are stale line numbers, ambiguous search text, parser mismatch, formatter churn, hidden generated-code updates, cross-platform newline changes, non-atomic multi-file edits, and verifiers that do not exercise the edited behavior. Each failure should produce a specific observation so the next agent can repair the right layer.',
        'The most important misconception is that patch application equals correctness. It does not. Application only proves that the local grammar accepted the edit. Correctness requires intent alignment, bounded scope, behavioral verification, and an ability to restore or explain the previous state.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A coding agent must rename a deprecated API across a repository. In a diff-only runner, the intent binds to unified hunks. In an IDE runner, it binds to symbol-aware workspace edits. In a typed tool runner, it binds to apply_patch with path and hunk arguments. The abstract trace stays the same: find references, prepare rename intent, apply edits, run tests, inspect failures, and submit.',
        'Without the adapter, a model may look brittle because it learned one patch grammar. With the adapter, the evaluation can ask a sharper question: did the model choose the right edit intent, or did the local grammar fail to express it?',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Do not accept successful patch application as correctness. A patch can apply cleanly and still edit the wrong file, clobber comments, delete unrelated code, or pass weak tests. Do not hide adapter failures inside a generic agent failure.',
        'Primary sources: SWE-agent on agent-computer interfaces at https://arxiv.org/abs/2405.15793, mini-SWE-agent at https://github.com/SWE-agent/mini-swe-agent, Git apply documentation at https://git-scm.com/docs/git-apply, Model Context Protocol overview at https://modelcontextprotocol.io/docs/getting-started/intro, and Aider Polyglot benchmark notes at https://aider.chat/docs/leaderboards/. Study Abstract Agent Operation Graph, the agent-portability audit module, Verified Agent Trajectory Store, Constrained Decoding, Model Context Protocol Case Study, Git Internals, and Operational Transformation next.',
      ],
    },
  ],
};
