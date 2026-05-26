import type { ArrivalMock, MockPlatform, MockRuntime, MockScenario, MockStation } from '../types';

const CURRENT_TIME = Date.parse('2026-05-26T10:24:00+08:00');
const STATION: MockStation = {
  id: 101,
  name: 'Central Station'
};

const PLATFORMS: MockPlatform[] = [
  { id: 1, name: '1', stationId: STATION.id, stationName: STATION.name, destination: 'Airport' },
  { id: 2, name: '2', stationId: STATION.id, stationName: STATION.name, destination: 'Downtown' },
  { id: 3, name: '3', stationId: STATION.id, stationName: STATION.name, destination: 'Harborfront' },
  { id: 4, name: '4', stationId: STATION.id, stationName: STATION.name, destination: 'Tech Park' }
];

const baseArrivals: ArrivalMock[] = [
  {
    routeId: 301,
    routeName: 'Airport Express',
    routeNumber: 'A',
    routeColor: '#1769d7',
    destination: 'Airport',
    arrivalTime: Date.parse('2026-05-26T10:26:00+08:00'),
    departureTime: Date.parse('2026-05-26T10:27:00+08:00'),
    deviation: 0,
    realtime: true,
    departureIndex: 0,
    terminating: false,
    circularState: 'NONE',
    platformId: 1,
    platformName: '1',
    carCount: 8,
    cars: [
      { vehicleId: 'A1', occupancy: 0.41 },
      { vehicleId: 'A2', occupancy: 0.55 },
      { vehicleId: 'A3', occupancy: 0.48 }
    ]
  },
  {
    routeId: 302,
    routeName: 'Harbor Line',
    routeNumber: 'C',
    routeColor: '#159947',
    destination: 'Harborfront',
    arrivalTime: Date.parse('2026-05-26T10:30:00+08:00'),
    departureTime: Date.parse('2026-05-26T10:31:00+08:00'),
    deviation: 1,
    realtime: true,
    departureIndex: 1,
    terminating: false,
    circularState: 'CLOCKWISE',
    platformId: 3,
    platformName: '3',
    carCount: 6,
    cars: [
      { vehicleId: 'C1', occupancy: 0.31 },
      { vehicleId: 'C2', occupancy: 0.28 }
    ]
  },
  {
    routeId: 303,
    routeName: 'Downtown Line',
    routeNumber: 'B',
    routeColor: '#c45a1c',
    destination: 'Downtown',
    arrivalTime: Date.parse('2026-05-26T10:33:00+08:00'),
    departureTime: Date.parse('2026-05-26T10:34:00+08:00'),
    deviation: 0,
    realtime: false,
    departureIndex: 2,
    terminating: false,
    circularState: 'NONE',
    platformId: 2,
    platformName: '2',
    carCount: 8,
    cars: [
      { vehicleId: 'B1', occupancy: 0.72 },
      { vehicleId: 'B2', occupancy: 0.69 }
    ]
  },
  {
    routeId: 304,
    routeName: 'Tech Park Shuttle',
    routeNumber: 'D',
    routeColor: '#6c35c9',
    destination: 'Tech Park',
    arrivalTime: Date.parse('2026-05-26T10:39:00+08:00'),
    departureTime: Date.parse('2026-05-26T10:40:00+08:00'),
    deviation: -1,
    realtime: true,
    departureIndex: 3,
    terminating: false,
    circularState: 'COUNTERCLOCKWISE',
    platformId: 4,
    platformName: '4',
    carCount: 4,
    cars: [
      { vehicleId: 'D1', occupancy: 0.18 }
    ]
  }
];

function cloneBase() {
  return baseArrivals.map((arrival) => ({
    ...arrival,
    cars: arrival.cars.map((car) => ({ ...car }))
  }));
}

export function getMockRuntime(scenario: MockScenario): MockRuntime {
  const arrivals = cloneBase();
  const runtime: MockRuntime = {
    type: 'rv_pids',
    width: 136,
    height: 76,
    rows: 4,
    currentTime: CURRENT_TIME,
    stationName: STATION.name,
    station: STATION,
    clock: '10:24',
    customMessages: ['', '', '', ''],
    hiddenRows: [],
    hidePlatformNumber: false,
    mixedCarLength: false,
    platforms: PLATFORMS.map((platform) => ({ ...platform })),
    arrivals
  };

  if (scenario === 'longDestination') {
    runtime.arrivals[0] = { ...arrivals[0], destination: 'International Airport Terminal 2' };
    runtime.arrivals[1] = { ...arrivals[1], destination: 'Harborfront Exhibition Centre' };
  }

  if (scenario === 'customMessage') {
    runtime.customMessages[1] = 'Service Alert: Signal maintenance on Line B.';
  }

  if (scenario === 'hiddenRow') {
    runtime.hiddenRows = [2];
  }

  if (scenario === 'hidePlatform') {
    runtime.hidePlatformNumber = true;
  }

  if (scenario === 'emptyArrivals') {
    runtime.arrivals = [arrivals[0], null, null, null];
  }

  if (scenario === 'terminating') {
    runtime.arrivals[2] = {
      ...arrivals[2],
      terminating: true,
      destination: 'This train terminates here',
      deviation: 3
    };
  }

  return runtime;
}
