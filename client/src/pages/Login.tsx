import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/store/useAuth";
import { Sparkles } from "lucide-react";
import { OrbIcon } from '@/components/OrbIcon';
import { Button } from "@/components/ui/button";
import { getInitData, getReferralCode, getTelegramUser, getWebSourceFromStartParam } from "@/lib/telegram";

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
  const [authMethod, setAuthMethod] = useState<'miniapp' | 'widget' | 'dev' | null>(null);
  const isDev = import.meta.env.DEV;

  // Try Telegram Mini App auth first, then dev mode, then widget
  useEffect(() => {
    const initData = getInitData();
    
    if (initData) {
      // Running as Telegram Mini App - use automatic auth
      console.log('[Auth] Detected Telegram Mini App mode');
      setAuthMethod('miniapp');
      handleMiniAppLogin(initData);
    } else if (isDev) {
      // Development mode - use test auth
      console.log('[Auth] Detected dev mode');
      setAuthMethod('dev');
      handleDevLogin();
    } else {
      // Web mode - show Login Widget
      console.log('[Auth] Using Telegram Login Widget');
      setAuthMethod('widget');
    }
  }, [isDev]);

  const handleMiniAppLogin = async (initData: string) => {
    setIsLoading(true);
    try {
      console.log('[Mini App Auth] Starting automatic login...');
      
      // Get referral code if present
      const referralCode = getReferralCode();
      if (referralCode) {
        console.log('[Mini App Auth] Found referral code:', referralCode);
      }
      
      const tgUser = getTelegramUser();
      console.log('[Mini App Auth] Telegram user:', tgUser);

      const response = await apiRequest("POST", "/api/auth/telegram", {
        initData,
        name: tgUser?.first_name || "User",
        referralCode: referralCode || undefined,
        signupSource: getWebSourceFromStartParam() || undefined,
      });
      
      if (response?.ok && response?.data) {
        const { user: userData, token } = response.data;
        console.log('[Mini App Auth] Login successful');
        setAuth(userData, token);
        
        // Check if user needs to complete registration
        // Profile is complete if birthPlace is set (not null from minimal registration)
        const profileComplete = userData.birthPlace !== null && userData.birthPlace !== '';
        if (!profileComplete) {
          console.log('[Mini App Auth] User needs to complete registration');
          setLocation("/register");
        } else {
          console.log('[Mini App Auth] Redirecting to dashboard');
          setLocation("/dashboard");
        }
      } else {
        console.error('[Mini App Auth] Login failed:', response);
        // Fallback to widget on failure
        setAuthMethod('widget');
      }
    } catch (error: any) {
      console.error("[Mini App Auth] Error:", error);
      // Fallback to widget on error
      setAuthMethod('widget');
    } finally {
      setIsLoading(false);
    }
  };

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
        
        // Check if user needs to complete registration
        // Profile is complete if birthPlace is set (not null from minimal registration)
        const profileComplete = userData.birthPlace !== null && userData.birthPlace !== '';
        if (!profileComplete) {
          setLocation("/register");
        } else {
          setLocation("/dashboard");
        }
      }
    } catch (error: any) {
      console.error("Dev login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authMethod !== 'widget' || !containerRef.current) return;

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
      console.log('[Telegram Widget] Callback triggered with user:', user);
      try {
        console.log('[Telegram Widget] Sending request to /api/auth/tg-login');
        const response = await apiRequest("POST", "/api/auth/tg-login", user);
        console.log('[Telegram Widget] Response received:', response);
        
        if (response?.ok && response?.data) {
          const { user: userData, token } = response.data;
          
          console.log('[Telegram Widget] Login successful');
          // Save auth data to store (will persist to localStorage)
          setAuth(userData, token);
          
          // Check if user needs to complete registration
          // Profile is complete if birthPlace is set (not null from minimal registration)
          const profileComplete = userData.birthPlace !== null && userData.birthPlace !== '';
          if (!profileComplete) {
            console.log('[Telegram Widget] User needs to complete registration');
            setLocation("/register");
          } else {
            console.log('[Telegram Widget] Redirecting to dashboard');
            setLocation("/dashboard");
          }
        } else {
          console.error('[Telegram Widget] Login failed:', response);
          alert(`Login error: ${response?.error || "Unknown error"}\n\nDetails: ${JSON.stringify(response?.details || {})}`);
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
  }, [setAuth, setLocation, authMethod]);

  // Show loading state for Mini App or Dev auth
  if (authMethod === 'miniapp' || authMethod === 'dev') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-violet-900 to-indigo-900 p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-purple-500/30 animate-pulse">
                <OrbIcon className="w-10 h-10 text-purple-300" />
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
                {authMethod === 'miniapp' ? "Вход через Telegram Mini App..." : "Вход в dev режиме..."}
              </p>
              
              {authMethod === 'dev' && !isLoading && (
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
              {authMethod === 'miniapp' ? "Автоматическая аутентификация через Telegram" : "Dev режим: автоматическая аутентификация"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if registration without Telegram is allowed
  const allowWithoutTelegram = import.meta.env.VITE_ALLOW_REGISTRATION_WITHOUT_TELEGRAM === 'true';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-violet-900 to-indigo-900 p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-purple-500/30">
              <OrbIcon className="w-10 h-10 text-purple-300" />
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
            {allowWithoutTelegram ? (
              // Show direct registration button for moderation/testing
              <>
                <p className="text-white mb-6">
                  Создайте профиль для доступа к персональным астрологическим прогнозам
                </p>
                <Button 
                  onClick={() => setLocation('/register')}
                  className="w-full"
                  size="lg"
                  data-testid="button-create-profile"
                >
                  Создать профиль
                </Button>
              </>
            ) : (
              // Show Telegram Login Widget (default behavior)
              <>
                <p className="text-white mb-6">
                  Sign in with your Telegram account to access your personalized astrology dashboard
                </p>
                
                <div 
                  ref={containerRef} 
                  className="flex justify-center"
                  data-testid="telegram-login-widget-container"
                />
              </>
            )}
          </div>

          <p className="text-sm text-purple-300">
            {allowWithoutTelegram 
              ? "Для модерации: можно создать профиль без Telegram" 
              : "By signing in, you agree to use Telegram authentication for secure access"}
          </p>
        </div>
      </div>
    </div>
  );
}
