const dayjs = require('dayjs');

/**
 * Get start and end date strings for a given month/year
 */
const getMonthRange = (month, year) => {
  const base = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  return {
    start: base.startOf('month').format('YYYY-MM-DD'),
    end: base.endOf('month').format('YYYY-MM-DD'),
  };
};

/**
 * Count working days (Mon–Fri) between two dates inclusive
 */
const getWorkingDays = (startDate, endDate) => {
  let count = 0;
  let current = dayjs(startDate);
  const end = dayjs(endDate);
  while (!current.isAfter(end)) {
    const dow = current.day();
    if (dow !== 0 && dow !== 6) count++;
    current = current.add(1, 'day');
  }
  return count;
};

/**
 * Calculate decimal work hours between two HH:mm:ss strings
 */
const calcWorkHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const base = dayjs().format('YYYY-MM-DD');
  const diff = dayjs(`${base} ${checkOut}`).diff(dayjs(`${base} ${checkIn}`), 'minute');
  return parseFloat((diff / 60).toFixed(2));
};

module.exports = { getMonthRange, getWorkingDays, calcWorkHours };
