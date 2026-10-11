// Keep this gateway route map aligned with infra/Caddyfile in each standalone app.
const routes = [
 ['auth', ['/login', '/register', '/forgot-password']],
 ['admin', ['/admin']],
 ['shell', ['/shell']],
 ['pdv', ['/pdv']],
 ['crm', ['/crm']],
 ['attendance', ['/attendance']],
 ['cup-pool', ['/cup-pool']],
] as const;
const owner = (pathname: string) =>
 routes.find(([, roots]) => roots.some(root => pathname === root || pathname.startsWith(root + '/')))?.[0] ?? 'delivery';
const loadedOwner = owner(window.location.pathname);

// Programmatic navigation must request the destination app from the gateway,
// including redirects performed by React Router's <Navigate>.
for (const method of ['pushState', 'replaceState'] as const) {
 const original = window.history[method].bind(window.history);
 window.history[method] = (data: unknown, unused: string, url?: string | URL | null) => {
  if (url != null) {
   const next = new URL(url, window.location.href);
   if (next.origin === window.location.origin && owner(next.pathname) !== loadedOwner) {
    if (method === 'replaceState') window.location.replace(next.href);
    else window.location.assign(next.href);
    return;
   }
  }
  original(data, unused, url);
 };
}

// Recover history entries created by older versions using SPA navigation.
window.addEventListener('popstate', () => {
 if (owner(window.location.pathname) !== loadedOwner) window.location.reload();
});
document.addEventListener('click', event => {
 if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
 const anchor = (event.target instanceof Element ? event.target : null)?.closest<HTMLAnchorElement>('a[href]');
 if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
 const next = new URL(anchor.href, window.location.href);
 if (next.origin === window.location.origin && owner(next.pathname) !== owner(window.location.pathname)) {
  event.preventDefault(); event.stopPropagation(); window.location.assign(next.href);
 }
}, true);
