const { Sequelize, Op } = require('sequelize');
const { RoomPostgres, BookingPostgres, UserPostgres } = require('../models/postgresql');
const algorithmService = require('./algorithmService');

const Room = RoomPostgres;
const Booking = BookingPostgres;
const User = UserPostgres;

class BookingService {
  async validateBooking(numRooms, checkInDate, checkOutDate) {
    // Validate number of rooms
    if (!numRooms || numRooms < 1 || numRooms > 5) {
      return { valid: false, message: 'Number of rooms must be between 1 and 5' };
    }

    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      return { valid: false, message: 'Check-in date cannot be in the past' };
    }

    if (checkOut <= checkIn) {
      return { valid: false, message: 'Check-out date must be after check-in date' };
    }

    // Check minimum stay (1 night)
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    if (nights < 1) {
      return { valid: false, message: 'Minimum stay is 1 night' };
    }

    return { valid: true, nights };
  }

  async findOptimalRooms(numRooms, checkInDate, checkOutDate) {
    try {
      // Get all available rooms
      const availableRooms = await Room.findAll({
        where: { isAvailable: true },
        order: [['floor', 'ASC'], ['position', 'ASC']]
      });

      // Get all bookings that overlap with the requested dates
      const conflictingBookings = await Booking.findAll({
        where: {
          [Op.or]: [
            // Check-in between existing booking
            {
              checkInDate: { [Op.lte]: checkOutDate },
              checkOutDate: { [Op.gte]: checkInDate },
              status: 'confirmed'
            }
          ]
        }
      });

      // Get room numbers that are already booked
      const bookedRoomNumbers = new Set();
      conflictingBookings.forEach(booking => {
        if (Array.isArray(booking.rooms)) {
          booking.rooms.forEach(roomNumber => {
            bookedRoomNumbers.add(roomNumber);
          });
        }
      });

      // Filter out rooms that are already booked
      const trulyAvailableRooms = availableRooms.filter(
        room => !bookedRoomNumbers.has(room.roomNumber)
      );

      // Group by floor for algorithm
      const roomsByFloor = {};
      const formattedRooms = trulyAvailableRooms.map(room => ({
        number: room.roomNumber,
        floor: room.floor,
        position: room.position,
        roomId: room.roomId,
        roomType: room.roomType,
        basePrice: room.basePrice
      }));

      formattedRooms.forEach(room => {
        if (!roomsByFloor[room.floor]) roomsByFloor[room.floor] = [];
        roomsByFloor[room.floor].push(room);
      });

      // Convert to array for algorithm
      const availableRoomsByFloor = Object.values(roomsByFloor)
        .sort((a, b) => a[0].floor - b[0].floor);

      // Find optimal rooms using algorithm service
      const result = await algorithmService.findOptimalRooms(availableRoomsByFloor, numRooms);

      if (!result) {
        return null;
      }

      return {
        rooms: result.rooms,
        travelTime: result.travelTime,
        floors: result.floors,
        strategy: result.strategy
      };
    } catch (error) {
      console.error('Error in findOptimalRooms:', error);
      return null;
    }
  }

  async calculateTotalPrice(optimalRooms, checkInDate, checkOutDate) {
    try {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      // Get room details for pricing
      const roomIds = optimalRooms.rooms.map(r => r.roomId);
      const rooms = await Room.findAll({
        where: { roomId: roomIds }
      });

      // Calculate total price
      let totalPrice = 0;
      rooms.forEach(room => {
        let basePrice = parseFloat(room.basePrice);
        
        // Apply pricing rules
        let pricePerNight = basePrice;
        
        // Weekend pricing (Friday, Saturday)
        const checkInDay = checkIn.getDay();
        if (checkInDay === 5 || checkInDay === 6) { // 5 = Friday, 6 = Saturday
          pricePerNight *= 1.2; // 20% increase on weekends
        }
        
        // Peak season pricing (Dec 20 - Jan 5)
        const checkInMonth = checkIn.getMonth();
        const checkInDateNum = checkIn.getDate();
        if (checkInMonth === 11 && checkInDateNum >= 20) { // December 20-31
          pricePerNight *= 1.3; // 30% increase
        }
        if (checkInMonth === 0 && checkInDateNum <= 5) { // January 1-5
          pricePerNight *= 1.3; // 30% increase
        }
        
        totalPrice += pricePerNight * nights;
      });

      return parseFloat(totalPrice.toFixed(2));
    } catch (error) {
      console.error('Error in calculateTotalPrice:', error);
      return 0;
    }
  }

  async updateRoomAvailability(roomNumbers, isAvailable) {
    try {
      await Room.update(
        { isAvailable },
        {
          where: {
            roomNumber: roomNumbers
          }
        }
      );
      return true;
    } catch (error) {
      console.error('Error updating room availability:', error);
      return false;
    }
  }

  async getBookingSummary(bookingId) {
    try {
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['name', 'email', 'phone']
          }
        ]
      });

      if (!booking) return null;

      // Get room details
      const rooms = await Room.findAll({
        where: {
          roomNumber: booking.rooms
        }
      });

      return {
        booking,
        rooms,
        totalNights: Math.ceil(
          (new Date(booking.checkOutDate) - new Date(booking.checkInDate)) / (1000 * 60 * 60 * 24)
        )
      };
    } catch (error) {
      console.error('Error in getBookingSummary:', error);
      return null;
    }
  }

  // New method to validate against PDF examples
  async testPDFExamples() {
    console.log('📋 Testing PDF Examples...');
    
    // Example 1: Floor 1 has 101, 102, 105, 106 available
    const example1Result = await this.simulatePDFExample1();
    console.log('Example 1 - Should pick 101, 102, 105, 106:', example1Result);
    
    // Example 2: Only 2 rooms on Floor 1, should pick from Floor 2
    const example2Result = await this.simulatePDFExample2();
    console.log('Example 2 - Should pick 201, 202:', example2Result);
    
    return { example1: example1Result, example2: example2Result };
  }

  async simulatePDFExample1() {
    // Simulate Example 1 from PDF
    const mockRooms = [
      { number: 101, floor: 1, position: 1, isAvailable: true },
      { number: 102, floor: 1, position: 2, isAvailable: true },
      { number: 105, floor: 1, position: 5, isAvailable: true },
      { number: 106, floor: 1, position: 6, isAvailable: true }
    ];
    
    const optimal = algorithmService.findBestOnSingleFloor(mockRooms, 4);
    return optimal ? optimal.map(r => r.number) : null;
  }

  async simulatePDFExample2() {
    // Simulate Example 2 from PDF
    const mockFloor1Rooms = [
      { number: 101, floor: 1, position: 1, isAvailable: true },
      { number: 102, floor: 1, position: 2, isAvailable: true }
    ];
    
    const mockFloor2Rooms = [
      { number: 201, floor: 2, position: 1, isAvailable: true },
      { number: 202, floor: 2, position: 2, isAvailable: true },
      { number: 203, floor: 2, position: 3, isAvailable: true },
      { number: 210, floor: 2, position: 10, isAvailable: true }
    ];
    
    const availableRoomsByFloor = [mockFloor1Rooms, mockFloor2Rooms];
    const result = await algorithmService.findOptimalRooms(availableRoomsByFloor, 2);
    
    return result ? result.rooms.map(r => r.number) : null;
  }
}

module.exports = new BookingService();