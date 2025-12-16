// Test setup file for vitest
import { vi } from 'vitest'

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  firebaseAuth: {
    currentUser: null,
  },
  fbDb: {},
  firebaseRtdb: {},
}))

// Mock Capacitor
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    requestPermissions: vi.fn(),
    getCurrentPosition: vi.fn(),
  },
}))