import { handlers } from '@/server/auth';

/**
 * @swagger
 * /api/auth/{nextauth}:
 *   get:
 *     summary: NextAuth handler endpoint
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: nextauth
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auth handler response
 *   post:
 *     summary: NextAuth handler endpoint
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: nextauth
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auth handler response
 */
export const { GET, POST } = handlers;
