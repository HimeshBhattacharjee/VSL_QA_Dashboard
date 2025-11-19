import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAlert } from '../context/AlertContext';

// Move PasswordInput component outside the main component to prevent re-renders
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
            className="w-full px-4 py-2 pr-10 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
            placeholder={placeholder}
            required
            disabled={disabled}
        />
        <button
            type="button"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 transition-colors duration-200"
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
    const USER_API_BASE_URL = 'http://localhost:8000/user';

    useEffect(() => {
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("username");
        sessionStorage.removeItem("userRole");
    }, []);

    // Use useCallback for event handlers to prevent unnecessary re-renders
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
                    if (user.role === 'Admin') {
                        navigate("/admin");
                    } else {
                        navigate("/home");
                    }
                }
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Invalid credentials');
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

                // Login with new password
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

                    // Redirect based on role
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
        <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label className="block mb-1 text-sm font-medium">Employee ID</label>
                <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                    placeholder="Enter your employee ID"
                    required
                    disabled={loading}
                />
            </div>
            <div>
                <label className="block mb-1 text-sm font-medium">Password</label>
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
                className={`w-full py-2 mt-2 cursor-pointer bg-indigo-700 hover:bg-indigo-600 hover:scale-102 transition-all duration-300 font-semibold rounded-lg shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {loading ? 'Logging in...' : 'Login'}
            </button>
        </form>
    );

    const renderFirstLoginForm = () => (
        <form onSubmit={handlePasswordChange} className="space-y-5">
            <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-white">Set New Password</h2>
                <p className="text-gray-300 text-sm mt-2">This is your first login. Please set a new password.</p>
                <p className="text-gray-300 text-xs mt-1">
                    Password must be at least 8 characters with uppercase, lowercase, digit, and special character (@, #, $, &, !, _)
                </p>
            </div>
            <div>
                <label className="block mb-1 text-sm font-medium">New Password</label>
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
                <label className="block mb-1 text-sm font-medium">Confirm Password</label>
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
                className={`w-full py-2 mt-2 cursor-pointer bg-green-600 hover:bg-green-500 hover:scale-102 transition-all duration-300 font-semibold rounded-lg shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {loading ? 'Changing Password...' : 'Change Password'}
            </button>
        </form>
    );

    return (
        <>
            <Header />
            <div className="flex items-center justify-center">
                <div className="w-full max-w-sm p-8 my-6 rounded-2xl bg-white/10 backdrop-blur-lg shadow-2xl text-white border border-white/20 hover:scale-101">
                    <h1 className="text-3xl font-bold text-center mb-6">Welcome</h1>

                    {isFirstLogin
                        ? renderFirstLoginForm()
                        : renderLoginForm()
                    }
                </div>
            </div>
        </>
    );
}