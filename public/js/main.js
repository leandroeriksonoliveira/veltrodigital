/* ============================================================
   LEGAL / LOCALE HELPERS
   ============================================================ */
function resolvePublicPath(fileName) {
  const path = window.location.pathname.replace(/\\/g, '/');
  if (/\/en\/solutions\//.test(path)) return `../../${fileName}`;
  if (/\/solucoes\//.test(path) || /\/en\//.test(path)) return `../${fileName}`;
  return fileName;
}

/* ============================================================
   SKIP LINK + ACCESSIBILITY TOOLBAR
   ============================================================ */
(function initAccessibility() {
  const i18n = getSiteLocale() === 'en'
    ? {
        skip: 'Skip to main content',
        panelLabel: 'Accessibility tools',
        toggle: 'Accessibility',
        fontUp: 'Larger text',
        fontDown: 'Smaller text',
        contrast: 'High contrast',
        reset: 'Reset',
      }
    : {
        skip: 'Ir para o conteúdo principal',
        panelLabel: 'Recursos de acessibilidade',
        toggle: 'Acessibilidade',
        fontUp: 'Aumentar fonte',
        fontDown: 'Diminuir fonte',
        contrast: 'Alto contraste',
        reset: 'Resetar',
      };

  if (!document.getElementById('main-content')) {
    const mainCandidate =
      document.querySelector('main') ||
      document.querySelector('section.hero') ||
      document.querySelector('section') ||
      document.querySelector('.hero');
    if (mainCandidate && !mainCandidate.id) mainCandidate.id = 'main-content';
  }

  if (!document.querySelector('.skip-link')) {
    const skip = document.createElement('a');
    skip.href = '#main-content';
    skip.className = 'skip-link';
    skip.textContent = i18n.skip;
    document.body.prepend(skip);
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'a11y-toolbar';
  toolbar.setAttribute('role', 'region');
  toolbar.setAttribute('aria-label', i18n.panelLabel);
  toolbar.innerHTML = `
    <button type="button" class="a11y-toggle" aria-expanded="false" aria-controls="a11y-panel" title="${i18n.toggle}">
      <span aria-hidden="true">♿</span><span class="a11y-toggle-label">${i18n.toggle}</span>
    </button>
    <div id="a11y-panel" class="a11y-panel" hidden>
      <button type="button" data-a11y="font-up">${i18n.fontUp}</button>
      <button type="button" data-a11y="font-down">${i18n.fontDown}</button>
      <button type="button" data-a11y="contrast">${i18n.contrast}</button>
      <button type="button" data-a11y="reset">${i18n.reset}</button>
    </div>
  `;
  document.body.appendChild(toolbar);

  const toggle = toolbar.querySelector('.a11y-toggle');
  const panel = toolbar.querySelector('#a11y-panel');
  toggle?.addEventListener('click', () => {
    const open = panel.hasAttribute('hidden');
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  const applyFont = (delta) => {
    const root = document.documentElement;
    const current = parseFloat(getComputedStyle(root).fontSize) || 16;
    root.style.fontSize = `${Math.min(22, Math.max(14, current + delta))}px`;
  };

  toolbar.querySelectorAll('[data-a11y]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-a11y');
      if (action === 'font-up') applyFont(1);
      if (action === 'font-down') applyFont(-1);
      if (action === 'contrast') document.body.classList.toggle('a11y-contrast');
      if (action === 'reset') {
        document.documentElement.style.fontSize = '';
        document.body.classList.remove('a11y-contrast');
      }
    });
  });
})();

/* ============================================================
   COOKIE BANNER (accept / reject non-essential)
   ============================================================ */
(function initCookieBanner() {
  const KEY = 'veltro_cookie_consent';
  const i18n = getSiteLocale() === 'en'
    ? {
        title: 'Cookies and privacy',
        text: 'We use essential cookies to run this site. Non-essential cookies (analytics or marketing) are only activated after your consent. You can accept or refuse non-essential cookies.',
        accept: 'Accept',
        reject: 'Refuse',
        policy: 'Privacy Policy',
        cookies: 'Cookie Policy',
      }
    : {
        title: 'Cookies e privacidade',
        text: 'Utilizamos cookies essenciais para o funcionamento do site. Cookies não essenciais (analytics ou marketing) só são ativados com o seu consentimento. Você pode aceitar ou recusar cookies não essenciais.',
        accept: 'Aceitar',
        reject: 'Recusar',
        policy: 'Política de Privacidade',
        cookies: 'Política de Cookies',
      };

  const privacyHref = resolvePublicPath('politica-de-privacidade.html');
  const cookiesHref = resolvePublicPath('politica-de-cookies.html');

  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-live', 'polite');
  banner.setAttribute('aria-label', i18n.title);
  banner.innerHTML = `
    <div class="cookie-banner-inner">
      <div class="cookie-banner-copy">
        <strong class="cookie-banner-title">${i18n.title}</strong>
        <p class="cookie-banner-text">${i18n.text}
          <a href="${privacyHref}">${i18n.policy}</a> ·
          <a href="${cookiesHref}">${i18n.cookies}</a>
        </p>
      </div>
      <div class="cookie-banner-actions">
        <button type="button" class="btn btn-outline cookie-reject" data-cookie="reject">${i18n.reject}</button>
        <button type="button" class="btn btn-primary cookie-accept" data-cookie="accept">${i18n.accept}</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  const saved = localStorage.getItem(KEY);
  if (saved === 'accepted' || saved === 'rejected') {
    banner.hidden = true;
    banner.setAttribute('data-consent', saved);
  } else {
    banner.hidden = false;
    banner.setAttribute('data-consent', 'pending');
  }

  const setConsent = (value) => {
    localStorage.setItem(KEY, value);
    banner.setAttribute('data-consent', value);
    banner.hidden = true;
    window.dispatchEvent(new CustomEvent('veltro:cookie-consent', { detail: { value } }));
  };

  banner.querySelector('[data-cookie="accept"]')?.addEventListener('click', () => setConsent('accepted'));
  banner.querySelector('[data-cookie="reject"]')?.addEventListener('click', () => setConsent('rejected'));

  // Block non-essential third-party scripts until consent (opt-in)
  window.veltroCanLoadNonEssential = () => localStorage.getItem(KEY) === 'accepted';
})();

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

document.querySelectorAll('[data-footer-legal]').forEach(el => {
  const c = SITE_CONFIG;
  const i18n = SITE_I18N[getSiteLocale()];
  let text = `© ${new Date().getFullYear()} ${c.legalName} · ${c.legalResponsible}. ${i18n.footerRights}`;
  if (c.cnpj) text += ` CNPJ: ${c.cnpj}.`;
  if (c.legalAddress) text += ` ${c.legalAddress}.`;
  el.textContent = text;
});

document.querySelectorAll('[data-footer-dpo]').forEach(el => {
  if (!SITE_CONFIG.dpoEmail) return;
  const i18n = SITE_I18N[getSiteLocale()];
  el.innerHTML = `${i18n.dpoLabel} <a href="mailto:${SITE_CONFIG.dpoEmail}">${SITE_CONFIG.dpoEmail}</a>`;
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
      if (input.dataset.formExclude !== undefined || input.type === 'checkbox') return;
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
