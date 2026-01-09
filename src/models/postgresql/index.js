const { sequelizePostgres } = require('../../config/database');
const UserPostgres = require('./User');
const RoomPostgres = require('./Room');
const BookingPostgres = require('./Booking');

// Define associations for PostgreSQL
BookingPostgres.belongsTo(UserPostgres, {
  foreignKey: 'userId',
  as: 'user'
});

UserPostgres.hasMany(BookingPostgres, {
  foreignKey: 'userId',
  as: 'bookings'
});

module.exports = {
  sequelizePostgres,
  UserPostgres,
  RoomPostgres,
  BookingPostgres
};

