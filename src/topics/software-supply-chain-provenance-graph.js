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
        "Read the animation as the execution trace for Software Supply Chain Provenance Graph. Model software provenance as a graph from source commit to builder, dependencies, artifact digest, attestation, signature, transparency log, and policy gate..",
        {type: "callout", text: "A provenance graph is useful because every trust claim has a join key that can be checked against the artifact in hand."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/software-supply-chain-provenance-graph.gif', alt: 'Animated walkthrough of the software supply chain provenance graph visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Modern software arrives as packages, containers, binaries, generated code, plugins, and dependencies built by systems the consumer did not personally watch. A name and version string do not prove where the bytes came from. A familiar registry, project name, or maintainer account can still deliver bytes that were built by the wrong workflow, from the wrong commit, or with unexpected dependencies.`,
        {type: `image`, src: `https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ei62txenvyrk9v4ow7p0.png`, alt: `Layered sketch of artifact attestation provenance signature and verification`, caption: `Artifact, attestation, provenance, signature, and verification are separate graph nodes, not one blob of metadata. Source: DEV Community, https://dev.to/kanywst/slsa-provenance-hands-on-generate-with-github-actions-verify-with-slsa-verifier-56ka.`},
        `A provenance graph records the path from source inputs to built artifact. It connects a source commit, dependency set, builder, build run, artifact digest, attestation, signature identity, transparency-log entry, and policy decision. The graph gives the verifier concrete edges to check instead of relying on reputation alone.`,
        `This exists because supply-chain attacks often exploit missing joins. The source may be clean while the build runner is compromised. The signature may be valid but attached to a build path the policy never intended to trust. The image tag may look correct while the digest points to new bytes. Provenance makes those joins explicit.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The simple approach is to trust the package name, version, maintainer, registry, or signature. If the artifact is called the right thing and a cryptographic check passes, the deployment gate lets it through. That is better than no check, but it is not enough for a serious release path.`,
        `A signature proves that an identity signed some bytes or metadata. It does not automatically prove that the bytes came from the expected source, were built by the expected builder, used the expected workflow, or included only expected dependencies. A trusted identity can sign the wrong thing, and a compromised build path can produce a signed artifact from clean source.`,
        `The wall is missing structure. The verifier needs to connect the bytes in hand to the build story. Without a digest-linked graph, it cannot tell whether an attestation belongs to this artifact, whether the builder is allowed for this source, whether dependencies were resolved as expected, or whether the signing event is publicly monitorable.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The artifact digest is the anchor. Every useful claim must attach to the exact bytes being consumed. The verifier starts by hashing the artifact it actually downloaded. If that digest does not match the attestation subject, the rest of the metadata may be valid but it is about different bytes.`,
        `From that anchor, provenance becomes a graph query. The artifact was produced by a build. The build used source and dependencies. The build ran on a builder. The builder and parameters appear in an attestation. The attestation is signed by an identity. The signed claim may appear in a transparency log. A policy decides whether that whole path is allowed.`,
        `The graph does not prove software is safe. It proves whether the build story matches the rule. Safety still depends on the source code, dependencies, review process, runtime controls, and the policy itself. Provenance narrows one important question: are these bytes the result of the build process we intended to trust?`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The provenance view shows the build story as a chain of linked evidence. Source and dependency inputs feed a builder. The builder produces an artifact. The artifact digest and build details appear in an attestation. The attestation is signed, optionally logged, and then evaluated by policy. The point is the linkage, not the diagram shape.`,
        `The policy-verification view starts with the bytes in hand. That order matters. A verifier should not begin by admiring metadata. It should hash the downloaded artifact, check that the digest is the attestation subject, verify the signature, then test whether the builder, source, dependencies, and log proof match policy.`,
        `The matrix frames show common deny cases. A digest mismatch means the metadata is about different bytes. A bad builder means the trusted source may have used an untrusted build path. A wrong source means the artifact did not come from the expected repository. A missing log proof may mean the event is not monitorable, depending on policy.`,
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        `A provenance attestation is authenticated metadata about an artifact. In SLSA-style provenance, the subject identifies artifact digests, the build definition describes the build type and parameters, resolved dependencies can record external inputs, and run details identify the builder and invocation. SLSA v1.2 describes build provenance at https://slsa.dev/spec/v1.2/build-provenance.`,
        {type: `image`, src: `https://dev-to-uploads.s3.amazonaws.com/uploads/articles/mgjaldsyt8ax8d3ibbct.png`, alt: `SLSA verification flow from artifact and provenance through verifier checks`, caption: `Verification starts from the downloaded artifact and rejects claims that fail source, tag, builder, or digest expectations. Source: DEV Community, https://dev.to/kanywst/slsa-provenance-hands-on-generate-with-github-actions-verify-with-slsa-verifier-56ka.`},
        `SLSA recommends using the in-toto attestation framework for external verification. The SLSA attestation model explains this relationship at https://slsa.dev/attestation-model, and the in-toto provenance predicate is defined at https://github.com/in-toto/attestation/blob/main/spec/predicates/provenance.md. The key idea is that provenance is machine-checkable evidence, not a human release note.`,
        `A verifier usually follows a concrete sequence. Hash the artifact. Retrieve the attestation. Verify the attestation signature against an expected identity. Check that the subject digest matches the artifact. Check builder identity, build type, source repository, commit, workflow, parameters, and dependency constraints. If the workflow requires transparency, verify that the signed claim appears in the expected log.`,
        `A policy engine turns those checks into an allow, deny, or escalate decision. The policy might say that production containers must be built by a hosted builder, from a protected branch, using a specific workflow, with provenance signed by a particular identity, and with a transparency-log inclusion proof. Another environment might accept weaker evidence but require manual review.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Digest matching prevents metadata substitution. If an attacker hands you a valid attestation for one image and different image bytes, the digest edge fails. The verifier does not need to understand the attack. It only needs to refuse to attach claims to bytes they do not name.`,
        `Signatures bind the attestation to an identity. Policy then decides what that identity is allowed to say. A signer trusted for a documentation workflow should not automatically be trusted for a production container build. A builder trusted for one organization should not automatically be trusted for another source boundary.`,
        `Transparency-log inclusion adds public evidence that the signed claim existed. It does not make an artifact safe, and it does not replace policy. Its value is monitorability. If a suspicious build is signed, monitors can discover that event instead of relying only on private deployment logs.`,
        `The graph works because each claim has a join key and each join can be checked independently. Bytes join to digest. Digest joins to attestation subject. Attestation joins to builder, source, and dependencies. Signature joins to identity. Log proof joins to public inclusion. Policy joins those facts to the release rule.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `A Kubernetes admission controller receives a container image for production. The image name is familiar, but the controller does not trust the name. It resolves the digest, fetches the image metadata, and looks for a signed provenance attestation whose subject names that digest.`,
        `The controller verifies the signature identity, checks that the builder is the expected hosted build platform, checks that the source repository and commit match an allowed release, checks that the workflow is the release workflow rather than an arbitrary job, checks dependency digests when policy requires them, and verifies Rekor or another transparency-log inclusion proof if the organization depends on public monitoring.`,
        `Now consider three failure cases. If the image tag is right but the digest differs, the first edge fails. If the digest matches but the builder is a self-hosted runner outside the trust boundary, the builder edge fails. If a new dependency appears that the policy does not recognize, the gate can deny or escalate even though the signature is cryptographically valid.`,
        `This is why provenance is a graph, not a badge. A badge that says "signed" hides the actual decision. A graph can explain which edge failed and what evidence would be needed to pass.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `The first cost is build-system integration. Builders must emit useful attestations, sign them, and preserve enough detail for verification. If the build system cannot reliably name source, parameters, builder identity, and dependencies, policy will either be weak or noisy.`,
        `The second cost is storage and distribution. Attestations must travel with artifacts or be discoverable by digest. Signatures and log proofs must be retrievable during verification. Policy engines need failure handling for missing metadata, stale logs, network errors, and artifacts built before the provenance requirement existed.`,
        `The third cost is policy design. A policy that denies every missing optional field may block legitimate releases. A policy that accepts every missing field may provide only theater. Good policies distinguish required evidence, best-effort evidence, escalation cases, and environment-specific rules. Development, staging, and production may need different gates.`,
        `Dependency completeness is especially hard. Provenance can record resolved dependencies when the build platform and ecosystem support it, but not every toolchain exposes complete dependency evidence. A mature policy treats dependency claims with clear confidence levels instead of pretending all ecosystems provide the same graph.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Provenance wins at release gates, container admission controllers, artifact registries, package mirrors, high-risk dependency updates, regulated pipelines, and incident response. It gives teams a way to answer "where did these bytes come from?" without reconstructing the whole build by hand.`,
        `It works best when artifacts are content-addressed, builders have strong identities, source repositories and workflows are constrained, signatures are verified, transparency logs are monitored, and policy is explicit about which graph edges are required. The more deterministic and automated the build pipeline is, the more useful provenance becomes.`,
        `It does not prove that software is bug-free, non-malicious, or well-designed. If the expected source contains a vulnerability, provenance can faithfully prove the vulnerable artifact came from that source. That is still useful, but it is not a substitute for code review, dependency scanning, testing, sandboxing, runtime policy, or vulnerability response.`,
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        `The biggest misconception is "signed equals safe." A signature is necessary evidence in many workflows, but it is not a complete policy. The verifier must know which identity may sign for which source, builder, workflow, and artifact class. Otherwise a valid signature can become a universal permission slip.`,
        `Another pitfall is trusting tags. Tags and version strings are mutable or ecosystem-dependent labels. Digests are the stable anchor. A policy that checks image names but not digests can accept unexpected bytes while appearing strict.`,
        `A third pitfall is logging without monitoring. A transparency log is useful because unexpected entries can be found. If nobody monitors the log, inclusion still provides auditability after the fact, but it loses much of its early-warning value.`,
        `A fourth pitfall is overclaiming dependency evidence. Some provenance records include resolved dependencies. Some do not. Some include them incompletely. Policies should say exactly which dependency edges are required and what happens when an ecosystem cannot provide them.`,
      ],
    },
    {
      heading: 'Building a good policy',
      paragraphs: [
        `A good policy starts from the asset and environment. A production payment-service container deserves stricter evidence than a development tool image. The policy should name allowed source repositories, protected branches or release tags, build workflows, builder identities, signing identities, required attestation predicates, and whether transparency inclusion is mandatory.`,
        `The policy should also define actions. A digest mismatch should deny. An unexpected builder should deny for production. A missing optional dependency list might escalate for review. A missing log proof might deny in production but warn in staging. These distinctions keep the gate useful instead of turning it into either a rubber stamp or a permanent blocker.`,
        `Finally, a good policy is explainable. When it rejects an artifact, it should report the failed edge: digest, signer, builder, source, workflow, dependency, or log proof. Supply-chain security improves faster when teams can see exactly which evidence is missing or wrong.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: SLSA Build Provenance at https://slsa.dev/spec/v1.2/build-provenance, SLSA Build Track Basics at https://slsa.dev/spec/v1.2/build-track-basics, in-toto attestation provenance predicate at https://github.com/in-toto/attestation/blob/main/spec/predicates/provenance.md, Sigstore in-toto attestations at https://docs.sigstore.dev/cosign/verifying/attestation/, and Sigstore Rekor at https://docs.sigstore.dev/logging/overview/.`,
        `Study Content-Addressed Merkle DAG Object Store for digest anchoring, Transparency Log Witnessing Case Study for public inclusion, Git Internals for source identity, Claim Graph and Source Ledger for evidence graphs, TUF Update Metadata Case Study for signed update metadata, SLSA Build and Source Trust Ladder for trust levels, Sigstore Keyless Signing Transparency for identity-backed signing, OPA Rego Policy Decision Graph for admission policy, and Kubernetes Admission Policy Gate for deployment enforcement.`,
        `A useful next exercise is to write a tiny admission rule in plain English. Name one artifact class, one allowed source, one allowed builder, one signer identity, one required digest match, and one response for missing provenance. If the rule cannot say what evidence it needs, the graph cannot save it.`,
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Software Supply Chain Provenance Graph moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
