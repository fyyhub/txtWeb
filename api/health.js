const { sendJson } = require("./_lib/http");
const { getStorageMode } = require("./_lib/store");

module.exports = function handler(_req, res) {
  return sendJson(res, 200, {
    ok: true,
    storage: getStorageMode(),
    now: new Date().toISOString()
  });
};
