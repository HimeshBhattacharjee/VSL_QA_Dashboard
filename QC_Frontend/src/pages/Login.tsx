import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";

export default function Login() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<"admin" | "user">("admin");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("username");
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (
            (activeTab === "admin" && username === "admin" && password === "admin") ||
            (activeTab === "user" && username === "user" && password === "user")
        ) {
            sessionStorage.setItem("isLoggedIn", "true");
            sessionStorage.setItem("username", username);
            navigate("/home");
        } else setError("Invalid username or password.");
    };

    return (
        <>
            <Header />
            <div className="flex items-center justify-center">
                <div className="w-full max-w-sm p-8 my-6 rounded-2xl bg-white/10 backdrop-blur-lg shadow-2xl text-white border border-white/20 hover:scale-101">
                    <h1 className="text-3xl font-bold text-center mb-6">Welcome</h1>
                    <div className="flex mb-6 rounded-xl bg-white/10 overflow-hidden">
                        {["admin", "user"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab as "admin" | "user");
                                    setError("");
                                    setUsername("");
                                    setPassword("");
                                }}
                                className={`flex-1 py-2 cursor-pointer font-semibold transition-all duration-300 ${activeTab === tab
                                    ? "bg-indigo-600 text-white"
                                    : "text-gray-300 hover:text-white"
                                    }`}
                            >
                                {tab === "admin" ? "Admin Login" : "User Login"}
                            </button>
                        ))}
                    </div>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block mb-1 text-sm font-medium">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-white/20 focus:bg-white/30 focus:outline-none text-white placeholder-gray-300"
                                placeholder="Enter your username"
                                required
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
                            />
                        </div>
                        {error && (<p className="text-red-400 text-sm text-center font-medium">{error}</p>)}
                        <button
                            type="submit"
                            className="w-full py-2 mt-2 cursor-pointer bg-indigo-700 hover:bg-indigo-600 hover:scale-102 transition-all duration-300 font-semibold rounded-lg shadow-md"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}