// Sigstore keyless signing: OIDC identity, ephemeral key, Fulcio certificate,
// artifact signature, Rekor transparency entry, TUF trust root, and policy verification.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sigstore-keyless-signing-transparency',
  title: 'Sigstore Keyless Signing Transparency',
  category: 'Security',
  summary: 'A code-signing case study: bind an OIDC identity to an ephemeral key, issue a short-lived Fulcio certificate, log the signing event in Rekor, and verify by policy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['signing flow', 'verification flow'], defaultValue: 'signing flow' },
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

function signingGraph(title) {
  return graphState({
    nodes: [
      { id: 'oidc', label: 'OIDC', x: 0.7, y: 3.2, note: 'identity' },
      { id: 'ephemeral', label: 'eph key', x: 2.4, y: 5.3, note: 'local' },
      { id: 'fulcio', label: 'Fulcio', x: 2.4, y: 3.2, note: 'CA' },
      { id: 'cert', label: 'cert', x: 4.3, y: 3.2, note: 'short lived' },
      { id: 'artifact', label: 'artifact', x: 4.5, y: 5.3, note: 'digest' },
      { id: 'sig', label: 'sig', x: 6.1, y: 4.2, note: 'bytes' },
      { id: 'rekor', label: 'Rekor', x: 7.55, y: 4.2, note: 'log' },
      { id: 'bundle', label: 'bundle', x: 9.0, y: 4.2, note: 'verify data' },
    ],
    edges: [
      { id: 'e-oidc-fulcio', from: 'oidc', to: 'fulcio' },
      { id: 'e-ephemeral-fulcio', from: 'ephemeral', to: 'fulcio' },
      { id: 'e-fulcio-cert', from: 'fulcio', to: 'cert' },
      { id: 'e-ephemeral-sig', from: 'ephemeral', to: 'sig' },
      { id: 'e-artifact-sig', from: 'artifact', to: 'sig' },
      { id: 'e-cert-sig', from: 'cert', to: 'sig' },
      { id: 'e-sig-rekor', from: 'sig', to: 'rekor' },
      { id: 'e-cert-rekor', from: 'cert', to: 'rekor' },
      { id: 'e-rekor-bundle', from: 'rekor', to: 'bundle' },
      { id: 'e-sig-bundle', from: 'sig', to: 'bundle' },
    ],
  }, { title });
}

function verifyGraph(title) {
  return graphState({
    nodes: [
      { id: 'artifact', label: 'artifact', x: 0.8, y: 4.2, note: 'digest' },
      { id: 'sig', label: 'signature', x: 2.3, y: 3.0, note: 'crypto' },
      { id: 'cert', label: 'cert', x: 2.3, y: 5.4, note: 'SAN' },
      { id: 'tuf', label: 'TUF root', x: 4.1, y: 3.0, note: 'trust' },
      { id: 'fulcio', label: 'Fulcio', x: 4.1, y: 5.4, note: 'issuer' },
      { id: 'rekor', label: 'Rekor', x: 5.9, y: 4.2, note: 'included' },
      { id: 'time', label: 'time', x: 7.3, y: 3.0, note: 'valid cert' },
      { id: 'policy', label: 'policy', x: 7.3, y: 5.4, note: 'identity' },
      { id: 'decision', label: 'decision', x: 9.0, y: 4.2, note: 'accept?' },
    ],
    edges: [
      { id: 'e-artifact-sig', from: 'artifact', to: 'sig' },
      { id: 'e-sig-cert', from: 'sig', to: 'cert' },
      { id: 'e-tuf-fulcio', from: 'tuf', to: 'fulcio' },
      { id: 'e-fulcio-cert', from: 'fulcio', to: 'cert' },
      { id: 'e-cert-rekor', from: 'cert', to: 'rekor' },
      { id: 'e-sig-rekor', from: 'sig', to: 'rekor' },
      { id: 'e-rekor-time', from: 'rekor', to: 'time' },
      { id: 'e-cert-policy', from: 'cert', to: 'policy' },
      { id: 'e-time-decision', from: 'time', to: 'decision' },
      { id: 'e-policy-decision', from: 'policy', to: 'decision' },
      { id: 'e-rekor-decision', from: 'rekor', to: 'decision' },
    ],
  }, { title });
}

function* signingFlow() {
  const signingNodes = 8;
  const signingRecords = 4;

  yield {
    state: signingGraph('Keyless signing starts with identity, not a long-lived key'),
    highlight: { active: ['oidc', 'ephemeral', 'fulcio', 'e-oidc-fulcio', 'e-ephemeral-fulcio'], compare: ['artifact'] },
    explanation: `The signer authenticates to an OIDC identity provider and generates an ephemeral key. Fulcio verifies the token across ${signingNodes} nodes and can issue a short-lived certificate binding identity to that key.`,
    invariant: `The long-lived secret is replaced by identity plus short-lived proof across all ${signingNodes} signing components.`,
  };
  yield {
    state: signingGraph('Fulcio issues a short-lived certificate for the ephemeral key'),
    highlight: { active: ['fulcio', 'cert', 'ephemeral', 'e-fulcio-cert', 'e-ephemeral-fulcio'], found: ['oidc'] },
    explanation: `The certificate records the signing identity in a form verifiers can check. Its short lifetime narrows the key-management problem among ${signingNodes} participants, but it also makes time evidence important.`,
  };
  yield {
    state: signingGraph('The artifact signature and certificate go to Rekor'),
    highlight: { active: ['artifact', 'sig', 'cert', 'rekor', 'e-artifact-sig', 'e-cert-sig', 'e-sig-rekor', 'e-cert-rekor'], compare: ['bundle'] },
    explanation: `The ephemeral private key signs the artifact digest. Rekor records the signature and certificate in a transparency log, creating public evidence of the signing event across ${signingNodes} nodes.`,
  };
  yield {
    state: labelMatrix(
      'Signing records',
      [
        { id: 'identity', label: 'identity' },
        { id: 'cert', label: 'certificate' },
        { id: 'sig', label: 'signature' },
        { id: 'rekor', label: 'Rekor entry' },
      ],
      [
        { id: 'binds', label: 'binds' },
        { id: 'risk', label: 'risk controlled' },
      ],
      [
        ['human/workload', 'anonymous key'],
        ['identity to key', 'key sprawl'],
        ['artifact digest', 'byte tamper'],
        ['event to time', 'hidden signing'],
      ],
    ),
    highlight: { active: ['identity:binds', 'cert:binds', 'sig:binds', 'rekor:binds'], found: ['rekor:risk'] },
    explanation: `Sigstore is useful because each of the ${signingRecords} records has a narrow job. Identity, certificate, signature, and log evidence are separate checks.`,
  };
}

function* verificationFlow() {
  const verifyNodes = 9;
  const rejectReasons = 5;

  yield {
    state: verifyGraph('Verifier gets trust roots through TUF'),
    highlight: { active: ['tuf', 'fulcio', 'cert', 'e-tuf-fulcio', 'e-fulcio-cert'], compare: ['policy'] },
    explanation: `Sigstore distributes trusted Fulcio and Rekor material through a TUF root. Without the right trust root, the verifier cannot determine which of the ${verifyNodes} components to accept.`,
  };
  yield {
    state: verifyGraph('Check signature, certificate, and artifact digest together'),
    highlight: { active: ['artifact', 'sig', 'cert', 'e-artifact-sig', 'e-sig-cert'], found: ['decision'] },
    explanation: `Cryptographic verification asks whether this signature validates this artifact under the public key in this certificate. The certificate then connects that key back to identity across ${verifyNodes} verification nodes.`,
  };
  yield {
    state: verifyGraph('Use Rekor evidence to check time and inclusion'),
    highlight: { active: ['sig', 'cert', 'rekor', 'time', 'e-sig-rekor', 'e-cert-rekor', 'e-rekor-time'], compare: ['policy'] },
    explanation: `Rekor evidence helps the verifier establish that the signing event was logged and that the signature was made while the short-lived certificate was valid, feeding into ${verifyNodes} nodes of proof.`,
  };
  yield {
    state: verifyGraph('Policy decides whether the identity may sign this artifact'),
    highlight: { active: ['cert', 'policy', 'decision', 'e-cert-policy', 'e-policy-decision'], found: ['rekor', 'time'] },
    explanation: `Verification is not done when the math passes. Policy must still check that the certificate identity, issuer, workflow, repository, branch, or namespace is authorized for this artifact — any of ${rejectReasons} reasons can cause rejection.`,
  };
  yield {
    state: labelMatrix(
      'Reject reasons',
      [
        { id: 'sig', label: 'bad sig' },
        { id: 'cert', label: 'bad cert' },
        { id: 'log', label: 'no log proof' },
        { id: 'time', label: 'wrong time' },
        { id: 'id', label: 'wrong identity' },
      ],
      [
        { id: 'decision', label: 'decision' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['deny', 'bytes changed'],
        ['deny', 'untrusted issuer'],
        ['deny/escalate', 'not transparent'],
        ['deny', 'outside cert life'],
        ['deny', 'not allowed signer'],
      ],
    ),
    highlight: { removed: ['sig:decision', 'cert:decision', 'time:decision', 'id:decision'], compare: ['log:decision'] },
    explanation: `A production verifier should return precise failure reasons across all ${rejectReasons} categories. Otherwise teams turn off verification because nobody can tell which link failed.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'signing flow') yield* signingFlow();
  else if (view === 'verification flow') yield* verificationFlow();
  else throw new InputError('Pick a Sigstore view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a proof packet for a software artifact. An artifact is a built object such as a container image, binary, release archive, SBOM, or provenance file.',
        {
          type: 'callout',
          text: 'Sigstore replaces long-lived release-key custody with identity-bound short certificates plus public log evidence.',
        },
        'The active stage shows which evidence is being created or checked: OIDC identity, ephemeral key, Fulcio certificate, artifact digest, signature, Rekor log entry, or verifier policy. Found means a verifier has enough matching evidence to accept the artifact under policy.',
        'The safe inference rule is that a valid signature is not enough. The verifier must also check the expected identity, digest, certificate validity time, transparency evidence, trusted roots, and policy.',
      
        {type: 'image', src: './assets/gifs/sigstore-keyless-signing-transparency.gif', alt: 'Animated walkthrough of the sigstore keyless signing transparency visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Software releases need integrity and origin evidence. A user or deployment gate wants to know that these bytes were produced by the expected project or workflow and were not modified after signing.',
        'Traditional signing puts a long-lived private key in a release machine, CI secret store, hardware token, or maintainer process. That key must be protected, rotated, scoped, audited, and revoked if compromised.',
        'Sigstore keyless signing exists to reduce that custody problem. It binds a short-lived signing certificate to an OIDC identity and records signing metadata in a transparency log.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to create a release key and use it for every build. Consumers verify the public key and trust signatures made by the matching private key.',
        'That is a real improvement over unsigned artifacts because tampering after signing can be detected. It also matches older package-signing and code-signing workflows.',
        'The weakness is key custody. If the release key leaks, attackers can sign new artifacts until revocation and trust distribution catch up.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a key says little about why it was used. A signature from the right key does not prove the right CI workflow, branch, source revision, or human approval produced the artifact.',
        'Another wall is hidden misuse. If a key or identity signs an unexpected artifact and nobody can see the event, consumers may discover the problem only after deployment.',
        'A checksum posted in release notes does not solve this. It proves bytes match the posted checksum, but not who produced the checksum or whether the event was publicly auditable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Many build systems already have strong temporary identity at release time. A CI job can obtain an OIDC token saying which repository, workflow, branch, or service account is running.',
        'Sigstore uses that identity to issue a short-lived certificate for an ephemeral public key. The private key can be discarded after signing, so there is no permanent release secret to store in the pipeline.',
        'Rekor adds visibility. The signing event is logged in an append-only transparency log, so verifiers and monitors can inspect what identity signed which digest.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The signer gets an OIDC token from an identity provider and generates an ephemeral key pair. Fulcio verifies the identity token and issues a short-lived certificate binding that identity to the public key.',
        {
          type: 'image',
          src: 'https://docs.sigstore.dev/fulcio-4-construct-certificate.png',
          alt: 'Fulcio constructing a certificate from an OIDC token and public key',
          caption: 'Fulcio embeds the authenticated identity and public key into a short-lived certificate before signing. Source: Sigstore certificate issuing overview https://docs.sigstore.dev/certificate_authority/certificate-issuing-overview/.',
        },
        'The signer signs the artifact digest with the ephemeral private key. The signature, digest, certificate, and related metadata are recorded in Rekor or carried in a verification bundle.',
        'The verifier checks the artifact digest, cryptographic signature, certificate chain, identity fields, signing time evidence, transparency inclusion, and local policy. A deployment gate should reject a valid signature from the wrong workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The cryptographic part works because the signature verifies against the public key in the certificate, and the certificate binds that public key to an authenticated identity. The private key is short-lived in practice because it is generated for the signing event and then discarded.',
        'The audit part works because Rekor records signing metadata in a tamper-resistant append-only log. Monitors can look for unexpected use of a project, workflow, identity, or artifact namespace.',
        'The policy part is what turns evidence into trust. The verifier must decide that this exact identity is allowed to sign this exact kind of artifact.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Sigstore removes long-lived key storage from the common path, but it adds identity and policy work. Teams must secure OIDC issuance, CI permissions, workflow definitions, trusted roots, and verifier configuration.',
        'Verification cost is more than one signature check. A gate may verify the digest, certificate chain, identity constraints, timestamp, transparency proof, and provenance link for every artifact.',
        'Operational cost shows up in incident response. A suspicious log entry forces the team to decide whether CI identity was abused, policy was too broad, or a release workflow changed legitimately.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Keyless signing fits CI-built containers, release archives, language packages, SBOMs, and SLSA provenance attestations. The workload fit is strongest when builds already run under a clear workload identity.',
        'Kubernetes admission controllers and deployment gates can verify Sigstore evidence before allowing an image. The policy can require a specific repository, workflow, issuer, and digest rather than accepting any signed image.',
        'Maintainers can also monitor the transparency log for their identities. Visibility matters because a bad signing event can be investigated even before a downstream verifier sees the artifact.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when policy is broad. Accepting any valid Sigstore signature is weak because the signer may be unrelated to the project or release path.',
        'It fails when the identity provider or CI workflow is compromised. Keyless signing narrows private-key custody, but it shifts trust to identity, workflow permissions, Fulcio, Rekor, trusted roots, and verifier policy.',
        'It also fails when transparency is treated as approval. A Rekor entry proves logged evidence; it does not prove the artifact is safe or authorized.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A GitHub Actions workflow builds image registry.example/app@sha256:abc123. The job receives an OIDC identity for repo example/app, workflow release.yml, and branch main.',
        'Cosign generates an ephemeral key, Fulcio issues a short-lived certificate for that workflow identity, and the job signs digest sha256:abc123. Rekor records the digest, signature, and certificate evidence.',
        'A cluster admission policy later requires issuer https://token.actions.githubusercontent.com, repository example/app, workflow release.yml, branch main, and digest sha256:abc123. If an attacker pushes app:latest with digest sha256:def456 or signs with a personal identity, verification fails policy even if some signature is cryptographically valid.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Sigstore overview at https://docs.sigstore.dev/about/overview/, Fulcio overview at https://docs.sigstore.dev/certificate_authority/overview/, Rekor overview at https://docs.sigstore.dev/logging/overview/, and cosign verification documentation at https://docs.sigstore.dev/cosign/verifying/verify/.',
        'Study OIDC tokens, X.509 certificates, transparency logs, TUF root distribution, SLSA provenance, in-toto attestations, SBOMs, and Kubernetes admission policy next.',
      ],
    },
  ],
};
