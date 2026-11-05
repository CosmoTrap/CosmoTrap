/** One solar array, in world metres: its corner, and the strut joining it to a module. */
export interface SolarArray {
  x: number
  z: number
  strutZ: number
  strutX: number
}

/** Shared by the tablet's plan and the 3D station, so the two can never disagree. */
export const SOLAR_ARRAYS: Record<number, SolarArray[]> = {
  1: [{ x: 8, z: 17, strutZ: 38, strutX: 16 }, { x: 58, z: 17, strutZ: 38, strutX: 65 }, { x: 8, z: 58, strutZ: 44, strutX: 16 }, { x: 58, z: 58, strutZ: 44, strutX: 65 }],
  2: [{ x: 2, z: 9, strutZ: 32, strutX: 12 }, { x: 55, z: 8, strutZ: 34, strutX: 66 }, { x: 8, z: 54, strutZ: 40, strutX: 16 }, { x: 62, z: 56, strutZ: 40, strutX: 69 }],
}

export const SOLAR_CELL = 2.7
export const SOLAR_GAP = 0.22
