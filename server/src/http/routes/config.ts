// @ts-nocheck
import express from 'express';
const router = express.Router();
import config from '@config/index.ts';

router.get('/getURI', (req, res) => {
  return res.status(200).json(config.get('systems'));
});

router.get('/getClients', (req, res) => {
  return res.status(200).json(config.get('clients'));
});

export default router;
