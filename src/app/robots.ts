import type { MetadataRoute } from 'next';

// The admin area and the API are kept out of search engines here as well as
// by their own noindex headers / meta tags.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
    sitemap: 'https://incworx.in/sitemap.xml',
  };
}
