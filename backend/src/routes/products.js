import { Router } from 'express';
import { asyncHandler as h } from '../middleware/asyncHandler.js';
import * as c from '../controllers/products.controller.js';
const r = Router();
r.get('/', h(c.list));
r.post('/', h(c.create));
r.get('/:id', h(c.get));
r.put('/:id', h(c.update));
export default r;
