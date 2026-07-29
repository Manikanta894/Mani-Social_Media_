// Hashnode blog publisher — pushes to insights.manikantar.in via Hashnode API.
// Uses HASHNODE_API_KEY env var.

export async function publishToHashnode({ title, bodyMarkdown, seoDescription, coverImageUrl, slug, dryRun = false }) {
  const apiKey = process.env.HASHNODE_API_KEY
  const host = 'insights.manikantar.in'
  if (!apiKey) throw new Error('Hashnode not configured — set HASHNODE_API_KEY in .env')

  if (dryRun) {
    return {
      platform: 'hashnode',
      dry_run: true,
      preview: { title, body_markdown_preview: bodyMarkdown.slice(0, 200), slug, host },
    }
  }

  const query = `mutation PublishPost($input: PublishPostInput!) {
    publishPost(input: $input) {
      post {
        id
        title
        slug
        url
        publishedAt
      }
    }
  }`

  const variables = {
    input: {
      title,
      contentMarkdown: bodyMarkdown,
      ...(seoDescription ? { seo: { description: seoDescription } } : {}),
      ...(coverImageUrl ? { coverImageURL: coverImageUrl } : {}),
      ...(slug ? { slug } : {}),
      publicationId: host, // or use host-based lookup
    },
  }

  // Add host-based publication slug
  variables.input.publicationHost = host

  const res = await fetch('https://gql.hashnode.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })
  const raw = await res.text()
  if (!res.ok) throw new Error(`Hashnode ${res.status}: ${raw.slice(0, 400)}`)
  let data
  try { data = JSON.parse(raw) } catch { throw new Error(`Hashnode bad JSON: ${raw.slice(0, 300)}`) }
  if (data.errors) throw new Error(`Hashnode GraphQL errors: ${data.errors.map(e => e.message).join('; ')}`)
  const post = data?.data?.publishPost?.post
  if (!post) throw new Error(`Hashnode unexpected response: ${raw.slice(0, 300)}`)

  return {
    platform: 'hashnode',
    post_id: post.id,
    url: post.url,
    slug: post.slug,
    published_at: post.publishedAt,
  }
}
