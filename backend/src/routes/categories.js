import { Router } from 'express';
import { asyncHandler as h } from '../middleware/asyncHandler.js';
import * as c from '../controllers/categories.controller.js';
const r = Router();
r.get('/', h(c.list));
r.post('/', h(c.create));
export default r;
