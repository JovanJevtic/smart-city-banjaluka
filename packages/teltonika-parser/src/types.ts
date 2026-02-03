/**
 * Teltonika AVL packet
 */
export interface TeltonikaPacket {
  codecId: number
  numberOfRecords: number
  records: AVLRecord[]
  crc: number
  crcValid: boolean
}

/**
 * AVL data record
 */
export interface AVLRecord {
  timestamp: Date
  priority: Priority
  gps: GPSData
  ioElements: IOElement[]
}

/**
 * Record priority
 */
export enum Priority {
  LOW = 0,
  HIGH = 1,
  PANIC = 2,
}

/**
 * GPS element data
 */
export interface GPSData {
  longitude: number
  latitude: number
  altitude: number
  angle: number
  satellites: number
  speed: number
  isValid: boolean
}

/**
 * IO element
 */
export interface IOElement {
  id: number
  value: number | bigint
  name: string
  parsedValue?: number | boolean | string
  unit?: string
}

/**
 * Connection state for parser
 */
export type ConnectionState = 'waiting_imei' | 'authenticated' | 'receiving_data'

/**
 * IMEI parse result
 */
export interface ImeiParseResult {
  imei: string
  valid: boolean
  bytesConsumed: number
}

/**
 * AVL packet parse result
 */
export interface AvlParseResult {
  packet: TeltonikaPacket
  bytesConsumed: number
}

/**
 * Parsed telemetry with all data extracted
 */
export interface ParsedTelemetry {
  timestamp: Date
  gps: GPSData

  // Basic IO
  ignition?: boolean
  movement?: boolean
  digitalInput1?: boolean
  digitalInput2?: boolean
  digitalInput3?: boolean
  digitalInput4?: boolean
  analogInput1?: number
  analogInput2?: number
  externalVoltage?: number
  batteryVoltage?: number
  batteryCurrent?: number
  batteryLevel?: number

  // GSM/GNSS
  gsmSignal?: number
  gnssStatus?: number
  gnssHdop?: number
  gnssPdop?: number
  sleepMode?: number

  // Odometer
  odometer?: number

  // CAN bus data (LVCAN200)
  can?: {
    fuelLevel?: number
    fuelUsed?: number
    fuelRate?: number
    engineRpm?: number
    engineHours?: number
    vehicleSpeed?: number
    odometer?: number
    tripOdometer?: number
    coolantTemp?: number
    engineLoad?: number
    throttlePosition?: number
    acceleratorPosition?: number
    brakeActive?: boolean
    cruiseControl?: boolean
    door1Open?: boolean
    door2Open?: boolean
    door3Open?: boolean
    ambientAirTemp?: number
    adBlueLevel?: number
    dtcCount?: number
    serviceDistance?: number
  }

  // Raw IO for debugging
  rawIO: IOElement[]
}
