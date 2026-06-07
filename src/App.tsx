import { useEffect, useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { PropertyDetails } from "./pages/PropertyDetails";
import { Dashboard } from "./pages/Dashboard";
import { apiClient } from "./lib/api";
import { useAppDispatch, useAppSelector } from "./store";
import { setCredentials, clearCredentials, updateUser } from "./store/slices/authSlice";

function App() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);

  const checkUserSession = async () => {
    const token = localStorage.getItem("real_estate_token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get("/auth/me");
      if (response.data.status) {
        dispatch(setCredentials({ user: response.data.user, token }));
      } else {
        dispatch(clearCredentials());
      }
    } catch (err) {
      console.error("Session check failed", err);
      dispatch(clearCredentials());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUserSession();
  }, []);

  const handleLoginSuccess = (userData: any) => {
    const token = localStorage.getItem("real_estate_token") || "";
    dispatch(setCredentials({ user: userData, token }));
  };

  const handleLogout = () => {
    dispatch(clearCredentials());
  };

  const handleUserUpdate = (updatedUser: any) => {
    dispatch(updateUser(updatedUser));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          
          <Route path="/login">
            {user ? <Redirect to="/dashboard" /> : <Login onLoginSuccess={handleLoginSuccess} />}
          </Route>
          
          <Route path="/register">
            {user ? <Redirect to="/dashboard" /> : <Register onRegisterSuccess={handleLoginSuccess} />}
          </Route>
          
          <Route path="/properties/:id">
            {(params: { id: string }) => <PropertyDetails user={user} params={params} />}
          </Route>
          
          <Route path="/dashboard">
            {user ? (
              <Dashboard user={user} onUserUpdate={handleUserUpdate} />
            ) : (
              <Redirect to="/login" />
            )}
          </Route>
          
          <Route>
            <div className="text-center py-20">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">404 - Not Found</h1>
              <p className="text-gray-500">The page you are looking for does not exist.</p>
              <Redirect to="/" />
            </div>
          </Route>
        </Switch>
      </main>
      
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <p>&copy; {new Date().getFullYear()} LD99 Real Estate App Suite. Built with React & Express.</p>
      </footer>
    </div>
  );
}

export default App;
