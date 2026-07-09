import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-pg',
    '@prisma/adapter-libsql',
    '@libsql/client',
    'cloudinary',
    'pg',
  ],
  // Allow phone/tablet access over local network (hotspot & Wi-Fi)
  allowedDevOrigins: [
    '192.168.137.1',
    '11.220.1.98',
    'localhost',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '192.168.137.1' },
      { protocol: 'http', hostname: '11.220.1.98' },
    ],
  },
};

export default nextConfig;
