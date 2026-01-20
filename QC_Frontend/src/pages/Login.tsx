import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';

const PasswordInput = ({
    value,
    onChange,
    placeholder,
    showPassword,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    disabled = false
}: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
    showPassword: boolean;
    onMouseDown: () => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    disabled?: boolean;
}) => (
    <div className="relative">
        <input
            type={showPassword ? "text" : "password"}
            value={value}
            onChange={onChange}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-white/70 dark:bg-white/10 backdrop-blur-sm focus:bg-white/90 dark:focus:bg-white/20 focus:outline-none text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-gray-400 border border-white/30 dark:border-white/20 focus:border-blue-500/50 dark:focus:border-blue-400/50 transition-all duration-300"
            placeholder={placeholder}
            required
            disabled={disabled}
        />
        <button
            type="button"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-1 rounded-full hover:bg-white/30"
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            disabled={disabled}
        >
            {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
            )}
        </button>
    </div>
);

export default function Login() {
    const navigate = useNavigate();
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [isFirstLogin, setIsFirstLogin] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { showAlert } = useAlert();
    const { setTheme } = useTheme();
    const USER_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/user';

    useEffect(() => {
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("username");
        sessionStorage.removeItem("userRole");
    }, []);

    const handleShowPassword = useCallback(() => setShowPassword(true), []);
    const handleHidePassword = useCallback(() => setShowPassword(false), []);

    const handleShowNewPassword = useCallback(() => setShowNewPassword(true), []);
    const handleHideNewPassword = useCallback(() => setShowNewPassword(false), []);

    const handleShowConfirmPassword = useCallback(() => setShowConfirmPassword(true), []);
    const handleHideConfirmPassword = useCallback(() => setShowConfirmPassword(false), []);

    const validatePassword = (password: string): string | null => {
        if (password.length < 8) {
            return "Password must be at least 8 characters long";
        }
        if (!/(?=.*[a-z])/.test(password)) {
            return "Password must contain at least one lowercase letter";
        }
        if (!/(?=.*[A-Z])/.test(password)) {
            return "Password must contain at least one uppercase letter";
        }
        if (!/(?=.*\d)/.test(password)) {
            return "Password must contain at least one digit";
        }
        if (!/(?=.*[@#$&!_])/.test(password)) {
            return "Password must contain at least one special character (@, #, $, &, !, _)";
        }
        return null;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${USER_API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ employeeId, password }),
            });

            if (response.ok) {
                const user = await response.json();

                if (user.isDefaultPassword) {
                    setIsFirstLogin(true);
                    showAlert('info', 'Please set a new password for your account');
                } else {
                    sessionStorage.setItem("isLoggedIn", "true");
                    sessionStorage.setItem("username", user.name);
                    sessionStorage.setItem("userRole", user.role);
                    if (user.theme) {
                        try { setTheme(user.theme, false); } catch (e) { }
                    }
                    if (user.role === 'Admin') {
                        navigate("/admin");
                    } else {
                        navigate("/home");
                    }
                }
            } else {
                const errorData = await response.json();
                if (response.status === 401 && errorData.detail === "User account is inactive") {
                    showAlert('error', 'Your account is inactive. Please contact administrator.');
                } else {
                    showAlert('error', errorData.detail || 'Invalid credentials');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('error', 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (newPassword !== confirmPassword) {
            showAlert('error', 'Passwords do not match');
            setLoading(false);
            return;
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            showAlert('error', passwordError);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${USER_API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employeeId,
                    newPassword,
                    isFirstLogin: true
                }),
            });

            if (response.ok) {
                showAlert('success', 'Password changed successfully!');
                setIsFirstLogin(false);

                const loginResponse = await fetch(`${USER_API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ employeeId, password: newPassword }),
                });

                if (loginResponse.ok) {
                    const user = await loginResponse.json();
                    sessionStorage.setItem("isLoggedIn", "true");
                    sessionStorage.setItem("username", user.name);
                    sessionStorage.setItem("userRole", user.role);
                    if (user.theme) {
                        try { setTheme(user.theme, false); } catch (e) { }
                    }

                    if (user.role === 'Admin') {
                        navigate("/admin");
                    } else {
                        navigate("/home");
                    }
                }
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Failed to change password');
            }
        } catch (error) {
            console.error('Password change error:', error);
            showAlert('error', 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const renderLoginForm = () => (
        <form onSubmit={handleLogin} className="space-y-6">
            <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Employee ID</label>
                <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/70 dark:bg-white/10 backdrop-blur-sm focus:bg-white/90 dark:focus:bg-white/20 focus:outline-none text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-gray-400 border border-white/30 dark:border-white/20 focus:border-blue-500/50 dark:focus:border-blue-400/50 transition-all duration-300"
                    placeholder="Enter your employee ID"
                    required
                    disabled={loading}
                />
            </div>
            <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    showPassword={showPassword}
                    onMouseDown={handleShowPassword}
                    onMouseUp={handleHidePassword}
                    onMouseLeave={handleHidePassword}
                    disabled={loading}
                />
            </div>
            <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 mt-2 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-800 hover:from-blue-700 hover:to-indigo-800 dark:hover:from-blue-600 dark:hover:to-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-semibold rounded-xl shadow-lg hover:shadow-xl shadow-blue-500/20 dark:shadow-blue-900/30 text-white ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {loading ? (
                    <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Logging in...
                    </span>
                ) : 'Login'}
            </button>
        </form>
    );

    const renderFirstLoginForm = () => (
        <form onSubmit={handlePasswordChange} className="space-y-6">
            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 mb-4 shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Set New Password</h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-2">This is your first login. Please set a new password.</p>
                <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                    <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                        Password Requirements:
                    </p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                        <li className="flex items-center">
                            <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            At least 8 characters
                        </li>
                        <li className="flex items-center">
                            <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Uppercase & lowercase letters
                        </li>
                        <li className="flex items-center">
                            <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            At least one digit
                        </li>
                        <li className="flex items-center">
                            <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Special character (@, #, $, &, !, _)
                        </li>
                    </ul>
                </div>
            </div>
            <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    showPassword={showNewPassword}
                    onMouseDown={handleShowNewPassword}
                    onMouseUp={handleHideNewPassword}
                    onMouseLeave={handleHideNewPassword}
                    disabled={loading}
                />
            </div>
            <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    showPassword={showConfirmPassword}
                    onMouseDown={handleShowConfirmPassword}
                    onMouseUp={handleHideConfirmPassword}
                    onMouseLeave={handleHideConfirmPassword}
                    disabled={loading}
                />
            </div>
            <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 mt-2 cursor-pointer bg-gradient-to-r from-green-600 to-emerald-700 dark:from-green-700 dark:to-emerald-800 hover:from-green-700 hover:to-emerald-800 dark:hover:from-green-600 dark:hover:to-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-semibold rounded-xl shadow-lg hover:shadow-xl shadow-green-500/20 dark:shadow-green-900/30 text-white ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {loading ? (
                    <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Changing Password...
                    </span>
                ) : 'Change Password'}
            </button>
        </form>
    );

    return (
        <>
            <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900">
                {/* Background Image with Overlay */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-[url('../LOGOS/BG.jpg')] bg-cover bg-center bg-no-repeat opacity-30 dark:opacity-20"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-transparent dark:from-gray-900/90 dark:via-gray-900/80 dark:to-blue-900/70"></div>
                    
                    {/* Animated Background Elements */}
                    <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-r from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-indigo-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                    <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-gradient-to-r from-emerald-400/10 to-teal-400/10 rounded-full blur-3xl animate-pulse delay-500"></div>
                </div>

                {/* Main Login Container */}
                <div className="relative z-10 w-full max-w-md">
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-blue-500/10 dark:shadow-blue-900/20 border border-white/40 dark:border-white/10 hover:shadow-3xl hover:shadow-blue-500/20 dark:hover:shadow-blue-900/30 transition-all duration-500 overflow-hidden">
                        {/* Glass Morphism Header */}
                        <div className="relative p-4 bg-gradient-to-r from-blue-500/20 to-indigo-600/20 dark:from-blue-900/30 dark:to-indigo-900/30 backdrop-blur-lg border-b border-white/20 dark:border-white/10">
                            <div className="flex items-center justify-center mb-6">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur-xl opacity-50"></div>
                                    <img
                                        src="../LOGOS/VSL_Logo (1).png"
                                        alt="VSL Logo"
                                        className="relative cursor-pointer h-10 sm:h-14 transition-all duration-300 hover:scale-105"
                                    />
                                </div>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                                Welcome Viking
                            </h1>
                            <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-2">
                                Secure access to your dashboard
                            </p>
                        </div>

                        {/* Form Container */}
                        <div className="p-4 sm:p-8">
                            {isFirstLogin
                                ? renderFirstLoginForm()
                                : renderLoginForm()
                            }
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-2 border-t border-white/20 dark:border-white/10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                                Optimized for all devices • Secure login protocol
                            </p>
                            <div className="flex items-center justify-center mt-3 space-x-2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse delay-150"></div>
                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse delay-300"></div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}