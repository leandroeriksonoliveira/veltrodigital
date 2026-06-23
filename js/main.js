/* ============================================================
   CONTACT INFO (from config.js)
   ============================================================ */
document.querySelectorAll('[data-contact="whatsapp"]').forEach(el => {
  const link = document.createElement('a');
  link.href = getWhatsAppUrl();
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = SITE_CONFIG.whatsappDisplay;
  link.style.color = 'inherit';
  link.style.textDecoration = 'none';
  el.replaceWith(link);
});

document.querySelectorAll('[data-contact="email"]').forEach(el => {
  const email = el.dataset.email || SITE_CONFIG.email;
  const link = document.createElement('a');
  link.href = `mailto:${email}`;
  link.textContent = email;
  link.style.color = 'inherit';
  link.style.textDecoration = 'none';
  el.replaceWith(link);
});

document.querySelectorAll('.wa-social').forEach(el => {
  el.href = getWhatsAppUrl();
  el.target = '_blank';
  el.rel = 'noopener noreferrer';
});

/* Floating WhatsApp button */
const waFloat = document.createElement('a');
waFloat.href = getWhatsAppUrl();
waFloat.target = '_blank';
waFloat.rel = 'noopener noreferrer';
waFloat.className = 'wa-float';
waFloat.setAttribute('aria-label', 'Falar no WhatsApp');
waFloat.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.89-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
document.body.appendChild(waFloat);

/* ============================================================
   NAVBAR SCROLL
   ============================================================ */
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar?.classList.toggle('scrolled', window.scrollY > 40);
});

/* ============================================================
   HAMBURGER MENU
   ============================================================ */
const hamburger = document.querySelector('.hamburger');
const navLinks  = document.querySelector('.nav-links');
const navClose  = document.querySelector('.nav-close');

hamburger?.addEventListener('click', () => {
  navLinks?.classList.add('open');
  document.body.style.overflow = 'hidden';
});

navClose?.addEventListener('click', closeMenu);

function closeMenu() {
  navLinks?.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    if (navLinks?.classList.contains('open')) closeMenu();
  });
});

document.querySelectorAll('.dropdown > a').forEach(a => {
  a.addEventListener('click', e => {
    if (a.getAttribute('href') === '#') e.preventDefault();
    const dd = a.closest('.dropdown');
    const wasOpen = dd.classList.contains('open');
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    if (!wasOpen) dd.classList.add('open');
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
  }
});

document.querySelectorAll('.dropdown-menu a').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    if (navLinks?.classList.contains('open')) closeMenu();
  });
});

/* ============================================================
   SCROLL REVEAL
   ============================================================ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.transitionDelay = `${entry.target.dataset.delay || 0}ms`;
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ============================================================
   FAQ ACCORDION
   ============================================================ */
document.querySelectorAll('.faq-q').forEach(q => {
  q.addEventListener('click', () => {
    const item   = q.parentElement;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

/* ============================================================
   CONTACT FORM → WhatsApp
   ============================================================ */
document.querySelectorAll('.contact-form').forEach(form => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const fields = {};
    form.querySelectorAll('input, select, textarea').forEach(input => {
      const label = input.closest('.form-group')?.querySelector('label')?.textContent;
      if (label && input.value.trim()) fields[label] = input.value.trim();
    });

    const lines = ['Olá! Vim pelo site da Veltro Digital e gostaria de uma consultoria gratuita.', ''];
    Object.entries(fields).forEach(([key, val]) => lines.push(`${key}: ${val}`));

    window.open(getWhatsAppUrl(lines.join('\n')), '_blank', 'noopener,noreferrer');

    const box     = form.closest('.contact-form-box');
    const success = box?.querySelector('.form-success');
    if (success) {
      form.style.display = 'none';
      success.style.display = 'block';
    }
  });
});

/* ============================================================
   SMOOTH ANCHOR SCROLL
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ============================================================
   ACTIVE NAV LINK
   ============================================================ */
const currentPath = window.location.pathname;
document.querySelectorAll('.nav-links a').forEach(a => {
  const href = a.getAttribute('href');
  if (href && currentPath.includes(href) && href !== '/' && href !== 'index.html') {
    a.classList.add('active');
  } else if (
    (currentPath === '/' || currentPath.endsWith('index.html') || currentPath.endsWith('/')) &&
    (href === '/' || href === 'index.html')
  ) {
    a.classList.add('active');
  }
});
