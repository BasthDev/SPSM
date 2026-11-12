import { Router } from 'express';
import authRoutes from './authRoutes';
import submissionRoutes from './submissionRoutes';
import fileRoutes from './fileRoutes';
import masterDataRoutes from './masterDataRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/submissions', submissionRoutes);
router.use('/files', fileRoutes);
router.use('/', masterDataRoutes);

export default router;
