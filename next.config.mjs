/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Embeds live in a sandboxed iframe, so we never need Next to proxy them.
  // Only our own poster/backdrop images (TMDB CDN) are allowed through <Image>-less <img>.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Popup/ads hygiene: the sandbox attribute is the real defence, these are belt+braces.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'autoplay=(self), fullscreen=(self), picture-in-picture=(self), popup=(self), popups=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
