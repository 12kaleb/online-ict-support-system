import type { NextConfig } from 'next';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const backendOrigin = process.env.BACKEND_ORIGIN || 'http://localhost:3000';

const nextConfig: NextConfig = {
  outputFileTracingRoot: appDir,
  devIndicators: {
    appIsrStatus: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendOrigin}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
