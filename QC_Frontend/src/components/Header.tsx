import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const [pageTitle, setPageTitle] = useState<string>('Home');
    const [pageSubTitle, setPageSubTitle] = useState<string>('');
    const [username, setUsername] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();

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
        switch (location.pathname) {
            case '/login':
                setPageTitle("VSL Quality Portal Login");
                setPageSubTitle("");
                break;
            case '/admin':
                setPageTitle("VSL Quality Portal Admin Section");
                setPageSubTitle("Create and manage user accounts");
                break;
            case '/home':
                setPageTitle("Welcome to VSL's Quality Department");
                setPageSubTitle("Real-time access to test reports and quality checks");
                break;
            case '/quality-tests':
                setPageTitle("Quality Tests");
                setPageSubTitle("Access detailed quality test reports and analysis");
                break;
            case '/gel-test':
                setPageTitle("Gel Test");
                setPageSubTitle("Detailed Results of Gel Test");
                break;
            case '/peel-test':
                setPageTitle("Peel Test");
                setPageSubTitle("Detailed Results of Peel Test");
                break;
            case '/b-grade-trend':
                setPageTitle("B-Grade Trend Analysis");
                setPageSubTitle("Detailed Analysis of B-Grade Trend");
                break;
            case '/quality-analysis':
                setPageTitle("Quality Analysis");
                setPageSubTitle("Real-time Monitoring of Production Line Quality Metrics");
                break;
            case '/prelam':
                setPageTitle("Pre-Lamination Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Pre-Lamination process");
                break;
            case '/pre-el':
                setPageTitle("Pre-EL Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Pre-EL process");
                break;
            case '/visual':
                setPageTitle("Visual Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Visual Check process");
                break;
            case '/lamqc':
                setPageTitle("Post-Lamination Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Post-Lamination process");
                break;
            case '/fqc':
                setPageTitle("FQC Detailed Analysis");
                setPageSubTitle("Detailed quality metrics for Final QC process");
                break;
            case '/quality-audit':
                setPageTitle("IPQC Audit Checksheet");
                setPageSubTitle("");
                break;
            default:
                setPageTitle("VSL Quality Portal");
                setPageSubTitle("");
        }
    }, [location.pathname]);

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

    const handleLogoClick = () => {
        if (!isLoggedIn) {
            navigate("/login");
            return;
        }

        const userRole = sessionStorage.getItem("userRole");
        if (userRole === 'Admin') navigate("/admin");
        else navigate("/home");
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
        <div className="w-full mb-5 pt-2">
            {signatureModalOpen && (
                <div className="fixed inset-0 bg-[rgba(0,0,0,0.9)] flex items-center justify-center z-50">
                    <div className="flex flex-col items-center justify-center bg-white rounded-lg p-6 w-96 max-w-full mx-4">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Manage Signature</h3>
                        {signature ? (
                            <div className="flex flex-col items-center justify-center mb-4">
                                <p className="text-sm text-gray-600 mb-2">Current Signature:</p>
                                <img
                                    src={`${(import.meta.env.VITE_API_URL)}${signature}`}
                                    alt="Signature"
                                    className="max-w-full h-32 border border-gray-300 rounded mx-auto"
                                />
                                <button
                                    onClick={removeSignature}
                                    className="mt-2 bg-red-500 text-white py-2 px-3 cursor-pointer rounded hover:bg-red-600 transition-colors"
                                >
                                    Remove Signature
                                </button>
                            </div>
                        ) : (
                            <div className="mb-4">
                                <p className="text-sm text-center text-gray-600 mb-2">No signature uploaded</p>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm text-center font-medium text-gray-700 mb-2">
                                Upload New Signature
                            </label>
                            {filePreview && (
                                <div className="mb-3">
                                    <p className="text-sm text-center text-gray-600 mb-1">Preview:</p>
                                    <img
                                        src={filePreview}
                                        alt="Preview"
                                        className="max-w-full h-32 border border-gray-300 rounded mx-auto"
                                    />
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                            />
                            <p className="text-xs text-center text-gray-500 mt-1">Supported formats: JPG, PNG, GIF. Max size: 5MB</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={uploadSignature}
                                disabled={!file || uploading}
                                className="bg-blue-500 text-white py-2 px-3 rounded cursor-pointer hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {uploading ? 'Uploading...' : 'Upload Signature'}
                            </button>
                            <button
                                onClick={() => {
                                    setSignatureModalOpen(false);
                                    setFile(null);
                                    setFilePreview(null);
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
                                className="bg-gray-500 text-white py-2 px-3 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <nav className="flex justify-between items-center py-4 px-5 relative min-h-20">
                <div className="flex items-center gap-5 flex-1">
                    <img
                        src="../LOGOS/VSL_Logo (1).png"
                        alt="VSL Logo"
                        className="cursor-pointer h-10 transition-all duration-300 hover:scale-105 brightness-0 invert"
                        onClick={handleLogoClick}
                    />
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2 pt-4 text-center flex-2">
                    <h1 className="text-3xl text-white mb-1 drop-shadow-lg font-bold">{pageTitle}</h1>
                    {pageSubTitle && (
                        <p className="text-white text-md opacity-90">{pageSubTitle}</p>
                    )}
                </div>
                <div className="flex items-center justify-end flex-1 relative" ref={dropdownRef}>
                    {isLoggedIn ? (
                        <>
                            <div className="flex items-center gap-3 mr-4">
                                <span className="text-white text-sm bg-black/30 px-3 py-1 rounded-full">
                                    {userRole}
                                </span>
                            </div>
                            <div
                                onClick={handleUserIconClick}
                                className={`h-10 w-10 flex items-center justify-center rounded-full cursor-pointer border-2 border-white/80 text-white font-semibold transition-all duration-300 hover:scale-110 hover:border-white hover:shadow-lg hover:shadow-white/30 select-none ${getAvatarColor()}`}
                            >
                                {username ? username.split(' ').map(word => word[0]).join('').toUpperCase() : ''}
                            </div>
                            {dropdownOpen && (
                                <div className="absolute right-0 top-12 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-lg py-2 border border-gray-200 animate-fade-in z-50">
                                    <div className="px-4 py-2 border-b border-gray-100">
                                        <p className="font-semibold text-sm">{username}</p>
                                        <p className="text-xs text-gray-600 capitalize">{userRole?.toLowerCase()}</p>
                                        {signature && canManageSignature && (
                                            <p className="text-xs text-green-600 mt-1">✓ Signature uploaded</p>
                                        )}
                                    </div>
                                    {canManageSignature && (
                                        <button
                                            onClick={handleAddSignature}
                                            className="block w-full text-left px-4 py-2 cursor-pointer hover:bg-gray-100 font-medium text-sm"
                                        >
                                            Add Signature
                                        </button>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        className="block w-full text-left px-4 py-2 cursor-pointer hover:bg-gray-100 font-medium text-sm"
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="h-10 w-10 flex items-center justify-center rounded-full cursor-none border-2 border-white/80 bg-gray-700 text-white font-semibold select-none">
                            <span className="text-gray-300">?</span>
                        </div>
                    )}
                </div>
            </nav>
        </div>
    );
}