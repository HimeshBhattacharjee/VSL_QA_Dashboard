import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAlert } from '../context/AlertContext';

export default function Login() {
    const navigate = useNavigate();
    const [employeeId, setEmployeeId] = useState("");
    const [password, setPassword] = useState("");
    const [isFirstLogin, setIsFirstLogin] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [forgotPassword, setForgotPassword] = useState(false);
    const [phone, setPhone] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState("");
    const [resetPassword, setResetPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { showAlert } = useAlert();
    const USER_API_BASE_URL = 'http://localhost:8000/user';

    useEffect(() => {
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("username");
        sessionStorage.removeItem("userRole");
    }, []);

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
                    showAlert('success', 'Login successful!');

                    // Redirect based on role
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

        if (newPassword.length < 6) {
            showAlert('error', 'Password must be at least 6 characters long');
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

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${USER_API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ employeeId, phone }),
            });

            if (response.ok) {
                setOtpSent(true);
                showAlert('success', 'OTP sent to your registered phone number');
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Employee ID and phone number do not match');
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            showAlert('error', 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${USER_API_BASE_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ employeeId, otp }),
            });

            if (response.ok) {
                setResetPassword(true);
                showAlert('success', 'OTP verified successfully');
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Invalid OTP');
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            showAlert('error', 'Failed to verify OTP');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (newPassword !== confirmPassword) {
            showAlert('error', 'Passwords do not match');
            setLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            showAlert('error', 'Password must be at least 6 characters long');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${USER_API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employeeId,
                    newPassword,
                    otp
                }),
            });

            if (response.ok) {
                showAlert('success', 'Password reset successfully!');
                setForgotPassword(false);
                setOtpSent(false);
                setResetPassword(false);
                setEmployeeId("");
                setPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setOtp("");
                setPhone("");
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Failed to reset password');
            }
        } catch (error) {
            console.error('Password reset error:', error);
            showAlert('error', 'Failed to reset password');
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
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                    placeholder="Enter your password"
                    required
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
            <div className="text-center">
                <button
                    type="button"
                    onClick={() => setForgotPassword(true)}
                    disabled={loading}
                    className="text-white hover:font-medium text-sm transition-colors duration-200 disabled:opacity-50"
                >
                    Forgot password?
                </button>
            </div>
        </form>
    );

    const renderFirstLoginForm = () => (
        <form onSubmit={handlePasswordChange} className="space-y-5">
            <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-white">Set New Password</h2>
                <p className="text-gray-300 text-sm mt-2">This is your first login. Please set a new password.</p>
            </div>
            <div>
                <label className="block mb-1 text-sm font-medium">New Password</label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                    placeholder="Enter new password"
                    required
                    disabled={loading}
                />
            </div>
            <div>
                <label className="block mb-1 text-sm font-medium">Confirm Password</label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                    placeholder="Confirm new password"
                    required
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

    const renderForgotPasswordForm = () => {
        if (resetPassword) {
            return (
                <form onSubmit={handlePasswordReset} className="space-y-5">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-semibold text-white">Reset Password</h2>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-medium">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                            placeholder="Enter new password"
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-medium">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                            placeholder="Confirm new password"
                            required
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 mt-2 cursor-pointer bg-green-600 hover:bg-green-500 hover:scale-102 transition-all duration-300 font-semibold rounded-lg shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Resetting Password...' : 'Reset Password'}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setForgotPassword(false);
                            setResetPassword(false);
                            setOtpSent(false);
                        }}
                        disabled={loading}
                        className="w-full py-2 cursor-pointer bg-gray-600 hover:bg-gray-500 transition-all duration-300 font-semibold rounded-lg disabled:opacity-50"
                    >
                        Back to Login
                    </button>
                </form>
            );
        }

        if (otpSent) {
            return (
                <form onSubmit={verifyOtp} className="space-y-5">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-semibold text-white">Verify OTP</h2>
                        <p className="text-gray-300 text-sm mt-2">Enter the OTP sent to your phone</p>
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-medium">OTP</label>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                            placeholder="Enter OTP"
                            required
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 mt-2 cursor-pointer bg-indigo-600 hover:bg-indigo-500 hover:scale-102 transition-all duration-300 font-semibold rounded-lg shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        disabled={loading}
                        className="w-full py-2 cursor-pointer bg-gray-600 hover:bg-gray-500 transition-all duration-300 font-semibold rounded-lg disabled:opacity-50"
                    >
                        Back
                    </button>
                </form>
            );
        }

        return (
            <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="text-center mb-4">
                    <h2 className="text-xl font-semibold text-white">Forgot Password</h2>
                    <p className="text-gray-300 text-sm mt-2">Enter your Employee ID and phone number to receive OTP</p>
                </div>
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
                    <label className="block mb-1 text-sm font-medium">Phone Number</label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                        placeholder="Enter your phone number"
                        required
                        disabled={loading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-2 mt-2 cursor-pointer bg-indigo-600 hover:bg-indigo-500 hover:scale-102 transition-all duration-300 font-semibold rounded-lg shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
                <button
                    type="button"
                    onClick={() => setForgotPassword(false)}
                    disabled={loading}
                    className="w-full py-2 cursor-pointer bg-gray-600 hover:bg-gray-500 transition-all duration-300 font-semibold rounded-lg disabled:opacity-50"
                >
                    Back to Login
                </button>
            </form>
        );
    };

    return (
        <>
            <Header />
            <div className="flex items-center justify-center">
                <div className="w-full max-w-sm p-8 my-6 rounded-2xl bg-white/10 backdrop-blur-lg shadow-2xl text-white border border-white/20 hover:scale-101">
                    <h1 className="text-3xl font-bold text-center mb-6">Welcome</h1>

                    {forgotPassword
                        ? renderForgotPasswordForm()
                        : isFirstLogin
                            ? renderFirstLoginForm()
                            : renderLoginForm()
                    }
                </div>
            </div>
        </>
    );
}