

import {pool} from "../../../infrastructure/database/postgres.js";

export const findUserByPhone = async (phone) => {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE phone_number=$1",
    [phone]
  );
  return rows[0];
};

export const createUser = async (phone) => {
  const { rows } = await pool.query(
    "INSERT INTO users (phone_number, is_verified) VALUES ($1, true) RETURNING *",
    [phone]
  );
  return rows[0];
};

export const findUserById = async (id) => {
  const { rows } = await pool.query(
    "SELECT id, phone_number, role FROM users WHERE id=$1",
    [id]
  );
  return rows[0];
};