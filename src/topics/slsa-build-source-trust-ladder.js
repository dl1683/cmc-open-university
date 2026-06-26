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
  const l1Active = ['source', 'builder', 'artifact', 'prov', 'e-source-builder', 'e-builder-artifact', 'e-builder-prov', 'e-artifact-prov'];
  const l1Compare = ['signed'];
  const l1Title = 'Build L1 means provenance exists';
  yield {
    state: buildGraph(l1Title),
    highlight: { active: l1Active, compare: l1Compare },
    explanation: `SLSA ${l1Title.split(' means')[0]} gives you provenance: a record linking ${l1Active.filter(id => !id.startsWith('e-')).length} nodes (${l1Active.filter(id => !id.startsWith('e-')).join(', ')}) via ${l1Active.filter(id => id.startsWith('e-')).length} edges. It helps with debugging and expectation checks, but without the ${l1Compare[0]} node it can still be incomplete or unsigned.`,
  };
  const l2Active = ['builder', 'prov', 'signed', 'expect', 'e-builder-prov', 'e-prov-signed', 'e-signed-expect'];
  const l2Found = ['verify'];
  const l2Title = 'Build L2 adds hosted, signed provenance';
  yield {
    state: buildGraph(l2Title),
    highlight: { active: l2Active, found: l2Found },
    explanation: `${l2Title}: trust moves into a hosted build platform where ${l2Active.filter(id => !id.startsWith('e-')).length} nodes (${l2Active.filter(id => !id.startsWith('e-')).join(', ')}) are active and the ${l2Found[0]} node is now reachable. The verifier can reject unsigned or inauthentic provenance instead of trusting a loose JSON file.`,
    invariant: 'The verifier must compare provenance against expectations, not only check that it exists.',
  };
  const l3Active = ['builder', 'prov', 'hardened', 'expect', 'e-prov-hardened', 'e-hardened-expect'];
  const l3Compare = ['signed'];
  const l3Title = 'Build L3 hardens the build platform itself';
  yield {
    state: buildGraph(l3Title),
    highlight: { active: l3Active, compare: l3Compare },
    explanation: `${l3Title}. With ${l3Active.filter(id => !id.startsWith('e-')).length} active nodes (${l3Active.filter(id => !id.startsWith('e-')).join(', ')}), the platform must isolate builds from one another and keep provenance-signing secrets away from user-defined build steps. The ${l3Compare[0]} path is shown for comparison against L2.`,
  };
  const matrixRows = [
    { id: 'l0', label: 'Build L0' },
    { id: 'l1', label: 'Build L1' },
    { id: 'l2', label: 'Build L2' },
    { id: 'l3', label: 'Build L3' },
  ];
  const matrixCols = [
    { id: 'claim', label: 'claim' },
    { id: 'blocks', label: 'blocks' },
  ];
  const matrixValues = [
    ['none', 'nothing'],
    ['provenance exists', 'mistakes'],
    ['hosted+signed', 'post-build tamper'],
    ['hardened build', 'in-build tamper'],
  ];
  const matrixActive = ['l1:claim', 'l2:claim', 'l3:claim'];
  const matrixFound = ['l2:blocks', 'l3:blocks'];
  yield {
    state: labelMatrix('Build track ladder', matrixRows, matrixCols, matrixValues),
    highlight: { active: matrixActive, found: matrixFound },
    explanation: `The ladder is a ${matrixRows.length}-row by ${matrixCols.length}-column matrix (${matrixCols.map(c => c.label).join(', ')}). ${matrixActive.length} claim cells are active (${matrixRows.filter((_, i) => i > 0).map(r => r.label).join(', ')}); ${matrixFound.length} blocking outcomes are confirmed (${matrixFound.map(f => f.split(':')[0]).map(id => matrixRows.find(r => r.id === id).label).join(', ')}). Higher build levels make provenance harder to forge, but the consumer still needs policy expectations.`,
  };
}

function* sourceLadder() {
  const s1Active = ['repo', 'rev', 'e-repo-rev'];
  const s1Compare = ['history', 'controls'];
  const s1Title = 'Source L1 starts with version-controlled revisions';
  yield {
    state: sourceGraph(s1Title),
    highlight: { active: s1Active, compare: s1Compare },
    explanation: `The Source track reintroduces source integrity. ${s1Title}: ${s1Active.filter(id => !id.startsWith('e-')).length} nodes (${s1Active.filter(id => !id.startsWith('e-')).join(', ')}) are active so consumers can name exactly what source they are consuming. The ${s1Compare.join(' and ')} nodes come later.`,
  };
  const s2Active = ['rev', 'history', 'vsa', 'e-rev-history', 'e-controls-vsa'];
  const s2Compare = ['review'];
  const s2Title = 'Source L2 preserves history and provenance';
  yield {
    state: sourceGraph(s2Title),
    highlight: { active: s2Active, compare: s2Compare },
    explanation: `${s2Title}: ${s2Active.filter(id => !id.startsWith('e-')).length} nodes are now active (${s2Active.filter(id => !id.startsWith('e-')).join(', ')}), connected by ${s2Active.filter(id => id.startsWith('e-')).length} edges. A consumer should be able to inspect how a revision came to exist, not only see its final tree hash. The ${s2Compare[0]} node remains pending for L4.`,
  };
  const s3Active = ['access', 'controls', 'vsa', 'e-access-controls', 'e-controls-vsa'];
  const s3Found = ['consumer'];
  const s3Title = 'Source L3 makes controls continuous and technical';
  yield {
    state: sourceGraph(s3Title),
    highlight: { active: s3Active, found: s3Found },
    explanation: `${s3Title}: ${s3Active.filter(id => !id.startsWith('e-')).length} nodes (${s3Active.filter(id => !id.startsWith('e-')).join(', ')}) enforce organizational controls while the ${s3Found[0]} node is now reachable. The data structure is not just commits; it includes roles, protected references, policy configuration, and evidence that controls were active.`,
    invariant: 'A source level is a claim about managed process, not a property of git alone.',
  };
  const s4Active = ['controls', 'review', 'vsa', 'consumer', 'e-controls-review', 'e-review-vsa', 'e-vsa-consumer'];
  const s4Compare = ['repo'];
  const s4Title = 'Source L4 adds required code review';
  yield {
    state: sourceGraph(s4Title),
    highlight: { active: s4Active, compare: s4Compare },
    explanation: `${s4Title}: ${s4Active.filter(id => !id.startsWith('e-')).length} nodes are active (${s4Active.filter(id => !id.startsWith('e-')).join(', ')}), linked by ${s4Active.filter(id => id.startsWith('e-')).length} edges. Review raises the bar against insider mistakes and unauthorized changes, but the verifier still has to know which source control system (${s4Compare[0]}) and claims it trusts.`,
  };
}

function* verificationMap() {
  const v1Active = ['buildProv', 'sourceVsa', 'roots', 'e-build-roots', 'e-source-roots'];
  const v1Compare = ['decision'];
  const v1Title = 'Verification starts with trust roots';
  yield {
    state: verificationGraph(v1Title),
    highlight: { active: v1Active, compare: v1Compare },
    explanation: `${v1Title}: ${v1Active.filter(id => !id.startsWith('e-')).length} nodes (${v1Active.filter(id => !id.startsWith('e-')).join(', ')}) feed into verification via ${v1Active.filter(id => id.startsWith('e-')).length} edges. A verifier needs configured roots of trust: which build platforms, source control systems, signing identities, or verification-summary issuers can speak for a package. The ${v1Compare[0]} node is the eventual outcome.`,
  };
  const v2Active = ['artifact', 'buildProv', 'sourceVsa', 'e-artifact-build', 'e-artifact-source'];
  const v2Found = ['expect'];
  const v2Title = 'Subject matching binds claims to the artifact';
  yield {
    state: verificationGraph(v2Title),
    highlight: { active: v2Active, found: v2Found },
    explanation: `${v2Title}: ${v2Active.filter(id => !id.startsWith('e-')).length} nodes (${v2Active.filter(id => !id.startsWith('e-')).join(', ')}) are matched by subject digest, unlocking the ${v2Found[0]} node. A valid attestation for the wrong artifact or revision is irrelevant. Subject digests, source revision identifiers, builder IDs, and verifier IDs are join keys.`,
  };
  const v3Active = ['expect', 'policy', 'decision', 'e-expect-policy', 'e-policy-decision'];
  const v3Compare = ['roots'];
  const v3Title = 'Expectations turn attestations into a decision';
  yield {
    state: verificationGraph(v3Title),
    highlight: { active: v3Active, compare: v3Compare },
    explanation: `${v3Title}: ${v3Active.filter(id => !id.startsWith('e-')).length} nodes (${v3Active.filter(id => !id.startsWith('e-')).join(', ')}) form the decision chain, referencing the ${v3Compare[0]} established earlier. SLSA verification is a comparison: actual claims versus expected source repo, branch or tag policy, build type, builder ID, parameters, and minimum trusted level.`,
  };
  const failRows = [
    { id: 'subject', label: 'subject mismatch' },
    { id: 'root', label: 'unknown root' },
    { id: 'builder', label: 'bad builder' },
    { id: 'params', label: 'bad params' },
    { id: 'level', label: 'low level' },
  ];
  const failCols = [
    { id: 'decision', label: 'decision' },
    { id: 'why', label: 'why' },
  ];
  const failValues = [
    ['deny', 'wrong artifact'],
    ['deny', 'cannot trust issuer'],
    ['deny', 'unexpected platform'],
    ['deny', 'unapproved build input'],
    ['warn/deny', 'risk threshold'],
  ];
  const failRemoved = ['subject:decision', 'root:decision', 'builder:decision', 'params:decision'];
  const failActive = ['level:decision'];
  yield {
    state: labelMatrix('Verifier failures', failRows, failCols, failValues),
    highlight: { removed: failRemoved, active: failActive },
    explanation: `The policy table has ${failRows.length} failure modes across ${failCols.length} columns (${failCols.map(c => c.label).join(', ')}). ${failRemoved.length} rows produce hard denials (${failRemoved.map(r => r.split(':')[0]).map(id => failRows.find(r => r.id === id).label).join(', ')}); the ${failActive[0].split(':')[0]} row (${failRows.find(r => r.id === failActive[0].split(':')[0]).label}) may warn or deny based on risk threshold. Each denial carries a field-level reason so humans can fix the release process instead of guessing.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the ladder as evidence getting stronger, not as a security badge getting shinier. The artifact is the built package or image; provenance is metadata about how it was built; source controls are rules around the repository and revision.',
        {type: 'callout', text: 'SLSA levels are evidence strength, not a magic security badge; policy still has to compare claims to expectations.'},
        'Active nodes are claims being checked against policy. A found state means the claim matched the artifact, source, builder, and level required in that frame.',
        {type: 'image', src: './assets/gifs/slsa-build-source-trust-ladder.gif', alt: 'Animated walkthrough of the slsa build source trust ladder visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Software consumers often receive bytes built somewhere else. A signature can say who endorsed bytes, but not by itself which source revision, builder, workflow, or source controls produced them.',
        {type: 'image', src: 'https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ei62txenvyrk9v4ow7p0.png', alt: 'Layered sketch of artifact attestation provenance signature and verification', caption: 'The artifact, attestation, provenance, signature, and verifier are separate layers that the trust ladder connects. Source: DEV Community, https://dev.to/kanywst/slsa-provenance-hands-on-generate-with-github-actions-verify-with-slsa-verifier-56ka.'},
        'SLSA means Supply-chain Levels for Software Artifacts. It gives producers and consumers shared language for build and source integrity evidence. It does not prove that code is safe; it proves more about the path from source to artifact.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust a release name, maintainer account, or artifact signature. That catches some tampering because changed bytes will not match a signature over the original bytes.',
        'It leaves the build story vague. A signed artifact may come from a laptop, fork, local patch, or workflow that exposed signing credentials to untrusted steps.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that supply-chain failures happen between source and artifact. Attackers can alter a workflow, compromise a build runner, publish from the wrong repository, or reuse metadata from an older artifact.',
        'Checking for any signature or any provenance file is too weak. The verifier must compare the subject digest, builder, source, parameters, issuer, and required level against policy.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'SLSA turns trust into claims with issuers and levels. Build levels describe the strength of evidence about the artifact build. Source levels describe the strength of evidence around the source revision and source-control process.',
        'The levels are policy inputs. A prototype may warn on missing provenance, while a production payment service may deny anything below a specific build and source level.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Verification starts from the artifact digest. The verifier finds provenance whose subject names that digest, verifies the attestation issuer, then checks builder identity, build type, source repository, revision, parameters, and minimum level.',
        {type: 'image', src: 'https://dev-to-uploads.s3.amazonaws.com/uploads/articles/mgjaldsyt8ax8d3ibbct.png', alt: 'SLSA verification flow from artifact and provenance to verifier checks', caption: 'Verification is a field-by-field comparison against expected source, builder, tag, and digest claims. Source: DEV Community, https://dev.to/kanywst/slsa-provenance-hands-on-generate-with-github-actions-verify-with-slsa-verifier-56ka.'},
        'Build L1 means provenance exists. Build L2 adds hosted build and stronger provenance authenticity. Build L3 adds stronger isolation and resistance to tenant-controlled provenance forgery. Source levels add evidence about version control, history, administrative controls, and review.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a chain of joins. Artifact bytes join to a digest, the digest joins to the provenance subject, the provenance joins to source and builder claims, and policy joins those facts to allowed values.',
        'Each failure has a concrete meaning. Wrong subject means the evidence belongs to different bytes. Wrong builder means the artifact came through an unapproved path. Low level means the evidence is weaker than the environment requires.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Higher levels cost engineering work. Hosted builders change release workflows, stronger isolation can restrict privileged steps, and source controls add branch protection, review, and exception handling.',
        'Verification also costs operations. Attestations must be stored, found, cached, and checked near release or deployment. Strict gates need reasoned overrides, expiration, and audit records for outages or emergency fixes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SLSA fits release gates, package registries, container promotion, Kubernetes admission, regulated artifact inventories, and incident response. It helps teams ask which artifacts came from a compromised builder, key, workflow, branch, or source-control window.',
        'It is useful across organization boundaries. A consumer cannot inspect every producer build, but it can require provenance and check whether the producer used the expected source and builder path.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SLSA does not prove that code is correct, secure, or non-malicious. A trusted builder can faithfully build vulnerable code, and review can miss a backdoor.',
        'It also fails when treated as paperwork. Provenance that is generated but never checked does not protect deployment. Accepting any valid attestation regardless of digest, source, builder, or parameters turns evidence into theater.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A platform requires production images for payments to come from repo github.com/acme/payments, release tags, builder acme-hosted-builder, build type container-release-v2, Build L3, and Source L4. The image is registry.example/payments@sha256:abc123.',
        'The gate finds provenance whose subject is sha256:abc123, verifies the issuer, checks the builder and build type, checks the source repo and tag, and checks a source verification summary for the same revision. If all fields match, deployment passes.',
        'If the image digest is sha256:def456, the subject check fails. If the digest matches but the builder is a laptop runner, the builder check fails. If the source is a fork, the source expectation fails.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The official SLSA specification currently redirects to v1.2 and describes v1.2 as the version defining levels, tracks, and recommended attestation formats including provenance. Study the Build Track, Source Track, Build Provenance, Verification Summary, and Verified Properties pages.',
        'Next study Software Supply-Chain Provenance Graph, Sigstore Keyless Signing, in-toto attestations, TUF metadata, Reproducible Builds, SBOMs, OPA/Rego policy, and Kubernetes Admission Policy Gate.',
      ],
    },
  ],
};
