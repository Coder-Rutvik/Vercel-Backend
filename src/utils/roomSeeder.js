const Room = require('../models/Room');
const Booking = require('../models/Booking');

const seedRooms = async (numRooms = 150) => {
    try {
        const roomCount = await Room.count();
        if (roomCount < numRooms) {
            console.log(`🌱 [SaaS Seed] Re-building database to support ${numRooms} dynamic rooms...`);
            
            // For a clean slate on demo seed:
            await Room.destroy({ where: {} });
            
            const roomsToCreate = [];

            // Distribution logic (SaaS independent)
            // 60/150 = 40%, 40/150 = 26.6%, 30/150 = 20%, 20/150 = 13.4%
            const c_standard = Math.round(numRooms * 0.40);
            const c_deluxe = Math.round(numRooms * 0.266);
            const c_suite = Math.round(numRooms * 0.20);
            const c_premium = numRooms - (c_standard + c_deluxe + c_suite); // remainders

            // Configuration
            const types = [
                { count: c_standard, type: 'Standard', price: 1000 },
                { count: c_deluxe,   type: 'Deluxe (AC)', price: 2000 },
                { count: c_suite,    type: 'Suite', price: 4000 },
                { count: c_premium,  type: 'Premium', price: 7000 }
            ];

            let globalCounter = 0;
            let currentFloor = 1;
            let currentPosition = 1;

            for (const t of types) {
                for(let i = 0; i < t.count; i++) {
                    roomsToCreate.push({
                        roomNumber: (currentFloor * 100) + currentPosition,
                        floor: currentFloor,
                        position: currentPosition,
                        roomType: t.type,
                        status: 'not-booked',
                        basePrice: t.price
                    });
                    
                    currentPosition++;
                    globalCounter++;

                    // 10 rooms per floor max for UI consistency
                    if (currentPosition > 10) {
                        currentFloor++;
                        currentPosition = 1;
                    }
                }
            }

            await Room.bulkCreate(roomsToCreate);
            console.log(`✅ [SaaS Seed] Automatically seeded ${roomsToCreate.length} rooms.`);
            console.log(`Distribution: ${c_standard} Standard, ${c_deluxe} Deluxe, ${c_suite} Suite, ${c_premium} Premium.`);
            return roomsToCreate.length;
        }
        return roomCount; 
    } catch (error) {
        console.error('❌ Room seeding error:', error);
        throw error;
    }
};

module.exports = seedRooms;
