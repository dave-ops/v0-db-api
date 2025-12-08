// file: C:\_dev\repos\v0-db-api\src\utils\timestampUtils.js
/**
 * Utility function to manage created_utc and updated_utc timestamps for MongoDB records.
 * - Sets created_utc only if the record is being created (upsert with no match).
 * - Always updates updated_utc on every update or upsert.
 * @param {Object} data - The data object to be updated with timestamps.
 * @param {boolean} isUpdate - Whether this is an update operation (true) or insert-only (false).
 * @returns {Object} - The updated data object with timestamps.
 */
const addTimestamps = (data, isUpdate = false) => {
  const now = new Date().toISOString();
  const updatedData = { ...data };

  // For new records, set created_utc if not already set
  if (!isUpdate && !updatedData.created_utc) {
    updatedData.created_utc = now;
  }

  // Always set updated_utc to current time
  updatedData.updated_utc = now;

  return updatedData;
};

/**
 * Utility function to prepare update operation with timestamps for MongoDB.
 * @param {Object} updateData - The data to be set in the update operation.
 * @returns {Object} - The update operation object with timestamps.
 */
const prepareUpdateWithTimestamps = (updateData) => {
  const now = new Date().toISOString();
  const updatedData = { ...updateData, updated_utc: now };

  return { $set: updatedData };
};

/**
 * Utility function to prepare upsert operation with timestamps for MongoDB.
 * @param {Object} updateData - The data to be set in the upsert operation.
 * @returns {Object} - The update operation object with timestamps for upsert.
 */
const prepareUpsertWithTimestamps = (updateData) => {
  const now = new Date().toISOString();
  const updatedData = { ...updateData, updated_utc: now };

  // Ensure created_utc is set only on insert (not on update)
  return {
    $set: updatedData,
    $setOnInsert: { created_utc: now }
  };
};

module.exports = {
  addTimestamps,
  prepareUpdateWithTimestamps,
  prepareUpsertWithTimestamps
};