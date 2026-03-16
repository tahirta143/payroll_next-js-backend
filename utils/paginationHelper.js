/**
 * Parse page/limit from query, return offset
 */
const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Wrap data array with pagination metadata
 */
const paginatedResponse = (data, count, page, limit) => ({
  data,
  pagination: {
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    hasNextPage: page < Math.ceil(count / limit),
    hasPrevPage: page > 1,
  },
});

module.exports = { paginate, paginatedResponse };
