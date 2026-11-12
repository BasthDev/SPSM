import { Router } from 'express';
import authRoutes from './authRoutes';
import submissionRoutes from './submissionRoutes';
import fileRoutes from './fileRoutes';
import masterDataRoutes from './masterDataRoutes';
import notificationRoutes from './notificationRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/submissions', submissionRoutes);
router.use('/files', fileRoutes);
router.use('/notifications', notificationRoutes);
router.use('/', masterDataRoutes);

export default router;
