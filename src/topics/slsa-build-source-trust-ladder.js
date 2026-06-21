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
        "Read the animation as the execution trace for SLSA Build & Source Trust Ladder. A supply-chain security primer: organize source controls, build provenance, trusted platforms, verification summaries, and policy expectations into levels..",
        {type: "callout", text: "SLSA levels are evidence strength, not a magic security badge; policy still has to compare claims to expectations."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/slsa-build-source-trust-ladder.gif', alt: 'Animated walkthrough of the slsa build source trust ladder visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SLSA exists to answer a narrow supply-chain question: why should a consumer trust that this software artifact came from the expected source, through the expected build process, on a trustworthy platform? It does not prove that the software is bug-free. It does not replace vulnerability scanning, sandboxing, code review, threat modeling, or runtime monitoring. It raises confidence in the integrity of the path from source revision to built artifact.',
        {type: 'image', src: 'https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ei62txenvyrk9v4ow7p0.png', alt: 'Layered sketch of artifact attestation provenance signature and verification', caption: 'The artifact, attestation, provenance, signature, and verifier are separate layers that the trust ladder connects. Source: DEV Community, https://dev.to/kanywst/slsa-provenance-hands-on-generate-with-github-actions-verify-with-slsa-verifier-56ka.'},
        'Modern software delivery has too many handoffs for a plain trust me release process. Source code sits in a source control system. A build job runs on hosted infrastructure. Dependencies are fetched. Compilers, package managers, scripts, and container builders produce bytes. A registry stores an artifact. A deployer later pulls those bytes into production. Every handoff can be attacked or misconfigured: source history can be rewritten, a credential can publish a fake package, a build script can fetch unreviewed input, or a release can point to bytes built outside the approved pipeline.',
        'The SLSA ladder gives producers and consumers shared language for those risks. Instead of saying this artifact is secure, it asks more precise questions: is there provenance, is it authentic, was it generated by the build platform, was the build isolated, which source revision was used, and did that source revision satisfy the required source controls?',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to sign the artifact. A signature is useful because it can prove that some identity endorsed some bytes. But a signature by itself does not prove what source was used, which builder produced the bytes, whether the build was isolated, whether the signing key was protected from user scripts, or whether the artifact matches the intended release branch.',
        'A second obvious approach is to require a provenance file. That is better, but still incomplete. A loose JSON file can be missing fields, written by the build itself, copied from another artifact, or issued by an untrusted system. The consumer needs to know whether the provenance is authentic, whether it identifies the exact artifact digest, and whether it came from a build platform with the required controls.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that supply-chain trust is a graph join, not a vibes check. The artifact digest joins to build provenance through the subject field. The build provenance joins to the source repository and source revision. Source verification summaries join to the same revision. Signatures and attestations join claims to trust roots. Expectations join the actual claims to policy. The final result should be allow, warn, or deny with reasons.',
        'SLSA levels are useful because they describe the strength of the evidence, not because they replace policy. A consumer still needs concrete expectations: which source repository is allowed, which named references are acceptable, which build platform can produce artifacts, which build type is expected, which external parameters are allowed, and which minimum levels are required for this environment.',
      ],
    },
    {
      heading: 'Build track',
      paragraphs: [
        'SLSA v1.2 defines an approved Build track for artifacts. Build L1 means provenance exists. The build process generates provenance that identifies the output package by cryptographic digest and describes how it was produced. L1 is valuable for debugging, inventory, and basic expectation checks, but it has no authenticity or tamper-resistance requirement.',
        'Build L2 adds stronger provenance authenticity and a hosted build platform. Consumers must be able to validate that the provenance attestation was not tampered with and is tied to the build platform identity, usually through a digital signature or equivalent attestation mechanism. This blocks the simple failure where an attacker uploads an unsigned or hand-written provenance file and asks the consumer to trust it.',
        'Build L3 adds stronger resistance to forgery by tenants and stronger build isolation. Provenance-signing secrets must not be accessible to user-defined build steps. Provenance fields must be generated or verified by the trusted control plane. Builds must be isolated from one another so overlapping or later builds cannot influence each other. L3 is about tampering during the build, not about proving the source code is semantically safe.',
      ],
    },
    {
      heading: 'Source track',
      paragraphs: [
        'SLSA v1.2 also defines an approved Source track. Source L1 means source is stored and managed through a modern version control system, producing discrete source revisions that can be consumed precisely. A commit hash or revision ID is the beginning of source integrity, not the end.',
        'Source L2 preserves change history and generates source provenance. The consumer can inspect how a revision came to exist, not only the final tree. Source L3 enforces organizational technical controls through the source control system, giving consumers knowledge of guaranteed controls such as access restrictions and protected references. Source L4 requires code review, improving resistance to mistakes and insider threats.',
        'Git alone is not enough. A commit hash names content and parent history, but it does not prove that branch protection was active, that tags were immutable, that the committer was authorized, that review happened, or that administrative controls were enforced. The Source track makes those controls explicit enough for attestations and verification summaries.',
      ],
    },
    {
      heading: 'How verification works',
      paragraphs: [
        'Verification starts with the artifact bytes or digest. The verifier finds build provenance whose subject matches that digest. It validates the attestation against configured trust roots. It checks builder identity, build type, parameters, source repository, source revision, and minimum build level. If source verification summaries are required, it checks that they apply to the same source revision and come from trusted source-control or summary issuers.',
        {type: 'image', src: 'https://dev-to-uploads.s3.amazonaws.com/uploads/articles/mgjaldsyt8ax8d3ibbct.png', alt: 'SLSA verification flow from artifact and provenance to verifier checks', caption: 'Verification is a field-by-field comparison against expected source, builder, tag, and digest claims. Source: DEV Community, https://dev.to/kanywst/slsa-provenance-hands-on-generate-with-github-actions-verify-with-slsa-verifier-56ka.'},
        'The policy should be field-specific. Production images for a payments service might require source repo github.com/acme/payments, a protected main branch or signed release tag, builder acme-prod-build, build type container/v2, no unapproved external parameters, Build L3, and Source L4. That is much stronger than saying requires provenance because it states what the evidence must contain.',
        'Field-level denial reasons matter. Wrong subject means the attestation is for different bytes. Unknown trust root means the verifier cannot trust the issuer. Unexpected builder means the artifact came from an unapproved platform. Bad parameters may mean the build used unreviewed inputs. Low level means the evidence may be useful for audit but insufficient for enforcement. These are different failures with different fixes.',
      ],
    },
    {
      heading: 'Concrete deployment gate',
      paragraphs: [
        'Suppose a platform team requires production container images to meet Build L3 from a specific hosted builder and Source L4 for release branches. The CI platform builds an image, emits provenance, signs or otherwise authenticates the attestation, and publishes the image by digest. A source verifier emits a verification summary for the release revision. A Kubernetes admission gate later receives a Pod using image registry.example.com/payments@sha256:abc.',
        'The gate checks that the image digest is sha256:abc and that the provenance subject includes the same digest. It checks that the provenance chains to the approved build platform. It checks builder ID, build type, source repository, revision, named reference policy, and external parameters. It checks that the source summary applies to the same revision and satisfies Source L4. It records the policy version, evidence IDs, and decision reason in audit annotations.',
        'Attack scenarios become crisp. If an attacker uploads an image with the right name but no provenance, the minimum build level fails. If they reuse old provenance for modified bytes, subject matching fails. If they build from an unofficial fork, source expectations fail. If they use an approved build type on an unapproved builder, builder expectations fail. If a dependency fetched during build is compromised, the evidence question shifts to resolved dependencies, hermeticity, dependency policy, and what the build level actually guarantees.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with inventory. List artifact types, repositories, build platforms, registries, deployers, and current signing systems. Then choose minimum levels by risk. A prototype may only warn on missing provenance. A production payment service may deny anything below Build L3 and Source L4. A third-party dependency flow may need a different policy because the producer and consumer are different organizations.',
        'Make expectations explicit and versioned. Store allowed source repositories, named references, builder IDs, build types, parameter allowlists, trust roots, and minimum levels as policy data. Keep a migration path for older artifacts, emergency overrides, and evidence outages. Overrides should require reason codes, expiration, and later review.',
        'Integrate verification close to deployment and release. Package registries, CI release jobs, Kubernetes admission controllers, artifact promotion services, and SBOM or provenance portals can all run checks. The important property is that a production action cannot silently bypass the evidence gate.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Higher levels cost engineering effort. Hosted builders require migration from local release scripts. Hardened builders restrict some patterns developers may rely on, such as privileged steps or persistent build environments. Source controls require administrative discipline and careful exception handling. Verification gates can block urgent releases if expectations are too narrow or evidence systems are down.',
        'Those costs are why the ladder is useful. Teams can set different minimums for prototypes, internal tools, customer-facing services, and high-risk infrastructure. The mistake is treating SLSA as a single badge. It is better to use levels as a risk-based policy input: stronger claims where the blast radius is large, softer gates where speed matters and exposure is lower.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SLSA wins when artifact integrity matters across organizational boundaries. Open-source package consumers can reject packages that lack expected provenance. Platform teams can prevent production from running images built on laptops. Regulated environments can retain evidence for audits. Incident responders can ask which artifacts came from a compromised builder, key, source branch, or release process.',
        'It also wins as a data structure for security operations. The artifact, builder, source revision, attestation, trust root, and policy decision form a graph that can be queried during incidents. That is much more useful than a wiki page saying the release process is trusted.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SLSA does not say whether the code is good. A perfectly sourced and built service can still contain vulnerabilities. A malicious change can pass review if reviewers miss it. A trusted builder can faithfully build unsafe code. SLSA is about integrity of the production path, not semantic correctness.',
        'It also fails if consumers do not verify. Provenance that is generated but never checked is mostly audit decoration. Verification that checks only the presence of an attestation is weak. A valid attestation for the wrong artifact, wrong source, wrong builder, or wrong parameters should not be accepted. The policy comparison is the point.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Track artifacts without provenance, unsigned or unauthentic provenance, unknown issuers, subject mismatches, unexpected builders, unapproved parameters, source-summary gaps, minimum-level failures, verifier latency, cache staleness, manual overrides, and policy drift. Run negative tests that try to deploy unsigned artifacts, wrong-digest attestations, fork-built images, unapproved builders, and low-level provenance.',
        'A supply-chain program is working when the gate denies the right failures with reasons humans can act on. A denial should tell a release engineer whether to rebuild on the approved platform, fix source controls, add missing provenance, update policy, or investigate a real compromise.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: the SLSA v1.2 specification at https://slsa.dev/spec/v1.2/, Build requirements at https://slsa.dev/spec/v1.2/build-requirements, Source requirements at https://slsa.dev/spec/v1.2/source-requirements, build provenance at https://slsa.dev/spec/v1.2/provenance, and verification summary attestations at https://slsa.dev/spec/v1.2/verification_summary.',
        'Study Software Supply-Chain Provenance Graph, Sigstore Keyless Signing and Transparency, TUF Update Metadata Case Study, Kubernetes Admission Policy Gate, OPA/Rego Policy Decision Graph, Reproducible Builds, dependency lockfiles, SBOMs, and runtime sandboxing next. These topics separate questions that are often mixed together: who signed, what was built, where it came from, how it was built, and whether it is safe to run.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
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
        'Use this topic as a checkpoint: if you can explain why SLSA Build & Source Trust Ladder moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

