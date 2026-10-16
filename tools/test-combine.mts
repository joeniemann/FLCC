// Tests the clash-combining logic with a tiny pretend GitHub. Run: node tools/test-combine.mts
import assert from 'node:assert/strict'
import { mergeJson, combine } from '../netlify/lib/combine.mts'

// ---- mergeJson ----
const base = { callBand: { headline: 'Ready?', primary: { label: 'Call', show: true }, secondary: { label: 'Quote', show: true } }, business: { phone: '1' } }
const live = { callBand: { headline: 'Ready?', primary: { label: 'Call', show: true, style: 'solid' }, secondary: { label: 'Quote', show: true } }, business: { phone: '1' } }
const mine = { callBand: { headline: 'Let us talk', primary: { label: 'Contact Us', show: true }, secondary: { label: 'Quote', show: false } }, business: { phone: '1' } }
const ov: string[] = []
const m = mergeJson(base, live, mine, ov)
assert.equal(m.callBand.headline, 'Let us talk')           // only mine changed
assert.equal(m.callBand.primary.label, 'Contact Us')       // only mine changed
assert.equal(m.callBand.primary.style, 'solid')            // only live changed, kept
assert.equal(m.callBand.secondary.show, false)             // only mine changed
assert.deepEqual(ov, [])                                   // no same-setting overlap
const ov2: string[] = []
const m2 = mergeJson({ a: 1 }, { a: 2 }, { a: 3 }, ov2, 'x')
assert.equal(m2.a, 3); assert.deepEqual(ov2, ['x.a'])      // both changed: editor wins
assert.deepEqual(mergeJson({ l: [1] }, { l: [1, 2] }, { l: [1] }), { l: [1, 2] })
assert.deepEqual(mergeJson({ l: [1] }, { l: [1, 2] }, { l: [9] }), { l: [9] })
assert.deepEqual(mergeJson({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2 }), { a: 1 })   // live deleted b, editor left it
assert.deepEqual(mergeJson({ a: 1 }, { a: 1, n: 5 }, { a: 1, k: 6 }), { a: 1, k: 6, n: 5 })

// ---- a pretend GitHub ----
type C = { sha: string; parents: string[]; files: Record<string, string> }
function fake() {
  const commits: Record<string, C> = {}
  const refs: Record<string, string> = {}
  const trees: Record<string, Record<string, string>> = {}
  const blobs: Record<string, string> = {}
  let n = 0
  const id = (p: string) => p + String(++n).padStart(4, '0')
  const blobOf = (text: string) => { const s = 'b' + Buffer.from(text).toString('hex').slice(0, 30) + text.length; blobs[s] = text; return s }
  const mk = (parents: string[], files: Record<string, string>) => { const sha = id('c'); commits[sha] = { sha, parents, files }; return sha }
  const anc = (s: string): Set<string> => { const out = new Set<string>(); const st = [s]; while (st.length) { const x = st.pop()!; if (out.has(x)) continue; out.add(x); st.push(...commits[x].parents) } return out }
  const baseOf = (a: string, b: string) => { const A = anc(a); const q = [b]; const seen = new Set<string>(); while (q.length) { const x = q.shift()!; if (A.has(x)) return x; if (seen.has(x)) continue; seen.add(x); q.push(...commits[x].parents) } throw new Error('no base') }
  const diff = (a: string, b: string) => {
    const A = commits[a].files, B = commits[b].files, out: any[] = []
    for (const p of new Set([...Object.keys(A), ...Object.keys(B)])) {
      if (A[p] === B[p]) continue
      out.push({ filename: p, status: !(p in B) ? 'removed' : !(p in A) ? 'added' : 'modified', sha: p in B ? blobOf(B[p]) : 'x' })
    }
    return out
  }
  const res = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s })
  const gh = async (path: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(init.body as string) : null
    let m: RegExpExecArray | null
    if ((m = /^\/git\/ref\/heads\/(.+)$/.exec(path))) return res({ object: { sha: refs[m[1]] } })
    if ((m = /^\/compare\/([^.]+)\.\.\.([^?]+)(\?.*)?$/.exec(path))) {
      const base = baseOf(m[1], m[2]); const files = diff(base, m[2])
      const page = Number(/[?&]page=(\d+)/.exec(path)?.[1] || 1)
      return res({ merge_base_commit: { sha: base }, files: files.slice((page - 1) * 100, page * 100) })
    }
    if ((m = /^\/contents\/([^?]+)\?ref=(.+)$/.exec(path))) {
      const ref = decodeURIComponent(m[2]); const sha = refs[ref] || ref; const t = commits[sha].files[m[1]]
      return t == null ? res({}, 404) : res({ content: Buffer.from(t).toString('base64') })
    }
    if (path === '/git/blobs') { const t = Buffer.from(body.content, 'base64').toString('utf8'); return res({ sha: blobOf(t) }, 201) }
    if ((m = /^\/git\/commits\/(.+)$/.exec(path))) { trees[commits[m[1]].sha] = commits[m[1]].files; return res({ tree: { sha: m[1] } }) }
    if (path === '/git/trees') {
      const files = { ...commits[body.base_tree].files }
      for (const e of body.tree) { if (e.sha === null) delete files[e.path]; else files[e.path] = blobs[e.sha] }
      const t = id('t'); trees[t] = files; return res({ sha: t }, 201)
    }
    if (path === '/git/commits') { return res({ sha: mk(body.parents, trees[body.tree]) }, 201) }
    if ((m = /^\/git\/refs\/heads\/(.+)$/.exec(path)) && init.method === 'PATCH') {
      assert.ok(anc(body.sha).has(refs[m[1]])); refs[m[1]] = body.sha; return res({})
    }
    throw new Error('fake: ' + path)
  }
  return { commits, refs, mk, gh, anc }
}
const okPath = (p: any) => /^content\/(site|photos|gallery)\.json$|^content\/pages\/[a-z0-9-]+\.json$/.test(p)
const deps = (g: any) => ({ gh: g.gh, okPath, problemWith: (p: string, t: string) => { try { JSON.parse(t); return null } catch { return 'bad json' } }, LIVE: 'main', DRAFT: 'drafts' })
const J = (o: any) => JSON.stringify(o, null, 2) + '\n'

// Scenario: both branches edit site.json (the callBand), live also changes code, drafts also adds a page and a photo.
{
  const g = fake()
  const root = g.mk([], { 'content/site.json': J(base), 'content/pages/home.json': J({ t: 1 }), 'admin/app.js': 'v1', 'assets/g1.webp': 'img1' })
  g.refs.main = g.mk([root], { 'content/site.json': J(live), 'content/pages/home.json': J({ t: 1 }), 'admin/app.js': 'v2', 'assets/g1.webp': 'img1' })
  g.refs.drafts = g.mk([root], { 'content/site.json': J(mine), 'content/pages/home.json': J({ t: 1 }), 'content/pages/new.json': J({ t: 9 }), 'admin/app.js': 'v1', 'assets/g1.webp': 'img1', 'assets/g2.webp': 'img2' })
  const r = await combine(deps(g), 'joe@x')
  assert.equal(r.combined, true)
  const out = g.commits[g.refs.drafts]
  assert.deepEqual(out.parents.length, 2)
  assert.ok(g.anc(g.refs.drafts).has(g.refs.main))                    // drafts now contain live, so publishing is clean
  assert.equal(out.files['admin/app.js'], 'v2')                       // live's code kept
  assert.equal(out.files['assets/g2.webp'], 'img2')                   // editor's photo kept
  assert.ok(out.files['content/pages/new.json'])                      // editor's new page kept
  const site = JSON.parse(out.files['content/site.json'])
  assert.equal(site.callBand.headline, 'Let us talk')                 // editor's words
  assert.equal(site.callBand.primary.style, 'solid')                  // live's change kept
}
// Scenario: editor deleted a page that live also edited; and a bad merge result is refused.
{
  const g = fake()
  const root = g.mk([], { 'content/pages/x.json': J({ a: 1 }), 'content/site.json': J({ a: 1 }) })
  g.refs.main = g.mk([root], { 'content/pages/x.json': J({ a: 2 }), 'content/site.json': J({ a: 2 }) })
  g.refs.drafts = g.mk([root], { 'content/site.json': J({ a: 3 }) })
  await combine(deps(g), 'joe@x')
  assert.equal(g.commits[g.refs.drafts].files['content/pages/x.json'], undefined)   // editor's delete wins
  assert.equal(JSON.parse(g.commits[g.refs.drafts].files['content/site.json']).a, 3)
}
{
  const g = fake()
  const root = g.mk([], { 'content/site.json': J({ a: 1 }) })
  g.refs.main = g.mk([root], { 'content/site.json': J({ a: 2 }) })
  g.refs.drafts = g.mk([root], { 'content/site.json': J({ a: 3 }) })
  const d = deps(g); d.problemWith = () => 'nope'
  await assert.rejects(() => combine(d, 'joe@x'), /Could not combine content\/site.json: nope/)
  assert.equal(g.commits[g.refs.drafts].parents.length, 1)            // nothing changed
}
console.log('all combine tests passed')
