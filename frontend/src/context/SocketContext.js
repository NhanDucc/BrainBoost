import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useUser } from './UserContext';

// Create the Context for global socket access
const SocketContext = createContext(null);

/**
 * Custom hook to easily consume the Socket instance anywhere in the app.
 * Usage: const socket = useSocket();
 */
export const useSocket = () => useContext(SocketContext);

/**
 * SocketProvider Component
 * Wraps the application and manages the lifecycle of the Socket.IO connection.
 * It automatically connects when a user logs in and disconnects when they log out.
 */
export const SocketProvider = ({ children }) => {
    const { user } = useUser();
    const [socket, setSocket] = useState(null);

    // Safely extract the user ID (supporting both '_id' from MongoDB and 'id')
    const currentUserId = user?._id || user?.id;

    useEffect(() => {
        // Only establish a connection if we have a valid logged-in user
        if (currentUserId) {
            // Use environment variable for production, fallback to localhost:8080 for development
            const backendUrl = process.env.REACT_APP_BACKEND_URL; 
            
            // Initialize the socket connection
            const newSocket = io(backendUrl, {
                query: { userId: currentUserId }, // Pass userId to the backend upon connection
                withCredentials: true,            // Required for CORS and sending cookies
                transports: ['websocket', 'polling'] // Prefer WebSocket, fallback to HTTP long-polling
            });

            setSocket(newSocket);

            // Cleanup function: Disconnect the socket when the component unmounts 
            // or when the currentUserId changes
            return () => {
                newSocket.disconnect();
            };
        } else {
            // If there is no user (e.g., they logged out), disconnect any active socket
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserId]); // Dependency array: re-run this effect whenever the user ID changes

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};