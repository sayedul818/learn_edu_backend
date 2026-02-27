const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const userController = require('../controllers/userController');

// List users with search/filters/pagination
router.get('/', authenticate, requireAdmin, userController.listUsers);

// Get single user
router.get('/:id', authenticate, requireAdmin, userController.getUser);

// Create user (admin)
router.post('/', authenticate, requireAdmin, userController.createUser);

// Update user
router.put('/:id', authenticate, requireAdmin, userController.updateUser);

// Change role
router.patch('/:id/role', authenticate, requireAdmin, userController.changeRole);

// Change status
router.patch('/:id/status', authenticate, requireAdmin, userController.changeStatus);

// Reset password
router.patch('/:id/reset-password', authenticate, requireAdmin, userController.resetPassword);

// Delete user
router.delete('/:id', authenticate, requireAdmin, userController.deleteUser);

module.exports = router;
