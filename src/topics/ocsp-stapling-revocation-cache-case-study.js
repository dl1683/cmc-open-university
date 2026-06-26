// OCSP stapling and revocation freshness: signed status responses, server-side
// cache refresh, TLS certificate-status delivery, and fail-open risk.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ocsp-stapling-revocation-cache-case-study',
  title: 'OCSP Stapling Revocation Cache',
  category: 'Security',
  summary: 'How servers cache signed OCSP responses and staple them into TLS handshakes so clients can check certificate status without live per-client CA queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stapled status', 'freshness risk'], defaultValue: 'stapled status' },
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

function ocspGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'cert', label: 'cert', x: 0.7, y: 4.1, note: notes.cert ?? 'leaf' },
      { id: 'certid', label: 'id', x: 2.0, y: 2.4, note: notes.certid ?? 'issuer+serial' },
      { id: 'ocsp', label: 'OCSP', x: 3.4, y: 2.4, note: notes.ocsp ?? 'responder' },
      { id: 'resp', label: 'resp', x: 4.8, y: 4.1, note: notes.resp ?? 'signed' },
      { id: 'cache', label: 'cache', x: 6.2, y: 5.8, note: notes.cache ?? 'server' },
      { id: 'tls', label: 'TLS', x: 7.5, y: 4.1, note: notes.tls ?? 'staple' },
      { id: 'client', label: 'client', x: 8.8, y: 4.1, note: notes.client ?? 'verify' },
      { id: 'time', label: 'time', x: 6.2, y: 2.2, note: notes.time ?? 'nextUpdate' },
      { id: 'verdict', label: 'ok?', x: 9.3, y: 2.4, note: notes.verdict ?? 'status' },
    ],
    edges: [
      { id: 'e-cert-certid', from: 'cert', to: 'certid' },
      { id: 'e-certid-ocsp', from: 'certid', to: 'ocsp' },
      { id: 'e-ocsp-resp', from: 'ocsp', to: 'resp' },
      { id: 'e-resp-cache', from: 'resp', to: 'cache' },
      { id: 'e-cache-tls', from: 'cache', to: 'tls' },
      { id: 'e-tls-client', from: 'tls', to: 'client' },
      { id: 'e-resp-time', from: 'resp', to: 'time' },
      { id: 'e-time-verdict', from: 'time', to: 'verdict' },
      { id: 'e-client-verdict', from: 'client', to: 'verdict' },
    ],
  }, { title });
}

function* stapledStatus() {
  yield {
    state: ocspGraph('Server derives a CertID for the leaf certificate'),
    highlight: { active: ['cert', 'certid', 'ocsp', 'e-cert-certid', 'e-certid-ocsp'], compare: ['resp'] },
    explanation: 'OCSP status is keyed by certificate identity, not by hostname alone. The server derives the issuer-and-serial CertID and can prefetch the CA responder status before clients arrive.',
    invariant: 'Stapling moves the live revocation lookup from every client to the server certificate cache.',
  };

  yield {
    state: ocspGraph('OCSP responder signs a status response with freshness bounds', { resp: 'good', time: 'this/next' }),
    highlight: { active: ['ocsp', 'resp', 'time', 'e-ocsp-resp', 'e-resp-time'], found: ['certid'] },
    explanation: 'The responder signs a status such as good, revoked, or unknown together with freshness fields. thisUpdate says when the answer was produced, and nextUpdate tells the cache when the answer stops being current.',
  };

  yield {
    state: ocspGraph('TLS server caches and staples the signed response', { cache: 'fresh', tls: 'status' }),
    highlight: { active: ['resp', 'cache', 'tls', 'client', 'e-resp-cache', 'e-cache-tls', 'e-tls-client'], compare: ['ocsp'] },
    explanation: 'Stapling moves the signed status into the TLS handshake. The client can check revocation freshness without a separate live query that adds latency and exposes browsing behavior to the responder.',
  };

  yield {
    state: ocspGraph('Client verifies signature, certificate match, and time window', { client: 'checks', verdict: 'accept', time: 'fresh' }),
    highlight: { found: ['client', 'verdict', 'time', 'e-client-verdict', 'e-time-verdict'], active: ['tls'] },
    explanation: 'The client accepts the staple only when the response matches this certificate, chains to an authorized responder, has a valid signature, and is inside the freshness window.',
  };
}

function* freshnessRisk() {
  yield {
    state: labelMatrix(
      'OCSP statuses',
      [
        { id: 'good', label: 'good' },
        { id: 'rev', label: 'revoked' },
        { id: 'unk', label: 'unknown' },
        { id: 'stale', label: 'stale' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'client', label: 'client' },
      ],
      [
        ['ok', 'allow'],
        ['rev', 'block'],
        ['none', 'policy'],
        ['expired', 'policy'],
      ],
    ),
    highlight: { active: ['good:client', 'rev:client'], compare: ['unk:client', 'stale:client'] },
    explanation: 'OCSP status is not a Boolean cache value. Good, revoked, unknown, missing, and stale can trigger different client behavior depending on browser policy, certificate policy, and must-staple requirements.',
    invariant: 'Freshness windows are as important as the status string.',
  };

  yield {
    state: labelMatrix(
      'Staple cache fields',
      [
        { id: 'id', label: 'id' },
        { id: 'sig', label: 'sig' },
        { id: 'this', label: 'thisUp' },
        { id: 'next', label: 'nextUp' },
        { id: 'src', label: 'source' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['match', 'wrong'],
        ['valid', 'forged'],
        ['not fut', 'skew'],
        ['not old', 'stale'],
        ['CA auth', 'bad sig'],
      ],
    ),
    highlight: { active: ['id:check', 'sig:check', 'next:check', 'src:check'], compare: ['next:risk'] },
    explanation: 'The server cache must index by certificate identity and refresh before nextUpdate. A response for the old certificate or an expired freshness window is not a reusable proof.',
  };

  yield {
    state: ocspGraph('Refresh failure turns revocation into an availability decision', { ocsp: 'timeout', cache: 'old', tls: 'maybe', verdict: 'policy' }),
    highlight: { active: ['ocsp', 'cache', 'tls', 'verdict', 'e-resp-cache', 'e-cache-tls', 'e-time-verdict'], compare: ['client'] },
    explanation: 'If the responder is unavailable, the server can keep serving the last valid staple only until it expires. After that, clients hit a policy boundary: fail closed, fail open, or require freshness only when must-staple applies.',
  };

  yield {
    state: labelMatrix(
      'Operational runbook',
      [
        { id: 'prefetch', label: 'fetch' },
        { id: 'renew', label: 'renew' },
        { id: 'alert', label: 'alert' },
        { id: 'rotate', label: 'rotate' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'why', label: 'why' },
      ],
      [
        ['on start', 'warm'],
        ['pre-next', 'fresh'],
        ['near exp', 'avoid'],
        ['new cert', 'new id'],
      ],
    ),
    highlight: { found: ['prefetch:why', 'renew:why', 'alert:why', 'rotate:why'] },
    explanation: 'The complete server-side data structure is a refresh scheduler: fetch at boot, renew before nextUpdate, alert near expiration, and throw away cached staples when the certificate rotates.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stapled status') yield* stapledStatus();
  else if (view === 'freshness risk') yield* freshnessRisk();
  else throw new InputError('Pick an OCSP stapling view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the stapled-status view as a cache freshness trace. The certificate authority signs a status response, the server stores it, and the server sends it with the TLS handshake. Active marks the proof currently being checked. Visited marks a proof that has already passed signature and time-window checks.',
        {type:'callout', text:'OCSP stapling moves revocation from live client lookup to a server-cached signed proof with a strict freshness window.'},
        'OCSP means Online Certificate Status Protocol. It lets a client learn whether a certificate is good, revoked, or unknown. A safe inference rule is this: a server may carry the proof, but only the certificate authority signature and freshness interval make it trustworthy.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A TLS certificate proves that a public key belongs to a name, but certificates can be revoked before their normal expiration. The private key may be stolen, the certificate may have been issued incorrectly, or the owner may no longer control the domain. Clients therefore need revocation status, not just a valid certificate chain.',
        'Live OCSP lookup asks the client to contact the certificate authority responder during connection setup. That adds latency, leaks browsing behavior to the responder, and creates a reliability problem when the responder is slow or unreachable. OCSP stapling moves the lookup to the server ahead of time.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is for every client to ask the OCSP responder whether the certificate is still good. That is direct and easy to reason about. The responder is the authority, so the client gets a signed answer from the party that can know revocation state.',
        'A second simple approach is to ignore revocation unless the certificate has expired. That keeps handshakes fast. It also leaves stolen certificates usable until expiration, which can be months away.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is latency and availability. If every visitor to a large site performs a separate OCSP fetch, the responder becomes part of page load. If the responder fails, browsers must choose between blocking users and accepting a certificate whose status they could not check.',
        'Privacy is another wall. A direct OCSP request can reveal that a client is visiting a site using a particular certificate. Even when transport is protected, the architecture adds a third-party lookup to a connection that otherwise could have stayed between client and server.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to cache a signed revocation proof at the server and staple it to the TLS handshake. The server cannot forge a good status because the response is signed by the certificate authority or delegated responder. The client can verify the signature without calling the responder live.',
        'Freshness is the controlling invariant. The proof is useful only between its thisUpdate and nextUpdate times, and only for the certificate it names. Stapling trades live lookup for a bounded cache window.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Before clients connect, the server asks the OCSP responder for certificate status. It receives a signed response that says good, revoked, or unknown and includes a validity interval. The server stores that response in a cache with a refresh schedule before nextUpdate.',
        'During the TLS handshake, the client advertises support for certificate status in an extension. The server sends its certificate chain and includes the cached OCSP response. The client verifies the certificate chain, verifies the OCSP response signature, checks that the response names the certificate, and checks the time window.',
        'If the response is valid and says good, the client can continue without a live responder fetch. If the response says revoked or fails validation, a strict client should reject the connection. If no staple appears, behavior depends on client policy and certificate features such as Must-Staple.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is delegated proof with a time bound. The server is only a courier for a signed status object. Since the signature covers the certificate identity, status, and validity interval, the server cannot convert revoked into good without breaking the signature check.',
        'The cache is safe only while fresh. A cached good response can hide a new revocation until the response expires, so the mechanism is not instant revocation. Its guarantee is that the client sees a recent authority-signed status without doing its own network lookup.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Stapling changes per-client OCSP lookup into per-server refresh. If a site handles 1,000,000 TLS handshakes per hour and refreshes one response every 4 hours, the responder load drops from 1,000,000 client lookups per hour to a tiny number of server lookups. The handshake still carries extra bytes for the stapled response.',
        'The operational cost is cache management. The server must refresh early enough, survive responder outages, monitor expiration, and serve the right proof for the right certificate. Shorter validity windows reduce stale-good risk but raise refresh pressure and failure sensitivity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'OCSP stapling fits HTTPS sites, load balancers, CDNs, reverse proxies, and enterprise TLS gateways. It is most useful when many clients connect to the same certificate and direct client revocation checks would add latency or responder load.',
        'It also supports privacy goals. The client receives status through the existing TLS connection instead of separately contacting a responder that can observe browsing patterns. For high-volume sites, the server is the better place to amortize revocation lookup.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Stapling fails when the server cache is stale, missing, or attached to the wrong certificate. Some clients soft-fail when no proof is present, so absence of a staple may not stop a connection. Must-Staple can make absence fatal, but then refresh outages become user-visible failures.',
        'It also does not remove the stale-good window. If a certificate is revoked just after a good response is issued, clients may accept that proof until nextUpdate. The mechanism improves live lookup cost and privacy, but it cannot make revocation instantaneous.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a server receives an OCSP response at 10:00 with thisUpdate = 10:00 and nextUpdate = 22:00. It refreshes at 18:00 to leave a 4 hour safety margin. A client connects at 14:30 and receives the stapled response.',
        'The client checks the responder signature, confirms the response is for the site certificate, sees status good, and verifies that 14:30 is between 10:00 and 22:00. No live OCSP request is needed. The client saved one network lookup while still relying on the authority signature.',
        'If the certificate is revoked at 15:00, that 10:00 good response may still validate until 22:00 unless policy says otherwise. If the server fails to refresh and sends the same proof at 22:30, the client should reject it as expired. Freshness is the line between cache and stale evidence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 6960 for OCSP at https://www.rfc-editor.org/rfc/rfc6960, RFC 6066 for the TLS certificate status request extension at https://www.rfc-editor.org/rfc/rfc6066, and RFC 8446 for TLS 1.3 at https://www.rfc-editor.org/rfc/rfc8446.',
        'Next, study certificate chains, CRLs, OCSP Must-Staple, TLS extensions, cache freshness, signed timestamps, CDN certificate management, and browser revocation policy. The reusable lesson is that a cache can carry authority only when signature scope and freshness are checked together.',
      ],
    },
  ],
};
