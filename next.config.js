// @ts-nocheck
/* jshint esversion: 6 */
// Injected content via Sentry wizard below
import { withSentryConfig } from '@sentry/nextjs';

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import './src/env.js';

/** @type {import("next").NextConfig} */
const config = {
  typedRoutes: true,
  output: 'standalone',
  eslint: {
    // Fail build on any errors (0 threshold)
    // and fail on 2 or more warnings
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Fail build on any TypeScript errors
    ignoreBuildErrors: false,
    tsconfigPath: 'tsconfig.app.json',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

const nextConfig = {
  ...config,
  webpack(nextWebpackConfig) {
    if (!nextWebpackConfig.ignoreWarnings) {
      nextWebpackConfig.ignoreWarnings = [];
    }
    nextWebpackConfig.ignoreWarnings.push({
      module: /@opentelemetry\/instrumentation\/build\/esm\/platform\/node\/instrumentation\.js/,
      message: /Critical dependency: the request of a dependency is an expression/,
    });

    return nextWebpackConfig;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Document-Policy',
            value: 'js-profiling',
          },
        ],
      },
    ];
  },
};

const hasSentryBuildConfig = Boolean(
  process.env.SENTRY_AUTH_TOKEN
  && process.env.SENTRY_ORG
  && process.env.SENTRY_PROJECT,
);

export default hasSentryBuildConfig
  ? withSentryConfig(nextConfig, {
    // Skip Sentry release and sourcemap upload work unless CI is fully configured.
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: '/miaow',
  })
  : nextConfig;
