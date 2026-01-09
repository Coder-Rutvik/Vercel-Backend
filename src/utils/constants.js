// Hotel configuration constants
const HOTEL_CONFIG = {
  TOTAL_ROOMS: 97,
  TOTAL_FLOORS: 10,
  ROOMS_PER_FLOOR: {
    1: 10, 2: 10, 3: 10, 4: 10, 5: 10,
    6: 10, 7: 10, 8: 10, 9: 10, 10: 7
  },
  FLOOR_10_ROOMS: [1001, 1002, 1003, 1004, 1005, 1006, 1007],
  ROOM_TYPES: {
    STANDARD: 'standard',
    DELUXE: 'deluxe',
    SUITE: 'suite'
  },
  ROOM_PRICES: {
    standard: 100.00,
    deluxe: 150.00,
    suite: 200.00
  },
  // PDF Requirements
  PDF_REQUIREMENTS: {
    totalRooms: 97,
    floors: 10,
    roomsPerFloor: [10, 10, 10, 10, 10, 10, 10, 10, 10, 7],
    travelTime: {
      horizontalPerRoom: 1,
      verticalPerFloor: 2
    },
    booking: {
      maxRooms: 5,
      prioritySameFloor: true,
      minimizeTravelTime: true
    }
  }
};

// Travel time constants
const TRAVEL_TIME = {
  HORIZONTAL_PER_ROOM: 1, // minutes
  VERTICAL_PER_FLOOR: 2,  // minutes
  MAX_ROOMS_PER_BOOKING: 5
};

// Booking rules
const BOOKING_RULES = {
  MAX_ROOMS: 5,
  MIN_STAY_NIGHTS: 1,
  MAX_STAY_NIGHTS: 30,
  CANCELLATION_HOURS: 24, // Free cancellation up to 24 hours before check-in
  CHECK_IN_TIME: '14:00',
  CHECK_OUT_TIME: '12:00'
};

// Application constants
const APP_CONSTANTS = {
  JWT_EXPIRE: '7d',
  PAGINATION_LIMIT: 10,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  DATE_FORMAT: 'YYYY-MM-DD',
  TIME_FORMAT: 'HH:mm',
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss'
};

// Error messages
const ERROR_MESSAGES = {
  VALIDATION_ERROR: 'Validation error',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Not authorized',
  FORBIDDEN: 'Access forbidden',
  SERVER_ERROR: 'Internal server error',
  DUPLICATE_ENTRY: 'Duplicate entry found',
  INVALID_CREDENTIALS: 'Invalid credentials',
  ACCOUNT_DEACTIVATED: 'Account is deactivated',
  ROOM_UNAVAILABLE: 'Room is not available',
  MAX_ROOMS_EXCEEDED: 'Cannot book more than 5 rooms at once',
  MIN_STAY_REQUIRED: 'Minimum stay is 1 night',
  PAST_CHECKIN: 'Check-in date cannot be in the past',
  CANCELLATION_DEADLINE: 'Cannot cancel booking after check-in time',
  NO_ROOMS_AVAILABLE: 'No rooms available for selected dates',
  INSUFFICIENT_ROOMS: 'Not enough rooms available'
};

// Success messages
const SUCCESS_MESSAGES = {
  REGISTER_SUCCESS: 'User registered successfully',
  LOGIN_SUCCESS: 'Login successful',
  BOOKING_SUCCESS: 'Booking successful',
  CANCELLATION_SUCCESS: 'Booking cancelled successfully',
  UPDATE_SUCCESS: 'Updated successfully',
  DELETE_SUCCESS: 'Deleted successfully',
  ROOMS_RESET: 'All rooms reset successfully',
  RANDOM_OCCUPANCY_GENERATED: 'Random occupancy generated successfully'
};

// Status codes
const STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500
};

// Email templates
const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_CANCELLATION: 'booking_cancellation',
  PASSWORD_RESET: 'password_reset'
};

// PDF Examples from assignment
const PDF_EXAMPLES = [
  {
    scenario: "Example 1",
    availableRooms: {
      floor1: [101, 102, 105, 106],
      floor2: [201, 202, 203, 210],
      floor3: [301, 302]
    },
    bookRooms: 4,
    expectedResult: [101, 102, 105, 106],
    reason: "Rooms on Floor 1 minimize total travel time (5 minutes)"
  },
  {
    scenario: "Example 2",
    availableRooms: {
      floor1: [101, 102],
      floor2: [201, 202, 203, 210],
      floor3: [301, 302]
    },
    bookRooms: 2,
    expectedResult: [201, 202],
    reason: "Minimizes vertical (2 minutes) and horizontal (1 minute) travel times = 3 minutes total"
  }
];

// Test data for development
const TEST_DATA = {
  // Test hotel structure
  hotelStructure: {
    floors: [
      { number: 1, rooms: 10, start: 101, end: 110 },
      { number: 2, rooms: 10, start: 201, end: 210 },
      { number: 3, rooms: 10, start: 301, end: 310 },
      { number: 4, rooms: 10, start: 401, end: 410 },
      { number: 5, rooms: 10, start: 501, end: 510 },
      { number: 6, rooms: 10, start: 601, end: 610 },
      { number: 7, rooms: 10, start: 701, end: 710 },
      { number: 8, rooms: 10, start: 801, end: 810 },
      { number: 9, rooms: 10, start: 901, end: 910 },
      { number: 10, rooms: 7, start: 1001, end: 1007 }
    ]
  },
  
  // Test cases for algorithm
  algorithmTestCases: [
    {
      name: "Same floor adjacent rooms",
      rooms: [
        { number: 101, floor: 1, position: 1 },
        { number: 102, floor: 1, position: 2 }
      ],
      expectedTravelTime: 1
    },
    {
      name: "Same floor distant rooms",
      rooms: [
        { number: 101, floor: 1, position: 1 },
        { number: 110, floor: 1, position: 10 }
      ],
      expectedTravelTime: 9
    },
    {
      name: "Different floors same position",
      rooms: [
        { number: 101, floor: 1, position: 1 },
        { number: 201, floor: 2, position: 1 }
      ],
      expectedTravelTime: 2
    },
    {
      name: "Mixed floors and positions",
      rooms: [
        { number: 101, floor: 1, position: 1 },
        { number: 110, floor: 1, position: 10 },
        { number: 201, floor: 2, position: 1 }
      ],
      expectedTravelTime: 11 // 9 horizontal + 2 vertical
    }
  ]
};

module.exports = {
  HOTEL_CONFIG,
  TRAVEL_TIME,
  BOOKING_RULES,
  APP_CONSTANTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STATUS_CODES,
  EMAIL_TEMPLATES,
  PDF_EXAMPLES,
  TEST_DATA
};