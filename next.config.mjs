/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === 'development';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  isDevelopment
    ? "connect-src 'self' http: https: ws: wss:"
    : "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests"
].join('; ');

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'mipc.ac.rw' },
      { protocol: 'https', hostname: 'www.kigalitoday.com' },
      { protocol: 'https', hostname: 'karibumedia.rw' },
      { protocol: 'https', hostname: 'mamaurwagasabo.rw' }
    ],
    formats: ['image/avif', 'image/webp']
  },
  experimental: {
    serverActions: { bodySizeLimit: '128kb' }
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/campus-front.webp', destination: '/api/campus-photo?name=hero' },
        { source: '/campus-side.webp', destination: '/api/campus-photo?name=campus' },
        { source: '/leadership-community.webp', destination: '/api/campus-photo?name=community' }
      ],
      afterFiles: [],
      fallback: []
    };
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
      ]
    }];
  }
};

export default nextConfig;
