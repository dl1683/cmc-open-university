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
      heading: 'The problem',
      paragraphs: [
        'Coding-agent factories can produce thousands of successful rollouts without producing thousands of independent lessons. One agent uses `grep`, another uses `rg`, another opens the file directly, but all three find the same failing assertion, apply the same patch hunk, and pass the same test. If the dataset counts those as three unrelated successes, training sees an overweighted pattern and evaluation becomes easier than it looks.',
        'Duplication is not limited to exact copies. A benchmark may include mirrored repositories, generated mutations, repeated issue templates, similar tests, or the same fix idea expressed with different line numbers. A model can learn the ritual around a family of tasks, then appear to generalize on a held-out item that is really a sibling of its training data.',
        'A trajectory dedupe and provenance hash layer exists to protect both training diversity and benchmark truth. It fingerprints behavior, patch evidence, oracle evidence, and source identity so near-duplicate rollouts can be merged, downsampled, kept in one split family, or quarantined.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is exact matching. Compare issue text, final diff text, test output, repository id, or transcript hash. If two records match, merge them. This is cheap, deterministic, and necessary. It catches copy-paste duplicates, repeated imports, and accidental re-ingestion of the same rollout.',
        'The wall appears as soon as behavior stays the same while surface text changes. Shell commands can differ. Tool payloads can be formatted differently. Line numbers can shift after unrelated edits. The model can explain the same plan in different words. Two synthetic bugs can be generated from the same template with different variable names. Exact matching treats all of that as novelty.',
        'The opposite mistake is just as dangerous: merging records because they share a vague description. Two tasks can both mention "off by one" while requiring different reasoning, different files, and different tests. Dedupe needs a representation that ignores accidental noise but preserves the evidence that makes a repair distinct.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Dedupe behavior, not transcript prettiness. A rollout should be compared through several lenses: normalized operation sequence, patch fingerprint, oracle fingerprint, task provenance, environment identity, and semantic family. No single lens is enough. Together they let the pipeline distinguish exact duplicate, near duplicate, conceptual neighbor, and genuinely new case.',
        'The main data structure is a canonical family record. It has a provenance root, a split assignment, aliases to every member rollout, similarity scores, reviewer decisions, and sampler policy. The family record does not delete evidence. It tells downstream systems how many times that evidence should count and where it is allowed to appear.',
        'This borrows from document dedupe and locality-sensitive hashing, but the unit is a behavior trace rather than a web page. Resemblance can come from overlapping operation shingles, identical diff hunks, shared failing tests, matching synthetic mutation ids, or common repository ancestry. Provenance decides which similarities are harmless and which ones threaten split integrity.',
      ],
    },
    {
      heading: 'Normalizing a trajectory',
      paragraphs: [
        'Normalization converts noisy agent events into comparable records. Prompts become task ids, issue-family ids, and source labels. Tool calls become abstract operation names such as read file, search text, run command, edit hunk, inspect failure, and rerun test. Shell commands become command kinds, with paths and flags normalized where that is safe.',
        'Patches become hunk fingerprints. A hunk fingerprint should capture the file, surrounding symbols, removed logic, added logic, and sometimes an AST-aware summary. It should not depend entirely on raw line numbers because line numbers drift. Test outputs become oracle fingerprints: command identity, failing test name, passing test name, error class, and relevant assertion.',
        'The normalized operation stream is then shingled. For example, a length-three shingle might be search text -> read file -> edit hunk. Another might be run focused test -> inspect error -> repair hunk. These shingles turn a trajectory into a set or multiset that can be compared even when the transcript wording differs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The first pass catches exact duplicates with stable ids and content hashes: task id, environment digest, transcript hash, patch hash, and oracle result hash. This removes accidental repeated ingestion and gives later stages clean aliases.',
        'The second pass computes near-duplicate candidates. Operation shingles can be summarized with MinHash or another locality-sensitive method to find likely similar traces without comparing every pair. Patch fingerprints and oracle fingerprints provide stronger evidence. If two trajectories have different wording but the same failing test, same edited function, and same added condition, they are probably one family.',
        'The third pass applies provenance rules. A good provenance root can include repository id, repository lineage, issue id, synthetic mutation id, base commit, environment digest, patch fingerprint, oracle fingerprint, normalized trajectory signature, and split policy version. The root is what downstream systems use for train/eval assignment.',
        'The final pass writes a canonical family decision. Exact duplicates merge. Near duplicates may downsample but keep aliases. Same-family items must stay on one side of a split. Ambiguous conflicts go to quarantine. Genuinely new cases are promoted. The decision and its evidence are stored so future training runs and benchmark reports use the same boundary.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness target is not perfect similarity judgment. It is controlled split integrity and sampler honesty. Exact duplicates should not count multiple times. Near duplicates should not inflate diversity. Related families should not straddle train and evaluation unless the evaluation is explicitly measuring that kind of transfer.',
        'The family root gives the dataset one place to store the split decision. Without it, two pipelines can make inconsistent choices: one places a rollout in training because the transcript is new, another places its sibling in evaluation because the issue id differs. The model then receives the answer pattern during training and the benchmark reports a held-out win.',
        'The method works because it combines cheap broad recall with stronger evidence. Locality-sensitive fingerprints find suspicious neighbors. Patch and oracle fingerprints test whether the same repair is involved. Provenance tells whether a relationship is expected, dangerous, or irrelevant. Human review is reserved for the ambiguous band where the automated evidence is mixed.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Over-deduplication removes useful diversity. Two repairs may share the sequence read file -> edit hunk -> run test while requiring different reasoning. A threshold that is too aggressive can collapse hard cases into easy families and starve training of variation.',
        'Under-deduplication is often worse for public claims. Duplicates can flood training, make loss curves look better, and leak into evaluation. The model may learn a repeated patch ritual rather than a general debugging skill. Benchmark results then measure memorized family exposure instead of generalization.',
        'The practical solution is not one magic threshold. Use exact merge rules, near-duplicate thresholds, review bands, quarantine buckets, and sampled manual audits. Preserve aliases instead of deleting originals. A canonical family record can downweight duplicates while retaining every source transcript for provenance, legal review, and future analysis.',
        'There is also a privacy and governance tradeoff. Strong provenance hashes may encode sensitive repository or task information. The system should separate internal audit keys from public dataset ids and use salted or scoped hashes where disclosure would leak private relationships.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This structure wins when verified trajectories are expensive. If each example requires a pinned environment, agent rollout, oracle run, and proof record, the dataset cannot afford to waste capacity on repeated siblings. Dedupe lets the sampler keep one canonical example, downweight a repeated family, and still preserve all aliases for audit.',
        'It also wins when benchmark claims matter. A result is more credible when the dataset can show that train and eval families were separated by provenance roots, not just by exact transcript strings. If a reviewer asks whether a held-out task was a duplicate of training data, the split ledger has an answer.',
        'The same pattern helps curriculum design. Repeated families can be intentionally kept for measuring robustness, interface variation, or retry behavior, but then they are labeled as such. The problem is not repetition itself; the problem is accidental repetition pretending to be independent evidence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Dedupe fails when normalization removes the signal that made two repairs different. If an AST-sensitive patch is reduced to "edited same file", distinct fixes will merge. If command normalization erases important flags, two different debugging strategies may look identical. The normalized representation should be tested against known duplicate and known non-duplicate pairs.',
        'It also fails when a threshold is treated as truth. Similarity scores are routing signals for merge, review, quarantine, or promotion. They are not proof. The ambiguous band needs policy, sampling, and sometimes human review.',
        'Finally, provenance hashing fails when upstream provenance is missing or dishonest. If synthetic tasks do not record their generator seed, source template, or mutation family, later dedupe has to infer relationships from behavior alone. That is weaker and more expensive than preserving provenance at creation time.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A factory generates four successful Python bug-fix trajectories. Trace A searches with `grep`, reads `parser.py`, adds a guard for an empty token list, and passes `test_empty_input`. Trace B uses `rg`, opens the same function, applies the same guard with slightly different formatting, and passes the same test. Trace C comes from a mirrored repository generated from the same mutation template. Trace D edits a different parser in another project and also adds an empty-input guard, but the failing condition and test are different.',
        'Exact diff matching catches neither A and B nor the mirror relation in C. A behavior-aware deduper sees that A and B share operation shingles, patch fingerprint, and oracle fingerprint, so it merges them. It assigns C to the same split family because the provenance root points to the same synthetic mutation. It tags D as a conceptual neighbor but keeps it as a separate case because the repository, oracle, and patch context differ.',
        'The split ledger now has a durable decision: A and B are aliases, C cannot cross the train/eval boundary from them, and D may be sampled as related but independent. A future benchmark report can explain why one idea did not count as four unrelated wins.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study verified agent trajectory stores first, because dedupe depends on having task, environment, event, patch, oracle, and proof identities. Then study MinHash, locality-sensitive hashing, SimHash, content-addressed Merkle DAGs, software supply-chain provenance, data leakage, benchmark variance, and RAG chunk dedupe.',
        'The deeper lesson is that dataset identity is a systems problem. You need stable keys, normalized behavior, provenance roots, split ledgers, and review policy. Without them, more rollouts can make the dataset look larger while making the evidence weaker.',
      ],
    },
  ],
};
