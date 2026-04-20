const socketIo = require('socket.io');
const Notification = require('../models/Notification');

class SocketService {
    constructor() {
        this.io = null;
        // Use a Map to associate a userId with a Set of socketIds
        this.userSockets = new Map(); 
    }

    init(server) {
        // Initialize Socket.IO with CORS settings matching Express
        this.io = socketIo(server, {
            cors: {
                origin: 'http://localhost:3000',
                methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
                credentials: true
            }
        });

        this.io.on('connection', (socket) => {
            // Extract userId from the connection query
            const userId = socket.handshake.query.userId;

            if (userId && userId !== 'undefined') {
                if (!this.userSockets.has(userId)) {
                    this.userSockets.set(userId, new Set());
                }
                this.userSockets.get(userId).add(socket.id);
            }

            // Handle tab closure or network disconnection
            socket.on('disconnect', () => {
                if (userId && this.userSockets.has(userId)) {
                    this.userSockets.get(userId).delete(socket.id);
                    // Clean up the Map entry if the user has closed all tabs to save memory
                    if (this.userSockets.get(userId).size === 0) {
                        this.userSockets.delete(userId);
                    }
                }
            });
        });
    }

    /**
     * Utility function to emit a real-time event to a specific user across all their active tabs.
     * @param {String} userId - The ID of the recipient user.
     * @param {String} eventName - The name of the event (e.g., 'new_notification').
     * @param {Object} data - The payload data to send.
     */
    sendToUser(userId, eventName, data) {
        if (this.io && this.userSockets.has(userId.toString())) {
            const socketIds = this.userSockets.get(userId.toString());
            // Broadcast the event to all tabs opened by this user
            socketIds.forEach(socketId => {
                this.io.to(socketId).emit(eventName, data);
            });
        }
    }

    /**
     * Dual-action function: Saves the notification to the database and emits it via Socket.IO.
     */
    async sendNotification({ userId, title, message, type = 'system', link = '' }) {
        try {
            // Save notification to the database
            const newNotif = await Notification.create({
                user: userId,
                title,
                message,
                type,
                link,
                isRead: false
            });

            const targetId = userId.toString();

            // Emit signal via Socket (if the user has an active connection)
            if (this.io && this.userSockets.has(targetId)) {
                const socketIds = this.userSockets.get(targetId);
                socketIds.forEach(socketId => {
                    this.io.to(socketId).emit('new_notification', newNotif); 
                });
            }

            return newNotif;
        } catch (error) {
            console.error('[SocketService] Error creating notification:', error);
        }
    }

    /**
     * Dispatches a notification to all users with Admin privileges.
     */
    async notifyAdmins({ title, message, type = 'system', link = '' }) {
        try {
            // Require locally to prevent circular dependency issues
            const User = require('../models/User'); 
            
            // Find all users with the 'admin' role
            const admins = await User.find({ role: 'admin' }).select('_id');
            
            // Map through admins and execute the send mechanism concurrently
            const notifications = admins.map(admin => 
                this.sendNotification({
                    userId: admin._id,
                    title,
                    message,
                    type,
                    link
                })
            );
            
            await Promise.all(notifications);
        } catch (error) {
            console.error('[SocketService] Error notifying admins:', error);
        }
    }

    /**
     * System Broadcast: Sends a notification to every single user in the system.
     */
    async broadcastNotification({ title, message, type = 'system', link = '' }) {
        try {
            const User = require('../models/User');
            
            // Fetch all user IDs (For massive systems, a message queue is preferred, but insertMany is optimal here)
            const users = await User.find({}).select('_id');
            const notifications = users.map(u => ({
                user: u._id, title, message, type, link, isRead: false
            }));

            // Bulk Insert: Save to DB in one operation for performance efficiency
            await Notification.insertMany(notifications);

            // io.emit pushes the event to ALL connected clients without needing a loop
            const targetNotif = { title, message, type, link, createdAt: new Date(), isRead: false };
            if (this.io) {
                this.io.emit('new_notification', targetNotif);
            }
        } catch (error) {
            console.error('[SocketService] Error broadcasting notification:', error);
        }
    }

    /**
     * Read Status Sync: Notifies all active tabs of a user that a notification was read.
     */
    syncReadStatus(userId, notifId) {
        this.sendToUser(userId, 'sync_read_status', { notifId });
    }
}

// Export as a Singleton to ensure one shared instance across all controllers
module.exports = new SocketService();