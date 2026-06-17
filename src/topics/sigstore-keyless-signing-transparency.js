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
  yield {
    state: signingGraph('Keyless signing starts with identity, not a long-lived key'),
    highlight: { active: ['oidc', 'ephemeral', 'fulcio', 'e-oidc-fulcio', 'e-ephemeral-fulcio'], compare: ['artifact'] },
    explanation: 'The signer authenticates to an OIDC identity provider and generates an ephemeral key. Fulcio verifies the token and can issue a short-lived certificate binding identity to that key.',
    invariant: 'The long-lived secret is replaced by identity plus short-lived proof.',
  };
  yield {
    state: signingGraph('Fulcio issues a short-lived certificate for the ephemeral key'),
    highlight: { active: ['fulcio', 'cert', 'ephemeral', 'e-fulcio-cert', 'e-ephemeral-fulcio'], found: ['oidc'] },
    explanation: 'The certificate records the signing identity in a form verifiers can check. Its short lifetime narrows the key-management problem, but it also makes time evidence important.',
  };
  yield {
    state: signingGraph('The artifact signature and certificate go to Rekor'),
    highlight: { active: ['artifact', 'sig', 'cert', 'rekor', 'e-artifact-sig', 'e-cert-sig', 'e-sig-rekor', 'e-cert-rekor'], compare: ['bundle'] },
    explanation: 'The ephemeral private key signs the artifact digest. Rekor records the signature and certificate in a transparency log, creating public evidence of the signing event.',
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
    explanation: 'Sigstore is useful because each record has a narrow job. Identity, certificate, signature, and log evidence are separate checks.',
  };
}

function* verificationFlow() {
  yield {
    state: verifyGraph('Verifier gets trust roots through TUF'),
    highlight: { active: ['tuf', 'fulcio', 'cert', 'e-tuf-fulcio', 'e-fulcio-cert'], compare: ['policy'] },
    explanation: 'Sigstore distributes trusted Fulcio and Rekor material through a TUF root. Without the right trust root, the verifier cannot know which CA or log key to accept.',
  };
  yield {
    state: verifyGraph('Check signature, certificate, and artifact digest together'),
    highlight: { active: ['artifact', 'sig', 'cert', 'e-artifact-sig', 'e-sig-cert'], found: ['decision'] },
    explanation: 'Cryptographic verification asks whether this signature validates this artifact under the public key in this certificate. The certificate then connects that key back to identity.',
  };
  yield {
    state: verifyGraph('Use Rekor evidence to check time and inclusion'),
    highlight: { active: ['sig', 'cert', 'rekor', 'time', 'e-sig-rekor', 'e-cert-rekor', 'e-rekor-time'], compare: ['policy'] },
    explanation: 'Rekor evidence helps the verifier establish that the signing event was logged and that the signature was made while the short-lived certificate was valid.',
  };
  yield {
    state: verifyGraph('Policy decides whether the identity may sign this artifact'),
    highlight: { active: ['cert', 'policy', 'decision', 'e-cert-policy', 'e-policy-decision'], found: ['rekor', 'time'] },
    explanation: 'Verification is not done when the math passes. Policy must still check that the certificate identity, issuer, workflow, repository, branch, or namespace is authorized for this artifact.',
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
    explanation: 'A production verifier should return precise failure reasons. Otherwise teams turn off verification because nobody can tell which link failed.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Sigstore is a modern software-signing stack. Its keyless flow lets a user or workload sign artifacts without managing a long-lived signing key. Instead, the signer authenticates through OIDC, Fulcio issues a short-lived certificate binding identity to an ephemeral public key, and Rekor records the signing event in a transparency log.',
        'The data-structure view is a linked proof packet: artifact digest, signature, Fulcio certificate, signing identity, log entry, inclusion and timestamp evidence, TUF-distributed trust roots, and policy expectations.',
      ],
    },
    {
      heading: 'The obvious attempt',
      paragraphs: [
        'The traditional answer to artifact signing is to create a long-lived private key, store it in CI or a release machine, and use it to sign builds. That is understandable, but it creates a custody problem. Keys must be generated, backed up, rotated, revoked, scoped, audited, and protected from every workflow that can reach them.',
        'Another weak answer is to rely on package names, registry tags, or checksums posted in release notes. Tags can be moved. Accounts can be compromised. Checksums prove bytes match a posted value, but not who produced that value or whether the event was visible to auditors. Sigstore moves the trust record from hidden key custody toward short-lived identity-bound signing plus public transparency.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that many build systems already have strong workload identity at the moment of release. A CI job can prove it is a specific repository, workflow, branch, or runner through OIDC. Fulcio can turn that temporary identity into a short-lived signing certificate for an ephemeral key. The artifact can then be signed without storing a permanent private key in the pipeline.',
        'Rekor adds a second property: visibility. A signing event is placed in an append-only transparency log so verifiers and monitors can detect what identities signed what artifacts. The verification question becomes a policy question: did the expected identity sign this digest, at a valid time, with evidence recorded under trusted roots?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During signing, the signer gets an OIDC token, generates an ephemeral key pair, asks Fulcio for a certificate for that key, signs the artifact digest, and uploads the signature plus certificate to Rekor. The result can be carried as a bundle or fetched by verifiers.',
        'During verification, the verifier obtains trusted Sigstore roots, checks the certificate chain and identity, verifies the artifact signature, verifies Rekor inclusion or signed timestamp evidence, checks that the certificate was valid at signing time, and then applies policy to the identity and artifact namespace.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The important records are OIDC identity token, ephemeral key, Fulcio certificate, artifact digest, signature, Rekor transparency entry, signed timestamp, inclusion proof, verification bundle, and policy rule. JWT Verification explains the common signed-token shape behind many OIDC identity tokens. TUF Update Metadata Case Study explains how the root material is distributed; Transparency Log Witnessing Case Study explains the log proof side.',
        'Sigstore complements SLSA. SLSA describes provenance and required trust levels. Sigstore supplies an identity and transparency mechanism for signing artifacts or attestations. Software Supply Chain Provenance Graph is the umbrella graph that joins those records.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A GitHub Actions workflow builds a container image. The workflow receives an OIDC identity from GitHub, uses cosign keyless signing to get a Fulcio certificate for the workflow identity, signs the image digest, and records the signature in Rekor. The deployment gate later verifies that the image digest matches, the certificate issuer and subject match the expected workflow, the Rekor evidence is valid, and the SLSA provenance says the expected builder produced the image.',
        'If an attacker steals a registry password and uploads a new image under the same tag, the signature check fails for the new digest. If an attacker signs with a personal identity, the cryptography may pass but policy rejects the wrong subject. If Rekor contains an unexpected certificate for the release identity, monitoring should raise an incident even before a deployment uses it.',
        'The same pattern applies to language packages, release archives, SBOMs, and provenance attestations. The artifact digest is the anchor. Tags, filenames, and package versions are labels around it. A serious verifier ties the digest to the expected builder identity and then checks whether the surrounding provenance says the artifact came from the right source, workflow, and dependency boundary.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The signing-flow view is proving that the key is not the identity. The ephemeral key signs the artifact, but the certificate binds that key to an OIDC identity and a short validity window. The transparency entry then records evidence that the event happened. The result is a packet a verifier can inspect without trusting a private release machine.',
        'The verification-flow view is proving that cryptography alone is not authorization. A valid signature from the wrong workflow should fail policy. A logged event proves visibility, not approval. A trusted root tells the verifier which Fulcio and Rekor records to trust, not whether the artifact is safe. The deployment gate must combine signature validity, identity policy, digest match, timestamp evidence, and provenance expectations.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Keyless signing works because the signing key is temporary and the identity proof is externalized. Stealing yesterday\'s ephemeral private key is far less useful than stealing a long-lived release key, because the certificate has expired and policy can require a fresh OIDC-bound identity. That does not remove all risk, but it narrows the secret-management problem.',
        'Transparency works because hidden signing events become detectable. If an attacker obtains an identity token and signs an artifact, the event can appear in Rekor where monitors can notice an unexpected subject, issuer, repository, workflow, or artifact namespace. The model is closer to certificate transparency for software artifacts than to a private approval database.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Sigstore shifts operational burden rather than deleting it. Teams must secure CI permissions, scope OIDC trust, write verifier policy, monitor transparency logs, manage TUF roots, and decide how to respond to suspicious entries. A weak policy that accepts any valid Sigstore signature is barely better than accepting any signed binary.',
        'There is also ecosystem complexity. Offline verification may require bundles. Air-gapped environments need root and log material handled carefully. Incident response must answer whether a bad signature was caused by compromised CI identity, a malicious workflow change, a policy gap, or a dependency artifact signed by an unexpected maintainer.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Keyless does not mean identity-free. It shifts trust from stored private keys to identity providers, Fulcio, Rekor, TUF roots, and policy. That is often easier to operate, but it still needs identity scoping, monitoring, and incident response.',
        'Another mistake is treating transparency inclusion as approval. Rekor proves a signing event was logged. It does not prove the signer was authorized for a particular package or that the signed artifact is safe. A deployment system must reject signatures from unexpected subjects even when all cryptographic checks pass.',
        'The useful mental model is not "signed equals trusted." It is "signed by whom, for which digest, under which identity provider, at what time, visible in which log, allowed by which policy?" Sigstore supplies evidence for those questions, but the organization still has to write and enforce the answers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Sigstore keyless signing overview at https://docs.sigstore.dev/cosign/signing/overview/, Sigstore security model at https://docs.sigstore.dev/about/security/, Sigstore threat model at https://docs.sigstore.dev/about/threat-model/, and Sigstore home at https://www.sigstore.dev/. Study JWT Verification, TLS 1.3 Handshake, TUF Update Metadata Case Study, Transparency Log Witnessing Case Study, SLSA Build & Source Trust Ladder, Software Supply Chain Provenance Graph, and Kubernetes Admission Policy Gate next.',
      ],
    },
  ],
};
