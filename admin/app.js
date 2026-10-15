// The editor. Screens are built from small pieces so every page uses the same boxes.
import { logout } from './identity.js'

const $ = (sel, root = document) => root.querySelector(sel)

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid))
  return el
}

async function api(url, opts) {
  const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.')
  return data
}

// ---------- state ----------
const state = {
  files: {},          // path -> { sha, content, timer, saving, again }
  screen: 'menu',
  waiting: false,     // draft changes not live yet
  user: null,
}
let statusEl, bannerEl, liveBtn, editorEl, previewFrame, previewPane

function setStatus(text, kind) { statusEl.textContent = text; statusEl.className = 'status ' + (kind || '') }

async function loadFile(path) {
  if (!state.files[path]) {
    const r = await api('/.netlify/functions/content-read?path=' + encodeURIComponent(path))
    state.files[path] = { sha: r.sha, content: r.content }
    if (r.changed) markWaiting(true)
  }
  return state.files[path].content
}

function markWaiting(on) {
  state.waiting = on
  bannerEl.classList.toggle('hidden', !on)
  liveBtn.disabled = !on
}

// ---------- saving ----------
function touch(path) {
  const f = state.files[path]
  clearTimeout(f.timer)
  setStatus('Saving...')
  f.timer = setTimeout(() => saveNow(path), 1200)
  schedulePreview()
}

async function saveNow(path) {
  const f = state.files[path]
  if (f.saving) { f.again = true; return }
  f.saving = true
  try {
    const r = await api('/.netlify/functions/content-save', {
      method: 'POST',
      body: JSON.stringify({ path, content: f.content, sha: f.sha }),
    })
    f.sha = r.sha
    markWaiting(true)
    setStatus('Saved', 'ok')
  } catch (err) {
    setStatus(err.message, 'bad')
  } finally {
    f.saving = false
    if (f.again) { f.again = false; saveNow(path) }
  }
}

async function flushAll() {
  const jobs = []
  for (const [path, f] of Object.entries(state.files)) {
    if (f.timer) { clearTimeout(f.timer); f.timer = null; jobs.push(saveNow(path)) }
  }
  await Promise.all(jobs)
  for (const f of Object.values(state.files)) while (f.saving) await new Promise((r) => setTimeout(r, 100))
}

async function makeLive() {
  liveBtn.disabled = true
  setStatus('Publishing...')
  try {
    await flushAll()
    const r = await api('/.netlify/functions/publish', { method: 'POST' })
    markWaiting(false)
    setStatus(r.nothing ? 'Nothing new to publish' : 'Live! Site updates in about a minute', 'ok')
  } catch (err) {
    liveBtn.disabled = false
    setStatus(err.message, 'bad')
  }
}

// ---------- live preview ----------
let previewTimer = null
let previewPage = 'home'
function schedulePreview() {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(refreshPreview, 450)
}
async function refreshPreview() {
  try {
    const site = await loadFile('content/site.json')
    const body = { pageId: previewPage, site }
    if (state.files['content/pages/' + previewPage + '.json']) body.page = state.files['content/pages/' + previewPage + '.json'].content
    const r = await api('/.netlify/functions/preview', { method: 'POST', body: JSON.stringify(body) })
    const y = previewFrame.contentWindow ? previewFrame.contentWindow.scrollY : 0
    previewFrame.srcdoc = r.html
    previewFrame.addEventListener('load', () => { try { previewFrame.contentWindow.scrollTo(0, y) } catch (e) {} }, { once: true })
  } catch (err) {
    setStatus('Preview problem: ' + err.message, 'bad')
  }
}

// ---------- form pieces ----------
function counter(max, input) {
  const c = h('span', { class: 'count' })
  const upd = () => { const n = input.value.length; c.textContent = n + ' / ' + max; c.classList.toggle('over', n > max) }
  input.addEventListener('input', upd); upd()
  return c
}

function textField(label, value, opts, onChange) {
  const input = h('input', { type: 'text', value: value || '' })
  input.addEventListener('input', () => onChange(input.value))
  return h('div', { class: 'field' }, h('label', {}, label, opts.max ? counter(opts.max, input) : null), input, opts.hint ? h('p', { class: 'hint' }, opts.hint) : null)
}

function switchField(label, value, onChange) {
  const cb = h('input', { type: 'checkbox' })
  cb.checked = !!value
  cb.addEventListener('change', () => onChange(cb.checked))
  return h('div', { class: 'field' }, h('label', { class: 'switch' }, cb, label))
}

// ---------- screens ----------
const SCREENS = {
  menu: { title: 'Menu', render: renderMenu, preview: 'home' },
}

const NAV = [
  ['Pages', [['home', 'Home'], ['services', 'Services'], ['about', 'About'], ['gallery', 'Gallery'], ['contact', 'Contact']]],
  ['Site', [['menu', 'Menu'], ['business', 'Business info']]],
]

function drawNav(nav) {
  nav.textContent = ''
  for (const [group, items] of NAV) {
    nav.append(h('h3', {}, group))
    for (const [id, label] of items) {
      const live = !!SCREENS[id]
      nav.append(h('button', { class: state.screen === id ? 'on' : '', disabled: !live, title: live ? '' : 'Coming soon', onclick: () => go(id) }, label + (live ? '' : '  (soon)')))
    }
  }
}

async function go(id) {
  state.screen = id
  drawNav($('.sidenav'))
  const s = SCREENS[id]
  previewPage = s.preview
  editorEl.textContent = ''
  editorEl.append(h('p', { class: 'lead' }, 'Loading...'))
  try {
    const site = await loadFile('content/site.json')
    editorEl.textContent = ''
    await s.render(editorEl, site)
    refreshPreview()
  } catch (err) {
    editorEl.textContent = ''
    editorEl.append(h('p', { class: 'lead' }, 'Could not load this screen: ' + err.message))
  }
}

function renderMenu(root, site) {
  const m = site.menu
  const changed = () => touch('content/site.json')
  root.append(
    h('h1', {}, 'Menu'),
    h('p', { class: 'lead' }, 'These are the words across the top of every page. Change a word, use the arrows to move it, or switch it off to hide it.'),
  )
  const list = h('div')
  function draw() {
    list.textContent = ''
    m.items.forEach((it, i) => {
      const input = h('input', { type: 'text', value: it.label, maxlength: 18, 'aria-label': 'Menu word' })
      input.addEventListener('input', () => { it.label = input.value; changed() })
      const cb = h('input', { type: 'checkbox', 'aria-label': 'Show in menu' })
      cb.checked = it.show !== false
      const row = h('div', { class: 'menurow' + (cb.checked ? '' : ' off') })
      cb.addEventListener('change', () => { it.show = cb.checked; row.classList.toggle('off', !cb.checked); changed() })
      const move = (d) => { const j = i + d; [m.items[i], m.items[j]] = [m.items[j], m.items[i]]; changed(); draw() }
      row.append(
        h('span', { class: 'arrows' },
          h('button', { type: 'button', disabled: i === 0, title: 'Move up', onclick: () => move(-1) }, '▲'),
          h('button', { type: 'button', disabled: i === m.items.length - 1, title: 'Move down', onclick: () => move(1) }, '▼')),
        input,
        h('label', { class: 'switch' }, cb, 'Show'),
      )
      list.append(row)
    })
  }
  draw()
  root.append(list)
  root.append(h('div', { class: 'group' },
    textField('Words on the header button', m.button.label, { max: 20, hint: 'The red button at the end of the menu.' }, (v) => { m.button.label = v; changed() })))
}

// ---------- start ----------
export function startApp(user) {
  state.user = user
  const app = $('#app')
  app.textContent = ''
  statusEl = h('span', { class: 'status' }, '')
  liveBtn = h('button', { class: 'btn', disabled: true, onclick: makeLive }, 'Make it live')
  const previewToggle = h('button', { class: 'btn plain small togglepreview', onclick: () => previewPane.classList.toggle('show') }, 'Show or hide preview')
  bannerEl = h('div', { class: 'banner hidden' }, 'You have changes that are saved as a draft but are not on the live site yet. Click "Make it live" when you are ready.')
  editorEl = h('main', { class: 'editor' })
  previewFrame = h('iframe', { title: 'Preview of your page' })
  previewPane = h('aside', { class: 'previewpane' }, h('p', { class: 'cap' }, 'Preview. This is how your page will look.'), previewFrame)
  app.append(
    h('header', { class: 'topbar' },
      h('span', { class: 'brand' }, 'Edit your website'),
      statusEl, previewToggle, liveBtn,
      h('button', { class: 'btn plain', onclick: async () => { await logout(); location.reload() } }, 'Log out')),
    bannerEl,
    h('div', { class: 'workspace' }, h('nav', { class: 'sidenav' }), editorEl, previewPane),
  )
  app.classList.remove('hidden')
  document.body.classList.add('app-mode')
  api('/.netlify/functions/status').then((r) => markWaiting(!!r.waiting)).catch(() => {})
  go('menu')
}
