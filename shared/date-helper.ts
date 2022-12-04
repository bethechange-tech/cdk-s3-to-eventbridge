/**
 * create access token to monitor if user is logged in or out
 * @param startDate
 * @param endDate
 * @example
 *  createSendAccessToken(startDate, endDate);
 * // returns {Number}
 * @returns {Number} of how many months apart start and end date is
 */
export function getMonthDifference(startDate: Date, endDate: Date) {
  return (
    endDate.getMonth() -
    startDate.getMonth() +
    12 * (endDate.getFullYear() - startDate.getFullYear())
  );
}
