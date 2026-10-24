import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const res=path.join(root,"android","app","src","main","res");
const javaDir=path.join(root,"android","app","src","main","java","com","clipsmith","studio");
await mkdir(javaDir,{recursive:true});
await writeFile(path.join(javaDir,"MainActivity.java"),`package com.clipsmith.studio;

import android.content.ComponentCallbacks2;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 8, 12));
        getWindow().setNavigationBarColor(Color.rgb(7, 8, 12));
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level < ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW || getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.post(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new Event('clipsmith-native-memory-warning'))", null
            ));
        }
    }
}
`);
await mkdir(path.join(res,"drawable"),{recursive:true});
await writeFile(path.join(res,"drawable","ic_launcher_foreground.xml"),`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#00000000" android:strokeColor="#F5F1FF" android:strokeWidth="6" android:strokeLineCap="round" android:pathData="M34,38 L77,75 M34,70 L77,33"/>
    <path android:fillColor="#00000000" android:strokeColor="#A991FF" android:strokeWidth="7" android:strokeLineCap="round" android:pathData="M28,28 m-10,0 a10,10 0,1 0,20 0 a10,10 0,1 0,-20 0 M28,80 m-10,0 a10,10 0,1 0,20 0 a10,10 0,1 0,-20 0"/>
    <path android:fillColor="#9D7CFF" android:pathData="M74,28 L89,21 L82,36 Z M74,80 L89,87 L82,72 Z"/>
</vector>
`);
await mkdir(path.join(res,"values"),{recursive:true});
await writeFile(path.join(res,"values","clipsmith_colors.xml"),`<?xml version="1.0" encoding="utf-8"?>
<resources><color name="clipsmith_icon_background">#07080C</color></resources>
`);
await mkdir(path.join(res,"mipmap-anydpi-v26"),{recursive:true});
const iconXml=`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/clipsmith_icon_background"/>
  <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`;
await writeFile(path.join(res,"mipmap-anydpi-v26","ic_launcher.xml"),iconXml);
await writeFile(path.join(res,"mipmap-anydpi-v26","ic_launcher_round.xml"),iconXml);
console.log("Applied ClipSmith icon, dark system bars, and Android low-memory callbacks.");
