package app.astroorbi.store;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.util.Log;
import java.io.File;

/** Installed only in the disposable emulator build. */
public class AdLifecycle implements Application.ActivityLifecycleCallbacks {
    private static boolean installed;

    static synchronized void install(Application application) {
        if (!installed) {
            application.registerActivityLifecycleCallbacks(new AdLifecycle());
            installed = true;
        }
    }

    @Override public void onActivityResumed(Activity activity) {
        if (!activity.getClass().getName().equals("com.google.android.gms.ads.AdActivity")) return;
        Log.i("AstroAdQA", "SDK activity resumed");
        File marker = new File(activity.getFilesDir(), "qa-dismiss-next-ad");
        if (marker.delete()) {
            activity.getWindow().getDecorView().post(() -> {
                Log.i("AstroAdQA", "Android finishes SDK activity before user interaction");
                activity.finish();
            });
        }
    }
    @Override public void onActivityCreated(Activity a, Bundle b) {}
    @Override public void onActivityStarted(Activity a) {}
    @Override public void onActivityPaused(Activity a) {}
    @Override public void onActivityStopped(Activity a) {}
    @Override public void onActivitySaveInstanceState(Activity a, Bundle b) {}
    @Override public void onActivityDestroyed(Activity a) {}
}
