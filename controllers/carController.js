const pool = require("../db");

// GET ALL CARS (NO .filter needed anymore)
const getCars = async (req, res) => {
  try {
        const parseList = (value) => {
      if (!value) return [];
      return Array.isArray(value)
        ? value.flatMap((item) => String(item).split(","))
            .map((item) => item.trim())
            .filter(Boolean)
        : String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    };

    const {
      page = 1,
      limit: limitQuery,
      pageSize
    } = req.query;

    const makes = parseList(req.query.makes || req.query.make);
    const models = parseList(req.query.models || req.query.model);
    const variants = parseList(req.query.variants || req.query.variant);
    const specs = parseList(req.query.specs || req.query.fuel);
    const prices = parseList(req.query.prices);
    const mileages = parseList(req.query.mileage);
    const safetyRatings = parseList(req.query.safetyRating);
    const userReviews = parseList(req.query.userReviews);

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limit = Math.max(Number(limitQuery || pageSize) || 10, 1);

    const priceRanges = {
      "< 10L": { max: 1000000 },
      "10L - 20L": { min: 1000000, max: 2000000 },
      "20L - 30L": { min: 2000000, max: 3000000 },
      "30L - 40L": { min: 3000000, max: 4000000 },
      "> 40L": { min: 4000000 }
    };

    const mileageRanges = {
      "10-15 kmpl": { min: 10, max: 15 },
      "15-20 kmpl": { min: 15, max: 20 },
      "20-25 kmpl": { min: 20, max: 25 },
      "25+ kmpl": { min: 25 }
    };

    let conditions = [];
    let values = [];
    let i = 1;

    if (makes.length) {
      conditions.push(`make = ANY($${i++})`);
      values.push(makes);
    }

    if (models.length) {
      conditions.push(`model = ANY($${i++})`);
      values.push(models);
    }

    if (variants.length) {
      conditions.push(`variant = ANY($${i++})`);
      values.push(variants);
    }

    if (specs.length) {
      conditions.push(`specs->>'fuel' = ANY($${i++})`);
      values.push(specs);
    }

    if (safetyRatings.length) {
      conditions.push(`safety_rating = ANY($${i++})`);
      values.push(safetyRatings);
    }

    if (userReviews.length) {
      conditions.push(`user_review = ANY($${i++})`);
      values.push(userReviews);
    }

    if (prices.length) {
      const priceClauses = [];
      prices.forEach((label) => {
        const range = priceRanges[label];
        if (!range) return;
        if (range.min != null && range.max != null) {
          priceClauses.push(`(price >= $${i} AND price <= $${i + 1})`);
          values.push(range.min, range.max);
          i += 2;
        } else if (range.min != null) {
          priceClauses.push(`price >= $${i++}`);
          values.push(range.min);
        } else if (range.max != null) {
          priceClauses.push(`price <= $${i++}`);
          values.push(range.max);
        }
      });
      if (priceClauses.length) {
        conditions.push(`(${priceClauses.join(" OR ")})`);
      }
    }

    if (mileages.length) {
      const mileageClauses = [];
      mileages.forEach((label) => {
        const range = mileageRanges[label];
        if (!range) return;
        if (range.min != null && range.max != null) {
          mileageClauses.push(`(mileage >= $${i} AND mileage <= $${i + 1})`);
          values.push(range.min, range.max);
          i += 2;
        } else if (range.min != null) {
          mileageClauses.push(`mileage >= $${i++}`);
          values.push(range.min);
        }
      });
      if (mileageClauses.length) {
        conditions.push(`(${mileageClauses.join(" OR ")})`);
      }
    }

    const offset = (pageNumber - 1) * limit;

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT * FROM cars
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${i++}
      OFFSET $${i++}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    // total count
    const countQuery = `
      SELECT COUNT(*) FROM cars ${whereClause}
    `;

    const countResult = await pool.query(
      countQuery,
      values.slice(0, values.length - 2)
    );

    res.json({
      data: result.rows,
      total: Number(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCars };