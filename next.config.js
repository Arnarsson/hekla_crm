/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose TinyClaw URL to client-side for SSE connections
  env: {
    NEXT_PUBLIC_TINYCLAW_URL: process.env.TINYCLAW_API_URL || 'http://localhost:3777',
  },
};

module.exports = nextConfig;
