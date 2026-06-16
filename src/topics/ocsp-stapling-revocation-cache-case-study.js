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
    explanation: 'OCSP asks about a certificate by issuer identity and serial number. The server can prefetch that status from the CA responder before clients arrive.',
    invariant: 'Stapling moves the live revocation lookup from every client to the server certificate cache.',
  };

  yield {
    state: ocspGraph('OCSP responder signs a status response with freshness bounds', { resp: 'good', time: 'this/next' }),
    highlight: { active: ['ocsp', 'resp', 'time', 'e-ocsp-resp', 'e-resp-time'], found: ['certid'] },
    explanation: 'The OCSP response says good, revoked, or unknown and includes freshness fields such as thisUpdate and nextUpdate. The response is signed by an authorized responder.',
  };

  yield {
    state: ocspGraph('TLS server caches and staples the signed response', { cache: 'fresh', tls: 'status' }),
    highlight: { active: ['resp', 'cache', 'tls', 'client', 'e-resp-cache', 'e-cache-tls', 'e-tls-client'], compare: ['ocsp'] },
    explanation: 'With stapling, the server sends the cached OCSP response during the TLS handshake. The client avoids a separate OCSP network request that would add latency and leak browsing behavior to the responder.',
  };

  yield {
    state: ocspGraph('Client verifies signature, certificate match, and time window', { client: 'checks', verdict: 'accept', time: 'fresh' }),
    highlight: { found: ['client', 'verdict', 'time', 'e-client-verdict', 'e-time-verdict'], active: ['tls'] },
    explanation: 'The client accepts the staple only if it matches the certificate, chains to an authorized responder, has a valid signature, and is inside the allowed freshness interval.',
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
    explanation: 'OCSP status is not a Boolean cache value. Good, revoked, unknown, and stale produce different client behavior depending on browser policy, certificate policy, and whether stapling is required.',
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
    explanation: 'A server cache should index OCSP responses by certificate identity and refresh before nextUpdate. A stale or mismatched staple can be as disruptive as a missing certificate.',
  };

  yield {
    state: ocspGraph('Refresh failure turns revocation into an availability decision', { ocsp: 'timeout', cache: 'old', tls: 'maybe', verdict: 'policy' }),
    highlight: { active: ['ocsp', 'cache', 'tls', 'verdict', 'e-resp-cache', 'e-cache-tls', 'e-time-verdict'], compare: ['client'] },
    explanation: 'If the responder is unavailable, the server may keep serving the last valid staple until it expires. After that, clients face a policy choice: fail closed, fail open, or require a fresh staple only for certificates with a must-staple signal.',
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
      heading: 'What it is',
      paragraphs: [
        'OCSP lets a client ask whether a certificate is good, revoked, or unknown. OCSP stapling lets the TLS server prefetch a signed OCSP response from the CA responder and include, or staple, that response in the TLS handshake.',
        'RFC 6960 defines OCSP at https://www.rfc-editor.org/rfc/rfc6960. RFC 6066 defines TLS extensions including the certificate status request used for stapling at https://www.rfc-editor.org/rfc/rfc6066. TLS 1.3 is defined in RFC 8446 at https://www.rfc-editor.org/rfc/rfc8446.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'The server maintains a revocation cache keyed by certificate identity: issuer-name hash, issuer-key hash, serial number, responder URL, signed response bytes, status, thisUpdate, nextUpdate, signer identity, and refresh state. The TLS handshake reads from that cache and sends the response if it is fresh.',
        'The client treats the staple as a signed object. It checks that the response matches the certificate, was signed by an authorized responder, is currently fresh, and says a status compatible with policy.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A web server starts with a new certificate. It computes the CertID, asks the CA OCSP responder for status, receives a signed "good" response with thisUpdate and nextUpdate, and stores it. During each TLS handshake, it staples that response. The browser validates the certificate chain and the OCSP response without making a separate network call to the CA.',
        'Before nextUpdate, the server refreshes the cache. If the certificate rotates, the old response is discarded because the CertID changed. If refresh repeatedly fails, alerting must fire before clients start seeing stale or missing staples.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A "good" OCSP response does not prove the certificate is good forever. It means the responder did not report it revoked for that certificate at the response time and within the freshness bounds. Revocation is only useful if clients enforce freshness and servers refresh before expiry.',
        'Live per-client OCSP checks have privacy and latency costs, while stapling has freshness and operations costs. Many clients also have fail-open behavior in some network-failure cases, so revocation cannot be treated as a perfect kill switch.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study TLS 1.3 Handshake for where the staple appears, ACME Order Challenge Certificate Issuance for how certificates are obtained, Transparency Log Witnessing Case Study for certificate visibility, Cache Invalidation & Versioning for freshness mechanics, and TUF Update Metadata Case Study for another security protocol built around signed metadata expiration.',
      ],
    },
  ],
};
