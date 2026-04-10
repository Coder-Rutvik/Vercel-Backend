const Joi = require('joi');
const { ERROR_MESSAGES, BOOKING_RULES } = require('../utils/constants');

// Booking creation validation schema
const createBookingSchema = Joi.object({
  numRooms: Joi.number()
    .integer()
    .min(1)
    .max(BOOKING_RULES.MAX_ROOMS)
    .required()
    .messages({
      'number.base': 'Number of rooms must be a number',
      'number.integer': 'Number of rooms must be an integer',
      'number.min': `Minimum ${1} room required`,
      'number.max': `Cannot book more than ${BOOKING_RULES.MAX_ROOMS} rooms at once`,
      'any.required': 'Number of rooms is required'
    }),
  
  checkInDate: Joi.date()
    .greater('now')
    .required()
    .messages({
      'date.base': 'Please provide a valid check-in date',
      'date.greater': 'Check-in date cannot be in the past',
      'any.required': 'Check-in date is required'
    }),
  
  checkOutDate: Joi.date()
    .greater(Joi.ref('checkInDate'))
    .required()
    .messages({
      'date.base': 'Please provide a valid check-out date',
      'date.greater': 'Check-out date must be after check-in date',
      'any.required': 'Check-out date is required'
    }),

  roomType: Joi.alternatives()
    .try(
      Joi.valid('Any', 'Standard', 'Deluxe (AC)', 'Suite', 'Premium')
    )
    .optional(),

  floorPreference: Joi.alternatives()
    .try(
      Joi.valid('Any'),
      Joi.number().integer().min(1)
    )
    .optional(),

  selectedRoomNumbers: Joi.array()
    .items(Joi.number().integer().min(1))
    .optional(),
  
  specialRequests: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Special requests cannot exceed 500 characters'
    })
});

// Booking update validation schema
const updateBookingSchema = Joi.object({
  checkInDate: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.base': 'Please provide a valid check-in date',
      'date.greater': 'Check-in date cannot be in the past'
    }),
  
  checkOutDate: Joi.date()
    .greater(Joi.ref('checkInDate'))
    .optional()
    .messages({
      'date.base': 'Please provide a valid check-out date',
      'date.greater': 'Check-out date must be after check-in date'
    }),
  
  specialRequests: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Special requests cannot exceed 500 characters'
    }),
  
  status: Joi.string()
    .valid('pending', 'confirmed', 'cancelled', 'completed')
    .optional()
    .messages({
      'any.only': 'Invalid booking status'
    })
});

// Booking query parameters validation schema
const bookingQuerySchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'cancelled', 'completed')
    .optional()
    .messages({
      'any.only': 'Invalid booking status'
    }),
  
  startDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Invalid start date format'
    }),
  
  endDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Invalid end date format'
    }),
  
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional()
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
});

// Room search validation schema
const roomSearchSchema = Joi.object({
  floor: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .optional()
    .messages({
      'number.base': 'Floor must be a number',
      'number.integer': 'Floor must be an integer',
      'number.min': 'Floor must be at least 1',
      'number.max': 'Floor cannot exceed 10'
    }),
  
  roomType: Joi.string()
    .valid('standard', 'deluxe', 'suite')
    .optional()
    .messages({
      'any.only': 'Invalid room type'
    }),
  
  minPrice: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Minimum price must be a number',
      'number.min': 'Minimum price cannot be negative'
    }),
  
  maxPrice: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Maximum price must be a number',
      'number.min': 'Maximum price cannot be negative'
    }),
  
  available: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Available must be true or false'
    }),
  
  sortBy: Joi.string()
    .valid('floor', 'price', 'roomNumber')
    .optional()
    .messages({
      'any.only': 'Invalid sort field'
    }),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .messages({
      'any.only': 'Sort order must be asc or desc'
    })
});

// Validate function
const validate = (schema) => {
  return (req, res, next) => {
    let dataToValidate;
    
    // Determine which data to validate based on request method
    if (req.method === 'GET') {
      dataToValidate = req.query;
    } else {
      dataToValidate = req.body;
    }

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        errors: errorMessages
      });
    }

    // Update request with validated data
    if (req.method === 'GET') {
      req.query = value;
    } else {
      req.body = value;
    }
    
    next();
  };
};

// Export validators
module.exports = {
  createBookingSchema,
  updateBookingSchema,
  bookingQuerySchema,
  roomSearchSchema,
  validateCreateBooking: validate(createBookingSchema),
  validateUpdateBooking: validate(updateBookingSchema),
  validateBookingQuery: validate(bookingQuerySchema),
  validateRoomSearch: validate(roomSearchSchema)
};