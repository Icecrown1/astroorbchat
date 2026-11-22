// Apply to a fresh, disposable Capacitor Android project, after prepare-android.mjs.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

const app = new URL('../android/app/', import.meta.url);
const files = new URL('../play-internal/', import.meta.url);
const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url)));
const id = process.env.PLAY_APPLICATION_ID || 'app.astroorbi.mobile';
const version = Number(process.env.PLAY_VERSION_CODE || 1);
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(id)) throw Error('Invalid Play application ID');
if (!Number.isInteger(version) || version < 1 || version > 2100000000) throw Error('Invalid Play versionCode');

async function replaceIn(path, replacements) {
  const target = new URL(path, app);
  let contents = await readFile(target, 'utf8');
  for (const [pattern, replacement] of replacements) {
    const updated = contents.replace(pattern, replacement);
    if (updated === contents) throw Error('Unrecognized Android template: ' + path);
    contents = updated;
  }
  await writeFile(target, contents);
}
await replaceIn('build.gradle', [
  [/applicationId "[^"]+"/, 'applicationId "' + id + '"'],
  [/versionCode \d+\s+versionName "[^"]+"/, 'versionCode ' + version + '\n        versionName "0.2.' + version + '"'],
  ['dependencies {', "dependencies {\n    implementation 'com.google.android.gms:play-services-ads:24.9.0'\n    implementation 'com.android.billingclient:billing:8.3.0'"],
]);
await replaceIn('src/main/AndroidManifest.xml', [
  ['</activity>', `    <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="astroorbi" android:host="payment-return" />
            </intent-filter>
        </activity>`],
  ['android:allowBackup="true"', 'android:allowBackup="false"'],
  ['<activity', '<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-3940256099942544~3347511713" />\n        <activity'],
  ['android:name=".MainActivity"', 'android:name="' + config.appId + '.MainActivity"'],
]);
await replaceIn('src/main/res/values/strings.xml', [[new RegExp(config.appId.replaceAll('.', '\\.'), 'g'), id]]);
await replaceIn('src/main/java/' + config.appId.replaceAll('.', '/') + '/MainActivity.java', [
  ['super.onCreate(savedInstanceState);', 'registerPlugin(app.astroorbi.store.PlayAds.class);\n        registerPlugin(app.astroorbi.store.PlayCatalog.class);\n        super.onCreate(savedInstanceState);'],
]);
const target = new URL('src/main/java/app/astroorbi/store/', app);
await mkdir(target, { recursive: true });
for (const name of ['PlayAds.java', 'PlayCatalog.java']) await copyFile(new URL(name, files), new URL(name, target));
