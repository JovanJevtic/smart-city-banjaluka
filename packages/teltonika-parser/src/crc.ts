/**
 * CRC-16 lookup table for Teltonika protocol
 * Uses CRC-16/IBM (polynomial 0xA001, reflected)
 */
const CRC16_TABLE: number[] = []

// Initialize CRC table
for (let i = 0; i < 256; i++) {
  let crc = i
  for (let j = 0; j < 8; j++) {
    if (crc & 1) {
      crc = (crc >>> 1) ^ 0xa001
    } else {
      crc = crc >>> 1
    }
  }
  CRC16_TABLE[i] = crc
}

/**
 * Calculate CRC-16 for Teltonika AVL data
 *
 * @param data - Buffer containing the data to checksum (data field only, not preamble/length)
 * @returns 16-bit CRC value
 */
export function calculateCRC16(data: Buffer): number {
  let crc = 0

  for (let i = 0; i < data.length; i++) {
    const byte = data[i]
    const tableIndex = (crc ^ byte) & 0xff
    crc = (crc >>> 8) ^ CRC16_TABLE[tableIndex]
  }

  return crc
}

/**
 * Verify CRC-16 of a Teltonika packet
 *
 * @param data - Buffer containing the complete AVL data field
 * @param expectedCrc - Expected CRC value from packet
 * @returns true if CRC matches
 */
export function verifyCRC16(data: Buffer, expectedCrc: number): boolean {
  const calculated = calculateCRC16(data)
  return calculated === expectedCrc
}
