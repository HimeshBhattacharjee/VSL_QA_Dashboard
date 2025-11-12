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
    const { showAlert } = useAlert();
    const { showConfirm } = useConfirmModal();
    const USER_API_BASE_URL = 'http://localhost:8000/user';

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
            // Since we don't have a specific endpoint for status toggle, we'll update locally
            // In a real application, you'd have a PATCH /api/users/{id} endpoint
            setUsers(users.map(user =>
                user.id === userId
                    ? { ...user, status: user.status === 'Active' ? 'Inactive' : 'Active' }
                    : user
            ));
            showAlert('success', 'User status updated successfully!');
        } catch (error) {
            console.error('Error updating user status:', error);
            showAlert('error', 'Error updating user status');
        }
    };

    const deleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) {
            return;
        }
        try {
            const response = await fetch(`${USER_API_BASE_URL}/users/${userId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                setUsers(users.filter(user => user.id !== userId));
                showAlert('success', 'User deleted successfully!');
            } else showAlert('error', 'Failed to delete user');
        } catch (error) {
            console.error('Error deleting user:', error);
            showAlert('error', 'Error deleting user');
        }
    };
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-32 w-80 h-80 bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500 rounded-full blur-3xl opacity-10 animate-pulse delay-500"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                <Header />
                <div className="flex items-center justify-center p-4">
                    <div
                        className={`relative transition-all duration-1000 ease-out ${activeTab === null
                            ? 'w-1/3 mx-4 transform hover:scale-105'
                            : activeTab === 'create'
                                ? 'w-full scale-100'
                                : 'w-1/4 scale-75 opacity-60 blur-sm'
                            }`}
                    >
                        <div
                            className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden backdrop-blur-lg ${activeTab === 'create' ? 'h-auto' : 'cursor-pointer'
                                }`}
                            onClick={() => !activeTab && setActiveTab('create')}
                        >
                            <div className={`p-8 text-center ${activeTab === 'create'
                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600'
                                : 'bg-gradient-to-r from-cyan-700 to-blue-700'
                                }`}>
                                <div className="flex items-center justify-center">
                                    <div className={`p-2 rounded-2xl bg-transparent bg-opacity-20 ${activeTab === 'create' ? 'scale-110' : ''
                                        } transition-transform duration-300`}>
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </div>
                                    <h2 className="text-3xl font-bold text-white">Create Users</h2>
                                </div>
                            </div>
                            <div className={`transition-all duration-700 ${activeTab === 'create' ? 'max-h-full opacity-100 p-8' : 'max-h-0 opacity-0'
                                }`}>
                                {activeTab === 'create' && (
                                    <div className="max-w-2xl mx-auto">
                                        <form onSubmit={handleCreateUser} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                                        Full Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        value={newUser.name}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl focus:border-cyan-500 text-white placeholder-gray-400 transition-all duration-300"
                                                        placeholder="Enter full name"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                                        Employee ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="employeeId"
                                                        value={newUser.employeeId}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl focus:border-cyan-500 text-white placeholder-gray-400 transition-all duration-300"
                                                        placeholder="Enter employee ID"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                                        Phone Number
                                                    </label>
                                                    <input
                                                        type="tel"
                                                        name="phone"
                                                        value={newUser.phone}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl focus:border-cyan-500 text-white placeholder-gray-400 transition-all duration-300"
                                                        placeholder="Enter phone number"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                                        Role
                                                    </label>
                                                    <select
                                                        name="role"
                                                        value={newUser.role}
                                                        onChange={handleInputChange}
                                                        className="w-full px-4 py-3 bg-slate-700 border-2 border-slate-600 rounded-xl focus:border-cyan-500 text-white transition-all duration-300 cursor-pointer"
                                                    >
                                                        <option value="Operator">Operator</option>
                                                        <option value="Reviewer">Reviewer</option>
                                                        <option value="Admin">Admin</option>
                                                    </select>
                                                </div>

                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                                        Generated Password
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="password"
                                                        value={newUser.password}
                                                        readOnly
                                                        className="w-full px-4 py-3 bg-slate-600 border-2 border-slate-500 rounded-xl text-gray-300 cursor-not-allowed"
                                                        placeholder="Password will be generated automatically"
                                                    />
                                                    <p className="text-xs text-gray-400 mt-2">
                                                        Password format: First 2 letters of name + last 4 digits of Employee ID + last 4 digits of phone
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex justify-center space-x-4 pt-4">
                                                <button
                                                    type="submit"
                                                    className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg cursor-pointer"
                                                >
                                                    Create User
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab(null)}
                                                    className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 border border-slate-600 cursor-pointer"
                                                >
                                                    Back
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                            {activeTab !== 'create' && (
                                <div className="p-8 text-center">
                                    <p className="text-gray-400 text-lg mb-4">Click to create new users</p>
                                    <div className="flex justify-center space-x-2">
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-150"></div>
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-300"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-500 blur-xl opacity-20 -z-10 transition-all duration-1000 ${activeTab === 'create' ? 'scale-105 animate-pulse' : 'scale-95'
                            }`}></div>
                    </div>
                    <div
                        className={`relative transition-all duration-1000 ease-out ${activeTab === null
                            ? 'w-1/3 mx-4 transform hover:scale-105'
                            : activeTab === 'manage'
                                ? 'w-full scale-100'
                                : 'w-1/4 scale-75 opacity-60 blur-sm'
                            }`}
                    >
                        <div
                            className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden backdrop-blur-lg ${activeTab === 'manage' ? 'h-auto' : 'cursor-pointer'
                                }`}
                            onClick={() => !activeTab && setActiveTab('manage')}
                        >
                            <div className={`p-8 text-center ${activeTab === 'manage'
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                                : 'bg-gradient-to-r from-purple-700 to-pink-700'
                                }`}>
                                <div className="flex items-center justify-center">
                                    <div className={`p-2 rounded-2xl bg-transparent bg-opacity-20 ${activeTab === 'manage' ? 'scale-110' : ''
                                        } transition-transform duration-300`}>
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-3xl font-bold text-white">Manage Users</h2>
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className={`transition-all duration-700 ${activeTab === 'manage' ? 'max-h-full opacity-100 p-8' : 'max-h-0 opacity-0'
                                }`}>
                                {activeTab === 'manage' && (
                                    <div className="max-w-6xl mx-auto">
                                        <div className="bg-slate-800 rounded-2xl shadow-gray-600 shadow-lg overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-slate-900">
                                                        <tr>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300 tracking-wider">
                                                                User
                                                            </th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300 tracking-wider">
                                                                Phone Number
                                                            </th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300 tracking-wider">
                                                                Employee ID
                                                            </th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300 tracking-wider">
                                                                Role
                                                            </th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300 tracking-wider">
                                                                Status
                                                            </th>
                                                            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300 tracking-wider">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-slate-800">
                                                        {users.map((user) => (
                                                            <tr key={user.id} className="hover:bg-slate-700 transition-colors duration-200">
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold">
                                                                            {user.avatar}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-medium text-white">
                                                                                {user.name}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                                    {user.phone}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                                    {user.employeeId}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${user.role === 'Admin'
                                                                        ? 'bg-red-500 bg-opacity-20 text-red-100'
                                                                        : user.role === 'Operator'
                                                                            ? 'bg-blue-500 bg-opacity-20 text-blue-100'
                                                                            : 'bg-purple-500 bg-opacity-20 text-purple-100'
                                                                        }`}>
                                                                        {user.role}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${user.status === 'Active'
                                                                        ? 'bg-green-500 bg-opacity-20 text-green-100'
                                                                        : 'bg-red-500 bg-opacity-20 text-red-100'
                                                                        }`}>
                                                                        {user.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                                                                    <button
                                                                        onClick={() => toggleUserStatus(user.id)}
                                                                        className={`${user.status === 'Active'
                                                                            ? 'text-red-500 hover:text-red-200'
                                                                            : 'text-green-500 hover:text-green-200'
                                                                            } transition-colors duration-200 font-semibold cursor-pointer`}
                                                                    >
                                                                        {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteUser(user.id)}
                                                                        className="text-red-500 hover:text-red-200 transition-colors duration-200 font-semibold cursor-pointer"
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
                                                    <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                                    </svg>
                                                    <h3 className="mt-4 text-lg font-medium text-gray-300">No users found</h3>
                                                    <p className="mt-2 text-gray-500">Get started by creating a new user.</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-center mt-6">
                                            <button
                                                onClick={() => setActiveTab(null)}
                                                className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 border border-slate-600 cursor-pointer"
                                            >
                                                Back
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {activeTab !== 'manage' && (
                                <div className="p-8 text-center">
                                    <p className="text-gray-400 text-lg mb-4">Click to manage existing users</p>
                                    <div className="flex justify-center space-x-2">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-150"></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-300"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500 to-pink-500 blur-xl opacity-20 -z-10 transition-all duration-1000 ${activeTab === 'manage' ? 'scale-105 animate-pulse' : 'scale-95'
                            }`}></div>
                    </div>
                </div>
                {!activeTab && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 md:grid-cols-2 gap-6 p-15">
                        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-cyan-500 bg-opacity-20 rounded-xl">
                                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="white" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-400">Total Users</p>
                                    <p className="text-2xl font-bold text-white">{users.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-green-500 bg-opacity-20 rounded-xl">
                                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="white" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-400">Active Users</p>
                                    <p className="text-2xl font-bold text-white">
                                        {users.filter(user => user.status === 'Active').length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-blue-500 bg-opacity-20 rounded-xl">
                                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="white" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-400">Operators</p>
                                    <p className="text-2xl font-bold text-white">
                                        {users.filter(user => user.role === 'Operator').length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-purple-500 bg-opacity-20 rounded-xl">
                                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="white" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-400">Admins</p>
                                    <p className="text-2xl font-bold text-white">
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