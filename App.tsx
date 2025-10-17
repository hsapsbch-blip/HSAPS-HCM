import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Session, RealtimeChannel } from '@supabase/supabase-js';
import { Profile, Notification } from './types';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';

// Page imports using React.lazy
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const Users = lazy(() => import('./pages/Users'));
const Sponsors = lazy(() => import('./pages/Sponsors'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Submissions = lazy(() => import('./pages/Submissions'));
const Speakers = lazy(() => import('./pages/Speakers'));
const Program = lazy(() => import('./pages/Program'));
const Finance = lazy(() => import('./pages/Finance'));
const Documents = lazy(() => import('./pages/Documents'));
const Settings = lazy(() => import('./pages/Settings'));
const RoleManagement = lazy(() => import('./pages/settings/RoleManagement'));
const EmailSettings = lazy(() => import('./pages/settings/EmailSettings'));
const ZaloSettings = lazy(() => import('./pages/settings/ZaloSettings'));
const EmailTemplates = lazy(() => import('./pages/settings/EmailTemplates'));
const AbitstoreSettings = lazy(() => import('./pages/settings/AbitstoreSettings'));
import SpeakerRegistration from './pages/SpeakerRegistration'; // Eagerly import to fix loading issue
const NotFound = lazy(() => import('./pages/NotFound'));


// Component imports
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import OneSignalInitializer from './components/OneSignalInitializer';

// Auth context
interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  notifications: Notification[];
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  logout: () => void;
  markNotificationAsRead: (id: number) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  createNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read' | 'user_id'> & { user_id: string }) => Promise<void>;
  notifyAdmins: (message: string, link: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Auth provider component
const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [permissions, setPermissions] = useState<string[]>([]);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setLoading(false);
            
            const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session);
            });
    
            return () => {
                authListener.subscription.unsubscribe();
            };
        };
        
        getSession();
    }, []);

    useEffect(() => {
        const fetchUserData = async () => {
            if (session?.user) {
                // Fetch profile
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                
                if (profileError) {
                    console.error("Error fetching profile:", profileError.message);
                    setProfile(null);
                    setPermissions([]);
                    return;
                }

                setProfile(profileData);

                // Fetch permissions for the user's role
                if (profileData?.role) {
                    const { data: permissionData, error: permissionError } = await supabase
                        .from('role_permissions')
                        .select('permission')
                        .eq('role', profileData.role);
                    
                    if (!permissionError && permissionData) {
                        setPermissions(permissionData.map(p => p.permission));
                    } else {
                        console.error("Error fetching permissions:", permissionError?.message);
                        setPermissions([]); // Default to no permissions if fetch fails
                    }
                }

                // Fetch initial notifications
                const { data: notificationsData, error: notificationsError } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });

                if (!notificationsError) setNotifications(notificationsData || []);

            } else {
                setProfile(null);
                setNotifications([]);
                setPermissions([]);
            }
        };

        fetchUserData();
        
        let channel: RealtimeChannel;
        if (session?.user) {
             channel = supabase
                .channel('public:notifications')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
                    (payload) => {
                        setNotifications(currentNotifications => [payload.new as Notification, ...currentNotifications]);
                    }
                )
                .subscribe();
        }
            
        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };

    }, [session]);

    const logout = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);
    
    const markNotificationAsRead = useCallback(async (id: number) => {
        setNotifications(currentNotifications => 
            currentNotifications.map(n => n.id === id ? { ...n, read: true } : n)
        );
        await supabase.from('notifications').update({ read: true }).eq('id', id);
    }, []);

    const clearAllNotifications = useCallback(async () => {
        if (!session?.user) return;
        setNotifications(currentNotifications => 
            currentNotifications.map(n => ({...n, read: true}))
        );
        await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', session.user.id)
            .eq('read', false);
    }, [session]);

    const createNotification = useCallback(async (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => {
        const { error } = await supabase.from('notifications').insert([{ ...notification, read: false }]);
        if (error) console.error('Error creating notification:', error.message);
    }, []);

    const notifyAdmins = useCallback(async (message: string, link: string) => {
        const { data: admins, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'Quản trị viên');
        
        if (error || !admins) {
            console.error("Error fetching admins to notify:", error);
            return;
        }

        const notificationsToInsert = admins.map(admin => ({
            user_id: admin.id,
            message,
            link,
            read: false,
        }));
        
        const { error: insertError } = await supabase.from('notifications').insert(notificationsToInsert);
        if (insertError) console.error('Error creating admin notifications:', insertError.message);
    }, []);
    
    const hasPermission = useCallback((permission: string): boolean => {
        // Super admin role always has all permissions, as a safeguard.
        if (profile?.role === 'Quản trị viên') {
            return true;
        }
        return permissions.includes(permission);
    }, [profile, permissions]);

    const value: AuthContextType = {
        session,
        profile,
        loading,
        notifications,
        permissions,
        hasPermission,
        logout,
        markNotificationAsRead,
        clearAllNotifications,
        createNotification,
        notifyAdmins,
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

// Protected route component that also serves as the main layout
const ProtectedLayout: React.FC = () => {
    const { session, loading } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 pb-16 md:pb-0">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <Outlet />
                    </div>
                </main>
            </div>
            {isSidebarOpen && (
                <div 
                    className="lg:hidden fixed inset-0 bg-black opacity-50 z-30"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}
            <BottomNav />
        </div>
    );
};

// Generic loading component for Suspense fallback
const PageLoader: React.FC = () => (
    <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center">
            <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-lg text-gray-600">Đang tải trang...</p>
        </div>
    </div>
);

// Main App component
const App: React.FC = () => {
  return (
    <HashRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <OneSignalInitializer />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register-speaker" element={<SpeakerRegistration />} />
                  <Route element={<ProtectedLayout />}>
                      <Route index element={<Dashboard />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="users" element={<Users />} />
                      <Route path="sponsors" element={<Sponsors />} />
                      <Route path="tasks" element={<Tasks />} />
                      <Route path="submissions" element={<Submissions />} />
                      <Route path="speakers" element={<Speakers />} />
                      <Route path="program" element={<Program />} />
                      <Route path="finance" element={<Finance />} />
                      <Route path="documents" element={<Documents />} />
                      <Route path="settings" element={<Settings />}>
                          <Route index element={<Navigate to="roles" replace />} />
                          <Route path="roles" element={<RoleManagement />} />
                          <Route path="email" element={<EmailSettings />} />
                          <Route path="zalo" element={<ZaloSettings />} />
                          <Route path="templates" element={<EmailTemplates />} />
                          <Route path="abitstore" element={<AbitstoreSettings />} />
                      </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  );
};

export default App;