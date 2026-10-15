// Parses optional ?from= / ?to= query params into an appointment_date range.
// Returns { range } on success or { error } when a value is not a valid date.
const parseDateRange = (query = {}) => {
  const range = {};
  for (const key of ['from', 'to']) {
    if (query[key] === undefined || query[key] === '') continue;
    const date = new Date(query[key]);
    if (Number.isNaN(date.getTime())) {
      return { error: `${key} must be a valid date` };
    }
    range[key] = date.toISOString();
  }
  if (range.from && range.to && range.from >= range.to) {
    return { error: 'from must be earlier than to' };
  }
  return { range };
};

module.exports = { parseDateRange };
