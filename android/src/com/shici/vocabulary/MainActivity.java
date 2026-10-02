package com.shici.vocabulary;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** A local-only application: packaged assets, app-private IndexedDB and SAF backups. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private static final int PICK_FILE = 10, SAVE_FILE = 11;
    private static final Set<String> ASSETS = new HashSet<>(Arrays.asList(
        "index.html", "styles.css", "core.js", "learning-aids.js", "app.js",
        "native-adapter.js", "icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest"));
    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady, ttsFailed, destroyed;
    private String pendingText, pendingId;
    private float pendingRate;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingExport;
    private final ExecutorService files = Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        getWindow().setStatusBarColor(Color.rgb(248, 250, 245));
        getWindow().setNavigationBarColor(Color.rgb(248, 250, 245));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(248, 250, 245));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // System-selected content:// imports only.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new NativeBridge(), "ShiciAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localResource(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isLocal(uri)) return false;
                if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                    openExternal(uri);
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                // CSV/JSON providers often use nonstandard MIME types; keep the picker inclusive.
                intent.setType("*/*");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent, PICK_FILE); }
                catch (ActivityNotFoundException e) { fileCallback.onReceiveValue(null); fileCallback = null; message("手机未提供文件选择器，请直接粘贴单词。"); }
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String text, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("拾词").setMessage(text)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm()).setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String text, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("拾词").setMessage(text)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm())
                    .setNegativeButton("取消", (dialog, which) -> result.cancel()).setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsPrompt(WebView view, String url, String text, String value, JsPromptResult result) {
                EditText input = new EditText(MainActivity.this);
                input.setSingleLine(true);
                input.setText(value == null ? "" : value);
                new AlertDialog.Builder(MainActivity.this).setTitle("拾词").setMessage(text).setView(input)
                    .setPositiveButton("确定", (dialog, which) -> result.confirm(input.getText().toString()))
                    .setNegativeButton("取消", (dialog, which) -> result.cancel()).setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
        tts = new TextToSpeech(this, status -> runOnUiThread(() -> {
            if (destroyed) return;
            ttsReady = status == TextToSpeech.SUCCESS;
            ttsFailed = !ttsReady;
            if (ttsReady) {
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { speechEvent(id, "start"); }
                    @Override public void onDone(String id) { speechEvent(id, "end"); }
                    @Override public void onError(String id) { speechEvent(id, "unavailable"); }
                });
            }
            if (pendingId != null) {
                String text = pendingText, id = pendingId; float rate = pendingRate;
                pendingId = null; pendingText = null;
                say(text, rate, id);
            }
        }));
        web.loadUrl(HOME);
    }

    private boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443)
            && "/assets/index.html".equals(uri.getPath());
    }
    private WebResourceResponse localResource(Uri uri) {
        String path = uri.getPath();
        if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost()) || path == null || !path.startsWith("/assets/")) return missing();
        String name = path.substring(8);
        if (!ASSETS.contains(name)) return missing();
        String mime = name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : name.endsWith(".html") ? "text/html" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".png") ? "image/png" : "application/manifest+json";
        try { return new WebResourceResponse(mime, "UTF-8", getAssets().open(name)); }
        catch (IOException e) { return missing(); }
    }
    private WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
    }
    private void openExternal(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (ActivityNotFoundException e) { message("手机没有可打开此链接的浏览器。"); }
    }
    private void speechEvent(String id, String event) {
        runOnUiThread(() -> {
            if (!destroyed) web.evaluateJavascript("window.__shiciSpeechEvent && window.__shiciSpeechEvent(" + JSONObject.quote(id) + "," + JSONObject.quote(event) + ")", null);
        });
    }
    private void stopSpeech() {
        pendingId = null; pendingText = null;
        if (tts != null) tts.stop();
    }
    private void say(String text, float rate, String id) {
        if (destroyed) return;
        if (!ttsReady) {
            if (ttsFailed) speechEvent(id, "unavailable");
            else { pendingText = text; pendingRate = rate; pendingId = id; }
            return;
        }
        tts.stop();
        int language = tts.setLanguage(Locale.US);
        if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) {
            speechEvent(id, "unavailable"); return;
        }
        // Prefer an installed, offline English voice when the engine offers one.
        Voice preferred = null;
        Set<Voice> voices = tts.getVoices();
        if (voices != null) for (Voice voice : voices) {
            if ("en".equals(voice.getLocale().getLanguage()) && !voice.isNetworkConnectionRequired()) {
                if (preferred == null || "US".equals(voice.getLocale().getCountry())) preferred = voice;
            }
        }
        if (preferred != null) tts.setVoice(preferred);
        tts.setSpeechRate(Math.max(0.5f, Math.min(1.5f, rate)));
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.ERROR) speechEvent(id, "unavailable");
    }
    private void message(String text) { runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show()); }

    public final class NativeBridge {
        @JavascriptInterface public void speak(String text, double rate, String id) {
            if (text == null || id == null || text.length() > TextToSpeech.getMaxSpeechInputLength()) { if (id != null) speechEvent(id, "unavailable"); return; }
            runOnUiThread(() -> say(text, (float) rate, id));
        }
        @JavascriptInterface public void stopSpeech() { runOnUiThread(() -> MainActivity.this.stopSpeech()); }
        @JavascriptInterface public void openSpeechSettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent("com.android.settings.TTS_SETTINGS")); }
                catch (ActivityNotFoundException e) { message("请到手机设置搜索“文字转语音”，安装英文语音。"); }
            });
        }
        @JavascriptInterface public void saveDocument(String filename, String content, String mime) {
            runOnUiThread(() -> {
                if (pendingExport != null) { message("请先完成或取消上一次保存。"); return; }
                if (filename == null || content == null || !(filename.endsWith(".json") || filename.endsWith(".csv"))) { message("备份文件格式不正确。"); return; }
                pendingExport = content.getBytes(StandardCharsets.UTF_8);
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(filename.endsWith(".json") ? "application/json" : "text/csv");
                intent.putExtra(Intent.EXTRA_TITLE, filename.replaceAll("[\\\\/:*?\"<>|]", "_"));
                try { startActivityForResult(intent, SAVE_FILE); }
                catch (ActivityNotFoundException e) { pendingExport = null; message("手机未提供文件保存器。"); }
            });
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE) {
            if (fileCallback != null) {
                Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
                fileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri}); fileCallback = null;
            }
        } else if (requestCode == SAVE_FILE) {
            byte[] content = pendingExport; pendingExport = null;
            Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
            if (uri == null || content == null) return;
            files.execute(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new IOException("No output stream");
                    output.write(content); output.flush(); message("已保存，请保留备份文件。");
                } catch (IOException | SecurityException e) { message("保存未完成，请重新导出并选择可写入的文件夹。"); }
            });
        }
    }
    @Override public void onBackPressed() {
        String url = web.getUrl();
        if (url != null && url.contains("#") && !url.endsWith("#today")) web.evaluateJavascript("location.hash = '#today'", null);
        else super.onBackPressed();
    }
    @Override protected void onPause() { stopSpeech(); web.onPause(); super.onPause(); }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            // Refresh day-based tasks after returning from the background, including overnight.
            web.evaluateJavascript("window.dispatchEvent(new Event('visibilitychange'))", null);
        }
    }
    @Override protected void onDestroy() {
        destroyed = true; stopSpeech();
        if (tts != null) tts.shutdown();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        pendingExport = null; files.shutdown();
        web.removeJavascriptInterface("ShiciAndroid"); web.destroy();
        super.onDestroy();
    }
}
