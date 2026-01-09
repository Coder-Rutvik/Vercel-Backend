const { Sequelize, Op } = require('sequelize');
const { RoomPostgres } = require('../models/postgresql');
const Room = RoomPostgres;

class RoomService {
  async getAllRooms(filters = {}) {
    const where = {};
    
    if (filters.floor) where.floor = filters.floor;
    if (filters.roomType) where.roomType = filters.roomType;
    if (filters.isAvailable !== undefined) where.isAvailable = filters.isAvailable;
    
    if (filters.minPrice || filters.maxPrice) {
      where.basePrice = {};
      if (filters.minPrice) where.basePrice[Op.gte] = filters.minPrice;
      if (filters.maxPrice) where.basePrice[Op.lte] = filters.maxPrice;
    }
    
    return await Room.findAll({
      where,
      order: [['floor', 'ASC'], ['position', 'ASC']]
    });
  }

  async getRoomStats() {
    const stats = await Room.findAll({
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('room_id')), 'totalRooms'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN is_available = true THEN 1 ELSE 0 END')), 'availableRooms'],
        [Sequelize.fn('AVG', Sequelize.col('base_price')), 'avgPrice'],
        [Sequelize.fn('MIN', Sequelize.col('base_price')), 'minPrice'],
        [Sequelize.fn('MAX', Sequelize.col('base_price')), 'maxPrice']
      ],
      raw: true
    });

    const typeStats = await Room.findAll({
      attributes: [
        'roomType',
        [Sequelize.fn('COUNT', Sequelize.col('room_id')), 'count'],
        [Sequelize.fn('AVG', Sequelize.col('base_price')), 'avgPrice'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN is_available = true THEN 1 ELSE 0 END')), 'available']
      ],
      group: ['roomType'],
      raw: true
    });

    const floorStats = await Room.findAll({
      attributes: [
        'floor',
        [Sequelize.fn('COUNT', Sequelize.col('room_id')), 'count'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN is_available = true THEN 1 ELSE 0 END')), 'available']
      ],
      group: ['floor'],
      order: [['floor', 'ASC']],
      raw: true
    });

    return {
      overall: stats[0],
      byType: typeStats,
      byFloor: floorStats
    };
  }

  async getFloorMap(floorNumber) {
    const rooms = await Room.findAll({
      where: { floor: floorNumber },
      order: [['position', 'ASC']]
    });

    // Create floor map visualization
    const floorMap = {
      floor: floorNumber,
      totalRooms: rooms.length,
      availableRooms: rooms.filter(r => r.isAvailable).length,
      rooms: rooms.map(room => ({
        number: room.roomNumber,
        position: room.position,
        type: room.roomType,
        available: room.isAvailable,
        price: room.basePrice
      })),
      layout: this.generateFloorLayout(rooms)
    };

    return floorMap;
  }

  generateFloorLayout(rooms) {
    // Generate visual layout for the floor
    const layout = [];
    let row = [];
    
    rooms.forEach((room, index) => {
      row.push({
        room: room.roomNumber,
        type: room.roomType.charAt(0).toUpperCase(), // S, D, or U for Suite
        available: room.isAvailable ? 'A' : 'B', // A = Available, B = Booked
        position: room.position
      });
      
      // New row after every 5 rooms (for visualization)
      if ((index + 1) % 5 === 0 || index === rooms.length - 1) {
        layout.push(row);
        row = [];
      }
    });

    return layout;
  }

  async getRoomRecommendations(numRooms, preferences = {}) {
    const availableRooms = await Room.findAll({
      where: { isAvailable: true },
      order: [['floor', 'ASC'], ['position', 'ASC']]
    });

    // Apply preferences
    let filteredRooms = availableRooms;
    
    if (preferences.floor) {
      filteredRooms = filteredRooms.filter(room => room.floor === parseInt(preferences.floor));
    }
    
    if (preferences.roomType) {
      filteredRooms = filteredRooms.filter(room => room.roomType === preferences.roomType);
    }
    
    if (preferences.maxPrice) {
      filteredRooms = filteredRooms.filter(room => room.basePrice <= parseFloat(preferences.maxPrice));
    }

    // Group by floor
    const roomsByFloor = {};
    filteredRooms.forEach(room => {
      if (!roomsByFloor[room.floor]) roomsByFloor[room.floor] = [];
      roomsByFloor[room.floor].push({
        number: room.roomNumber,
        floor: room.floor,
        position: room.position,
        roomId: room.roomId,
        roomType: room.roomType,
        basePrice: room.basePrice
      });
    });

    // Find optimal rooms
    const algorithmService = require('./algorithmService');
    const availableRoomsByFloor = Object.values(roomsByFloor)
      .sort((a, b) => a[0].floor - b[0].floor);

    return await algorithmService.findOptimalRooms(availableRoomsByFloor, numRooms);
  }
}

module.exports = new RoomService();