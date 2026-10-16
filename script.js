// Footer year
document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

// Mobile menu
const btn = document.querySelector('.menu-btn');
const links = document.getElementById('nav-links');
if (btn && links) {
  const close = () => { links.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

// "Add photo" placeholder for images not added yet
document.querySelectorAll('.photo img').forEach(img => {
  const mark = () => { img.hidden = true; img.parentElement.classList.add('empty'); };
  if (img.complete && !img.naturalWidth) mark(); else img.addEventListener('error', mark);
});

// Highlight the nav link for the section in view (home page)
const navLinks = [...document.querySelectorAll('.links a[href^="#"]')];
if (navLinks.length && 'IntersectionObserver' in window) {
  const map = new Map(navLinks.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.classList.remove('active'));
        map.get(e.target.id)?.classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

// Lightbox for gallery photos
const box = document.querySelector('.lightbox');
if (box) {
  const big = box.querySelector('img');
  document.querySelectorAll('.zoomable img').forEach(img => {
    img.addEventListener('click', () => {
      if (img.hidden) return;
      big.src = img.currentSrc || img.src; big.alt = img.alt;
      box.hidden = false; document.body.style.overflow = 'hidden';
    });
  });
  const shut = () => { box.hidden = true; document.body.style.overflow = ''; };
  box.addEventListener('click', shut);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) shut(); });
}
