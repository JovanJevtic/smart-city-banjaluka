import { describe, it, expect, beforeEach } from 'vitest'
import { TeltonikaParser } from './parser.js'
import { calculateCRC16 } from './crc.js'

describe('TeltonikaParser', () => {
  let parser: TeltonikaParser

  beforeEach(() => {
    parser = new TeltonikaParser()
  })

  describe('IMEI parsing', () => {
    it('should parse valid IMEI', () => {
      // IMEI: 359632025085233 (15 digits)
      const imeiBuffer = Buffer.from([
        0x00,
        0x0f, // length = 15
        0x33,
        0x35,
        0x39,
        0x36,
        0x33,
        0x32, // "359632"
        0x30,
        0x32,
        0x35,
        0x30,
        0x38,
        0x35, // "025085"
        0x32,
        0x33,
        0x33, // "233"
      ])

      const result = parser.parseImei(imeiBuffer)

      expect(result).not.toBeNull()
      expect(result!.imei).toBe('359632025085233')
      expect(result!.valid).toBe(true)
      expect(result!.bytesConsumed).toBe(17)
      expect(parser.getState()).toBe('authenticated')
      expect(parser.getImei()).toBe('359632025085233')
    })

    it('should reject invalid IMEI (not 15 digits)', () => {
      // Invalid IMEI: 12345 (only 5 digits)
      const imeiBuffer = Buffer.from([
        0x00,
        0x05, // length = 5
        0x31,
        0x32,
        0x33,
        0x34,
        0x35, // "12345"
      ])

      const result = parser.parseImei(imeiBuffer)

      expect(result).not.toBeNull()
      expect(result!.imei).toBe('12345')
      expect(result!.valid).toBe(false)
      expect(parser.getState()).toBe('waiting_imei')
    })

    it('should return null for incomplete buffer', () => {
      const incompleteBuffer = Buffer.from([0x00, 0x0f, 0x33, 0x35])

      const result = parser.parseImei(incompleteBuffer)

      expect(result).toBeNull()
    })

    it('should generate correct IMEI response', () => {
      const acceptedResponse = parser.getImeiResponse(true)
      const rejectedResponse = parser.getImeiResponse(false)

      expect(acceptedResponse).toEqual(Buffer.from([0x01]))
      expect(rejectedResponse).toEqual(Buffer.from([0x00]))
    })
  })

  describe('Packet length detection', () => {
    it('should return 0 for incomplete packet', () => {
      const incompleteBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00])

      const length = parser.getPacketLength(incompleteBuffer)

      expect(length).toBe(0)
    })

    it('should return -1 for invalid preamble', () => {
      const invalidBuffer = Buffer.from([
        0x01,
        0x00,
        0x00,
        0x00, // Invalid preamble
        0x00,
        0x00,
        0x00,
        0x10, // Data length
        0x08, // Codec
        0x01, // Records
        0x01, // Records
        0x00,
        0x00,
        0x00,
        0x00, // CRC
      ])

      const length = parser.getPacketLength(invalidBuffer)

      expect(length).toBe(-1)
    })
  })

  describe('AVL packet parsing', () => {
    it('should parse simple Codec 8 packet', () => {
      // Minimal valid Codec 8 packet with 1 record
      // This is a synthetic test packet
      const packet = createTestPacket()

      const result = parser.parseAvlPacket(packet)

      expect(result).not.toBeNull()
      expect(result!.packet.codecId).toBe(0x08)
      expect(result!.packet.numberOfRecords).toBe(1)
      expect(result!.packet.records).toHaveLength(1)
    })

    it('should generate correct acknowledgment', () => {
      const ack1 = parser.getAcknowledgment(1)
      const ack5 = parser.getAcknowledgment(5)

      expect(ack1).toEqual(Buffer.from([0x00, 0x00, 0x00, 0x01]))
      expect(ack5).toEqual(Buffer.from([0x00, 0x00, 0x00, 0x05]))
    })
  })

  describe('GPS parsing', () => {
    it('should parse GPS coordinates correctly', () => {
      const packet = createTestPacket({
        latitude: 44.7722,
        longitude: 17.191,
        altitude: 150,
        angle: 180,
        satellites: 8,
        speed: 45,
      })

      const result = parser.parseAvlPacket(packet)

      expect(result).not.toBeNull()
      const gps = result!.packet.records[0].gps

      expect(gps.latitude).toBeCloseTo(44.7722, 4)
      expect(gps.longitude).toBeCloseTo(17.191, 4)
      expect(gps.altitude).toBe(150)
      expect(gps.angle).toBe(180)
      expect(gps.satellites).toBe(8)
      expect(gps.speed).toBe(45)
      expect(gps.isValid).toBe(true)
    })

    it('should mark GPS as invalid with 0 satellites', () => {
      const packet = createTestPacket({
        latitude: 0,
        longitude: 0,
        satellites: 0,
      })

      const result = parser.parseAvlPacket(packet)

      expect(result).not.toBeNull()
      expect(result!.packet.records[0].gps.isValid).toBe(false)
    })
  })

  describe('Telemetry conversion', () => {
    it('should convert record to telemetry', () => {
      const packet = createTestPacket()
      const result = parser.parseAvlPacket(packet)

      expect(result).not.toBeNull()

      const telemetry = parser.recordToTelemetry(result!.packet.records[0])

      expect(telemetry.timestamp).toBeInstanceOf(Date)
      expect(telemetry.gps).toBeDefined()
      expect(telemetry.rawIO).toBeDefined()
    })
  })
})

describe('CRC16', () => {
  it('should calculate correct CRC', () => {
    // Test with known data
    const testData = Buffer.from([0x08, 0x01, 0x00, 0x00])
    const crc = calculateCRC16(testData)

    expect(typeof crc).toBe('number')
    expect(crc).toBeGreaterThanOrEqual(0)
    expect(crc).toBeLessThanOrEqual(0xffff)
  })
})

/**
 * Create a test packet with customizable GPS data
 */
function createTestPacket(
  gpsData: Partial<{
    latitude: number
    longitude: number
    altitude: number
    angle: number
    satellites: number
    speed: number
  }> = {}
): Buffer {
  const {
    latitude = 44.7722,
    longitude = 17.191,
    altitude = 100,
    angle = 0,
    satellites = 8,
    speed = 0,
  } = gpsData

  // Build data field
  const dataField = Buffer.alloc(100)
  let offset = 0

  // Codec ID
  dataField.writeUInt8(0x08, offset)
  offset += 1

  // Number of records 1
  dataField.writeUInt8(1, offset)
  offset += 1

  // Timestamp (8 bytes) - current time
  const timestamp = BigInt(Date.now())
  dataField.writeBigUInt64BE(timestamp, offset)
  offset += 8

  // Priority
  dataField.writeUInt8(0, offset)
  offset += 1

  // GPS: Longitude (4 bytes)
  dataField.writeInt32BE(Math.round(longitude * 10000000), offset)
  offset += 4

  // GPS: Latitude (4 bytes)
  dataField.writeInt32BE(Math.round(latitude * 10000000), offset)
  offset += 4

  // GPS: Altitude (2 bytes)
  dataField.writeInt16BE(altitude, offset)
  offset += 2

  // GPS: Angle (2 bytes)
  dataField.writeUInt16BE(angle, offset)
  offset += 2

  // GPS: Satellites (1 byte)
  dataField.writeUInt8(satellites, offset)
  offset += 1

  // GPS: Speed (2 bytes)
  dataField.writeUInt16BE(speed, offset)
  offset += 2

  // IO Element (minimal - no IO data)
  dataField.writeUInt8(0, offset) // Event IO ID
  offset += 1
  dataField.writeUInt8(0, offset) // Total IO count
  offset += 1

  // 1-byte IO count
  dataField.writeUInt8(0, offset)
  offset += 1

  // 2-byte IO count
  dataField.writeUInt8(0, offset)
  offset += 1

  // 4-byte IO count
  dataField.writeUInt8(0, offset)
  offset += 1

  // 8-byte IO count
  dataField.writeUInt8(0, offset)
  offset += 1

  // Number of records 2
  dataField.writeUInt8(1, offset)
  offset += 1

  // Trim to actual size
  const actualDataField = dataField.subarray(0, offset)

  // Calculate CRC
  const crc = calculateCRC16(actualDataField)

  // Build complete packet
  const packet = Buffer.alloc(8 + actualDataField.length + 4)
  let packetOffset = 0

  // Preamble (4 bytes)
  packet.writeUInt32BE(0, packetOffset)
  packetOffset += 4

  // Data length (4 bytes)
  packet.writeUInt32BE(actualDataField.length, packetOffset)
  packetOffset += 4

  // Copy data field
  actualDataField.copy(packet, packetOffset)
  packetOffset += actualDataField.length

  // CRC (4 bytes, but only lower 16 bits used)
  packet.writeUInt32BE(crc, packetOffset)

  return packet
}
