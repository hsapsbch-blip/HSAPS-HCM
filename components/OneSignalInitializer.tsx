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

    // Use the v16 SDK deferred push pattern
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      // The init method returns a promise that resolves when initialization is complete.
      oneSignalInitPromise = OneSignal.init({
        // QUAN TRỌNG: Đây là nơi bạn cần cập nhật App ID từ tài khoản OneSignal của bạn.
        appId: "7e26cfd8-982d-4e68-9b7a-13d8770447bb", 
        allowLocalhostAsSecureOrigin: true,
        origin: 'https://hsaps-hcm.vercel.app',
      });

      // Wait for initialization to finish before adding event listeners.
      await oneSignalInitPromise;
      
      console.log('[OneSignal Debug] Initialization complete.');

      // Use the new event listener API for subscription changes
      OneSignal.Notifications.addEventListener('change', (event) => {
        console.log("[OneSignal Debug] The user's subscription state is now:", event.subscriptions.isSubscribed);
      });

      // Check and log the current state immediately after init
      if (OneSignal.Notifications.isPushEnabled) {
          console.log("[OneSignal Debug] Push notifications enabled.");
          const playerId = OneSignal.User.pushSubscription.id;
          if (playerId) {
              console.log("[OneSignal Debug] Player ID:", playerId);
          }
      } else {
          console.log("[OneSignal Debug] Push notifications not enabled.");
      }

      // Use the new event listener API for notification clicks
      OneSignal.Notifications.addEventListener('click', (event) => {
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
  }, []); // Empty dependency array ensures this runs only once.

  // This effect synchronizes the user's login state with OneSignal.
  useEffect(() => {
    // Do nothing until OneSignal is being initialized.
    if (!oneSignalInitPromise) {
      return;
    }
    
    const syncUser = async () => {
      await oneSignalInitPromise;
      // After init, the global OneSignal object is available
      const OneSignal = window.OneSignal;
      if (!OneSignal) {
        console.error('[OneSignal Error] SDK not available for user sync.');
        return;
      }

      if (profile?.id) {
        console.log(`[OneSignal Debug] Logging in OneSignal user: ${profile.id}`);
        await OneSignal.login(profile.id);
      } else {
        // Check if a user is logged in before attempting to log out
        const externalId = OneSignal.User.getExternalId();
        if (externalId) {
             console.log('[OneSignal Debug] Logging out OneSignal user.');
             await OneSignal.logout();
        }
      }
    };

    syncUser();

  }, [profile]); // Re-run this effect when the user profile changes.

  return null; // This component does not render anything.
};

export default OneSignalInitializer;