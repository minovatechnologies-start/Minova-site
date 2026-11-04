let initialized = false;

export function initializeSite() {
  if (initialized) return;
  initialized = true;

/* =====================================================================
   GOOGLE SHEETS SETUP - two separate sheets, two separate Apps Scripts
   For EACH sheet: create the Google Sheet, then Extensions > Apps Script,
   paste the matching code below, then Deploy > New deployment > Web app
   (Execute as: Me | Who has access: Anyone). Copy the Web app URL into the
   matching constant. After editing a script later, use Deploy > Manage
   deployments > Edit > New version so the URL stays the same.

   A) AUTH sheet - row 1 headers:
      Timestamp | Action | Full Name | Email | Password Hash
      function doPost(e) {
        var d = JSON.parse(e.postData.contents);
        SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().appendRow(
          [new Date(), d.action, d.fullName, d.email, d.passwordHash || '']);
        return ContentService.createTextOutput('ok');
      }

   B) STUDENT ENROLLMENT sheet - row 1 headers:
      Timestamp | Application Type | Student Name | College | Register Number |
      Phone | Course
      function doPost(e) {
        var d = JSON.parse(e.postData.contents);
        SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().appendRow(
          [new Date(), d.applicationType, d.studentName, d.college,
           d.registerNumber, d.phone, d.course]);
        return ContentService.createTextOutput('ok');
      }
   Update and redeploy the enrollment Apps Script to accept student enrollment fields.
   ===================================================================== */
const AUTH_SHEET_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwUuRX-TgEGtQqSM5acGjcN8PDc0xxqTkS2_5KBvxl7ZNRwwrHTjZHNqHnefOuYZW4h/exec";
const ENROLLMENT_SHEET_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxndlo0mMCect0WA9lXi6CuSdbnkniMg5Dvv4kFKENhWkWfJprCveCvLNoGK0tT8es/exec";
const CONTACT_SHEET_SCRIPT_URL = "YOUR_CONTACT_SHEET_SCRIPT_URL";

const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch {} },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

/* Sends JSON to an Apps Script URL. Returns 'demo' while the URL is still a placeholder. */
async function postToSheet(url, data) {
  if (url.includes('YOUR_')) { console.warn('Sheet URL not set. Data that would be sent:', data); return 'demo'; }
  // text/plain + no-cors avoids the CORS preflight that Apps Script rejects.
  await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
  return 'sent';
}
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* header + footer basics */
$('#burger').onclick = () => {
  const open = $('#nav').classList.toggle('open');
  $('#burger').setAttribute('aria-expanded', open);
};
document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => $('#nav').classList.remove('open')));
$('#yr').textContent = new Date().getFullYear();

/* modals */
let lastFocus;
function openModal(id, focusSel) {
  lastFocus = document.activeElement;
  $(id).classList.add('open');
  if (focusSel) setTimeout(() => $(focusSel).focus(), 150);
}
function closeAll() {
  document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeAll);
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeAll(); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

/* session */
const users = () => store.get('minovaUsers', {});
let session = store.get('minovaSession', null);       // logged-in email
if (session && !users()[session]) { session = null; store.del('minovaSession'); }
const currentUser = () => (session ? users()[session] : null);

function renderAuth() {
  const u = currentUser();
  document.body.classList.toggle('authed', !!u);
  if (u) {
    $('#avatar').textContent = u.name.trim().charAt(0).toUpperCase();
    $('#avatar').setAttribute('aria-label', 'Open profile for ' + u.name);
  }
}
renderAuth();

/* sign up / login */
let mode = 'signup';
const amsg = $('#amsg');
const say = (t, c) => { amsg.textContent = t; amsg.className = 'msg ' + (c || ''); };
function setMode(m) {
  mode = m;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === m));
  $('#nameRow').style.display = m === 'signup' ? '' : 'none';
  $('#atitle').textContent = m === 'signup' ? 'Create your account' : 'Welcome back';
  $('#asub').textContent = m === 'signup' ? 'Sign up first, then log in with the same details.' : 'Log in with your email ID and password.';
  $('#aPass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
  $('#authBtn').textContent = m === 'signup' ? 'Create account' : 'Log in';
  say('');
}
function openAuth(m) { setMode(m); openModal('#authOverlay', m === 'signup' ? '#aName' : '#aEmail'); }
document.querySelectorAll('[data-signup]').forEach(b => b.onclick = e => { e.preventDefault(); openAuth('signup'); });
document.querySelectorAll('[data-login]').forEach(b => b.onclick = e => { e.preventDefault(); openAuth('login'); });
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setMode(b.dataset.tab));

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#aName').value.trim();
  const email = $('#aEmail').value.trim().toLowerCase();
  const pass = $('#aPass').value;
  if (mode === 'signup' && !name) return say('Enter your full name.', 'err');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Enter a valid email ID.', 'err');
  if (pass.length < 6) return say('Password must be at least 6 characters.', 'err');

  const btn = $('#authBtn'); btn.disabled = true; btn.textContent = 'Please wait...';
  try {
    const hash = await sha256(pass), db = users();
    if (mode === 'signup') {
      if (db[email]) return say('This email is already registered. Switch to Login.', 'err');
      db[email] = { name, hash }; store.set('minovaUsers', db);
      const r = await postToSheet(AUTH_SHEET_SCRIPT_URL, { action: 'signup', fullName: name, email, passwordHash: hash });
      e.target.reset(); setMode('login'); $('#aEmail').value = email;
      say('Account created. Now log in.' + (r === 'demo' ? ' (Demo mode: auth sheet URL not set.)' : ''), 'ok');
      $('#aPass').focus();
    } else {
      const u = db[email];
      if (!u || u.hash !== hash) return say('Email or password is incorrect.', 'err');
      session = email; store.set('minovaSession', email);
      await postToSheet(AUTH_SHEET_SCRIPT_URL, { action: 'login', fullName: u.name, email });
      e.target.reset(); renderAuth(); closeAll();
    }
  } catch {
    say('Something went wrong. Check your connection and try again.', 'err');
  } finally {
    btn.disabled = false; btn.textContent = mode === 'signup' ? 'Create account' : 'Log in';
  }
});

/* profile popup */
function openProfile() {
  const u = currentUser();
  if (!u) return openAuth('login');
  $('#pBig').textContent = u.name.trim().charAt(0).toUpperCase();
  $('#pName').textContent = u.name;
  $('#pEmail').textContent = session;
  const list = store.get('minovaEnroll:' + session, []), box = $('#myCourses');
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<span class="empty">No enrollments yet.</span>'; }
  list.forEach(c => { const s = document.createElement('span'); s.className = 'chip'; s.textContent = c; box.appendChild(s); });
  openModal('#profileOverlay');
}
$('#avatar').onclick = openProfile;
document.querySelectorAll('[data-profile]').forEach(b => b.onclick = e => { e.preventDefault(); openProfile(); });
$('#logoutBtn').onclick = () => { session = null; store.del('minovaSession'); renderAuth(); closeAll(); };

/* student course enrollment */
const enrollmentForm = $('#studentEnrollForm');
const enrollmentMsg = $('#enrollmentMsg');
const enrollmentSubmitBtn = $('#studentSubmitBtn');
document.querySelectorAll('[data-course]').forEach(b => b.onclick = () => {
  $('#studentCourse').value = b.dataset.course;
  enrollmentMsg.textContent = '';
  enrollmentMsg.className = 'msg';
  openModal('#enrollmentOverlay', '#studentName');
});

enrollmentForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    applicationType: 'student',
    studentName: $('#studentName').value.trim(),
    college: $('#studentCollege').value.trim(),
    registerNumber: $('#registerNumber').value.trim(),
    phone: $('#studentPhone').value.replace(/[\s-]/g, ''),
    course: $('#studentCourse').value
  };
  if (!data.studentName || !data.college || !data.registerNumber) {
    enrollmentMsg.className = 'msg err';
    enrollmentMsg.textContent = 'Please fill in every field.';
    return;
  }
  if (!data.course) {
    enrollmentMsg.className = 'msg err';
    enrollmentMsg.textContent = 'Select a course or language.';
    return;
  }
  if (!/^[6-9]\d{9}$/.test(data.phone)) {
    enrollmentMsg.className = 'msg err';
    enrollmentMsg.textContent = 'Enter a valid 10-digit mobile number.';
    return;
  }
  enrollmentSubmitBtn.disabled = true;
  enrollmentSubmitBtn.textContent = 'Submitting...';
  try {
    const r = await postToSheet(ENROLLMENT_SHEET_SCRIPT_URL, data);
    enrollmentMsg.className = 'msg ok';
    enrollmentMsg.textContent = 'Application submitted. We will contact you soon.' + (r === 'demo' ? ' (Demo mode: enrollment sheet URL not set.)' : '');
    enrollmentForm.reset();
    setTimeout(closeAll, 1800);
  } catch {
    enrollmentMsg.className = 'msg err';
    enrollmentMsg.textContent = 'Could not submit. Check your connection and try again.';
  } finally {
    enrollmentSubmitBtn.disabled = false;
    enrollmentSubmitBtn.textContent = 'Submit application';
  }
});

/* college contact inquiry */
const contactForm = $('#contactForm');
const contactMsg = $('#contactMsg');
const contactSubmitBtn = $('#contactSubmitBtn');
contactForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (CONTACT_SHEET_SCRIPT_URL.includes('YOUR_')) {
    contactMsg.className = 'msg err';
    contactMsg.textContent = 'The contact form Sheet is not connected yet. Please email minovatechnologies@gmail.com.';
    return;
  }
  const data = {
    applicationType: 'college',
    officialName: $('#contactOfficialName').value.trim(),
    college: $('#contactCollege').value.trim(),
    designation: $('#contactDesignation').value.trim(),
    officialEmail: $('#contactOfficialEmail').value.trim(),
    phone: $('#contactPhone').value.replace(/[\s-]/g, ''),
    course: $('#contactCourse').value,
    message: $('#contactMessage').value.trim()
  };
  if (!data.college || !data.officialName || !data.designation || !data.message) {
    contactMsg.className = 'msg err';
    contactMsg.textContent = 'Please fill in every field.';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.officialEmail)) {
    contactMsg.className = 'msg err';
    contactMsg.textContent = 'Enter a valid official email address.';
    return;
  }
  if (!data.course) {
    contactMsg.className = 'msg err';
    contactMsg.textContent = 'Select a course or language.';
    return;
  }
  if (!/^[6-9]\d{9}$/.test(data.phone)) {
    contactMsg.className = 'msg err';
    contactMsg.textContent = 'Enter a valid 10-digit mobile number.';
    return;
  }
  contactSubmitBtn.disabled = true;
  contactSubmitBtn.textContent = 'Submitting...';
  try {
    await postToSheet(CONTACT_SHEET_SCRIPT_URL, data);
    contactMsg.className = 'msg ok';
    contactMsg.textContent = 'Submitted. We will contact you soon.';
    contactForm.reset();
  } catch {
    contactMsg.className = 'msg err';
    contactMsg.textContent = 'Could not submit. Check your connection and try again.';
  } finally {
    contactSubmitBtn.disabled = false;
    contactSubmitBtn.textContent = 'Submit application';
  }
});

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const revealTargets = document.querySelectorAll(
    '.hero > div:first-child > *, .hero .orb-wrap, main section .sec-head, main section .card, main section .flow .step, main section .steps .step, main section .flow-note, main section .contact-panel, footer'
  );
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.01, rootMargin: '0px' });

  document.body.classList.add('motion-ready');
  revealTargets.forEach(target => {
    target.classList.add('reveal');
    revealObserver.observe(target);
  });
}
}
