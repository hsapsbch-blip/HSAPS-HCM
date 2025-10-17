import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

// Store the init promise in a module-level variable to ensure it's a singleton.
let oneSignalInitPromise: Promise<void> | null = null;

const OneSignalInitializer = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  // Use a ref to hold the navigate function to avoid re-running the effect.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // This effect runs only once to initialize OneSignal.
  useEffect(() => {
    // Prevent re-initialization on re-renders.
    if (oneSignalInitPromise) {
      return;
    }

    window.OneSignal = window.OneSignal || [];
    window.OneSignal.push(() => {
      // The init method returns a promise that resolves when initialization is complete.
      oneSignalInitPromise = window.OneSignal.init({
        // QUAN TRỌNG: Đây là nơi bạn cần cập nhật App ID từ tài khoản OneSignal của bạn.
        appId: "42cf9351-9baf-4cb8-8c69-9e660fe161bc", 
        allowLocalhostAsSecureOrigin: true,
        // FIX: Explicitly define paths for both workers to prevent the SDK from
        // trying to register a worker from the wrong origin (e.g., ai.studio).
        // By pointing both to our single custom service worker (which imports the OneSignal code),
        // we ensure correct registration within the app's actual origin.
        serviceWorkerPath: "/service-worker.js",
        serviceWorkerUpdaterPath: "/service-worker.js",
        serviceWorkerParam: { scope: '/' },
      });

      // Wait for initialization to finish before adding event listeners.
      oneSignalInitPromise.then(() => {
        console.log('[OneSignal Debug] Initialization complete.');

        // Add extensive logging for debugging subscription status
        window.OneSignal.on('subscriptionChange', function (isSubscribed: boolean) {
            console.log("[OneSignal Debug] The user's subscription state is now:", isSubscribed);
        });

        // Check and log the current state immediately after init
        window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
            console.log("[OneSignal Debug] Push notifications enabled:", isEnabled);
            if(isEnabled) {
                 window.OneSignal.getUserId((userId: string) => {
                    console.log("[OneSignal Debug] Player ID:", userId);
                 });
            }
        });


        window.OneSignal.on('notificationClick', (event) => {
          console.log('[OneSignal Debug] Notification clicked:', event);
          
          const url = event.notification.launchURL;
          if (url) {
            try {
              const path = new URL(url).hash.substring(1);
              if (path) {
                navigateRef.current(path);
              }
            } catch (e) {
              console.error("[OneSignal Error] Could not parse launchURL:", e);
            }
          }
        });
      });
    });
  }, []); // Empty dependency array ensures this runs only once.

  // This effect synchronizes the user's login state with OneSignal.
  useEffect(() => {
    // Do nothing until OneSignal is being initialized.
    if (!oneSignalInitPromise) {
      return;
    }
    
    // Wait for the initialization promise to resolve before calling other methods.
    oneSignalInitPromise.then(() => {
      if (profile?.id) {
        console.log(`[OneSignal Debug] Setting external user ID: ${profile.id}`);
        window.OneSignal.setExternalUserId(profile.id);
      } else {
        // Only attempt to remove the ID if it has been set.
        window.OneSignal.getExternalUserId().then((externalUserId: string | null) => {
          if (externalUserId) {
            console.log('[OneSignal Debug] Removing external user ID.');
            window.OneSignal.removeExternalUserId();
          }
        });
      }
    });
  }, [profile]); // Re-run this effect when the user profile changes.

  return null; // This component does not render anything.
};

export default OneSignalInitializer;