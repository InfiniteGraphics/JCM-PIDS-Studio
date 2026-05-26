import type { MockRuntime, MockScenario } from '../types';

const baseArrivals = [
  {
    routeName: 'Airport Express',
    routeNumber: 'A',
    routeColor: '#1769d7',
    destination: 'Airport',
    arrivalTime: '10:26',
    departureTime: '10:27',
    deviation: 0,
    realtime: true,
    terminating: false,
    platformName: '1',
    carCount: 8
  },
  {
    routeName: 'Harbor Line',
    routeNumber: 'C',
    routeColor: '#159947',
    destination: 'Harborfront',
    arrivalTime: '10:30',
    departureTime: '10:31',
    deviation: 1,
    realtime: true,
    terminating: false,
    platformName: '3',
    carCount: 6
  },
  {
    routeName: 'Downtown Line',
    routeNumber: 'B',
    routeColor: '#c45a1c',
    destination: 'Downtown',
    arrivalTime: '10:33',
    departureTime: '10:34',
    deviation: 0,
    realtime: false,
    terminating: false,
    platformName: '2',
    carCount: 8
  },
  {
    routeName: 'Tech Park Shuttle',
    routeNumber: 'D',
    routeColor: '#6c35c9',
    destination: 'Tech Park',
    arrivalTime: '10:39',
    departureTime: '10:40',
    deviation: -1,
    realtime: true,
    terminating: false,
    platformName: '4',
    carCount: 4
  }
];

function cloneBase() {
  return baseArrivals.map((arrival) => ({ ...arrival }));
}

export function getMockRuntime(scenario: MockScenario): MockRuntime {
  const arrivals = cloneBase();
  const runtime: MockRuntime = {
    type: 'rv_pids',
    width: 136,
    height: 76,
    rows: 4,
    stationName: 'Central Station',
    clock: '10:24',
    customMessages: ['', '', '', ''],
    hiddenRows: [],
    hidePlatformNumber: false,
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
    runtime.arrivals[2] = { ...arrivals[2], terminating: true, destination: 'This train terminates here', deviation: 3 };
  }

  return runtime;
}
