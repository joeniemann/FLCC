// GET ?path=...  lists past versions of a file.
// POST {path, sha}  puts an old version back into the drafts (nothing goes live until "Make it live").
import { requireEditor, reply, okPath, ensureDraftBranch, readFile, gh, DRAFT, LIVE } from '../lib/core.mts'

export default async (req: Request) => {
  const who = await requireEditor()
  if (who.error) return who.error
  try {
    if (req.method === 'GET') {
      const path = new URL(req.url).searchParams.get('path')
      if (!okPath(path)) return reply({ error: 'That file is not editable.' }, 400)
      const r = await gh('/commits?sha=' + encodeURIComponent(LIVE) + '&path=' + encodeURIComponent(path) + '&per_page=20')
      if (r.status !== 200) return reply({ error: 'Could not load history (' + r.status + ').' }, 500)
      const list = (await r.json()).map((c: any) => ({ sha: c.sha, when: c.commit.committer.date, message: c.commit.message.split('\n')[0] }))
      return reply({ versions: list })
    }
    if (req.method === 'POST') {
      const { path, sha } = await req.json()
      if (!okPath(path) || typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) return reply({ error: 'Bad request.' }, 400)
      await ensureDraftBranch()
      const old = await readFile(path, LIVE, sha)
      const cur = await readFile(path, DRAFT)
      if (!old) return reply({ error: 'That version was not found.' }, 404)
      const r = await gh('/contents/' + path, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'Draft: put back an older version of ' + path + ' (' + who.user!.email + ')',
          content: Buffer.from(old.text, 'utf8').toString('base64'),
          branch: DRAFT,
          sha: cur ? cur.sha : undefined,
        }),
      })
      if (r.status !== 200 && r.status !== 201) return reply({ error: 'Could not put it back (' + r.status + ').' }, 500)
      return reply({ ok: true })
    }
    return reply({ error: 'Use GET or POST.' }, 405)
  } catch (e: any) {
    return reply({ error: e.message }, 500)
  }
}
