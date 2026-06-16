// Content Security Policy: nonce and hash based script authorization as a
// browser-side allow graph for code execution.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'content-security-policy-nonce-hash-case-study',
  title: 'CSP Nonce & Hash Policy',
  category: 'Security',
  summary: 'How strict Content Security Policy uses nonces, hashes, script-src, strict-dynamic, reports, and rollout modes to reduce XSS execution.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['nonce flow', 'hash policy'], defaultValue: 'nonce flow' },
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

function cspGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'server', label: 'server', x: 0.8, y: 4.8, note: notes.server ?? 'renders HTML' },
      { id: 'header', label: 'policy', x: 2.5, y: 6.0, note: notes.header ?? 'script-src' },
      { id: 'parser', label: 'parser', x: 4.2, y: 4.8, note: notes.parser ?? 'checks script' },
      { id: 'good', label: 'script', x: 6.0, y: 6.0, note: notes.good ?? 'trusted' },
      { id: 'bad', label: 'inject', x: 6.0, y: 3.6, note: notes.bad ?? 'attacker' },
      { id: 'exec', label: 'exec', x: 8.0, y: 5.8, note: notes.exec ?? 'allowed' },
      { id: 'report', label: 'report', x: 8.0, y: 3.6, note: notes.report ?? 'violation' },
    ],
    edges: [
      { id: 'e-server-header', from: 'server', to: 'header', weight: '' },
      { id: 'e-server-parser', from: 'server', to: 'parser', weight: '' },
      { id: 'e-header-parser', from: 'header', to: 'parser', weight: '' },
      { id: 'e-parser-good', from: 'parser', to: 'good', weight: '' },
      { id: 'e-parser-bad', from: 'parser', to: 'bad', weight: '' },
      { id: 'e-good-exec', from: 'good', to: 'exec', weight: '' },
      { id: 'e-bad-report', from: 'bad', to: 'report', weight: '' },
    ],
  }, { title });
}

function* nonceFlow() {
  yield {
    state: cspGraph('The server emits a fresh nonce and policy', { header: "nonce 'r7'", good: "nonce='r7'", bad: 'no nonce' }),
    highlight: { active: ['server', 'header', 'good', 'e-server-header'], compare: ['bad'] },
    explanation: 'A nonce policy starts on the server. For each response, the server generates a fresh unpredictable nonce, puts it in the Content-Security-Policy header, and attaches it to trusted script elements.',
    invariant: 'A nonce is per response, not a global password.',
  };

  yield {
    state: cspGraph('The parser authorizes the matching script', { header: "nonce 'r7'", parser: 'match', good: 'nonce ok', exec: 'runs' }),
    highlight: { found: ['header', 'parser', 'good', 'exec', 'e-header-parser', 'e-parser-good', 'e-good-exec'] },
    explanation: 'When the browser reaches a script, it checks the policy. If the script carries the exact nonce from the response header, it is allowed to execute.',
  };

  yield {
    state: cspGraph('Injected inline code lacks the nonce and is blocked', { bad: 'onclick=...', report: 'blocked' }),
    highlight: { removed: ['bad', 'e-parser-bad'], active: ['report', 'e-bad-report'], found: ['good'] },
    explanation: 'An attacker who can inject markup does not automatically get execution. Inline handlers, script tags without the nonce, and disallowed sources are blocked and can generate violation reports.',
  };

  yield {
    state: cspGraph('strict-dynamic transfers trust from a nonce script', { good: 'loader', exec: 'loads app', header: 'strict dyn', bad: 'host list' }),
    highlight: { active: ['good', 'exec', 'e-good-exec'], compare: ['bad'], found: ['header'] },
    explanation: 'strict-dynamic lets a nonce- or hash-authorized loader create additional scripts without listing every host. That supports modern bundlers, but it makes the trusted loader a more important security boundary.',
  };

  yield {
    state: labelMatrix(
      'Rollout modes',
      [
        { id: 'report', label: 'report' },
        { id: 'enforce', label: 'enforce' },
        { id: 'legacy', label: 'legacy' },
        { id: 'clean', label: 'clean' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['observe', 'find breaks'],
        ['block', 'reduce XSS'],
        ['allowlist', 'migrate'],
        ['strict', 'least code'],
      ],
    ),
    highlight: { active: ['report:mode'], found: ['enforce:goal', 'clean:mode'], compare: ['legacy:mode'] },
    explanation: 'A safe rollout often starts in Report-Only, fixes real violations, then enforces. The end state is strict enough to block injected execution without breaking intentional scripts.',
  };
}

function* hashPolicy() {
  yield {
    state: cspGraph('A hash policy approves exact script bytes', { server: 'build', header: 'sha256...', good: 'same bytes', parser: 'hash' }),
    highlight: { active: ['server', 'header', 'good', 'e-server-header'], found: ['parser'] },
    explanation: 'A hash policy records a cryptographic hash of an inline script. At parse time, the browser hashes the script content and compares it with the allowed hash in script-src.',
    invariant: 'Hashes authorize exact bytes; nonces authorize selected elements for this response.',
  };

  yield {
    state: cspGraph('Exact bytes match, so execution is allowed', { parser: 'hash match', exec: 'runs', report: 'quiet' }),
    highlight: { found: ['parser', 'good', 'exec', 'e-parser-good', 'e-good-exec'] },
    explanation: 'Hashes fit static inline bootstraps that do not change per response. If the content is exactly the approved content, the script runs without a per-request nonce.',
  };

  yield {
    state: cspGraph('A tiny script change breaks the hash', { good: 'changed', parser: 'hash miss', report: 'blocked' }),
    highlight: { removed: ['good', 'e-good-exec'], active: ['report', 'e-bad-report'], compare: ['header'] },
    explanation: 'The hash is intentionally brittle. A whitespace, build, or injection change means the bytes no longer match, so the browser blocks execution unless the policy is updated.',
  };

  yield {
    state: labelMatrix(
      'Policy choices',
      [
        { id: 'nonce', label: 'nonce' },
        { id: 'hash', label: 'hash' },
        { id: 'host', label: 'host' },
        { id: 'unsafe', label: 'unsafe' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dynamic', 'leak value'],
        ['static', 'brittle'],
        ['external', 'JSONP/CDN'],
        ['legacy', 'XSS runs'],
      ],
    ),
    highlight: { found: ['nonce:fit', 'hash:fit'], compare: ['host:risk'], removed: ['unsafe:risk'] },
    explanation: 'Nonce and hash policies are preferred for strict CSP because they authorize intended code rather than broad locations. Host allowlists are easier to bypass when a trusted host can serve attacker-controlled script.',
  };

  yield {
    state: cspGraph('A complete migration removes inline execution sinks', { server: 'templates', header: 'strict CSP', good: 'boot hash', bad: 'handler', report: 'telemetry' }),
    highlight: { found: ['header', 'good', 'exec'], removed: ['bad'], active: ['report'] },
    explanation: 'The complete case study is a legacy app migration: remove inline event handlers, move dynamic data into JSON script tags or data attributes safely, add nonces or hashes, collect reports, then enforce.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'nonce flow') yield* nonceFlow();
  else if (view === 'hash policy') yield* hashPolicy();
  else throw new InputError('Pick a CSP view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Content Security Policy is a browser-enforced policy that controls which resources a page may load or execute. For XSS mitigation, strict CSP focuses on script execution. Instead of allowing every inline script, the page authorizes intended scripts with a nonce or a hash.',
        'The data structure is a policy table plus a script-authorization graph. Each script candidate is checked against script-src, nonce sources, hash sources, strict-dynamic inheritance, and reporting configuration.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Nonce mode is response-specific. The server creates an unpredictable nonce, includes it in the CSP header, and places it on trusted script tags. The browser allows matching scripts and blocks injected scripts without the nonce.',
        'Hash mode is content-specific. The policy contains hashes of exact inline script bytes. The browser recomputes the hash of each inline script and allows only exact matches. This fits stable bootstraps better than dynamic templates.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A legacy app has inline boot scripts, inline event handlers, third-party widgets, and templated data. The migration starts with Content-Security-Policy-Report-Only, collects violations, replaces inline handlers with addEventListener, moves data out of executable code, adds nonces for dynamic scripts or hashes for stable boot scripts, and only then switches to enforcement.',
        'CSP Nonce & Hash Policy links browser parsing to security policy. DOM Event Propagation & Path explains why inline event handlers are execution sinks. Resource Hints: Preload & Preconnect and HTTP Cache ETag Revalidation explain the adjacent loading and caching controls that should not become script execution bypasses.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A nonce must be unpredictable and fresh per response. Reusing one nonce across pages turns it into a reusable bypass value. Do not put secrets into nonce-bearing scripts that attacker-controlled markup can read through another bug.',
        'A host allowlist is not equivalent to strict CSP. If an allowed host can serve user-controlled JavaScript, JSONP, or compromised third-party code, the host entry may still allow attacker execution. unsafe-inline largely gives up the protection strict CSP is trying to create.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN CSP guide at https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP, MDN script-src at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src, MDN nonce attribute at https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce, W3C CSP Level 3 at https://www.w3.org/TR/CSP3/, and OWASP CSP Cheat Sheet at https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html. Study DOM Event Propagation & Path, Capability Security & Attenuation, OPA Rego Policy Decision Graph, OAuth PKCE Token Lifecycle Case Study, Resource Hints: Preload & Preconnect, HTTP Cache ETag Revalidation, Subresource Integrity Hash Manifest, CORS Preflight Cache, and Permissions Policy Feature Gate next.',
        'Then continue into Trusted Types DOM XSS Sink Guard for the client-side sink boundary CSP cannot express with nonces alone, and Cross-Origin Isolation for the adjacent resource-policy headers that protect powerful browser features.',
      ],
    },
  ],
};
