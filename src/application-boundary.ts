const roots = ['/admin', '/login', '/register', '/forgot-password', '/shell', '/pdv', '/crm', '/attendance', '/cup-pool'];
const owner = (pathname: string) => roots.find(root => pathname === root || pathname.startsWith(root + '/')) ?? '/';
document.addEventListener('click', event => {
 if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
 const anchor = (event.target instanceof Element ? event.target : null)?.closest('a');
 if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
 const next = new URL(anchor.href, window.location.href);
 if (next.origin === window.location.origin && owner(next.pathname) !== owner(window.location.pathname)) {
  event.preventDefault(); event.stopPropagation(); window.location.assign(next.href);
 }
}, true);
