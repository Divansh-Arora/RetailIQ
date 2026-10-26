import { Validator } from '../utils/validate.js';
import * as svc from '../services/categories.service.js';

export const list = async (req, res) => res.json({ data: await svc.listCategories() });
export async function create(req, res) {
  const v = new Validator();
  const name = v.string(req.body?.category_name, 'category_name', { required: true, max: 100 });
  v.assert();
  res.status(201).json(await svc.createCategory(name));
}
