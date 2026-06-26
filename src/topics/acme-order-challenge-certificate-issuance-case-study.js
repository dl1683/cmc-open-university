// ACME certificate issuance: account keys, orders, authorizations,
// challenges, validation evidence, finalized CSRs, and logged certificates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'acme-order-challenge-certificate-issuance-case-study',
  title: 'ACME Order Challenge Certificate Issuance',
  category: 'Security',
  summary: 'How ACME turns a domain-control proof into an issued certificate through account keys, orders, authorizations, challenges, CSRs, and issuance state.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['order flow', 'challenge proof'], defaultValue: 'order flow' },
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

function acmeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'acct', label: 'acct', x: 0.7, y: 4.0, note: notes.acct ?? 'JWS key' },
      { id: 'nonce', label: 'nonce', x: 2.0, y: 2.5, note: notes.nonce ?? 'anti replay' },
      { id: 'order', label: 'order', x: 3.2, y: 4.0, note: notes.order ?? 'names' },
      { id: 'authz', label: 'authz', x: 4.6, y: 5.8, note: notes.authz ?? 'domain' },
      { id: 'chall', label: 'chall', x: 4.6, y: 2.2, note: notes.chall ?? 'http/dns' },
      { id: 'token', label: 'token', x: 6.1, y: 2.2, note: notes.token ?? 'key auth' },
      { id: 'va', label: 'VA', x: 7.3, y: 4.0, note: notes.va ?? 'validate' },
      { id: 'csr', label: 'CSR', x: 8.4, y: 5.8, note: notes.csr ?? 'finalize' },
      { id: 'cert', label: 'cert', x: 9.3, y: 4.0, note: notes.cert ?? 'issued' },
      { id: 'ct', label: 'CT', x: 8.4, y: 2.2, note: notes.ct ?? 'logged' },
    ],
    edges: [
      { id: 'e-acct-nonce', from: 'acct', to: 'nonce' },
      { id: 'e-acct-order', from: 'acct', to: 'order' },
      { id: 'e-order-authz', from: 'order', to: 'authz' },
      { id: 'e-order-chall', from: 'order', to: 'chall' },
      { id: 'e-chall-token', from: 'chall', to: 'token' },
      { id: 'e-token-va', from: 'token', to: 'va' },
      { id: 'e-authz-va', from: 'authz', to: 'va' },
      { id: 'e-va-csr', from: 'va', to: 'csr' },
      { id: 'e-csr-cert', from: 'csr', to: 'cert' },
      { id: 'e-cert-ct', from: 'cert', to: 'ct' },
    ],
  }, { title });
}

function* orderFlow() {
  yield {
    state: acmeGraph('An ACME account key signs replay-protected requests'),
    highlight: { active: ['acct', 'nonce', 'order', 'e-acct-nonce', 'e-acct-order'], compare: ['authz'] },
    explanation: 'ACME starts with a signed account request, not with a certificate. The account key identifies the client, and the server nonce stops an old JWS request from being replayed into the issuance ledger.',
    invariant: 'Issuance is gated by account identity, replay protection, authorization state, and final certificate request state.',
  };

  yield {
    state: acmeGraph('A new order expands into per-identifier authorizations', { order: 'api+www', authz: 'pending' }),
    highlight: { active: ['order', 'authz', 'chall', 'e-order-authz', 'e-order-chall'], found: ['acct'] },
    explanation: 'The requested names expand into authorization objects. Each identifier needs a path to valid state, so one order may fan out into several domain-control challenges.',
  };

  yield {
    state: acmeGraph('Successful challenges move authorizations to valid', { chall: 'dns-01', token: 'TXT ok', va: 'valid', authz: 'valid' }),
    highlight: { active: ['chall', 'token', 'va', 'authz', 'e-chall-token', 'e-token-va', 'e-authz-va'], compare: ['csr'] },
    explanation: 'The validation authority checks evidence from the public internet, not from the client machine. dns-01 proves control through a TXT record; http-01 proves control through a token response at a well-known path.',
  };

  yield {
    state: acmeGraph('Finalization signs a CSR and returns an issued certificate', { csr: 'ready', cert: 'issued', ct: 'SCT' }),
    highlight: { found: ['va', 'csr', 'cert', 'ct', 'e-va-csr', 'e-csr-cert', 'e-cert-ct'], active: ['order'] },
    explanation: 'Only after the required authorizations become valid does the client finalize with a CSR. The CA can then issue the certificate, usually produce CT evidence, and let the client install it for TLS.',
  };
}

function* challengeProof() {
  yield {
    state: labelMatrix(
      'ACME object states',
      [
        { id: 'order', label: 'order' },
        { id: 'authz', label: 'authz' },
        { id: 'chall', label: 'chall' },
        { id: 'cert', label: 'cert' },
      ],
      [
        { id: 'start', label: 'start' },
        { id: 'good', label: 'good' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['pend', 'ready', 'bad'],
        ['pend', 'valid', 'bad'],
        ['pend', 'valid', 'bad'],
        ['none', 'issued', 'rev'],
      ],
    ),
    highlight: { active: ['order:good', 'authz:good', 'chall:good'], compare: ['cert:good'], removed: ['chall:bad'] },
    explanation: 'ACME is a visible state machine. Clients poll and advance orders, authorizations, challenges, and finalization, so retries can resume from the current object state instead of starting over blindly.',
    invariant: 'The CA issues only after every required authorization becomes valid.',
  };

  yield {
    state: labelMatrix(
      'Challenge evidence',
      [
        { id: 'http01', label: 'http01' },
        { id: 'dns01', label: 'dns01' },
        { id: 'tlsalpn', label: 'alpn' },
        { id: 'bad', label: 'bad' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['path', 'token'],
        ['TXT', 'digest'],
        ['cert', 'ext'],
        ['private', 'no'],
      ],
    ),
    highlight: { active: ['http01:proof', 'dns01:proof', 'tlsalpn:proof'], removed: ['bad:proof'] },
    explanation: 'Each challenge converts domain control into a public lookup. The proof must be reachable by the CA validation authority; a private-only record or internal HTTP path proves nothing to the public CA.',
  };

  yield {
    state: acmeGraph('DNS-01 ties issuance to DNS propagation and cache behavior', { chall: 'dns-01', token: 'TXT', va: 'query', cert: 'wait' }),
    highlight: { active: ['chall', 'token', 'va', 'e-chall-token', 'e-token-va'], compare: ['cert'], found: ['authz'] },
    explanation: 'DNS-01 is powerful because it can issue wildcard certificates, but it inherits DNS TTL, negative-cache, and delegation behavior. A stale NXDOMAIN or slow TXT propagation can delay issuance even when the client updated the zone.',
  };

  yield {
    state: labelMatrix(
      'Issuance guardrails',
      [
        { id: 'nonce', label: 'nonce' },
        { id: 'acct', label: 'acct' },
        { id: 'CAA', label: 'CAA' },
        { id: 'CT', label: 'CT' },
      ],
      [
        { id: 'guards', label: 'guards' },
        { id: 'miss', label: 'if weak' },
      ],
      [
        ['replay', 'dup req'],
        ['client', 'takeover'],
        ['issuer', 'wrong CA'],
        ['visible', 'hidden'],
      ],
    ),
    highlight: { found: ['nonce:guards', 'acct:guards', 'CAA:guards', 'CT:guards'], compare: ['CT:miss'] },
    explanation: 'Production issuance is more than passing a challenge. The control plane tracks account-key custody, CAA policy, replay nonces, authorization reuse, CT logging, rate limits, and renewal timing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'order flow') yield* orderFlow();
  else if (view === 'challenge proof') yield* challengeProof();
  else throw new InputError('Pick an ACME view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The order-flow view shows ACME, the Automatic Certificate Management Environment, as a protocol state machine. ACME automates issuance of TLS certificates, which bind a domain name to a public key for HTTPS. Follow account, nonce, order, authorization, challenge, validation, finalization, and certificate in that order.',
        'The challenge-proof view separates what the client says from what the certificate authority, or CA, can observe. Active cells show the current resource state. The safe inference is that a certificate may be issued only after each required authorization is valid and the final certificate signing request matches the order.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/34/HTTPS_icon.svg', alt:'HTTPS padlock icon', caption:'The HTTPS padlock that ACME automation made universal. Source: Wikimedia Commons, Fabián Alexis, CC BY-SA 3.0'},
        'TLS certificates expire, and expired certificates create outages. Manual renewal may work for one server, but it fails when domains, load balancers, containers, service meshes, and preview environments all need certificates on schedule. The system needs repeatable proof, issuance, deployment, and monitoring.',
        'ACME exists to make certificate issuance software-driven without removing public proof. The client creates an order, proves control of each requested identifier, submits a certificate signing request, and receives a certificate. The CA does not trust the client claim; it validates evidence from the public network.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious API is a single request: send a domain name and public key to the CA and get back a certificate. That would be simple for clients and easy to wrap in scripts. It also hides the entire security boundary.',
        'A human portal is the older version of the same idea. A person clicks through approval, edits DNS or uploads a file, downloads the certificate, and installs it. That can be audited for a small site, but it does not fit automatic renewal or large fleets.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        {type:'callout', text:'Manual certificate renewal is not just slow — it is a reliability hazard. Every certificate has an expiry date, and every missed renewal is an outage.'},
        'Domain control is specific and temporary. A client may control www.example.com but not api.example.com, and a wildcard certificate needs DNS proof rather than a simple HTTP path. Split-horizon DNS, CDN routing, stale records, and negative caching can make the CA see a different world than the client sees locally.',
        'Issuance is also stateful. Nonces expire, orders move through pending, ready, valid, invalid, and expired states, and authorizations can succeed or fail independently. If those states are hidden, clients cannot retry safely after a timeout or partial failure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/d5/PKI_certificate_hierarchy.svg', alt:'PKI certificate hierarchy', caption:'Public Key Infrastructure certificate chain. Source: Wikimedia Commons, CC BY-SA 4.0'},
        {type:'callout', text:'ACME replaces human proof of domain ownership with machine-verifiable challenges: place a file at a well-known HTTP path, set a DNS TXT record, or respond on a TLS handshake. The CA never trusts the applicant — it trusts the challenge response.'},
        'ACME turns issuance into a resource graph. An account key identifies the client, an order names identifiers, each authorization offers challenges, and each challenge points to public evidence the CA can verify. The certificate depends on all required authorizations and a matching final request.',
        'The second insight is replay resistance. State-changing requests are signed and include server-provided nonces, so an old signed request cannot simply be copied and reused later. Signed messages, resource URLs, and explicit states make the workflow resumable and auditable.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'HTTP protocol logo', caption:'HTTP challenges use well-known paths to prove domain control. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'The client starts with an ACME account key and obtains a fresh nonce. It creates an order for identifiers such as api.example.com and www.example.com. The server returns authorizations, and each authorization lists challenge types the client can satisfy.',
        'For http-01, the client serves a token-derived file from a well-known path on the requested host. For dns-01, it publishes a TXT record under _acme-challenge. For tls-alpn-01, it answers a special TLS handshake. The validation authority checks the evidence from outside the client environment.',
        'When every required authorization becomes valid, the order becomes ready. The client submits a certificate signing request, or CSR, that contains the requested names and public key. The CA checks the CSR against the order, issues the certificate, and usually submits it to Certificate Transparency logs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        {type:'callout', text:'The security of ACME rests on one invariant: only the legitimate domain operator can serve the correct challenge response. DNS, HTTP, and TLS-ALPN challenges each verify this through a different network path.'},
        'The invariant is that issuance waits for valid authorizations. A challenge cannot validate because the client says it is ready; the CA must observe the expected public evidence. The token is tied to the account key, so copying only part of the challenge data is not enough.',
        'The state machine makes failures recoverable. A client can fetch the order, see which authorization is pending, repair the DNS or HTTP proof, and continue without starting from guesswork. Replay protection keeps signed requests fresh while the resource graph keeps progress inspectable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt:'Server infrastructure', caption:'Certificate automation scales from single servers to global fleets. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0'},
        'ACME removes calendar-driven manual work, but it adds automation that must be operated. The system must protect account keys, handle nonces, poll orders, clean challenge records, respect rate limits, deploy certificates, and monitor expiry. A quiet broken renewal job can be worse than manual work because it fails near the deadline.',
        'Challenge choice changes cost. http-01 is simple when public HTTP routing reaches the client, but it cannot issue wildcards and can break behind redirects or private networks. dns-01 handles wildcards and private services, but it requires DNS API credentials, propagation waiting, TTL management, and least-privilege controls.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/84/Lets_Encrypt_logo.svg', alt:'Let\'s Encrypt logo', caption:'Let\'s Encrypt issues over 400 million active certificates using ACME. Source: Wikimedia Commons, Let\'s Encrypt, Public domain'},
        'ACME is used by web servers, CDNs, Kubernetes ingress controllers, service meshes, appliance fleets, internal platforms, and preview environments. It is strongest when domain ownership is clear, credentials are scoped, and deployment can reload certificates safely. The protocol turns renewal into a control-plane action.',
        'The same pattern also supports inventory and compliance. Certificate records can include order URL, identifiers, challenge type, issuer, expiry time, deployment targets, and Certificate Transparency evidence. That makes the fleet searchable before expiry becomes an outage.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ACME proves control at validation time, not permanent ownership or business legitimacy. If a DNS account is compromised, a stale secret can edit records, a dangling CNAME is takeoverable, or an HTTP path is controlled by an attacker, the CA may issue a certificate to the wrong actor under the protocol rules.',
        'It also fails when public observation differs from local tests. Recursive resolvers can cache missing TXT records, authoritative changes can lag, and CDN rules can serve the token in one region but not another. Debugging must ask what the validation authority saw, not what the client machine saw.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A deployment system needs a certificate for api.example.com behind a private load balancer. It creates an ACME order and chooses dns-01 because the CA cannot reach the service over public HTTP. The client publishes a TXT record at _acme-challenge.api.example.com with the expected digest.',
        'DNS has a 60 second TTL, so the client waits 90 seconds before notifying the CA. The validation authority queries authoritative DNS, sees the expected TXT value, and marks the authorization valid. The client submits a CSR for api.example.com, receives the certificate, installs it on 12 load balancer nodes, reloads TLS, and removes the TXT record.',
        'Renewal adds operational numbers. If certificates are renewed 30 days before expiry and the job runs daily, one missed run is harmless, but 25 missed runs creates an incident. The alert should fire on days-to-expiry, failed validation count, and partial deployment count, not only on final expiration.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 8555 for ACME, Let\'s Encrypt challenge-type documentation, and RFC 6962 for Certificate Transparency. Read the protocol state definitions before reading client code because the state machine is the security boundary.',
        'Study next: DNSSEC Chain of Trust Validation for authenticated DNS, DNS Negative Cache and NXDOMAIN for propagation surprises, TLS 1.3 Handshake for where certificates are used, OCSP Stapling Revocation Cache for freshness after issuance, and Transparency Log Witnessing for public auditability.',
      ],
    },
  ],
};
