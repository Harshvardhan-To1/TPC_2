const express = require('express');
const router = express.Router();

const { sanitizeInputs } = require('../middlewares/validate');
const chatbotCtrl = require('../controllers/chatbotController');

router.post('/ask', sanitizeInputs, chatbotCtrl.ask);

module.exports = router;
