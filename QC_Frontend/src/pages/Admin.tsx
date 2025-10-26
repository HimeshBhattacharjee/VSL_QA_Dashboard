import { useState } from 'react';

const Admin = () => {
    const [activeTab, setActiveTab] = useState(null);
    const [users, setUsers] = useState([
        { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active', avatar: 'JD' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active', avatar: 'JS' },
        { id: 3, name: 'Mike Johnson', email: 'mike@example.com', role: 'User', status: 'Inactive', avatar: 'MJ' },
    ]);

    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        role: 'User',
        password: ''
    });

    const handleCreateUser = (e) => {
        e.preventDefault();
        const user = {
            id: users.length + 1,
            ...newUser,
            status: 'Active',
            avatar: newUser.name.split(' ').map(n => n[0]).join('').toUpperCase(),
            createdAt: new Date().toLocaleDateString()
        };
        setUsers([...users, user]);
        setNewUser({ name: '', email: '', role: 'User', password: '' });
    };

    const handleInputChange = (e) => {
        setNewUser({
            ...newUser,
            [e.target.name]: e.target.value
        });
    };

    const toggleUserStatus = (userId) => {
        setUsers(users.map(user =>
            user.id === userId
                ? { ...user, status: user.status === 'Active' ? 'Inactive' : 'Active' }
                : user
        ));
    };

    const deleteUser = (userId) => {
        setUsers(users.filter(user => user.id !== userId));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-32 w-80 h-80 bg-purple-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500 rounded-full blur-3xl opacity-10 animate-pulse delay-500"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                        User Management
                    </h1>
                    <p className="text-gray-300 text-lg">Create and manage user accounts with style</p>
                </div>

                {/* Main Tab Container */}
                <div className="flex items-center justify-center min-h-[70vh]">
                    {/* Create User Tab */}
                    <div
                        className={`relative transition-all duration-1000 ease-out ${activeTab === null
                                ? 'w-1/2 mx-4 transform hover:scale-105'
                                : activeTab === 'create'
                                    ? 'w-full scale-100'
                                    : 'w-1/4 scale-75 opacity-60 blur-sm'
                            }`}
                    >
                        <div
                            className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden backdrop-blur-lg ${activeTab === 'create' ? 'h-auto min-h-[600px]' : 'h-64 cursor-pointer'
                                }`}
                            onClick={() => !activeTab && setActiveTab('create')}
                        >
                            {/* Tab Header */}
                            <div className={`p-8 text-center ${activeTab === 'create'
                                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600'
                                    : 'bg-gradient-to-r from-cyan-700 to-blue-700'
                                }`}>
                                <div className="flex items-center justify-center space-x-4">
                                    <div className={`p-3 rounded-2xl bg-white bg-opacity-20 ${activeTab === 'create' ? 'scale-110' : ''
                                        } transition-transform duration-300`}>
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </div>
                                    <h2 className="text-3xl font-bold text-white">Create Users</h2>
                                </div>
                            </div>

                            {/* Tab Content */}
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
                                                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300"
                                                        placeholder="Enter full name"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                                        Email Address
                                                    </label>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        value={newUser.email}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300"
                                                        placeholder="Enter email address"
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
                                                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white transition-all duration-300"
                                                    >
                                                        <option value="User">User</option>
                                                        <option value="Admin">Admin</option>
                                                        <option value="Moderator">Moderator</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                                        Password
                                                    </label>
                                                    <input
                                                        type="password"
                                                        name="password"
                                                        value={newUser.password}
                                                        onChange={handleInputChange}
                                                        required
                                                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-400 transition-all duration-300"
                                                        placeholder="Enter password"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-center space-x-4 pt-6">
                                                <button
                                                    type="submit"
                                                    className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                                                >
                                                    Create User
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab(null)}
                                                    className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 border border-slate-600"
                                                >
                                                    Back
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>

                            {/* Mini View */}
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

                        {/* Glow Effect */}
                        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-500 blur-xl opacity-20 -z-10 transition-all duration-1000 ${activeTab === 'create' ? 'scale-105 animate-pulse' : 'scale-95'
                            }`}></div>
                    </div>

                    {/* Manage Users Tab */}
                    <div
                        className={`relative transition-all duration-1000 ease-out ${activeTab === null
                                ? 'w-1/2 mx-4 transform hover:scale-105'
                                : activeTab === 'manage'
                                    ? 'w-full scale-100'
                                    : 'w-1/4 scale-75 opacity-60 blur-sm'
                            }`}
                    >
                        <div
                            className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden backdrop-blur-lg ${activeTab === 'manage' ? 'h-auto min-h-[600px]' : 'h-64 cursor-pointer'
                                }`}
                            onClick={() => !activeTab && setActiveTab('manage')}
                        >
                            {/* Tab Header */}
                            <div className={`p-8 text-center ${activeTab === 'manage'
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                                    : 'bg-gradient-to-r from-purple-700 to-pink-700'
                                }`}>
                                <div className="flex items-center justify-center space-x-4">
                                    <div className={`p-3 rounded-2xl bg-white bg-opacity-20 ${activeTab === 'manage' ? 'scale-110' : ''
                                        } transition-transform duration-300`}>
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
                                        <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-slate-700">
                                                        <tr>
                                                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-300 uppercase tracking-wider">
                                                                User
                                                            </th>
                                                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-300 uppercase tracking-wider">
                                                                Role
                                                            </th>
                                                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-300 uppercase tracking-wider">
                                                                Status
                                                            </th>
                                                            <th className="px-6 py-4 text-left text-sm font-medium text-gray-300 uppercase tracking-wider">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-slate-800 divide-y divide-slate-700">
                                                        {users.map((user) => (
                                                            <tr key={user.id} className="hover:bg-slate-750 transition-colors duration-200">
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold">
                                                                            {user.avatar}
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-medium text-white">
                                                                                {user.name}
                                                                            </div>
                                                                            <div className="text-sm text-gray-400">
                                                                                {user.email}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${user.role === 'Admin'
                                                                            ? 'bg-red-500 bg-opacity-20 text-red-300'
                                                                            : 'bg-green-500 bg-opacity-20 text-green-300'
                                                                        }`}>
                                                                        {user.role}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${user.status === 'Active'
                                                                            ? 'bg-green-500 bg-opacity-20 text-green-300'
                                                                            : 'bg-red-500 bg-opacity-20 text-red-300'
                                                                        }`}>
                                                                        {user.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                                                                    <button
                                                                        onClick={() => toggleUserStatus(user.id)}
                                                                        className={`${user.status === 'Active'
                                                                                ? 'text-red-400 hover:text-red-300'
                                                                                : 'text-green-400 hover:text-green-300'
                                                                            } transition-colors duration-200 font-semibold`}
                                                                    >
                                                                        {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteUser(user.id)}
                                                                        className="text-red-400 hover:text-red-300 transition-colors duration-200 font-semibold"
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
                                                className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 border border-slate-600"
                                            >
                                                Back to Overview
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Mini View */}
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

                        {/* Glow Effect */}
                        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500 to-pink-500 blur-xl opacity-20 -z-10 transition-all duration-1000 ${activeTab === 'manage' ? 'scale-105 animate-pulse' : 'scale-95'
                            }`}></div>
                    </div>
                </div>

                {/* Stats Overview */}
                {!activeTab && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
                        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 backdrop-blur-lg">
                            <div className="flex items-center">
                                <div className="p-3 bg-cyan-500 bg-opacity-20 rounded-xl">
                                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                <div className="p-3 bg-purple-500 bg-opacity-20 rounded-xl">
                                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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