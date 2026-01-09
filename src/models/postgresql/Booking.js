const { DataTypes } = require('sequelize');
const { sequelizePostgres } = require('../../config/database');

const BookingPostgres = sequelizePostgres.define('Booking', {
  bookingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    field: 'booking_id'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id'
  },
  rooms: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Array of room numbers booked'
  },
  totalRooms: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'total_rooms'
  },
  travelTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'travel_time'
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_price'
  },
  bookingDate: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
    field: 'booking_date'
  },
  checkInDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'check_in_date'
  },
  checkOutDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'check_out_date'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    defaultValue: 'confirmed',
    allowNull: false
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'refunded'),
    defaultValue: 'pending',
    field: 'payment_status'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'bookings',
  timestamps: true
});

module.exports = BookingPostgres;

