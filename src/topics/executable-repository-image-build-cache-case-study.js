// Executable repository images: snapshot repo state, dependency locks, build
// layers, and CI evidence so agent rollouts can be reproduced later.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'executable-repository-image-build-cache-case-study',
  title: 'Executable Repository Image Build Cache Case Study',
  category: 'Systems',
  summary: 'A CWM-style trajectory-factory case study: turn raw repositories into reproducible runnable images with cache keys, lockfiles, CI evidence, and proof ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['image cache graph', 'runner evidence ledger'], defaultValue: 'image cache graph' },
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

function imageGraph(title) {
  return graphState({
    nodes: [
      { id: 'issue', label: 'issue', x: 0.6, y: 3.4, note: 'task' },
      { id: 'repo', label: 'repo', x: 2.0, y: 2.0, note: 'commit' },
      { id: 'lock', label: 'lock', x: 2.0, y: 4.8, note: 'deps' },
      { id: 'base', label: 'base', x: 3.6, y: 1.4, note: 'OS' },
      { id: 'deps', label: 'deps', x: 3.6, y: 3.4, note: 'pkg' },
      { id: 'src', label: 'src', x: 3.6, y: 5.4, note: 'copy' },
      { id: 'cache', label: 'cache', x: 5.4, y: 3.4, note: 'keys' },
      { id: 'img', label: 'img', x: 7.0, y: 3.4, note: 'digest' },
      { id: 'ci', label: 'CI', x: 8.5, y: 2.3, note: 'run' },
      { id: 'proof', label: 'proof', x: 8.5, y: 4.6, note: 'log' },
    ],
    edges: [
      { id: 'e-issue-repo', from: 'issue', to: 'repo' },
      { id: 'e-issue-lock', from: 'issue', to: 'lock' },
      { id: 'e-repo-base', from: 'repo', to: 'base' },
      { id: 'e-lock-deps', from: 'lock', to: 'deps' },
      { id: 'e-repo-src', from: 'repo', to: 'src' },
      { id: 'e-base-cache', from: 'base', to: 'cache' },
      { id: 'e-deps-cache', from: 'deps', to: 'cache' },
      { id: 'e-src-cache', from: 'src', to: 'cache' },
      { id: 'e-cache-img', from: 'cache', to: 'img' },
      { id: 'e-img-ci', from: 'img', to: 'ci' },
      { id: 'e-ci-proof', from: 'ci', to: 'proof' },
    ],
  }, { title });
}

function* imageCacheGraph() {
  yield {
    state: imageGraph('Repository image build cache'),
    highlight: { active: ['issue', 'repo', 'lock', 'base', 'deps', 'src', 'cache', 'e-issue-repo', 'e-issue-lock', 'e-repo-base', 'e-lock-deps', 'e-repo-src'], found: ['img'] },
    explanation: 'A coding-agent rollout is only useful training data if the repository can run again. The image builder turns an issue, commit, lockfiles, base image, dependency layers, and source copy into a digest-addressed executable image.',
    invariant: 'No reproducible image, no durable trajectory.',
  };

  yield {
    state: labelMatrix(
      'Cache key inputs',
      [
        { id: 'base', label: 'base' },
        { id: 'apt', label: 'apt' },
        { id: 'pip', label: 'pip' },
        { id: 'src', label: 'src' },
        { id: 'test', label: 'test' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'hit', label: 'hit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hash', 'hit', 'drift'],
        ['lock', 'hit', 'net'],
        ['lock', 'miss', 'abi'],
        ['tree', 'miss', 'copy'],
        ['cmd', 'keep', 'env'],
      ],
    ),
    highlight: { active: ['base:key', 'apt:key', 'pip:key', 'src:key'], compare: ['pip:hit', 'src:hit'], found: ['test:risk'] },
    explanation: 'Each highlighted row is part of the real cache key. Dockerfile text is not enough: base image digest, lockfiles, runtime, source tree hash, test command, and sometimes runner hardware decide whether a reused image is still the same executable environment.',
  };

  yield {
    state: imageGraph('Build cache hit path'),
    highlight: { active: ['base', 'deps', 'cache', 'img', 'ci', 'proof', 'e-base-cache', 'e-deps-cache', 'e-cache-img', 'e-img-ci', 'e-ci-proof'], compare: ['src'] },
    explanation: 'When the base and dependency layers hit, the builder spends most of its time on source copy and tests. That makes repeated agent rollouts cheap enough to collect at scale.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'cache hit rate', min: 0, max: 100 }, y: { label: 'build minutes per task', min: 0, max: 80 } },
      series: [
        { id: 'cold', label: 'cold images', points: [{ x: 5, y: 72 }, { x: 25, y: 68 }, { x: 50, y: 63 }, { x: 75, y: 58 }, { x: 95, y: 54 }] },
        { id: 'warm', label: 'layer cache', points: [{ x: 5, y: 70 }, { x: 25, y: 46 }, { x: 50, y: 25 }, { x: 75, y: 12 }, { x: 95, y: 6 }] },
      ],
      markers: [
        { id: 'break', x: 62, y: 19, label: 'scale band' },
      ],
    }),
    highlight: { active: ['warm', 'break'], compare: ['cold'] },
    explanation: 'Build caching changes the economics of execution data. A cold build farm may be too expensive; a warm cache turns the same task stream into a repeatable factory.',
  };
}

function* runnerEvidenceLedger() {
  yield {
    state: imageGraph('Runner evidence ledger'),
    highlight: { active: ['img', 'ci', 'proof', 'e-img-ci', 'e-ci-proof'], compare: ['issue', 'repo', 'lock'] },
    explanation: 'A proof ledger records which image digest ran which command, on which runner, with which exit status, logs, artifacts, and timestamps. The image alone is not the proof; the run evidence closes the loop.',
  };

  yield {
    state: labelMatrix(
      'Evidence fields',
      [
        { id: 'img', label: 'img' },
        { id: 'cmd', label: 'cmd' },
        { id: 'env', label: 'env' },
        { id: 'log', label: 'log' },
        { id: 'art', label: 'art' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'check', label: 'check' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['sha', 'pin', 'yes'],
        ['test', 'hash', 'yes'],
        ['vars', 'mask', 'some'],
        ['text', 'redact', 'yes'],
        ['blob', 'hash', 'some'],
      ],
    ),
    highlight: { active: ['img:check', 'cmd:check', 'log:check'], found: ['img:keep', 'cmd:keep'], compare: ['env:keep', 'art:keep'] },
    explanation: 'The ledger keeps the fields needed to rerun and audit the example, but the compare cells show the tax: environment variables and artifacts may contain secrets, licenses, or private data, so reproducibility has to include redaction rules.',
    invariant: 'Reproducibility and privacy are both first-class ledger fields.',
  };

  yield {
    state: labelMatrix(
      'Complete case: stale dependency repair',
      [
        { id: 't0', label: 'issue' },
        { id: 't1', label: 'build' },
        { id: 't2', label: 'agent' },
        { id: 't3', label: 'test' },
        { id: 't4', label: 'ship' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['open', 'id'],
        ['fail', 'log'],
        ['patch', 'diff'],
        ['pass', 'junit'],
        ['keep', 'ledger'],
      ],
    ),
    highlight: { active: ['t1:proof', 't2:proof', 't3:proof', 't4:proof'], found: ['t3:state', 't4:state'], removed: ['t1:state'] },
    explanation: 'A repository fails after a dependency release. The factory builds the old image, captures the failing test, lets the agent update a pin, reruns tests, and stores the failing-to-passing evidence as one canonical task.',
  };

  yield {
    state: imageGraph('Image evidence feeds trajectory dedupe'),
    highlight: { active: ['repo', 'lock', 'img', 'ci', 'proof', 'e-cache-img', 'e-img-ci', 'e-ci-proof'], found: ['cache'], compare: ['issue'] },
    explanation: 'Executable image evidence becomes a dedupe key. Two transcripts may look different, but if they share base commit, image digest, failing command, patch hunk, and passing proof, the split ledger should treat them as one family.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'image cache graph') yield* imageCacheGraph();
  else if (view === 'runner evidence ledger') yield* runnerEvidenceLedger();
  else throw new InputError('Pick an executable-repository-image view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the build graph from left to right. A repository commit, lockfiles, base image digest, setup commands, source tree, and test command are inputs to one runnable image. The active edge means a changed input must change the cache key before the old layer can be reused.',
        'The evidence ledger is the proof side of the animation. An image digest says what could run, while the ledger says what did run, with command, exit status, logs, patch, artifacts, and timestamps. The safe inference rule is that a passing label is valid only for the exact image and command that produced it.',
        {type:'callout', text:'A coding task becomes evidence only when the environment digest, commands, logs, patch, and cache keys form one replayable proof chain.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A coding-agent task is only as trustworthy as its replay environment. A prompt that says fix this bug is weak evidence because the reader cannot tell which dependencies, operating system packages, test command, or environment variables were present. A runnable image with a digest turns the task into something another runner can audit.',
        'The build cache exists because clean execution is expensive. A benchmark factory may need to build thousands of repository states before it can collect failing and passing proofs. Reusing correct layers lowers cost without weakening the evidence chain.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run the issue on the available machine and save the terminal transcript. That works for personal debugging because the same person remembers the setup. It fails as evidence because another runner may have a different Python, Node, libc, package index, timezone, kernel, or hidden credential.',
        'A second shortcut is to store only the final container image. That proves an environment existed, but it does not prove which command ran, which failure was observed, or which patch made the test pass. A dataset needs both the runnable object and the execution record.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is hidden drift. Floating base images, unpinned dependency ranges, package-index updates, network setup scripts, and local machine state can change the result while the task id stays the same. A benchmark then measures environment luck instead of repair ability.',
        'The other wall is factory cost. If a cold build takes 8 minutes and a benchmark needs 20,000 repository images, the build phase alone is about 2,667 machine-hours. A cache with 75 percent safe reuse cuts that to about 667 cold-build hours, but only if the cache key never aliases two different environments.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A benchmark task is a proof chain. The repository snapshot, base image digest, lockfiles, build commands, test commands, runner architecture, failing output, repair patch, passing output, and artifact hashes all belong to one record. If any of those fields changes, the proof may no longer mean the same thing.',
        'The image digest is the identity of the runnable environment. The cache key decides which build layers can be reused, and the evidence ledger records what happened inside the image. Correctness comes from keeping those roles separate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The builder starts with a task id and commit. It resolves lockfiles, pins the base image by digest, installs system and language dependencies, copies source, records setup commands, and emits an image digest. Tests and agent rollouts run against that digest, not against an implied local machine.',
        'A useful cache key is layered. The base image digest, runtime version, lockfile hash, dependency install command, source tree hash, test command, runner architecture, and selected environment variables participate. Dependency layers can be shared while source and command layers stay specific.',
        'Each execution writes a ledger entry. The entry stores command hash, exit status, stdout and stderr, artifact hashes, timing, runner metadata, patch fingerprint, and redaction status. Training and evaluation systems can then ask whether a label came from a replayable proof or from an informal transcript.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is content identity plus executed proof. If the base image, lockfile, source tree, setup command, or test command changes, the derived key changes. Two different environments cannot share one cache entry unless the key function omitted a meaningful input.',
        'The label is correct only inside the recorded boundary. A patch that passes command T in image I has proven that claim, not that the repository is fixed for every platform or hidden test. The ledger keeps that boundary visible instead of letting pass become a vague word.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is storage, build time, invalidation, and security review. If each image averages 3 GB and a corpus has 10,000 images, naive retention needs 30 TB before logs and artifacts. Layer sharing can cut that sharply, but only when deduplication does not blur environment identity.',
        'The cache key has a behavioral tradeoff. A broad key gives more hits and lower build cost but risks stale dependency reuse. A narrow key is safer but may rebuild from scratch after harmless changes. The right key is the smallest key that still includes every input that can change the meaning of the run.',
        'Containers also do not capture everything. CPU architecture, kernel behavior, filesystem semantics, network access, clock behavior, and external services can still affect results. A serious runner records those fields or blocks the task from receiving a strong replay label.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Executable images fit coding-agent benchmarks, repair-data factories, regression corpora, CI replay systems, verified trajectory stores, and software supply-chain audits. They turn a natural-language issue into a runnable object with an oracle. The oracle is the command or validator that decides whether the task passed.',
        'They also help curriculum design. Tasks can be grouped by language, dependency manager, failure command, test duration, image family, and repair pattern. A course can then move from small deterministic fixes to larger repairs without losing the execution evidence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when nondeterminism is treated as a minor detail. Unpinned package indexes, floating images, network-dependent setup scripts, timezone assumptions, test-order dependence, random seeds, and external services can make the same image digest insufficient. Those fields need controls or weaker claims.',
        'It also fails through leakage. If the same repository state, image digest, failing command, and patch family appear in both training and evaluation splits, the benchmark can reward memorized repairs. Deduplication must use the proof chain, not just issue titles.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a stale dependency bug takes 8 minutes to build cold and 30 seconds to run tests. The factory snapshots commit abc123, pins a Node 22 base image digest, installs from package-lock.json, and runs npm test. The first ledger entry records exit code 1 and the failing log.',
        'An agent changes one dependency constraint and the source tree hash changes. The cache reuses the base and package-manager layers when their keys match, then rebuilds the affected source and install layers. The second ledger entry records the patch hash, the same test command, exit code 0, and artifact hashes.',
        'If a later rerun uses a newer floating base image, the digest changes and the proof is not the same proof. The system can still run it, but it becomes a new evidence record. That separation is what prevents a real fix from being confused with an environment accident.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Docker build cache, BuildKit cache keys, GitHub Actions workflow syntax, OCI image digests, SLSA provenance, SWE-bench, SWE-agent, and Code World Models. Then study Verified Agent Trajectory Store, Agent Trajectory Dedupe and Provenance Hash, Content-Addressed Merkle DAG Object Store, Bootstrap CI, Software Supply Chain Provenance Graph, and Synthetic Bug Mutation Oracle Case Study.',
        'The next exercise is to design a cache key for one repository. Include the base image, lockfiles, setup commands, source tree, test command, architecture, and environment variables that can affect behavior. Then name one input you intentionally exclude and justify why it cannot change the proof.',
      ],
    },
  ],
};