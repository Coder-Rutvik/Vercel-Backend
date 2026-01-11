const Room = require('../models/Room');

const seedRooms = async () => {
    try {
        const roomCount = await Room.count();
        if (roomCount === 0) {
            console.log('🌱 Auto-Seeding 97 rooms...');
            const roomsToCreate = [];

            // Floors 1-9: 10 rooms each (101-110, 201-210, ..., 901-910)
            for (let floor = 1; floor <= 9; floor++) {
                for (let position = 1; position <= 10; position++) {
                    roomsToCreate.push({
                        roomNumber: floor * 100 + position,
                        floor: floor,
                        position: position,
                        roomType: 'standard',
                        status: 'not-booked',
                        basePrice: 100.00
                    });
                }
            }

            // Floor 10: 7 rooms only (1001-1007)
            for (let position = 1; position <= 7; position++) {
                roomsToCreate.push({
                    roomNumber: 1000 + position,
                    floor: 10,
                    position: position,
                    roomType: 'standard',
                    status: 'not-booked',
                    basePrice: 100.00
                });
            }

            await Room.bulkCreate(roomsToCreate);
            console.log(`✅ Automatically seeded ${roomsToCreate.length} rooms`);
            return roomsToCreate.length;
        }
        return 0; // No rooms seeded
    } catch (error) {
        console.error('❌ Room seeding error:', error);
        throw error;
    }
};

module.exports = seedRooms;
