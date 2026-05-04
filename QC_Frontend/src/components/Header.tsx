import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';
import { PASSWORD_REQUIREMENTS, validatePassword } from '../utilities/passwordValidation';

function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    return (
        <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
            className="cursor-pointer h-9 w-9 rounded-full flex items-center justify-center bg-white/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/50 shadow-md"
        >
            {theme === 'light' ? <Moon className="w-5 h-5 text-violet-700 fill-violet-700" /> : <Sun className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
        </button>
    );
}

interface HeaderProps {
    onToggleSidebar: () => void;
}

function PasswordInput({
    value,
    onChange,
    placeholder,
    showPassword,
    onToggle,
    disabled = false
}: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
    showPassword: boolean;
    onToggle: () => void;
    disabled?: boolean;
}) {
    return (
        <div className="relative">
            <input
                type={showPassword ? "text" : "password"}
                value={value}
                onChange={onChange}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-slate-900/50 focus:outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300"
                placeholder={placeholder}
                required
                disabled={disabled}
            />
            <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 p-1 rounded-full hover:bg-white/30 cursor-pointer"
                onClick={onToggle}
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
}

export default function Header({ onToggleSidebar }: HeaderProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [username, setUsername] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [logoRotate, setLogoRotate] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const { setTheme } = useTheme();
    const API_BASE = import.meta.env.VITE_API_URL;
    const USER_API_BASE_URL = `${API_BASE}/user`;

    useEffect(() => {
        const storedUsername = sessionStorage.getItem("username");
        const storedIsLoggedIn = sessionStorage.getItem("isLoggedIn");
        const storedUserRole = sessionStorage.getItem("userRole");
        const storedEmployeeId = sessionStorage.getItem("employeeId");
        setUsername(storedUsername);
        setUserRole(storedUserRole);
        setEmployeeId(storedEmployeeId);
        setIsLoggedIn(storedIsLoggedIn === "true");
        if (storedIsLoggedIn === "true" && storedUsername && (!storedEmployeeId || !storedUserRole)) {
            fetchCurrentUser();
        } else if (storedIsLoggedIn === "true" && storedEmployeeId && storedUserRole !== 'Admin') {
            fetchUserSignature(storedEmployeeId);
        }
    }, [location.pathname]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const resetSignatureSelection = () => {
        setFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const resetChangePasswordForm = () => {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowOldPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
    };

    const closeSignatureModal = () => {
        setSignatureModalOpen(false);
        resetSignatureSelection();
    };

    const closeChangePasswordModal = () => {
        setChangePasswordModalOpen(false);
        setChangingPassword(false);
        resetChangePasswordForm();
    };

    const resetThemeToLocalPreference = () => {
        try {
            const stored = localStorage.getItem('theme');
            const localPref = (stored === 'dark' || stored === 'light')
                ? stored
                : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            setTheme(localPref as 'light' | 'dark', false);
        } catch (e) { }
    };

    const clearSessionAndRedirectToLogin = () => {
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("username");
        sessionStorage.removeItem("userRole");
        sessionStorage.removeItem("employeeId");
        setIsLoggedIn(false);
        setUsername(null);
        setUserRole(null);
        setEmployeeId(null);
        setSignature(null);
        setUploading(false);
        setDropdownOpen(false);
        closeSignatureModal();
        closeChangePasswordModal();
        resetThemeToLocalPreference();
        navigate("/login");
    };

    const fetchCurrentUser = async () => {
        try {
            const storedUsername = sessionStorage.getItem("username");
            const storedIsLoggedIn = sessionStorage.getItem("isLoggedIn");
            if (storedIsLoggedIn === "true" && storedUsername) {
                const response = await fetch(`${USER_API_BASE_URL}/current-user-by-name?name=${encodeURIComponent(storedUsername)}`);
                if (response.ok) {
                    const userData = await response.json();
                    setUsername(userData.name);
                    setUserRole(userData.role);
                    setEmployeeId(userData.employeeId);
                    setIsLoggedIn(true);
                    sessionStorage.setItem("employeeId", userData.employeeId);
                    sessionStorage.setItem("userRole", userData.role);
                    if (userData.theme) {
                        try { setTheme(userData.theme, false); } catch (e) { }
                    }
                    if (userData.role !== 'Admin') fetchUserSignature(userData.employeeId);
                } else console.error('❌ Failed to fetch current user');
            }
        } catch (error) {
            console.error('❌ Error fetching current user:', error);
        }
    };

    const fetchUserSignature = async (empId: string) => {
        try {
            const response = await fetch(`${USER_API_BASE_URL}/signature/${empId}`);
            if (response.ok) {
                const data = await response.json();
                setSignature(data.signature);
            }
        } catch (error) {
            console.error('Error fetching signature:', error);
        }
    };

    const resolveEmployeeId = async () => {
        let currentEmployeeId = employeeId || sessionStorage.getItem("employeeId");
        if (currentEmployeeId) {
            return currentEmployeeId;
        }

        const storedUsername = sessionStorage.getItem("username");
        if (!storedUsername) {
            return null;
        }

        try {
            const response = await fetch(`${USER_API_BASE_URL}/current-user-by-name?name=${encodeURIComponent(storedUsername)}`);
            if (response.ok) {
                const userData = await response.json();
                currentEmployeeId = userData.employeeId;
                setEmployeeId(userData.employeeId);
                sessionStorage.setItem("employeeId", userData.employeeId);
                return currentEmployeeId;
            }
        } catch (error) {
            console.error('Error fetching user for employeeId:', error);
        }

        return null;
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        showConfirm({
            title: 'Logging Out',
            message: 'Are you sure you want to logout?',
            type: 'warning',
            confirmText: 'Yes',
            cancelText: 'No',
            onConfirm: clearSessionAndRedirectToLogin
        });
    };

    const handleAddSignature = () => {
        closeChangePasswordModal();
        setSignatureModalOpen(true);
        setDropdownOpen(false);
    };

    const handleChangePasswordClick = () => {
        closeSignatureModal();
        resetChangePasswordForm();
        setChangePasswordModalOpen(true);
        setDropdownOpen(false);
    };

    const handleUserIconClick = () => {
        if (isLoggedIn) setDropdownOpen(!dropdownOpen);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const selectedFile = event.target.files[0];
            if (!selectedFile.type.startsWith('image/')) {
                showAlert('error', 'Please select an image file (JPG, PNG, GIF)');
                return;
            }
            if (selectedFile.size > 5 * 1024 * 1024) {
                showAlert('error', 'File size must be less than 5MB');
                return;
            }
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (e) => { setFilePreview(e.target?.result as string); };
            reader.readAsDataURL(selectedFile);
        }
    };

    const uploadSignature = async () => {
        const resolvedEmployeeId = await resolveEmployeeId();
        if (!file || !resolvedEmployeeId) {
            showAlert('error', 'Unable to identify user. Please refresh the page and try again.');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('employeeId', resolvedEmployeeId);
            formData.append('signature', file);
            const response = await fetch(`${USER_API_BASE_URL}/signature/upload`, {
                method: 'POST',
                body: formData,
            });
            const responseText = await response.text();
            let responseData;
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                throw new Error('Invalid response from server');
            }

            if (response.ok) {
                setSignature(responseData.signatureUrl);
                closeSignatureModal();
                showAlert('success', 'Signature uploaded successfully!');
            } else {
                showAlert('error', 'Failed to upload signature');
            }
        } catch (error) {
            showAlert('error', 'Error uploading signature. Please check your connection and try again.');
        } finally {
            setUploading(false);
        }
        return;
    };

    const removeSignature = async () => {
        const resolvedEmployeeId = await resolveEmployeeId();
        if (!resolvedEmployeeId) {
            showAlert('error', 'Unable to identify user. Please refresh the page and try again.');
            return;
        }

        try {
            const response = await fetch(`${USER_API_BASE_URL}/signature/remove/${resolvedEmployeeId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setSignature(null);
                closeSignatureModal();
                showAlert('success', 'Signature removed successfully!');
            } else {
                const error = await response.json();
                showAlert('error', `Error: ${error.detail}`);
            }
        } catch (error) {
            showAlert('error', 'Error removing signature');
        }
        return;
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        const resolvedEmployeeId = await resolveEmployeeId();
        if (!resolvedEmployeeId) {
            showAlert('error', 'Unable to identify user. Please refresh the page and try again.');
            return;
        }
        if (newPassword !== confirmPassword) {
            showAlert('error', 'Confirm password must match the new password');
            return;
        }
        if (newPassword === oldPassword) {
            showAlert('error', 'New password cannot be the same as old password');
            return;
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            showAlert('error', passwordError);
            return;
        }

        setChangingPassword(true);
        try {
            const response = await fetch(`${USER_API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employeeId: resolvedEmployeeId,
                    oldPassword,
                    newPassword,
                }),
            });

            if (response.ok) {
                showAlert('success', 'Password changed successfully. Please login with your new password.');
                clearSessionAndRedirectToLogin();
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Failed to change password');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showAlert('error', 'Failed to change password');
        } finally {
            setChangingPassword(false);
        }
    };

    const getAvatarColor = () => {
        switch (userRole) {
            case 'Admin':
                return 'bg-red-600';
            case 'Operator':
                return 'bg-blue-600';
            case 'Supervisor':
                return 'bg-green-600';
            case 'Manager':
                return 'bg-orange-600';
            default:
                return 'bg-indigo-600';
        }
    };

    const canManageSignature = isLoggedIn && userRole !== 'Admin';

    return (
        <div className={`sticky top-0 h-16 ${isMobile ? 'z-40' : 'z-50'} bg-slate-200/20 dark:bg-slate-800/30`}>
            {signatureModalOpen && (
                <div className="fixed inset-0 z-105 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-lg p-6 w-96 max-w-full mx-4 shadow-2xl">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Manage Signature</h3>
                        {signature ? (
                            <div className="flex flex-col items-center justify-center mb-4">
                                <p className="text-sm text-gray-600 mb-2">Current Signature:</p>
                                <img
                                    src={signature}
                                    alt="Signature"
                                    className="max-w-full h-32 border border-gray-300 rounded mx-auto object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,...'; // Fallback
                                        (e.target as HTMLImageElement).alt = 'Signature broken';
                                    }}
                                />
                                <button
                                    onClick={removeSignature}
                                    className="mt-2 text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                                >
                                    Remove Signature
                                </button>
                            </div>
                        ) : (
                            <div className="mb-4">
                                <p className="text-sm text-center text-gray-500 mb-2">No signature uploaded</p>
                            </div>
                        )}

                        <div className="mb-4 w-full">
                            <label className="block text-sm text-center font-medium text-gray-500 mb-2">
                                Upload New Signature
                            </label>
                            {filePreview && (
                                <div className="mb-3">
                                    <p className="text-xs text-center text-gray-400 mb-1">Preview:</p>
                                    <img
                                        src={filePreview}
                                        alt="Preview"
                                        className="max-w-full h-24 border border-gray-300 rounded mx-auto object-contain"
                                    />
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                            />
                            <p className="text-[10px] text-center text-gray-400 mt-1">Supported formats: JPG, PNG, GIF. Max size: 5MB</p>
                        </div>
                        <div className="flex gap-2 justify-end w-full">
                            <button
                                onClick={closeSignatureModal}
                                className="px-4 py-2 text-sm text-gray-400 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={uploadSignature}
                                disabled={!file || uploading}
                                className="bg-blue-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed cursor-pointer transition-all text-sm font-medium"
                            >
                                {uploading ? 'Uploading...' : 'Save Signature'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {changePasswordModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-6 w-[28rem] max-w-full mx-4 shadow-2xl">
                        <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">Change Password</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            Update your password. You will be logged out immediately after saving it.
                        </p>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Old Password</label>
                                <PasswordInput
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    placeholder="Enter old password"
                                    showPassword={showOldPassword}
                                    onToggle={() => setShowOldPassword(prev => !prev)}
                                    disabled={changingPassword}
                                />
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                                <PasswordInput
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    showPassword={showNewPassword}
                                    onToggle={() => setShowNewPassword(prev => !prev)}
                                    disabled={changingPassword}
                                />
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                                <PasswordInput
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    showPassword={showConfirmPassword}
                                    onToggle={() => setShowConfirmPassword(prev => !prev)}
                                    disabled={changingPassword}
                                />
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/30">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Password Requirements</p>
                                <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                    {PASSWORD_REQUIREMENTS.map((requirement) => (
                                        <li key={requirement} className="flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                            {requirement}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={closeChangePasswordModal}
                                    className="px-4 py-2 text-sm text-gray-400 cursor-pointer"
                                    disabled={changingPassword}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={changingPassword}
                                    className="bg-blue-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed cursor-pointer transition-all text-sm font-medium"
                                >
                                    {changingPassword ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <nav className="flex justify-between items-center h-full px-4 sm:px-6">
                <div className="flex items-center">
                    <button
                        onClick={() => {
                            setLogoRotate((prev) => !prev);
                            onToggleSidebar();
                        }}
                        className="
                            group relative flex items-center justify-center
                            h-11 w-11 rounded-full cursor-pointer
                            bg-white/70 dark:bg-slate-900/60
                            border border-slate-200/60 dark:border-slate-700/50
                            shadow-sm hover:shadow-md
                            transition-all duration-300
                            hover:bg-white dark:hover:bg-slate-900/80
                        "
                        aria-label="Toggle Sidebar"
                    >
                        <img
                            src="../LOGOS/VSL_Logo (2).png"
                            alt="VSL Logo"
                            className={`
                                h-7 w-7 object-contain
                                transition-transform duration-500 ease-out
                                ${logoRotate ? "rotate-360" : "rotate-0"}
                                group-hover:scale-105
                            `}
                        />
                    </button>
                </div>
                <div className="flex items-center justify-end relative" ref={dropdownRef}>
                    <div className="mr-3">
                        <ThemeToggle />
                    </div>
                    {isLoggedIn ? (
                        <>
                            <div
                                onClick={handleUserIconClick}
                                className={`
                                    group h-11 w-11 flex items-center justify-center
                                    rounded-full cursor-pointer select-none
                                    border border-white/60 dark:border-slate-700/60
                                    shadow-sm hover:shadow-md
                                    transition-all duration-300 hover:scale-[1.03]
                                    text-white text-md font-bold tracking-wide
                                    ${getAvatarColor()}
                                `}
                            >
                                {username ? username.split(" ").map(word => word[0]).join("").toUpperCase() : ""}
                            </div>
                            {dropdownOpen && (
                                <div
                                    className="
                                        absolute right-0 top-12 mt-2 w-64
                                        rounded-2xl
                                        border border-slate-200/70 dark:border-slate-700/60
                                        bg-white dark:bg-slate-900
                                        shadow-xl
                                        animate-in fade-in slide-in-from-top-2 duration-200
                                        overflow-hidden
                                        z-50
                                    "
                                >
                                    <div className="p-4 border-b border-slate-200/60 dark:border-slate-700/60">
                                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                            {username}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-300 capitalize mt-0.5">
                                            {userRole?.toLowerCase()}
                                        </p>
                                        {signature && canManageSignature && (
                                            <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full
                                            bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 text-[11px] font-semibold">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                Signature uploaded
                                            </div>
                                        )}
                                    </div>
                                    <div className="py-2">
                                        {canManageSignature && (
                                            <button
                                                onClick={handleAddSignature}
                                                className="
                                                    w-full text-left px-4 py-2.5
                                                    text-sm text-slate-700 dark:text-slate-200
                                                    hover:bg-slate-100/70 dark:hover:bg-slate-800/70
                                                    transition-colors cursor-pointer
                                                "
                                            >
                                                Manage Signature
                                            </button>
                                        )}

                                        <button
                                            onClick={handleChangePasswordClick}
                                            className="
                                                w-full text-left px-4 py-2.5
                                                text-sm text-slate-700 dark:text-slate-200
                                                hover:bg-slate-100/70 dark:hover:bg-slate-800/70
                                                transition-colors cursor-pointer
                                            "
                                        >
                                            Change Password
                                        </button>

                                        <button
                                            onClick={handleLogout}
                                            className="
                                                w-full text-left px-4 py-2.5
                                                text-sm font-medium
                                                text-red-600 dark:text-red-400
                                                hover:bg-red-50/80 dark:hover:bg-red-500/10
                                                transition-colors cursor-pointer
                                            "
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors backdrop-blur-md"
                        >
                            Sign In
                        </button>
                    )}
                </div>
            </nav>
        </div>
    );
}