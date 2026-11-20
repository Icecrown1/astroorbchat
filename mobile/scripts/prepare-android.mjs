import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
const main = new URL('../android/app/src/main/', import.meta.url);
const resources = new URL('res/', main);
const mark = new URL('../../client/public/brand/icon-512.png', import.meta.url);
const markDirectory = new URL('drawable-nodpi/', resources);

await mkdir(markDirectory, { recursive: true });
await copyFile(mark, new URL('astroorbi_mark.png', markDirectory));

for (const directory of await readdir(resources)) {
  if (!/^mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)$/.test(directory)) continue;
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
    await copyFile(mark, new URL(`${directory}/${name}`, resources));
  }
}

const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/astroorbi_adaptive_mark" />
</adaptive-icon>
`;
for (const file of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  await writeFile(new URL(`mipmap-anydpi-v26/${file}`, resources), adaptiveIcon);
}

await writeFile(new URL('drawable/astroorbi_adaptive_mark.xml', resources), `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/astroorbi_mark" android:inset="17%" />
`);

const colors = new URL('values/ic_launcher_background.xml', resources);
const colorXml = (await readFile(colors, 'utf8')).replace(
  /(<color name="ic_launcher_background">).*?(<\/color>)/,
  '$1#171425$2',
);
await writeFile(colors, colorXml);

const styles = new URL('values/styles.xml', resources);
const themeXml = (await readFile(styles, 'utf8')).replace(
  /<style name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?<\/style>/,
  `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/ic_launcher_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/astroorbi_adaptive_mark</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`,
);
await writeFile(styles, themeXml);

const activity = new URL(`java/${config.appId.replaceAll('.', '/')}/MainActivity.java`, main);
await writeFile(activity, `package ${config.appId};

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
`);
