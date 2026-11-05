/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Default `.next`. The end-to-end suite builds into its own directory so it
  // can never collide with a running `next dev`, which also writes to `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  compiler: {
    // Enables styled-components SSR, better class names & minification
    styledComponents: true,
  },
  eslint: {
    // Lint the scripts and tests too, not only src/.
    dirs: ['src', 'scripts', 'tests'],
  },
  async headers() {
    return [
      {
        // The admin area: never indexed, never framed (clickjacking), never
        // leaks its URLs to other sites through the Referer header.
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
