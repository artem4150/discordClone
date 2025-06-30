import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Отключаем ошибки ESLint во время сборки
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Отключаем ошибки TypeScript во время сборки
  typescript: {
    ignoreBuildErrors: true,
  },
  
};

export default nextConfig;
