using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace TRIScore.Desktop;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);
        string? testDirectory = null, testStage = null;
        if (args.Length != 0)
        {
            if (args.Length != 4 || args[0] != "--smoke-dir" || args[2] != "--smoke-stage" ||
                !new[] { "create", "reopen", "import", "atlas", "atlas-reopen", "origins", "origins-reopen", "origins-legacy", "chrome", "chrome-preview", "profile-copy-tests", "profile-reopen" }.Contains(args[3])) return 2;
            testDirectory = Path.GetFullPath(args[1]);
            testStage = args[3];
            Directory.CreateDirectory(testDirectory);
            if (testStage == "profile-copy-tests")
            {
                try
                {
                    var report = ProfileContinuity.RunSelfTests(testDirectory);
                    File.WriteAllText(Path.Combine(testDirectory, "profile-copy-tests-result.json"), JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
                    return 0;
                }
                catch (Exception error)
                {
                    File.WriteAllText(Path.Combine(testDirectory, "profile-copy-tests-error.txt"), ProfileContinuity.SanitizeDiagnostics(error.ToString()));
                    return 1;
                }
            }
        }
        var profile = testDirectory == null
            ? ProfileContinuity.CurrentProfile
            : Path.Combine(testDirectory, testStage == "import" ? "import-profile" : "profile");
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(profile.ToUpperInvariant())))[..24];
        using var mutex = new Mutex(true, @"Local\TRIScore.CosmicOrigins." + key, out bool first);
        if (!first)
        {
            if (testDirectory == null) MessageBox.Show("Another TRIScore version is already using this Cosmic Origins profile. Close that window before opening this version.", "TRIScore 4.3.3");
            return 0;
        }
        try
        {
            if (testDirectory == null) ProfileContinuity.CopyIfNew(ProfileContinuity.EarlierProfile, profile);
            else if (testStage == "profile-reopen")
            {
                var migration = ProfileContinuity.CopyIfNew(Path.Combine(testDirectory, "previous", "profile"), profile);
                File.WriteAllText(Path.Combine(testDirectory, "profile-copy-result.json"), JsonSerializer.Serialize(migration, new JsonSerializerOptions { WriteIndented = true }));
            }
            using var window = new TRIScoreWindow(profile, testDirectory, testStage);
            Application.Run(window);
            return window.ResultCode;
        }
        catch (Exception error)
        {
            if (testDirectory != null) File.WriteAllText(Path.Combine(testDirectory, testStage + "-error.txt"), ProfileContinuity.SanitizeDiagnostics(error.ToString()));
            else MessageBox.Show("TRIScore could not start. Your saved data has not been reset.\n\n" + ProfileContinuity.SanitizeDiagnostics(error.Message), "TRIScore 4.3.3", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        finally { mutex.ReleaseMutex(); }
    }
}

internal sealed class TRIScoreWindow : AeroWindow
{
    internal static readonly string AppUrl = ProfileContinuity.SecureOrigin;
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(10, 15, 25) };
    private readonly string profile;
    private readonly string? testDirectory, testStage;
    private readonly Label loading = new() { Text = "Opening the control room…", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, ForeColor = Color.White };
    private readonly List<string> downloads = [];
    private bool smokeStarted;
    private readonly System.Windows.Forms.Timer chromeTimer = new() { Interval = 650 };
    private bool updatingChrome, closingChrome;
    private string? lastChromeTheme;
    internal int ResultCode { get; private set; }

    internal TRIScoreWindow(string profile, string? testDirectory, string? testStage)
    {
        this.profile = profile; this.testDirectory = testDirectory; this.testStage = testStage;
        Text = "TRIScore 4.3.3 — Inferno Lab · Aero";
        Size = new Size(1440, 1000); MinimumSize = new Size(720, 600);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
        BackColor = Color.FromArgb(10, 15, 25);
        using (var iconStream = Resource("TRIScore.Icon.ico")) Icon = new Icon(iconStream);
        if (testDirectory != null) { ShowInTaskbar = testStage == "chrome-preview"; WindowState = FormWindowState.Normal; Size = testStage == "chrome-preview" ? new Size(1360, 900) : Screen.PrimaryScreen!.WorkingArea.Size; StartPosition = testStage == "chrome-preview" ? FormStartPosition.CenterScreen : FormStartPosition.Manual; if (testStage != "chrome-preview") Location = new Point(-10000, -10000); }
        var menu = new MenuStrip();
        var file = new ToolStripMenuItem("&File");
        file.DropDownItems.Add("Seal Tris", null, async (_, _) => { if (browser.CoreWebView2 != null) await browser.ExecuteScriptAsync("window.TRIScoreTris?.seal()"); });
        file.DropDownItems.Add("Exit", null, (_, _) => Close());
        var help = new ToolStripMenuItem("&Help");
        help.DropDownItems.Add("Bring over existing memories", null, (_, _) => MessageBox.Show(
            "In your earlier desktop or browser app, unlock Tris and download an encrypted backup under Backups & recovery.\n\nIn this app, open Tris → Import or recover. Review the backup, then confirm import with your chosen local passphrase.\n\nThe earlier desktop profile is copied once when TRIScore starts, after that app closes. Browser data uses separate storage. Bring over colors using Color Studio theme and graph exports.", "Move Tris into the desktop app"));
        help.DropDownItems.Add("Open app data folder", null, (_, _) => { Directory.CreateDirectory(profile); Process.Start(new ProcessStartInfo("explorer.exe", profile) { UseShellExecute = true }); });
        help.DropDownItems.Add("About", null, (_, _) => MessageBox.Show(
            "TRIScore 4.3.3 · Windows desktop\nInferno Lab + Cosmic Origins + Manifold Atlas + encrypted Tris\n\nRuns locally using Microsoft WebView2. No Node installation or local server is needed.\nExisting data is copied once from the earlier desktop app into a separate TRIScore profile. The original profile stays intact. Keep encrypted backups for device transfer.", "About TRIScore"));
        help.DropDownItems.Add("Third-party notices", null, (_, _) => ShowNotices());
        menu.Items.Add(file); menu.Items.Add(help); MainMenuStrip = menu;
        Controls.Add(browser); Controls.Add(loading); Controls.Add(menu); menu.BringToFront(); loading.BringToFront();
        StyleMenu(menu);
        chromeTimer.Tick += async (_, _) => await UpdateChromeTheme();
        Shown += async (_, _) => await Initialize();
        FormClosed += (_, _) => { closingChrome = true; chromeTimer.Stop(); chromeTimer.Dispose(); browser.Dispose(); };
    }

    private async Task UpdateChromeTheme()
    {
        if (closingChrome || updatingChrome || browser.CoreWebView2 == null || WindowState == FormWindowState.Minimized) return;
        updatingChrome = true;
        try
        {
            const string script = "(()=>{const r=document.documentElement,s=getComputedStyle(r);return {background:s.getPropertyValue('--bg').trim(),accent:s.getPropertyValue('--accent').trim(),text:s.getPropertyValue('--text').trim(),dark:r.dataset.colorMode!=='light'};})()";
            string json = await browser.ExecuteScriptAsync(script);
            if (closingChrome || json == lastChromeTheme || json.Length > 1024) return;
            using var doc = JsonDocument.Parse(json);
            var value = doc.RootElement;
            if (value.ValueKind != JsonValueKind.Object ||
                !TryChromeColor(value, "background", out var background) ||
                !TryChromeColor(value, "accent", out var accent) ||
                !TryChromeColor(value, "text", out var text) ||
                !value.TryGetProperty("dark", out var mode) || mode.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return;
            ApplyAeroTheme(background, accent, text, mode.GetBoolean());
            lastChromeTheme = json;
        }
        catch (Exception error) when (error is InvalidOperationException or JsonException or COMException) { Trace("chrome sync skipped: " + error.GetType().Name); }
        finally { updatingChrome = false; }
    }

    private static bool TryChromeColor(JsonElement value, string name, out Color color)
    {
        color = Color.Empty;
        if (!value.TryGetProperty(name, out var field) || field.ValueKind != JsonValueKind.String) return false;
        string? hex = field.GetString();
        if (hex is not { Length: 7 } || hex[0] != '#' || !int.TryParse(hex.AsSpan(1), System.Globalization.NumberStyles.HexNumber, System.Globalization.CultureInfo.InvariantCulture, out int rgb)) return false;
        color = Color.FromArgb((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
        return true;
    }

    private static Stream Resource(string name) => Assembly.GetExecutingAssembly().GetManifestResourceStream(name) ?? throw new InvalidOperationException("Missing packaged resource: " + name);
    private static string ResourceText(string name) { using var r = new StreamReader(Resource(name), Encoding.UTF8); return r.ReadToEnd(); }

    private async Task Initialize()
    {
        try
        {
            Directory.CreateDirectory(profile);
            var options = new CoreWebView2EnvironmentOptions();
            if (testDirectory != null) options.AdditionalBrowserArguments = "--disable-features=CalculateNativeWinOcclusion";
            var environment = await CoreWebView2Environment.CreateAsync(null, profile, options);
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2;
            if (testDirectory != null)
                await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__nativeErrors=[];addEventListener('error',e=>__nativeErrors.push(e.message));addEventListener('unhandledrejection',e=>__nativeErrors.push(String(e.reason?.stack||e.reason)));");
            if (testStage == "origins-legacy")
                await core.AddScriptToExecuteOnDocumentCreatedAsync("if(location.hostname===" + JsonSerializer.Serialize(new Uri(AppUrl).Host) + ")localStorage.setItem(" + JsonSerializer.Serialize(ProfileContinuity.EarlierStorageKey("triscore-cosmic-origins-v1")) + "," + JsonSerializer.Serialize(ResourceText("TRIScore.LegacyOrigins.json")) + ");");
            var settings = core.Settings;
            settings.AreDevToolsEnabled = false;
            settings.AreHostObjectsAllowed = false;
            settings.IsWebMessageEnabled = false;
            settings.AreBrowserAcceleratorKeysEnabled = false;
            settings.IsPasswordAutosaveEnabled = false;
            settings.IsGeneralAutofillEnabled = false;
            settings.IsStatusBarEnabled = false;
            settings.AreDefaultContextMenusEnabled = false;
            core.PermissionRequested += (_, e) =>
            {
                // Every export still goes through the native owner-controlled Save dialog.
                bool localStorageOrExport = IsAppUrl(e.Uri) && (e.PermissionKind == CoreWebView2PermissionKind.MultipleAutomaticDownloads || e.PermissionKind == CoreWebView2PermissionKind.PersistentStorage);
                e.State = localStorageOrExport ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
                e.SavesInProfile = false;
                e.Handled = true;
                Trace("permission: " + e.PermissionKind + " = " + e.State);
            };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            if (testDirectory != null) core.ScriptDialogOpening += (_, e) => { Trace("unexpected script dialog: " + e.Message); e.Accept(); };
            core.NavigationStarting += (_, e) => { if (!IsAppUrl(e.Uri) && !e.Uri.StartsWith("blob:" + AppUrl, StringComparison.Ordinal)) e.Cancel = true; };
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (_, e) =>
            {
                bool allowed = IsAppUrl(e.Request.Uri) && (e.Request.Method == "GET" || e.Request.Method == "HEAD");
                e.Response = environment.CreateWebResourceResponse(
                    allowed && e.Request.Method != "HEAD" ? Resource("TRIScore.Workbench.html") : new MemoryStream(),
                    allowed ? 200 : 403, allowed ? "OK" : "Blocked",
                    "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer");
            };
            core.DownloadStarting += SaveDownload;
            core.ProcessFailed += (_, e) =>
            {
                if (testDirectory == null) MessageBox.Show("The app renderer stopped. Close and reopen TRIScore to recover saved state. Unsaved edits may be lost.", "TRIScore renderer");
            };
            core.NavigationCompleted += async (_, e) =>
            {
                if (!e.IsSuccess) { if (e.WebErrorStatus == CoreWebView2WebErrorStatus.OperationCanceled) return; await Fail(new InvalidOperationException("App page could not load: " + e.WebErrorStatus)); return; }
                loading.Visible = false;
                await UpdateChromeTheme();
                if (closingChrome) return;
                chromeTimer.Start();
                if (testDirectory == null) await browser.ExecuteScriptAsync("window.TRIScoreOrigins?.open()");
                else if (testStage == "chrome-preview") await browser.ExecuteScriptAsync("TRIScoreOrigins.open(); TRIScoreOrigins.pause(); TRIScoreOrigins.chooseEra('cosmicweb'); document.activeElement?.blur(); scrollTo(0,0);");
                else if (testStage == "chrome") { if (!smokeStarted) { smokeStarted = true; await RunChromeSmoke(); } }
                else if (!smokeStarted) { smokeStarted = true; await RunSmoke(); }
            };
            core.Navigate(AppUrl);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            await Fail(new InvalidOperationException("Microsoft Edge WebView2 Runtime is required. Install Microsoft's Evergreen WebView2 Runtime for your Windows architecture, then reopen TRIScore. Saved data has not been changed."));
        }
        catch (Exception error) { await Fail(error); }
    }

    private static bool IsAppUrl(string text) => Uri.TryCreate(text, UriKind.Absolute, out var uri) &&
        uri.Scheme == "https" && uri.Host == new Uri(AppUrl).Host && uri.IsDefaultPort && uri.AbsolutePath == "/" && uri.Query == "" && uri.UserInfo == "";

    private async Task RunChromeSmoke()
    {
        var checks = new List<string>();
        void Check(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); checks.Add(message); }
        try
        {
            chromeTimer.Stop();
            await browser.ExecuteScriptAsync("TRIScoreOrigins.open(); TRIScoreOrigins.pause();");
            await UpdateChromeTheme();
            Check(MainMenuStrip != null && MainMenuStrip.Items.Count == 2, "Native File and Help menus remain available");
            Check(browser.Top >= ChromeHeight, "WebView content starts below both native chrome rows");
            Check(ChromeCaptionHeight > 20 && ChromeHeight > ChromeCaptionHeight, "Caption and menu reserve DPI-scaled layout space");
            Check(HitTestChrome(new Point(ClientSize.Width / 2, ChromeCaptionHeight / 2)) == 2, "Caption blank area has native drag hit testing");
            foreach (var item in new[] { ("minimize", 8), ("maximize", 9), ("close", 20) })
            {
                var r = GetChromeButtonBounds(item.Item1);
                Check(!r.IsEmpty && HitTestChrome(new Point(r.Left + r.Width / 2, r.Top + r.Height / 2)) == item.Item2, "Native " + item.Item1 + " caption hit target is preserved");
            }
            var edgePoints = new[] { (new Point(1,1),13), (new Point(ClientSize.Width/2,1),12), (new Point(ClientSize.Width-2,1),14),
                (new Point(1,ClientSize.Height/2),10), (new Point(ClientSize.Width-2,ClientSize.Height/2),11),
                (new Point(1,ClientSize.Height-2),16), (new Point(ClientSize.Width/2,ClientSize.Height-2),15), (new Point(ClientSize.Width-2,ClientSize.Height-2),17) };
            foreach (var item in edgePoints) Check(HitTestChrome(item.Item1) == item.Item2, "Resize hit code " + item.Item2 + " is available");
            var originalBounds = Bounds;
            WindowState = FormWindowState.Maximized;
            await Task.Delay(120);
            Check(WindowState == FormWindowState.Maximized, "Window maximizes with native window state");
            var work = Screen.FromHandle(Handle).WorkingArea;
            var visibleClient = RectangleToScreen(ClientRectangle);
            Trace("maximize bounds=" + Bounds + "; client=" + visibleClient + "; work=" + work + "; dpi=" + DeviceDpi);
            Check(visibleClient.Bottom <= work.Bottom + 2 && visibleClient.Top >= work.Top - 2, "Maximized client respects the taskbar work area: " + visibleClient + " / " + work);
            WindowState = FormWindowState.Normal;
            Bounds = originalBounds;
            await Task.Delay(100);
            WindowState = FormWindowState.Minimized;
            await Task.Delay(60);
            Check(WindowState == FormWindowState.Minimized, "Window minimizes with native window state");
            WindowState = FormWindowState.Normal;
            Bounds = originalBounds;
            await Task.Delay(100);
            Check(WindowState == FormWindowState.Normal, "Window restores from minimized state");

            await browser.ExecuteScriptAsync("document.querySelector('[data-cs-mode=dark]').click(); const aeroDark=document.getElementById('cs-hex-dark'); aeroDark.value='#E78A45'; aeroDark.dispatchEvent(new Event('change',{bubbles:true}));");
            await UpdateChromeTheme();
            string dark = JsonSerializer.Serialize(InspectChrome());
            using var darkDoc = JsonDocument.Parse(dark);
            Check(darkDoc.RootElement.GetProperty("dark").GetBoolean(), "Native caption follows app dark mode");
            CaptureChrome(Path.Combine(testDirectory!, "Aero-Dark-Chrome.png"));
            await browser.ExecuteScriptAsync("document.querySelector('[data-cs-mode=light]').click(); const aeroLight=document.getElementById('cs-hex-light'); aeroLight.value='#2676B9'; aeroLight.dispatchEvent(new Event('change',{bubbles:true}));");
            await UpdateChromeTheme();
            string light = JsonSerializer.Serialize(InspectChrome());
            using var lightDoc = JsonDocument.Parse(light);
            Check(!lightDoc.RootElement.GetProperty("dark").GetBoolean(), "Native caption follows app light mode");
            Check(dark != light, "Native chrome responds to palette edits");
            CaptureChrome(Path.Combine(testDirectory!, "Aero-Light-Chrome.png"));
            await browser.ExecuteScriptAsync("TRIScoreInfernoTheme.apply(); TRIScoreOrigins.open(); TRIScoreOrigins.pause();");
            await UpdateChromeTheme();
            Check(!browser.CoreWebView2.Settings.AreHostObjectsAllowed && !browser.CoreWebView2.Settings.IsWebMessageEnabled, "Theme synchronization keeps the original host restrictions");
            Check((await browser.ExecuteScriptAsync("window.__nativeErrors.length")) == "0", "No renderer errors during native theme synchronization");
            CaptureChrome(Path.Combine(testDirectory!, "Aero-Inferno-Chrome.png"));
            File.WriteAllText(Path.Combine(testDirectory!, "chrome-result.json"), JsonSerializer.Serialize(new {
                architecture = RuntimeInformation.ProcessArchitecture.ToString(), checks, chrome = InspectChrome(), dark = darkDoc.RootElement.Clone(), light = lightDoc.RootElement.Clone(),
                bodySha256 = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(ResourceText("TRIScore.Workbench.html")))).ToLowerInvariant(),
                runtime = browser.CoreWebView2.Environment.BrowserVersionString
            }, new JsonSerializerOptions { WriteIndented = true }));
            Close();
        }
        catch (Exception error) { await Fail(error); }
    }

    private void CaptureChrome(string path)
    {
        var chrome = MainMenuStrip!.Parent!;
        using var bitmap = new Bitmap(chrome.Width, chrome.Height);
        chrome.DrawToBitmap(bitmap, new Rectangle(Point.Empty, bitmap.Size));
        bitmap.Save(path, System.Drawing.Imaging.ImageFormat.Png);
    }

    private async void SaveDownload(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        using var deferral = e.GetDeferral();
        // Leave the WebView callback before opening a modal owner-controlled Save dialog.
        await Task.Yield();
        Trace("download starting: " + e.DownloadOperation.Uri);
        e.Handled = true;
        if (!e.DownloadOperation.Uri.StartsWith("blob:" + AppUrl, StringComparison.Ordinal) && !e.DownloadOperation.Uri.StartsWith("data:", StringComparison.Ordinal)) { e.Cancel = true; return; }
        var name = Path.GetFileName(e.ResultFilePath);
        if (string.IsNullOrWhiteSpace(name)) name = "TRIScore-export.json";
        if (testDirectory != null) e.ResultFilePath = Path.Combine(testDirectory, name);
        else
        {
            using var picker = new SaveFileDialog { FileName = name, Title = "Save TRIScore export", OverwritePrompt = true, Filter = "All files (*.*)|*.*" };
            if (picker.ShowDialog(this) != DialogResult.OK) { e.Cancel = true; return; }
            e.ResultFilePath = picker.FileName;
        }
        var operation = e.DownloadOperation;
        operation.StateChanged += (_, _) =>
        {
            if (operation.State == CoreWebView2DownloadState.Completed) downloads.Add(operation.ResultFilePath);
            Trace("download state: " + operation.State);
            if (operation.State == CoreWebView2DownloadState.Interrupted && testDirectory == null)
                MessageBox.Show("The export did not finish. Try exporting again. Your stored state is unchanged.", "TRIScore export");
        };
    }

    private async Task RunSmoke()
    {
        try
        {
            Trace("smoke starting");
            await browser.ExecuteScriptAsync("window.__testStage=" + JsonSerializer.Serialize(testStage) + ";");
            if (testStage == "origins-legacy")
                await browser.ExecuteScriptAsync("window.__legacyOriginsLibrary=" + JsonSerializer.Serialize(ResourceText("TRIScore.LegacyOrigins.json")) + ";");
            if (testStage == "import")
            {
                var backup = Directory.GetFiles(testDirectory!, "*.tris").Single();
                await browser.ExecuteScriptAsync("window.__testBackup=" + JsonSerializer.Serialize(File.ReadAllText(backup)) + ";");
            }
            await browser.ExecuteScriptAsync(ResourceText(testStage!.StartsWith("origins") ? "TRIScore.OriginsSmoke.js" : "TRIScore.Smoke.js"));
            Trace("smoke script scheduled");
            var deadline = DateTime.UtcNow.AddSeconds(70);
            string result;
            while (true)
            {
                result = await browser.ExecuteScriptAsync("window.__desktopQA || null");
                Trace(result);
                using var json = JsonDocument.Parse(result);
                if (json.RootElement.ValueKind == JsonValueKind.Object && json.RootElement.TryGetProperty("done", out var done) && done.GetBoolean()) break;
                if (DateTime.UtcNow >= deadline) throw new TimeoutException("Desktop smoke script timed out: " + result);
                await Task.Delay(100);
            }
            using var parsed = JsonDocument.Parse(result);
            if (parsed.RootElement.TryGetProperty("error", out var error)) throw new InvalidOperationException(error.GetString());
            if (testStage == "origins")
            {
                foreach (var id in new[] { "co-export", "co-png" })
                {
                    int expected = downloads.Count + 1;
                    await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Runtime.evaluate", JsonSerializer.Serialize(new {
                        expression = "document.getElementById('" + id + "').click()", userGesture = true
                    }));
                    while (downloads.Count < expected && DateTime.UtcNow < deadline) await Task.Delay(100);
                    if (downloads.Count < expected) throw new InvalidOperationException("Origins export did not finish: " + id);
                }
                using var library = JsonDocument.Parse(File.ReadAllText(downloads.Single(p => p.EndsWith(".json"))));
                if (library.RootElement.GetProperty("schema").GetString() != "triscore.origins.library.v1" ||
                    library.RootElement.GetProperty("records").GetArrayLength() != 1)
                    throw new InvalidOperationException("Origins JSON has no expected schema or captured experiment");
            }
            if (testStage == "atlas")
            {
                foreach (var id in new[] { "cy-export-one", "cy-png" })
                {
                    int expected = downloads.Count + 1;
                    await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Runtime.evaluate", JsonSerializer.Serialize(new {
                        expression = "document.getElementById('" + id + "').click()", userGesture = true
                    }));
                    while (downloads.Count < expected && DateTime.UtcNow < deadline) await Task.Delay(100);
                    if (downloads.Count < expected) throw new InvalidOperationException("Atlas export did not finish: " + id);
                }
                if (!File.ReadAllText(downloads.Single(p => p.EndsWith(".json"))).Contains("triscore-manifold-atlas/v1"))
                    throw new InvalidOperationException("Atlas JSON has no schema");
            }
            if (testStage == "create")
            {
                while (downloads.Count < 1 && DateTime.UtcNow < deadline) await Task.Delay(100);
                // Separate user gestures, as in normal use; Chromium limits unsolicited multiple downloads.
                foreach (var id in new[] { "tp-export-json", "tp-export-png" })
                {
                    Trace("export gesture: " + id);
                    int expected = downloads.Count + 1;
                    await browser.CoreWebView2.CallDevToolsProtocolMethodAsync("Runtime.evaluate", JsonSerializer.Serialize(new {
                        expression = "document.getElementById('" + id + "').click()", userGesture = true
                    }));
                    Trace("export gesture returned: " + id);
                    while (downloads.Count < expected && DateTime.UtcNow < deadline) await Task.Delay(100);
                }
                while (downloads.Count < 3 && DateTime.UtcNow < deadline) await Task.Delay(100);
                if (downloads.Count < 3) throw new InvalidOperationException("Expected encrypted backup, graph JSON, and PNG downloads. Got " + downloads.Count);
                if (File.ReadAllText(downloads.Single(p => p.EndsWith(".tris"))).Contains("DESKTOP_PRIVATE_MEMORY")) throw new InvalidOperationException("Plaintext in backup");
            }
            // The packaged host must reject navigation away from its embedded page.
            browser.CoreWebView2.Navigate("https://example.com/");
            await Task.Delay(150);
            if (!IsAppUrl(browser.CoreWebView2.Source)) throw new InvalidOperationException("External navigation escaped host restriction");
            await browser.ExecuteScriptAsync(testStage!.StartsWith("origins") ? "TRIScoreOrigins.open(); document.activeElement?.blur(); scrollTo(0,0);" : testStage.StartsWith("atlas") ? "TRIScoreAtlas.open(); document.activeElement?.blur(); scrollTo(0,0);" : "TRIScoreTopologyLab.open(); document.querySelector('[data-tp-view=calabi]').click(); document.activeElement?.blur(); scrollTo(0,0);");
            await Task.Delay(300);
            using (var image = File.Create(Path.Combine(testDirectory!, testStage + "-preview.png")))
                await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
            File.WriteAllText(Path.Combine(testDirectory!, testStage + "-result.json"), JsonSerializer.Serialize(new {
                architecture = RuntimeInformation.ProcessArchitecture.ToString(),
                runtime = browser.CoreWebView2.Environment.BrowserVersionString,
                result = parsed.RootElement.Clone(), downloads,
                externalNavigationBlocked = true,
                hostObjectsDisabled = !browser.CoreWebView2.Settings.AreHostObjectsAllowed,
                webMessagesDisabled = !browser.CoreWebView2.Settings.IsWebMessageEnabled
            }, new JsonSerializerOptions { WriteIndented = true }));
            Close();
        }
        catch (Exception error) { await Fail(error); }
    }

    private void Trace(string value) { if (testDirectory != null) File.AppendAllText(Path.Combine(testDirectory, testStage + "-trace.txt"), ProfileContinuity.SanitizeDiagnostics(value) + "\n"); }

    private Task Fail(Exception error)
    {
        ResultCode = 1;
        if (testDirectory != null) File.WriteAllText(Path.Combine(testDirectory, testStage + "-error.txt"), ProfileContinuity.SanitizeDiagnostics(error.ToString()));
        else MessageBox.Show(ProfileContinuity.SanitizeDiagnostics(error.Message), "TRIScore 4.3.3", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Close();
        return Task.CompletedTask;
    }

    private void ShowNotices()
    {
        using var dialog = new Form { Text = "Third-party notices", Size = new Size(850, 650), StartPosition = FormStartPosition.CenterParent };
        dialog.Controls.Add(new TextBox { Text = ResourceText("TRIScore.Notices.txt").Replace("\n", "\r\n"), Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill });
        dialog.ShowDialog(this);
    }
}
