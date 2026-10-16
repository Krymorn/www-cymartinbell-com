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

// Copy email address (works even if no mail app is set up)
document.querySelectorAll('[data-copy]').forEach(b => {
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); }
    catch { const r=document.createRange(); const s=document.createElement('span'); s.textContent=b.dataset.copy; document.body.append(s); r.selectNode(s); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); s.remove(); }
    const old=b.textContent; b.textContent='Copied!'; setTimeout(()=>b.textContent=old,1800);
  });
});

// Forms: sent in the background through Web3Forms (emails go to Cy), then show the thanks page.
document.querySelectorAll('.js-form').forEach(form => {
  const status = form.querySelector('.form-status');
  const btn = form.querySelector('[type=submit]');
  const say = (msg, err) => { if (status) { status.textContent = msg; status.classList.toggle('err', !!err); } };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.querySelector('[name=botcheck]')?.checked) return; // spam bot
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'Sending…'; say('');
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || res.status);
      window.location.href = form.dataset.redirect || 'thanks.html';
    } catch {
      say("Sorry, that didn't send. Please email cymartinbell@gmail.com directly.", true);
      btn.disabled = false; btn.textContent = label;
    }
  });
});
