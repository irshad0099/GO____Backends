

import { pool } from "../../../infrastructure/database/postgres.js";

export const findUserByPhone = async (phone) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE phone_number = $1",
    [phone]
  );
  return result.rows[0];
};

export const findUserById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

export const createUser = async (phone) => {
  const result = await pool.query(
    `INSERT INTO users (phone_number, role) 
     VALUES ($1, 'passenger') 
     RETURNING *`,
    [phone]
  );
  return result.rows[0];
};

export const verifyUser = async (id) => {
  const result = await pool.query(
    `UPDATE users 
     SET is_verified = true, updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [id]
  );
  return result.rows[0];
};