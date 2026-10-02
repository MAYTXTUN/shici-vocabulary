# 拾词安卓版

这是可离线运行的安卓安装包，应用 ID 为 `com.shici.vocabulary`，最低 Android 8.0（API 26），目标 API 35。HTML、CSS、JS 与单词逻辑从项目根目录打包，使用固定的应用内 HTTPS origin。此地址由本地资源拦截器提供，不访问互联网，也不依赖电脑服务器。

- WebView 开启 JavaScript 与 DOM 存储，IndexedDB 保存词库、设置和进度。
- 不申请互联网、摄像头、麦克风或广泛存储权限。词源链接交给外部浏览器。
- 文件导入使用系统 `ACTION_OPEN_DOCUMENT`；CSV 和完整 JSON 备份通过 `ACTION_CREATE_DOCUMENT` 写入用户选择的位置。
- 朗读通过原生 TextToSpeech，优先选已安装的离线英文语音；语音是否可用取决于手机语音引擎。
- 网页版与应用版共用核心逻辑，安卓适配脚本只处理语音、文件保存及旧 WebView 的 structuredClone 回退。
- 原生桥仅对打包的可信本地页面开放，外部页面不会在带桥的 WebView 中加载。Service Worker 在应用中关闭，更新界面随 APK 更新。

## 构建

本次构建工具位于根目录 `.android-tools/`：Temurin JDK 17、官方 Android 平台 35 与 Build Tools 35.0.0。下载文件已与官方元数据中的 SHA-256 / SHA-1 校验值核对。运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File android/build.ps1
```

输出为根目录 `拾词-安卓安装包.apk`。下次升级可增加版本号：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File android/build.ps1 -VersionCode 2 -VersionName 1.0.1
```

**保留 `android/signing/` 内的签名密钥与密码。** 未来升级必须使用同一应用 ID 和签名；密钥不能公开或加入 Git。更新时直接覆盖安装，不要先卸载。应用内数据不依赖版本号或网址改变。

目前完成编译、签名、APK 内容检查与共享逻辑/适配器测试；未连接安卓真机，因此安装、文件选择器和手机 TTS 的实际表现需在目标手机验证。

## 官方技术依据

- [Android 本地 WebView 内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [系统文件访问框架](https://developer.android.com/training/data-storage/shared/documents-files)
- [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech)
- [APK 签名与校验](https://developer.android.com/tools/apksigner)
