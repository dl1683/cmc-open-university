// SLSA trust ladder: build/source levels as a data structure for deciding
// which software artifact, source revision, build platform, and attestation to trust.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'slsa-build-source-trust-ladder',
  title: 'SLSA Build & Source Trust Ladder',
  category: 'Security',
  summary: 'A supply-chain security primer: organize source controls, build provenance, trusted platforms, verification summaries, and policy expectations into levels.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build ladder', 'source ladder', 'verification map'], defaultValue: 'build ladder' },
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

function buildGraph(title) {
  return graphState({
    nodes: [
      { id: 'source', label: 'src', x: 0.65, y: 4.6, note: 'repo+rev' },
      { id: 'builder', label: 'build', x: 2.5, y: 4.6, note: 'platform' },
      { id: 'artifact', label: 'digest', x: 4.3, y: 4.6, note: 'artifact' },
      { id: 'prov', label: 'prov', x: 6.0, y: 4.6, note: 'how built' },
      { id: 'signed', label: 'signed', x: 7.25, y: 3.0, note: 'L2' },
      { id: 'hardened', label: 'hardened', x: 7.25, y: 6.1, note: 'L3' },
      { id: 'expect', label: 'gate', x: 8.55, y: 3.0, note: 'policy' },
      { id: 'verify', label: 'verify', x: 9.4, y: 4.6, note: 'allow?' },
    ],
    edges: [
      { id: 'e-source-builder', from: 'source', to: 'builder' },
      { id: 'e-builder-artifact', from: 'builder', to: 'artifact' },
      { id: 'e-builder-prov', from: 'builder', to: 'prov' },
      { id: 'e-artifact-prov', from: 'artifact', to: 'prov' },
      { id: 'e-prov-signed', from: 'prov', to: 'signed' },
      { id: 'e-prov-hardened', from: 'prov', to: 'hardened' },
      { id: 'e-signed-expect', from: 'signed', to: 'expect' },
      { id: 'e-hardened-expect', from: 'hardened', to: 'expect' },
      { id: 'e-expect-verify', from: 'expect', to: 'verify' },
      { id: 'e-prov-verify', from: 'prov', to: 'verify' },
    ],
  }, { title });
}

function sourceGraph(title) {
  return graphState({
    nodes: [
      { id: 'repo', label: 'repo', x: 0.8, y: 4.1, note: 'SCS' },
      { id: 'rev', label: 'revision', x: 2.3, y: 4.1, note: 'commit' },
      { id: 'history', label: 'history', x: 3.9, y: 2.6, note: 'parents' },
      { id: 'access', label: 'access', x: 3.9, y: 5.6, note: 'roles' },
      { id: 'controls', label: 'controls', x: 5.7, y: 4.1, note: 'L3' },
      { id: 'review', label: 'review', x: 7.3, y: 2.6, note: 'L4' },
      { id: 'vsa', label: 'VSA', x: 7.3, y: 5.6, note: 'summary' },
      { id: 'consumer', label: 'consumer', x: 9.1, y: 4.1, note: 'check' },
    ],
    edges: [
      { id: 'e-repo-rev', from: 'repo', to: 'rev' },
      { id: 'e-rev-history', from: 'rev', to: 'history' },
      { id: 'e-repo-access', from: 'repo', to: 'access' },
      { id: 'e-history-controls', from: 'history', to: 'controls' },
      { id: 'e-access-controls', from: 'access', to: 'controls' },
      { id: 'e-controls-review', from: 'controls', to: 'review' },
      { id: 'e-controls-vsa', from: 'controls', to: 'vsa' },
      { id: 'e-review-vsa', from: 'review', to: 'vsa' },
      { id: 'e-vsa-consumer', from: 'vsa', to: 'consumer' },
    ],
  }, { title });
}

function verificationGraph(title) {
  return graphState({
    nodes: [
      { id: 'artifact', label: 'artifact', x: 0.8, y: 4.1, note: 'digest' },
      { id: 'buildProv', label: 'build prov', x: 2.5, y: 3.0, note: 'SLSA' },
      { id: 'sourceVsa', label: 'source VSA', x: 2.5, y: 5.2, note: 'SCS' },
      { id: 'roots', label: 'trust roots', x: 4.5, y: 4.1, note: 'who can attest' },
      { id: 'expect', label: 'expectations', x: 6.3, y: 4.1, note: 'repo+builder' },
      { id: 'policy', label: 'policy', x: 7.8, y: 3.0, note: 'allowlist' },
      { id: 'audit', label: 'audit', x: 7.8, y: 5.2, note: 'why' },
      { id: 'decision', label: 'decision', x: 9.3, y: 4.1, note: 'admit' },
    ],
    edges: [
      { id: 'e-artifact-build', from: 'artifact', to: 'buildProv' },
      { id: 'e-artifact-source', from: 'artifact', to: 'sourceVsa' },
      { id: 'e-build-roots', from: 'buildProv', to: 'roots' },
      { id: 'e-source-roots', from: 'sourceVsa', to: 'roots' },
      { id: 'e-roots-expect', from: 'roots', to: 'expect' },
      { id: 'e-build-expect', from: 'buildProv', to: 'expect' },
      { id: 'e-source-expect', from: 'sourceVsa', to: 'expect' },
      { id: 'e-expect-policy', from: 'expect', to: 'policy' },
      { id: 'e-policy-decision', from: 'policy', to: 'decision' },
      { id: 'e-policy-audit', from: 'policy', to: 'audit' },
      { id: 'e-audit-decision', from: 'audit', to: 'decision' },
    ],
  }, { title });
}

function* buildLadder() {
  yield {
    state: buildGraph('Build L1 means provenance exists'),
    highlight: { active: ['source', 'builder', 'artifact', 'prov', 'e-source-builder', 'e-builder-artifact', 'e-builder-prov', 'e-artifact-prov'], compare: ['signed'] },
    explanation: 'SLSA Build L1 gives you provenance: a record of what built the artifact, what process ran, and which top-level inputs were used. It helps with debugging and expectation checks, but it can still be incomplete or unsigned.',
  };
  yield {
    state: buildGraph('Build L2 adds hosted, signed provenance'),
    highlight: { active: ['builder', 'prov', 'signed', 'expect', 'e-builder-prov', 'e-prov-signed', 'e-signed-expect'], found: ['verify'] },
    explanation: 'Build L2 moves trust into a hosted build platform that generates and signs provenance. The verifier can reject unsigned or inauthentic provenance instead of trusting a loose JSON file.',
    invariant: 'The verifier must compare provenance against expectations, not only check that it exists.',
  };
  yield {
    state: buildGraph('Build L3 hardens the build platform itself'),
    highlight: { active: ['builder', 'prov', 'hardened', 'expect', 'e-prov-hardened', 'e-hardened-expect'], compare: ['signed'] },
    explanation: 'Build L3 is about tampering during the build. The platform must isolate builds from one another and keep provenance-signing secrets away from user-defined build steps.',
  };
  yield {
    state: labelMatrix(
      'Build track ladder',
      [
        { id: 'l0', label: 'Build L0' },
        { id: 'l1', label: 'Build L1' },
        { id: 'l2', label: 'Build L2' },
        { id: 'l3', label: 'Build L3' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'blocks', label: 'blocks' },
      ],
      [
        ['none', 'nothing'],
        ['provenance exists', 'mistakes'],
        ['hosted+signed', 'post-build tamper'],
        ['hardened build', 'in-build tamper'],
      ],
    ),
    highlight: { active: ['l1:claim', 'l2:claim', 'l3:claim'], found: ['l2:blocks', 'l3:blocks'] },
    explanation: 'The ladder is cumulative: higher build levels make the provenance harder to forge or bypass, but the consumer still needs policy expectations.',
  };
}

function* sourceLadder() {
  yield {
    state: sourceGraph('Source L1 starts with version-controlled revisions'),
    highlight: { active: ['repo', 'rev', 'e-repo-rev'], compare: ['history', 'controls'] },
    explanation: 'The Source track reintroduces source integrity. L1 starts with discrete source revisions in a source control system, so consumers can name exactly what source they are consuming.',
  };
  yield {
    state: sourceGraph('Source L2 preserves history and provenance'),
    highlight: { active: ['rev', 'history', 'vsa', 'e-rev-history', 'e-controls-vsa'], compare: ['review'] },
    explanation: 'Source L2 focuses on reliable change history and source provenance. A consumer should be able to inspect how a revision came to exist, not only see its final tree hash.',
  };
  yield {
    state: sourceGraph('Source L3 makes controls continuous and technical'),
    highlight: { active: ['access', 'controls', 'vsa', 'e-access-controls', 'e-controls-vsa'], found: ['consumer'] },
    explanation: 'Source L3 requires enforced organizational controls. The data structure is not just commits; it includes roles, protected references, policy configuration, and evidence that controls were active.',
    invariant: 'A source level is a claim about managed process, not a property of git alone.',
  };
  yield {
    state: sourceGraph('Source L4 adds required code review'),
    highlight: { active: ['controls', 'review', 'vsa', 'consumer', 'e-controls-review', 'e-review-vsa', 'e-vsa-consumer'], compare: ['repo'] },
    explanation: 'Source L4 adds review as an integrity control. It raises the bar against insider mistakes and unauthorized changes, but the verifier still has to know which source control system and claims it trusts.',
  };
}

function* verificationMap() {
  yield {
    state: verificationGraph('Verification starts with trust roots'),
    highlight: { active: ['buildProv', 'sourceVsa', 'roots', 'e-build-roots', 'e-source-roots'], compare: ['decision'] },
    explanation: 'A verifier needs configured roots of trust: which build platforms, source control systems, signing identities, or verification-summary issuers can speak for a package.',
  };
  yield {
    state: verificationGraph('Subject matching binds claims to the artifact'),
    highlight: { active: ['artifact', 'buildProv', 'sourceVsa', 'e-artifact-build', 'e-artifact-source'], found: ['expect'] },
    explanation: 'A valid attestation for the wrong artifact or revision is irrelevant. Subject digests, source revision identifiers, builder IDs, and verifier IDs are join keys.',
  };
  yield {
    state: verificationGraph('Expectations turn attestations into a decision'),
    highlight: { active: ['expect', 'policy', 'decision', 'e-expect-policy', 'e-policy-decision'], compare: ['roots'] },
    explanation: 'SLSA verification is a comparison. The actual claims are compared with expected source repo, branch or tag policy, build type, builder ID, parameters, and minimum trusted level.',
  };
  yield {
    state: labelMatrix(
      'Verifier failures',
      [
        { id: 'subject', label: 'subject mismatch' },
        { id: 'root', label: 'unknown root' },
        { id: 'builder', label: 'bad builder' },
        { id: 'params', label: 'bad params' },
        { id: 'level', label: 'low level' },
      ],
      [
        { id: 'decision', label: 'decision' },
        { id: 'why', label: 'why' },
      ],
      [
        ['deny', 'wrong artifact'],
        ['deny', 'cannot trust issuer'],
        ['deny', 'unexpected platform'],
        ['deny', 'unapproved build input'],
        ['warn/deny', 'risk threshold'],
      ],
    ),
    highlight: { removed: ['subject:decision', 'root:decision', 'builder:decision', 'params:decision'], active: ['level:decision'] },
    explanation: 'The useful product shape is a policy table. Each denial has a field-level reason so humans can fix the release process instead of guessing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build ladder') yield* buildLadder();
  else if (view === 'source ladder') yield* sourceLadder();
  else if (view === 'verification map') yield* verificationMap();
  else throw new InputError('Pick a SLSA trust-ladder view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SLSA is a framework for raising confidence that software was produced from expected source, by an expected build process, on a trustworthy platform. The data-structure view is a ladder of claims: source revision, change history, build provenance, builder identity, artifact digest, verification summary, and policy expectation.',
        'SLSA v1.2 separates tracks. The Build track covers provenance and build-platform trust from Build L0 through Build L3. The Source track covers source-control trust from Source L1 through Source L4. The split matters because a project can improve build integrity without making every source-control control mature at the same time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build verification starts with artifact bytes and provenance. The verifier checks that the provenance subject matches the artifact digest, that the issuer or build platform is trusted, that the builder ID and build type are expected, and that external parameters and resolved dependencies do not violate policy.',
        'Source verification starts with a source revision and a source verification summary attestation. The verifier checks the source control system root of trust, whether the summary applies to the revision, and whether the claims match expectations for history, controls, and review.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main records are artifact subject, source revision, buildDefinition, runDetails, builder.id, externalParameters, internalParameters, resolvedDependencies, verification summary attestation, source provenance, trust-root map, expectation policy, and audit decision. These fields form a graph from source to artifact to verifier decision.',
        'Software Supply Chain Provenance Graph explains the attestation graph. TUF Update Metadata Case Study explains trusted metadata distribution. Sigstore Keyless Signing Transparency explains one way to bind identity, signature, certificate, and log evidence to the graph.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A platform team requires production images to meet Build L3 from a specific hosted builder and Source L4 for the release branch. A CI job builds an image, emits SLSA provenance, signs it, and publishes the digest. At deployment time, a policy gate verifies the image digest, checks the builder ID, rejects unexpected external parameters, verifies the source revision summary, and records the exact policy version that allowed the rollout.',
        'If an attacker uploads a correctly named image without provenance, the Build L1 requirement fails. If they reuse old signed provenance for modified bytes, the subject digest fails. If they build from an unofficial fork, the source expectation fails. If they poison the build cache, Build L3 controls and cache provenance become the relevant evidence.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'SLSA is not a scanner and not a promise that code is bug-free. It answers integrity questions: what source, what process, what platform, and what evidence support this artifact. Vulnerability scanning, runtime sandboxing, and semantic review still matter.',
        'Another mistake is treating levels as badges. A level is useful only when a verifier checks actual claims against concrete expectations. "Has provenance" is weaker than "has provenance from this trusted builder, for this repo, with these parameters, meeting this minimum level."',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SLSA v1.2 Build Track Basics at https://slsa.dev/spec/v1.2/build-track-basics, SLSA Build Provenance at https://slsa.dev/spec/v1.2/build-provenance, SLSA Source Requirements at https://slsa.dev/spec/v1.2/source-requirements, and SLSA Verifying Source at https://slsa.dev/spec/v1.2/verifying-source. Study Software Supply Chain Provenance Graph, TUF Update Metadata Case Study, Sigstore Keyless Signing Transparency, OPA Rego Policy Decision Graph, and Kubernetes Admission Policy Gate next.',
      ],
    },
  ],
};
