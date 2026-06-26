// Enclave secret release policy: verify attestation claims, bind a public key,
// release only scoped secrets, and seal derived state for later resumes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'enclave-secret-release-policy-case-study',
  title: 'Enclave Secret Release Policy Case Study',
  category: 'Security',
  summary: 'A key-release case study: attestation claims, nonce freshness, public-key binding, KMS policy predicates, scoped decrypt, sealed state, rotation, and audit.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['secret gate', 'sealed state'], defaultValue: 'secret gate' },
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

function releaseGraph(title) {
  return graphState({
    nodes: [
      { id: 'enc', label: 'enc', x: 0.8, y: 3.5, note: 'workload' },
      { id: 'quote', label: 'quote', x: 2.2, y: 2.0, note: 'claims' },
      { id: 'pk', label: 'pubkey', x: 2.2, y: 5.0, note: 'wrap' },
      { id: 'kms', label: 'KMS', x: 4.0, y: 3.5, note: 'policy' },
      { id: 'meas', label: 'meas', x: 5.6, y: 1.5, note: 'allow' },
      { id: 'iam', label: 'IAM', x: 5.6, y: 3.5, note: 'caller' },
      { id: 'scope', label: 'scope', x: 5.6, y: 5.5, note: 'secret' },
      { id: 'wrap', label: 'wrap', x: 7.4, y: 3.5, note: 'cipher' },
      { id: 'secret', label: 'secret', x: 9.0, y: 2.0, note: 'inside' },
      { id: 'audit', label: 'audit', x: 9.0, y: 5.0, note: 'event' },
    ],
    edges: [
      { id: 'e-enc-quote', from: 'enc', to: 'quote' },
      { id: 'e-enc-pk', from: 'enc', to: 'pk' },
      { id: 'e-quote-kms', from: 'quote', to: 'kms' },
      { id: 'e-pk-kms', from: 'pk', to: 'kms' },
      { id: 'e-kms-meas', from: 'kms', to: 'meas' },
      { id: 'e-kms-iam', from: 'kms', to: 'iam' },
      { id: 'e-kms-scope', from: 'kms', to: 'scope' },
      { id: 'e-scope-wrap', from: 'scope', to: 'wrap' },
      { id: 'e-wrap-secret', from: 'wrap', to: 'secret' },
      { id: 'e-wrap-audit', from: 'wrap', to: 'audit' },
    ],
  }, { title });
}

function sealGraph(title) {
  return graphState({
    nodes: [
      { id: 'secret', label: 'secret', x: 0.8, y: 3.5, note: 'key' },
      { id: 'derive', label: 'derive', x: 2.4, y: 3.5, note: 'session' },
      { id: 'state', label: 'state', x: 4.0, y: 1.8, note: 'cache' },
      { id: 'seal', label: 'seal', x: 4.0, y: 5.2, note: 'bind' },
      { id: 'store', label: 'store', x: 5.8, y: 3.5, note: 'disk' },
      { id: 'resume', label: 'resume', x: 7.4, y: 2.0, note: 'same meas' },
      { id: 'rotate', label: 'rotate', x: 7.4, y: 5.0, note: 'new key' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.5, note: 'why' },
    ],
    edges: [
      { id: 'e-secret-derive', from: 'secret', to: 'derive' },
      { id: 'e-derive-state', from: 'derive', to: 'state' },
      { id: 'e-derive-seal', from: 'derive', to: 'seal' },
      { id: 'e-state-store', from: 'state', to: 'store' },
      { id: 'e-seal-store', from: 'seal', to: 'store' },
      { id: 'e-store-resume', from: 'store', to: 'resume' },
      { id: 'e-store-rotate', from: 'store', to: 'rotate' },
      { id: 'e-resume-audit', from: 'resume', to: 'audit' },
      { id: 'e-rotate-audit', from: 'rotate', to: 'audit' },
    ],
  }, { title });
}

function* secretGate() {
  yield {
    state: releaseGraph('Secret release joins attestation and key wrapping'),
    highlight: { active: ['enc', 'quote', 'pk', 'kms', 'e-enc-quote', 'e-enc-pk', 'e-quote-kms', 'e-pk-kms'], found: ['wrap'] },
    explanation: 'The enclave sends attestation claims and a public key. The key service verifies the quote and wraps the secret so only the attested enclave can unwrap it.',
    invariant: 'The secret is released to a measured state, not to a host process.',
  };
  yield {
    state: labelMatrix(
      'Policy',
      [
        { id: 'img', label: 'image' },
        { id: 'role', label: 'role' },
        { id: 'tenant', label: 'tenant' },
        { id: 'secret', label: 'secret' },
        { id: 'ttl', label: 'ttl' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['hash', 'allow'],
        ['caller', 'IAM'],
        ['id', 'match'],
        ['key id', 'scope'],
        ['expiry', 'short'],
      ],
    ),
    highlight: { active: ['img:rule', 'role:rule', 'tenant:rule', 'secret:rule'], compare: ['ttl:rule'] },
    explanation: 'Secret-release policy should bind image measurement, caller identity, tenant, secret scope, and time. Broad decrypt access defeats the point of attestation.',
  };
  yield {
    state: releaseGraph('Only scoped decrypt produces wrapped secret material'),
    highlight: { active: ['meas', 'iam', 'scope', 'wrap', 'secret', 'e-kms-meas', 'e-kms-iam', 'e-kms-scope', 'e-scope-wrap', 'e-wrap-secret'], compare: ['audit'] },
    explanation: 'A successful decision returns ciphertext bound to the enclave public key or session. The host can transport it but should not be able to read it.',
  };
  yield {
    state: releaseGraph('Audit records the exact claims and policy version'),
    highlight: { active: ['quote', 'kms', 'wrap', 'audit', 'e-wrap-audit'], compare: ['secret'] },
    explanation: 'The audit row should store quote digest, policy version, requested secret, caller, tenant, decision, and reason. That is what lets operators prove why a key was released.',
  };
}

function* sealedState() {
  yield {
    state: sealGraph('Derived state can be sealed to a measurement'),
    highlight: { active: ['secret', 'derive', 'state', 'seal', 'e-secret-derive', 'e-derive-state', 'e-derive-seal'], found: ['store'] },
    explanation: 'After release, the workload may derive session keys, cache decrypted model shards, or write resumable state. Sealing binds stored state to an expected enclave measurement or key ladder.',
  };
  yield {
    state: labelMatrix(
      'Seal',
      [
        { id: 'model', label: 'model' },
        { id: 'index', label: 'index' },
        { id: 'cache', label: 'cache' },
        { id: 'token', label: 'token' },
      ],
      [
        { id: 'bind', label: 'bind' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['image hash', 'stale'],
        ['tenant', 'leak'],
        ['version', 'reuse'],
        ['ttl', 'replay'],
      ],
    ),
    highlight: { active: ['model:bind', 'index:bind', 'cache:bind', 'token:bind'], compare: ['token:risk'] },
    explanation: 'Sealed state still needs policy. Bind it to image, tenant, model or index version, and expiration so a future resume cannot silently reuse stale authority.',
  };
  yield {
    state: sealGraph('Resume requires the right measurement or re-release'),
    highlight: { active: ['store', 'resume', 'audit', 'e-store-resume', 'e-resume-audit'], compare: ['rotate'] },
    explanation: 'If the workload resumes under the same approved measurement, it can unseal state. If code, policy, tenant, or key version changes, it should re-attest or discard state.',
  };
  yield {
    state: sealGraph('Rotation creates a controlled break in old state'),
    highlight: { active: ['store', 'rotate', 'audit', 'e-store-rotate', 'e-rotate-audit'], compare: ['resume'] },
    explanation: 'Key rotation, emergency deny lists, or measurement revocation should intentionally make old sealed state unusable, with an audit reason rather than a mysterious decrypt failure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'secret gate') yield* secretGate();
  else if (view === 'sealed state') yield* sealedState();
  else throw new InputError('Pick an enclave secret-release view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the flow as a decision about authority. Active means evidence or policy is being checked, visited means a claim has been validated or rejected, and found means a secret is wrapped to an enclave-held key after policy approval.',
        'The safe inference rule is bound release. A secret may be usable only by the measured workload instance whose fresh attestation and public key were accepted. The host may carry messages, but it must not receive plaintext authority.',
        {type:'callout', text:'Secret release turns attestation into authority only when the policy binds measurement, caller, scope, freshness, and an enclave-held key before any secret becomes usable.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An enclave is a protected execution environment that tries to keep code and data isolated from the surrounding host. Remote attestation is signed evidence about what code and platform are running. A secret-release policy decides whether that evidence is good enough to receive a key, token, or credential.',
        'Confidential workloads still need authority. A model server may need a decryption key, a payment worker may need a signing key, and an analytics job may need a scoped token. Releasing those secrets to the host identity alone defeats much of the enclave boundary.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to give the virtual machine, pod, or service account permission to call a key-management system. The application starts, authenticates as that identity, and decrypts the secret. This is normal for many services.',
        'That approach trusts the host boundary. A copied credential, debug shell, stale deployment, or compromised parent process can request the same secret. The request proves who called, but not which measured enclave code will use the material.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is authority without measurement. A key service that checks only IAM identity cannot distinguish a production enclave image from a debug build or a host process replaying a request. The wrong code can receive the right secret.',
        'The second wall is resume state. After a valid release, the workload may cache decrypted shards, session keys, or indexes. If sealed state can reopen after policy revocation, the system has recreated old authority through storage.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Bind the release to evidence, policy, freshness, and an enclave-held key. The verifier checks the attestation document, code measurement, caller, tenant, requested secret, policy version, nonce, and public key binding. Only then does it wrap a narrow secret to that key.',
        'The invariant is no accepted evidence, no usable secret. The host can forward the request and response, but it should see only ciphertext that the enclave can unwrap. Policy controls authority before plaintext exists outside the release service.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The enclave generates a key pair inside the protected boundary. It asks the platform for an attestation document that includes a fresh challenge and the public key or a digest of it. The host forwards that document and the requested secret id to the release service.',
        'The release service validates the platform certificate chain, measurement, nonce, caller, tenant, scope, and policy version. If the decision is allow, it encrypts the secret to the enclave public key and logs the decision. If any required claim fails, it denies release.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Measurement binding makes the request about running code, not just infrastructure identity. Freshness prevents replay of old evidence. Public-key binding prevents the host from substituting itself as the recipient.',
        'Sealing extends the same logic across restarts. Durable sensitive state should reopen only when the future environment still satisfies the policy. If measurement, tenant, model version, or policy version no longer matches, denial is the correct behavior.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cryptographic operation is usually smaller than the lifecycle cost. Rollouts change image hashes, signer certificates, measurements, driver claims, and policy rows. If policy lags code, correct workloads fail to decrypt; if policy is too broad, secrets leak across boundaries.',
        'When tenants double, policy rows, audit volume, revocation paths, and sealed-state migration work can roughly double. The dominant operational cost is keeping allowlists narrow while deployments keep moving. Emergency revocation must be tested before it is needed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits private inference, data clean rooms, payment signing, regulated analytics, secure build workers, and agent tool credentials. In each case, the owner wants to release capability to a measured worker without fully trusting the host.',
        'It also gives blast-radius control. A stolen disk, copied host token, or compromised parent process should still lack the measurement and enclave key needed to unwrap the secret. The policy narrows who can turn evidence into authority.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Secret release does not prove the code is bug-free or unable to leak data after it receives the key. Side channels, bad logging, prompt injection, broad outbound access, and application flaws remain possible. Attestation proves claims about environment, not moral behavior.',
        'It also fails when measurements are too dynamic to manage. If every plugin, script, model shard, and debug flag requires a new exception, operators may loosen policy until it means little. A broad attestation policy can become ceremony.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A model-serving enclave needs key model-prod-7. The attestation says measurement M1, tenant acme, nonce 4812, and public key digest K1. Policy allows M1 for acme to receive only model-prod-7 for 15 minutes, so the service returns ciphertext encrypted to K1 and logs audit id 9004.',
        'Now a host process replays the same request six hours later. The nonce is stale, so release is denied. If the host substitutes public key K2, the public-key digest no longer matches the attested evidence, so the service denies that request too.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS KMS Nitro Enclave condition keys at https://docs.aws.amazon.com/kms/latest/developerguide/conditions-nitro-enclave.html, AWS Nitro Enclaves attestation at https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html, and Google Confidential Space resource authorization at https://docs.cloud.google.com/confidential-computing/confidential-space/docs/create-grant-access-confidential-resources. Use the vendor docs for claim names and policy hooks.',
        'Study Confidential Computing Attestation Chain, Confidential GPU Inference Attestation, Capability Security Attenuation, OPA Rego Policy Decision Graph, Key Rotation, and Audit Logs to connect release decisions with lifecycle control. The release decision is only one part of key safety.',
      ],
    },
  ],
};
