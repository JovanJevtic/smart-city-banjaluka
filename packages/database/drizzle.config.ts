import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: [
    './src/schema/devices.ts',
    './src/schema/vehicles.ts',
    './src/schema/routes.ts',
    './src/schema/telemetry.ts',
    './src/schema/alerts.ts',
    './src/schema/users.ts',
    './src/schema/geofences.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  extensionsFilters: ['postgis'],
})
