import { db, devices, vehicles, routes, stops, routeStops, geofences, users } from './index.js'

async function main() {
  console.log('Seeding database...')

  // Create test device
  const [device1] = await db.insert(devices).values({
    imei: '359632025085233',
    name: 'Test Device 1',
    model: 'FMC125',
  }).onConflictDoNothing().returning()

  console.log('Created device:', device1?.imei || 'already exists')

  // Create test vehicle
  const [vehicle1] = await db.insert(vehicles).values({
    registrationNo: 'BL-123-A',
    type: 'BUS',
    make: 'Mercedes',
    model: 'Citaro',
    year: 2020,
    capacity: 80,
  }).onConflictDoNothing().returning()

  console.log('Created vehicle:', vehicle1?.registrationNo || 'already exists')

  // Create test route
  const [route1] = await db.insert(routes).values({
    id: 'route-7',
    number: '7',
    name: 'Lauš - Borik',
    description: 'Main city route',
    color: '#FF5733',
  }).onConflictDoNothing().returning()

  console.log('Created route:', route1?.number || 'already exists')

  // Create test stops
  const stopsData = [
    { name: 'Lauš', code: 'BL-001', latitude: 44.7567, longitude: 17.1856 },
    { name: 'Centar', code: 'BL-002', latitude: 44.7722, longitude: 17.191 },
    { name: 'Borik', code: 'BL-003', latitude: 44.7856, longitude: 17.1923 },
  ]

  for (let i = 0; i < stopsData.length; i++) {
    const stopData = stopsData[i]
    const [stop] = await db.insert(stops).values(stopData).onConflictDoNothing().returning()
    console.log('Created stop:', stop?.name || 'already exists')

    if (stop && route1) {
      await db.insert(routeStops).values({
        routeId: route1.id,
        stopId: stop.id,
        sequence: i + 1,
        direction: 'OUTBOUND',
      }).onConflictDoNothing()
    }
  }

  // Create test geofence
  const [geofence1] = await db.insert(geofences).values({
    id: 'geofence-center',
    name: 'City Center',
    type: 'CIRCLE',
    centerLat: 44.7722,
    centerLng: 17.191,
    radius: 500,
    alertOnEnter: true,
    alertOnExit: true,
    speedLimit: 30,
  }).onConflictDoNothing().returning()

  console.log('Created geofence:', geofence1?.name || 'already exists')

  // Create test admin user
  const [adminUser] = await db.insert(users).values({
    email: 'admin@smartcity.ba',
    name: 'Admin User',
    passwordHash: '$2b$10$PLACEHOLDER_HASH',
    role: 'ADMIN',
  }).onConflictDoNothing().returning()

  console.log('Created user:', adminUser?.email || 'already exists')

  console.log('Seeding completed!')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
