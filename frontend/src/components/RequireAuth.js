import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function RequireAuth({ roles = [] }) {
    const { user, authResolved } = useUser();
    const location = useLocation();

    if (!authResolved) return null;
    if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

    if (roles.length && !roles.includes(user.role)) {
        return <Navigate to="/403" replace />;
    }
    return <Outlet />;
}
