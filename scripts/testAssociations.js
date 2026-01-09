const { sequelizePostgres: sequelize } = require('../src/config/database');
const { BookingPostgres, UserPostgres } = require('../src/models/postgresql');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected for test');

    const bookings = await BookingPostgres.findAll({
      limit: 5,
      include: [{ model: UserPostgres, as: 'user', attributes: ['userId', 'name', 'email'] }]
    });

    console.log('Bookings (with user):', bookings.map(b => ({ bookingId: b.bookingId, user: b.user ? b.user.name : null })));
    process.exit(0);
  } catch (err) {
    console.error('Association test error:', err);
    process.exit(1);
  }
})();