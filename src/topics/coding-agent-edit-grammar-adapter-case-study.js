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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the edit-intent view as a translation boundary. The agent wants a semantic change, such as rename this symbol or replace this branch condition. The local runtime may accept a unified diff, search-replace block, AST edit, IDE call, or typed patch tool.',
        'Read the rollback-ledger view as the safety proof. Active rows show the target path, locator, precondition, generated patch, dry run, actual diff, verifier result, and rollback handle. The safe inference is that applying patch text is not enough; the applied state must match the intended edit.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Editing is the most dangerous operation in a coding-agent trace because it mutates the workspace. A model can choose the right fix and still fail because the runtime expects another patch grammar, line numbers drift, or the replacement matches too many places. A clean patch apply also does not prove the edit was the intended one.',
        'An edit grammar adapter separates intent from encoding. The stable object is a typed edit intent with target path, locator, expected old state, transformation, allowed scope, verifier, and rollback metadata. A concrete diff or tool call is only one way to carry that intent into a local environment.',
        {type:'callout', text:'Edit adapters make patch formats replaceable by treating every edit as a verified, rollbackable state transition.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train the model to emit the native edit format directly. If the runner expects unified diffs, ask for diffs. If it expects search-replace blocks, ask for those. This is simple and often works inside one benchmark harness.',
        'The approach becomes brittle when the environment changes. A diff hunk can fail after nearby edits, a search string can match two functions, and a whole-file rewrite can overwrite unrelated user changes. The model may look wrong when the actual failure was binding the right intent to the wrong grammar.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ambiguity under drift. Files change while an agent is reasoning, formatters move lines, generated files appear, and imports can be reordered. A locator based only on line number or weak text can identify the wrong span after that drift.',
        'There is also an evaluation wall. If a patch applies cleanly but changes the wrong behavior, raw apply success rewards the wrong thing. If a patch grammar fails while the intended fix was correct, raw apply failure blames the wrong layer. The system needs an error taxonomy that separates planning, locating, binding, applying, and verifying.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make edit intent the stable data structure. The intent says what should change, why, where it is allowed to write, what old state must be present, and how success will be checked. Concrete patch text is generated from that intent only after the adapter knows local capabilities.',
        'The invariant is roundtrip alignment. Parse intent, bind it to a local grammar, dry-run it, apply it once, inspect the actual diff, run the verifier, and keep a rollback handle. At every gate, the workspace state must still match the intended state transition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The planner emits a typed intent. The adapter chooses a grammar supported by the environment, serializes the change, checks preconditions, applies against a snapshot, and normalizes any failure into a useful observation such as stale_locator, ambiguous_match, parse_error, policy_blocked, apply_failed, or test_failed.',
        'After apply, the adapter compares the actual diff with the expected scope. If a search-replace edit also touched generated code or an unrelated comment, the adapter can reject it even though the grammar accepted it. If verification passes, the ledger records the patch, test evidence, and rollback snapshot.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the adapter preserves authority and evidence around a mutation. The model proposes a change, but the environment decides whether the locator is current, whether the write scope is allowed, whether the concrete patch matches intent, and whether behavior still passes checks. This prevents patch syntax from masquerading as correctness.',
        'Strong locators are the key correctness device. They combine path, file digest, surrounding text, symbol name, syntax node, imports, and sometimes language-server data. If those facts no longer identify one target, the adapter fails loudly instead of guessing.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Adapters add latency, implementation work, and rejection. A direct patch may take one apply attempt; an adapter may parse intent, resolve symbols, dry-run, apply, diff, test, and record rollback. That overhead is justified when failed edits are expensive or when training data must distinguish useful intent from grammar accidents.',
        'Suppose an agent proposes 1,000 edits. If 8 percent have stale locators, 4 percent have ambiguous matches, and 6 percent fail verification, a raw runner might collapse all 180 failures into "bad patch." An adapter turns them into separate repair signals, which improves debugging and model evaluation.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Edit adapters win in multi-environment training, IDE agents, code-review assistants, refactoring tools, and benchmark portability audits. They let the same abstract edit bind to a diff runner, language-server rename, AST transform, or typed patch tool. That makes the agent less tied to one interface.',
        'They are also useful for protecting user worktrees. Allowed paths, generated-file policy, lockfile policy, and rollback rules can be enforced outside the model prompt. Unexpected diffs become safety evidence instead of side effects hidden in a final patch.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the intent schema is too weak. If the record says only "replace foo with bar," the adapter cannot know whether comments, generated files, tests, or vendored code are in scope. Weak intent creates false confidence.',
        'It also fails when the verifier is shallow. A patch can apply cleanly, stay inside scope, and pass a weak test while still changing the wrong behavior. The adapter protects the edit boundary, but it cannot prove semantics that the verifier never observes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An agent needs to rename loadUserProfile to loadAccountProfile in two source files and one test. The intent names the symbol, the allowed paths, the expected old references, and the verifier command. In a diff runner, the adapter emits hunks; in an IDE runner, it calls a rename API; in an AST runner, it targets parsed identifier nodes.',
        'Suppose a naive search-replace finds six matches, including one generated file outside scope. The adapter rejects the concrete patch because expected scope was three files and actual scope was four. The agent receives a precise observation, updates the intent or scope, and avoids clobbering unrelated output.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include SWE-agent on agent-computer interfaces at https://arxiv.org/abs/2405.15793, mini-SWE-agent at https://github.com/SWE-agent/mini-swe-agent, Git apply documentation at https://git-scm.com/docs/git-apply, Model Context Protocol documentation at https://modelcontextprotocol.io/docs/getting-started/intro, and Aider benchmark notes at https://aider.chat/docs/leaderboards/. Read them as evidence that agent edits are interface-bound state transitions, not just text patches.',
        'Study abstract agent operation graphs, agent portability audits, verified trajectory stores, constrained decoding, Model Context Protocol, Git internals, language-server protocols, and operational transformation next. The recurring test is whether an edit remains a verified state transition after the local grammar changes.',
      ],
    },
  ],
};
