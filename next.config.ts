import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'canvas': 'canvas',
        'pdf-parse': 'pdf-parse',
        'webworker-threads': 'webworker-threads'
      })
    }

    // Ignore pdf-parse test files and natural optional dependencies
    config.module.rules.push({
      test: /pdf-parse/,
      use: {
        loader: 'ignore-loader'
      }
    })

    // Suppress warnings for optional dependencies
    config.ignoreWarnings = [
      { module: /node_modules\/natural/ },
    ]

    return config
  }
};

export default nextConfig;
