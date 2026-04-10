/**
 * Display helpers for rooms (no DB migration — capacity derived from room type).
 */
const CAPACITY_BY_TYPE = {
  Standard: 2,
  'Deluxe (AC)': 2,
  Suite: 4,
  Premium: 2
};

function capacityForType(roomType) {
  if (!roomType) return 2;
  return CAPACITY_BY_TYPE[roomType] ?? 2;
}

function enrichRoomRecord(room) {
  const json = room && typeof room.toJSON === 'function' ? room.toJSON() : { ...room };
  const cap = capacityForType(json.roomType);
  const price = json.basePrice != null ? parseFloat(json.basePrice) : null;
  return {
    ...json,
    capacity: cap,
    pricePerNight: Number.isFinite(price) ? price : null
  };
}

module.exports = { enrichRoomRecord, capacityForType, CAPACITY_BY_TYPE };
