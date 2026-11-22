package app.astroorbi.store;

import android.app.Activity;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

// Google's public test units. This plugin is packaged only in the internal Play build.
@CapacitorPlugin(name = "PlayAds")
public class PlayAds extends Plugin {
    private static final String INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
    private static final String REWARDED = "ca-app-pub-3940256099942544/5224354917";
    private InterstitialAd interstitial;
    private RewardedAd rewarded;
    private boolean initializing, initialized, loadingInterstitial, loadingRewarded, showing;
    private long interstitialAt, rewardedAt;
    private static long now() { return android.os.SystemClock.elapsedRealtime(); }
    private static boolean fresh(long loadedAt) { return now() - loadedAt < 55 * 60_000L; }

    @PluginMethod
    public void prepare(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (initialized) preload();
            else if (!initializing) {
                initializing = true;
                MobileAds.initialize(getContext(), status -> getActivity().runOnUiThread(() -> {
                    initialized = true;
                    preload();
                }));
            }
            call.resolve();
        });
    }

    private void preload() {
        Activity activity = getActivity();
        if (activity.isFinishing() || activity.isDestroyed()) return;
        if (!fresh(interstitialAt)) interstitial = null;
        if (!fresh(rewardedAt)) rewarded = null;
        if (interstitial == null && !loadingInterstitial) {
            loadingInterstitial = true;
            InterstitialAd.load(activity, INTERSTITIAL, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull InterstitialAd ad) {
                    interstitial = ad; interstitialAt = now(); loadingInterstitial = false;
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError error) { loadingInterstitial = false; }
            });
        }
        if (rewarded == null && !loadingRewarded) {
            loadingRewarded = true;
            RewardedAd.load(activity, REWARDED, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull RewardedAd ad) {
                    rewarded = ad; rewardedAt = now(); loadingRewarded = false;
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError error) { loadingRewarded = false; }
            });
        }
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Activity activity = getActivity();
            boolean forReward = "rewarded".equals(call.getString("type"));
            if (showing || !activity.hasWindowFocus() || !initialized) { call.reject("NOT_READY"); return; }
            preload();
            if ((forReward && rewarded == null) || (!forReward && interstitial == null)) {
                call.reject("NOT_READY");
                return;
            }
            showing = true;
            JSObject result = new JSObject();
            result.put("earned", false);
            FullScreenContentCallback listener = new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() {
                    showing = false;
                    call.resolve(result);
                    preload();
                }
                @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                    showing = false;
                    call.reject("SHOW_FAILED");
                    preload();
                }
            };
            if (forReward) {
                RewardedAd ad = rewarded;
                rewarded = null;
                ad.setFullScreenContentCallback(listener);
                ad.show(activity, reward -> result.put("earned", true));
            } else {
                InterstitialAd ad = interstitial;
                interstitial = null;
                ad.setFullScreenContentCallback(listener);
                ad.show(activity);
            }
        });
    }
}
