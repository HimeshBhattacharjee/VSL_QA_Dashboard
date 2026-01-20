import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';

function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    return (
        <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
            className="h-9 w-9 rounded-full flex items-center justify-center bg-white/80 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-colors"
        >
            {theme === 'light' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-blue-300" />}
        </button>
    );
}

interface HeaderProps {
    onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [username, setUsername] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [logoRotate, setLogoRotate] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const { setTheme } = useTheme();

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

    const fetchCurrentUser = async () => {
        try {
            const storedUsername = sessionStorage.getItem("username");
            const storedIsLoggedIn = sessionStorage.getItem("isLoggedIn");
            const API_BASE = (import.meta.env.VITE_API_URL);
            if (storedIsLoggedIn === "true" && storedUsername) {
                const response = await fetch(`${API_BASE}/user/current-user-by-name?name=${encodeURIComponent(storedUsername)}`);
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
            const API_BASE = (import.meta.env.VITE_API_URL);
            const response = await fetch(`${API_BASE}/user/signature/${empId}`);
            if (response.ok) {
                const data = await response.json();
                setSignature(data.signature);
            }
        } catch (error) {
            console.error('Error fetching signature:', error);
        }
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
            onConfirm: () => {
                sessionStorage.removeItem("isLoggedIn");
                sessionStorage.removeItem("username");
                sessionStorage.removeItem("userRole");
                sessionStorage.removeItem("employeeId");
                setIsLoggedIn(false);
                setUsername(null);
                setUserRole(null);
                setEmployeeId(null);
                setDropdownOpen(false);
                    // revert to local preference (if any) on logout
                    try {
                        const stored = localStorage.getItem('theme');
                        const localPref = (stored === 'dark' || stored === 'light') ? stored : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                        setTheme(localPref as 'light' | 'dark', false);
                    } catch (e) { }
                    navigate("/login");
            }
        });
    };

    const handleAddSignature = () => {
        setSignatureModalOpen(true);
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
        let currentEmployeeId = employeeId || sessionStorage.getItem("employeeId");
        if (!currentEmployeeId) {
            const storedUsername = sessionStorage.getItem("username");
            if (storedUsername) {
                try {
                    const API_BASE = (import.meta.env.VITE_API_URL);
                    const response = await fetch(`${API_BASE}/user/current-user-by-name?name=${encodeURIComponent(storedUsername)}`);
                    if (response.ok) {
                        const userData = await response.json();
                        currentEmployeeId = userData.employeeId;
                        setEmployeeId(userData.employeeId);
                        sessionStorage.setItem("employeeId", userData.employeeId);
                    }
                } catch (error) {
                    console.error('❌ Error fetching user for employeeId:', error);
                }
            }
        }

        if (!file || !currentEmployeeId) {
            showAlert('error', 'Unable to identify user. Please refresh the page and try again.');
            return;
        }

        setUploading(true);
        try {
            const API_BASE = (import.meta.env.VITE_API_URL);
            const formData = new FormData();
            formData.append('employeeId', currentEmployeeId);
            formData.append('signature', file);
            const response = await fetch(`${API_BASE}/user/signature/upload`, {
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
                setSignatureModalOpen(false);
                setFile(null);
                setFilePreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                showAlert('success', 'Signature uploaded successfully!');
            } else {
                showAlert('error', 'Failed to upload signature');
            }
        } catch (error) {
            showAlert('error', 'Error uploading signature. Please check your connection and try again.');
        } finally {
            setUploading(false);
        }
    };

    const removeSignature = async () => {
        if (!employeeId) return;
        try {
            const API_BASE = (import.meta.env.VITE_API_URL);
            const response = await fetch(`${API_BASE}/user/signature/remove/${employeeId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setSignature(null);
                setSignatureModalOpen(false);
                showAlert('success', 'Signature removed successfully!');
            } else {
                const error = await response.json();
                showAlert('error', `Error: ${error.detail}`);
            }
        } catch (error) {
            showAlert('error', 'Error removing signature');
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
        <div
            className="w-full sticky top-0 z-40 mb-5 h-16 backdrop-blur-xl bg-transparent transition-colors duration-300">
            {signatureModalOpen && (
                <div className="fixed inset-0 min-h-screen bg-[rgba(0,0,0,0.9)] flex items-center justify-center z-50">
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
                                onClick={() => {
                                    setSignatureModalOpen(false);
                                    setFile(null);
                                    setFilePreview(null);
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
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

                {/* Right Side: User Profile */}
                <div className="flex items-center justify-end relative" ref={dropdownRef}>
                    {/* Theme toggle */}
                    <div className="mr-3">
                        {/* useTheme provides theme and setter */}
                        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                        {/* @ts-ignore */}
                        { /* @ts-ignore to keep TS happy if types differ */ }
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