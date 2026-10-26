import { pool } from '../config/db.js';

export async function listCategories() {
  const [rows] = await pool.query(
    `SELECT c.category_id, c.category_name, COUNT(p.product_id) AS product_count
     FROM categories c LEFT JOIN products p ON p.category_id = c.category_id
     GROUP BY c.category_id, c.category_name ORDER BY c.category_name`);
  return rows;
}

export async function createCategory(name) {
  const [res] = await pool.query('INSERT INTO categories (category_name) VALUES (?)', [name]);
  return { category_id: res.insertId, category_name: name, product_count: 0 };
}
