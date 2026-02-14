/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/tiptap-editor", "@repo/ui"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
