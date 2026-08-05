// Mastodon publisher — stub for future implementation.
export async function publishToMastodon({ caption, hashtags, imageUrl }) {
  return {
    ok: false,
    platform: 'mastodon',
    error: 'Mastodon publishing not yet implemented — ActivityPub API integration pending.',
    stub: true,
  }
}
