import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // mobile/ has its own independent lint pipeline (`expo lint`) — a
    // React Native project needs different rules/parser settings than the
    // Next.js app, so it isn't linted from here.
    "mobile/**",
  ]),
  {
    // packages/shared ships inside the mobile app bundle — it must never pull
    // in server-only code (see docs/platform-split/01-shared-foundation.md).
    files: ["packages/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "@prisma/client",
            "stripe",
            "resend",
            "svix",
            "pg",
            "@clerk/nextjs",
            "@clerk/nextjs/server",
          ],
          patterns: ["@prisma/*"],
        },
      ],
    },
  },
]);

export default eslintConfig;
