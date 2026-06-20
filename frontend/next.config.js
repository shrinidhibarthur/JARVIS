/** @type {import('next').NextConfig} */
const nextConfig = {
  // LLM calls (Ollama/Gemma) can take 30-90s — raise proxy timeout to 3 minutes
  experimental: {
    proxyTimeout: 180_000,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8001/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
