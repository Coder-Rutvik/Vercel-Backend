const { UserPostgres } = require('../models/postgresql');
const { sequelizePostgres } = require('../config/database');

const testPostgres = async () => {
  try {
    console.log('🔄 Starting Postgres verification...');

    await sequelizePostgres.authenticate();
    console.log('✅ Postgres connected');

    const mockUser = {
      name: 'Test Postgres',
      email: `test_postgres_${Date.now()}@example.com`,
      password: 'password123',
      phone: '1234567890'
    };

    console.log('📝 Testing Postgres Model Insert...');
    const user = await UserPostgres.create({
      name: mockUser.name,
      email: mockUser.email,
      password: mockUser.password,
      phone: mockUser.phone,
      role: 'user'
    });

    console.log(`✅ Postgres User Created: ID ${user.userId}`);
    await user.destroy();
    console.log('✅ Postgres User Cleaned up');

    console.log('🎉 Verification Script Passed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification Failed:', error);
    process.exit(1);
  }
};

testPostgres();
