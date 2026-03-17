/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Harden Image Optimizer: no external domains allowed (mitigates GHSA-9g9p)
  images: {
    remotePatterns: [],
  },

  // Optimize bundle
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Webpack config to handle CodeMirror properly
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

module.exports = nextConfig;
