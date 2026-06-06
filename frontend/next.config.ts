import type { NextConfig } from 'next';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));

function getBackendOrigin() {
  const configuredOrigin = process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, '');
  const isVercelBuild = process.env.VERCEL === '1';

  if (!configuredOrigin) {
    if (isVercelBuild) {
      throw new Error(
        'BACKEND_ORIGIN is required for Vercel deployments. Set it to your Render backend URL, for example https://your-backend.onrender.com.',
      );
    }

    return 'http://localhost:3000';
  }

  let url: URL;
  try {
    url = new URL(configuredOrigin);
  } catch {
    throw new Error(`BACKEND_ORIGIN must be a valid absolute URL. Received: ${configuredOrigin}`);
  }

  const hostname = url.hostname.toLowerCase();
  const pointsToLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  if (isVercelBuild && pointsToLocalhost) {
    throw new Error(
      'BACKEND_ORIGIN cannot point to localhost in Vercel deployments. Set it to your deployed backend URL.',
    );
  }

  return url.origin;
}

const backendOrigin = getBackendOrigin();

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
