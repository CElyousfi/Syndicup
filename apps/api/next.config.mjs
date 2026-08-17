/** @type {import('next').NextConfig} */
const nextConfig = {
  // API pure — pas de pages ; les routes vivent sous app/v1/**.
  // @prisma/client doit rester un module Node externe (pas bundlé par Turbopack/Webpack).
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
