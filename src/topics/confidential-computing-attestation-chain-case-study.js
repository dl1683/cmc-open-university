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
      heading: 'How to read the animation',
      paragraphs: [
        'The quote-chain view shows a secret moving from impossible to releasable. Active nodes are the current evidence path: code is measured, the trusted execution environment makes a report, the report becomes a signed quote, and the verifier checks it before any key leaves.',
        'The policy view shows the verifier as a row of predicates. Found nodes are claims already accepted, compare nodes are claims still being checked, and removed nodes are denial paths such as stale nonce, unknown root, or measurement drift.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Confidential computing protects data while a workload is running, not only while bytes are stored or sent. A trusted execution environment, or TEE, is a hardware-backed isolation boundary that tries to keep the host, hypervisor, or cloud operator from reading protected memory.',
        'The hard question is secret release. A key server needs proof that the expected code is running in the expected TEE mode before it releases a database key, model shard, or data token.',
        {type:'callout', text:'Remote attestation turns secret release into a predicate over fresh, signed runtime evidence rather than a credential check on a named machine.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/93/Trust_boundary_illustration_confidential_computing.jpg', alt:'A comparison of trust boundaries for no confidential computing, VM isolation, process isolation, and function isolation.', caption:'Trust boundary illustration of confidential computing. Source: Wikimedia Commons, HudsonAttests, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust the machine name, service account, TLS client certificate, or cloud role. That can prove the caller has a credential, but it does not prove which image booted, whether debug mode is off, or whether the request came from the intended isolation boundary.',
        'Build signing is another reasonable step. It proves that an artifact was produced by an approved pipeline, but it does not prove that this live process booted that artifact with the right flags at this moment.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between artifact identity and runtime identity. A signed image can be copied, launched with weak flags, attached to the wrong tenant, or paired with a stale credential.',
        'Replay is the second wall. A valid quote from yesterday cannot justify a key release today, so the verifier needs freshness, usually a nonce, inside the signed evidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat key release as a policy decision over signed runtime claims. A quote is a signed evidence packet that usually contains measurements, configuration, a nonce, optional public key material, and a certificate chain rooted in a platform authority.',
        'The invariant is strict: no secret leaves unless the quote is authentic, fresh, measured against an allow list, configured correctly, bound to the expected identity, and scoped to the requested secret. Missing evidence is a denial, not a warning.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The workload boots inside a TEE and the platform records measurements such as image hash, launch configuration, security flags, and sometimes role or tenant data. The workload asks the platform for an attestation report, then turns that report into a signed quote through the platform or vendor attestation chain.',
        'The verifier sends a nonce first. The workload includes that nonce, and often an ephemeral public key, so a successful decision can encrypt the released secret to this session instead of creating a reusable bearer token.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from preserving a chain of claims. The signature authenticates the platform, the measurement names the workload, the nonce proves freshness, and policy matching decides whether that exact state may receive that exact secret.',
        'Each predicate covers a different failure. If the root is unknown, the evidence is not trusted; if the nonce is stale, the evidence may be replayed; if the measurement changed, the verifier no longer knows which code it is trusting.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The online cost is an extra protocol before useful work begins. A verifier may add 10 ms to 200 ms depending on quote generation, certificate validation, network path, and cache state, so systems often cache accepted measurements while still requiring fresh nonces for key release.',
        'The operational cost is policy maintenance. Every compiler change, base image update, kernel update, firmware update, or debug flag can change measurements, so teams need staged allow-list updates, denial telemetry, root rotation, and audit storage.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Attestation fits data clean rooms, payment processing, confidential databases, private model-weight release, regulated analytics, and customer-controlled key release in cloud services. The common shape is one party owning data or keys while another party operates infrastructure.',
        'It also fits supply-chain gates. Provenance says what was built, while attestation says what is running, and a release policy can require both before data enters the workload.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Attestation does not prove that the application is bug-free. SQL injection, prompt injection, side channels, excessive logging, and bad authorization can leak data after a correct key release.',
        'It also fails when policies are broad. An allow list that ignores debug flags, tenant labels, requested secret scope, driver state, or expired roots can release secrets to states that were never intended to receive them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payment enclave may receive key K_pay only when image hash H1 runs with debug disabled for tenant T7. The verifier sends nonce N44, and the enclave returns a quote containing H1, debug=false, tenant T7, nonce N44, and public key P_tmp.',
        'The verifier checks the AWS Nitro-style certificate chain, sees nonce N44, matches H1 to policy version 12, verifies debug=false, and encrypts K_pay to P_tmp for 15 minutes. If a rebuild changes the hash to H2, the same request is denied until policy version 13 explicitly admits H2.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS Nitro Enclaves attestation document validation, AMD SEV-SNP attestation reports, Intel TDX quote verification, Azure Attestation, NVIDIA Attestation, and RFC 8949 for CBOR. Study certificate chains, nonces, public-key binding, and OPA-style policy evaluation next.',
        'Then compare this topic with Confidential GPU Inference Attestation, Private RAG Confidential Enclave, Sigstore keyless signing, SLSA provenance, and secret-management systems such as KMS or Vault. The repeated idea is evidence first, policy second, narrow release third.',
      ],
    },
  ],
};
