// Confidential-computing attestation: measurements, signed reports, quotes,
// verifier policy, freshness nonces, and secret-release decisions.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'confidential-computing-attestation-chain-case-study',
  title: 'Confidential Computing Attestation Chain Case Study',
  category: 'Security',
  summary: 'A trusted-execution case study: workload measurements, TEE reports, signed quotes, freshness nonces, verifier policy, trust roots, secret release, and audit evidence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['quote chain', 'verify policy'], defaultValue: 'quote chain' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function attestationGraph(title) {
  return graphState({
    nodes: [
      { id: 'code', label: 'code', x: 0.7, y: 3.5, note: 'image' },
      { id: 'meas', label: 'meas', x: 2.0, y: 3.5, note: 'hashes' },
      { id: 'tee', label: 'TEE', x: 3.4, y: 2.0, note: 'isolate' },
      { id: 'report', label: 'report', x: 3.4, y: 5.0, note: 'local' },
      { id: 'quote', label: 'quote', x: 5.0, y: 3.5, note: 'signed' },
      { id: 'root', label: 'root', x: 6.5, y: 2.0, note: 'CA' },
      { id: 'nonce', label: 'nonce', x: 6.5, y: 5.0, note: 'fresh' },
      { id: 'verify', label: 'verify', x: 8.0, y: 3.5, note: 'policy' },
      { id: 'secret', label: 'secret', x: 9.4, y: 2.0, note: 'release' },
      { id: 'audit', label: 'audit', x: 9.4, y: 5.0, note: 'evidence' },
    ],
    edges: [
      { id: 'e-code-meas', from: 'code', to: 'meas' },
      { id: 'e-meas-tee', from: 'meas', to: 'tee' },
      { id: 'e-tee-report', from: 'tee', to: 'report' },
      { id: 'e-report-quote', from: 'report', to: 'quote' },
      { id: 'e-root-verify', from: 'root', to: 'verify' },
      { id: 'e-nonce-quote', from: 'nonce', to: 'quote' },
      { id: 'e-quote-verify', from: 'quote', to: 'verify' },
      { id: 'e-verify-secret', from: 'verify', to: 'secret' },
      { id: 'e-verify-audit', from: 'verify', to: 'audit' },
    ],
  }, { title });
}

function policyGraph(title) {
  return graphState({
    nodes: [
      { id: 'quote', label: 'quote', x: 0.8, y: 3.5, note: 'signed' },
      { id: 'sig', label: 'sig', x: 2.1, y: 1.6, note: 'root' },
      { id: 'fresh', label: 'fresh', x: 2.1, y: 5.4, note: 'nonce' },
      { id: 'meas', label: 'meas', x: 3.8, y: 1.6, note: 'allow' },
      { id: 'cfg', label: 'cfg', x: 3.8, y: 5.4, note: 'flags' },
      { id: 'id', label: 'id', x: 5.5, y: 3.5, note: 'tenant' },
      { id: 'policy', label: 'policy', x: 7.1, y: 3.5, note: 'match' },
      { id: 'allow', label: 'allow', x: 8.7, y: 2.0, note: 'key' },
      { id: 'deny', label: 'deny', x: 8.7, y: 5.0, note: 'reason' },
    ],
    edges: [
      { id: 'e-quote-sig', from: 'quote', to: 'sig' },
      { id: 'e-quote-fresh', from: 'quote', to: 'fresh' },
      { id: 'e-sig-meas', from: 'sig', to: 'meas' },
      { id: 'e-fresh-cfg', from: 'fresh', to: 'cfg' },
      { id: 'e-meas-id', from: 'meas', to: 'id' },
      { id: 'e-cfg-id', from: 'cfg', to: 'id' },
      { id: 'e-id-policy', from: 'id', to: 'policy' },
      { id: 'e-policy-allow', from: 'policy', to: 'allow' },
      { id: 'e-policy-deny', from: 'policy', to: 'deny' },
    ],
  }, { title });
}

function* quoteChain() {
  yield {
    state: attestationGraph('Attestation binds code identity to a TEE report'),
    highlight: { active: ['code', 'meas', 'tee', 'report', 'e-code-meas', 'e-meas-tee', 'e-tee-report'], found: ['quote'] },
    explanation: 'A confidential workload starts as a measured image and configuration. The trusted execution environment reports those measurements so a remote verifier can decide what is actually running.',
    invariant: 'Trust is in the measured state, not in the VM name.',
  };
  yield {
    state: labelMatrix(
      'Quote',
      [
        { id: 'm', label: 'meas' },
        { id: 'cfg', label: 'cfg' },
        { id: 'nonce', label: 'nonce' },
        { id: 'pk', label: 'pubkey' },
        { id: 'sig', label: 'sig' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'why', label: 'why' },
      ],
      [
        ['image hash', 'code id'],
        ['TEE flags', 'mode'],
        ['random', 'fresh'],
        ['session key', 'bind secret'],
        ['vendor chain', 'auth'],
      ],
    ),
    highlight: { active: ['m:field', 'nonce:field', 'pk:field', 'sig:field'], compare: ['cfg:why'] },
    explanation: 'The quote is a signed packet: measurement, configuration, freshness nonce, optional public key, and a signature chain rooted in the platform vendor or cloud provider.',
  };
  yield {
    state: attestationGraph('Verifier checks roots, nonce, and measurements'),
    highlight: { active: ['quote', 'root', 'nonce', 'verify', 'e-root-verify', 'e-nonce-quote', 'e-quote-verify'], compare: ['secret'] },
    explanation: 'The verifier rejects stale nonces, unknown trust roots, unexpected measurements, disabled security flags, or tenant identities that do not match the policy.',
  };
  yield {
    state: attestationGraph('Only verified state receives secrets'),
    highlight: { active: ['verify', 'secret', 'audit', 'e-verify-secret', 'e-verify-audit'], compare: ['code'] },
    explanation: 'The reward for a valid attestation is narrow: release a key, data token, model shard, or policy capability. The audit record should keep the quote digest and exact policy decision.',
  };
}

function* verifyPolicy() {
  yield {
    state: policyGraph('Verification is a sequence of predicates'),
    highlight: { active: ['quote', 'sig', 'fresh', 'e-quote-sig', 'e-quote-fresh'], found: ['policy'] },
    explanation: 'Remote attestation is not one boolean. It is a chain of checks: signature root, freshness, measurement allow list, security configuration, identity, and requested secret scope.',
  };
  yield {
    state: labelMatrix(
      'Predicates',
      [
        { id: 'root', label: 'root' },
        { id: 'fresh', label: 'fresh' },
        { id: 'meas', label: 'meas' },
        { id: 'mode', label: 'mode' },
        { id: 'tenant', label: 'tenant' },
      ],
      [
        { id: 'accept', label: 'accept' },
        { id: 'reject', label: 'reject' },
      ],
      [
        ['trusted', 'unknown CA'],
        ['nonce ok', 'replay'],
        ['allow hash', 'drift'],
        ['debug off', 'weak flag'],
        ['matches', 'wrong scope'],
      ],
    ),
    highlight: { active: ['root:accept', 'fresh:accept', 'meas:accept', 'mode:accept'], removed: ['fresh:reject', 'meas:reject'] },
    explanation: 'The allow list should be specific. A valid quote for the wrong image, wrong debug mode, or wrong tenant is still a denial.',
  };
  yield {
    state: policyGraph('Policy decides allow or deny with reason codes'),
    highlight: { active: ['meas', 'cfg', 'id', 'policy', 'e-meas-id', 'e-cfg-id', 'e-id-policy'], found: ['allow', 'deny'] },
    explanation: 'Good verifiers return precise denial reasons so operators know whether to rebuild the image, update the allow list, rotate trust roots, or block a suspicious launch.',
  };
  yield {
    state: labelMatrix(
      'TEEs',
      [
        { id: 'snp', label: 'SEV-SNP' },
        { id: 'tdx', label: 'TDX' },
        { id: 'nitro', label: 'Nitro' },
        { id: 'gpu', label: 'GPU' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['VM report', 'config drift'],
        ['TD quote', 'root mgmt'],
        ['att doc', 'IAM/KMS'],
        ['device att', 'driver stack'],
      ],
    ),
    highlight: { active: ['snp:proof', 'tdx:proof', 'nitro:proof', 'gpu:proof'], compare: ['gpu:risk'] },
    explanation: 'AMD SEV-SNP, Intel TDX, AWS Nitro Enclaves, and NVIDIA confidential GPUs use different packet formats, but the data-structure shape is the same: measurements, roots, nonce, policy, and release.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'quote chain') yield* quoteChain();
  else if (view === 'verify policy') yield* verifyPolicy();
  else throw new InputError('Pick a confidential-attestation view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Confidential computing is for the moment when encrypted data has to be used. Encryption at rest protects bytes on disk. TLS protects bytes on the network. Neither one answers the question a key server cares about before it releases a secret: what code is running right now, with what configuration, inside what isolation boundary?',
        'Remote attestation is the answer shape. A workload asks the platform for signed evidence about its measured state. A verifier checks that evidence against policy. Only then does it release a key, model shard, data token, or other narrow capability. The point is not trust in a machine name. The point is trust in measured runtime state.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to give the secret to a VM, pod, service account, or TLS client certificate that has the right name. That is easy to automate, but it proves the caller has some credential, not that the expected workload booted in the expected protection mode. A copied credential, a misconfigured launch, or a stale host can still look like the right service.',
        'Build provenance helps but stops before runtime. It can say which image was built and signed. It cannot prove that this image, with these flags, in this trusted execution environment, is the thing asking for the key at this time. The wall is the gap between artifact identity and live execution identity.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'Treat secret release as a policy decision over signed runtime claims. The verifier asks whether the quote is signed by a trusted root, fresh for this challenge, measured against an allow list, configured with required security flags, bound to the expected tenant or workload identity, and scoped to the requested secret.',
        'The invariant is strict: no secret leaves the verifier unless every required claim is present, fresh, authenticated, and policy-matching. Missing evidence is a denial, not a warning. A valid quote for the wrong image, wrong debug flag, wrong tenant, or wrong secret scope is still a denial.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The quote-chain view shows the difference between a workload and evidence about that workload. Code becomes measurements. Measurements become a TEE report. The report becomes a signed quote. The verifier combines that quote with a nonce, a trust root, and policy before it releases anything.',
        'The policy view turns attestation into gates. Signature, freshness, measurement, configuration, identity, and scope all have to line up. The reject cells are not decoration. They are the denial reasons an operator needs when a deployment changed, a root rotated, a nonce was replayed, or a request asked for the wrong secret.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A workload starts from a measured image, launch configuration, and isolation mode. The platform records those facts in a local report. Depending on the technology, a device key, platform attestation service, or cloud attestation service turns the report into a quote signed through an endorsement chain.',
        'The verifier creates a nonce or challenge so old evidence cannot be replayed as fresh evidence. The workload includes that nonce in the report. The quote can also include an ephemeral public key so the released secret can be encrypted to a key controlled by the attested workload instance.',
        'Verification is a sequence of checks: parse the quote, validate the signature chain, check trust-root status, check freshness, compare measurements and flags to an allow list, check workload identity, check tenant identity, check requested secret scope, then record the allow or deny decision with enough detail for audit.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The signature check authenticates the platform evidence. The measurement check connects that evidence to a specific booted workload. The nonce check blocks replay. The policy check decides whether this measured state may receive this secret. Public-key binding keeps a valid quote from becoming a transferable bearer token.',
        'Correctness comes from refusing to collapse those checks into one vague trust bit. Each predicate protects a different edge in the chain. If the root is unknown, the evidence is unauthenticated. If the nonce is stale, the evidence may be replayed. If the measurement drifts, the verifier no longer knows what code it is trusting.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a payment enclave may receive a card-processing key only when image hash H_pay is running with debug disabled for tenant T. The verifier sends nonce N. The enclave asks the platform for a quote that includes H_pay, the launch flags, N, tenant identity, and ephemeral public key K.',
        'The verifier accepts the trust root, sees nonce N, matches H_pay and debug-off against policy, checks tenant T, checks that the request is for the card-processing key, and encrypts a short-lived key to K. The audit record stores the quote digest, policy version, measurement, nonce, tenant, and release decision.',
        'If a rebuild changes the image hash to H_new before policy is updated, the verifier denies release with a measurement-drift reason. If an attacker replays an old quote with nonce N_old, the verifier denies release with a freshness reason. If the quote is valid but asks for a settlement key instead of a processing key, the verifier denies release with a scope reason.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Attestation wins when the party releasing the secret should not trust the host by default. That includes data clean rooms, payment workloads, confidential databases, model-weight release, regulated analytics, agent sandboxes, and workloads split across cloud, vendor, and customer trust boundaries.',
        'It is strong when paired with supply-chain evidence. Provenance says what was built. Attestation says what is running. A release policy can require both: a signed build from the expected pipeline and a fresh quote showing the expected measurement in the expected protection mode.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Attestation does not prove that the application is bug-free, safe from injection, free of side channels, or authorized to do every action after it gets a key. It proves a narrower claim: this configured workload is running in an attested environment recognized by the verifier.',
        'It fails when policies are too broad. An allow list that accepts a family of images without separating debug builds, driver versions, GPU modes, tenant scopes, and requested secrets can release data to states that were never meant to receive it.',
        'It also fails when released secrets live too long. A one-time attestation followed by a long-lived bearer token weakens the chain. Prefer short-lived capabilities, binding to an ephemeral public key, renewal with fresh evidence, and revocation paths for root or measurement changes.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the verifier small and boring. Parse quote formats with tested libraries when possible. Validate the full endorsement chain. Pin allowed roots. Treat parsing errors, unknown critical fields, missing flags, stale nonces, and policy misses as denial paths.',
        'Version policy. A deployment that changes compiler flags, kernel, firmware, container base image, model package, or driver stack may change measurements. Operators need a staged path: observe new measurements, review them, approve policy updates, and roll back when a bad measurement appears.',
        'Bind release to intent. The quote should not merely prove that a workload exists. The verifier should check which tenant, which workload, which requested secret, which policy version, and which public key will receive the secret. This keeps a valid quote from being reused in a different context.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Store denial reasons. A verifier that only returns false creates slow incidents because operators cannot tell whether the root is unknown, the nonce is stale, the measurement drifted, or the requested secret scope is wrong. Good denial telemetry turns attestation from mystery gate into a controlled release system.',
        'Plan for root rotation and emergency deny lists. Vendor roots, cloud endorsement chains, and device firmware can change. A production verifier needs root bundles, expiry handling, revocation intake, policy rollback, and an audit trail showing exactly which evidence allowed each release.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study AWS Nitro Enclaves attestation, AWS KMS attestation conditions, AMD SEV-SNP, Intel TDX, NVIDIA confidential GPU attestation, Azure confidential computing, Sigstore keyless signing, software supply-chain provenance, OPA policy evaluation, and secret-release policy design. The shared pattern is evidence, policy, narrow release, and audit.',
      ],
    },
  ],
};
