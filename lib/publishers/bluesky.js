// Bluesky publisher — stub for future implementation.
export async function publishToBluesky({ caption, hashtags, imageUrl }) {
  return {
    ok: false,
    platform: 'bluesky',
    error: 'Bluesky publishing not yet implemented — AT Protocol integration pending.',
    stub: true,
  }
}
