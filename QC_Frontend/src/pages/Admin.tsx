import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { useAlert } from '../context/AlertContext';
import { useConfirmModal } from '../context/ConfirmModalContext';

interface User {
    id: string;
    name: string;
    employeeId: string;
    phone: string;
    role: string;
    status: string;
    avatar: string;
    password: string;
    isDefaultPassword: boolean;
    createdAt: string;
}

const Admin = () => {
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ name: '', employeeId: '', phone: '', role: 'Operator', password: '' });
    const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({});
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const USER_API_BASE_URL = (import.meta.env.VITE_API_URL) + '/user';

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${USER_API_BASE_URL}/users`);
            if (response.ok) {
                const usersData = await response.json();
                setUsers(usersData);
            } else {
                console.error('Failed to fetch users');
                showAlert('error', 'Failed to load users');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            showAlert('error', 'Error loading users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const generatePassword = (name: string, employeeId: string, phone: string) => {
        if (!name || !employeeId || !phone) return '';
        const firstTwoLetters = name.split(' ').map(n => n[0]).join('').slice(0, 2);
        const lastFourEmployeeId = employeeId.slice(-4);
        const lastFourPhone = phone.slice(-4);
        return `${firstTwoLetters}${lastFourEmployeeId}${lastFourPhone}`;
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const generatedPassword = generatePassword(newUser.name, newUser.employeeId, newUser.phone);
        const userData = {
            name: newUser.name,
            employeeId: newUser.employeeId,
            phone: newUser.phone,
            role: newUser.role,
            password: generatedPassword
        };

        try {
            const response = await fetch(`${USER_API_BASE_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(userData),
            });
            if (response.ok) {
                const savedUser = await response.json();
                setUsers([...users, savedUser]);
                setNewUser({ name: '', employeeId: '', phone: '', role: 'Operator', password: '' });
                showAlert('success', 'User created successfully!');
                setActiveTab(null);
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Failed to create user');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            showAlert('error', 'Error creating user');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const updatedUser = { ...newUser, [name]: value };
        if (name === 'name' || name === 'employeeId' || name === 'phone') {
            if (updatedUser.name && updatedUser.employeeId && updatedUser.phone) {
                updatedUser.password = generatePassword(updatedUser.name, updatedUser.employeeId, updatedUser.phone);
            } else updatedUser.password = '';
        }
        setNewUser(updatedUser);
    };

    const toggleUserStatus = async (userId: string) => {
        try {
            const response = await fetch(`${USER_API_BASE_URL}/users/${userId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const result = await response.json();

                // Update local state
                setUsers(users.map(user =>
                    user.id === userId
                        ? { ...user, status: result.newStatus }
                        : user
                ));
                showAlert('success', `User status updated to ${result.newStatus}!`);
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Failed to update user status');
                // Reload users to sync with server
                await fetchUsers();
            }
        } catch (error) {
            console.error('Error updating user status:', error);
            showAlert('error', 'Error updating user status');
            await fetchUsers();
        }
    };

    const deleteUser = (userId: string) => {
        showConfirm({
            title: 'Delete User',
            message: 'Are you sure you want to delete this user? This action cannot be undone.',
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    const response = await fetch(`${USER_API_BASE_URL}/users/${userId}`, {
                        method: 'DELETE',
                    });
                    if (response.ok) {
                        setUsers(users.filter(user => user.id !== userId));
                        showAlert('success', 'User deleted successfully!');
                    } else {
                        showAlert('error', 'Failed to delete user');
                    }
                } catch (error) {
                    console.error('Error deleting user:', error);
                    showAlert('error', 'Error deleting user');
                }
            }
        });
    };

    const togglePasswordVisibility = (userId: string) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [userId]: !prev[userId]
        }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 flex items-center justify-center">
                <div className="text-gray-800 dark:text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-200 via-purple-100 to-gray-200 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden block">
                <div className="absolute -top-40 -right-32 w-80 h-80 bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500 rounded-full blur-3xl opacity-10 animate-pulse delay-500"></div>
            </div>
            
            <Header onToggleSidebar={() => {}} />
            
            <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-6 py-4">
                    {/* Create Users Card */}
                    <div
                        className={`relative transition-all duration-1000 ease-out w-full ${activeTab === null
                            ? 'lg:w-1/3 lg:mx-4 transform hover:scale-105'
                            : activeTab === 'create'
                                ? 'scale-100'
                                : 'lg:w-1/4 scale-75 opacity-60 blur-sm'
                            }`}
                    >
                        <div
                            className={`bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-2xl overflow-hidden backdrop-blur-lg ${activeTab === 'create' ? 'h-auto' : 'cursor-pointer hover:shadow-xl dark:hover:shadow-purple-900/30 transition-shadow duration-300'
                                }`}
                            onClick={() => !activeTab && setActiveTab('create')}
                        >
                            <div className={`p-6 md:p-8 text-center ${activeTab === 'create'
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                                : 'bg-gradient-to-r from-cyan-600 to-blue-600'
                                }`}>
                                <div className="flex items-center justify-center">
                                    <div className={`p-2 rounded-2xl bg-white/20 ${activeTab === 'create' ? 'scale-110' : ''
                                        } transition-transform duration-300`}>
                                        <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg md:text-xl lg:text-3xl font-bold text-white ml-3">Create Users</h2>
                                </div>
                            </div>
                            <div className={`transition-all duration-700 ${activeTab === 'create' ? 'max-h-full opacity-100 p-4 sm:p-6 md:p-8' : 'max-h-0 opacity-0'
                                }`}>
                                {activeTab === 'create' && (
                                    <div className="max-w-2xl mx-auto">
                                        <form onSubmit={handleCreateUser} className="space-y-4 sm:space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Full Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        value={newUser.name}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-cyan-500 dark:focus:border-cyan-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                                                        placeholder="Enter full name"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Employee ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="employeeId"
                                                        value={newUser.employeeId}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-cyan-500 dark:focus:border-cyan-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                                                        placeholder="Enter employee ID"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Phone Number
                                                    </label>
                                                    <input
                                                        type="tel"
                                                        name="phone"
                                                        value={newUser.phone}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-cyan-500 dark:focus:border-cyan-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
                                                        placeholder="Enter phone number"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Role
                                                    </label>
                                                    <select
                                                        name="role"
                                                        value={newUser.role}
                                                        onChange={handleInputChange}
                                                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-cyan-500 dark:focus:border-cyan-500 text-gray-900 dark:text-white transition-all duration-300 cursor-pointer focus:ring-2 focus:ring-cyan-500/20 focus:outline-none appearance-none"
                                                    >
                                                        <option value="Operator">Operator</option>
                                                        <option value="Supervisor">Supervisor</option>
                                                        <option value="Manager">Manager</option>
                                                        <option value="Admin">Admin</option>
                                                    </select>
                                                </div>

                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Generated Password
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="password"
                                                        value={newUser.password}
                                                        readOnly
                                                        className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-600 border-2 border-gray-300 dark:border-slate-500 rounded-xl text-gray-700 dark:text-gray-300 cursor-not-allowed"
                                                        placeholder="Password will be generated automatically"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                                        Password format: First 2 letters of name + last 4 digits of Employee ID + last 4 digits of phone
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 pt-4">
                                                <button
                                                    type="submit"
                                                    className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3 px-6 sm:px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/25 dark:hover:shadow-cyan-500/40 cursor-pointer w-full sm:w-auto"
                                                >
                                                    Create User
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab(null)}
                                                    className="bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-white font-semibold py-3 px-6 sm:px-8 rounded-xl transition-all duration-300 border border-gray-300 dark:border-slate-600 cursor-pointer w-full sm:w-auto"
                                                >
                                                    Back
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                            {activeTab !== 'create' && (
                                <div className="p-6 md:p-8 text-center">
                                    <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg mb-4">Click to create new users</p>
                                    <div className="flex justify-center space-x-2">
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-150"></div>
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-300"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-500 blur-xl opacity-20 -z-10 transition-all duration-1000 hidden dark:block ${activeTab === 'create' ? 'scale-105 animate-pulse' : 'scale-95'
                            }`}></div>
                    </div>

                    {/* Manage Users Card */}
                    <div
                        className={`relative transition-all duration-1000 ease-out w-full ${activeTab === null
                            ? 'lg:w-1/3 lg:mx-4 transform hover:scale-105'
                            : activeTab === 'manage'
                                ? 'scale-100'
                                : 'lg:w-1/4 scale-75 opacity-60 blur-sm'
                            }`}
                    >
                        <div
                            className={`bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-2xl overflow-hidden backdrop-blur-lg ${activeTab === 'manage' ? 'h-auto' : 'cursor-pointer hover:shadow-xl dark:hover:shadow-purple-900/30 transition-shadow duration-300'
                                }`}
                            onClick={() => !activeTab && setActiveTab('manage')}
                        >
                            <div className={`p-6 md:p-8 text-center ${activeTab === 'manage'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600'
                                }`}>
                                <div className="flex items-center justify-center">
                                    <div className={`p-2 rounded-2xl bg-white/20 ${activeTab === 'manage' ? 'scale-110' : ''
                                        } transition-transform duration-300`}>
                                        <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg md:text-xl lg:text-3xl font-bold text-white ml-3">Manage Users</h2>
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className={`transition-all duration-700 ${activeTab === 'manage' ? 'max-h-full opacity-100 p-3 sm:p-4 md:p-8' : 'max-h-0 opacity-0'
                                }`}>
                                {activeTab === 'manage' && (
                                    <div className="max-w-6xl mx-auto">
                                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md dark:shadow-gray-900 shadow-gray-200 overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="user-table w-full min-w-[600px]">
                                                    <thead className="bg-gray-100 dark:bg-slate-900">
                                                        <tr>
                                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider">
                                                                User
                                                            </th>
                                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider">
                                                                Phone
                                                            </th>
                                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider">
                                                                Password
                                                            </th>
                                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider">
                                                                Employee ID
                                                            </th>
                                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider">
                                                                Role
                                                            </th>
                                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider">
                                                                Status
                                                            </th>
                                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                        {users.map((user) => (
                                                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors duration-200">
                                                                <td className="px-3 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                                                            {user.avatar}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                                {user.name}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                                    {user.phone}
                                                                </td>
                                                                <td className="px-3 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center space-x-2">
                                                                        <span className="text-sm text-gray-900 dark:text-white font-mono">
                                                                            {visiblePasswords[user.id]
                                                                                ? (user.password ?? 'N/A') : '•'.repeat(8)
                                                                            }
                                                                        </span>
                                                                        <button
                                                                            onClick={() => togglePasswordVisibility(user.id)}
                                                                            className="text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors duration-200 cursor-pointer"
                                                                            type="button"
                                                                        >
                                                                            {visiblePasswords[user.id] ? (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                                </svg>
                                                                            ) : (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                </svg>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                                    {user.employeeId}
                                                                </td>
                                                                <td className="px-3 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${user.role === 'Admin'
                                                                        ? 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-100'
                                                                        : user.role === 'Operator'
                                                                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-100'
                                                                            : user.role === 'Supervisor' 
                                                                            ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-100' 
                                                                            : 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-100'
                                                                        }`}>
                                                                        {user.role}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${user.status === 'Active'
                                                                        ? 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-100'
                                                                        : 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-100'
                                                                        }`}>
                                                                        {user.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                                                                    <button
                                                                        onClick={() => toggleUserStatus(user.id)}
                                                                        className={`${user.status === 'Active'
                                                                            ? 'text-red-600 dark:text-red-500 hover:text-red-800 dark:hover:text-red-300'
                                                                            : 'text-green-600 dark:text-green-500 hover:text-green-800 dark:hover:text-green-300'
                                                                            } transition-colors duration-200 font-semibold cursor-pointer`}
                                                                    >
                                                                        {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteUser(user.id)}
                                                                        className="text-red-600 dark:text-red-500 hover:text-red-800 dark:hover:text-red-300 transition-colors duration-200 font-semibold cursor-pointer ml-3"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {users.length === 0 && (
                                                <div className="text-center py-12">
                                                    <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                                    </svg>
                                                    <h3 className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">No users found</h3>
                                                    <p className="mt-2 text-gray-500 dark:text-gray-400">Get started by creating a new user.</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-center mt-6">
                                            <button
                                                onClick={() => setActiveTab(null)}
                                                className="bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 border border-gray-300 dark:border-slate-600 cursor-pointer"
                                            >
                                                Back
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {activeTab !== 'manage' && (
                                <div className="p-6 md:p-8 text-center">
                                    <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg mb-4">Click to manage existing users</p>
                                    <div className="flex justify-center space-x-2">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-150"></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-300"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500 to-pink-500 blur-xl opacity-20 -z-10 transition-all duration-1000 hidden dark:block ${activeTab === 'manage' ? 'scale-105 animate-pulse' : 'scale-95'
                            }`}></div>
                    </div>
                </div>
                
                {/* Stats Dashboard */}
                {!activeTab && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 p-4 md:p-8">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-cyan-100 dark:bg-cyan-500/20 rounded-xl">
                                    <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-green-100 dark:bg-green-500/20 rounded-xl">
                                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                                        {users.filter(user => user.status === 'Active').length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-xl">
                                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Operators</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                                        {users.filter(user => user.role === 'Operator').length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md dark:shadow-xl border border-gray-200 dark:border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-purple-100 dark:bg-purple-500/20 rounded-xl">
                                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admins</p>
                                    <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                                        {users.filter(user => user.role === 'Admin').length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Admin;