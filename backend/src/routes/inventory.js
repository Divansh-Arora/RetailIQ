import { Router } from 'express';
import { asyncHandler as h } from '../middleware/asyncHandler.js';
import * as c from '../controllers/inventory.controller.js';
const r = Router();
r.get('/low-stock', h(c.lowStock));
r.get('/movements', h(c.movements));
r.post('/adjustments', h(c.adjust));
export default r;
