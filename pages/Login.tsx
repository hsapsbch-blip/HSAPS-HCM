import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { BrandIcon } from '../components/icons/BrandIcon';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setLoading(false);
            setError('Email hoặc mật khẩu không đúng.');
            console.error('Login error:', error.message);
            return;
        }

        if (data.user) {
            // Update last_login timestamp in the user's profile to ensure it's always current
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.user.id);
            
            if (updateError) {
                // Log the error but don't block the user from logging in
                console.error('Failed to update last_login:', updateError.message);
            }
        }
        
        setLoading(false);
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
            <div className="max-w-md w-full mx-auto p-8">
                <div className="text-center mb-8">
                    <BrandIcon className="w-16 h-16 mx-auto text-primary" />
                    <h1 className="text-3xl font-bold text-gray-900 mt-4">HSAPS 2025</h1>
                    <p className="text-gray-600">Hệ thống quản lý sự kiện</p>
                </div>
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold text-center text-gray-800 mb-6">Đăng nhập</h2>
                    {error && <p className="bg-red-100 text-red-700 p-3 rounded-md text-center mb-4">{error}</p>}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="text-sm font-medium text-gray-700 block mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                required
                                placeholder="Nhập email của bạn"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="password"
                                className="text-sm font-medium text-gray-700 block mb-2"
                            >
                                Mật khẩu
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                required
                                placeholder='Nhập mật khẩu của bạn'
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;