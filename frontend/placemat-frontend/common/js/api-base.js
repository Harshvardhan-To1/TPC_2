/* ============================================================
   PLACEMAT — api-base.js
   Shared API base resolver for static and integrated modes
============================================================ */

'use strict';

(function initPlacematApiBase() {
  function readStorageValue(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  }

  function isLocalHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  }

  function isPrivateIPv4(hostname) {
    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname || '');
    if (!match) return false;

    const octets = match.slice(1).map(Number);
    if (octets.some(n => Number.isNaN(n) || n < 0 || n > 255)) return false;

    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  function normalizeApiBase(value) {
    if (!value) return '';
    let base = String(value).trim();
    if (!base) return '';
    base = base.replace(/\/+$/, '');

    // Allow passing either origin or full API base.
    if (!/(^|\/)api($|\/)/.test(base)) {
      base = `${base}/api`;
    }
    return base.replace(/\/+$/, '');
  }

  function resolveApiBase() {
    const metaConfigured =
      (typeof document !== 'undefined' && document.querySelector('meta[name="placemat-api-base"]')?.content) || '';
    const globalConfigured = typeof window !== 'undefined' ? window.PLACEMAT_API_BASE || '' : '';
    const storageConfigured = readStorageValue('placemat_api_base');

    const configured = normalizeApiBase(globalConfigured || metaConfigured || storageConfigured);
    if (configured) return configured;

    const { protocol, hostname, port } = window.location;

    if (protocol === 'file:') {
      return 'http://localhost:5000/api';
    }

    // Works when frontend is served separately (e.g. localhost:3000).
    if ((isLocalHost(hostname) || isPrivateIPv4(hostname)) && port !== '5000') {
      return `${protocol}//${hostname}:5000/api`;
    }

    // Default for integrated backend-served frontend.
    return '/api';
  }

  const API_BASE = resolveApiBase();

  function rewriteApiPath(path) {
    if (typeof path !== 'string') return path;
    if (path !== '/api' && !path.startsWith('/api/')) return path;
    if (API_BASE === '/api') return path;
    return `${API_BASE}${path.slice(4)}`;
  }

  function getApiUrl(endpoint) {
    const value = String(endpoint || '');
    if (!value) return API_BASE;

    if (/^https?:\/\//i.test(value)) return value;
    if (value === '/api' || value.startsWith('/api/')) return rewriteApiPath(value);

    const normalized = value.startsWith('/') ? value : `/${value}`;
    if (API_BASE === '/api') return `/api${normalized}`;
    return `${API_BASE}${normalized}`;
  }

  function rewriteApiAnchors() {
    const anchors = document.querySelectorAll('a[href^="/api"]');
    anchors.forEach(anchor => {
      const href = anchor.getAttribute('href');
      if (!href) return;
      anchor.setAttribute('href', rewriteApiPath(href));
    });
  }

  window.PLACEMAT_API_BASE = API_BASE;
  window.getApiUrl = getApiUrl;
  window.rewriteApiPath = rewriteApiPath;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function patchedFetch(resource, init) {
    if (typeof resource === 'string') {
      resource = rewriteApiPath(resource);
    } else if (typeof URL !== 'undefined' && resource instanceof URL) {
      if (resource.origin === window.location.origin) {
        const rewritten = rewriteApiPath(`${resource.pathname}${resource.search}${resource.hash}`);
        if (rewritten !== `${resource.pathname}${resource.search}${resource.hash}`) {
          resource = rewritten;
        }
      }
    } else if (typeof Request !== 'undefined' && resource instanceof Request) {
      try {
        const parsed = new URL(resource.url);
        if (parsed.origin === window.location.origin) {
          const rewritten = rewriteApiPath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
          if (rewritten !== `${parsed.pathname}${parsed.search}${parsed.hash}`) {
            resource = new Request(rewritten, resource);
          }
        }
      } catch {
        // Ignore malformed Request URLs.
      }
    }
    return nativeFetch(resource, init);
  };

  if (typeof window.open === 'function') {
    const nativeOpen = window.open.bind(window);
    window.open = function patchedOpen(url, target, features) {
      const rewritten = typeof url === 'string' ? rewriteApiPath(url) : url;
      return nativeOpen(rewritten, target, features);
    };
  }

  document.addEventListener('DOMContentLoaded', rewriteApiAnchors);
  document.addEventListener(
    'click',
    event => {
      const anchor = event.target?.closest?.('a[href^="/api"]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      anchor.setAttribute('href', rewriteApiPath(href));
    },
    true
  );
})();
