// Google Business Profile publisher — stub for future implementation.
export async function publishToGoogleBusinessProfile({ caption, hashtags, imageUrl }) {
  return {
    ok: false,
    platform: 'google_business_profile',
    error: 'Google Business Profile publishing not yet implemented — GMB API integration pending.',
    stub: true,
  }
}
