import { getProjectModel } from "../model/index.js";

const ENTITY_MODELS = {
  trip: "Trip",
  fuel: "Fuel",
  maintenance: "Maintenance"
};

const VALID_SOURCES = ["sheet", "web", "telematics"];

// Upserts one row. When `external_ref` is present, re-submitting the same
// row (a corrected spreadsheet entry, a retried webhook) updates it in place
// instead of creating a duplicate — this is what makes Sheets/webhook
// ingestion safe to retry.
async function upsertRow(Model, row, source) {
  const doc = { ...row, source };

  if (doc.external_ref) {
    return Model.findOneAndUpdate(
      { external_ref: doc.external_ref },
      { $set: doc },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  return Model.create(doc);
}

// POST /api/:projectId/ingest/:entity
// Body: a single row object, or { rows: [ ...rows ] } for a batch push
// (e.g. a Google Apps Script trigger sending a whole sheet's worth of rows).
// Source is taken from body.source / x-ingest-source header, and must be one
// of "sheet", "web", "telematics" — defaults to "web".
export const ingest = async (req, res) => {
  try {
    const { entity } = req.params;
    const modelName = ENTITY_MODELS[entity];

    if (!modelName) {
      return res.status(400).json({
        success: false,
        message: `Unsupported entity "${entity}". Use one of: ${Object.keys(ENTITY_MODELS).join(", ")}`
      });
    }

    const headerSource = req.headers["x-ingest-source"];
    const source = req.body.source || headerSource || "web";
    if (!VALID_SOURCES.includes(source)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported source "${source}". Use one of: ${VALID_SOURCES.join(", ")}`
      });
    }

    const Model = getProjectModel(req.projectId, modelName);
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [req.body];

    const results = [];
    const errors = [];

    for (const [index, rawRow] of rows.entries()) {
      const { source: _ignored, rows: _ignoredRows, ...row } = rawRow;
      try {
        const saved = await upsertRow(Model, row, source);
        results.push(saved);
      } catch (error) {
        errors.push({ index, external_ref: rawRow.external_ref, message: error.message });
      }
    }

    const status = errors.length && !results.length ? 400 : 200;
    res.status(status).json({
      success: errors.length === 0,
      inserted_or_updated: results.length,
      failed: errors.length,
      data: results,
      errors
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
