import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // A página inicial do sistema é o Dashboard (redirecionamento temporário,
  // para não ficar gravado no navegador caso a página inicial mude no futuro).
  redirects() {
    return [
      { source: "/", destination: "/dashboard", permanent: false },
      { source: "/configuracoes", destination: "/configuracoes/usuarios", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
