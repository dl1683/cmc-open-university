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
  const g1 = provenanceGraph('Provenance links artifact bytes back to build inputs');
  const nodeCount = g1.nodes.length;
  const edgeCount = g1.edges.length;
  yield {
    state: g1,
    highlight: { active: ['source', 'deps', 'build', 'artifact', 'e-source-build', 'e-deps-build', 'e-build-artifact'], compare: ['attest'] },
    explanation: `Provenance starts with the bytes in hand. Across all ${nodeCount} graph nodes, the artifact digest is the join key that connects those downloaded bytes to a specific source, dependency set, builder, and build run.`,
  };
  const g2 = provenanceGraph('SLSA provenance records buildDefinition and runDetails');
  yield {
    state: g2,
    highlight: { active: ['build', 'artifact', 'attest', 'e-build-attest', 'e-artifact-attest'], found: ['source', 'deps'] },
    explanation: `A SLSA provenance predicate records what build ran, which parameters and dependencies it used, which builder executed it, and which artifact subjects came out of that run. The ${edgeCount} edges encode every link from source to policy.`,
    invariant: `Provenance must bind the ${g2.nodes.find(n => n.id === 'artifact').label} digest, ${g2.nodes.find(n => n.id === 'build').label}er identity, and inputs together.`,
  };
  const g3 = provenanceGraph('Signatures and transparency logs make claims verifiable');
  const sigNode = g3.nodes.find(n => n.id === 'sig');
  const rekorNode = g3.nodes.find(n => n.id === 'rekor');
  yield {
    state: g3,
    highlight: { active: ['attest', 'sig', 'rekor', 'e-attest-sig', 'e-sig-rekor'], compare: ['policy'] },
    explanation: `The attestation becomes verifiable only after the "${sigNode.label}" node binds it to an expected ${sigNode.note}. Logging the signed claim via the "${rekorNode.label}" node adds public evidence that monitors can inspect for unexpected builds.`,
  };
  const matrixRows = [
    { id: 'subject', label: 'subject' },
    { id: 'builder', label: 'builder' },
    { id: 'params', label: 'parameters' },
    { id: 'deps', label: 'dependencies' },
    { id: 'log', label: 'log entry' },
  ];
  const matrixCols = [
    { id: 'stores', label: 'stores' },
    { id: 'verify', label: 'verify' },
  ];
  yield {
    state: labelMatrix(
      'Provenance graph nodes',
      matrixRows,
      matrixCols,
      [
        ['artifact digest', 'downloaded bytes'],
        ['trusted platform', 'allowed signer-builder'],
        ['build inputs', 'expected config'],
        ['resolved URIs/digests', 'known supply chain'],
        ['signed claim', 'public inclusion'],
      ],
    ),
    highlight: { active: ['subject:verify', 'builder:verify', 'deps:verify', 'log:verify'] },
    explanation: `The ${matrixRows.length}x${matrixCols.length} matrix is useful because every trust decision names an edge to check: digest matches bytes, builder is expected, source is allowed, dependencies are known, and the signing event is visible.`,
  };
}

function* policyVerification() {
  const p1 = policyGraph('Start with the bytes you actually downloaded');
  const pNodeCount = p1.nodes.length;
  const pEdgeCount = p1.edges.length;
  const digestNode = p1.nodes.find(n => n.id === 'digest');
  yield {
    state: p1,
    highlight: { active: ['download', 'digest', 'e-download-digest'], compare: ['attest'] },
    explanation: `Verification starts by hashing the artifact in hand using ${digestNode.note}. If the digest does not match the attestation subject, the rest of the metadata belongs to different bytes.`,
  };
  const p2 = policyGraph('Check the signature and signer-builder relationship');
  const sigNodeP = p2.nodes.find(n => n.id === 'sig');
  const builderNode = p2.nodes.find(n => n.id === 'builder');
  yield {
    state: p2,
    highlight: { active: ['sig', 'attest', 'builder', 'e-sig-attest', 'e-attest-builder'], compare: ['deps'] },
    explanation: `The "${sigNodeP.label}" is checked against an expected ${sigNodeP.note} and the "${builderNode.label}" relationship. A signer trusted for one workflow should not automatically speak for another builder or source boundary.`,
  };
  const p3 = policyGraph('Resolve dependency and source expectations');
  const gateNode = p3.nodes.find(n => n.id === 'gate');
  yield {
    state: p3,
    highlight: { active: ['attest', 'deps', 'gate', 'e-attest-deps', 'e-deps-gate'], compare: ['download'] },
    explanation: `Policy turns expectations into graph checks across ${pEdgeCount} edges: source repository, git commit, workflow, builder, dependency digest, build type, and output subject all have to match the release rule before the "${gateNode.label}" can ${gateNode.note}.`,
  };
  const p4 = policyGraph('Require transparency inclusion when the workflow depends on it');
  const logNode = p4.nodes.find(n => n.id === 'log');
  yield {
    state: p4,
    highlight: { active: ['attest', 'log', 'gate', 'e-attest-log', 'e-log-gate'], found: ['builder'] },
    explanation: `A transparency proof from the "${logNode.label}" node does not make an artifact safe. It makes the signing event public and monitorable (${logNode.note}), which is useful only when policy or monitoring actually consumes that evidence.`,
  };
  const policyRows = [
    { id: 'digest', label: 'digest mismatch' },
    { id: 'builder', label: 'bad builder' },
    { id: 'source', label: 'wrong source' },
    { id: 'log', label: 'no log proof' },
    { id: 'ok', label: 'all checks' },
  ];
  const policyCols = [
    { id: 'action', label: 'action' },
    { id: 'reason', label: 'reason' },
  ];
  const denyCount = policyRows.filter(r => r.id !== 'ok').length;
  yield {
    state: labelMatrix(
      'Policy decisions',
      policyRows,
      policyCols,
      [
        ['deny', 'not same artifact'],
        ['deny', 'untrusted platform'],
        ['deny', 'unexpected input'],
        ['deny/escalate', 'not monitorable'],
        ['allow', 'expected graph'],
      ],
    ),
    highlight: { removed: ['digest:action', 'builder:action', 'source:action'], active: ['ok:action'] },
    explanation: `Provenance turns supply-chain trust into cryptographic checks over ${pNodeCount} nodes plus a graph query over expected build facts. ${denyCount} of ${policyRows.length} policy rows result in deny; a familiar package name is not enough evidence.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read every node as a claim about how bytes were produced. The artifact is the package, image, or binary; a digest is a cryptographic hash of those bytes; provenance is metadata that links the digest to source, builder, and inputs.',
        {type: 'callout', text: 'A provenance graph is useful because every trust claim has a join key that can be checked against the artifact in hand.'},
        'Active edges are joins being checked. A found state means two claims share the required identifier, not that the software is safe. The safe rule is digest first: metadata that does not name these bytes is not evidence for these bytes.',
        {type: 'image', src: './assets/gifs/software-supply-chain-provenance-graph.gif', alt: 'Animated walkthrough of the software supply chain provenance graph visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern software is assembled by build systems, dependency managers, registries, signing services, and deployment gates. A name like payments:1.4.2 does not prove which source commit produced the bytes.',
        {type: 'image', src: 'https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ei62txenvyrk9v4ow7p0.png', alt: 'Layered sketch of artifact attestation provenance signature and verification', caption: 'Artifact, attestation, provenance, signature, and verification are separate graph nodes, not one blob of metadata. Source: DEV Community, https://dev.to/kanywst/slsa-provenance-hands-on-generate-with-github-actions-verify-with-slsa-verifier-56ka.'},
        'A provenance graph makes the build story checkable. It connects source revision, dependencies, builder, build run, artifact digest, attestation, signature, transparency log, and policy decision.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust the package name, registry, maintainer, version, or signature. Those signals help, and a signature can prove that an identity endorsed some bytes.',
        'They do not prove the whole path. A trusted identity can sign the wrong artifact, a tag can point to new bytes, and clean source can be built by a compromised runner.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is metadata substitution. A valid attestation for one artifact can be placed beside another artifact unless the verifier checks the digest edge.',
        'A valid signer can also be outside the policy boundary for this artifact class. The decision needs source, builder, workflow, dependency, signer, and log facts, not one badge.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The artifact digest is the anchor. The verifier starts by hashing or resolving the bytes it is about to use, then accepts only claims whose subject names that digest.',
        'Every later check is a graph join. Digest joins to attestation subject, attestation joins to builder and source, signature joins to identity, log proof joins to public inclusion, and policy joins those facts to allowed values.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A build system emits provenance as an attestation. The attestation names the artifact digest, source and build definition, builder identity, and sometimes resolved dependencies. A signer or build platform authenticates it.',
        {type: 'image', src: 'https://dev-to-uploads.s3.amazonaws.com/uploads/articles/mgjaldsyt8ax8d3ibbct.png', alt: 'SLSA verification flow from artifact and provenance through verifier checks', caption: 'Verification starts from the downloaded artifact and rejects claims that fail source, tag, builder, or digest expectations. Source: DEV Community, https://dev.to/kanywst/slsa-provenance-hands-on-generate-with-github-actions-verify-with-slsa-verifier-56ka.'},
        'A verifier retrieves the attestation by digest or registry reference, checks the signature, checks the subject digest, then evaluates builder, source, workflow, parameters, and dependency constraints. If transparency is required, it verifies log inclusion.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Digest matching prevents evidence from being attached to the wrong bytes. If an attacker gives a valid attestation for image A while deploying image B, the subject digest will not match B.',
        'Policy keeps signatures from becoming universal permission. A signer trusted for documentation releases need not be trusted for production containers. A builder trusted for one repository need not be trusted for another.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The first cost is instrumentation. Builders must emit useful provenance, dependency tools must expose resolved inputs, and registries or metadata stores must make attestations discoverable by digest.',
        'The second cost is policy maintenance. Development, staging, and production often need different rules. Older artifacts, network failures, missing dependency fields, and emergency releases need explicit handling.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Provenance graphs fit container admission controllers, artifact promotion services, package registries, high-risk dependency updates, release audits, and incident response. They answer where these bytes came from without reconstructing the build by hand.',
        'They also make blast-radius analysis faster. If a builder credential is compromised, the graph can find artifacts built by that builder during the exposure window. If a dependency digest is bad, the graph can find downstream artifacts that included it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A provenance graph does not prove the code is harmless. If the expected source contains a vulnerability, provenance can faithfully prove that the vulnerable artifact came from that source.',
        'It also fails when fields are incomplete or overtrusted. Dependency evidence may be partial, transparency logs help only when checked or monitored, and tags remain weaker anchors than digests.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Kubernetes admission controller receives registry.example/payments:1.4.2. It resolves the tag to sha256:abc123 and searches for signed provenance whose subject is sha256:abc123.',
        'The policy requires source github.com/acme/payments, workflow release.yml, builder acme-hosted-builder, signer acme-build-identity, and a transparency-log inclusion proof. The verifier checks each edge and records the evidence ids if deployment passes.',
        'If the tag resolves to sha256:def456 while the attestation names sha256:abc123, the digest edge fails. If the builder is a self-hosted runner, the builder edge fails. If a new dependency digest is outside policy, the dependency edge denies or escalates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study SLSA Build Provenance, the SLSA attestation model, in-toto provenance predicates, Sigstore cosign attestations, and Rekor transparency logging. These sources define the common evidence fields behind the graph.',
        'Next study Content-Addressed Merkle DAG Object Store, Git Internals, Claim Graph and Source Ledger, TUF Update Metadata, SLSA Build and Source Trust Ladder, Sigstore Keyless Signing, OPA/Rego Policy Decision Graph, and Kubernetes Admission Policy Gate.',
      ],
    },
  ],
};
