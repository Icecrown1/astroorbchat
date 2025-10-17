import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/store/useAuth";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void;
  }
}

export default function Login() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const isDev = import.meta.env.DEV;

  // Auto-login for dev mode
  useEffect(() => {
    if (isDev) {
      handleDevLogin();
    }
  }, [isDev]);

  const handleDevLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/test", {
        telegramId: "999999999",
        firstName: "Dev",
        lastName: "User",
        username: "devuser"
      });
      
      if (response?.ok && response?.data) {
        const { user: userData, token } = response.data;
        setAuth(userData, token);
        setLocation("/dashboard");
      }
    } catch (error: any) {
      console.error("Dev login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isDev || !containerRef.current) return;

    const botUsername = import.meta.env.VITE_BOT_USERNAME || "astro_orb_bot";

    // Create Telegram Login Widget
    const widgetScript = document.createElement("script");
    widgetScript.src = "https://telegram.org/js/telegram-widget.js?22";
    widgetScript.setAttribute("data-telegram-login", botUsername);
    widgetScript.setAttribute("data-size", "large");
    widgetScript.setAttribute("data-radius", "12");
    widgetScript.setAttribute("data-request-access", "write");
    widgetScript.setAttribute("data-onauth", "onTelegramAuth(user)");
    widgetScript.async = true;

    // Define callback function
    window.onTelegramAuth = async (user: any) => {
      try {
        const response = await apiRequest("POST", "/api/auth/tg-login", user);
        
        if (response?.ok && response?.data) {
          const { user: userData, token } = response.data;
          
          // Save auth data to store (will persist to localStorage)
          setAuth(userData, token);
          
          // Redirect to dashboard
          setLocation("/dashboard");
        } else {
          alert(`Login error: ${response?.error || "Unknown error"}`);
        }
      } catch (error: any) {
        console.error("Login error:", error);
        alert(`Login failed: ${error.message || "Network error"}`);
      }
    };

    containerRef.current.appendChild(widgetScript);

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [setAuth, setLocation, isDev]);

  if (isDev) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-violet-900 to-indigo-900 p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-purple-500/30">
                <Sparkles className="w-10 h-10 text-purple-300" />
              </div>
            </div>
            
            <h1 className="text-4xl font-bold text-white font-syne">
              Astro Orb
            </h1>
            
            <p className="text-lg text-purple-200">
              AI-Powered Astrology Readings
            </p>
          </div>

          <div className="space-y-6 pt-8">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <p className="text-white mb-6">
                {isLoading ? "Вход в dev режиме..." : "Автоматический вход для разработки"}
              </p>
              
              {!isLoading && (
                <Button 
                  onClick={handleDevLogin}
                  className="w-full"
                  data-testid="button-dev-login"
                >
                  Войти как Dev User
                </Button>
              )}
            </div>

            <p className="text-sm text-purple-300">
              Dev режим: автоматическая аутентификация
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-violet-900 to-indigo-900 p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-purple-500/30">
              <Sparkles className="w-10 h-10 text-purple-300" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-white font-syne">
            Astro Orb
          </h1>
          
          <p className="text-lg text-purple-200">
            AI-Powered Astrology Readings
          </p>
        </div>

        <div className="space-y-6 pt-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <p className="text-white mb-6">
              Sign in with your Telegram account to access your personalized astrology dashboard
            </p>
            
            <div 
              ref={containerRef} 
              className="flex justify-center"
              data-testid="telegram-login-widget-container"
            />
          </div>

          <p className="text-sm text-purple-300">
            By signing in, you agree to use Telegram authentication for secure access
          </p>
        </div>
      </div>
    </div>
  );
}
