/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le web ne parle jamais directement à la base : tout passe par l'API (apps/api, port 3001)
  // via les Server Components / Server Actions — le JWT vit dans un cookie httpOnly, jamais
  // exposé au JavaScript client (CLAUDE.md §1.4).
  experimental: {
    serverActions: {
      // Téléversement de documents (bucket 50 MiB) : le fichier transite par la Server Action
      // avant l'upload signé vers Supabase Storage.
      bodySizeLimit: "52mb",
    },
  },
};

export default nextConfig;
