const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const { listSyncJobLogs, listUnmatchedProjectLinks } = require('../controllers/syncLogController');

const router = express.Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get('/', listSyncJobLogs);
router.get('/unmatched-project-links', listUnmatchedProjectLinks);

module.exports = router;
