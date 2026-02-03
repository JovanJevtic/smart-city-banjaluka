import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create test devices
  const device1 = await prisma.device.upsert({
    where: { imei: '359632025085233' },
    update: {},
    create: {
      imei: '359632025085233',
      name: 'Test Device 1',
      model: 'FMC125',
    },
  })

  console.log('Created device:', device1.imei)

  // Create test vehicle
  const vehicle1 = await prisma.vehicle.upsert({
    where: { registrationNo: 'BL-123-A' },
    update: {},
    create: {
      registrationNo: 'BL-123-A',
      type: 'BUS',
      make: 'Mercedes',
      model: 'Citaro',
      year: 2020,
      capacity: 80,
    },
  })

  console.log('Created vehicle:', vehicle1.registrationNo)

  // Link device to vehicle
  await prisma.device.update({
    where: { id: device1.id },
    data: { vehicleId: vehicle1.id },
  })

  // Create test route
  const route1 = await prisma.route.upsert({
    where: { id: 'route-7' },
    update: {},
    create: {
      id: 'route-7',
      number: '7',
      name: 'Lauš - Borik',
      description: 'Main city route',
      color: '#FF5733',
    },
  })

  console.log('Created route:', route1.number, route1.name)

  // Create test stops
  const stops = [
    { name: 'Lauš', code: 'BL-001', latitude: 44.7567, longitude: 17.1856 },
    { name: 'Centar', code: 'BL-002', latitude: 44.7722, longitude: 17.191 },
    { name: 'Borik', code: 'BL-003', latitude: 44.7856, longitude: 17.1923 },
  ]

  for (const stopData of stops) {
    const stop = await prisma.stop.upsert({
      where: { code: stopData.code },
      update: {},
      create: stopData,
    })
    console.log('Created stop:', stop.name)

    // Link to route
    await prisma.routeStop.upsert({
      where: {
        routeId_stopId_direction: {
          routeId: route1.id,
          stopId: stop.id,
          direction: 'OUTBOUND',
        },
      },
      update: {},
      create: {
        routeId: route1.id,
        stopId: stop.id,
        sequence: stops.indexOf(stopData) + 1,
        direction: 'OUTBOUND',
      },
    })
  }

  // Create test geofence (city center)
  const geofence1 = await prisma.geofence.upsert({
    where: { id: 'geofence-center' },
    update: {},
    create: {
      id: 'geofence-center',
      name: 'City Center',
      type: 'CIRCLE',
      centerLat: 44.7722,
      centerLng: 17.191,
      radius: 500, // 500 meters
      alertOnEnter: true,
      alertOnExit: true,
      speedLimit: 30,
    },
  })

  console.log('Created geofence:', geofence1.name)

  // Create test admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@smartcity.ba' },
    update: {},
    create: {
      email: 'admin@smartcity.ba',
      name: 'Admin User',
      passwordHash: '$2b$10$PLACEHOLDER_HASH', // Replace with actual hash
      role: 'ADMIN',
    },
  })

  console.log('Created user:', adminUser.email)

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
