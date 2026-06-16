// Software supply-chain provenance graph: artifacts, digests, builders,
// dependencies, attestations, signatures, transparency logs, and policy gates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'software-supply-chain-provenance-graph',
  title: 'Software Supply Chain Provenance Graph',
  category: 'Security',
  summary: 'Model software provenance as a graph from source commit to builder, dependencies, artifact digest, attestation, signature, transparency log, and policy gate.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['provenance graph', 'policy verification'], defaultValue: 'provenance graph' },
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

function provenanceGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'source', x: 0.8, y: 4.8, note: 'git commit' },
      { id: 'deps', label: 'deps', x: 0.8, y: 3.4, note: 'digests' },
      { id: 'build', label: 'build', x: 2.6, y: 4.1, note: 'builder.id' },
      { id: 'artifact', label: 'artifact', x: 4.3, y: 4.1, note: 'digest' },
      { id: 'attest', label: 'attest', x: 6.0, y: 4.9, note: 'SLSA' },
      { id: 'sig', label: 'sig', x: 6.0, y: 3.3, note: 'identity' },
      { id: 'rekor', label: 'log', x: 7.8, y: 4.1, note: 'transparent' },
      { id: 'policy', label: 'policy', x: 9.2, y: 4.1, note: 'allow?' },
    ],
    edges: [
      { id: 'e-source-build', from: 'source', to: 'build' },
      { id: 'e-deps-build', from: 'deps', to: 'build' },
      { id: 'e-build-artifact', from: 'build', to: 'artifact' },
      { id: 'e-artifact-attest', from: 'artifact', to: 'attest' },
      { id: 'e-build-attest', from: 'build', to: 'attest' },
      { id: 'e-attest-sig', from: 'attest', to: 'sig' },
      { id: 'e-sig-rekor', from: 'sig', to: 'rekor' },
      { id: 'e-rekor-policy', from: 'rekor', to: 'policy' },
      { id: 'e-attest-policy', from: 'attest', to: 'policy' },
    ],
  }, { title });
}

function policyGraph(title) {
  return graphState({
    nodes: [
      { id: 'download', label: 'download', x: 0.8, y: 4.1, note: 'bytes' },
      { id: 'digest', label: 'digest', x: 2.3, y: 4.9, note: 'sha256' },
      { id: 'sig', label: 'signature', x: 2.3, y: 3.3, note: 'identity' },
      { id: 'attest', label: 'attest', x: 4.1, y: 4.1, note: 'predicate' },
      { id: 'deps', label: 'deps', x: 5.8, y: 4.9, note: 'resolved' },
      { id: 'builder', label: 'builder', x: 5.8, y: 3.3, note: 'trusted' },
      { id: 'log', label: 'log proof', x: 7.5, y: 4.1, note: 'included' },
      { id: 'gate', label: 'gate', x: 9.1, y: 4.1, note: 'admit/deny' },
    ],
    edges: [
      { id: 'e-download-digest', from: 'download', to: 'digest' },
      { id: 'e-download-sig', from: 'download', to: 'sig' },
      { id: 'e-digest-attest', from: 'digest', to: 'attest' },
      { id: 'e-sig-attest', from: 'sig', to: 'attest' },
      { id: 'e-attest-deps', from: 'attest', to: 'deps' },
      { id: 'e-attest-builder', from: 'attest', to: 'builder' },
      { id: 'e-attest-log', from: 'attest', to: 'log' },
      { id: 'e-deps-gate', from: 'deps', to: 'gate' },
      { id: 'e-builder-gate', from: 'builder', to: 'gate' },
      { id: 'e-log-gate', from: 'log', to: 'gate' },
    ],
  }, { title });
}

function* provenanceView() {
  yield {
    state: provenanceGraph('Provenance links artifact bytes back to build inputs'),
    highlight: { active: ['source', 'deps', 'build', 'artifact', 'e-source-build', 'e-deps-build', 'e-build-artifact'], compare: ['attest'] },
    explanation: 'Software provenance answers where, when, how, and by whom an artifact was produced. The artifact digest is the join key between downloaded bytes and the build record.',
  };
  yield {
    state: provenanceGraph('SLSA provenance records buildDefinition and runDetails'),
    highlight: { active: ['build', 'artifact', 'attest', 'e-build-attest', 'e-artifact-attest'], found: ['source', 'deps'] },
    explanation: 'A SLSA provenance predicate records the build type, external parameters, resolved dependencies, builder identity, invocation metadata, and output subjects.',
    invariant: 'Provenance must bind artifact digest, builder identity, and inputs together.',
  };
  yield {
    state: provenanceGraph('Signatures and transparency logs make claims verifiable'),
    highlight: { active: ['attest', 'sig', 'rekor', 'e-attest-sig', 'e-sig-rekor'], compare: ['policy'] },
    explanation: 'The attestation is signed by an identity. Recording that signed claim in a transparency log lets consumers and monitors verify that the claim existed and inspect unexpected events.',
  };
  yield {
    state: labelMatrix(
      'Provenance graph nodes',
      [
        { id: 'subject', label: 'subject' },
        { id: 'builder', label: 'builder' },
        { id: 'params', label: 'parameters' },
        { id: 'deps', label: 'dependencies' },
        { id: 'log', label: 'log entry' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'verify', label: 'verify' },
      ],
      [
        ['artifact digest', 'downloaded bytes'],
        ['trusted platform', 'allowed signer-builder'],
        ['build inputs', 'expected config'],
        ['resolved URIs/digests', 'known supply chain'],
        ['signed claim', 'public inclusion'],
      ],
    ),
    highlight: { active: ['subject:verify', 'builder:verify', 'deps:verify', 'log:verify'] },
    explanation: 'The graph is useful because every security decision has a concrete edge to check. No edge, no trust claim.',
  };
}

function* policyVerification() {
  yield {
    state: policyGraph('Start with the bytes you actually downloaded'),
    highlight: { active: ['download', 'digest', 'e-download-digest'], compare: ['attest'] },
    explanation: 'Verification starts by hashing the artifact in hand. A valid attestation for a different digest is irrelevant.',
  };
  yield {
    state: policyGraph('Check the signature and signer-builder relationship'),
    highlight: { active: ['sig', 'attest', 'builder', 'e-sig-attest', 'e-attest-builder'], compare: ['deps'] },
    explanation: 'SLSA emphasizes that consumers should accept only expected signer-builder pairs. A signer allowed for one builder should not automatically speak for another.',
  };
  yield {
    state: policyGraph('Resolve dependency and source expectations'),
    highlight: { active: ['attest', 'deps', 'gate', 'e-attest-deps', 'e-deps-gate'], compare: ['download'] },
    explanation: 'Policy can require a specific source repository, git commit, workflow, builder, dependency digest, or build type. The provenance graph turns those requirements into fields to check.',
  };
  yield {
    state: policyGraph('Require transparency inclusion when the workflow depends on it'),
    highlight: { active: ['attest', 'log', 'gate', 'e-attest-log', 'e-log-gate'], found: ['builder'] },
    explanation: 'A log inclusion proof does not make the artifact safe, but it makes the signing event public and monitorable. That can be a policy requirement.',
  };
  yield {
    state: labelMatrix(
      'Policy decisions',
      [
        { id: 'digest', label: 'digest mismatch' },
        { id: 'builder', label: 'bad builder' },
        { id: 'source', label: 'wrong source' },
        { id: 'log', label: 'no log proof' },
        { id: 'ok', label: 'all checks' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['deny', 'not same artifact'],
        ['deny', 'untrusted platform'],
        ['deny', 'unexpected input'],
        ['deny/escalate', 'not monitorable'],
        ['allow', 'expected graph'],
      ],
    ),
    highlight: { removed: ['digest:action', 'builder:action', 'source:action'], active: ['ok:action'] },
    explanation: 'Provenance turns supply-chain trust into a graph query plus cryptographic checks. That is stronger than reading a package name and hoping.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'provenance graph') yield* provenanceView();
  else if (view === 'policy verification') yield* policyVerification();
  else throw new InputError('Pick a software-provenance view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A software supply-chain provenance graph records the path from source inputs to built artifact. It ties a downloaded binary or container digest to source commit, build definition, external parameters, resolved dependencies, builder identity, invocation metadata, signature, and transparency-log evidence.',
        'SLSA v1.2 defines build provenance as an attestation about how artifacts were produced, including buildDefinition, runDetails, builder identity, and artifact subjects, so consumers can verify that an artifact was built according to expectations and optionally rebuild it: https://slsa.dev/spec/v1.2/build-provenance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The artifact digest is the anchor. A SLSA provenance attestation has a subject containing artifact digests, a buildDefinition containing build type, external parameters, internal parameters, and resolved dependencies, and runDetails containing builder identity and invocation metadata. The attestation is then signed. Consumers verify the artifact digest, signature, builder identity, expected source, expected workflow, and dependency constraints.',
        'SLSA recommends provenance through the in-toto attestation framework for external verification. The SLSA attestation model describes attestations as authenticated metadata about software artifacts and recommends the SLSA Provenance format for claims of SLSA levels: https://slsa.dev/attestation-model. The in-toto attestation repository defines the SLSA provenance predicate type: https://github.com/in-toto/attestation/blob/main/spec/predicates/provenance.md.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The provenance graph has nodes for artifacts, digests, source repos, commits, build templates, parameters, dependencies, builders, byproducts, attestations, signatures, transparency-log entries, and policy decisions. Edges express produced-by, depended-on, signed-by, logged-in, and allowed-by. This is Claim Graph & Source Ledger for executable artifacts.',
        'Content-Addressed Merkle DAG Object Store supplies byte-level integrity. Transparency Log Witnessing supplies public inclusion and append-only evidence. Git Internals supplies source identity. SLSA Build & Source Trust Ladder explains the level model for source and build trust. Sigstore Keyless Signing Transparency explains the identity, certificate, signature, and log records that can sign this graph. The policy gate combines those facts into an allow, deny, or escalate decision.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Kubernetes admission controller receives a container image. It hashes the image digest, retrieves a signed SLSA provenance attestation, checks the signature identity, verifies the subject digest matches the image, checks that the builder is the expected hosted builder, verifies the source repo and commit are allowed, checks resolved dependency digests when required, verifies Rekor inclusion, and then admits or rejects the image.',
        'If the image name is correct but the digest differs, the graph fails at the first edge. If the digest matches but the builder is a self-hosted runner outside the trust boundary, policy fails at the builder edge. If a new dependency appears, policy can escalate even though the signature is cryptographically valid.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A signature alone does not prove safe provenance. It proves that some identity signed something. The verifier must know which identity is allowed to sign for which builder, source, and artifact. Transparency-log inclusion does not make an artifact good either; it makes the event public and monitorable.',
        'Another mistake is overclaiming dependency completeness. SLSA provenance captures resolvedDependencies if known, but completeness depends on build platform level and ecosystem integration. Policy should distinguish required checks from best-effort metadata.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SLSA Build Provenance at https://slsa.dev/spec/v1.2/build-provenance, SLSA Build Track Basics at https://slsa.dev/spec/v1.2/build-track-basics, in-toto attestation provenance predicate at https://github.com/in-toto/attestation/blob/main/spec/predicates/provenance.md, Sigstore in-toto attestations at https://docs.sigstore.dev/cosign/verifying/attestation/, and Sigstore Rekor at https://docs.sigstore.dev/logging/overview/. Study Content-Addressed Merkle DAG Object Store, Transparency Log Witnessing Case Study, Git Internals, Claim Graph & Source Ledger, TUF Update Metadata Case Study, SLSA Build & Source Trust Ladder, Sigstore Keyless Signing Transparency, OPA Rego Policy Decision Graph, Kubernetes Admission Policy Gate, and Zanzibar Authorization Case Study next.',
      ],
    },
  ],
};
