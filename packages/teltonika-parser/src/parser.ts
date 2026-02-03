import {
  AVLRecord,
  GPSData,
  IOElement,
  Priority,
  ConnectionState,
  ImeiParseResult,
  AvlParseResult,
  ParsedTelemetry,
} from './types.js'
import { parseIOValue } from './io-elements.js'
import { calculateCRC16 } from './crc.js'

/**
 * Teltonika Codec 8 Extended Parser
 *
 * Handles parsing of Teltonika FMC125 (and compatible) device data.
 * Supports both Codec 8 (0x08) and Codec 8 Extended (0x8E).
 */
export class TeltonikaParser {
  private state: ConnectionState = 'waiting_imei'
  private imei: string | null = null

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Get authenticated IMEI
   */
  getImei(): string | null {
    return this.imei
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.state = 'waiting_imei'
    this.imei = null
  }

  /**
   * Parse IMEI from initial connection packet
   *
   * Format: [2 bytes length][IMEI ASCII string]
   * Example: 00 0F 3 5 9 6 3 2 0 2 5 0 8 5 2 3 3
   *
   * @param buffer - Buffer containing IMEI packet
   * @returns Parse result or null if not enough data
   */
  parseImei(buffer: Buffer): ImeiParseResult | null {
    if (buffer.length < 2) {
      return null
    }

    const length = buffer.readUInt16BE(0)

    if (buffer.length < 2 + length) {
      return null
    }

    const imei = buffer.subarray(2, 2 + length).toString('ascii')

    // Validate IMEI format (15 digits)
    const valid = /^\d{15}$/.test(imei)

    if (valid) {
      this.imei = imei
      this.state = 'authenticated'
    }

    return {
      imei,
      valid,
      bytesConsumed: 2 + length,
    }
  }

  /**
   * Generate IMEI authentication response
   *
   * @param accepted - Whether IMEI was accepted
   * @returns Response buffer (0x01 for accepted, 0x00 for rejected)
   */
  getImeiResponse(accepted: boolean): Buffer {
    return Buffer.from([accepted ? 0x01 : 0x00])
  }

  /**
   * Check if buffer contains a complete AVL packet
   *
   * @param buffer - Buffer to check
   * @returns Total packet length if complete, 0 if incomplete, -1 if invalid
   */
  getPacketLength(buffer: Buffer): number {
    // Need at least 12 bytes for minimum packet
    // (4 preamble + 4 length + 1 codec + 1 records + 1 records + 4 crc = 15 min)
    if (buffer.length < 12) {
      return 0
    }

    // Check preamble (4 zero bytes)
    const preamble = buffer.readUInt32BE(0)
    if (preamble !== 0) {
      return -1 // Invalid packet
    }

    // Get data field length
    const dataLength = buffer.readUInt32BE(4)

    // Total packet: 4 (preamble) + 4 (length) + dataLength + 4 (CRC)
    const totalLength = 8 + dataLength + 4

    if (buffer.length < totalLength) {
      return 0 // Incomplete
    }

    return totalLength
  }

  /**
   * Parse AVL data packet
   *
   * Packet structure:
   * - Preamble: 4 bytes (0x00000000)
   * - Data Field Length: 4 bytes
   * - Codec ID: 1 byte (0x08 or 0x8E)
   * - Number of Data 1: 1 byte
   * - AVL Data: variable
   * - Number of Data 2: 1 byte
   * - CRC-16: 4 bytes
   *
   * @param buffer - Buffer containing complete packet
   * @returns Parse result or null if invalid
   */
  parseAvlPacket(buffer: Buffer): AvlParseResult | null {
    const packetLength = this.getPacketLength(buffer)

    if (packetLength <= 0) {
      return null
    }

    try {
      let offset = 0

      // Skip preamble (already validated)
      offset += 4

      // Data field length
      const dataLength = buffer.readUInt32BE(offset)
      offset += 4

      // Extract data field for CRC calculation
      const dataField = buffer.subarray(8, 8 + dataLength)

      // Codec ID
      const codecId = buffer.readUInt8(offset)
      offset += 1

      // Validate codec
      const isExtended = codecId === 0x8e
      if (codecId !== 0x08 && codecId !== 0x8e) {
        console.error(`Unsupported codec ID: 0x${codecId.toString(16)}`)
        return null
      }

      // Number of records (first)
      const numberOfRecords1 = buffer.readUInt8(offset)
      offset += 1

      // Parse all AVL records
      const records: AVLRecord[] = []

      for (let i = 0; i < numberOfRecords1; i++) {
        const result = this.parseAvlRecord(buffer, offset, isExtended)
        if (!result) {
          console.error(`Failed to parse record ${i + 1}/${numberOfRecords1}`)
          return null
        }
        records.push(result.record)
        offset = result.newOffset
      }

      // Number of records (second - for validation)
      const numberOfRecords2 = buffer.readUInt8(offset)
      offset += 1

      if (numberOfRecords1 !== numberOfRecords2) {
        console.warn(
          `Record count mismatch: ${numberOfRecords1} vs ${numberOfRecords2}`
        )
      }

      // CRC-16
      const crcReceived = buffer.readUInt32BE(offset)
      const crcCalculated = calculateCRC16(dataField)
      const crcValid = (crcReceived & 0xffff) === crcCalculated

      if (!crcValid) {
        console.warn(
          `CRC mismatch: received 0x${crcReceived.toString(16)}, calculated 0x${crcCalculated.toString(16)}`
        )
      }

      this.state = 'receiving_data'

      return {
        packet: {
          codecId,
          numberOfRecords: numberOfRecords1,
          records,
          crc: crcReceived,
          crcValid,
        },
        bytesConsumed: packetLength,
      }
    } catch (error) {
      console.error('Error parsing AVL packet:', error)
      return null
    }
  }

  /**
   * Parse a single AVL record
   */
  private parseAvlRecord(
    buffer: Buffer,
    offset: number,
    isExtended: boolean
  ): { record: AVLRecord; newOffset: number } | null {
    try {
      // Timestamp - 8 bytes (milliseconds since Unix epoch)
      const timestampMs = buffer.readBigUInt64BE(offset)
      const timestamp = new Date(Number(timestampMs))
      offset += 8

      // Priority - 1 byte
      const priority = buffer.readUInt8(offset) as Priority
      offset += 1

      // GPS Element - 15 bytes
      const gps = this.parseGpsElement(buffer, offset)
      offset += 15

      // IO Element - variable length
      const ioResult = this.parseIoElement(buffer, offset, isExtended)
      offset = ioResult.newOffset

      return {
        record: {
          timestamp,
          priority,
          gps,
          ioElements: ioResult.elements,
        },
        newOffset: offset,
      }
    } catch (error) {
      console.error('Error parsing AVL record:', error)
      return null
    }
  }

  /**
   * Parse GPS element (15 bytes)
   *
   * Structure:
   * - Longitude: 4 bytes (int, divide by 10000000)
   * - Latitude: 4 bytes (int, divide by 10000000)
   * - Altitude: 2 bytes (signed short, meters)
   * - Angle: 2 bytes (unsigned short, 0-360 degrees)
   * - Satellites: 1 byte
   * - Speed: 2 bytes (unsigned short, km/h)
   */
  private parseGpsElement(buffer: Buffer, offset: number): GPSData {
    const longitude = buffer.readInt32BE(offset) / 10000000
    offset += 4

    const latitude = buffer.readInt32BE(offset) / 10000000
    offset += 4

    const altitude = buffer.readInt16BE(offset)
    offset += 2

    const angle = buffer.readUInt16BE(offset)
    offset += 2

    const satellites = buffer.readUInt8(offset)
    offset += 1

    const speed = buffer.readUInt16BE(offset)

    // GPS is valid if we have at least 3 satellites and non-zero coordinates
    const isValid = satellites >= 3 && (longitude !== 0 || latitude !== 0)

    return {
      longitude,
      latitude,
      altitude,
      angle,
      satellites,
      speed,
      isValid,
    }
  }

  /**
   * Parse IO element
   *
   * Codec 8 Extended uses 2 bytes for IO IDs and counts
   * Codec 8 uses 1 byte
   *
   * Structure:
   * - Event IO ID: 1 or 2 bytes
   * - Total IO Count: 1 or 2 bytes
   * - N1 (1-byte values): count + pairs of (id, value)
   * - N2 (2-byte values): count + pairs of (id, value)
   * - N4 (4-byte values): count + pairs of (id, value)
   * - N8 (8-byte values): count + pairs of (id, value)
   * - NX (variable length, Extended only): count + (id, length, value)
   */
  private parseIoElement(
    buffer: Buffer,
    offset: number,
    isExtended: boolean
  ): { elements: IOElement[]; newOffset: number } {
    const elements: IOElement[] = []
    const idSize = isExtended ? 2 : 1
    const countSize = isExtended ? 2 : 1

    // Event IO ID (trigger)
    offset += idSize

    // Total IO count
    offset += countSize

    // Parse IO elements by size: 1, 2, 4, 8 bytes
    const sizes = [1, 2, 4, 8]

    for (const valueSize of sizes) {
      const count = isExtended
        ? buffer.readUInt16BE(offset)
        : buffer.readUInt8(offset)
      offset += countSize

      for (let i = 0; i < count; i++) {
        const id = isExtended
          ? buffer.readUInt16BE(offset)
          : buffer.readUInt8(offset)
        offset += idSize

        let value: number | bigint
        switch (valueSize) {
          case 1:
            value = buffer.readUInt8(offset)
            break
          case 2:
            value = buffer.readUInt16BE(offset)
            break
          case 4:
            value = buffer.readUInt32BE(offset)
            break
          case 8:
            value = buffer.readBigUInt64BE(offset)
            break
          default:
            value = 0
        }
        offset += valueSize

        const parsed = parseIOValue(id, value)
        elements.push({
          id,
          value,
          name: parsed.name,
          parsedValue: parsed.parsedValue,
          unit: parsed.unit,
        })
      }
    }

    // Codec 8 Extended: NX elements (variable length)
    if (isExtended) {
      const nxCount = buffer.readUInt16BE(offset)
      offset += 2

      for (let i = 0; i < nxCount; i++) {
        // Skip ID (2 bytes)
        offset += 2
        const length = buffer.readUInt16BE(offset)
        offset += 2
        // Skip variable length data for now
        offset += length
      }
    }

    return { elements, newOffset: offset }
  }

  /**
   * Generate acknowledgment response for received records
   *
   * @param recordCount - Number of records acknowledged
   * @returns Response buffer (4 bytes, big-endian count)
   */
  getAcknowledgment(recordCount: number): Buffer {
    const response = Buffer.alloc(4)
    response.writeUInt32BE(recordCount, 0)
    return response
  }

  /**
   * Convert AVL record to structured telemetry data
   */
  recordToTelemetry(record: AVLRecord): ParsedTelemetry {
    const telemetry: ParsedTelemetry = {
      timestamp: record.timestamp,
      gps: record.gps,
      rawIO: record.ioElements,
    }

    // Map IO elements to structured fields
    for (const io of record.ioElements) {
      switch (io.name) {
        // Basic IO
        case 'ignition':
          telemetry.ignition = io.parsedValue as boolean
          break
        case 'movement':
          telemetry.movement = io.parsedValue as boolean
          break
        case 'digitalInput1':
          telemetry.digitalInput1 = io.parsedValue as boolean
          break
        case 'digitalInput2':
          telemetry.digitalInput2 = io.parsedValue as boolean
          break
        case 'digitalInput3':
          telemetry.digitalInput3 = io.parsedValue as boolean
          break
        case 'digitalInput4':
          telemetry.digitalInput4 = io.parsedValue as boolean
          break
        case 'analogInput1':
          telemetry.analogInput1 = io.parsedValue as number
          break
        case 'analogInput2':
          telemetry.analogInput2 = io.parsedValue as number
          break
        case 'externalVoltage':
          telemetry.externalVoltage = io.parsedValue as number
          break
        case 'batteryVoltage':
          telemetry.batteryVoltage = io.parsedValue as number
          break
        case 'batteryCurrent':
          telemetry.batteryCurrent = io.parsedValue as number
          break
        case 'batteryLevel':
          telemetry.batteryLevel = io.parsedValue as number
          break
        case 'gsmSignal':
          telemetry.gsmSignal = io.parsedValue as number
          break
        case 'gnssStatus':
          telemetry.gnssStatus = io.parsedValue as number
          break
        case 'gnssHdop':
          telemetry.gnssHdop = io.parsedValue as number
          break
        case 'gnssPdop':
          telemetry.gnssPdop = io.parsedValue as number
          break
        case 'sleepMode':
          telemetry.sleepMode = io.parsedValue as number
          break
        case 'odometer':
          telemetry.odometer = io.parsedValue as number
          break

        // CAN data
        case 'canFuelLevel':
          telemetry.can = telemetry.can || {}
          telemetry.can.fuelLevel = io.parsedValue as number
          break
        case 'canFuelUsed':
          telemetry.can = telemetry.can || {}
          telemetry.can.fuelUsed = io.parsedValue as number
          break
        case 'canFuelRate':
          telemetry.can = telemetry.can || {}
          telemetry.can.fuelRate = io.parsedValue as number
          break
        case 'canEngineRpm':
          telemetry.can = telemetry.can || {}
          telemetry.can.engineRpm = io.parsedValue as number
          break
        case 'canEngineHours':
          telemetry.can = telemetry.can || {}
          telemetry.can.engineHours = io.parsedValue as number
          break
        case 'canVehicleSpeed':
          telemetry.can = telemetry.can || {}
          telemetry.can.vehicleSpeed = io.parsedValue as number
          break
        case 'canOdometer':
          telemetry.can = telemetry.can || {}
          telemetry.can.odometer = io.parsedValue as number
          break
        case 'canTripOdometer':
          telemetry.can = telemetry.can || {}
          telemetry.can.tripOdometer = io.parsedValue as number
          break
        case 'canCoolantTemp':
          telemetry.can = telemetry.can || {}
          telemetry.can.coolantTemp = io.parsedValue as number
          break
        case 'canEngineLoad':
          telemetry.can = telemetry.can || {}
          telemetry.can.engineLoad = io.parsedValue as number
          break
        case 'canThrottlePosition':
          telemetry.can = telemetry.can || {}
          telemetry.can.throttlePosition = io.parsedValue as number
          break
        case 'canAcceleratorPosition':
          telemetry.can = telemetry.can || {}
          telemetry.can.acceleratorPosition = io.parsedValue as number
          break
        case 'canBrakeActive':
          telemetry.can = telemetry.can || {}
          telemetry.can.brakeActive = io.parsedValue as boolean
          break
        case 'canCruiseControl':
          telemetry.can = telemetry.can || {}
          telemetry.can.cruiseControl = io.parsedValue as boolean
          break
        case 'canDoor1Status':
          telemetry.can = telemetry.can || {}
          telemetry.can.door1Open = io.parsedValue as boolean
          break
        case 'canDoor2Status':
          telemetry.can = telemetry.can || {}
          telemetry.can.door2Open = io.parsedValue as boolean
          break
        case 'canDoor3Status':
          telemetry.can = telemetry.can || {}
          telemetry.can.door3Open = io.parsedValue as boolean
          break
        case 'canAmbientAirTemp':
          telemetry.can = telemetry.can || {}
          telemetry.can.ambientAirTemp = io.parsedValue as number
          break
        case 'canAdBlueLevel':
          telemetry.can = telemetry.can || {}
          telemetry.can.adBlueLevel = io.parsedValue as number
          break
        case 'canDtcCount':
          telemetry.can = telemetry.can || {}
          telemetry.can.dtcCount = io.parsedValue as number
          break
        case 'canServiceDistance':
          telemetry.can = telemetry.can || {}
          telemetry.can.serviceDistance = io.parsedValue as number
          break
      }
    }

    return telemetry
  }
}
