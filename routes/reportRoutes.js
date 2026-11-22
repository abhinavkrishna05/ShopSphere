const router = require('express').Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const { salesReport, inventoryReport } = require('../controllers/reportController');

router.use(authenticate, authorizeRoles('seller', 'admin'));

router.get('/sales', salesReport);
router.get('/inventory', inventoryReport);

module.exports = router;
