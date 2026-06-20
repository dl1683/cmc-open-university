// Coding-agent trajectory dedupe: normalize operations, fingerprint behavior,
// and keep provenance hashes so train/eval splits cannot silently leak.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'agent-trajectory-dedupe-provenance-hash-case-study',
  title: 'Agent Trajectory Dedupe & Provenance Hash',
  category: 'AI & ML',
  summary: 'A training-data hygiene case study for coding agents: fingerprint near-duplicate rollouts, preserve provenance, and block train/eval leakage.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trajectory fingerprints', 'split leakage guard'], defaultValue: 'trajectory fingerprints' },
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

function fingerprintGraph(title) {
  return graphState({
    nodes: [
      { id: 'task', label: 'task', x: 0.7, y: 3.4, note: 'issue' },
      { id: 'env', label: 'env', x: 2.0, y: 1.6, note: 'image' },
      { id: 'events', label: 'events', x: 2.0, y: 5.2, note: 'ops' },
      { id: 'norm', label: 'normalize', x: 3.6, y: 3.4, note: 'schema' },
      { id: 'patch', label: 'patch', x: 5.0, y: 1.6, note: 'diff' },
      { id: 'oracle', label: 'oracle', x: 5.0, y: 5.2, note: 'tests' },
      { id: 'shingle', label: 'shingles', x: 6.5, y: 2.4, note: 'ops' },
      { id: 'minhash', label: 'MinHash', x: 6.5, y: 4.5, note: 'sig' },
      { id: 'prov', label: 'prov', x: 7.8, y: 3.4, note: 'hash' },
      { id: 'canon', label: 'canon', x: 9.4, y: 3.4, note: 'record' },
    ],
    edges: [
      { id: 'e-task-env', from: 'task', to: 'env' },
      { id: 'e-task-events', from: 'task', to: 'events' },
      { id: 'e-env-norm', from: 'env', to: 'norm' },
      { id: 'e-events-norm', from: 'events', to: 'norm' },
      { id: 'e-norm-patch', from: 'norm', to: 'patch' },
      { id: 'e-norm-oracle', from: 'norm', to: 'oracle' },
      { id: 'e-norm-shingle', from: 'norm', to: 'shingle' },
      { id: 'e-shingle-minhash', from: 'shingle', to: 'minhash' },
      { id: 'e-patch-prov', from: 'patch', to: 'prov' },
      { id: 'e-oracle-prov', from: 'oracle', to: 'prov' },
      { id: 'e-minhash-prov', from: 'minhash', to: 'prov' },
      { id: 'e-prov-canon', from: 'prov', to: 'canon' },
    ],
  }, { title });
}

function splitGraph(title) {
  return graphState({
    nodes: [
      { id: 'raw', label: 'raw pool', x: 0.7, y: 3.4, note: 'rollouts' },
      { id: 'bucket', label: 'LSH bucket', x: 2.3, y: 3.4, note: 'similar' },
      { id: 'root', label: 'family root', x: 3.9, y: 3.4, note: 'canon' },
      { id: 'train', label: 'train', x: 5.6, y: 1.6, note: 'allowed' },
      { id: 'eval', label: 'eval', x: 5.6, y: 5.2, note: 'held out' },
      { id: 'quar', label: 'quarantine', x: 7.4, y: 3.4, note: 'review' },
      { id: 'ledger', label: 'split ledger', x: 9.0, y: 3.4, note: 'audit' },
    ],
    edges: [
      { id: 'e-raw-bucket', from: 'raw', to: 'bucket' },
      { id: 'e-bucket-root', from: 'bucket', to: 'root' },
      { id: 'e-root-train', from: 'root', to: 'train' },
      { id: 'e-root-eval', from: 'root', to: 'eval' },
      { id: 'e-train-quar', from: 'train', to: 'quar' },
      { id: 'e-eval-quar', from: 'eval', to: 'quar' },
      { id: 'e-quar-ledger', from: 'quar', to: 'ledger' },
      { id: 'e-root-ledger', from: 'root', to: 'ledger' },
    ],
  }, { title });
}

function* trajectoryFingerprints() {
  yield {
    state: fingerprintGraph('A trajectory fingerprint combines behavior and evidence'),
    highlight: { active: ['task', 'env', 'events', 'norm', 'patch', 'oracle', 'e-task-env', 'e-task-events', 'e-env-norm', 'e-events-norm', 'e-norm-patch', 'e-norm-oracle'], found: ['prov'] },
    explanation: 'A rollout can be near-duplicate even when the transcript differs. Normalize the task, environment, operation sequence, patch, and oracle result before computing fingerprints, or the deduper will confuse formatting noise with new evidence.',
  };

  yield {
    state: labelMatrix(
      'Normalize noisy agent events',
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'tool', label: 'tool call' },
        { id: 'cmd', label: 'command' },
        { id: 'diff', label: 'diff' },
        { id: 'test', label: 'test' },
      ],
      [
        { id: 'raw', label: 'raw' },
        { id: 'key', label: 'key' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['long text', 'task id', 'stable'],
        ['JSON noise', 'op name', 'compare'],
        ['shell path', 'cmd kind', 'portable'],
        ['line nums', 'hunk fp', 'dedupe'],
        ['stdout', 'pass/fail', 'oracle'],
      ],
    ),
    highlight: { active: ['tool:key', 'cmd:key', 'diff:key', 'test:key'], compare: ['prompt:raw'] },
    explanation: 'The fingerprint should ignore accidental formatting but keep semantic differences. Two agents can use different shell syntax and still perform the same abstract operation sequence.',
    invariant: 'Dedupe the behavior, not the prettiness of the transcript.',
  };

  yield {
    state: fingerprintGraph('MinHash catches near-duplicate operation paths'),
    highlight: { active: ['norm', 'shingle', 'minhash', 'prov', 'e-norm-shingle', 'e-shingle-minhash', 'e-minhash-prov'], compare: ['patch', 'oracle'] },
    explanation: 'Operation shingles turn a trajectory into a set: read-file, inspect-error, edit-hunk, run-test, repair-hunk. MinHash and LSH find likely-near traces before expensive exact comparison, so the pipeline spends human review on the ambiguous band rather than every pair.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'similarity threshold', min: 0.5, max: 1.0 }, y: { label: 'pair decisions', min: 0, max: 100 } },
      series: [
        { id: 'caught', label: 'duplicates caught', points: [{ x: 0.55, y: 96 }, { x: 0.65, y: 91 }, { x: 0.75, y: 80 }, { x: 0.85, y: 62 }, { x: 0.95, y: 28 }] },
        { id: 'false', label: 'false merges', points: [{ x: 0.55, y: 32 }, { x: 0.65, y: 20 }, { x: 0.75, y: 11 }, { x: 0.85, y: 5 }, { x: 0.95, y: 1 }] },
      ],
      markers: [
        { id: 'audit', x: 0.82, y: 8, label: 'review band' },
      ],
    }),
    highlight: { active: ['caught', 'false', 'audit'] },
    explanation: 'The threshold is a data-product decision. Low thresholds catch more duplicate families but risk merging distinct fixes. A review band around the cutoff is usually better than a single magic number.',
  };

  yield {
    state: labelMatrix(
      'Canonicalization decisions',
      [
        { id: 'exact', label: 'exact dup' },
        { id: 'near', label: 'near dup' },
        { id: 'family', label: 'issue fam' },
        { id: 'repo', label: 'same repo' },
        { id: 'new', label: 'new case' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
      ],
      [
        ['none', 'merge'],
        ['low', 'downsample'],
        ['leak risk', 'same split'],
        ['context', 'tag'],
        ['novel', 'promote'],
      ],
    ),
    highlight: { found: ['new:action'], compare: ['near:action', 'repo:action'], removed: ['exact:action'] },
    explanation: 'The canonical record keeps aliases to every duplicate, but the training sampler should not overweight the same fix ritual. Dedupe protects both training diversity and benchmark truth.',
  };
}

function* splitLeakageGuard() {
  yield {
    state: splitGraph('Near-duplicate families must stay on one side of a split'),
    highlight: { active: ['raw', 'bucket', 'root', 'train', 'eval', 'e-raw-bucket', 'e-bucket-root', 'e-root-train', 'e-root-eval'], removed: ['quar'] },
    explanation: 'Train/eval leakage is not only exact text overlap. The same bug family, patch hunk, test oracle, or generated synthetic mutation can leak through different transcripts unless the family root owns the split assignment.',
  };

  yield {
    state: labelMatrix(
      'Split keys and leakage risk',
      [
        { id: 'repo', label: 'repo' },
        { id: 'issue', label: 'issue' },
        { id: 'patch', label: 'patch' },
        { id: 'oracle', label: 'oracle' },
        { id: 'text', label: 'text' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'risk', label: 'risk' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['repo id', 'style leak', 'group'],
        ['issue id', 'answer leak', 'holdout'],
        ['hunk fp', 'fix leak', 'same split'],
        ['test fp', 'oracle leak', 'audit'],
        ['simhash', 'copy leak', 'block'],
      ],
    ),
    highlight: { active: ['issue:rule', 'patch:rule', 'oracle:rule', 'text:rule'], compare: ['repo:risk'] },
    explanation: 'A provenance hash should mix several identities: repository, issue family, base commit, environment digest, patch fingerprint, oracle fingerprint, and normalized trajectory signature.',
    invariant: 'A holdout set is only meaningful if duplicate families cannot straddle it.',
  };

  yield {
    state: splitGraph('Conflicting split evidence goes to quarantine'),
    highlight: { active: ['root', 'train', 'eval', 'quar', 'ledger', 'e-train-quar', 'e-eval-quar', 'e-quar-ledger'], compare: ['e-root-train', 'e-root-eval'] },
    explanation: 'If one record says a family belongs in train and another says eval, the right answer is not to average them. Quarantine the whole family, inspect provenance, then write one split decision into the ledger before the benchmark claim is trusted.',
  };

  yield {
    state: labelMatrix(
      'Complete case: duplicated bug-fix rollouts',
      [
        { id: 'a', label: 'trace A' },
        { id: 'b', label: 'trace B' },
        { id: 'c', label: 'trace C' },
        { id: 'd', label: 'trace D' },
      ],
      [
        { id: 'origin', label: 'origin' },
        { id: 'match', label: 'match' },
        { id: 'result', label: 'result' },
      ],
      [
        ['same issue', 'same hunk', 'merge'],
        ['mirror repo', 'same test', 'same split'],
        ['new issue', 'same idea', 'tag'],
        ['new repo', 'new hunk', 'keep'],
      ],
    ),
    highlight: { removed: ['a:result'], active: ['b:result', 'c:result'], found: ['d:result'] },
    explanation: 'A data team should distinguish exact duplicate, mirror duplicate, conceptual family, and genuinely new sample. Those cases deserve different sampler and split policies.',
  };

  yield {
    state: splitGraph('The split ledger is a provenance structure'),
    highlight: { active: ['root', 'ledger', 'e-root-ledger'], found: ['train', 'eval'], removed: ['quar'] },
    explanation: 'The final artifact is not just a list of ids. It is a split ledger that says why each trajectory family was promoted, held out, downsampled, or quarantined. That makes later benchmark claims auditable.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trajectory fingerprints') yield* trajectoryFingerprints();
  else if (view === 'split leakage guard') yield* splitLeakageGuard();
  else throw new InputError('Pick a trajectory-dedupe view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "trajectory fingerprints" view shows the pipeline from raw rollout to canonical record. Active nodes are the stage currently executing. Found nodes are outputs now committed. The graph traces how task metadata, environment identity, operation events, patch diffs, and oracle results flow through normalization and MinHash into a provenance hash.',
        'The "split leakage guard" view shows how near-duplicate families are routed into train, eval, or quarantine buckets. Active edges are live assignment paths. Removed nodes are quarantined families awaiting human review. The split ledger at the end is the audit artifact.',
        {
          type: 'note',
          text: 'In the similarity-threshold plot, the "review band" marker shows the zone where automated merge decisions are unreliable. Traces above the band merge automatically; traces below are kept as distinct. Traces inside the band require human judgment.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'If the same bug-fix pattern appears in both training and evaluation under different surface forms, the benchmark measures memorization, not generalization.',
          attribution: 'Core problem statement for coding-agent data pipelines',
        },
        {type:'callout', text:'The core problem: surface-level transcript diversity hides behavioral duplication. Three agents that use different shell commands to find the same bug and apply the same patch have produced one lesson, not three. Without dedupe, training overweights the ritual and evaluation inflates the score.'},
        'Coding-agent factories produce thousands of successful rollouts per day. A factory runs an agent against a pinned issue, records the tool calls, captures the final patch, confirms it passes the test oracle, and stores the trajectory. But three agents that use grep, rg, and direct file open to find the same assertion failure, apply the same guard, and pass the same test have produced one lesson wrapped in three transcripts.',
        'The damage is twofold. Training overweights the repeated pattern -- the model learns the patch ritual rather than the debugging skill. Evaluation inflates accuracy -- a "held-out" task that shares a mutation template, test oracle, or patch hunk with training data is not truly held out.',
        {
          type: 'table',
          headers: ['Duplication type', 'Surface difference', 'Shared evidence', 'Risk if missed'],
          rows: [
            ['Exact re-ingestion', 'None', 'Everything', 'Sampler overweights one example'],
            ['Tool-call variation', 'grep vs rg vs cat', 'Patch + oracle + task', 'False diversity in training'],
            ['Mirror repository', 'Repo name, paths', 'Mutation template + test', 'Train/eval leakage'],
            ['Synthetic mutation sibling', 'Variable names, line numbers', 'Generator seed + fix pattern', 'Benchmark inflation'],
            ['Conceptual neighbor', 'Different repo, different test', 'Same fix idea', 'Acceptable if labeled'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is exact matching. Hash the final diff, hash the test output, hash the issue description. If two records produce the same hash, merge them. This is fast, deterministic, and necessary -- it catches accidental re-ingestion, copy-paste imports, and identical reruns.',
        {
          type: 'code',
          language: 'python',
          text: '# Exact dedupe: hash the observable outputs\ndef exact_fingerprint(trajectory):\n    return hashlib.sha256(\n        trajectory.task_id.encode() +\n        trajectory.patch_diff.encode() +\n        trajectory.oracle_result.encode()\n    ).hexdigest()',
        },
        'Exact matching works for the easiest 20% of duplicates and costs almost nothing. It is a prerequisite, not a solution.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Behavior stays the same while surface text changes. Two agents apply the same one-line guard to the same function, but one uses single quotes and the other uses double quotes -- different diff hash, same fix. Line numbers shift after an unrelated commit -- different hunk header, same semantic patch. The model explains its plan in different words each run -- different transcript, same operation sequence.',
        {
          type: 'table',
          headers: ['Noise source', 'What changes', 'What stays the same', 'Exact-match verdict'],
          rows: [
            ['Whitespace formatting', 'Diff text', 'AST change', 'Distinct (wrong)'],
            ['Line number drift', 'Hunk header', 'Edited function + logic', 'Distinct (wrong)'],
            ['Tool selection', 'Shell commands', 'Information gathered', 'Distinct (wrong)'],
            ['Explanation wording', 'Transcript text', 'Operation sequence', 'Distinct (wrong)'],
            ['Variable renaming (synthetic)', 'All identifiers', 'Fix structure + test shape', 'Distinct (wrong)'],
          ],
        },
        'The opposite failure is equally dangerous. Two tasks both mention "off by one" but require editing different files, different functions, and different tests. A fuzzy matcher that groups on description text will merge genuinely distinct repairs.',
        {
          type: 'note',
          text: 'The invariant: dedupe must be sensitive to what the agent actually did (operation sequence, patch semantics, oracle identity) and insensitive to how it said it (formatting, tool choice, explanation text, line numbers).',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compare trajectories through multiple independent lenses, then let provenance decide which similarities threaten split integrity.',
        {
          type: 'bullets',
          items: [
            'Normalized operation sequence: abstract away tool names and paths into canonical operations (read-file, search-text, edit-hunk, run-test).',
            'Patch fingerprint: hash the edited function, removed logic, and added logic at the AST level, not the text level.',
            'Oracle fingerprint: hash the test command identity, failing test name, error class, and pass/fail outcome.',
            'Task provenance: repository id, issue family, synthetic mutation id, base commit, environment digest.',
          ],
        },
        'No single lens is sufficient. Two trajectories can share an operation sequence while fixing different bugs (same debugging ritual, different targets). They can share a patch fingerprint while using completely different discovery paths. The family decision requires agreement across lenses.',
        {
          type: 'diagram',
          label: 'Multi-lens comparison: each lens catches a different kind of duplicate',
          text: 'Trajectory A ──┬── ops: [search, read, edit, test]  ─── match ──── ops: [search, read, edit, test] ──┬── Trajectory B\n               ├── patch: guard(tokens != null)     ─── match ──── patch: guard(tokens != null)     ├\n               ├── oracle: test_empty_input PASS     ─── match ──── oracle: test_empty_input PASS     ├\n               └── prov: repo=X, issue=42, mut=m7   ─── match ──── prov: repo=X, issue=42, mut=m7   ┘\n                                                                                                      \n               All four lenses agree => merge into one canonical family.',
        },
        'The main data structure is a canonical family record: a provenance root, a split assignment, aliases to every member rollout, per-lens similarity scores, and a sampler policy (merge / downsample / tag / promote). The family record never deletes evidence. It tells downstream systems how many times each trajectory should count and where it may appear.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline runs four passes over the raw trajectory pool.',
        {
          type: 'table',
          headers: ['Pass', 'Method', 'Output', 'Cost'],
          rows: [
            ['1. Exact dedupe', 'SHA-256 on (task_id, patch_hash, oracle_hash)', 'Alias groups', 'O(n)'],
            ['2. Near-duplicate candidates', 'MinHash + LSH on operation shingles', 'Candidate pairs', 'O(n) expected'],
            ['3. Provenance linking', 'Join on repo lineage, mutation id, issue family', 'Family roots', 'O(n log n)'],
            ['4. Canonical decision', 'Multi-lens scoring + policy rules', 'Split ledger entries', 'O(families)'],
          ],
        },
        'Pass 1: Normalization. Each trajectory event is converted to a canonical operation record. Tool calls become abstract ops (read-file, search-text, edit-hunk, run-test, inspect-error). Shell commands become command kinds with normalized paths. Patches become AST-aware hunk fingerprints. Test outputs become oracle fingerprints (test name, error class, pass/fail).',
        {
          type: 'code',
          language: 'python',
          text: '# Normalize a tool-call event into a canonical operation\ndef normalize_event(event):\n    op_map = {\n        "cat": "read-file", "bat": "read-file",\n        "grep": "search-text", "rg": "search-text", "ag": "search-text",\n        "sed": "edit-hunk", "patch": "edit-hunk",\n        "pytest": "run-test", "jest": "run-test", "cargo test": "run-test",\n    }\n    kind = op_map.get(event.tool, event.tool)\n    target = normalize_path(event.target)  # strip absolute prefix\n    return CanonicalOp(kind=kind, target=target)',
        },
        'Pass 2: Shingling and MinHash. The normalized operation stream is broken into overlapping k-shingles (k=3 works well for typical 10-30 step trajectories). Each shingle is a tuple like (search-text, read-file, edit-hunk). MinHash compresses the shingle set into a fixed-size signature, and LSH buckets group trajectories with high Jaccard similarity.',
        {
          type: 'code',
          language: 'python',
          text: '# Operation shingles for a trajectory\ndef shingle(ops, k=3):\n    return {tuple(ops[i:i+k]) for i in range(len(ops) - k + 1)}\n\n# Example: [search-text, read-file, edit-hunk, run-test, inspect-error, edit-hunk, run-test]\n# Shingles: {(search-text, read-file, edit-hunk),\n#            (read-file, edit-hunk, run-test),\n#            (edit-hunk, run-test, inspect-error),\n#            (run-test, inspect-error, edit-hunk),\n#            (inspect-error, edit-hunk, run-test)}',
        },
        'Pass 3: Provenance linking. Trajectories that share a synthetic mutation id, issue family, or repository lineage are linked into families regardless of behavioral similarity. This catches mirror-repo duplicates that may have different operation sequences but derive from the same source task.',
        'Pass 4: Canonical decision. Each family receives a policy based on multi-lens evidence:',
        {
          type: 'table',
          headers: ['Evidence pattern', 'Decision', 'Sampler policy'],
          rows: [
            ['All lenses match', 'Exact duplicate', 'Merge: keep one, alias the rest'],
            ['Ops + oracle match, patch differs cosmetically', 'Near duplicate', 'Downsample: weight = 1/family_size'],
            ['Provenance links but behavior differs', 'Issue family', 'Same-split: all members on one side'],
            ['One lens matches, others diverge', 'Ambiguous', 'Quarantine: hold for human review'],
            ['No lenses match', 'Novel', 'Promote: full weight, independent sampling'],
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness target is not perfect similarity judgment -- it is controlled split integrity. The system enforces three invariants:',
        {
          type: 'bullets',
          items: [
            'No exact duplicate counts more than once in the sampler.',
            'No near-duplicate family inflates diversity metrics.',
            'No family straddles the train/eval boundary unless the evaluation explicitly measures that kind of transfer.',
          ],
        },
        'The family root is the key mechanism. Without it, two independent pipelines can make contradictory split assignments: pipeline A places trajectory T1 in training because its transcript is novel, pipeline B places T1\'s sibling T2 in evaluation because the issue id differs slightly. The model sees the answer pattern during training. The benchmark reports a held-out win. The family root prevents this by anchoring all split decisions to a single provenance identity.',
        {
          type: 'diagram',
          label: 'Split leakage without family roots',
          text: 'Pipeline A:  T1 (transcript "grep ...") ──> train     }\n                                                        } same fix, same test, same mutation\nPipeline B:  T2 (transcript "rg ...")   ──> eval      }\n\nResult: model trains on the answer, benchmark claims generalization.\n\nWith family root:\n  Family F42 = {T1, T2}  ──> root assigns to train  ──> both in train\n                                                         eval slot given to a different family.',
        },
        'The multi-lens design prevents both false merges (single-lens coincidence) and false negatives (surface variation hiding behavioral identity). LSH provides cheap broad recall; patch and oracle fingerprints provide high-precision confirmation; provenance catches relationships that behavior alone cannot reveal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Component', 'Time', 'Space', 'Dominant cost in practice'],
          rows: [
            ['Normalization', 'O(n * avg_steps)', 'O(n * avg_steps)', 'AST parsing for patch fingerprints'],
            ['Shingling + MinHash', 'O(n * shingles * num_hashes)', 'O(n * sig_size)', 'Hash computation per shingle'],
            ['LSH bucketing', 'O(n * bands)', 'O(n * bands)', 'Band-level hash collisions'],
            ['Candidate verification', 'O(candidates * lenses)', 'O(1) per pair', 'Patch-level AST diff'],
            ['Provenance linking', 'O(n log n)', 'O(n)', 'Join on mutation/issue ids'],
            ['Split ledger write', 'O(families)', 'O(families)', 'Append-only, cheap'],
          ],
        },
        'For 100,000 trajectories with 20 steps each, normalization takes minutes. MinHash with 128 hashes and 20 LSH bands runs in under a minute. The bottleneck is candidate verification: each candidate pair requires multi-lens comparison, and AST-level patch diffing is the most expensive lens. In practice, LSH reduces the quadratic comparison space to a few percent of all pairs.',
        {
          type: 'note',
          text: 'The similarity threshold is a data-product decision, not a mathematical constant. Setting it too low (0.55) catches 96% of duplicates but false-merges 30% of pairs. Setting it too high (0.95) misses 72% of near-duplicates. The animation plots this tradeoff. Most teams use a review band (0.75-0.85) where automated decisions are unreliable and human audit is required.',
        },
        'Over-deduplication starves training of variation. Two repairs may share the operation sequence read-file, edit-hunk, run-test while requiring entirely different reasoning about the bug. Under-deduplication inflates benchmarks. The safe default is to err toward quarantine: when in doubt, hold the family for review rather than silently merging or silently splitting.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'SWE-bench and similar coding-agent benchmarks: provenance hashing ensures that train/eval splits are family-aware, not just text-aware. A benchmark that can show its split ledger is more credible than one that claims dedupe by exact diff hash.',
            'Agent training pipelines (reinforcement learning from rollouts): the sampler weights families, not raw trajectories, preventing the reward signal from being dominated by whichever bug-fix pattern the factory ran most often.',
            'Synthetic data generation: mutation-based task generators tag each task with its generator seed and template family. Downstream dedupe links siblings automatically instead of rediscovering relationships from behavior.',
            'Curriculum design: repeated families can be intentionally kept for measuring retry robustness or interface variation, but the label says "same family, different surface" rather than pretending independence.',
            'Legal and compliance audit: the alias structure preserves every original transcript while the canonical record controls what counts. Auditors can trace any training example back to its source rollout and its family membership.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Normalization is the single point of failure. If AST-aware patch fingerprinting reduces a subtle logic change to "edited same function," two genuinely different fixes will merge. If command normalization strips a flag that distinguished two debugging strategies, distinct approaches become identical. The normalized representation must be validated against labeled duplicate/non-duplicate pairs before production use.',
        {
          type: 'table',
          headers: ['Failure mode', 'Cause', 'Consequence', 'Mitigation'],
          rows: [
            ['Over-merging', 'Normalization too aggressive', 'Distinct fixes collapsed, training diversity lost', 'Test against known non-duplicate pairs'],
            ['Under-merging', 'Normalization too conservative', 'Duplicates survive, benchmarks inflated', 'Audit held-out set for family leakage'],
            ['Missing provenance', 'Upstream did not record mutation/seed ids', 'Must infer families from behavior alone', 'Require provenance at generation time'],
            ['Threshold treated as truth', 'No review band, no quarantine', 'Borderline cases silently misclassified', 'Always define an ambiguous zone'],
            ['Stale split ledger', 'New rollouts added without re-running dedupe', 'New duplicates leak into old split', 'Incremental dedupe on ingestion'],
          ],
        },
        'Provenance hashing also fails when upstream provenance is dishonest or missing. If a synthetic task generator does not record its seed, template, or mutation family, later dedupe must infer relationships from behavior -- weaker, slower, and less reliable than preserving provenance at creation time.',
        {
          type: 'note',
          text: 'A privacy tension exists: strong provenance hashes may encode sensitive repository or task information. Separate internal audit keys from public dataset identifiers. Use salted or scoped hashes where full provenance disclosure would leak private relationships.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A factory generates four successful Python bug-fix trajectories against parser modules:',
        {
          type: 'table',
          headers: ['Trace', 'Search tool', 'Target file', 'Fix applied', 'Test passed', 'Repo origin'],
          rows: [
            ['A', 'grep', 'parser.py', 'guard: if not tokens: return []', 'test_empty_input', 'repo-X'],
            ['B', 'rg', 'parser.py', 'guard: if tokens is None or len(tokens)==0: return []', 'test_empty_input', 'repo-X'],
            ['C', 'grep', 'parser.py', 'guard: if not tokens: return []', 'test_empty_input', 'repo-X-mirror (same mutation m7)'],
            ['D', 'ag', 'tokenizer.py', 'guard: if not stream: return default', 'test_no_stream', 'repo-Y'],
          ],
        },
        'Pass 1 (exact): No exact hash matches -- different tool calls produce different transcripts, and C has different file paths due to the mirror.',
        'Pass 2 (near-duplicate): A and B share operation shingles (search-text, read-file, edit-hunk, run-test), patch fingerprint (same function, same guard logic at AST level despite formatting difference), and oracle fingerprint (test_empty_input PASS). Jaccard similarity on shingles: 0.92. They are merged into one canonical record.',
        'Pass 3 (provenance): C links to the same family through synthetic mutation id m7. Even though C came from a mirror repo, provenance says it is the same task. C is assigned to the same split as A/B.',
        'Pass 4 (canonical decision): D shares the abstract pattern "guard against empty input" but edits a different file, passes a different test, and comes from a different repo. One lens matches (operation sequence); three do not (patch, oracle, provenance). D is tagged as a conceptual neighbor but kept as an independent sample.',
        {
          type: 'code',
          language: 'python',
          text: '# Final split ledger entry for family F42\n{\n  "family_id": "F42",\n  "provenance_root": {"repo": "repo-X", "issue": 42, "mutation": "m7"},\n  "members": ["trace-A", "trace-B", "trace-C"],\n  "canonical": "trace-A",\n  "split": "train",\n  "policy": "downsample",\n  "weight": 0.33,\n  "neighbors": [{"id": "trace-D", "relation": "conceptual", "split": "eval"}],\n  "decision_reason": "3/4 lenses match across A,B; provenance links C; D diverges on patch+oracle+provenance"\n}',
        },
        'A future benchmark report can explain why one empty-input guard did not count as four independent wins. The split ledger is the proof artifact.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Andrei Z. Broder, "On the Resemblance and Containment of Documents," 1997. The foundational MinHash paper that makes set-similarity estimation practical for large collections. The shingling-to-MinHash-to-LSH pipeline used here is a direct application.',
            'Carlos E. Jimenez et al., "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?," 2023. The benchmark that made coding-agent trajectory quality a concrete problem. Its task-instance deduplication strategy is the motivating use case.',
            'Indyk and Motwani, "Approximate Nearest Neighbors: Towards Removing the Curse of Dimensionality," 1998. The LSH framework that makes sublinear candidate search possible in the near-duplicate pass.',
          ],
        },
        {
          type: 'note',
          text: 'Prerequisite: MinHash and locality-sensitive hashing (the similarity engine). Extension: verified agent trajectory stores (the upstream data model). Contrast: RAG chunk dedupe (same problem, different unit -- document fragments instead of behavior traces). Related case study: agent checkpoint replay ledger (the execution-level view of the same provenance problem).',
        },
      ],
    },
  ],
};

