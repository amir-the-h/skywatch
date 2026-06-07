// src/types/airport.ts

export type AirportType = 'large_airport' | 'medium_airport' | 'small_airport'

export interface RunwayEnd {
  ident: string
  lat: number
  lon: number
}

export interface Runway {
  le: RunwayEnd
  he: RunwayEnd
  widthFt: number
  lengthFt: number
}

export interface Airport {
  icao: string
  iata: string
  name: string
  lat: number
  lon: number
  type: AirportType
  runways: Runway[]
}
