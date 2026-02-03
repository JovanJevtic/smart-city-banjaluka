/**
 * IO Element definition
 */
export interface IOElementDef {
  name: string
  unit?: string
  multiplier?: number
  offset?: number
  type?: 'boolean' | 'number'
}

/**
 * Complete map of Teltonika FMC125 + LVCAN200 IO element IDs
 * Reference: https://wiki.teltonika-gps.com/view/FMC125_Teltonika_Data_Sending_Parameters_ID
 */
export const IO_ELEMENTS: Record<number, IOElementDef> = {
  // ============ DIGITAL INPUTS ============
  1: { name: 'digitalInput1', type: 'boolean' },
  2: { name: 'digitalInput2', type: 'boolean' },
  3: { name: 'digitalInput3', type: 'boolean' },
  4: { name: 'digitalInput4', type: 'boolean' },

  // ============ ANALOG INPUTS ============
  9: { name: 'analogInput1', unit: 'mV' },
  10: { name: 'analogInput2', unit: 'mV' },

  // ============ BASIC PARAMETERS ============
  16: { name: 'odometer', unit: 'm' },
  17: { name: 'axisX', unit: 'mg' },
  18: { name: 'axisY', unit: 'mg' },
  19: { name: 'axisZ', unit: 'mg' },

  21: { name: 'gsmSignal' }, // 1-5 scale
  24: { name: 'gpsSpeed', unit: 'km/h' },
  25: { name: 'ecuSpeed', unit: 'km/h' },

  // ============ POWER ============
  66: { name: 'externalVoltage', unit: 'mV' },
  67: { name: 'batteryVoltage', unit: 'mV' },
  68: { name: 'batteryCurrent', unit: 'mA' },

  // ============ GNSS ============
  69: { name: 'gnssStatus' }, // 0=OFF, 1=ON no fix, 2=ON with fix, 3=sleep

  // ============ TEMPERATURE (Dallas) ============
  72: { name: 'dallas1Temp', unit: '°C', multiplier: 0.1 },
  73: { name: 'dallas2Temp', unit: '°C', multiplier: 0.1 },
  74: { name: 'dallas3Temp', unit: '°C', multiplier: 0.1 },
  75: { name: 'dallas4Temp', unit: '°C', multiplier: 0.1 },

  // ============ iButton / RFID ============
  78: { name: 'iccid1' },

  // ============ NETWORK ============
  80: { name: 'dataMode' }, // 0=Home, 1=Roaming, 2=Unknown

  // ============ FUEL (GPS calculated) ============
  83: { name: 'fuelUsedGps', unit: 'L', multiplier: 0.1 },
  84: { name: 'fuelRateGps', unit: 'L/h', multiplier: 0.1 },

  // ============ ACCELEROMETER CALIBRATED ============
  85: { name: 'axisXCalibrated', unit: 'mg' },
  86: { name: 'axisYCalibrated', unit: 'mg' },
  87: { name: 'axisZCalibrated', unit: 'mg' },

  // ============ BATTERY ============
  113: { name: 'batteryLevel', unit: '%' },

  // ============ GNSS PRECISION ============
  181: { name: 'gnssPdop', multiplier: 0.1 },
  182: { name: 'gnssHdop', multiplier: 0.1 },

  // ============ DEVICE STATUS ============
  200: { name: 'sleepMode' },
  239: { name: 'ignition', type: 'boolean' }, // 0=OFF, 1=ON
  240: { name: 'movement', type: 'boolean' }, // 0=stationary, 1=moving
  241: { name: 'operatorCode' },

  // ============ LVCAN200 - FUEL ============
  269: { name: 'canFuelLevel', unit: '%', multiplier: 0.4 }, // 0-250 -> 0-100%
  270: { name: 'canFuelUsed', unit: 'L', multiplier: 0.5 },
  271: { name: 'canFuelRate', unit: 'L/h', multiplier: 0.05 },

  // ============ LVCAN200 - ENGINE ============
  272: { name: 'canEngineRpm', unit: 'RPM', multiplier: 0.125 },
  273: { name: 'canEngineHours', unit: 'h', multiplier: 0.05 },
  274: { name: 'canCoolantTemp', unit: '°C', offset: -40 },
  275: { name: 'canEngineLoad', unit: '%' },

  // ============ LVCAN200 - SPEED & DISTANCE ============
  276: { name: 'canVehicleSpeed', unit: 'km/h' },
  277: { name: 'canOdometer', unit: 'm' }, // total meters
  278: { name: 'canTripOdometer', unit: 'm' },

  // ============ LVCAN200 - PEDALS ============
  279: { name: 'canThrottlePosition', unit: '%', multiplier: 0.4 },
  280: { name: 'canAcceleratorPosition', unit: '%', multiplier: 0.4 },

  // ============ LVCAN200 - STATUS ============
  281: { name: 'canBrakeActive', type: 'boolean' },
  282: { name: 'canCruiseControl', type: 'boolean' },

  // ============ LVCAN200 - DOORS ============
  283: { name: 'canDoor1Status', type: 'boolean' },
  284: { name: 'canDoor2Status', type: 'boolean' },
  285: { name: 'canDoor3Status', type: 'boolean' },

  // ============ LVCAN200 - PROGRAM ============
  286: { name: 'canProgramNumber' },
  287: { name: 'canModuleStatus' },

  // ============ LVCAN200 - DIAGNOSTICS ============
  288: { name: 'canDtcCount' },
  289: { name: 'canDtcFaults' },

  // ============ LVCAN200 - TACHO ============
  290: { name: 'canTachoVehicleSpeed', unit: 'km/h' },
  291: { name: 'canDriverCardPresence', type: 'boolean' },
  292: { name: 'canDriver1State' },
  293: { name: 'canDriver2State' },
  294: { name: 'canDriver1WorkState' },
  295: { name: 'canDriver2WorkState' },

  // ============ LVCAN200 - AMBIENT ============
  296: { name: 'canAmbientAirTemp', unit: '°C', offset: -40 },

  // ============ LVCAN200 - AdBlue ============
  297: { name: 'canAdBlueLevel', unit: '%', multiplier: 0.4 },

  // ============ LVCAN200 - AXLE WEIGHTS ============
  298: { name: 'canAxle1Weight', unit: 'kg', multiplier: 2 },
  299: { name: 'canAxle2Weight', unit: 'kg', multiplier: 2 },
  300: { name: 'canAxle3Weight', unit: 'kg', multiplier: 2 },
  301: { name: 'canAxle4Weight', unit: 'kg', multiplier: 2 },
  302: { name: 'canAxle5Weight', unit: 'kg', multiplier: 2 },

  // ============ LVCAN200 - SERVICE ============
  303: { name: 'canServiceDistance', unit: 'km' },

  // ============ LVCAN200 - OIL ============
  304: { name: 'canEngineOilTemp', unit: '°C' },
  305: { name: 'canEngineOilLevel', unit: '%' },
  306: { name: 'canEngineOilPressure', unit: 'kPa' },
  307: { name: 'canTransmissionOilTemp', unit: '°C' },
  308: { name: 'canChargeAirPressure', unit: 'kPa' },

  // ============ BLE SENSORS ============
  385: { name: 'beaconIds' },
  386: { name: 'bleTemp1', unit: '°C', multiplier: 0.01 },
  387: { name: 'bleTemp2', unit: '°C', multiplier: 0.01 },
  388: { name: 'bleTemp3', unit: '°C', multiplier: 0.01 },
  389: { name: 'bleTemp4', unit: '°C', multiplier: 0.01 },
  390: { name: 'bleHumidity1', unit: '%', multiplier: 0.1 },
  391: { name: 'bleHumidity2', unit: '%', multiplier: 0.1 },
  392: { name: 'bleHumidity3', unit: '%', multiplier: 0.1 },
  393: { name: 'bleHumidity4', unit: '%', multiplier: 0.1 },
}

/**
 * Parse an IO element value
 */
export function parseIOValue(
  id: number,
  rawValue: number | bigint
): {
  name: string
  value: number | bigint
  parsedValue?: number | boolean | string
  unit?: string
} {
  const element = IO_ELEMENTS[id]

  if (!element) {
    return {
      name: `unknown_${id}`,
      value: rawValue,
    }
  }

  const numValue = typeof rawValue === 'bigint' ? Number(rawValue) : rawValue
  let parsedValue: number | boolean | string | undefined

  // Handle boolean types
  if (element.type === 'boolean') {
    parsedValue = numValue === 1
  }
  // Handle offset (like temperature with -40 offset)
  else if (element.offset !== undefined) {
    parsedValue = numValue + element.offset
  }
  // Handle multiplier
  else if (element.multiplier !== undefined) {
    parsedValue = numValue * element.multiplier
  }
  // Plain number
  else {
    parsedValue = numValue
  }

  return {
    name: element.name,
    value: rawValue,
    parsedValue,
    unit: element.unit,
  }
}
