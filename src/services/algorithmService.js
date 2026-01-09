const { Op } = require('sequelize');

class AlgorithmService {
  constructor() {
    this.HORIZONTAL_TIME = 1; // 1 minute per room
    this.VERTICAL_TIME = 2;   // 2 minutes per floor
  }

  calculateHorizontalTime(rooms) {
    if (rooms.length <= 1) return 0;
    const positions = rooms.map(r => r.position).sort((a, b) => a - b);
    return positions[positions.length - 1] - positions[0];
  }

  calculateVerticalTime(rooms) {
    if (rooms.length <= 1) return 0;
    const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
    return (floors[floors.length - 1] - floors[0]) * this.VERTICAL_TIME;
  }

  calculateTravelTime(rooms) {
    return this.calculateHorizontalTime(rooms) + this.calculateVerticalTime(rooms);
  }

  findBestOnSingleFloor(availableRooms, numRooms) {
    let bestCombination = null;
    let bestTime = Infinity;

    for (let i = 0; i <= availableRooms.length - numRooms; i++) {
      const combination = availableRooms.slice(i, i + numRooms);
      const time = this.calculateTravelTime(combination);
      if (time < bestTime) {
        bestTime = time;
        bestCombination = combination;
      }
    }

    return bestCombination;
  }

  async findOptimalRooms(availableRoomsByFloor, numRooms) {
    // Priority 1: Same floor
    for (const floorRooms of availableRoomsByFloor) {
      if (floorRooms.length >= numRooms) {
        const combination = this.findBestOnSingleFloor(floorRooms, numRooms);
        if (combination) {
          return {
            rooms: combination,
            travelTime: this.calculateTravelTime(combination),
            floors: [combination[0].floor],
            strategy: 'same_floor'
          };
        }
      }
    }

    // Priority 2: Across floors
    const allAvailableRooms = availableRoomsByFloor.flat();
    if (allAvailableRooms.length < numRooms) {
      return null;
    }

    // Brute force for max 5 rooms
    let bestCombination = null;
    let bestTime = Infinity;

    const generateCombinations = (start, current) => {
      if (current.length === numRooms) {
        const time = this.calculateTravelTime(current);
        if (time < bestTime) {
          bestTime = time;
          bestCombination = [...current];
        }
        return;
      }

      for (let i = start; i < availableRoomsByFloor.length; i++) {
        for (let j = 0; j < availableRoomsByFloor[i].length; j++) {
          current.push(availableRoomsByFloor[i][j]);
          generateCombinations(i, current);
          current.pop();
        }
      }
    };

    generateCombinations(0, []);

    if (bestCombination) {
      const floors = [...new Set(bestCombination.map(r => r.floor))].sort((a, b) => a - b);
      return {
        rooms: bestCombination,
        travelTime: bestTime,
        floors: floors,
        strategy: 'across_floors'
      };
    }

    return null;
  }

  // New method for PDF examples validation
  verifyPDFExamples() {
    // Example 1 from PDF
    const example1Rooms = [
      { number: 101, floor: 1, position: 1 },
      { number: 102, floor: 1, position: 2 },
      { number: 105, floor: 1, position: 5 },
      { number: 106, floor: 1, position: 6 }
    ];
    
    const travelTime1 = this.calculateTravelTime(example1Rooms);
    
    // Example 2 from PDF
    const example2Rooms = [
      { number: 201, floor: 2, position: 1 },
      { number: 202, floor: 2, position: 2 }
    ];
    
    const travelTime2 = this.calculateTravelTime(example2Rooms);
    
    return {
      example1: {
        rooms: [101, 102, 105, 106],
        travelTime: travelTime1,
        expected: 5, // 5 minutes as per PDF
        passed: travelTime1 === 5
      },
      example2: {
        rooms: [201, 202],
        travelTime: travelTime2,
        expected: 3, // 2 vertical + 1 horizontal = 3 minutes
        passed: travelTime2 === 3
      }
    };
  }

  // Helper method for testing
  testAlgorithm() {
    console.log('🧪 Testing Algorithm Service...');
    
    // Test 1: Single floor rooms
    const test1Rooms = [
      { number: 101, floor: 1, position: 1 },
      { number: 102, floor: 1, position: 2 },
      { number: 103, floor: 1, position: 3 }
    ];
    
    const test1Result = this.calculateTravelTime(test1Rooms);
    console.log(`Test 1 - Single floor: ${test1Result} minutes (expected: 2)`);
    
    // Test 2: Multiple floors
    const test2Rooms = [
      { number: 101, floor: 1, position: 1 },
      { number: 201, floor: 2, position: 1 },
      { number: 301, floor: 3, position: 1 }
    ];
    
    const test2Result = this.calculateTravelTime(test2Rooms);
    console.log(`Test 2 - Multiple floors: ${test2Result} minutes (expected: 4)`);
    
    // Test 3: Mixed floors and positions
    const test3Rooms = [
      { number: 101, floor: 1, position: 1 },
      { number: 102, floor: 1, position: 5 },
      { number: 210, floor: 2, position: 10 }
    ];
    
    const test3Result = this.calculateTravelTime(test3Rooms);
    console.log(`Test 3 - Mixed: ${test3Result} minutes`);
    
    // Test PDF examples
    const pdfResults = this.verifyPDFExamples();
    console.log('📋 PDF Examples Validation:');
    console.log(`  Example 1: ${pdfResults.example1.passed ? '✅ PASS' : '❌ FAIL'} (${pdfResults.example1.travelTime} minutes)`);
    console.log(`  Example 2: ${pdfResults.example2.passed ? '✅ PASS' : '❌ FAIL'} (${pdfResults.example2.travelTime} minutes)`);
    
    return {
      test1: { result: test1Result, passed: test1Result === 2 },
      test2: { result: test2Result, passed: test2Result === 4 },
      test3: { result: test3Result },
      pdfExamples: pdfResults
    };
  }
}

module.exports = new AlgorithmService();