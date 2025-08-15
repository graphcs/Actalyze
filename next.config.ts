import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'canvas': 'canvas',
        'pdf-parse': 'pdf-parse'
      })
    }

    // Ignore pdf-parse test files
    config.module.rules.push({
      test: /pdf-parse/,
      use: {
        loader: 'ignore-loader'
      }
    })

    return config
  }
};

export default nextConfig;
