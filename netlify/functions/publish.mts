// "Make it live": merges the drafts branch into the live branch. Netlify then rebuilds the site.
import { requireEditor, reply, ensureDraftBranch, gh, DRAFT, LIVE } from '../lib/core.mts'

export default async (req: Request) => {
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405)
  const who = await requireEditor()
  if (who.error) return who.error
  try {
    await ensureDraftBranch()
    const r = await gh('/merges', {
      method: 'POST',
      body: JSON.stringify({ base: LIVE, head: DRAFT, commit_message: 'Make it live (' + who.user!.email + ')' }),
    })
    if (r.status === 204) return reply({ ok: true, nothing: true })
    if (r.status === 201) return reply({ ok: true })
    if (r.status === 409) return reply({ error: 'The live site changed in a way that clashes with your edits. Ask Joe to sort it out.' }, 409)
    return reply({ error: 'Could not publish (' + r.status + ').' }, 500)
  } catch (e: any) {
    return reply({ error: e.message }, 500)
  }
}
