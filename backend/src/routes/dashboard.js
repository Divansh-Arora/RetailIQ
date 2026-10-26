import { Router } from 'express';
import { asyncHandler as h } from '../middleware/asyncHandler.js';
import * as c from '../controllers/reports.controller.js';
const r = Router();
r.get('/summary', h(c.summary));
r.get('/monthly-sales', h(c.monthlySales));
r.get('/top-products', h(c.topProducts));
r.get('/category-sales', h(c.categorySales));
export default r;
