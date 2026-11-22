package app.astroorbi.store;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.google.ads.mediation.admob.AdMobAdapter;
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
    private final Handler ui = new Handler(Looper.getMainLooper());
    private PluginCall waitingReward;
    private int rewardGeneration;
    // Android can deliver the Back used to close AdActivity to the host as it regains focus.
    private long ignoreBackUntil;
    public boolean consumesAdBack() {
        return showing || now() < ignoreBackUntil;
    }
    private final Runnable loadTimeout = () -> {
        rewardGeneration++;
        loadingRewarded = false;
        finishWait("AD_TIMEOUT");
    };
    private static long now() { return android.os.SystemClock.elapsedRealtime(); }
    private static boolean fresh(long loadedAt) { return now() - loadedAt < 55 * 60_000L; }

    @PluginMethod
    public void prepare(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            startAds();
            call.resolve();
        });
    }

    private void startAds() {
        if (initialized) {
            preload();
        } else if (!initializing) {
            initializing = true;
            MobileAds.initialize(getContext(), status -> ui.post(() -> {
                initialized = true;
                preload();
            }));
        }
    }

    // The caller rechecks the active reading before presenting an asynchronously loaded ad.
    @PluginMethod
    public void loadReward(PluginCall call) {
        ui.post(() -> {
            Activity activity = getActivity();
            if (activity == null || !activity.hasWindowFocus()) { call.reject("AD_INACTIVE", "AD_INACTIVE"); return; }
            if (waitingReward != null || showing) { call.reject("AD_BUSY", "AD_BUSY"); return; }
            if (rewarded != null && fresh(rewardedAt)) { call.resolve(); return; }
            waitingReward = call;
            ui.postDelayed(loadTimeout, 15000);
            startAds();
        });
    }

    private void finishWait(String error) {
        ui.removeCallbacks(loadTimeout);
        PluginCall call = waitingReward;
        waitingReward = null;
        if (call == null) return;
        if (error == null) call.resolve();
        else call.reject(error, error);
    }

    @Override protected void handleOnPause() {
        finishWait("AD_INACTIVE");
    }

    @Override protected void handleOnDestroy() {
        rewardGeneration++;
        finishWait("AD_INACTIVE");
    }

    private void preload() {
        Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) return;
        if (!fresh(interstitialAt)) interstitial = null;
        if (!fresh(rewardedAt)) rewarded = null;
        Bundle privacy = new Bundle();
        privacy.putString("npa", "1");
        AdRequest request = new AdRequest.Builder().addNetworkExtrasBundle(AdMobAdapter.class, privacy).build();
        if (interstitial == null && !loadingInterstitial) {
            loadingInterstitial = true;
            InterstitialAd.load(activity, INTERSTITIAL, request, new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull InterstitialAd ad) {
                    interstitial = ad; interstitialAt = now(); loadingInterstitial = false;
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError error) { loadingInterstitial = false; }
            });
        }
        if (rewarded == null && !loadingRewarded) {
            loadingRewarded = true;
            final int generation = ++rewardGeneration;
            RewardedAd.load(activity, REWARDED, request, new RewardedAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull RewardedAd ad) {
                    if (generation != rewardGeneration) return;
                    rewarded = ad; rewardedAt = now(); loadingRewarded = false;
                    finishWait(null);
                }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    if (generation != rewardGeneration) return;
                    loadingRewarded = false;
                    finishWait("GMA_LOAD_" + error.getCode());
                }
            });
        }
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Activity activity = getActivity();
            boolean forReward = "rewarded".equals(call.getString("type"));
            if (activity == null || !activity.hasWindowFocus()) { call.reject("AD_INACTIVE", "AD_INACTIVE"); return; }
            if (showing || !initialized) { call.reject("NOT_READY", "NOT_READY"); return; }
            preload();
            if ((forReward && rewarded == null) || (!forReward && interstitial == null)) {
                call.reject("NOT_READY", "NOT_READY");
                return;
            }
            showing = true;
            JSObject result = new JSObject();
            result.put("earned", false);
            FullScreenContentCallback listener = new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() {
                    ignoreBackUntil = now() + android.view.ViewConfiguration.getDoubleTapTimeout();
                    showing = false;
                    call.resolve(result);
                    preload();
                }
                @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError error) {
                    showing = false;
                    String code = "GMA_SHOW_" + error.getCode();
                    call.reject(code, code);
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
