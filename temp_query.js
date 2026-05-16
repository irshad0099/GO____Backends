import { pool } from './src/infrastructure/database/postgres.js';

async function check() {
  try {
    const res = await pool.query(
      "SELECT vehicle_type, base_fare, per_km_rate, platform_fee, off_peak_base, peak_base FROM vehicle_configs WHERE vehicle_type = $1",
      ['auto']
    );
    console.log("Vehicle Config:", JSON.stringify(res.rows, null, 2));

    const gst = await pool.query("SELECT gst_enabled, rider_rate_pct, platform_rate_pct FROM gst_config");
    console.log("GST Config:", JSON.stringify(gst.rows, null, 2));

    process.exit(0);
  } catch(e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
check();
